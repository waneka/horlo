#!/usr/bin/env bash
#
# Phase 51 — Profile route PPR opt-out: post-deploy contract verification.
#
# Usage:
#   bash scripts/verify-phase-51-prod.sh <BASE_URL>
#
# Example:
#   bash scripts/verify-phase-51-prod.sh https://www.horlo.app
#   bash scripts/verify-phase-51-prod.sh https://horlo-git-phase-51.vercel.app
#
# Env vars (optional):
#   PHASE51_TEST_USER   — username used in /u/<user>/<tab> probes (default: twwaneka)
#   PHASE51_TEST_TAB    — tab segment to probe (default: wishlist)
#   PHASE51_BRANCH_B    — opt-OUT for the Branch B re-gate check (REQ-51-07).
#                        Branch B is the deployed configuration (operator-
#                        confirmed in commit 2459a3d), so Check 3 runs by
#                        default. Set PHASE51_BRANCH_B=0 to suppress it (only
#                        appropriate for an emergency rollback to the
#                        legacy /u/* public-path configuration). WR-04
#                        (Phase 51 review) inverted the default in this
#                        script — older callers that set PHASE51_BRANCH_B=1
#                        explicitly still pass.
#
# Exit codes:
#   0  all checks passed
#   1  a check failed (regression contract — current main is expected to exit 1)
#   2  usage error (missing BASE_URL arg)
#
# Checks:
#   1. (REQ-51-01) State-tree-aware RSC body is non-empty
#   2. (REQ-51-02) Prefetch-headed RSC body is non-empty OR carries x-nextjs-postponed: 1
#   3. (REQ-51-07; Branch B only) Anon /u/<user>/collection returns 307 w/ Cache-Control: no-store

set -euo pipefail

if [ -z "${1:-}" ]; then
  printf 'usage: bash %s <BASE_URL>\n' "$0" >&2
  printf '  e.g.: bash %s https://www.horlo.app\n' "$0" >&2
  exit 2
fi

BASE_URL="$1"
TEST_USER="${PHASE51_TEST_USER:-twwaneka}"
TEST_TAB="${PHASE51_TEST_TAB:-wishlist}"
STATE_TREE='%5B%22%22%2C%7B%22children%22%3A%5B%22u%22%2C%7B%22children%22%3A%5B%5B%22username%22%2C%22twwaneka%22%2C%22d%22%5D%2C%7B%22children%22%3A%5B%5B%22tab%22%2C%22collection%22%2C%22d%22%5D%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%5D%7D%5D%7D%5D%7D%5D%7D%2Cnull%2Cnull%2Ctrue%5D'

# ---------------------------------------------------------------------------
# Check 1 (REQ-51-01) — state-tree-aware RSC body must be non-empty
# ---------------------------------------------------------------------------
CACHE_BUST_1="verify-$(date +%s)"
BYTES_STATE=$(curl -s "${BASE_URL}/u/${TEST_USER}/${TEST_TAB}?_rsc=${CACHE_BUST_1}" \
  -H 'RSC: 1' \
  -H "Next-Router-State-Tree: ${STATE_TREE}" \
  | wc -c | tr -d ' ')

if [ "${BYTES_STATE}" -lt 100 ]; then
  printf 'FAIL Check 1 (REQ-51-01): state-tree-aware RSC body is %s bytes (expected >=100)\n' "${BYTES_STATE}" >&2
  printf '  url=%s/u/%s/%s\n' "${BASE_URL}" "${TEST_USER}" "${TEST_TAB}" >&2
  exit 1
fi
printf 'PASS Check 1 (REQ-51-01): state-tree RSC body = %s bytes\n' "${BYTES_STATE}"

# ---------------------------------------------------------------------------
# Check 2 (REQ-51-02) — prefetch-headed RSC: non-empty body OR x-nextjs-postponed: 1
# ---------------------------------------------------------------------------
CACHE_BUST_2="verify-$(date +%s)"
PREFETCH_HEADERS_FILE=$(mktemp -t phase51-prefetch-headers.XXXXXX)
PREFETCH_BODY_FILE=$(mktemp -t phase51-prefetch-body.XXXXXX)
trap 'rm -f "${PREFETCH_HEADERS_FILE}" "${PREFETCH_BODY_FILE}"' EXIT

