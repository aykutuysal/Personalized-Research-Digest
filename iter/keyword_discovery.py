"""Keyword discovery pipeline (v9) — implements docs/superpowers/specs/keyword-discovery-spec.md.

Six steps:
    1. generate_seeds          — LLM produces 3-5 broad seed phrases
    2. fetch_seed_papers       — title_and_abstract.search against OpenAlex (parallel)
    3. extract_vocabulary      — pure-code mining of topics/keywords/journals/etc.
    4. build_library           — LLM produces 12-16 grounded queries
    5. validate_queries        — parallel per_page=1 calls to confirm result counts
    6. reformulate             — optional LLM pass to fix failures (≥3 zero-result queries)

All LLM calls go through openrouter_chat / fetch_generation imported from score_plan.
Default model is deepseek/deepseek-v3.2 to match the v8 baseline.
"""

import concurrent.futures
import json
import re
import time
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone

from score_plan import openrouter_chat, parse_plan


def fetch_generation(api_key, gen_id, max_attempts=10, base_delay=1.5):
    """Poll OpenRouter's generation endpoint for the finalized total_cost.

    Larger generations sometimes take >15s for cost to propagate; we poll up to
    ~30s before giving up.
    """
    if not gen_id:
        return None
    url = f"https://openrouter.ai/api/v1/generation?id={urllib.parse.quote(gen_id)}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}"})
    delay = base_delay
    for attempt in range(max_attempts):
        try:
            time.sleep(delay)
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode())
            data = result.get("data", result)
            if data.get("total_cost") is not None:
                return data
        except Exception:
            pass
        delay = min(delay + 0.5, 5.0)
    return None


DEFAULT_MODEL = "deepseek/deepseek-v3.2"

# Approximate per-token pricing on OpenRouter ($/1M tokens) — used as a fallback when
# the OpenRouter generation API doesn't return total_cost in time. None for unknown models
# (we'd rather report null than the wrong number).
MODEL_PRICING = {
    "deepseek/deepseek-v3.2": (0.27, 1.10),
    "google/gemini-3.1-pro-preview": (1.25, 10.00),
    "google/gemini-3.1-pro": (1.25, 10.00),
}


def _estimate_cost(usage, model=None):
    if not usage:
        return None
    pricing = MODEL_PRICING.get(model)
    if not pricing:
        return None
    in_rate, out_rate = pricing
    prompt = usage.get("prompt_tokens") or 0
    completion = usage.get("completion_tokens") or 0
    if not prompt and not completion:
        return None
    return round(
        (prompt * in_rate + completion * out_rate) / 1_000_000,
        6,
    )

OPENALEX_TYPES = (
    "types/article|types/review|types/book-chapter|types/preprint|"
    "types/dissertation|types/report|types/peer-review"
)

GENERIC_KEYWORDS = {"study", "research", "analysis", "method", "result"}

# Leading stopwords/connectives we skip when deriving seeds from angle text.
# Keep this tight — the goal is to take the first couple of *content* words from an angle
# so we fetch papers that use drug/procedure-named vocabulary (e.g., "SSRIs", "DOACs").
_ANGLE_SEED_STOPWORDS = {
    "and", "or", "vs", "versus", "the", "a", "an", "for", "of", "with", "to",
    "on", "in", "by", "as", "at",
}


def angles_to_seeds(angles, max_words=2):
    """Derive compact seed phrases from each angle's text (v9.2).

    For each angle, strip parenthesized clarifications and non-word punctuation, drop
    stopwords/connectives, collapse adjacent duplicates, and take the first ``max_words``
    tokens. Returns a list parallel to ``angles`` (one seed per angle, possibly empty).
    Empty strings are filtered out by the caller.
    """
    out = []
    for a in angles:
        # Strip parenthesized clarifications; they're often overly specific qualifiers.
        cleaned = re.sub(r"\([^)]*\)", " ", a)
        tokens = re.findall(r"[A-Za-z0-9][A-Za-z0-9\-/]*", cleaned)
        filtered = [t for t in tokens if t.lower() not in _ANGLE_SEED_STOPWORDS]
        deduped = []
        for w in filtered:
            if not deduped or deduped[-1].lower() != w.lower():
                deduped.append(w)
        if not deduped:
            out.append("")
            continue
        out.append(" ".join(deduped[:max_words]))
    return out


