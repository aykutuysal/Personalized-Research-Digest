#!/usr/bin/env bash
# v9.2 driver: v9.1 + angle-seeded step 1 (LLM seeds ∪ first-two-words-per-angle).
# DeepSeek for all 3 LLM steps. Abstract-aware scoring.
set -u

PROFILES=(llm_agents marketing afib adolescent_depression)
OUT=runs/v9_keyword_discovery
LOG=$OUT/v92_run_log.txt
mkdir -p "$OUT"
: > "$LOG"

t_start=$(date +%s)
for p in "${PROFILES[@]}"; do
    echo "=== $p === $(date)" | tee -a "$LOG"

    echo "  [discover v9.2 --use-angle-seeds]" | tee -a "$LOG"
    python3 -u run_v9_discovery.py \
        --profile "profiles/${p}.md" \
        --angles  "profiles/${p}.angles.json" \
        --use-angle-seeds \
        --out     "$OUT/${p}_v92.json" >> "$LOG" 2>&1
    rc=$?
    echo "    rc=$rc" | tee -a "$LOG"
    if [ $rc -ne 0 ]; then continue; fi

    echo "  [score: parallel, abstract-aware]" | tee -a "$LOG"
    python3 -u score_plan.py \
        --plan-from-file "$OUT/${p}_v92.json.plan.json" \
        --profile "profiles/${p}.md" \
        --out     "$OUT/${p}_v92.rescored.json" >> "$LOG" 2>&1
    echo "    rc=$?" | tee -a "$LOG"
done

t_end=$(date +%s)
echo "=== ALL DONE in $((t_end - t_start))s ===" | tee -a "$LOG"
