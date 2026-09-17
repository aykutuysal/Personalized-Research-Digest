#!/usr/bin/env python3
"""v8 runner: two-pass slot-fill + diagnostic backfill.

Pass 1: v7 slot-filled plan → run queries → score hits.
Pass 2: feed per-angle results to a diagnostic LLM call which:
  - classifies each angle as covered / wrong-corpus / empty-corpus / marginal
  - generates 1-2 sharper backfill queries for wrong-corpus and marginal angles
Run backfills, score them, merge into the final scorecard.

Usage:
  python iter/run_v8.py --prompt iter/prompts/v7_slotfilled.md \
      --profile iter/profiles/afib.md \
      --angles  iter/profiles/afib.angles.json \
      --out     iter/runs/v8/v8_afib_ds_r1.json
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Reuse score_plan helpers (same dir).
sys.path.insert(0, str(Path(__file__).parent))
from score_plan import (
    load_env,
    openrouter_chat,
    fetch_generation,
    parse_plan,
    fetch_openalex,
    breadth_band,
    score_titles,
)


DIAGNOSTIC_SYSTEM = """You are diagnosing why each angle in a research query plan succeeded or failed at retrieving relevant papers.

For each angle you will see:
- the angle text
- the queries we ran (with hit count and top-5 hit titles + relevance labels)

For EACH angle, output ONE status:
  - "covered"     : angle has >= 3 YES papers among the returned hits
  - "marginal"    : 1-2 YES papers — could benefit from another phrasing angle
  - "wrong-corpus": queries returned >= 5 hits but 0 YES — phrasing was too generic, the papers are on adjacent but wrong topics; needs SHARPER queries (specific drug names, trial acronyms, named techniques)
  - "empty-corpus": queries returned < 5 hits TOTAL across all queries for this angle — no papers exist for this angle this week, no query change can fix it

For "wrong-corpus" and "marginal" angles ONLY, also generate 1 BACKFILL query that:
- uses highly specific anchor phrases the previous queries missed (named drugs, named trials, named techniques, named instruments)
- avoids the generic terms that returned off-topic noise
- still respects: max two AND-separated concept clusters; OR groups parenthesized; raw search syntax (not URL-encoded)

Output ONLY a JSON object:
{
  "angle_diagnoses": [
    {"angle_id": 1, "status": "covered", "reason": "5 YES papers on tool use"},
    {"angle_id": 4, "status": "wrong-corpus", "reason": "47 hits but all on AFib trials in general, not rate-vs-rhythm specifically"}
  ],
  "backfill_queries": [
    {"angle_id": 4, "query": "(\"AFFIRM\" OR \"EAST-AFNET 4\" OR \"CABANA\" OR \"RACE II\") AND (\"rate control\" OR \"rhythm control\")", "rationale": "named landmark trials for rate vs rhythm comparison"}
  ]
}