# ---------- Step 1: seeds ----------

SEED_SYSTEM = """You generate broad SEED search queries for an academic paper database (OpenAlex).
The user's profile follows. Your seeds are nets, not scalpels — they retrieve a sample of real papers
so we can mine vocabulary from them in a later step.

Rules:
1. Use the user's OWN terminology from their profile. Do not introduce jargon they didn't mention.
2. Keep each query simple: 2-4 words, space-separated. No boolean operators, no quotes, no special syntax.
3. Do NOT get creative. Each query represents one clean angle of their interest.
4. Prefer noun phrases over descriptions ("consumer psychology" beats "how consumers make decisions").

Respond with ONLY a JSON object: {"seeds": ["query 1", "query 2", "query 3"]}
No prose."""


def generate_seeds(profile_text, subject, angles, or_key, model=DEFAULT_MODEL):
    angle_lines = "\n".join(f"  - {a}" for a in angles)
    user = (
        f"USER PROFILE:\n{profile_text}\n\n"
        f"SUBJECT (one phrase summarising what they care about):\n{subject}\n\n"
        f"ANGLES THEY WANT COVERED:\n{angle_lines}\n\n"
        f"Generate 3-5 seed queries."
    )
    t0 = time.monotonic()
    result = openrouter_chat(or_key, model, SEED_SYSTEM, user, temperature=0.3, max_tokens=400)
    elapsed = time.monotonic() - t0
    gen_id = result.get("id", "")
    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
    usage = result.get("usage", {})
    cost = (fetch_generation(or_key, gen_id) or {}).get("total_cost") if gen_id else None
    if cost is None:
        cost = _estimate_cost(usage, model)
    parsed = parse_plan(content)
    seeds = [s.strip() for s in parsed.get("seeds", []) if isinstance(s, str) and s.strip()]
    return {"seeds": seeds, "cost": cost, "latency": round(elapsed, 1), "raw": content,
            "usage": usage}


# ---------- Step 2: fetch seed papers ----------

SEED_SELECT = (
    "title,primary_topic,keywords,primary_location,publication_date,"
    "abstract_inverted_index,cited_by_count"
)


