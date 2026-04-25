---
phase: 16
slug: people-search
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 with React Testing Library 16.3.2 + jsdom 25.0.1 |
| **Config file** | `vitest.config.ts` (verified) |
| **Quick run command** | `npm run test -- tests/data/searchProfiles.test.ts` (per-file targeted run) |
| **Full suite command** | `npm run test` (runs `vitest run` against `tests/**/*.test.ts(x)`) |
| **Estimated runtime** | ~60 seconds for full suite (Phase 16 adds ~6 new test files) |

Integration tests requiring real Postgres skip when `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars are unset (precedent: `tests/data/getSuggestedCollectors.test.ts`, `tests/data/getFeedForUser.test.ts`).

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- tests/{path}.test.ts(x)` (the targeted file for the file just edited)
- **After every plan wave:** Run `npm run test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green AND the manual `EXPLAIN ANALYZE` checkpoint (Pitfall C-1) must be completed and pasted into VERIFICATION.md
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-W0-01 | TBD (Wave 0) | 0 | SRCH-04 | T-16-01 (SQLi) / T-16-03 (privacy) | DAL parameterizes `ilike()`, gates `WHERE profile_public=true`, server-side 2-char min, bio ≥3-char guard, batched `inArray` follow lookup | unit + integration (env-gated) | `npm run test -- tests/data/searchProfiles.test.ts` | ❌ Wave 0 — `tests/data/searchProfiles.test.ts` | ⬜ pending |
| 16-W0-02 | TBD (Wave 0) | 0 | SRCH-03 | T-16-04 (DoS) | Debounce 250ms, AbortController stale-cancel, 2-char client gate, `router.replace({scroll:false})` URL sync | RTL + fake timers | `npm run test -- tests/components/search/useSearchState.test.tsx` | ❌ Wave 0 — `tests/components/search/useSearchState.test.tsx` | ⬜ pending |
| 16-W0-03 | TBD (Wave 0) | 0 | SRCH-05 | T-16-02 (stored XSS) | Match highlighting via React node array (no `dangerouslySetInnerHTML`); regex metachar escape; FollowButton initial state honored | RTL component test | `npm run test -- tests/components/search/PeopleSearchRow.test.tsx` | ❌ Wave 0 — `tests/components/search/PeopleSearchRow.test.tsx` | ⬜ pending |
| 16-W0-04 | TBD (Wave 0) | 0 | SRCH-01, SRCH-02, SRCH-06, SRCH-07 | T-16-03 (privacy), T-16-04 (DoS) | 4 tabs render; Watches/Collections do NOT fire `searchPeopleAction`; pre-query + no-results render suggested-collector children; tab `?tab=` URL sync | RTL component test | `npm run test -- tests/app/search/SearchPageClient.test.tsx` | ❌ Wave 0 — `tests/app/search/SearchPageClient.test.tsx` | ⬜ pending |
| 16-W0-05 | TBD (Wave 0) | 0 | NAV (D-23, D-24) | — | DesktopTopNav: no HeaderNav links rendered; nav search input shows leading magnifier + muted fill; submit-only behavior preserved | RTL component test | `npm run test -- tests/components/layout/DesktopTopNav.test.tsx` | ❌ Wave 0 — `tests/components/layout/DesktopTopNav.test.tsx` (extend or create) | ⬜ pending |
| 16-MANUAL-01 | TBD | final | SRCH-04 (Pitfall C-1) | — | `pg_trgm` GIN index actually used | manual EXPLAIN ANALYZE | `psql "$LOCAL_DB_URL" -c "EXPLAIN ANALYZE SELECT id FROM profiles WHERE username ILIKE '%bo%';"` — output must contain `Bitmap Index Scan` (not `Seq Scan`) | ❌ manual checkpoint | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Per-implementation-task verify mappings (16-NN-MM IDs) are filled in by the planner during PLAN.md authoring. Each implementation task MUST point to one of the Wave 0 files above as its `<automated>` verify command, OR to the EXPLAIN ANALYZE manual checkpoint, OR to a documented Wave 0 dependency.

---

## Wave 0 Requirements

- [ ] `tests/data/searchProfiles.test.ts` — Part A (Drizzle chainable mock) covering D-18 (profile_public WHERE), D-20 (server 2-char min), D-21 (bio ≥3-char guard), D-22 (ORDER BY overlap DESC + username ASC, LIMIT 20), Pitfalls C-2/C-3/C-4/C-5; Part B (integration, env-gated) covering real Postgres ILIKE on seeded profiles.
- [ ] `tests/components/search/useSearchState.test.tsx` — covers SRCH-03 debounce (250ms via `vi.useFakeTimers()`), AbortController stale-cancel, URL sync (`router.replace({ scroll: false })`), 2-char client minimum.
- [ ] `tests/components/search/PeopleSearchRow.test.tsx` — covers SRCH-05 row rendering (avatar, name, bio snippet `line-clamp-1`, taste overlap %, inline FollowButton), match-highlighting (bold/case-insensitive), XSS-safety (crafted `<script>` bio renders as text), `initialIsFollowing` wiring.
- [ ] `tests/app/search/SearchPageClient.test.tsx` — covers SRCH-01 (4 tabs), SRCH-02 (Watches/Collections do not fire `searchPeopleAction`), SRCH-06 (no-results renders suggested-collector children), SRCH-07 (pre-query renders suggested-collector children + does NOT fire action), tab `?tab=` URL sync.
- [ ] `tests/components/layout/DesktopTopNav.test.tsx` — extend or create; covers D-23 (no HeaderNav links rendered) and D-24 (Search icon present in input wrapper, muted fill class, form submit routes to `/search?q=...`).

*(No framework install required — Vitest + RTL + jsdom + msw all already configured per `vitest.config.ts` and `tests/setup.ts`.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `pg_trgm` GIN index actually used by ILIKE query | SRCH-04 (Pitfall C-1) | EXPLAIN ANALYZE output is environment-specific and requires a live Postgres connection; not deterministic from a unit test | 1. Connect to local Supabase: `psql "postgresql://postgres:postgres@localhost:54322/postgres"`. 2. Run `EXPLAIN ANALYZE SELECT id FROM profiles WHERE username ILIKE '%bo%';`. 3. Confirm output contains `Bitmap Index Scan on profiles_username_trgm_idx` (or equivalent GIN trgm index name). 4. Repeat for `bio ILIKE '%bob%'`. 5. Paste the EXPLAIN output into `16-VERIFICATION.md` under a `## Pitfall C-1 Evidence` heading. |
| Visual sanity of nav search input restyle (D-24) | NAV polish | Pixel/spacing/typography balance is judgment-based per user's explicit direction ("dimensions are inspiration, use your judgment to make decisions to make it balanced"); not unit-testable | 1. `npm run dev`. 2. Open authenticated `/` in desktop viewport. 3. Confirm: muted fill, leading magnifier icon inside input, balanced width (logo · Explore · search · Wear · + · Bell · Avatar feels balanced, no element dominates). 4. Submit form — must navigate to `/search?q={typed}`. |
| Two-search-input architecture (D-25) | SRCH-01 | Behavioral correctness across the nav input ↔ page input boundary needs interactive validation | 1. From `/`, type "bob" in nav input + press Enter. 2. Confirm `/search?q=bob` loads with the page-level input pre-filled with "bob" and results rendered. 3. From `/search`, type a new query into the nav input + submit. 4. Confirm URL updates to the new query and page-level results refresh. 5. Confirm no layout shift in the nav input across these transitions. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner fills per-task IDs)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 test files listed above)
- [ ] No watch-mode flags (`vitest run`, not `vitest --watch`)
- [ ] Feedback latency < 60s
- [ ] EXPLAIN ANALYZE manual checkpoint (Pitfall C-1) completed and evidence in VERIFICATION.md
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
