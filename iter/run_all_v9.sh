#!/usr/bin/env bash
# Driver for running v9 keyword-discovery + both scoring filters across 4 profiles.
# Runs sequentially; each profile is logged separately.
set -u  # don't exit on individual failures; we want to see all 4 results

PROFILES=(llm_agents marketing afib adolescent_depression)
OUT=runs/v9_keyword_discovery
LOG=$OUT/run_log.txt
mkdir -p "$OUT"
: > "$LOG"

t_start=$(date +%s)

for p in "${PROFILES[@]}"; do
    echo "=== $p === $(date)" | tee -a "$LOG"

    echo "  [discover]" | tee -a "$LOG"
    python3 run_v9_discovery.py \
        --profile "profiles/${p}.md" \
        --angles  "profiles/${p}.angles.json" \
        --out     "$OUT/${p}.json" >> "$LOG" 2>&1
    rc=$?
    echo "    rc=$rc" | tee -a "$LOG"
    if [ $rc -ne 0 ]; then continue; fi

    echo "  [score: default search]" | tee -a "$LOG"
    python3 score_plan.py \
        --plan-from-file "$OUT/${p}.json.plan.json" \
        --profile "profiles/${p}.md" \
        --out     "$OUT/${p}.scored.json" >> "$LOG" 2>&1
    echo "    rc=$?" | tee -a "$LOG"

    echo "  [score: title_and_abstract.search]" | tee -a "$LOG"
    python3 score_plan.py \
        --plan-from-file "$OUT/${p}.json.plan.json" \
        --profile "profiles/${p}.md" \
        --filter title_and_abstract.search \
        --out     "$OUT/${p}.scored.tiab.json" >> "$LOG" 2>&1
    echo "    rc=$?" | tee -a "$LOG"
done

t_end=$(date +%s)
echo "=== ALL DONE in $((t_end - t_start))s ===" | tee -a "$LOG"
