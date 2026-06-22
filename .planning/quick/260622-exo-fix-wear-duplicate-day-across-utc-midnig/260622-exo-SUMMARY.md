Fixed the wear-event duplicate-day false positive for non-UTC users near the UTC midnight boundary. Root cause: `markAsWorn` and `logWearWithPhoto` both called `todayLocalISO()` server-side on Vercel (UTC process zone), so a wear at 11:55 PM PT and the following night at 12:05 AM PT both serialized to the same UTC date and tripped `UNIQUE(user_id, watch_id, worn_date)`. Fix threads the client's local calendar day as an explicit `today: string` argument validated server-side with the same `/^\d{4}-\d{2}-\d{2}$/` regex already used by `preflightSchema`.

**Commits:**
- `25708a84` — Task 1: server-action schema + `wear.ts` doc comment (2 files, +38/−20)
- `edf204f6` — Task 2: 5 caller sites + integration test update (6 files, +37/−31)

**Files touched (8 total):**
- `src/app/actions/wearEvents.ts` — new `markAsWornSchema` (watchId + today), updated `logWearWithPhotoSchema` (+today field), both function signatures updated, `todayLocalISO()` import and server-side calls removed, WR-02 comments updated
- `src/lib/wear.ts` — `todayLocalISO()` doc comment extended with server-side-use WARNING paragraph referencing the 2026-06-22 incident
- `src/components/home/WatchPickerDialog.tsx` — added `todayLocalISO` import, compute + pass `today` in fallback `markAsWorn` path
- `src/components/wywt/ComposeStep.tsx` — added `todayLocalISO` import, compute + pass `today` to `logWearWithPhoto`
- `src/components/profile/LogTodaysWearButton.tsx` — added `todayLocalISO` import, compute + pass `today` in `handleConfirm`
- `src/components/watch/WatchDetail.tsx` — added `todayLocalISO` to existing `daysSince` import, compute + pass `today` in `handleMarkAsWorn`
- `src/components/watch/WatchDetailHero.tsx` — added `todayLocalISO` to existing `daysSince` import, compute + pass `today` in `handleMarkAsWorn`
- `tests/integration/phase15-wywt-photo-flow.test.ts` — Test 20 clock-stubbing block removed (`vi.useFakeTimers`/`setSystemTime`/`useRealTimers`); all 9 `logWearWithPhoto` call sites updated with `today:` field (`isoToday()` for happy-path tests, `date` for duplicate-day tests)

**UAT-3 verification:** Not yet verified on prod — user will push to Vercel and verify the UTC midnight boundary scenario manually. No blockers anticipated; `npm run build` exits 0.

**Surprises:** None. WywtPostDialog.tsx had no direct Server Action call (confirmed by grep — references were comment-only). The `vi` import in the test file already covered `vi.useFakeTimers` so no unused-import cleanup was needed after removing the clock-stubbing block.
