#!/usr/bin/env python3
"""Re-score the union of all unique papers across v0/v7/v8 runs of one profile
in a single scorer call so that prompt versions can be compared apples-to-apples
without scorer noise.

Per profile:
  1. Load v0 (3 runs), v7 (1 run), v8 (1 run) scorecards.
  2. Build the union of all unique (paper_id, title) seen anywhere.
  3. Single DeepSeek scorer call labels them all consistently.
  4. For each run, recompute union_yes / union_total / coverage using the new
     stable labels.
  5. Print v0_mean / v7 / v8 side by side.
"""

import json
import os
import sys
import time
from glob import glob
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from score_plan import load_env, openrouter_chat, parse_plan, score_titles


PROFILES = ["llm_agents", "marketing", "afib", "adolescent_depression"]


def collect_papers(scorecard):
    """Return {pid: title} from a scorecard's query results."""
    out = {}
    for qr in scorecard["query_results"]:
        for h in qr.get("hits", []):
            pid = h.get("id") or h.get("title", "")[:80]
            if not pid:
                continue
            out[pid] = h.get("title", "")
    return out


def stable_score(api_key, profile_text, papers_dict):
    """Score all papers in batches of 60 using the SAME scorer call sequence."""
    items = list(papers_dict.items())
    labels = {}
    BATCH = 60
    for start in range(0, len(items), BATCH):
        chunk = items[start:start + BATCH]
        flat = [(i + 1, t[:200]) for i, (_, t) in enumerate(chunk)]
        scores = score_titles(api_key, profile_text, flat)
        for i, (pid, _) in enumerate(chunk, start=1):
            labels[pid] = scores.get(i, "?")
        time.sleep(0.3)
    return labels


def union_for_run(scorecard, label_map):
    """Compute (union_total, union_yes, union_partial) using stable labels."""
    pids_in_run = set()
    for qr in scorecard["query_results"]:
        for h in qr.get("hits", []):
            pid = h.get("id") or h.get("title", "")[:80]
            if pid:
                pids_in_run.add(pid)
    yes = sum(1 for pid in pids_in_run if label_map.get(pid) == "YES")
    par = sum(1 for pid in pids_in_run if label_map.get(pid) == "PARTIAL")
    return len(pids_in_run), yes, par


def main():
    load_env()
    api_key = os.environ["OPENROUTER_API_KEY"]

    out_lines = []
    for prof in PROFILES:
        print(f"\n{'='*80}")
        print(f"  {prof}")
        print(f"{'='*80}")

        profile_text = Path(f"iter/profiles/{prof}.md").read_text()

        v0_files = sorted(glob(f"iter/runs/v0_variance/v0_{prof}_ds_r*.json"))
        v7_files = sorted(glob(f"iter/runs/v7/v7_{prof}_ds_r*.json"))
        v8_files = sorted(glob(f"iter/runs/v8/v8_{prof}_ds_r*.json"))
        v72_files = sorted(glob(f"iter/runs/v7_2/v72_{prof}_ds_r*.json"))

        all_runs = []
        for f in v0_files: all_runs.append(("v0",  f, json.load(open(f))))
        for f in v7_files: all_runs.append(("v7",  f, json.load(open(f))))
        for f in v8_files: all_runs.append(("v8",  f, json.load(open(f))))
        for f in v72_files: all_runs.append(("v72", f, json.load(open(f))))

        if not all_runs:
            print("  no runs"); continue

        # Build union across all runs for this profile
        union = {}
        for _, _, d in all_runs:
            union.update(collect_papers(d))
        print(f"  total unique papers across all runs: {len(union)}")

        # Stable score
        print(f"  stable-scoring...", end=" ", flush=True)
        t0 = time.monotonic()
        label_map = stable_score(api_key, profile_text, union)
        print(f"{time.monotonic()-t0:.1f}s")

        # Per-run union recomputation
        v0_yes = []
        for tag, f, d in all_runs:
            tot, yes, par = union_for_run(d, label_map)
            prec = (yes + 0.5*par)/tot if tot else 0
            short = Path(f).stem
            print(f"  {tag} {short:55s} unique={tot:3d} YES={yes:3d} PART={par:3d} union_p={prec*100:3.0f}%")
            if tag == "v0":
                v0_yes.append(yes)

        if v0_yes:
            import statistics
            v0_mean = statistics.mean(v0_yes)
            v0_std = statistics.stdev(v0_yes) if len(v0_yes) > 1 else 0
            print(f"  v0 MEAN±STD YES: {v0_mean:.0f}±{v0_std:.0f}")


if __name__ == "__main__":
    main()
