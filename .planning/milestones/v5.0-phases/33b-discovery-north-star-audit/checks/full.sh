#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
AUDIT="$DIR/../33b-DISCOVERY-NORTH-STAR-AUDIT.md"
PHASE_33_AUDIT="$DIR/../../33-discovery-audit/33-DISCOVERY-AUDIT.md"

# Run quick.sh first (file exists, headings, ordering, 7-col header, vector defs, leverage key)
bash "$DIR/quick.sh"

# Sanity: Phase 33 audit must exist (Rule 3 ENHANCED + Rule 6 both depend on it)
test -f "$PHASE_33_AUDIT" || { echo "[fail] Phase 33 audit not found at $PHASE_33_AUDIT" >&2; exit 1; }

# NSD-15 rule 6 — T-33b-01 mitigation: Phase 33 audit immutability.
# Always run this rule, even in skeleton mode (the whole point is to catch any inadvertent edit).
DIFF=$(git diff -- "$PHASE_33_AUDIT" 2>/dev/null || true)
test -z "$DIFF" || { echo "[fail] NSD-15 rule 6: 33-DISCOVERY-AUDIT.md modified (immutability violation)" >&2; exit 1; }
echo "[ok] NSD-15 rule 6: 33-DISCOVERY-AUDIT.md unmodified"

# Skeleton-mode short-circuit: if `<!-- skeleton -->` present, rules 1-5 + NSD-14 sequencing are deferred to Wave 1.
if grep -qF '<!-- skeleton -->' "$AUDIT"; then
  echo "[ok] skeleton mode (Wave 0); NSD-15 rules 1-5 + NSD-14 sequencing deferred to Wave 1"
  echo "[ok] full.sh: skeleton mode pass (rule 6 enforced; rules 1-5 + NSD-14 deferred)"
  exit 0
fi

# NSD-15 rule 1 — exactly 42 NSV-NN rows (6 entities × 7 vectors)
ROWS=$(grep -c '^| NSV-' "$AUDIT" || true)
test "$ROWS" -eq 42 || { echo "[fail] NSD-15 rule 1: expected 42 NSV rows; found $ROWS" >&2; exit 1; }
echo "[ok] NSD-15 rule 1: 42 NSV-NN rows present"

# NSD-15 rule 2 — every missing/partial cell carries a leverage tag (high|med|low)
RULE2_BAD=$(awk -F'\\|' '/^\| NSV-/ {
  status=$5; gsub(/^ | $/, "", status);
  lev=$6;    gsub(/^ | $/, "", lev);
  if ((status == "missing" || status == "partial") && lev !~ /^(high|med|low)$/) {
    rid=$2; gsub(/^ | $/, "", rid);
    print rid
  }
}' "$AUDIT" | tr '\n' ' ' || true)
test -z "${RULE2_BAD// }" || { echo "[fail] NSD-15 rule 2: missing/partial rows lacking leverage tag: $RULE2_BAD" >&2; exit 1; }
echo "[ok] NSD-15 rule 2: every missing/partial row has leverage tag"

# NSD-15 rule 3 STANDARD — every missing/partial cell cites ≥1 DISC-AUDIT-NN OR an explicit em-dash (—) backing
RULE3_BAD=$(awk -F'\\|' '/^\| NSV-/ {
  status=$5; gsub(/^ | $/, "", status);
  back=$8;   gsub(/^ | $/, "", back);
  if ((status == "missing" || status == "partial") && back !~ /DISC-AUDIT-[0-9]+/ && back !~ /^—/) {
    rid=$2; gsub(/^ | $/, "", rid);
    print rid
  }
}' "$AUDIT" | tr '\n' ' ' || true)
test -z "${RULE3_BAD// }" || { echo "[fail] NSD-15 rule 3: missing/partial rows lacking DISC-AUDIT-NN backing or em-dash: $RULE3_BAD" >&2; exit 1; }
echo "[ok] NSD-15 rule 3: every missing/partial row cites DISC-AUDIT-NN or explicit em-dash"

# NSD-15 rule 3 ENHANCED — every distinct DISC-AUDIT-NN cited in 33b MUST exist as a row in Phase 33's table
CITED=$(grep -oE 'DISC-AUDIT-[0-9]+' "$AUDIT" | sort -u || true)
for id in $CITED; do
  grep -qE "^\| ${id} \|" "$PHASE_33_AUDIT" \
    || { echo "[fail] NSD-15 rule 3 ENHANCED: $id cited in 33b but not present in Phase 33 table" >&2; exit 1; }
done
echo "[ok] NSD-15 rule 3 ENHANCED: all cited DISC-AUDIT-NN exist in Phase 33"

# NSD-15 rule 4 — every missing row's rationale cites the SEED-004 line 15 Rdio quote violation explicitly
RULE4_BAD=$(awk -F'\\|' '/^\| NSV-/ {
  status=$5; gsub(/^ | $/, "", status);
  rat=$7;    gsub(/^ | $/, "", rat);
  if (status == "missing" && rat !~ /(Rdio violation:|SEED-004)/) {
    rid=$2; gsub(/^ | $/, "", rid);
    print rid
  }
}' "$AUDIT" | tr '\n' ' ' || true)
test -z "${RULE4_BAD// }" || { echo "[fail] NSD-15 rule 4: missing rows lack Rdio/SEED-004 rationale citation: $RULE4_BAD" >&2; exit 1; }
echo "[ok] NSD-15 rule 4: every missing row cites SEED-004 Rdio principle"

