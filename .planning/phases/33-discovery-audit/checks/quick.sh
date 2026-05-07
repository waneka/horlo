#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
AUDIT="$DIR/../33-DISCOVERY-AUDIT.md"

# 1. file exists
test -f "$AUDIT" || { echo "[fail] $AUDIT not found" >&2; exit 1; }
echo "[ok] file exists: $AUDIT"

# 2. top-level headings present (Pass/Fail Criteria, Rdio Principle Anchor, Click-Path Audit, Decisions)
for h in "## Pass/Fail Criteria" "## Rdio Principle Anchor" "## Click-Path Audit" "## Decisions"; do
  grep -qF "$h" "$AUDIT" || { echo "[fail] missing heading: $h" >&2; exit 1; }
done
echo "[ok] required headings present"

# 3. Pass/Fail § appears BEFORE Click-Path Audit § (D-13: criteria pinned at TOP before findings)
PF_LINE=$(grep -n '^## Pass/Fail Criteria' "$AUDIT" | head -1 | cut -d: -f1)
CP_LINE=$(grep -n '^## Click-Path Audit' "$AUDIT" | head -1 | cut -d: -f1)
test -n "$PF_LINE" -a -n "$CP_LINE" -a "$PF_LINE" -lt "$CP_LINE" \
  || { echo "[fail] Pass/Fail Criteria § must precede Click-Path Audit §" >&2; exit 1; }
echo "[ok] Pass/Fail § precedes Click-Path Audit §"

# 4. table has 8-column header in D-10 order
HDR='| row_id | surface | element | target | tag | evidence | viewer_state | viewport |'
grep -qF "$HDR" "$AUDIT" || { echo "[fail] 8-column D-10 header row not found" >&2; exit 1; }
echo "[ok] D-10 8-column table header present"

# 5. table has ≥1 DISC-AUDIT row — UNLESS Wave 0 skeleton sentinel `<!-- skeleton -->` is present
# Wave 0 carve-out: when the H1-area sentinel `<!-- skeleton -->` is present, accept ROWS=0 (skeleton mode).
# Plan 02 Task 1 MUST remove this sentinel as part of its first row commit, after which ROWS>=1 is mandatory.
ROWS=$(grep -c '^| DISC-AUDIT-' "$AUDIT" || true)
if grep -qF '<!-- skeleton -->' "$AUDIT"; then
  # Skeleton mode (Wave 0) — accept zero rows
  echo "[ok] skeleton mode (Wave 0); 0 rows OK"
else
  if [ "$ROWS" -ge 1 ]; then
    echo "[ok] $ROWS DISC-AUDIT rows present"
  else
    echo "[fail] 33-DISCOVERY-AUDIT.md has no DISC-AUDIT rows but skeleton sentinel removed" >&2
    exit 1
  fi
fi

echo "[ok] quick.sh: all checks passed"
