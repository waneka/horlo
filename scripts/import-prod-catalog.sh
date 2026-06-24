#!/usr/bin/env bash
# Import the watches_catalog table from prod into the local Supabase DB.
#
# Why this exists: the local catalog drifts behind prod because seed data
# is incomplete and `/api/extract-watch` calls only happen against prod
# users. Running this after a `supabase db reset` (which clears the
# catalog) gets you back to a richer catalog for local dev.
#
# Behavior: silently skips rows whose natural key (brand_normalized,
# model_normalized, reference_normalized) already exists locally. Local-only
# rows are preserved.
#
# Pre-reqs: pg_dump on PATH; `.env.local` has DATABASE_URL pointing at prod;
# local supabase running (docker container `supabase_db_horlo`).

set -eu

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DUMP_FILE="/tmp/prod_catalog_$$.sql"
trap 'rm -f "$DUMP_FILE"' EXIT

if [ ! -f "${REPO_ROOT}/.env.local" ]; then
  echo "ERROR: .env.local not found at ${REPO_ROOT}/.env.local" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; . "${REPO_ROOT}/.env.local"; set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set after sourcing .env.local" >&2
  exit 1
fi

# Quick sanity: confirm DATABASE_URL points at prod, not local. If you
# accidentally run this with a local DATABASE_URL it's a no-op (local
# pumping itself into local) but still annoying. Fail loud.
case "$DATABASE_URL" in
  *127.0.0.1*|*localhost*)
    echo "ERROR: DATABASE_URL points at local — this script imports FROM prod." >&2
    exit 1 ;;
esac

if ! docker ps --filter "name=supabase_db_horlo" --format "{{.Names}}" | grep -q .; then
  echo "ERROR: supabase_db_horlo container is not running. Start it with 'supabase start'." >&2
  exit 1
fi

echo "==> Dumping prod watches_catalog ..."
pg_dump "$DATABASE_URL" \
  --data-only \
  --table=public.watches_catalog \
  --column-inserts \
  --no-owner \
  --no-acl > "$DUMP_FILE"

# Strip transaction wrappers + SET/SELECT_pg_catalog/trigger-toggle lines
# so each INSERT is its own statement (ON_ERROR_STOP=0 then lets us skip
# the rare row-level failure without aborting the whole load).
sed -E -i '' \
  '/^(BEGIN|COMMIT|SET |SELECT pg_catalog\.set_config|ALTER TABLE.*DISABLE TRIGGER|ALTER TABLE.*ENABLE TRIGGER|--)/d; /^$/d' \
  "$DUMP_FILE"

# Append ON CONFLICT to skip rows that violate the natural-key unique
# constraint (the common case — same brand/model/reference, different id).
sed -i '' 's/);$/) ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO NOTHING;/' "$DUMP_FILE"

echo "==> Loading into local (ON_ERROR_STOP=0) ..."
docker exec -i supabase_db_horlo psql -U postgres -d postgres -v ON_ERROR_STOP=0 < "$DUMP_FILE" > /dev/null

echo "==> Local catalog row count:"
docker exec supabase_db_horlo psql -U postgres -d postgres -c \
  "SELECT COUNT(*) AS catalog_rows FROM watches_catalog;"

echo "==> Done."
