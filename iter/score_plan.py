#!/usr/bin/env python3
"""
End-to-end test harness for query planner iteration.

Takes (prompt_file, profile_file) → generates a plan → runs queries against
OpenAlex → classifies top hits for on-topic-ness via DeepSeek v3.2 → outputs
a scorecard JSON.

Usage:
    python score_plan.py \
        --prompt iter/prompts/v1_field_anchor.md \
        --profile iter/profiles/marketing.md \
        --out iter/runs/v1_marketing.json
"""

import argparse
import concurrent.futures
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


# ---------- env ----------


def load_env(env_file=".env.local"):
    path = Path(env_file)
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        os.environ.setdefault(key.strip(), val.strip())


# ---------- OpenRouter ----------


def openrouter_chat(api_key, model, system, user, temperature=0.7, max_tokens=None):
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
    }
    if max_tokens:
        body["max_tokens"] = max_tokens
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://paper-tracker-test",
            "X-OpenRouter-Title": "query-planner-iter",
        },
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode())


def fetch_generation(api_key, gen_id):
    url = f"https://openrouter.ai/api/v1/generation?id={urllib.parse.quote(gen_id)}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}"})
    for attempt in range(5):
        try:
            time.sleep(1 + attempt)
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode())
            data = result.get("data", result)
            if data.get("total_cost") is not None:
                return data
        except Exception:
            pass
    return None


# ---------- plan parsing ----------


def parse_plan(content):
    text = content.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        end = len(lines)
        for i in range(len(lines) - 1, 0, -1):
            if lines[i].strip() == "```":
                end = i
                break
        text = "\n".join(lines[1:end]).strip()
    return json.loads(text)


# ---------- OpenAlex ----------


SELECT_FIELDS = "id,title,relevance_score,abstract_inverted_index"


def reconstruct_abstract(inv_idx):
    """Convert OpenAlex's inverted-index abstract format back to plain text."""
    if not inv_idx:
        return ""
    pos_to_word = {}
    for word, positions in inv_idx.items():
        for p in positions:
            pos_to_word[p] = word
    if not pos_to_word:
        return ""
    return " ".join(pos_to_word[i] for i in sorted(pos_to_word))


