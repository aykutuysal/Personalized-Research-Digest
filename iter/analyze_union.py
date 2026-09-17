#!/usr/bin/env python3
"""Recompute scorecards through a 'union' lens.

Per-query precision treats queries as independent. The product cares about the
deduped union of relevant papers across the whole plan. This script computes:

  union_yes        : distinct papers labeled YES across all queries in a plan
  union_partial    : distinct papers labeled PARTIAL
  union_total      : distinct paper count across all top-5 hits in the plan
  union_precision  : (YES + 0.5*PARTIAL) / union_total
  unique_yes_share : fraction of YES papers that appear in only one query
                     (high = queries are complementary, low = redundant)

Compare to the per-query mean precision already in each scorecard.
"""

import json
import statistics
from glob import glob
from pathlib import Path

PROFILES = ["llm_agents", "marketing", "afib", "adolescent_depression"]


def union_metrics(scorecard):
    """Compute union-level metrics from a single scorecard JSON."""
    paper_label = {}        # id -> best label (YES > PARTIAL > NO > ?)
    paper_titles = {}       # id -> title (for debugging)
    paper_query_count = {}  # id -> how many queries surfaced it
    rank = {"YES": 3, "PARTIAL": 2, "NO": 1, "?": 0}

    for qr in scorecard["query_results"]:
        labels = qr.get("hit_labels", [])
        for h, lbl in zip(qr.get("hits", []), labels):
            pid = h.get("id") or h.get("title", "")[:80]
            if not pid:
                continue
            paper_query_count[pid] = paper_query_count.get(pid, 0) + 1
            paper_titles[pid] = h.get("title", "")
            prev = paper_label.get(pid, "?")
            if rank.get(lbl, 0) > rank.get(prev, 0):
                paper_label[pid] = lbl

    union_total = len(paper_label)
    union_yes = sum(1 for v in paper_label.values() if v == "YES")
    union_partial = sum(1 for v in paper_label.values() if v == "PARTIAL")
    union_no = sum(1 for v in paper_label.values() if v == "NO")
    union_unk = sum(1 for v in paper_label.values() if v == "?")

    union_precision = (
        (union_yes + 0.5 * union_partial) / union_total if union_total else 0
    )

    yes_singletons = sum(
        1 for pid, lbl in paper_label.items()
        if lbl == "YES" and paper_query_count.get(pid, 0) == 1
    )
    unique_yes_share = yes_singletons / union_yes if union_yes else 0

    return {
        "union_total": union_total,
        "union_yes": union_yes,
        "union_partial": union_partial,
        "union_no": union_no,
        "union_unk": union_unk,
        "union_precision": union_precision,
        "unique_yes_share": unique_yes_share,
    }


def load_runs(pattern):
    out = {p: [] for p in PROFILES}
    for f in sorted(glob(pattern)):
        d = json.load(open(f))
        for prof in PROFILES:
            if f"_{prof}_" in f:
                out[prof].append((f, d))
                break
    return out


def summarize(label, runs_by_profile):
    print(f"\n{'='*100}")
    print(f"  {label}")
    print(f"{'='*100}")
    print(f"{'profile':25s} {'run':>5s}  {'#unique':>8s} {'YES':>5s} {'PART':>5s} {'NO':>5s}  "
          f"{'union_p':>8s}  {'per-q_p':>8s}  {'YES_unique':>11s}")
    print("-" * 100)
    for prof, runs in runs_by_profile.items():
        if not runs:
            continue
        unions = []
        perqs = []
        yesc = []
        for f, d in runs:
            u = union_metrics(d)
            unions.append(u["union_precision"])
            yesc.append(u["union_yes"])
            perqs.append(d["mean_precision"])
            run_id = f.split("_r")[-1].replace(".json", "")
            print(f"{prof:25s} {run_id:>5s}  {u['union_total']:>8d} "
                  f"{u['union_yes']:>5d} {u['union_partial']:>5d} {u['union_no']:>5d}  "
                  f"{u['union_precision']*100:>7.0f}%  {d['mean_precision']*100:>7.0f}%  "
                  f"{u['unique_yes_share']*100:>10.0f}%")
        if len(runs) > 1:
            ums = statistics.mean(unions)
            uss = statistics.stdev(unions)
            pms = statistics.mean(perqs)
            pss = statistics.stdev(perqs)
            ymean = statistics.mean(yesc)
            ystd = statistics.stdev(yesc)
            print(f"{'  → MEAN±STD':25s} {'':>5s}  "
                  f"{'':>8s} {ymean:>4.0f}±{ystd:<2.0f}{'':<11s}"
                  f"{ums*100:>7.0f}%  {pms*100:>7.0f}%")
        print()


def main():
    print("Comparing per-query precision (existing metric) vs union precision (product metric).")
    print()
    print("Legend:")
    print("  #unique  : distinct papers across all queries in plan (after dedup)")
    print("  union_p  : (YES + 0.5*PARTIAL) / #unique — fraction of unique papers that are relevant")
    print("  per-q_p  : mean of per-query precision — what we used to optimize")
    print("  YES_unique: of YES papers, fraction surfaced by only ONE query (high = complementary queries)")

    summarize("v0 + DeepSeek + temp=0.7 (n=3)", load_runs("iter/runs/v0_variance/*.json"))
    summarize("v0 + DeepSeek + temp=0.7 (single run, GPT comparator)",
              load_runs("iter/runs/v0_clean/v0_*_gpt54.json"))
    summarize("v0 + DeepSeek + temp=0.7 (single, deepseek)",
              load_runs("iter/runs/v0_clean/v0_*_deepseek.json"))


if __name__ == "__main__":
    main()