curl -sD "${PREFETCH_HEADERS_FILE}" \
  "${BASE_URL}/u/${TEST_USER}/${TEST_TAB}?_rsc=${CACHE_BUST_2}" \
  -H 'RSC: 1' \
  -H 'Next-Router-Prefetch: 1' \
  -o "${PREFETCH_BODY_FILE}"

PREFETCH_BYTES=$(wc -c < "${PREFETCH_BODY_FILE}" | tr -d ' ')
if grep -iq '^x-nextjs-postponed: 1' "${PREFETCH_HEADERS_FILE}"; then
  PREFETCH_POSTPONED=1
else
  PREFETCH_POSTPONED=0
fi

if [ "${PREFETCH_BYTES}" -lt 100 ] && [ "${PREFETCH_POSTPONED}" -eq 0 ]; then
  printf 'FAIL Check 2 (REQ-51-02): prefetch body=%s bytes AND no x-nextjs-postponed: 1 header\n' "${PREFETCH_BYTES}" >&2
  printf '  url=%s/u/%s/%s\n' "${BASE_URL}" "${TEST_USER}" "${TEST_TAB}" >&2
  printf '  headers:\n' >&2
  sed 's/^/    /' "${PREFETCH_HEADERS_FILE}" >&2
  exit 1
fi
printf 'PASS Check 2 (REQ-51-02): prefetch body=%s bytes; postponed=%s\n' "${PREFETCH_BYTES}" "${PREFETCH_POSTPONED}"

# ---------------------------------------------------------------------------
# Check 3 (REQ-51-07; Branch B — on by default) — anon to /u/<user>/collection
#   returns 307 + Cache-Control: no-store. WR-04 (Phase 51 review): Branch B
#   is the committed deployed path, so this check runs unless explicitly
#   opted out with PHASE51_BRANCH_B=0.
# ---------------------------------------------------------------------------
if [ "${PHASE51_BRANCH_B:-1}" != "0" ]; then
  ANON_HEADERS_FILE=$(mktemp -t phase51-anon-headers.XXXXXX)
  trap 'rm -f "${PREFETCH_HEADERS_FILE}" "${PREFETCH_BODY_FILE}" "${ANON_HEADERS_FILE}"' EXIT

  # --cookie-jar /dev/null + --cookie /dev/null forces an anonymous request:
  # no cookies sent, no cookies stored.
  ANON_STATUS=$(curl -s -o /dev/null \
    --cookie-jar /dev/null --cookie /dev/null \
    -w '%{http_code}' \
    -D "${ANON_HEADERS_FILE}" \
    "${BASE_URL}/u/${TEST_USER}/collection")

  if [ "${ANON_STATUS}" != "307" ]; then
    printf 'FAIL Check 3 (REQ-51-07): anon /u/%s/collection returned %s (expected 307)\n' "${TEST_USER}" "${ANON_STATUS}" >&2
    sed 's/^/    /' "${ANON_HEADERS_FILE}" >&2
    exit 1
  fi

  if ! grep -iq '^cache-control:.*no-store' "${ANON_HEADERS_FILE}"; then
    printf 'FAIL Check 3 (REQ-51-07): anon /u/%s/collection 307 missing Cache-Control: no-store\n' "${TEST_USER}" >&2
    printf '  (without no-store the 307 can be stored in the Router Cache — recurrence-2 vector)\n' >&2
    sed 's/^/    /' "${ANON_HEADERS_FILE}" >&2
    exit 1
  fi
  printf 'PASS Check 3 (REQ-51-07): anon 307 + Cache-Control: no-store\n'
fi

printf 'OK Phase 51 prod contract verified: %s\n' "${BASE_URL}"
exit 0
