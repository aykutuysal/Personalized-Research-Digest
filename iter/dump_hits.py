"""Dump per-variant per-query top hits for human review."""
import json, sys
from pathlib import Path

V8 = Path("runs/v8_rescored")
V9 = Path("runs/v9_keyword_discovery")

def dump(profile, label, path):
    if not path.exists():
        print(f"  [{label}] MISSING {path}")
        return
    d = json.loads(path.read_text())
    print(f"\n========== {profile} :: {label} ==========")
    print(f"  filter={d.get('openalex_filter','?')}  frac_healthy={d['frac_healthy']}  "
          f"mean_precision={d['mean_precision']}")
    for qr in d["query_results"]:
        cnt = qr["openalex_count"]
        band = qr["breadth_band"]
        prec = qr.get("precision")
        print(f"\n  Q{qr['id']:2d} [{qr.get('angle','?'):20.20}] "
              f"count={cnt:6d} band={band:14s} prec={prec}")
        print(f"      query: {qr['query']}")
        for j, (h, lab) in enumerate(zip(qr["hits"], qr.get("hit_labels", [])), 1):
            title = (h.get("title","") or "")[:130]
            absr = (h.get("abstract","") or "")[:160]
            print(f"      [{lab:7s}] {title}")
            if absr:
                print(f"               {absr}...")

profile = sys.argv[1]
v8_path = V8 / f"{profile}.rescored.json"
v9d_path = V9 / f"{profile}.rescored.json"
v9t_path = V9 / f"{profile}.rescored.tiab.json"
dump(profile, "v8 (search)", v8_path)
dump(profile, "v9 / search", v9d_path)
dump(profile, "v9 / tiab.search", v9t_path)
