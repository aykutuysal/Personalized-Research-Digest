#!/usr/bin/env python3
"""Run the keyword-discovery pipeline (v9) for one profile.

Writes:
    <out>            — full discovery artifact (vocab, costs, validation, etc.)
    <out>.plan.json  — adapted plan in the shape score_plan.py consumes via --plan-from-file

Usage:
    python run_v9_discovery.py \
        --profile profiles/llm_agents.md \
        --angles  profiles/llm_agents.angles.json \
        --out     runs/v9_keyword_discovery/llm_agents.json
"""

import argparse
import json
import os
import sys
from pathlib import Path

from score_plan import load_env
from keyword_discovery import discover, DEFAULT_MODEL


def adapt_to_score_plan(library_queries, subject, angles):
    """Convert v9 library output to score_plan.py's plan shape.
    Uses each query's angle_id (1-based) to look up the actual angle text from `angles`."""
    out = {"subject": subject, "queries": []}
    for i, q in enumerate(library_queries, start=1):
        aid = q.get("angle_id")
        if aid and 1 <= aid <= len(angles):
            angle_text = angles[aid - 1]
        else:
            angle_text = q.get("dimension", "core")
            aid = aid or i
        out["queries"].append({
            "id": i,
            "angle_id": aid,
            "slot": 1,
            "angle": angle_text,
            "query": q["query"],
            "rationale": q.get("rationale", ""),
            "dimension": q.get("dimension", "core"),
        })
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", required=True)
    parser.add_argument("--angles", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--model", default=DEFAULT_MODEL,
                        help="Default model used for all 3 LLM steps unless overridden.")
    parser.add_argument("--seed-model", default=None)
    parser.add_argument("--library-model", default=None,
                        help="Model for the heavy step-4 library build (judgment-heavy). "
                             "Try google/gemini-3.1-pro-preview for a reasoning-strong run.")
    parser.add_argument("--reformulate-model", default=None)
    parser.add_argument("--from-date", default="2026-04-06")
    parser.add_argument("--to-date", default="2026-04-13")
    parser.add_argument("--vocab-months", type=int, default=6)
    parser.add_argument("--use-angle-seeds", action="store_true",
                        help="v9.2: augment step-1 LLM seeds with first-two-words-per-angle "
                             "to force vocabulary mining on drug/procedure-named papers.")
    args = parser.parse_args()

    # Try both possible .env.local locations (cwd and project root).
    load_env(".env.local")
    load_env("../.env.local")
    or_key = os.environ.get("OPENROUTER_API_KEY", "")
    oa_key = os.environ.get("OPENALEX_API_KEY", "")
    oa_email = os.environ.get("OPENALEX_EMAIL", "") or os.environ.get("OPENALEX_MAILTO", "")
    if not or_key:
        print("ERROR: OPENROUTER_API_KEY missing", file=sys.stderr)
        sys.exit(1)
    if not oa_email:
        print("ERROR: OPENALEX_EMAIL or OPENALEX_MAILTO missing", file=sys.stderr)
        sys.exit(1)

    profile_text = Path(args.profile).read_text()
    angles_data = json.loads(Path(args.angles).read_text())
    subject = angles_data.get("subject", "")
    angles = list(angles_data.get("angles", []))

    print(f"profile: {args.profile}")
    print(f"angles:  {args.angles} ({len(angles)} angles, subject='{subject}')")
    print(f"model:   default={args.model}  seed={args.seed_model or args.model}  "
          f"library={args.library_model or args.model}  reformulate={args.reformulate_model or args.model}")
    print(f"window:  {args.from_date} to {args.to_date} (vocab back {args.vocab_months}mo)")
    print()

    print("[discover] running 6-step pipeline...", flush=True)
    artifact = discover(
        profile_text=profile_text,
        subject=subject,
        angles=angles,
        or_key=or_key,
        oa_key=oa_key,
        oa_email=oa_email,
        scoring_from=args.from_date,
        scoring_to=args.to_date,
        model=args.model,
        seed_model=args.seed_model,
        library_model=args.library_model,
        reformulate_model=args.reformulate_model,
        vocab_months_back=args.vocab_months,
        use_angle_seeds=args.use_angle_seeds,
    )

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(artifact, indent=2))

    plan = adapt_to_score_plan(artifact["library"]["queries"], subject, angles)
    plan_path = Path(str(out_path) + ".plan.json")
    plan_path.write_text(json.dumps(plan, indent=2))

    costs = artifact["costs"]
    val = artifact["validation"]
    bucket_counts = {}
    for v in val:
        bucket_counts[v["status"]] = bucket_counts.get(v["status"], 0) + 1

    print()
    print("=" * 70)
    print(f"DISCOVERY: {out_path}")
    print(f"PLAN:      {plan_path}")
    print("=" * 70)
    s = artifact["seeds"]
    n_llm = len(s.get("llm_seeds", []))
    n_angle = len(s.get("angle_seeds", []))
    if s.get("use_angle_seeds"):
        print(f"  seeds:           {len(s['queries'])} (LLM={n_llm} + angle={n_angle}, {s['cost']}$)")
    else:
        print(f"  seeds:           {len(s['queries'])} ({s['cost']}$)")
    print(f"  vocabulary:      {artifact['vocabulary']['total_papers']} papers, "
          f"{len(artifact['vocabulary']['topics'])} topics, "
          f"{len(artifact['vocabulary']['keywords'])} keywords")
    print(f"  library:         {len(artifact['library']['queries'])} queries ({artifact['library']['cost']}$)")
    fm = artifact.get("fill_missing", {})
    if fm.get("missing_before"):
        print(f"  coverage gap:    initially missing angles {fm['missing_before']}; "
              f"filled with {len(fm.get('queries', []))} queries (${fm.get('cost', 0)}); "
              f"still missing after: {fm.get('missing_after', [])}")
    else:
        print(f"  coverage gap:    none — all {len(angles)} angles covered on first build")
    print(f"  validation:      {bucket_counts}")
    print(f"  reformulated:    {'yes' if artifact['reformulate']['ran'] else 'no'} "
          f"({len(artifact['reformulate']['queries'])} replacements, ${artifact['reformulate']['cost']})")
    print(f"  TOTAL COST:      ${costs['total_usd']}")
    print(f"  TOTAL LATENCY:   {artifact['total_latency_s']}s")


if __name__ == "__main__":
    main()