def _fetch_one_seed(seed, from_date, oa_key, oa_email, per_page=50):
    """Fetch one seed via title_and_abstract.search. Returns list of work dicts (possibly empty)."""
    # Build the filter with the raw seed inside, then URL-encode once.
    filt = f"title_and_abstract.search:{seed},from_publication_date:{from_date},type:{OPENALEX_TYPES}"
    filter_param = urllib.parse.quote(filt, safe=":,|/")
    url = (
        f"https://api.openalex.org/works"
        f"?filter={filter_param}"
        f"&per_page={per_page}&page=1"
        f"&select={SEED_SELECT}"
        f"&mailto={oa_email}"
    )
    if oa_key:
        url += f"&api_key={oa_key}"
    req = urllib.request.Request(url, headers={"User-Agent": "keyword-discovery/1.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
            return data.get("results", []), data.get("meta", {}).get("count", 0)
        except Exception:
            if attempt == 2:
                return [], -1
            time.sleep(0.5 * (attempt + 1))
    return [], -1


def fetch_seed_papers(seeds, from_date, oa_key, oa_email, max_workers=5):
    """Run all seeds in parallel. Returns list of {seed, count, results}."""
    out = [None] * len(seeds)
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {
            ex.submit(_fetch_one_seed, s, from_date, oa_key, oa_email): i
            for i, s in enumerate(seeds)
        }
        for fut in concurrent.futures.as_completed(futures):
            i = futures[fut]
            results, count = fut.result()
            out[i] = {"seed": seeds[i], "count": count, "results": results}
    return out


# ---------- Step 3: vocabulary extraction (pure code) ----------


def is_valid_keyword(name):
    if not name or len(name) < 3:
        return False
    if "(" in name or ")" in name:
        return False
    if name.lower() in GENERIC_KEYWORDS:
        return False
    return True


def extract_vocabulary(seed_results):
    topics = Counter()
    subfields = Counter()
    fields = Counter()
    keywords = Counter()
    journals = Counter()
    sample_titles = []

    total_papers = 0
    for sr in seed_results:
        for paper in sr.get("results", []):
            total_papers += 1
            title = paper.get("title")
            if title:
                sample_titles.append(title)
            topic = paper.get("primary_topic")
            if topic:
                tname = topic.get("display_name")
                if tname:
                    topics[tname] += 1
                sub = topic.get("subfield") or {}
                if sub.get("display_name"):
                    subfields[sub["display_name"]] += 1
                fld = topic.get("field") or {}
                if fld.get("display_name"):
                    fields[fld["display_name"]] += 1
            for kw in paper.get("keywords", []) or []:
                kname = kw.get("display_name", "")
                if is_valid_keyword(kname):
                    keywords[kname] += 1
            loc = paper.get("primary_location") or {}
            src = (loc.get("source") or {}).get("display_name")
            if src:
                journals[src] += 1

    return {
        "total_papers": total_papers,
        "topics": topics.most_common(15),
        "subfields": subfields.most_common(10),
        "fields": fields.most_common(5),
        "keywords": keywords.most_common(25),
        "journals": journals.most_common(10),
        "sample_titles": sample_titles[:15],
    }


# ---------- Step 4: build refined library ----------

LIBRARY_SYSTEM = """You build a search query library for a research digest. The user's profile is below,
along with the REQUIRED_ANGLES (a fixed list — every angle is a hard slot you MUST cover) and
REAL vocabulary extracted from papers retrieved by seed queries.

Output a library of search queries for OpenAlex's title_and_abstract.search filter. This filter
supports only space-separated keywords — no AND, OR, NOT, or quotes.

HARD CONSTRAINTS (failures here invalidate the whole library):
- You MUST produce at least MIN_PER_ANGLE query for EVERY angle in REQUIRED_ANGLES. No skips.
- You may produce up to MAX_PER_ANGLE queries per angle. Do not exceed.
- Total queries must stay within QUERY_BUDGET.
- Each query must declare its principal `angle_id` (1-based, matching REQUIRED_ANGLES order).

RULES:
1. USE VOCABULARY FROM THE EXTRACTED DATA, not your own assumptions. These terms actually appear in
   the papers this user would want.
2. Filter out noise. A topic appearing in the data does not mean it serves this user's goal.
3. Dimensions allowed:
   - "core" — direct hit on one angle, refined with real vocabulary (most queries should be this)
   - "intersection" — combines two angles into one query (still tag with the principal angle_id)
   - "adjacent" — topic from a related field that supports an angle (still tag with the served angle_id)
   No serendipity / off-topic exploration — every query must serve a listed angle.
4. Each query: 2-6 space-separated words. Prefer specific noun phrases over generic descriptions.
5. Target result count: 10-500 papers per query per week. Too few = loosen. Too many = add a qualifier.
6. For each query, write a short rationale that references the USER'S GOAL, the angle it serves,
   and the vocabulary evidence.
7. Assign priority: every_cycle, rotate_biweekly, or rotate_monthly.

Respond with ONLY a JSON object:
{
  "queries": [
    {"query": "...", "angle_id": 1, "dimension": "core|intersection|adjacent",
     "priority": "every_cycle|rotate_biweekly|rotate_monthly", "rationale": "..."}
  ]
}
No prose."""


def _format_counter_lines(items, limit=None):
    if limit:
        items = items[:limit]
    return "\n".join(f"  - {name}  ({count}x)" for name, count in items)


def build_library(profile_text, subject, angles, seeds_with_counts, vocabulary, or_key,
                  model=DEFAULT_MODEL, query_budget=None, min_per_angle=1, max_per_angle=3):
    """angles: list[str]. Each angle gets a 1-based ID that the LLM must declare in `angle_id`."""
    n_angles = len(angles)
    if query_budget is None:
        # Each angle gets at least one slot; reserve a few for intersections/adjacents.
        query_budget = min(max(n_angles + 4, 12), 16)
    angle_lines = "\n".join(f"  {i+1}. {a}" for i, a in enumerate(angles))
    seed_lines = "\n".join(
        f"  - \"{s['seed']}\" → {s['count']} results"
        for s in seeds_with_counts
    )
    user = (
        f"USER PROFILE:\n{profile_text}\n\n"
        f"SUBJECT: {subject}\n\n"
        f"REQUIRED_ANGLES (you MUST cover every one of these):\n{angle_lines}\n\n"
        f"QUERY_BUDGET: {query_budget}\n"
        f"MIN_PER_ANGLE: {min_per_angle}\n"
        f"MAX_PER_ANGLE: {max_per_angle}\n\n"
        f"SEED QUERIES ALREADY RUN:\n{seed_lines}\n\n"
        f"EXTRACTED VOCABULARY (from {vocabulary['total_papers']} real papers):\n\n"
        f"Topics (OpenAlex's classification):\n{_format_counter_lines(vocabulary['topics'])}\n\n"
        f"Subfields:\n{_format_counter_lines(vocabulary['subfields'])}\n\n"
        f"Fields:\n{_format_counter_lines(vocabulary['fields'])}\n\n"
        f"Keywords from paper metadata:\n{_format_counter_lines(vocabulary['keywords'])}\n\n"
        f"Frequent journals:\n{_format_counter_lines(vocabulary['journals'])}\n\n"
        f"Sample titles:\n" + "\n".join(f"  - {t}" for t in vocabulary['sample_titles'])
    )
    t0 = time.monotonic()
    result = openrouter_chat(or_key, model, LIBRARY_SYSTEM, user, temperature=0.3, max_tokens=4000)
    elapsed = time.monotonic() - t0
    gen_id = result.get("id", "")
    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
    usage = result.get("usage", {})
    cost = (fetch_generation(or_key, gen_id) or {}).get("total_cost") if gen_id else None
    if cost is None:
        cost = _estimate_cost(usage, model)
    parsed = parse_plan(content)
    queries = _parse_query_list(parsed.get("queries", []), n_angles=n_angles)
    return {"queries": queries, "cost": cost, "latency": round(elapsed, 1), "raw": content,
            "usage": usage}


def _strip_operators(text):
    text = (text.replace(" AND ", " ")
                .replace(" OR ", " ")
                .replace(" NOT ", " ")
                .replace('"', ""))
    return " ".join(text.split())


def _parse_query_list(raw_queries, n_angles=None):
    """Normalize raw LLM-emitted queries. Coerces angle_id to int when possible."""
    out = []
    for q in raw_queries:
        if not isinstance(q, dict):
            continue
        text = (q.get("query") or "").strip()
        if not text:
            continue
        text = _strip_operators(text)
        angle_id = q.get("angle_id")
        try:
            angle_id = int(angle_id) if angle_id is not None else None
        except (TypeError, ValueError):
            angle_id = None
        if angle_id is not None and n_angles and not (1 <= angle_id <= n_angles):
            angle_id = None
        out.append({
            "query": text,
            "angle_id": angle_id,
            "dimension": q.get("dimension", "core"),
            "priority": q.get("priority", "every_cycle"),
            "rationale": q.get("rationale", ""),
        })
    return out


# ---------- Step 4.5: coverage check & fill missing angles ----------


def check_coverage(queries, n_angles):
    """Return the set of 1-based angle IDs that no query is tagged for."""
    covered = {q["angle_id"] for q in queries if q.get("angle_id")}
    return {i for i in range(1, n_angles + 1)} - covered


FILL_MISSING_SYSTEM = """The following REQUIRED_ANGLES were not covered by the initial library.
Generate exactly one query per missing angle, using the same rules and vocabulary as before.

HARD CONSTRAINTS:
- Output one query per missing angle (no skips, no extras).
- Each query: 2-6 space-separated words for OpenAlex title_and_abstract.search.
   No AND/OR/NOT/quotes.
- Use vocabulary from the extracted data when possible.
- Each query must declare its `angle_id` matching the missing angle's ID.

Respond with ONLY a JSON object:
{
  "queries": [
    {"query": "...", "angle_id": <int>, "dimension": "core",
     "priority": "every_cycle", "rationale": "..."}
  ]
}
No prose."""


def fill_missing_angles(missing_ids, angles, profile_text, subject, vocabulary, or_key,
                        model=DEFAULT_MODEL):
    if not missing_ids:
        return {"queries": [], "cost": 0.0, "latency": 0.0, "raw": ""}
    missing_lines = "\n".join(f"  {aid}. {angles[aid - 1]}" for aid in sorted(missing_ids))
    user = (
        f"USER PROFILE:\n{profile_text}\n\n"
        f"SUBJECT: {subject}\n\n"
        f"MISSING ANGLES (one query each, tag with the listed ID):\n{missing_lines}\n\n"
        f"EXTRACTED VOCABULARY:\n\n"
        f"Topics:\n{_format_counter_lines(vocabulary['topics'])}\n\n"
        f"Keywords:\n{_format_counter_lines(vocabulary['keywords'])}\n\n"
        f"Subfields:\n{_format_counter_lines(vocabulary['subfields'])}"
    )
    t0 = time.monotonic()
    result = openrouter_chat(or_key, model, FILL_MISSING_SYSTEM, user, temperature=0.3, max_tokens=1500)
    elapsed = time.monotonic() - t0
    gen_id = result.get("id", "")
    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
    usage = result.get("usage", {})
    cost = (fetch_generation(or_key, gen_id) or {}).get("total_cost") if gen_id else None
    if cost is None:
        cost = _estimate_cost(usage, model)
    parsed = parse_plan(content)
    queries = _parse_query_list(parsed.get("queries", []), n_angles=len(angles))
    return {"queries": queries, "cost": cost, "latency": round(elapsed, 1), "raw": content,
            "usage": usage}


# ---------- Step 5: validation ----------


def _validate_one(query, from_date, to_date, oa_key, oa_email):
    """Return (count_or_-1, error_str_or_None)."""
    filt = (
        f"title_and_abstract.search:{query},"
        f"from_publication_date:{from_date},to_publication_date:{to_date},"
        f"type:{OPENALEX_TYPES}"
    )
    filter_param = urllib.parse.quote(filt, safe=":,|/")
    url = (
        f"https://api.openalex.org/works"
        f"?filter={filter_param}"
        f"&per_page=1&page=1"
        f"&select=id"
        f"&mailto={oa_email}"
    )
    if oa_key:
        url += f"&api_key={oa_key}"
    req = urllib.request.Request(url, headers={"User-Agent": "keyword-discovery/1.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode())
            return data.get("meta", {}).get("count", 0), None
        except Exception as e:
            if attempt == 2:
                return -1, str(e)
            time.sleep(0.5 * (attempt + 1))
    return -1, "exhausted"


def _bucket(count):
    if count < 0:
        return "error"
    if count == 0:
        return "zero"
    if count <= 4:
        return "low"
    if count <= 500:
        return "good"
    if count <= 1500:
        return "broad"
    return "too_broad"


def validate_queries(queries, from_date, to_date, oa_key, oa_email, max_workers=8):
    out = [None] * len(queries)
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {
            ex.submit(_validate_one, q["query"], from_date, to_date, oa_key, oa_email): i
            for i, q in enumerate(queries)
        }
        for fut in concurrent.futures.as_completed(futures):
            i = futures[fut]
            count, err = fut.result()
            out[i] = {
                "query": queries[i]["query"],
                "dimension": queries[i].get("dimension"),
                "priority": queries[i].get("priority"),
                "last_run_count": count if count >= 0 else None,
                "status": _bucket(count),
                "error": err,
            }
    return out


# ---------- Step 6: reformulate ----------

REFORMULATE_SYSTEM = """These queries did not perform well against OpenAlex. Reformulate each one
into a query that serves the SAME angle (do not change angle_id) but with better vocabulary.

Rules:
- For ZERO-result queries: the vocabulary was wrong. Replace terms with phrases from the extracted
  keywords or topics. Loosen if needed.
- For TOO-BROAD queries (>1500 results): add a qualifier from the user's goal to make them more specific.
- For NEAR-ZERO queries (1-4 results) marked every_cycle: loosen by replacing the most specific term
  with a broader one from the vocabulary.
- Allowed dimensions: core, intersection, adjacent. NO serendipity.
- Each output query must keep the same `angle_id` as its predecessor.

Respond with ONLY a JSON object — same structure as the original library:
{"queries": [{"query": "...", "angle_id": <int>, "dimension": "...", "priority": "...", "rationale": "..."}]}
No prose."""


def reformulate(failures, vocabulary, or_key, model=DEFAULT_MODEL, n_angles=None):
    if not failures:
        return {"queries": [], "cost": 0.0, "latency": 0.0, "raw": ""}
    failure_lines = []
    for f in failures:
        cnt = f["last_run_count"]
        cnt_str = "ZERO" if cnt == 0 else (f"TOO BROAD ({cnt})" if cnt and cnt > 1500 else f"low ({cnt})")
        aid = f.get("angle_id")
        aid_str = f"angle_id={aid}, " if aid else ""
        failure_lines.append(
            f'  - "{f["query"]}" — {cnt_str} ({aid_str}{f.get("dimension","?")}, {f.get("priority","?")})'
        )
    user = (
        f"FAILURES:\n" + "\n".join(failure_lines) + "\n\n"
        f"EXTRACTED VOCABULARY:\n\n"
        f"Topics:\n{_format_counter_lines(vocabulary['topics'])}\n\n"
        f"Subfields:\n{_format_counter_lines(vocabulary['subfields'])}\n\n"
        f"Keywords:\n{_format_counter_lines(vocabulary['keywords'])}"
    )
    t0 = time.monotonic()
    result = openrouter_chat(or_key, model, REFORMULATE_SYSTEM, user, temperature=0.3, max_tokens=2000)
    elapsed = time.monotonic() - t0
    gen_id = result.get("id", "")
    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
    usage = result.get("usage", {})
    cost = (fetch_generation(or_key, gen_id) or {}).get("total_cost") if gen_id else None
    if cost is None:
        cost = _estimate_cost(usage, model)
    parsed = parse_plan(content)
    queries = _parse_query_list(parsed.get("queries", []), n_angles=n_angles)
    return {"queries": queries, "cost": cost, "latency": round(elapsed, 1), "raw": content,
            "usage": usage}


# ---------- orchestrator ----------


def discover(profile_text, subject, angles, or_key, oa_key, oa_email,
             scoring_from, scoring_to, model=DEFAULT_MODEL,
             seed_model=None, library_model=None, reformulate_model=None,
             vocab_months_back=6, use_angle_seeds=False):
    """Run the full 6-step pipeline.

    Per-step model overrides: seed_model / library_model / reformulate_model. If None,
    fall back to the `model` argument (for backward compatibility).
    scoring_from / scoring_to are the date window we will validate against.

    When ``use_angle_seeds`` is True (v9.2), step 1 returns ``LLM seeds ∪ angle-derived seeds``
    to force the vocabulary miner to read papers that use drug/procedure-named terms in
    clinical-narrow profiles (the v8 gap documented in SESSION 3's log).
    """
    t_total = time.monotonic()
    seed_model = seed_model or model
    library_model = library_model or model
    reformulate_model = reformulate_model or model
    six_months_ago = (datetime.now(timezone.utc) - timedelta(days=30 * vocab_months_back)).date().isoformat()

    # Step 1
    seed_out = generate_seeds(profile_text, subject, angles, or_key, model=seed_model)
    llm_seeds = seed_out["seeds"]
    if not llm_seeds:
        raise RuntimeError("step 1 returned no seeds")

    angle_seeds = []
    if use_angle_seeds:
        raw = angles_to_seeds(angles)
        seen_lower = {s.lower() for s in llm_seeds}
        for s in raw:
            if s and s.lower() not in seen_lower:
                angle_seeds.append(s)
                seen_lower.add(s.lower())
    seeds = llm_seeds + angle_seeds

    # Step 2
    seed_results = fetch_seed_papers(seeds, six_months_ago, oa_key, oa_email)
    non_empty = [sr for sr in seed_results if sr.get("results")]
    if not non_empty:
        # Spec fallback: run profile_text as a single wildcard.
        fallback = _fetch_one_seed(profile_text[:200], six_months_ago, oa_key, oa_email)
        seed_results = [{"seed": "(profile fallback)", "count": fallback[1], "results": fallback[0]}]
        if not seed_results[0]["results"]:
            raise RuntimeError("all seeds and fallback returned 0 results")

    seeds_with_counts = [{"seed": sr["seed"], "count": sr["count"]} for sr in seed_results]

    # Step 3
    vocabulary = extract_vocabulary(seed_results)

    # Step 4 — build library (every angle MUST get ≥1 query)
    lib_out = build_library(profile_text, subject, angles, seeds_with_counts, vocabulary,
                            or_key, model=library_model)
    queries = lib_out["queries"]

    # Step 4.5 — coverage check + fill-missing pass
    n_angles = len(angles)
    missing = check_coverage(queries, n_angles)
    fill_out = {"queries": [], "cost": 0.0, "latency": 0.0, "raw": "", "missing_before": sorted(missing)}
    if missing:
        fill_out_call = fill_missing_angles(missing, angles, profile_text, subject, vocabulary,
                                            or_key, model=library_model)
        fill_out.update({
            "queries": fill_out_call["queries"],
            "cost": fill_out_call["cost"],
            "latency": fill_out_call["latency"],
            "raw": fill_out_call["raw"],
        })
        queries = queries + fill_out_call["queries"]
        # Re-check; whatever's still missing stays missing (we don't loop).
        fill_out["missing_after"] = sorted(check_coverage(queries, n_angles))
    else:
        fill_out["missing_after"] = []

    # Step 5
    validation = validate_queries(queries, scoring_from, scoring_to, oa_key, oa_email)

    # Step 6 — only if ≥3 hard failures (zero or too_broad).
    failures = [v for v in validation if v["status"] in ("zero", "too_broad")
                or (v["status"] == "low" and v["priority"] == "every_cycle")]
    reformulate_out = {"queries": [], "cost": 0.0, "latency": 0.0, "raw": ""}
    if len(failures) >= 3:
        # Map failed queries back to their angle_id so reformulation preserves coverage.
        q_lookup = {q["query"]: q for q in queries}
        reform_input = []
        for f in failures:
            src = q_lookup.get(f["query"], {})
            reform_input.append({
                "query": f["query"],
                "angle_id": src.get("angle_id"),
                "dimension": f["dimension"],
                "priority": f["priority"],
                "last_run_count": f["last_run_count"],
            })
        reformulate_out = reformulate(reform_input, vocabulary, or_key, model=reformulate_model,
                                      n_angles=n_angles)
        if reformulate_out["queries"]:
            failed_q_set = {f["query"] for f in failures}
            kept = [q for q in queries if q["query"] not in failed_q_set]
            queries = kept + reformulate_out["queries"]
            validation = validate_queries(queries, scoring_from, scoring_to, oa_key, oa_email)

    seed_cost = seed_out["cost"] or 0.0
    lib_cost = lib_out["cost"] or 0.0
    fill_cost = fill_out["cost"] or 0.0
    reform_cost = reformulate_out["cost"] or 0.0

    return {
        "subject": subject,
        "model": model,
        "models": {
            "seed": seed_model,
            "library": library_model,
            "reformulate": reformulate_model,
        },
        "scoring_window": {"from": scoring_from, "to": scoring_to},
        "vocab_window_from": six_months_ago,
        "seeds": {
            "queries": seeds,
            "llm_seeds": llm_seeds,
            "angle_seeds": angle_seeds,
            "use_angle_seeds": use_angle_seeds,
            "raw_results": seeds_with_counts,
            "cost": seed_out["cost"],
            "latency_s": seed_out["latency"],
        },
        "vocabulary": vocabulary,
        "library": {
            "queries": queries,
            "cost": lib_out["cost"],
            "latency_s": lib_out["latency"],
        },
        "validation": validation,
        "fill_missing": fill_out,
        "reformulate": {
            "ran": len(failures) >= 3,
            "failures_input": failures,
            "queries": reformulate_out["queries"],
            "cost": reformulate_out["cost"],
            "latency_s": reformulate_out["latency"],
        },
        "costs": {
            "seed_usd": seed_cost,
            "library_usd": lib_cost,
            "fill_missing_usd": fill_cost,
            "reformulate_usd": reform_cost,
            "total_usd": round(seed_cost + lib_cost + fill_cost + reform_cost, 6),
        },
        "total_latency_s": round(time.monotonic() - t_total, 1),
    }
