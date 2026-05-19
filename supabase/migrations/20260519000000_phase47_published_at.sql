-- Phase 47 D-02: add published_at to curated_lists
-- Set on the first draft→published transition; drives rail freshness indicator and Hero rotation ordering.
ALTER TABLE public.curated_lists
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- D-03: backfill — existing published lists get published_at = created_at
-- so they show a sensible date rather than null on the rail freshness indicator.
-- Scoped with WHERE status = 'published' AND published_at IS NULL — idempotent,
-- touches no draft rows; re-running is a no-op (T-47-01 accept).
UPDATE public.curated_lists
SET published_at = created_at
WHERE status = 'published' AND published_at IS NULL;
