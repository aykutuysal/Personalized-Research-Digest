#!/usr/bin/env python3
"""Compare v8 (deepseek_variance) baselines vs v9 (keyword-discovery) results.

Primary numbers are the abstract-aware re-scored runs:
  runs/v8_rescored/<profile>.rescored.json
  runs/v9_keyword_discovery/<profile>.rescored.json          (default search)
  runs/v9_keyword_discovery/<profile>.rescored.tiab.json     (title_and_abstract.search)

Title-only legacy precision (from original v8 deepseek_variance averages and the first v9
scored runs) is appended in a separate section for reference.
"""

import json
import statistics
from pathlib import Path

ROOT = Path(__file__).parent
V8_DIR = ROOT / "runs" / "deepseek_variance"
V8_RES_DIR = ROOT / "runs" / "v8_rescored"
V9_DIR = ROOT / "runs" / "v9_keyword_discovery"
V9_HYBRID_DIR = ROOT / "runs" / "v9_hybrid"

PROFILES = [
    ("llm_agents", "llm_agents"),
    ("marketing", "marketing"),
    ("afib", "afib"),
    ("adolescent_depression", "adol_dep"),
]


def _avg(values):
    vals = [v for v in values if v is not None]
    return round(statistics.mean(vals), 3) if vals else None


def _unique_papers(scorecard):
    ids = set()
    for qr in scorecard.get("query_results", []):
        for h in qr.get("hits", []):
            oid = h.get("id")
            if oid:
                ids.add(oid)
    return len(ids)


def _load_json(path):
    return json.loads(path.read_text()) if path.exists() else None


def _load_v8_runs(v8_stem):
    return [json.loads(p.read_text())
            for p in sorted(V8_DIR.glob(f"{v8_stem}_run*.json"))]


def _lenient_precision(scorecard):
    """Treat YES + PARTIAL as positive. Mean across queries, weighted equally per query."""
    vals = []
    for qr in scorecard.get("query_results", []):
        labels = qr.get("hit_labels", [])
        if not labels:
            continue
        hits = sum(1 for l in labels if l in ("YES", "PARTIAL"))
        vals.append(hits / len(labels))
    return round(sum(vals) / len(vals), 3) if vals else None


def _summarize(scorecard):
    if not scorecard:
        return None
    return {
        "frac_healthy": scorecard["frac_healthy"],
        "mean_precision": scorecard["mean_precision"],
        "lenient_precision": _lenient_precision(scorecard),
        "num_queries": scorecard["num_queries"],
        "unique_papers": _unique_papers(scorecard),
        "bands": scorecard["bands"],
    }


def _summarize_v9_discovery(artifact):
    if not artifact:
        return None
    val = artifact.get("validation", [])
    bucket_counts = {}
    for v in val:
        bucket_counts[v["status"]] = bucket_counts.get(v["status"], 0) + 1
    return {
        "seed_count": len(artifact.get("seeds", {}).get("queries", [])),
        "vocab_papers": artifact["vocabulary"]["total_papers"],
        "library_size": len(artifact["library"]["queries"]),
        "validation_buckets": bucket_counts,
        "reformulated": artifact["reformulate"]["ran"],
        "total_cost_usd": artifact["costs"]["total_usd"],
        "total_latency_s": artifact["total_latency_s"],
    }


