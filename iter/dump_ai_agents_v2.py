"""Standalone unique-papers table for ai_agents_v2 (v9 / DeepSeek / abstract-aware judge)."""
import json, re
from pathlib import Path

SRC = Path("runs/v9_keyword_discovery/ai_agents_v2.rescored.json")
OUT = Path("runs/v9_keyword_discovery/unique_papers/ai_agents_v2.md")
OUT.parent.mkdir(parents=True, exist_ok=True)

ABSTRACT_CHARS = 280
LABEL_RANK = {"YES": 0, "PARTIAL": 1, "NO": 2, "?": 3}


def clean(text, max_chars):
    text = re.sub(r"\s+", " ", text or "").strip().replace("|", "\\|")
    if len(text) > max_chars:
        text = text[:max_chars].rsplit(" ", 1)[0] + "…"
    return text or "—"


d = json.loads(SRC.read_text())
unique = {}
for qr in d["query_results"]:
    labels = qr.get("hit_labels", [])
    for j, h in enumerate(qr.get("hits", [])):
        oid = h.get("id")
        if not oid:
            continue
        label = labels[j] if j < len(labels) else "?"
        e = unique.setdefault(oid, {"title": h.get("title",""), "abstract": h.get("abstract",""),
                                    "best": label, "queries": []})
        if LABEL_RANK.get(label, 3) < LABEL_RANK.get(e["best"], 3):
            e["best"] = label
        e["queries"].append({"qid": qr["id"], "query": qr["query"], "label": label,
                             "n": qr["openalex_count"], "band": qr["breadth_band"]})

errored = [qr for qr in d["query_results"] if qr["openalex_count"] < 0]
parts = [
    "# Unique papers — ai_agents_v2 (v9 DeepSeek pipeline, default `search` filter)",
    "",
    f"- **Subject:** AI agents",
    f"- **Date window:** {d['from_date']} → {d['to_date']}",
    f"- **Queries:** {d['num_queries']} ({len(errored)} OpenAlex timeouts)",
    f"- **frac_healthy:** {d['frac_healthy']}  ·  **mean_precision:** {d['mean_precision']}  (abstract-aware DeepSeek judge)",
    f"- **Unique papers (deduped, top-10/query):** {len(unique)}",
    "",
    "## Queries that ran",
    "",
    "| # | Status | n | Query | Dimension |",
    "|---:|:---:|---:|---|---|",
]
plan = json.loads(Path("runs/v9_keyword_discovery/ai_agents_v2.json.plan.json").read_text())
plan_by_id = {q["id"]: q for q in plan["queries"]}
for qr in d["query_results"]:
    pq = plan_by_id.get(qr["id"], {})
    parts.append(f"| {qr['id']} | {qr['breadth_band']} | {qr['openalex_count']} | "
                 f"`{qr['query']}` | {pq.get('angle','')} |")
parts += ["", "## Unique papers", ""]
parts.append(f"**{len(unique)} unique papers** (sorted YES → PARTIAL → NO).")
parts.append("")
parts.append("| # | Judge | Title | Abstract | Surfaced by |")
parts.append("|---:|:---:|---|---|---|")

rows = sorted(unique.items(), key=lambda kv: (LABEL_RANK.get(kv[1]["best"],3), kv[1]["title"].lower()))
for i, (oid, e) in enumerate(rows, start=1):
    title = clean(e["title"], 130)
    abstract = clean(e["abstract"], ABSTRACT_CHARS)
    surfaced = ", ".join(f"Q{q['qid']}" for q in e["queries"])
    parts.append(f"| {i} | {e['best']} | {title} | {abstract} | {surfaced} |")

OUT.write_text("\n".join(parts) + "\n")
print(f"wrote {OUT}  ({len(unique)} unique papers)")
