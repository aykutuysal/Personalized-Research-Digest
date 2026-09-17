"""Side-by-side comparison: v9.0 (no slot constraint, with serendipity) vs v9.1 (slot-filled,
no serendipity, fill-missing pass) on the ai_agents_v2 profile."""
import json
from collections import Counter
from pathlib import Path

V9_0 = Path("runs/v9_keyword_discovery/ai_agents_v2.rescored.json")
V9_1 = Path("runs/v9_keyword_discovery/ai_agents_v2_v91.rescored.json")
ART_0 = Path("runs/v9_keyword_discovery/ai_agents_v2.json")
ART_1 = Path("runs/v9_keyword_discovery/ai_agents_v2_v91.json")


def label_breakdown(scorecard):
    c = Counter()
    for qr in scorecard["query_results"]:
        c.update(qr["hit_labels"])
    return c


def unique_papers(scorecard):
    return len({h["id"] for qr in scorecard["query_results"] for h in qr["hits"] if h.get("id")})


def headline(scorecard):
    return {
        "queries": scorecard["num_queries"],
        "frac_healthy": scorecard["frac_healthy"],
        "mean_precision": scorecard["mean_precision"],
        "bands": scorecard["bands"],
        "unique_papers": unique_papers(scorecard),
        "labels": label_breakdown(scorecard),
    }


def angles_covered(plan_path, n_angles=10):
    if not plan_path.exists():
        return None
    plan = json.loads(plan_path.read_text())
    if "library" in plan:
        qs = plan["library"]["queries"]
        covered = {q.get("angle_id") for q in qs if q.get("angle_id")}
    else:
        return None
    return sorted(covered - {None}), {i: 0 for i in range(1, n_angles + 1)}, n_angles


def queries_per_angle(plan_path, n_angles=10):
    plan = json.loads(plan_path.read_text())
    qs = plan["library"]["queries"]
    out = {i: 0 for i in range(1, n_angles + 1)}
    out["unassigned"] = 0
    for q in qs:
        aid = q.get("angle_id")
        if aid and aid in out:
            out[aid] += 1
        else:
            out["unassigned"] += 1
    return out


print("# v9.0 vs v9.1 — ai_agents_v2 profile\n")

for label, score_path, art_path in [
    ("v9.0 (no slot constraint, serendipity allowed)", V9_0, ART_0),
    ("v9.1 (REQUIRED_ANGLES + fill-missing + no serendipity)", V9_1, ART_1),
]:
    print(f"## {label}\n")
    art = json.loads(art_path.read_text())
    h = headline(json.loads(score_path.read_text()))
    print(f"- Queries: **{h['queries']}** "
          f"(library cost ${art['costs'].get('library_usd', 0):.4f}, "
          f"fill-missing ${art['costs'].get('fill_missing_usd', 0):.4f}, "
          f"reformulate ${art['costs'].get('reformulate_usd', 0):.4f}, "
          f"total ${art['costs']['total_usd']:.4f})")
    print(f"- frac_healthy: **{h['frac_healthy']}**, mean_precision: **{h['mean_precision']}**")
    print(f"- Unique papers (top-10/q deduped): **{h['unique_papers']}**")
    print(f"- Bands: {h['bands']}")
    print(f"- Labels: YES {h['labels']['YES']}, PARTIAL {h['labels']['PARTIAL']}, NO {h['labels']['NO']}")
    qpa = queries_per_angle(art_path)
    covered = sum(1 for k, v in qpa.items() if isinstance(k, int) and v > 0)
    print(f"- Angle coverage: {covered}/10 angles got ≥1 dedicated query.  per-angle: {qpa}")
    print()
