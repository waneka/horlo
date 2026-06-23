---
status: partial
phase: 76-video-schema-storage-paths-server-action
source: [76-VERIFICATION.md]
started: 2026-06-22T00:00:00Z
updated: 2026-06-23T00:00:00Z
---

## Current Test

Test 2 (cross-user `.mp4` SELECT RLS check) — defer until Phase 77 ships and there's a real video to test with.

## Tests

### 1. Apply Phase 76 migration to prod via `supabase db push --linked`
expected: `supabase migration list --linked` shows `20260622000000_phase76_video_schema` as Applied on both Local and Remote columns; prod `\d wear_events` shows the 3 new columns + `wear_events_video_paths_required` CHECK; prod `SELECT allowed_mime_types FROM storage.buckets WHERE id = 'wear-photos';` includes `video/mp4`
result: passed (2026-06-23) — `supabase db push --linked` returned "Finished supabase db push" cleanly; the post-flight `RAISE EXCEPTION` did NOT fire (would have aborted the BEGIN/COMMIT transaction otherwise); `supabase migration list --linked` confirms `20260622000000` Applied on both Local and Remote columns. Schema-level verification deferred (would require direct prod psql / dashboard access) but the transactional success + post-flight assertion green is the authoritative signal — the migration only commits when all 5 sections (enum, 3 columns, CHECK, bucket MIME, post-flight) succeed atomically.
runbook: `.planning/phases/76-video-schema-storage-paths-server-action/76-POST-DEPLOY.md` §3-§4

### 2. Manual RLS cross-user `.mp4` SELECT check
expected: Uploading an `.mp4` as user A and attempting to fetch a signed URL as user B returns 403 — confirms `wear_photos_select_three_tier` policy works for `.mp4` filenames as predicted by `split_part(storage.filename(name), '.', 1)` analysis (RESEARCH §Open Questions #5)
result: pending (Phase 77 dependency — needs the WYWT Video capture UI to produce a real `.mp4` to test with; defer until Phase 77 ships)
runbook: `.planning/phases/76-video-schema-storage-paths-server-action/76-POST-DEPLOY.md` §5

## Summary

total: 2
passed: 1
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
