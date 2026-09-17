#!/usr/bin/env python3
"""Compute angle coverage for each plan: of the angles a profile cares about,
how many were reached by at least one YES/PARTIAL paper?

Steps:
  1. Hard-coded angle list per profile (extracted from the profile text).
  2. For each scorecard, collect unique YES+PARTIAL papers (id, title, label).
  3. One DeepSeek call per plan: classify which angles each paper covers.
  4. Aggregate: for each angle, count YES papers that hit it.
  5. Report:
       - angles_covered_yes: number of angles with >=1 YES paper
       - angles_covered_3:   number of angles with >=3 YES papers
       - dead_angles:        list of angles with zero YES papers
"""

import json
import os
import statistics
import sys
import time
import urllib.request
from glob import glob
from pathlib import Path


PROFILE_ANGLES = {
    "llm_agents": [
        "new agent architectures or frameworks",
        "planning, reasoning, or chain-of-thought techniques",
        "tool use and function calling",
        "memory systems and retrieval (RAG / long-term memory)",
        "multi-agent systems and orchestration",
        "evaluation, benchmarks, or agent capability tests",
        "production engineering patterns (deployment, observability, cost)",
        "safety, alignment, or guardrails for agents",
    ],
    "marketing": [
        "pricing strategy (charm pricing, price endings, perceived value)",
        "discounts and promotions and their effect on brand",
        "ad creative effectiveness and persuasion",
        "product naming, branding, packaging",
        "scarcity, urgency, social proof cues",
        "landing page or checkout conversion optimization",
        "consumer psychology / behavioral findings on purchasing",
        "loyalty, retention, repeat purchase behavior",
    ],
    "afib": [
        "rhythm control and antiarrhythmic drugs",
        "catheter ablation techniques and outcomes",
        "anticoagulation choices (DOACs, warfarin, bleeding risk)",
        "rate vs rhythm control comparisons",
        "left atrial appendage closure / occlusion",
        "stroke prevention strategies",
        "randomized clinical trials and guideline updates",
        "AFib screening, detection, monitoring (wearables, ECG)",
    ],
    "adolescent_depression": [
        "CBT and CBT variants for adolescent depression",
        "interpersonal psychotherapy (IPT-A)",
        "behavioral activation",
        "mindfulness and acceptance-based therapies",
        "family-based or attachment-based treatments",
        "digital, app-based, telehealth interventions",
        "psychopharmacology (SSRIs, combination therapy, safety)",
        "assessment tools and screening instruments",
        "suicide risk screening and prevention",
        "social media and adolescent mental health",
        "school-based prevention or intervention",
        "comorbid anxiety with depression",
    ],
}


def load_env():
    p = Path(".env.local")
    if p.exists():
        for line in p.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


CLASSIFIER_SYSTEM = """You are a classifier mapping academic paper titles to topical angles.

Given a list of angles (numbered) and a list of papers (numbered), output for each paper which angles it covers, if any. A paper can cover 0, 1, or multiple angles. Be strict — only include an angle if the title clearly indicates that topic.

Respond with ONLY a JSON object in this form:
{"papers": [{"i": 1, "angles": [2, 5]}, {"i": 2, "angles": []}, ...]}

No prose. No explanation. Just the JSON."""


def openrouter_chat(api_key, system, user, model="deepseek/deepseek-v3.2"):
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.0,
        "max_tokens": 4000,
    }
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode())


def parse_json(content):
    text = content.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        end = len(lines)
        for i in range(len(lines) - 1, 0, -1):
            if lines[i].strip() == "```":
                end = i
                break
        text = "\n".join(lines[1:end]).strip()
    return json.loads(text)


def collect_papers(scorecard):
    """Return [(id, title, best_label)] for unique papers in a plan."""
    rank = {"YES": 3, "PARTIAL": 2, "NO": 1, "?": 0}
    seen = {}
    for qr in scorecard["query_results"]:
        labels = qr.get("hit_labels", [])
        for h, lbl in zip(qr.get("hits", []), labels):
            pid = h.get("id") or h.get("title", "")[:80]
            if not pid:
                continue
            title = h.get("title", "")
            prev = seen.get(pid)
            if prev is None or rank.get(lbl, 0) > rank.get(prev[1], 0):
                seen[pid] = (title, lbl)
    return [(pid, t, l) for pid, (t, l) in seen.items()]


def classify_papers(api_key, profile, papers):
    """Returns {paper_idx: [angle_idx, ...]} (1-indexed)."""
    angles = PROFILE_ANGLES[profile]
    angle_lines = "\n".join(f"{i+1}. {a}" for i, a in enumerate(angles))
    paper_lines = "\n".join(f'{i+1}. "{t[:200]}"' for i, (_, t, _) in enumerate(papers))
    user = (
        f"ANGLES:\n{angle_lines}\n\nPAPERS:\n{paper_lines}\n\n"
        f"For each paper, list which angles it covers (use the numbers above). "
        f"If a paper covers no listed angle, use an empty list."
    )
    result = openrouter_chat(api_key, CLASSIFIER_SYSTEM, user)
    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
    parsed = parse_json(content)
    return {p["i"]: p.get("angles", []) for p in parsed.get("papers", [])}


