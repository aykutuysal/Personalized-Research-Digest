#!/usr/bin/env bash
# One-profile v9.2 runner (discover + score). Designed to be spawned in parallel.
set -u
p="$1"
OUT=runs/v9_keyword_discovery
LOG=$OUT/v92_${p}.log
: > "$LOG"

echo "=== $p === $(date)" >> "$LOG"
echo "[discover v9.2 --use-angle-seeds]" >> "$LOG"
python3 -u run_v9_discovery.py \
    --profile "profiles/${p}.md" \
    --angles  "profiles/${p}.angles.json" \
    --use-angle-seeds \
    --out     "$OUT/${p}_v92.json" >> "$LOG" 2>&1
rc=$?
echo "[discover rc=$rc]" >> "$LOG"
if [ $rc -ne 0 ]; then
    echo "DISCOVER FAILED: $p (rc=$rc)" >&2
    exit $rc
fi

echo "[score: parallel, abstract-aware]" >> "$LOG"
python3 -u score_plan.py \
    --plan-from-file "$OUT/${p}_v92.json.plan.json" \
    --profile "profiles/${p}.md" \
    --out     "$OUT/${p}_v92.rescored.json" >> "$LOG" 2>&1
echo "[score rc=$?] done $(date)" >> "$LOG"