No prose. No markdown. JSON only."""


def render_angle_results(angles, query_results):
    """Render per-angle summary for the diagnostic LLM."""
    by_angle = {}
    for qr in query_results:
        aid = qr.get("angle_id", 0)
        by_angle.setdefault(aid, []).append(qr)

    lines = []
    for i, angle_text in enumerate(angles, start=1):
        lines.append(f"\nANGLE {i}: {angle_text}")
        qs = by_angle.get(i, [])
        if not qs:
            lines.append("  (no queries assigned)")
            continue
        for qr in qs:
            lines.append(f"  Q{qr['id']} count={qr['openalex_count']} query={qr['query'][:130]}")
            for h, lbl in zip(qr.get("hits", [])[:5], qr.get("hit_labels", [])):
                lines.append(f"    [{lbl}] {h.get('title','')[:110]}")
    return "\n".join(lines)


def call_diagnostic(api_key, profile_text, angles, query_results):
    user = (
        f"PROFILE:\n{profile_text}\n\n"
        f"PER-ANGLE RESULTS FROM PASS 1:\n"
        f"{render_angle_results(angles, query_results)}\n\n"
        f"For each of the {len(angles)} angles, classify status and generate backfill queries "
        f"only for wrong-corpus and marginal angles."
    )
    result = openrouter_chat(
        api_key,
        "deepseek/deepseek-v3.2",
        DIAGNOSTIC_SYSTEM,
        user,
        temperature=0.3,
        max_tokens=4000,
    )
    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
    gen_id = result.get("id", "")
    return parse_plan(content), gen_id


def run_query_against_openalex(query_text, from_date, to_date, oa_key, oa_email):
    data = fetch_openalex(query_text, from_date, to_date, oa_key, oa_email)
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
        hits.append({"title": title, "relevance_score": r.get("relevance_score") or 0, "id": oid})
        if len(hits) >= 5:
            break
    return count, hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--profile", required=True)
    ap.add_argument("--angles", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--plan-model", default="deepseek/deepseek-v3.2")
    ap.add_argument("--from-date", default="2026-04-06")
    ap.add_argument("--to-date", default="2026-04-13")
    ap.add_argument("--temperature", type=float, default=0.7)
    args = ap.parse_args()

    load_env()
    or_key = os.environ.get("OPENROUTER_API_KEY", "")
    oa_key = os.environ.get("OPENALEX_API_KEY", "")
    oa_email = os.environ.get("OPENALEX_EMAIL", "")

    system_prompt = Path(args.prompt).read_text()
    profile_raw = Path(args.profile).read_text()
    angles_data = json.loads(Path(args.angles).read_text())
    angles = angles_data["angles"]
    n = angles_data.get("queries_per_angle", 2)
    angle_lines = "\n".join(f"  {i+1}. {a}" for i, a in enumerate(angles))
    user_prompt = (
        f"{profile_raw}\n\nREQUIRED_ANGLES:\n{angle_lines}\n\nQUERIES_PER_ANGLE: {n}\n"
    )

    print(f"prompt:  {args.prompt}")
    print(f"profile: {args.profile}")
    print(f"angles:  {len(angles)}")
    print(f"model:   {args.plan_model}")
    print()

    # ---------- PASS 1: v7 slot-filled plan ----------
    print("[1/5] generating pass-1 plan...", end=" ", flush=True)
    t0 = time.monotonic()
    result = openrouter_chat(or_key, args.plan_model, system_prompt, user_prompt, args.temperature)
    pass1_elapsed = time.monotonic() - t0
    gen_id_1 = result.get("id", "")
    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
    plan = parse_plan(content)
    queries = plan.get("queries", [])
    print(f"{pass1_elapsed:.1f}s, {len(queries)} queries")

    # ---------- PASS 1: run OpenAlex queries ----------
    print("[2/5] running pass-1 queries against OpenAlex...")
    query_results = []
    for q in queries:
        time.sleep(0.2)
        try:
            count, hits = run_query_against_openalex(
                q["query"], args.from_date, args.to_date, oa_key, oa_email
            )
        except Exception as e:
            print(f"  Q{q['id']}: ERROR {e}")
            count, hits = -1, []
        band = breadth_band(count) if count >= 0 else "error"
        print(f"  Q{q['id']:2d} angle={q.get('angle_id','?')} count={count:5d} {band}")
        query_results.append({
            "id": q["id"],
            "angle_id": q.get("angle_id"),
            "angle": q.get("angle", ""),
            "slot": q.get("slot"),
            "query": q["query"],
            "openalex_count": count,
            "breadth_band": band,
            "hits": hits,
            "source": "pass1",
        })

    # ---------- PASS 1: score hits ----------
    print("[3/5] scoring pass-1 hits...")
    flat = []
    idx_map = {}
    i = 1
    for qr in query_results:
        for j, h in enumerate(qr["hits"]):
            flat.append((i, h["title"][:200]))
            idx_map[i] = (qr["id"], j)
            i += 1
    scores = score_titles(or_key, profile_raw, flat)
    for qr in query_results:
        qr["hit_labels"] = []
        for j, h in enumerate(qr["hits"]):
            for k, v in idx_map.items():
                if v == (qr["id"], j):
                    qr["hit_labels"].append(scores.get(k, "?"))
                    break

    # ---------- PASS 2: diagnostic + backfills ----------
    print("[4/5] running diagnostic + backfill generation...", end=" ", flush=True)
    t1 = time.monotonic()
    diag, gen_id_2 = call_diagnostic(or_key, profile_raw, angles, query_results)
    diag_elapsed = time.monotonic() - t1
    diagnoses = diag.get("angle_diagnoses", [])
    backfills = diag.get("backfill_queries", [])
    status_counts = {}
    for d in diagnoses:
        status_counts[d.get("status", "?")] = status_counts.get(d.get("status", "?"), 0) + 1
    print(f"{diag_elapsed:.1f}s — statuses: {status_counts}, backfills: {len(backfills)}")

    # ---------- PASS 2: run backfills ----------
    backfill_results = []
    if backfills:
        print("[5/5] running backfill queries...")
        next_id = max(qr["id"] for qr in query_results) + 1
        for bq in backfills:
            time.sleep(0.2)
            try:
                count, hits = run_query_against_openalex(
                    bq["query"], args.from_date, args.to_date, oa_key, oa_email
                )
            except Exception as e:
                print(f"  BACKFILL: ERROR {e}")
                count, hits = -1, []
            band = breadth_band(count) if count >= 0 else "error"
            print(f"  BF{next_id:2d} angle={bq.get('angle_id','?')} count={count:5d} {band}  {bq['query'][:80]}")
            backfill_results.append({
                "id": next_id,
                "angle_id": bq.get("angle_id"),
                "angle": angles[bq["angle_id"] - 1] if 1 <= bq.get("angle_id", 0) <= len(angles) else "",
                "slot": "backfill",
                "query": bq["query"],
                "openalex_count": count,
                "breadth_band": band,
                "hits": hits,
                "source": "backfill",
                "rationale": bq.get("rationale", ""),
            })
            next_id += 1

        # Score backfill hits
        flat2 = []
        idx_map2 = {}
        i = 1
        for qr in backfill_results:
            for j, h in enumerate(qr["hits"]):
                flat2.append((i, h["title"][:200]))
                idx_map2[i] = (qr["id"], j)
                i += 1
        scores2 = score_titles(or_key, profile_raw, flat2)
        for qr in backfill_results:
            qr["hit_labels"] = []
            for j, h in enumerate(qr["hits"]):
                for k, v in idx_map2.items():
                    if v == (qr["id"], j):
                        qr["hit_labels"].append(scores2.get(k, "?"))
                        break
    else:
        print("[5/5] no backfills needed (all angles covered or empty-corpus)")

    # ---------- aggregate union metrics ----------
    all_results = query_results + backfill_results
    rank = {"YES": 3, "PARTIAL": 2, "NO": 1, "?": 0}
    paper_label = {}
    for qr in all_results:
        for h, lbl in zip(qr.get("hits", []), qr.get("hit_labels", [])):
            pid = h.get("id") or h.get("title", "")[:80]
            if not pid:
                continue
            prev = paper_label.get(pid, "?")
            if rank.get(lbl, 0) > rank.get(prev, 0):
                paper_label[pid] = lbl
    union_total = len(paper_label)
    union_yes = sum(1 for v in paper_label.values() if v == "YES")
    union_partial = sum(1 for v in paper_label.values() if v == "PARTIAL")
    union_precision = (union_yes + 0.5 * union_partial) / union_total if union_total else 0

    # cost
    cost1 = (fetch_generation(or_key, gen_id_1) or {}).get("total_cost") if gen_id_1 else None
    cost2 = (fetch_generation(or_key, gen_id_2) or {}).get("total_cost") if gen_id_2 else None

    scorecard = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "prompt_file": args.prompt,
        "profile_file": args.profile,
        "angles_file": args.angles,
        "plan_model": args.plan_model,
        "pass1_cost_usd": cost1,
        "diagnostic_cost_usd": cost2,
        "n_pass1_queries": len(query_results),
        "n_backfill_queries": len(backfill_results),
        "angle_diagnoses": diagnoses,
        "union_total": union_total,
        "union_yes": union_yes,
        "union_partial": union_partial,
        "union_precision": round(union_precision, 3),
        "plan": plan,
        "query_results": all_results,
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(scorecard, indent=2))

    print()
    print("=" * 70)
    print(f"v8 SCORECARD: {args.out}")
    print("=" * 70)
    print(f"  pass1 queries:    {len(query_results)}")
    print(f"  backfill queries: {len(backfill_results)}")
    print(f"  union YES:        {union_yes}")
    print(f"  union precision:  {union_precision:.0%}")
    print(f"  diagnoses:        {status_counts}")
    print(f"  costs:            pass1=${cost1}, diagnostic=${cost2}")


if __name__ == "__main__":
    main()
