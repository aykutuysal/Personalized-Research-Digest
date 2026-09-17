#!/usr/bin/env python3
"""v8 vs v9.1 vs v9.2 comparison on the 4 standard profiles.

Focuses on the hypothesis under test: does the angle-seeded step 1 (v9.2) close v8's
remaining useful-paper advantage on clinical-narrow profiles (afib, adol_dep) without
giving back the wins v9.1 already had on llm_agents and marketing?

All numbers are abstract-aware (score_plan.py's --plan-from-file path).
"""

import json
import statistics
from pathlib import Path

ROOT = Path(__file__).parent
V8_RES_DIR = ROOT / "runs" / "v8_rescored"
V9_DIR = ROOT / "runs" / "v9_keyword_discovery"

PROFILES = ["llm_agents", "marketing", "afib", "adolescent_depression"]


def _load(path):
    return json.loads(path.read_text()) if path.exists() else None


def _unique(scorecard):
    ids = set()
    for qr in scorecard.get("query_results", []):
        for h in qr.get("hits", []):
            if h.get("id"):
                ids.add(h["id"])
    return len(ids)


def _lenient(scorecard):
    vals = []
    for qr in scorecard.get("query_results", []):
        labels = qr.get("hit_labels", [])
        if not labels:
            continue
        hits = sum(1 for l in labels if l in ("YES", "PARTIAL"))
        vals.append(hits / len(labels))
    return round(sum(vals) / len(vals), 3) if vals else None


def _yes_lenient_counts(scorecard):
    """Across all hits in all queries (after per-query top-K trim), how many are YES / YES+PARTIAL?"""
    yes = partial = total = 0
    for qr in scorecard.get("query_results", []):
        for l in qr.get("hit_labels", []):
            total += 1
            if l == "YES":
                yes += 1
            elif l == "PARTIAL":
                partial += 1
    return yes, yes + partial, total


def _union_yes(scorecard):
    """Count of unique OpenAlex IDs labeled YES across all queries (deduped)."""
    ids = {}
    for qr in scorecard.get("query_results", []):
        for h, l in zip(qr.get("hits", []), qr.get("hit_labels", [])):
            oid = h.get("id")
            if not oid:
                continue
            # Prefer a better label if we see the same paper twice.
            rank = {"YES": 3, "PARTIAL": 2, "NO": 1}.get(l, 0)
            if rank > rank_of(ids.get(oid)):
                ids[oid] = l
    return sum(1 for l in ids.values() if l == "YES"), sum(1 for l in ids.values() if l in ("YES", "PARTIAL")), len(ids)


def rank_of(label):
    return {"YES": 3, "PARTIAL": 2, "NO": 1}.get(label, 0)


def _summarize(sc):
    if not sc:
        return None
    yes_raw, yp_raw, total_raw = _yes_lenient_counts(sc)
    union_yes, union_yp, union_total = _union_yes(sc)
    return {
        "num_queries": sc["num_queries"],
        "frac_healthy": sc["frac_healthy"],
        "strict_precision": sc["mean_precision"],
        "lenient_precision": _lenient(sc),
        "unique_papers": _unique(sc),
        "yes_total": yes_raw,
        "yes_partial_total": yp_raw,
        "hits_scored": total_raw,
        "union_yes": union_yes,
        "union_yes_partial": union_yp,
        "union_total": union_total,
        "bands": sc.get("bands", {}),
    }


def _discovery_summary(artifact):
    if not artifact:
        return None
    s = artifact.get("seeds", {})
    val = artifact.get("validation", [])
    buckets = {}
    for v in val:
        buckets[v["status"]] = buckets.get(v["status"], 0) + 1
    return {
        "seeds": len(s.get("queries", [])),
        "llm_seeds": len(s.get("llm_seeds", [])) if s.get("llm_seeds") is not None else None,
        "angle_seeds": len(s.get("angle_seeds", [])) if s.get("angle_seeds") is not None else None,
        "vocab_papers": artifact["vocabulary"]["total_papers"],
        "library_size": len(artifact["library"]["queries"]),
        "buckets": buckets,
        "reformulated": artifact["reformulate"]["ran"],
        "fill_missing": artifact.get("fill_missing", {}),
        "total_cost": artifact["costs"]["total_usd"],
        "latency_s": artifact["total_latency_s"],
    }


def _avg(vals):
    vals = [v for v in vals if v is not None]
    return round(statistics.mean(vals), 3) if vals else None


