---
status: partial
phase: 76-video-schema-storage-paths-server-action
source: [76-VERIFICATION.md]
started: 2026-06-22T00:00:00Z
updated: 2026-06-22T00:00:00Z
---

## Current Test

[awaiting human action — operator post-deploy steps after PR merge to main]

## Tests

### 1. Apply Phase 76 migration to prod via `supabase db push --linked`
expected: `supabase migration list --linked` shows `20260622000000_phase76_video_schema` as Applied on both Local and Remote columns; prod `\d wear_events` shows the 3 new columns + `wear_events_video_paths_required` CHECK; prod `SELECT allowed_mime_types FROM storage.buckets WHERE id = 'wear-photos';` includes `video/mp4`
result: [pending]
runbook: `.planning/phases/76-video-schema-storage-paths-server-action/76-POST-DEPLOY.md` §3-§4

### 2. Manual RLS cross-user `.mp4` SELECT check
expected: Uploading an `.mp4` as user A and attempting to fetch a signed URL as user B returns 403 — confirms `wear_photos_select_three_tier` policy works for `.mp4` filenames as predicted by `split_part(storage.filename(name), '.', 1)` analysis (RESEARCH §Open Questions #5)
result: [pending]
runbook: `.planning/phases/76-video-schema-storage-paths-server-action/76-POST-DEPLOY.md` §5

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
