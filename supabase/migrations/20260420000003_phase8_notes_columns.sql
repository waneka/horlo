-- Phase 8: Per-note visibility (D-13)
-- Adds notes_public (default true) and notes_updated_at to watches.
-- Existing watches inherit notes_public = true via the column default.
-- No RLS changes needed: watches SELECT remains owner-only (Phase 6); cross-user
-- public-note reads are gated in the DAL via profile_settings.collection_public.

ALTER TABLE public.watches
  ADD COLUMN IF NOT EXISTS notes_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notes_updated_at timestamptz;

-- Backfill: ensure profile_settings row exists for every user.
-- Phase 7 trigger creates these for new users; this idempotent INSERT covers any
-- pre-Phase-7 users that may have been missed (Pitfall 8 in 08-RESEARCH.md, A2 risk).
INSERT INTO public.profile_settings (user_id)
SELECT u.id FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profile_settings ps WHERE ps.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;
