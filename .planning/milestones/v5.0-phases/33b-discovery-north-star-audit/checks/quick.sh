#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
AUDIT="$DIR/../33b-DISCOVERY-NORTH-STAR-AUDIT.md"

# 1. file exists
test -f "$AUDIT" || { echo "[fail] $AUDIT not found" >&2; exit 1; }
echo "[ok] file exists: $AUDIT"

# 2. top-level headings present (NSD-15 ordering: 6 required §s)
for h in "## Pass/Fail Criteria" "## Rdio Principle Anchor" "## Vector Definitions" "## Leverage Bucket Key" "## Drift-Vector Audit" "## Decisions"; do
  grep -qF "$h" "$AUDIT" || { echo "[fail] missing heading: $h" >&2; exit 1; }
done
echo "[ok] required headings present"

# 3. NSD-15 rule 1 ordering: Pass/Fail Criteria § appears BEFORE Drift-Vector Audit §
PF_LINE=$(grep -n '^## Pass/Fail Criteria' "$AUDIT" | head -1 | cut -d: -f1)
DV_LINE=$(grep -n '^## Drift-Vector Audit' "$AUDIT" | head -1 | cut -d: -f1)
test -n "$PF_LINE" -a -n "$DV_LINE" -a "$PF_LINE" -lt "$DV_LINE" \
  || { echo "[fail] NSD-15 rule 1 ordering: Pass/Fail Criteria § must precede Drift-Vector Audit §" >&2; exit 1; }
echo "[ok] NSD-15 rule 1 ordering: Pass/Fail Criteria § precedes Drift-Vector Audit §"

# 4. NSD-13 7-column header check
HDR='| row_id | entity | vector | status | leverage | rationale | backing_rows |'
grep -qF "$HDR" "$AUDIT" || { echo "[fail] NSD-13 7-column header not found" >&2; exit 1; }
echo "[ok] NSD-13 7-column header present"

# 5. NSD-08 vector definition table presence (sample two of the seven canonical vectors)
grep -qF '| similar-by-taste |' "$AUDIT" \
  && grep -qF '| see-more-like-this |' "$AUDIT" \
  || { echo "[fail] NSD-08 vector definitions table missing (similar-by-taste or see-more-like-this row not found)" >&2; exit 1; }
echo "[ok] NSD-08 vector definitions table present"

# 6. NSD-11 leverage bucket key presence (rough check — at least one bullet line listing all three)
grep -qE '\bhigh\b.*\bmed\b.*\blow\b' "$AUDIT" \
  || { echo "[fail] NSD-11 leverage bucket key missing (no line listing high/med/low together)" >&2; exit 1; }
echo "[ok] NSD-11 leverage bucket key present"

# 7. NSV-NN row count — skeleton sentinel carve-out (mirrors Phase 33 quick.sh pattern)
# Wave 0 carve-out: when `<!-- skeleton -->` is present, accept ROWS=0.
# Plan 02 Task 1 MUST remove this sentinel as part of its first row commit.
ROWS=$(grep -c '^| NSV-' "$AUDIT" || true)
if grep -qF '<!-- skeleton -->' "$AUDIT"; then
  echo "[ok] skeleton mode (Wave 0); 0 rows OK"
else
  if [ "$ROWS" -ge 1 ]; then
    echo "[ok] $ROWS NSV-NN rows present"
  else
    echo "[fail] no NSV rows but skeleton sentinel removed" >&2
    exit 1
  fi
fi

echo "[ok] quick.sh: all checks passed"
