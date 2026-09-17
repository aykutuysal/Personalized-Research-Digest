"""For each profile, write a markdown file with three clean tables (one per variant) listing
unique papers (deduped by OpenAlex ID) with title, abstract summary, and LLM judgement label."""
import json
import re
from pathlib import Path

V8 = Path("runs/v8_rescored")
V9 = Path("runs/v9_keyword_discovery")
V9_HYBRID = Path("runs/v9_hybrid")
OUT = Path("runs/v9_keyword_discovery/unique_papers")
OUT.mkdir(parents=True, exist_ok=True)

PROFILES = ["llm_agents", "marketing", "afib", "adolescent_depression"]

ABSTRACT_CHARS = 280


def collect_unique(scorecard_path):
    """Returns dict: openalex_id → {title, abstract, best_label}."""
    if not scorecard_path.exists():
        return {}
    d = json.loads(scorecard_path.read_text())
    label_rank = {"YES": 0, "PARTIAL": 1, "NO": 2, "?": 3}
    by_id = {}
    for qr in d["query_results"]:
        labels = qr.get("hit_labels", [])
        for j, h in enumerate(qr.get("hits", [])):
            oid = h.get("id") or ""
            if not oid:
                continue
            label = labels[j] if j < len(labels) else "?"
            entry = by_id.get(oid)
            if entry is None:
                by_id[oid] = {
                    "title": h.get("title", "") or "",
                    "abstract": h.get("abstract", "") or "",
                    "best_label": label,
                }
            else:
                # Promote to the best label across all queries that surfaced this paper.
                if label_rank.get(label, 3) < label_rank.get(entry["best_label"], 3):
                    entry["best_label"] = label
    return by_id


def clean_for_table(text, max_chars):
    text = re.sub(r"\s+", " ", text or "").strip()
    text = text.replace("|", "\\|")  # avoid breaking markdown table columns
    if len(text) > max_chars:
        text = text[:max_chars].rsplit(" ", 1)[0] + "…"
    return text or "—"


def render_table(by_id, variant_label):
    out = [f"## {variant_label}", ""]
    if not by_id:
        out.append("(no data)")
        out.append("")
        return out
    out.append(f"**{len(by_id)} unique papers** (sorted YES → PARTIAL → NO).")
    out.append("")
    label_rank = {"YES": 0, "PARTIAL": 1, "NO": 2, "?": 3}
    rows = sorted(
        by_id.items(),
        key=lambda kv: (label_rank.get(kv[1]["best_label"], 3), kv[1]["title"].lower()),
    )
    out.append("| # | Judge | Title | Abstract |")
    out.append("|---:|:---:|---|---|")
    for i, (oid, entry) in enumerate(rows, start=1):
        title = clean_for_table(entry["title"], 140)
        abstract = clean_for_table(entry["abstract"], ABSTRACT_CHARS)
        out.append(f"| {i} | {entry['best_label']} | {title} | {abstract} |")
    out.append("")
    return out


for profile in PROFILES:
    parts = [f"# Unique papers — {profile}", ""]
    parts.append("Each table = one variant. Papers are the deduped set across the top-5 OpenAlex hits "
                 "of every query in the variant's plan. Same scoring window for all three "
                 "(2026-04-06 → 2026-04-13). LLM judge = DeepSeek v3.2 reading title + 500 chars of abstract.")
    parts.append("")
    parts += render_table(
        collect_unique(V8 / f"{profile}.rescored.json"),
        "v8 — boolean queries, default `search` filter",
    )
    parts += render_table(
        collect_unique(V9 / f"{profile}.rescored.json"),
        "v9 / search — vocab-grounded short queries, default `search` filter",
    )
    parts += render_table(
        collect_unique(V9 / f"{profile}_v91.rescored.json"),
        "v9.1 — REQUIRED_ANGLES + fill-missing + no serendipity (DeepSeek)",
    )
    parts += render_table(
        collect_unique(V9_HYBRID / f"{profile}.rescored.json"),
        "v9 hybrid — Gemini 3.1 Pro on the library-build step (DeepSeek elsewhere), default `search` filter",
    )
    parts += render_table(
        collect_unique(V9 / f"{profile}.rescored.tiab.json"),
        "v9 / tiab.search — same v9 queries, `title_and_abstract.search` filter",
    )
    out_path = OUT / f"{profile}.md"
    out_path.write_text("\n".join(parts) + "\n")
    counts = []
    for label, path in [
        ("v8", V8 / f"{profile}.rescored.json"),
        ("v9/s", V9 / f"{profile}.rescored.json"),
        ("v9.1", V9 / f"{profile}_v91.rescored.json"),
        ("v9/h", V9_HYBRID / f"{profile}.rescored.json"),
        ("v9/t", V9 / f"{profile}.rescored.tiab.json"),
    ]:
        counts.append(f"{label}={len(collect_unique(path))}")
    print(f"wrote {out_path}  ({'  '.join(counts)})")
