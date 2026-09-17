#!/usr/bin/env python3
"""Re-score v8 baselines and v9 libraries using the title+abstract scorer.

Writes:
  runs/v8_rescored/<profile>.rescored.json
  runs/v9_keyword_discovery/<profile>.rescored.json          (default search)
  runs/v9_keyword_discovery/<profile>.rescored.tiab.json     (title_and_abstract.search)

For v8 we extract the plan from runs/deepseek_variance/<profile>_run1.json (the same plan all
v8 runs in deepseek_variance for that profile share the same prompt; we use run1 as canonical).
"""

import json
import subprocess
import sys
from pathlib import Path

PROFILES = [
    ("llm_agents", "llm_agents"),
    ("marketing", "marketing"),
    ("afib", "afib"),
    ("adolescent_depression", "adol_dep"),
]

ROOT = Path(__file__).parent
V8_DIR = ROOT / "runs" / "deepseek_variance"
V9_DIR = ROOT / "runs" / "v9_keyword_discovery"
V8_RES_DIR = ROOT / "runs" / "v8_rescored"
V8_RES_DIR.mkdir(parents=True, exist_ok=True)


def extract_v8_plan(profile_name, v8_stem):
    """Pull the plan out of run1 and write a standalone .plan.json file."""
    src = V8_DIR / f"{v8_stem}_run1.json"
    if not src.exists():
        return None
    data = json.loads(src.read_text())
    plan = data["plan"]
    # Some plans store {subject, queries: [...]} directly; some wrap further. Normalize.
    if "queries" not in plan:
        return None
    out_path = V8_RES_DIR / f"{profile_name}.plan.json"
    out_path.write_text(json.dumps(plan, indent=2))
    return out_path


def run_score(plan_path, profile_md, out_path, filter_mode="search"):
    cmd = [
        sys.executable, "score_plan.py",
        "--plan-from-file", str(plan_path),
        "--profile", str(profile_md),
        "--filter", filter_mode,
        "--out", str(out_path),
    ]
    print(f"  → {' '.join(cmd[1:])}")
    rc = subprocess.call(cmd)
    print(f"    rc={rc}")
    return rc


def main():
    for profile_name, v8_stem in PROFILES:
        profile_md = ROOT / "profiles" / f"{profile_name}.md"
        print(f"=== {profile_name} ===")

        # v8 — extract plan, score with default search filter (matches what v8 originally used)
        v8_plan = extract_v8_plan(profile_name, v8_stem)
        if v8_plan:
            run_score(v8_plan, profile_md,
                      V8_RES_DIR / f"{profile_name}.rescored.json", filter_mode="search")
        else:
            print(f"  (no v8 plan found for {profile_name})")

        # v9 default search
        v9_plan = V9_DIR / f"{profile_name}.json.plan.json"
        if v9_plan.exists():
            run_score(v9_plan, profile_md,
                      V9_DIR / f"{profile_name}.rescored.json", filter_mode="search")
            run_score(v9_plan, profile_md,
                      V9_DIR / f"{profile_name}.rescored.tiab.json",
                      filter_mode="title_and_abstract.search")
        else:
            print(f"  (no v9 plan found for {profile_name})")


if __name__ == "__main__":
    main()