def main():
    variants = [
        ("v8", lambda p: V8_RES_DIR / f"{p}.rescored.json"),
        ("v9.1", lambda p: V9_DIR / f"{p}_v91.rescored.json"),
        ("v9.2", lambda p: V9_DIR / f"{p}_v92.rescored.json"),
    ]
    discovery_variants = [
        ("v9.1", lambda p: V9_DIR / f"{p}_v91.json"),
        ("v9.2", lambda p: V9_DIR / f"{p}_v92.json"),
    ]

    rows = {p: {} for p in PROFILES}
    for p in PROFILES:
        for label, fn in variants:
            rows[p][label] = _summarize(_load(fn(p)))
        rows[p]["_disc"] = {}
        for label, fn in discovery_variants:
            rows[p]["_disc"][label] = _discovery_summary(_load(fn(p)))

    lines = []
    lines.append("# v8 vs v9.1 vs v9.2 — abstract-aware comparison\n")
    lines.append("Window: 2026-04-06 → 2026-04-13.  DeepSeek v3.2 on all LLM steps. Single run per profile.")
    lines.append("v9.2 differs from v9.1 only in step 1: seeds = LLM seeds ∪ first-2-words-per-angle.\n")

    lines.append("## Headline — useful-paper volume & precision (abstract-aware)\n")
    lines.append("Per-query rows report total scored hits (after top-K trim) labeled YES / YES+PARTIAL, "
                 "then union YES / YES+PARTIAL (deduped across queries).\n")
    lines.append("| Profile | Variant | Queries | frac_healthy | strict prec | lenient prec | "
                 "YES / total | YES+P / total | union YES | union YES+P |")
    lines.append("|---|---|---:|---:|---:|---:|---:|---:|---:|---:|")
    for p in PROFILES:
        for label in ("v8", "v9.1", "v9.2"):
            v = rows[p][label]
            if not v:
                lines.append(f"| {p} | {label} | — | — | — | — | — | — | — | — |")
                continue
            lines.append(
                f"| {p} | {label} | {v['num_queries']} | {v['frac_healthy']} | "
                f"{v['strict_precision']} | {v['lenient_precision']} | "
                f"{v['yes_total']} / {v['hits_scored']} | "
                f"{v['yes_partial_total']} / {v['hits_scored']} | "
                f"{v['union_yes']} | {v['union_yes_partial']} |"
            )

    lines.append("\n## Aggregate (4 profiles)\n")
    lines.append("| Variant | mean frac_healthy | mean strict prec | mean lenient prec | "
                 "mean unique papers | mean union YES | mean union YES+P |")
    lines.append("|---|---:|---:|---:|---:|---:|---:|")
    for label in ("v8", "v9.1", "v9.2"):
        vs = [rows[p][label] for p in PROFILES if rows[p][label]]
        if not vs:
            continue
        lines.append(
            f"| {label} | "
            f"{_avg([v['frac_healthy'] for v in vs])} | "
            f"{_avg([v['strict_precision'] for v in vs])} | "
            f"{_avg([v['lenient_precision'] for v in vs])} | "
            f"{_avg([v['unique_papers'] for v in vs])} | "
            f"{_avg([v['union_yes'] for v in vs])} | "
            f"{_avg([v['union_yes_partial'] for v in vs])} |"
        )

    lines.append("\n## v9.1 vs v9.2 discovery internals\n")
    lines.append("| Profile | Variant | Seeds (LLM+angle) | Vocab papers | Library | Buckets (zero/low/good/broad) | Reformulated? | Cost | Latency |")
    lines.append("|---|---|---|---:|---:|---|:-:|---:|---:|")
    for p in PROFILES:
        for label in ("v9.1", "v9.2"):
            d = rows[p]["_disc"].get(label)
            if not d:
                continue
            b = d["buckets"]
            b_str = f"{b.get('zero',0)}/{b.get('low',0)}/{b.get('good',0)}/{b.get('broad',0)+b.get('too_broad',0)}"
            seed_str = str(d["seeds"])
            if d.get("llm_seeds") is not None and d.get("angle_seeds") is not None:
                seed_str = f"{d['seeds']} ({d['llm_seeds']}+{d['angle_seeds']})"
            lines.append(
                f"| {p} | {label} | {seed_str} | {d['vocab_papers']} | {d['library_size']} | "
                f"{b_str} | {'yes' if d['reformulated'] else 'no'} | "
                f"${d['total_cost']} | {d['latency_s']}s |"
            )

    lines.append("\n## Delta table — v9.2 vs v9.1, v9.2 vs v8 (union YES+PARTIAL)\n")
    lines.append("Positive = v9.2 wins.\n")
    lines.append("| Profile | v9.2 − v9.1 | v9.2 − v8 |")
    lines.append("|---|---:|---:|")
    for p in PROFILES:
        v91 = rows[p].get("v9.1")
        v8 = rows[p].get("v8")
        v92 = rows[p].get("v9.2")
        if not v92:
            lines.append(f"| {p} | — | — |")
            continue
        d91 = f"{v92['union_yes_partial'] - v91['union_yes_partial']:+d}" if v91 else "—"
        d8 = f"{v92['union_yes_partial'] - v8['union_yes_partial']:+d}" if v8 else "—"
        lines.append(f"| {p} | {d91} | {d8} |")

    report = "\n".join(lines) + "\n"
    out_path = V9_DIR / "COMPARISON_V92.md"
    out_path.write_text(report)
    print(f"wrote {out_path}")
    print()
    print(report)


if __name__ == "__main__":
    main()
