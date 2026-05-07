#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
AUDIT="$DIR/../33-DISCOVERY-AUDIT.md"

# Run quick.sh first (file exists, headings, ordering, 8-col header)
bash "$DIR/quick.sh"

# Rule 1: every D-05 surface block has ≥1 row in the surface column
# 13 enumerable surface blocks per D-05 (see 33-01-PLAN.md Task 2 read_first note re: "15 blocks" authoring artifact):
# Header + 12 routes. followers/following are click TARGETS per D-05's inline note, not separate blocks.
SURFACES=("Header" "/" "/explore" "/search" "/catalog/{catalogId}" "/watch/{id}" "/u/{user}/collection" "/u/{user}/wishlist" "/u/{user}/worn" "/u/{user}/notes" "/u/{user}/stats" "/u/{user}/common-ground" "/u/{user}/insights")
MISSING_SURFACES=()
for s in "${SURFACES[@]}"; do
  # Match the surface name appearing as the second column ("| <surface> |") in any DISC-AUDIT row.
  if ! grep -E "^\| DISC-AUDIT-[0-9]+ \| ${s//\//\\/} \|" "$AUDIT" >/dev/null 2>&1; then
    # Also tolerate trailing whitespace or escaped chars; fall back to a looser substring match in row lines.
    if ! awk -F'\\|' -v s="$s" '/^\| DISC-AUDIT-/ { gsub(/^ | $/, "", $3); if ($3 == s) found=1 } END { exit !found }' "$AUDIT"; then
      MISSING_SURFACES+=("$s")
    fi
  fi
done
if [ "${#MISSING_SURFACES[@]}" -gt 0 ]; then
  echo "[fail] D-13 rule 1: surfaces missing rows: ${MISSING_SURFACES[*]}" >&2
  exit 1
fi
echo "[ok] D-13 rule 1: every D-05 surface has ≥1 row"

# Rule 2: every Dead row has file:line or prod: in evidence column (col 7)
DEAD_BAD=$(awk -F'\\|' '/^\| DISC-AUDIT-/ {
  tag=$6; gsub(/^ | $/, "", tag);
  ev=$7; gsub(/^ | $/, "", ev);
  if (tag == "Dead" && ev !~ /(:[0-9]+|prod:)/) print $2
}' "$AUDIT" | tr -d ' ' || true)
test -z "$DEAD_BAD" || { echo "[fail] D-13 rule 2: Dead rows missing reproduction evidence: $DEAD_BAD" >&2; exit 1; }
echo "[ok] D-13 rule 2: all Dead rows cite file:line or prod:URL"

# Rule 3: every Missing row cites Rdio or SEED-004 in evidence column
MISSING_BAD=$(awk -F'\\|' '/^\| DISC-AUDIT-/ {
  tag=$6; gsub(/^ | $/, "", tag);
  ev=$7; gsub(/^ | $/, "", ev);
  if (tag == "Missing" && ev !~ /(Rdio|SEED-004)/) print $2
}' "$AUDIT" | tr -d ' ' || true)
test -z "$MISSING_BAD" || { echo "[fail] D-13 rule 3: Missing rows lack Rdio/SEED-004 citation: $MISSING_BAD" >&2; exit 1; }
echo "[ok] D-13 rule 3: all Missing rows cite SEED-004 Rdio principle"

# Rule 4: every Redundant row cites a target DISC-AUDIT-NN that exists in the table
REDUNDANT_LINES=$(awk -F'\\|' '/^\| DISC-AUDIT-/ {
  tag=$6; gsub(/^ | $/, "", tag);
  ev=$7; gsub(/^ | $/, "", ev);
  if (tag == "Redundant") {
    if (match(ev, /DISC-AUDIT-[0-9]+/)) {
      cited=substr(ev, RSTART, RLENGTH);
      rid=$2; gsub(/^ | $/, "", rid);
      print rid ":" cited
    } else {
      rid=$2; gsub(/^ | $/, "", rid);
      print rid ":NONE"
    }
  }
}' "$AUDIT" || true)
while IFS=: read -r rid cited; do
  [ -z "$rid" ] && continue
  if [ "$cited" = "NONE" ]; then
    echo "[fail] D-13 rule 4: Redundant row $rid has no cited DISC-AUDIT-NN" >&2; exit 1
  fi
  if ! grep -qE "^\| ${cited} \|" "$AUDIT"; then
    echo "[fail] D-13 rule 4: Redundant row $rid cites $cited which is not a row in the table" >&2; exit 1
  fi
done <<< "$REDUNDANT_LINES"
echo "[ok] D-13 rule 4: all Redundant rows cite an existing DISC-AUDIT-NN"

# Rule 5: 4 decision verdicts present, each YES|NO|DEFERRED, each with ≥1 cited DISC-AUDIT row that exists
VERDICTS=$(grep -c '^\*\*Verdict:\*\*' "$AUDIT" || true)
test "$VERDICTS" -eq 4 || { echo "[fail] D-13 rule 5a: expected 4 Verdict lines; found $VERDICTS" >&2; exit 1; }
BAD_VERDICTS=$(grep -E '^\*\*Verdict:\*\*' "$AUDIT" | grep -vE '\b(YES|NO|DEFERRED)\b' || true)
test -z "$BAD_VERDICTS" || { echo "[fail] D-13 rule 5b: verdict not in {YES,NO,DEFERRED}: $BAD_VERDICTS" >&2; exit 1; }
CITED_LINES=$(grep -c '^\*\*Cited rows:\*\*' "$AUDIT" || true)
test "$CITED_LINES" -eq 4 || { echo "[fail] D-13 rule 5c: expected 4 Cited rows lines; found $CITED_LINES" >&2; exit 1; }
# Confirm each Cited rows line references ≥1 existing DISC-AUDIT-NN
while IFS= read -r line; do
  ids=$(echo "$line" | grep -oE 'DISC-AUDIT-[0-9]+' || true)
  test -n "$ids" || { echo "[fail] D-13 rule 5d: a 'Cited rows' line lists no DISC-AUDIT-NN: $line" >&2; exit 1; }
  for id in $ids; do
    grep -qE "^\| ${id} \|" "$AUDIT" || { echo "[fail] D-13 rule 5e: cited $id is not a row in the table" >&2; exit 1; }
  done
done < <(grep '^\*\*Cited rows:\*\*' "$AUDIT")
echo "[ok] D-13 rule 5: 4 verdicts, all anchored to existing rows"

# Bonus rule (D-09): row IDs are flat sequential with no gaps and no duplicates
IDS=$(grep -oE '^\| DISC-AUDIT-[0-9]+' "$AUDIT" | sed 's/| DISC-AUDIT-//' | sort -n)
DUPES=$(echo "$IDS" | uniq -d || true)
test -z "$DUPES" || { echo "[fail] D-09: duplicate row IDs: $DUPES" >&2; exit 1; }
if [ -n "$IDS" ]; then
  FIRST=$(echo "$IDS" | head -1)
  LAST=$(echo "$IDS" | tail -1)
  COUNT=$(echo "$IDS" | wc -l | tr -d ' ')
  EXPECTED=$((LAST - FIRST + 1))
  test "$COUNT" -eq "$EXPECTED" || { echo "[fail] D-09: row IDs have gaps; first=$FIRST last=$LAST count=$COUNT expected=$EXPECTED" >&2; exit 1; }
fi
echo "[ok] D-09: row IDs are sequential, no duplicates, no gaps"

echo "[ok] full.sh: all D-13 5 rules + D-09 sequencing pass"
