#!/usr/bin/env bash
# Hybrid v9 run: DeepSeek for seed + reformulate, Gemini 3.1 Pro Preview for library build.
# Scores once with the abstract-aware judge using the default search filter.
set -u

PROFILES=(llm_agents marketing afib adolescent_depression)
OUT=runs/v9_hybrid
LOG=$OUT/run_log.txt
mkdir -p "$OUT"
: > "$LOG"

LIB_MODEL="google/gemini-3.1-pro-preview"

t_start=$(date +%s)
for p in "${PROFILES[@]}"; do
    echo "=== $p === $(date)" | tee -a "$LOG"

    echo "  [discover w/ $LIB_MODEL on step 4]" | tee -a "$LOG"
    python3 run_v9_discovery.py \
        --profile "profiles/${p}.md" \
        --angles  "profiles/${p}.angles.json" \
        --library-model "$LIB_MODEL" \
        --out     "$OUT/${p}.json" >> "$LOG" 2>&1
    rc=$?
    echo "    rc=$rc" | tee -a "$LOG"
    if [ $rc -ne 0 ]; then continue; fi

    echo "  [score: default search, abstract-aware]" | tee -a "$LOG"
    python3 score_plan.py \
        --plan-from-file "$OUT/${p}.json.plan.json" \
        --profile "profiles/${p}.md" \
        --out     "$OUT/${p}.rescored.json" >> "$LOG" 2>&1
    echo "    rc=$?" | tee -a "$LOG"
done

t_end=$(date +%s)
echo "=== ALL DONE in $((t_end - t_start))s ===" | tee -a "$LOG"