def fetch_openalex(query_text, from_date, to_date, api_key, email, filter_mode="search"):
    """filter_mode: 'search' (OpenAlex default search, full-text) or 'title_and_abstract.search'."""
    search_param = urllib.parse.quote(query_text)
    # Filter to real academic content types; exclude datasets, product listings, etc.
    types = "types/article|types/review|types/book-chapter|types/preprint|types/dissertation|types/report|types/peer-review"

    if filter_mode == "title_and_abstract.search":
        # Build filter with raw query inside, then URL-encode once. Avoids double-encoding.
        filt = (
            f"title_and_abstract.search:{query_text},"
            f"from_publication_date:{from_date},to_publication_date:{to_date},"
            f"type:{types}"
        )
        filter_param = urllib.parse.quote(filt, safe=":,|/")
        url_query = f"?filter={filter_param}&per_page=25&page=1&select={SELECT_FIELDS}"
    else:
        date_filter = (
            f"from_publication_date:{from_date},to_publication_date:{to_date},type:{types}"
        )
        filter_param = urllib.parse.quote(date_filter, safe=":,|/")
        url_query = (
            f"?search={search_param}&filter={filter_param}"
            f"&per_page=25&page=1&select={SELECT_FIELDS}"
        )

    url = (
        f"https://api.openalex.org/works"
        f"{url_query}"
        f"&api_key={api_key}&mailto={email}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "query-plan-iter/1.0"})
    last_err = None
    for attempt in range(2):  # 2 attempts max — fail fast
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            last_err = e
            if attempt == 0:
                time.sleep(1.5)
    raise last_err


def breadth_band(count):
    if count == 0:
        return "zero"
    if count < 30:
        return "low"
    if count <= 500:
        return "healthy"
    if count <= 2000:
        return "recall_safety"
    return "too_broad"


# ---------- relevance scoring ----------


SCORER_SYSTEM = """You are a paper relevance classifier. Given a reader profile and a list of papers
(each with title and abstract), classify each paper as one of:

- YES — clearly relevant to what the reader wants
- PARTIAL — tangentially related (same broad area but wrong specialty or angle)
- NO — off-topic (different field, or area the reader explicitly doesn't want)

Read the abstract — titles are often vague or misleading. Judge primarily on what the abstract says
the work is actually about.

Respond with ONLY a JSON object in this form:
{"scores": [{"i": 1, "label": "YES"}, {"i": 2, "label": "NO"}, ...]}

No prose. No explanation. Just the JSON."""


def _score_batch(api_key, profile_text, batch, batch_label=""):
    """Single LLM call. batch: list of (i, title, abstract). Returns (scores_dict, elapsed_s, err_or_None)."""
    lines = []
    for entry in batch:
        if len(entry) == 2:
            i, title = entry
            abstract = ""
        else:
            i, title, abstract = entry
        block = f'{i}. TITLE: "{title}"'
        if abstract:
            block += f'\n   ABSTRACT: {abstract}'
        lines.append(block)
    user = f"READER PROFILE:\n{profile_text}\n\nPAPERS:\n" + "\n\n".join(lines)
    last_err = None
    t0 = time.monotonic()
    for attempt in range(3):
        try:
            result = openrouter_chat(
                api_key,
                "deepseek/deepseek-v3.2",
                SCORER_SYSTEM,
                user,
                temperature=0.0,
                max_tokens=2000,
            )
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            parsed = parse_plan(content)
            scores = parsed.get("scores", [])
            if scores:
                return {s["i"]: s["label"] for s in scores}, time.monotonic() - t0, None
            last_err = "empty scores list"
        except Exception as e:
            last_err = str(e)
        time.sleep(1 + attempt)
        print(f"  {batch_label} retry {attempt + 1}/3: {last_err}", file=sys.stderr, flush=True)
    return {}, time.monotonic() - t0, last_err


def score_titles(api_key, profile_text, papers_with_ids, batch_size=15, max_workers=5):
    """Batches in parallel via ThreadPoolExecutor. Prints per-batch start + completion lines so
    it's obvious that work is happening (and that batches truly run concurrently)."""
    if not papers_with_ids:
        return {}
    batches = [papers_with_ids[i:i + batch_size]
               for i in range(0, len(papers_with_ids), batch_size)]
    n_batches = len(batches)
    print(f"  judge: {len(papers_with_ids)} papers across {n_batches} batches "
          f"of ≤{batch_size}, {max_workers} workers", flush=True)

    t_stage = time.monotonic()
    out = {}
    completed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
        future_to_idx = {}
        for idx, batch in enumerate(batches):
            label = f"batch {idx + 1}/{n_batches}"
            print(f"    → submit {label} ({len(batch)} papers)", flush=True)
            fut = ex.submit(_score_batch, api_key, profile_text, batch, label)
            future_to_idx[fut] = (idx, len(batch))
        for fut in concurrent.futures.as_completed(future_to_idx):
            idx, n = future_to_idx[fut]
            scores, elapsed, err = fut.result()
            completed += 1
            tag = "ERROR " + err if err else (f"got {len(scores)}/{n} labels")
            print(f"    ← batch {idx + 1}/{n_batches} done in {elapsed:.1f}s "
                  f"({tag}) [{completed}/{n_batches} complete]", flush=True)
            out.update(scores)
    print(f"  judge stage took {time.monotonic() - t_stage:.1f}s for {n_batches} batches", flush=True)
    return out


# ---------- main ----------


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", required=False, default=None)
    parser.add_argument("--profile", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--plan-model", default="openai/gpt-5.4")
    parser.add_argument("--from-date", default="2026-04-06")
    parser.add_argument("--to-date", default="2026-04-13")
    parser.add_argument("--temperature", type=float, default=0.7)
    parser.add_argument("--angles", default=None,
                        help="Optional path to angles JSON; appends REQUIRED_ANGLES "
                             "block to user prompt for slot-filled prompts (v7+).")
    parser.add_argument("--plan-from-file", default=None,
                        help="Skip LLM plan generation; load plan from this JSON file. "
                             "File must have shape {subject, queries: [{id, query, angle, rationale}]}.")
    parser.add_argument("--filter", default="search",
                        choices=["search", "title_and_abstract.search"],
                        help="OpenAlex search mode used for fetching hits.")
    args = parser.parse_args()
    if not args.prompt and not args.plan_from_file:
        parser.error("--prompt is required unless --plan-from-file is given")

    load_env(".env.local")
    load_env("../.env.local")  # fallback when invoked from iter/
    or_key = os.environ.get("OPENROUTER_API_KEY", "")
    oa_key = os.environ.get("OPENALEX_API_KEY", "")
    oa_email = (os.environ.get("OPENALEX_EMAIL", "")
                or os.environ.get("OPENALEX_MAILTO", ""))
    if not or_key:
        print("ERROR: OPENROUTER_API_KEY missing")
        sys.exit(1)

    profile_text = Path(args.profile).read_text()

    if args.plan_from_file:
        plan = json.loads(Path(args.plan_from_file).read_text())
        queries = plan.get("queries", [])
        plan_elapsed = 0.0
        plan_cost = 0.0
        print(f"plan:    {args.plan_from_file} (prebuilt, {len(queries)} queries)")
        print(f"profile: {args.profile}")
        print(f"filter:  {args.filter}")
        print(f"dates:   {args.from_date} to {args.to_date}")
        print()
    else:
        system_prompt = Path(args.prompt).read_text()

        if args.angles:
            angles_data = json.loads(Path(args.angles).read_text())
            angle_lines = "\n".join(
                f"  {i+1}. {a}" for i, a in enumerate(angles_data["angles"])
            )
            budget = angles_data.get("query_budget")
            if budget is not None:
                min_per = angles_data.get("min_per_angle", 1)
                max_per = angles_data.get("max_per_angle", 4)
                profile_text = (
                    f"{profile_text}\n\n"
                    f"REQUIRED_ANGLES (you MUST cover every one of these):\n"
                    f"{angle_lines}\n\n"
                    f"QUERY_BUDGET: {budget}\n"
                    f"MIN_PER_ANGLE: {min_per}\n"
                    f"MAX_PER_ANGLE: {max_per}\n"
                )
            else:
                n = angles_data.get("queries_per_angle", 2)
                profile_text = (
                    f"{profile_text}\n\n"
                    f"REQUIRED_ANGLES (you MUST cover every one of these):\n"
                    f"{angle_lines}\n\n"
                    f"QUERIES_PER_ANGLE: {n}\n"
                )

        print(f"prompt:  {args.prompt}")
        print(f"profile: {args.profile}")
        print(f"model:   {args.plan_model}")
        print(f"filter:  {args.filter}")
        print(f"dates:   {args.from_date} to {args.to_date}")
        print()

        # 1) Generate plan
        print("[1/3] generating plan...", end=" ", flush=True)
        t0 = time.monotonic()
        result = openrouter_chat(
            or_key, args.plan_model, system_prompt, profile_text, args.temperature
        )
        plan_elapsed = time.monotonic() - t0
        gen_id = result.get("id", "")
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        gen_data = fetch_generation(or_key, gen_id) if gen_id else None
        plan_cost = (gen_data or {}).get("total_cost")
        try:
            plan = parse_plan(content)
        except Exception as e:
            print(f"PARSE ERROR: {e}")
            sys.exit(2)
        queries = plan.get("queries", [])
        print(f"{plan_elapsed:.1f}s, {len(queries)} queries, ${plan_cost}")

    # 2) Run queries against OpenAlex (parallel)
    print(f"[2/3] running {len(queries)} OpenAlex queries in parallel...", flush=True)
    t_oa = time.monotonic()

    def _fetch_and_dedup(q):
        try:
            data = fetch_openalex(
                q["query"], args.from_date, args.to_date, oa_key, oa_email,
                filter_mode=args.filter,
            )
            count = data.get("meta", {}).get("count", 0)
            raw_hits = data.get("results", [])
            seen_ids = set()
            seen_titles = set()
            hits = []
            for r in raw_hits:
                oid = r.get("id", "") or ""
                title = (r.get("title") or "").strip()
                title_key = title.lower()[:120]
                if oid and oid in seen_ids:
                    continue
                if title_key and title_key in seen_titles:
                    continue
                seen_ids.add(oid)
                seen_titles.add(title_key)
                abstract = reconstruct_abstract(r.get("abstract_inverted_index"))
                hits.append({
                    "title": title,
                    "abstract": abstract,
                    "relevance_score": r.get("relevance_score") or 0,
                    "id": oid,
                })
                if len(hits) >= 10:
                    break
            return q, count, hits, None
        except Exception as e:
            return q, -1, [], str(e)

    results_by_id = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        futures = [ex.submit(_fetch_and_dedup, q) for q in queries]
        for fut in concurrent.futures.as_completed(futures):
            q, count, hits, err = fut.result()
            band = breadth_band(count) if count >= 0 else "error"
            tag = f"ERROR {err}" if err else f"count={count:5d} {band}"
            print(f"  Q{q['id']:2d} [{q.get('angle','?'):40.40}] {tag}", flush=True)
            results_by_id[q["id"]] = {
                "id": q["id"],
                "query": q["query"],
                "angle": q.get("angle", ""),
                "rationale": q.get("rationale", ""),
                "openalex_count": count,
                "breadth_band": band,
                "hits": hits,
            }
    # Preserve original plan order in the scorecard
    query_results = [results_by_id[q["id"]] for q in queries if q["id"] in results_by_id]
    print(f"  OpenAlex stage took {time.monotonic() - t_oa:.1f}s", flush=True)

    # 3) Score top hits for on-topic-ness via DeepSeek
    print("[3/3] scoring hits via DeepSeek v3.2...")
    flat = []
    idx_map = {}
    i = 1
    for qr in query_results:
        for j, h in enumerate(qr["hits"]):
            title = (h.get("title") or "")[:300]
            abstract = (h.get("abstract") or "")[:500]
            flat.append((i, title, abstract))
            idx_map[i] = (qr["id"], j)
            i += 1

    scores = score_titles(or_key, profile_text, flat)

    for qr in query_results:
        qr["hit_labels"] = []
        labels = []
        for j, h in enumerate(qr["hits"]):
            for k, v in idx_map.items():
                if v == (qr["id"], j):
                    label = scores.get(k, "?")
                    qr["hit_labels"].append(label)
                    labels.append(label)
                    break
        # precision = (YES + 0.5*PARTIAL) / n
        if labels:
            precision = (
                labels.count("YES") + 0.5 * labels.count("PARTIAL")
            ) / len(labels)
        else:
            precision = None
        qr["precision"] = round(precision, 2) if precision is not None else None

    # 4) Summary
    bands = {
        "zero": 0,
        "low": 0,
        "healthy": 0,
        "recall_safety": 0,
        "too_broad": 0,
        "error": 0,
    }
    precisions = []
    for qr in query_results:
        bands[qr["breadth_band"]] = bands.get(qr["breadth_band"], 0) + 1
        if qr["precision"] is not None:
            precisions.append(qr["precision"])

    total = sum(bands.values())
    frac_healthy = bands["healthy"] / total if total else 0
    frac_healthy_or_safety = (bands["healthy"] + bands["recall_safety"]) / total if total else 0
    mean_precision = sum(precisions) / len(precisions) if precisions else 0

    # score breakdown per band
    per_band_precision = {}
    for band_name in bands:
        ps = [qr["precision"] for qr in query_results if qr["breadth_band"] == band_name and qr["precision"] is not None]
        per_band_precision[band_name] = round(sum(ps) / len(ps), 2) if ps else None

    # convergence criterion: >=60% healthy AND >=70% on-topic
    passing = frac_healthy >= 0.60 and mean_precision >= 0.70

    scorecard = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "prompt_file": args.prompt or args.plan_from_file,
        "profile_file": args.profile,
        "plan_model": args.plan_model if not args.plan_from_file else "prebuilt",
        "plan_cost_usd": plan_cost,
        "plan_elapsed_s": round(plan_elapsed, 1),
        "openalex_filter": args.filter,
        "num_queries": len(queries),
        "from_date": args.from_date,
        "to_date": args.to_date,
        "bands": bands,
        "frac_healthy": round(frac_healthy, 2),
        "frac_healthy_or_safety": round(frac_healthy_or_safety, 2),
        "mean_precision": round(mean_precision, 2),
        "per_band_precision": per_band_precision,
        "passing": passing,
        "plan": plan,
        "query_results": query_results,
    }

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(scorecard, indent=2))

    print()
    print("=" * 70)
    print(f"SCORECARD: {args.out}")
    print("=" * 70)
    print(f"  queries:          {len(queries)}")
    print(f"  bands:            zero={bands['zero']} low={bands['low']} healthy={bands['healthy']} recall_safety={bands['recall_safety']} too_broad={bands['too_broad']}")
    print(f"  frac healthy:     {frac_healthy:.0%}")
    print(f"  mean precision:   {mean_precision:.0%}")
    print(f"  per-band prec:    {per_band_precision}")
    print(f"  plan cost:        ${plan_cost}")
    print(f"  PASSING:          {'YES' if passing else 'no'}")


if __name__ == "__main__":
    main()