def analyze_run(api_key, profile, scorecard_path):
    d = json.load(open(scorecard_path))
    papers = collect_papers(d)
    # Only classify YES + PARTIAL — NOs and ?s aren't useful for coverage
    relevant = [(pid, t, l) for pid, t, l in papers if l in ("YES", "PARTIAL")]
    if not relevant:
        return {
            "n_yes": 0,
            "n_partial": 0,
            "angle_yes_counts": [0] * len(PROFILE_ANGLES[profile]),
            "angle_yp_counts": [0] * len(PROFILE_ANGLES[profile]),
            "covered_yes": 0,
            "covered_yes3": 0,
            "covered_yp": 0,
            "dead_angles": list(PROFILE_ANGLES[profile]),
        }

    classifications = classify_papers(api_key, profile, relevant)

    n_angles = len(PROFILE_ANGLES[profile])
    yes_counts = [0] * n_angles
    yp_counts = [0] * n_angles
    n_yes = 0
    n_partial = 0
    for i, (_, _, label) in enumerate(relevant, start=1):
        angle_idxs = classifications.get(i, [])
        if label == "YES":
            n_yes += 1
        else:
            n_partial += 1
        for a in angle_idxs:
            if 1 <= a <= n_angles:
                if label == "YES":
                    yes_counts[a - 1] += 1
                yp_counts[a - 1] += 1

    covered_yes = sum(1 for c in yes_counts if c >= 1)
    covered_yes3 = sum(1 for c in yes_counts if c >= 3)
    covered_yp = sum(1 for c in yp_counts if c >= 1)
    dead = [PROFILE_ANGLES[profile][i] for i, c in enumerate(yes_counts) if c == 0]

    return {
        "n_yes": n_yes,
        "n_partial": n_partial,
        "angle_yes_counts": yes_counts,
        "angle_yp_counts": yp_counts,
        "covered_yes": covered_yes,
        "covered_yes3": covered_yes3,
        "covered_yp": covered_yp,
        "dead_angles": dead,
    }


def main():
    load_env()
    api_key = os.environ["OPENROUTER_API_KEY"]

    runs_glob = sys.argv[1] if len(sys.argv) > 1 else "iter/runs/v0_variance/*.json"
    files = sorted(glob(runs_glob))

    by_profile = {p: [] for p in PROFILE_ANGLES}
    for f in files:
        for prof in PROFILE_ANGLES:
            if f"_{prof}_" in f:
                by_profile[prof].append(f)
                break

    for prof, profile_files in by_profile.items():
        n_angles = len(PROFILE_ANGLES[prof])
        print(f"\n{'='*100}")
        print(f"  {prof} ({n_angles} angles)")
        print(f"{'='*100}")
        results = []
        for f in profile_files:
            print(f"  {Path(f).name} ...", end=" ", flush=True)
            try:
                r = analyze_run(api_key, prof, f)
                results.append(r)
                print(f"YES={r['n_yes']:2d}  covered≥1={r['covered_yes']}/{n_angles}  "
                      f"covered≥3={r['covered_yes3']}/{n_angles}  "
                      f"covered (yes+partial)={r['covered_yp']}/{n_angles}")
            except Exception as e:
                print(f"ERROR: {e}")
            time.sleep(0.4)

        if not results:
            continue

        # Aggregate per-angle YES counts across runs (max → did this angle ever get hit?)
        agg_yes = [0] * n_angles
        for r in results:
            for i, c in enumerate(r["angle_yes_counts"]):
                agg_yes[i] = max(agg_yes[i], c)

        print()
        cov1 = [r["covered_yes"] for r in results]
        cov3 = [r["covered_yes3"] for r in results]
        if len(results) > 1:
            print(f"  MEAN coverage ≥1 YES: {statistics.mean(cov1):.1f}/{n_angles}  (±{statistics.stdev(cov1):.1f})")
            print(f"  MEAN coverage ≥3 YES: {statistics.mean(cov3):.1f}/{n_angles}  (±{statistics.stdev(cov3):.1f})")

        print(f"\n  Per-angle YES coverage (best run across {len(results)} runs):")
        for i, a in enumerate(PROFILE_ANGLES[prof]):
            mark = "✓" if agg_yes[i] >= 3 else ("·" if agg_yes[i] >= 1 else "✗")
            print(f"    {mark} [{agg_yes[i]:2d}] {a}")


if __name__ == "__main__":
    main()
