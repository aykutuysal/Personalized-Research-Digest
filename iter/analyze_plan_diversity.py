#!/usr/bin/env python3
"""Compare plan structure between temp=0.7 and temp=0.3 runs of v0+DeepSeek.

For each (profile, temperature), we have 3 runs. We measure how similar
runs are *to each other* — the test of whether temp=0.3 collapses variance
into one modal answer.
"""

import json
import re
import statistics
from glob import glob
from pathlib import Path

PROFILES = ["llm_agents", "marketing", "afib", "adolescent_depression"]


def load_plans(pattern):
    """Returns {profile: [list of 3 plan dicts]}"""
    out = {p: [] for p in PROFILES}
    for f in sorted(glob(pattern)):
        d = json.load(open(f))
        plan = d.get("plan", {})
        if not plan.get("queries"):
            continue
        for prof in PROFILES:
            if f"_{prof}_" in f:
                out[prof].append(plan)
                break
    return out


def query_strings(plan):
    return [q["query"].strip() for q in plan.get("queries", [])]


def tokenize(query):
    """Lowercase, strip operators, return set of content tokens (len >= 3)."""
    s = query.lower()
    s = re.sub(r'\b(and|or|not)\b', ' ', s)
    s = re.sub(r'[()"\'+-]', ' ', s)
    tokens = re.findall(r'[a-z][a-z0-9]{2,}', s)
    return set(tokens)


def phrases(query):
    """Quoted phrases inside the query string."""
    return set(m.group(1).lower() for m in re.finditer(r'"([^"]+)"', query))


def jaccard(a, b):
    if not a and not b:
        return 1.0
    return len(a & b) / len(a | b)


def pairwise_mean(items, fn):
    """Mean of fn(items[i], items[j]) over all i<j."""
    pairs = []
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            pairs.append(fn(items[i], items[j]))
    return statistics.mean(pairs) if pairs else 0.0


def run_signature(plan):
    """A signature of a run: union of all phrases + tokens across all queries."""
    all_phrases = set()
    all_tokens = set()
    for q in query_strings(plan):
        all_phrases |= phrases(q)
        all_tokens |= tokenize(q)
    return all_phrases, all_tokens


def analyze(plans_by_profile, label):
    print(f"\n{'='*92}")
    print(f"  {label}")
    print(f"{'='*92}")
    print(f"{'profile':25s} {'#runs':>6s} {'#q/run':>8s} {'phrase-J':>10s} {'token-J':>10s} {'queryset-J':>12s} {'unique-phr':>12s}")
    print("-" * 92)
    for prof, plans in plans_by_profile.items():
        if len(plans) < 2:
            print(f"{prof:25s} {len(plans):>6d}  insufficient runs")
            continue
        # Per-run stats
        nq_per_run = [len(query_strings(p)) for p in plans]

        # Run signatures (union of all phrases / tokens in a plan)
        sigs = [run_signature(p) for p in plans]
        phrase_sets = [s[0] for s in sigs]
        token_sets = [s[1] for s in sigs]

        # Mean pairwise Jaccard between runs' phrase sets and token sets
        phrase_jaccard = pairwise_mean(phrase_sets, jaccard)
        token_jaccard = pairwise_mean(token_sets, jaccard)

        # Query-set Jaccard (treating each query string as one token)
        query_sets = [set(query_strings(p)) for p in plans]
        queryset_jaccard = pairwise_mean(query_sets, jaccard)

        # Mean unique phrases per run
        unique_phrases_per_run = statistics.mean(len(s) for s in phrase_sets)

        print(f"{prof:25s} {len(plans):>6d} {statistics.mean(nq_per_run):>8.1f} "
              f"{phrase_jaccard:>10.2f} {token_jaccard:>10.2f} {queryset_jaccard:>12.2f} "
              f"{unique_phrases_per_run:>12.1f}")


def diff_summary(plans_07, plans_03):
    print(f"\n{'='*92}")
    print("  DELTA (temp=0.3 − temp=0.7): positive = MORE similar between runs at low temp")
    print(f"{'='*92}")
    print(f"{'profile':25s} {'Δ phrase-J':>12s} {'Δ token-J':>12s} {'Δ queryset-J':>14s}")
    print("-" * 92)
    for prof in PROFILES:
        a = plans_07.get(prof, [])
        b = plans_03.get(prof, [])
        if len(a) < 2 or len(b) < 2:
            print(f"{prof:25s}  insufficient runs")
            continue

        def metrics(plans):
            sigs = [run_signature(p) for p in plans]
            ph = [s[0] for s in sigs]
            tk = [s[1] for s in sigs]
            qs = [set(query_strings(p)) for p in plans]
            return (
                pairwise_mean(ph, jaccard),
                pairwise_mean(tk, jaccard),
                pairwise_mean(qs, jaccard),
            )

        ap, at, aq = metrics(a)
        bp, bt, bq = metrics(b)
        print(f"{prof:25s} {bp-ap:>+12.2f} {bt-at:>+12.2f} {bq-aq:>+14.2f}")


def main():
    plans_07 = load_plans("iter/runs/v0_variance/*.json")
    plans_03 = load_plans("iter/runs/v0_variance_t03/*.json")

    analyze(plans_07, "temp = 0.7")
    analyze(plans_03, "temp = 0.3")
    diff_summary(plans_07, plans_03)

    # Sample queries side-by-side from one profile to make it concrete
    print(f"\n{'='*92}")
    print("  SAMPLE: adolescent_depression — first 5 queries from each of the 3 runs")
    print(f"{'='*92}")
    for label, plans in [("temp=0.7", plans_07["adolescent_depression"]),
                         ("temp=0.3", plans_03["adolescent_depression"])]:
        print(f"\n{label}:")
        for i, p in enumerate(plans, 1):
            print(f"  run {i}:")
            for q in query_strings(p)[:5]:
                print(f"    - {q[:100]}")


if __name__ == "__main__":
    main()