# NSD-15 rule 5a — exactly 4 Verdict lines
VERDICTS=$(grep -c '^\*\*Verdict:\*\*' "$AUDIT" || true)
test "$VERDICTS" -eq 4 || { echo "[fail] NSD-15 rule 5a: expected 4 Verdict lines; found $VERDICTS" >&2; exit 1; }
echo "[ok] NSD-15 rule 5a: 4 Verdict lines present"

# NSD-15 rule 5b — every Verdict in {YES,NO,DEFERRED}
BAD_VERDICTS=$(grep -E '^\*\*Verdict:\*\*' "$AUDIT" | grep -vE '\b(YES|NO|DEFERRED)\b' || true)
test -z "$BAD_VERDICTS" || { echo "[fail] NSD-15 rule 5b: verdict not in {YES,NO,DEFERRED}: $BAD_VERDICTS" >&2; exit 1; }
echo "[ok] NSD-15 rule 5b: all verdicts in {YES,NO,DEFERRED}"

# NSD-15 rule 5c — exactly 4 'Cited NSV rows:' lines
CITED_NSV=$(grep -c '^\*\*Cited NSV rows:\*\*' "$AUDIT" || true)
test "$CITED_NSV" -eq 4 || { echo "[fail] NSD-15 rule 5c: expected 4 'Cited NSV rows:' lines; found $CITED_NSV" >&2; exit 1; }
echo "[ok] NSD-15 rule 5c: 4 'Cited NSV rows:' lines present"

# NSD-15 rule 5d — exactly 4 'Backing DISC-AUDIT rows:' lines
BACKING=$(grep -c '^\*\*Backing DISC-AUDIT rows:\*\*' "$AUDIT" || true)
test "$BACKING" -eq 4 || { echo "[fail] NSD-15 rule 5d: expected 4 'Backing DISC-AUDIT rows:' lines; found $BACKING" >&2; exit 1; }
echo "[ok] NSD-15 rule 5d: 4 'Backing DISC-AUDIT rows:' lines present"

# NSD-15 rule 5e — exactly 4 'Drives:' lines
DRIVES=$(grep -c '^\*\*Drives:\*\*' "$AUDIT" || true)
test "$DRIVES" -eq 4 || { echo "[fail] NSD-15 rule 5e: expected 4 'Drives:' lines; found $DRIVES" >&2; exit 1; }
echo "[ok] NSD-15 rule 5e: 4 'Drives:' lines present"

# NSD-15 rule 5f — every 'Cited NSV rows:' lists ≥1 NSV-NN; every 'Backing DISC-AUDIT rows:' lists ≥1 DISC-AUDIT-NN
while IFS= read -r line; do
  ids=$(echo "$line" | grep -oE 'NSV-[0-9]+' || true)
  test -n "$ids" || { echo "[fail] NSD-15 rule 5f: a 'Cited NSV rows:' line lists no NSV-NN: $line" >&2; exit 1; }
done < <(grep '^\*\*Cited NSV rows:\*\*' "$AUDIT")
while IFS= read -r line; do
  ids=$(echo "$line" | grep -oE 'DISC-AUDIT-[0-9]+' || true)
  test -n "$ids" || { echo "[fail] NSD-15 rule 5f: a 'Backing DISC-AUDIT rows:' line lists no DISC-AUDIT-NN: $line" >&2; exit 1; }
  for id in $ids; do
    grep -qE "^\| ${id} \|" "$PHASE_33_AUDIT" \
      || { echo "[fail] NSD-15 rule 5f: cited $id is not a row in Phase 33 table" >&2; exit 1; }
  done
done < <(grep '^\*\*Backing DISC-AUDIT rows:\*\*' "$AUDIT")
echo "[ok] NSD-15 rule 5f: every Cited NSV / Backing DISC-AUDIT line lists ≥1 valid id"

# NSD-14 sequencing — NSV-NN ids flat sequential 1..42, no gaps, no dupes
IDS=$(grep -oE '^\| NSV-[0-9]+' "$AUDIT" | sed 's/| NSV-//' | sort -n)
DUPES=$(echo "$IDS" | uniq -d || true)
test -z "$DUPES" || { echo "[fail] NSD-14: duplicate NSV row IDs: $DUPES" >&2; exit 1; }
if [ -n "$IDS" ]; then
  FIRST=$(echo "$IDS" | head -1)
  LAST=$(echo "$IDS" | tail -1)
  COUNT=$(echo "$IDS" | wc -l | tr -d ' ')
  test "$FIRST" -eq 1 || { echo "[fail] NSD-14: first NSV id is $FIRST, expected 1" >&2; exit 1; }
  test "$LAST" -eq 42 || { echo "[fail] NSD-14: last NSV id is $LAST, expected 42" >&2; exit 1; }
  test "$COUNT" -eq 42 || { echo "[fail] NSD-14: NSV row count is $COUNT, expected 42" >&2; exit 1; }
  EXPECTED=$((LAST - FIRST + 1))
  test "$COUNT" -eq "$EXPECTED" || { echo "[fail] NSD-14: NSV row IDs have gaps; first=$FIRST last=$LAST count=$COUNT expected=$EXPECTED" >&2; exit 1; }
fi
echo "[ok] NSD-14: NSV-NN row IDs sequential 1..42, no duplicates, no gaps"

echo "[ok] full.sh: all NSD-15 rules 1-6 + NSD-14 + Rule 3 ENHANCED pass"