def main():
    rows = []
    for profile_name, v8_stem in PROFILES:
        v8_runs_legacy = _load_v8_runs(v8_stem)
        rows.append({
            "profile": profile_name,
            "v8_legacy_avg": {
                "n_runs": len(v8_runs_legacy),
                "frac_healthy": _avg([r["frac_healthy"] for r in v8_runs_legacy]),
                "mean_precision": _avg([r["mean_precision"] for r in v8_runs_legacy]),
                "num_queries": _avg([r["num_queries"] for r in v8_runs_legacy]),
                "unique_papers": _avg([_unique_papers(r) for r in v8_runs_legacy]),
                "plan_cost": _avg([r.get("plan_cost_usd") for r in v8_runs_legacy]),
            } if v8_runs_legacy else None,
            "v8_rescored": _summarize(_load_json(V8_RES_DIR / f"{profile_name}.rescored.json")),
            "v9_default_legacy": _summarize(_load_json(V9_DIR / f"{profile_name}.scored.json")),
            "v9_default_rescored": _summarize(_load_json(V9_DIR / f"{profile_name}.rescored.json")),
            "v9_tiab_legacy": _summarize(_load_json(V9_DIR / f"{profile_name}.scored.tiab.json")),
            "v9_tiab_rescored": _summarize(_load_json(V9_DIR / f"{profile_name}.rescored.tiab.json")),
            "v9_discovery": _summarize_v9_discovery(
                _load_json(V9_DIR / f"{profile_name}.json")),
            "v9_hybrid_rescored": _summarize(
                _load_json(V9_HYBRID_DIR / f"{profile_name}.rescored.json")),
            "v9_hybrid_discovery": _summarize_v9_discovery(
                _load_json(V9_HYBRID_DIR / f"{profile_name}.json")),
            "v91_rescored": _summarize(
                _load_json(V9_DIR / f"{profile_name}_v91.rescored.json")),
            "v91_discovery": _summarize_v9_discovery(
                _load_json(V9_DIR / f"{profile_name}_v91.json")),
        })

    out = []
    out.append("# v8 baseline vs v9 keyword-discovery — comparison\n")
    out.append("Window: 2026-04-06 → 2026-04-13.  All LLM calls use deepseek/deepseek-v3.2.\n")
    out.append("**Primary precision numbers are abstract-aware** (judge sees title + first 500 chars "
               "of abstract). Title-only numbers are kept in the appendix for reference but should not "
               "be trusted in isolation.\n")
    out.append("v8 here is the run1 plan from each profile, re-scored once with the abstract-aware "
               "judge — single-run, no variance bars.\n")
    out.append("")

    out.append("## Headline (abstract-aware judge)\n")
    out.append("| Profile | Variant | Queries | frac_healthy | precision (strict) | precision (lenient) | Unique papers |")
    out.append("|---|---|---:|---:|---:|---:|---:|")
    for row in rows:
        p = row["profile"]
        for key, label in [("v8_rescored", "v8 (search)"),
                           ("v9_default_rescored", "v9 / search"),
                           ("v9_hybrid_rescored", "v9 hybrid (Gemini Pro on step 4)"),
                           ("v91_rescored", "v9.1 (slot-filled, no serendipity)"),
                           ("v9_tiab_rescored", "v9 / tiab.search")]:
            v = row[key]
            if v:
                out.append(f"| {p} | {label} | {v['num_queries']} | {v['frac_healthy']} | "
                           f"{v['mean_precision']} | {v.get('lenient_precision','—')} | "
                           f"{v['unique_papers']} |")

    out.append("")
    out.append("## Aggregate (4 profiles, abstract-aware)\n")
    out.append("| Variant | mean frac_healthy | mean precision (strict) | mean precision (lenient YES+PARTIAL) | mean unique papers |")
    out.append("|---|---:|---:|---:|---:|")
    for key, label in [("v8_rescored", "v8 (search)"),
                       ("v9_default_rescored", "v9 / search"),
                       ("v9_hybrid_rescored", "v9 hybrid (Gemini Pro on step 4)"),
                       ("v91_rescored", "v9.1 (slot-filled, no serendipity)"),
                       ("v9_tiab_rescored", "v9 / tiab.search")]:
        fh = [r[key]["frac_healthy"] for r in rows if r[key]]
        mp = [r[key]["mean_precision"] for r in rows if r[key]]
        lenient = [r[key].get("lenient_precision") for r in rows if r[key]]
        up = [r[key]["unique_papers"] for r in rows if r[key]]
        out.append(f"| {label} | {_avg(fh)} | {_avg(mp)} | {_avg(lenient)} | {_avg(up)} |")

    out.append("")
    out.append("## Cost & latency\n")
    out.append("| Profile | v8 (avg 2-3 runs) | v9 / search (DeepSeek) | v9 hybrid (Gemini Pro on step 4) |")
    out.append("|---|---:|---:|---:|")
    for row in rows:
        p = row["profile"]
        v8l = row["v8_legacy_avg"] or {}
        v9d = row["v9_discovery"] or {}
        v9h = row["v9_hybrid_discovery"] or {}
        out.append(
            f"| {p} | "
            f"${v8l.get('plan_cost','—')} | "
            f"${v9d.get('total_cost_usd','—')} ({v9d.get('total_latency_s','—')}s) | "
            f"${v9h.get('total_cost_usd','—')} ({v9h.get('total_latency_s','—')}s) |"
        )

    out.append("")
    out.append("## Band distribution (queries per band, abstract-aware)\n")
    out.append("| Profile | Variant | zero | low | healthy | recall_safety | too_broad |")
    out.append("|---|---|---:|---:|---:|---:|---:|")
    for row in rows:
        p = row["profile"]
        for key, label in [("v8_rescored", "v8 (search)"),
                           ("v9_default_rescored", "v9 / search"),
                           ("v9_hybrid_rescored", "v9 hybrid"),
                           ("v9_tiab_rescored", "v9 / tiab.search")]:
            v = row[key]
            if v:
                b = v["bands"]
                out.append(f"| {p} | {label} | {b.get('zero',0)} | {b.get('low',0)} | "
                           f"{b.get('healthy',0)} | {b.get('recall_safety',0)} | {b.get('too_broad',0)} |")

    out.append("")
    out.append("## v9 discovery internals\n")
    out.append("| Profile | Variant | Seeds | Vocab papers | Library queries | Validation (zero/low/good/broad+too) | Reformulated? |")
    out.append("|---|---|---:|---:|---:|---|:-:|")
    for row in rows:
        p = row["profile"]
        for key, label in [("v9_discovery", "v9 (DeepSeek)"),
                           ("v9_hybrid_discovery", "v9 hybrid (Gemini Pro)")]:
            d = row[key]
            if d:
                v = d["validation_buckets"]
                v_str = f"{v.get('zero',0)}/{v.get('low',0)}/{v.get('good',0)}/{v.get('broad',0)+v.get('too_broad',0)}"
                out.append(f"| {p} | {label} | {d['seed_count']} | {d['vocab_papers']} | {d['library_size']} | "
                           f"{v_str} | {'yes' if d['reformulated'] else 'no'} |")

    out.append("")
    out.append("---\n")
    out.append("## Appendix: title-only judge (legacy)\n")
    out.append("Original numbers, with judge seeing only the title. **Lower confidence** — titles "
               "are vague, especially for clinical work — but useful for tracking the size of the "
               "scoring-method effect.\n")
    out.append("")
    out.append("| Profile | Variant | frac_healthy | mean_precision (title-only) | mean_precision (abstract) | Δ |")
    out.append("|---|---|---:|---:|---:|---:|")
    for row in rows:
        p = row["profile"]
        # v8 legacy average vs v8 rescored
        v8l = row["v8_legacy_avg"]
        v8r = row["v8_rescored"]
        if v8l and v8r:
            delta = round(v8r["mean_precision"] - v8l["mean_precision"], 3)
            out.append(f"| {p} | v8 (avg of {v8l['n_runs']}) | {v8l['frac_healthy']} | "
                       f"{v8l['mean_precision']} | {v8r['mean_precision']} | {delta:+} |")
        for legacy_key, rescored_key, label in [
            ("v9_default_legacy", "v9_default_rescored", "v9 / search"),
            ("v9_tiab_legacy", "v9_tiab_rescored", "v9 / tiab.search"),
        ]:
            l = row[legacy_key]
            r = row[rescored_key]
            if l and r:
                delta = round(r["mean_precision"] - l["mean_precision"], 3)
                out.append(f"| {p} | {label} | {r['frac_healthy']} | {l['mean_precision']} | "
                           f"{r['mean_precision']} | {delta:+} |")

    out.append("")
    out.append("## Notes\n")
    out.append("- `frac_healthy` is deterministic (OpenAlex result counts); it doesn't change "
               "between scoring methods.")
    out.append("- `unique_papers` counts distinct OpenAlex IDs across the top-5 hits returned per "
               "query (after dedup). Union of small samples, not the full match set.")
    out.append("- Abstract-aware judge: title (≤300 chars) + first 500 chars of abstract. Single "
               "DeepSeek call per profile, temperature 0.")
    out.append("- v8 plan cost is per single LLM call. v9 cost includes seed + library + reformulate "
               "(when triggered) but excludes per-query OpenAlex calls (free) and the scoring "
               "DeepSeek call (incurred by both).")

    report = "\n".join(out) + "\n"
    out_path = V9_DIR / "COMPARISON.md"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(report)
    print(f"wrote {out_path}")
    print()
    print(report)


if __name__ == "__main__":
    main()
