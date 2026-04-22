# Phase 12: Visibility Ripple in DAL - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 12 ripples the three-tier `wear_visibility` enum (`public` | `followers` | `private`) through every existing function that reads `wear_events` for non-owner viewers. The old `profile_settings.worn_public` boolean gate is removed from the DAL and the column itself is dropped in this phase.

Phase 12 ships:

- **Class A (event-surfacing call sites)** — three-tier gate: `getPublicWearEventsForViewer`, `getWearRailForViewer`, `getFeedForUser` (`watch_worn` rows), `src/app/actions/wishlist.ts` add-from-rail action
- **Class B (profile-layout taste-tag count)** — audited and explicitly kept at full count (aggregate math, no event leak)
- **Class C (internal math call sites)** — explicitly OUT OF SCOPE: `follows.ts getTasteOverlapData`, `recommendations.ts`, `suggestions.ts` continue reading raw wear counts via `getAllWearEventsByUser` for score computation. No individual wear event ever surfaces from Class C.
- **Activity metadata** — `logActivity` writers set `metadata.visibility` for `watch_worn` rows at write time; feed DAL gates off metadata (no JOIN to `wear_events` on the hot feed path)
- **Cleanup migration** — drops `profile_settings.worn_public` column; removes settings UI toggle and `wornPublic` field from `profiles.ts` / `actions/profile.ts`
- **Integration tests** — privacy-first UAT rule: tests covering the three-tier matrix (public/followers/private × owner/follower/stranger) written BEFORE any DAL function is touched

**Out of scope for Phase 12:**
- Signed URL minting for `photo_url` (Phase 15 — no row has `photo_url` yet)
- WYWT photo form (Phase 15)
- Per-user `defaultWearVisibility` setting (no global default replaces `worn_public`; every wear is per-row)
- Class C visibility filtering (math-only call sites keep full counts)

</domain>

<decisions>
## Implementation Decisions

### DAL Audit Scope

- **D-01:** Audit scope is **Class A + Class B**. Class A call sites apply strict three-tier filtering; Class B (profile-layout taste-tag count) is audited and explicitly confirmed to keep full counts because `computeTasteTags` consumes an integer, never surfaces individual events, and Common Ground / taste-overlap math would degrade if private wears were excluded from aggregate inputs. Class C (recommendations/suggestions/taste-overlap) is deliberately out of scope — same reasoning.
- **D-02:** Profile-layout `computeTasteTags({ totalWearEvents: wearEvents.length })` keeps the full count even when viewer ≠ owner. Private wears influence the resulting tag string (derived taste label) but no wear event row data ever reaches the viewer's rendered output.
- **D-03:** DAL shape — **introduce a new viewer-aware variant** `getWearEventsForViewer(viewerId, profileUserId)` that returns three-tier-filtered events. Keep `getAllWearEventsByUser(userId)` as owner-only (name implies owner semantics). Mirrors the viewer-aware pattern established in `quick-260421-rdb-fix-404-on-watch-detail-pages-for-watche` (`getWatchById` owner-only vs `getWatchByIdForViewer` three-tier aware). Call sites:
  - Profile layout stats (`src/app/u/[username]/layout.tsx:70`) keeps calling `getAllWearEventsByUser(profile.id)` for the non-owner header taste-tag count (D-02 rule: full count).
  - Profile `[tab]/page.tsx` worn tab non-owner branch calls `getWearEventsForViewer(viewerId, profile.id)` (replaces current `getPublicWearEventsForViewer` call).
  - `getPublicWearEventsForViewer` is renamed/retired in favor of `getWearEventsForViewer` (one function, three-tier logic).
- **D-04:** Phase 12 does NOT mint signed URLs or otherwise touch Storage. Every existing `wear_events` row has `photo_url = NULL` (Phase 11 shipped the column empty). Signed URL minting is Phase 15's concern; DAL functions return `photo_url` raw in the tile payload shape.

### worn_public Lifecycle

- **D-05:** Phase 12 ships a **cleanup migration that DROPs `profile_settings.worn_public`** after the DAL ripple is verified and integration tests pass. Matches Phase 11 D-06 ("Phase 12 includes a final cleanup migration dropping worn_public") and requirement WYWT-11. The column drop is the last migration in the phase, staged after all code changes land.
- **D-06:** Phase 12 scope includes **settings UI cleanup in the same phase**:
  - Remove `wornPublic` field from `ProfileSettings` type in `src/data/profiles.ts`
  - Remove `wornPublic` from `ALLOWED_FIELDS` in `src/app/actions/profile.ts`
  - Remove the `wornPublic` toggle row from `src/components/settings/SettingsClient.tsx`
  - Remove `wornPublic` read from `src/app/settings/page.tsx`
  - Column and UI drop together — no orphaned dead toggle.
- **D-07:** `markAsWorn` (current one-tap wear path, no photo/note/visibility picker yet) writes `visibility = 'public'` via the schema `DEFAULT 'public'`. Users who previously had `worn_public = false` get a one-time v2→v3 transition: their historical wears are already `'private'` via Phase 11 backfill, but new wears default to public. Phase 15's picker is the full solution for per-wear control. This transition is documented but not paved over with a `defaultWearVisibility` setting — no real users exist yet (pre-launch, test accounts only), so simplicity wins.

### Activity Metadata

- **D-08:** **No migration backfill of existing `watch_worn` activity rows.** Pre-launch state (no real users; test accounts disposable) makes legacy data continuity a non-constraint. Running a JOIN-based backfill across activities adds migration complexity for users who don't exist yet.
- **D-09:** Feed DAL (`getFeedForUser`) treats **missing `metadata.visibility` as `'private'` at read time (fail-closed)**. Legacy pre-v3.0 `watch_worn` activity rows effectively drop out of non-self feeds. Defense-in-depth against any future drift where a row might be written without `visibility` set. Acceptable given no real user impact.
- **D-10:** `logActivity` keeps its signature stable; the `watch_worn` metadata type widens to require `visibility: WearVisibility`. Callers pass `visibility` in the metadata object:
  - `markAsWorn` (Phase 12 update): writes `visibility: 'public'` (per D-07 default)
  - `logWearWithPhoto` (Phase 15): writes user-chosen `visibility` from the WYWT picker

### Claude's Discretion

- **Integration test strategy** — Privacy-first UAT rule is locked (from v2.0 retrospective; STATE.md todo). Claude/planner uses a **hybrid approach**: per-function unit tests for each Class A call site, plus one consolidated E2E matrix test file (3 visibilities × 3 viewer relations: owner / follower / stranger × affected surfaces: home rail, feed, worn tab, wear detail). Tests are written before any DAL function is touched. New tests follow the existing pattern in `tests/integration/home-privacy.test.ts` and activate conditionally on `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars.
- **Shared visibility-check helper** — Planner decides whether to extract a shared `canSeeWearEvent(viewer, owner, visibility, isFollowing)` helper or inline the three-tier predicate per call site. Existing codebase prefers inline for Drizzle queries (Drizzle `and`/`or` primitives don't compose cleanly through helpers); TS-land business checks might benefit from a shared helper.
- **Wishlist action gate** — `src/app/actions/wishlist.ts` currently joins `profile_settings.wornPublic` to gate "add-from-rail". Planner decides whether to read `wear_events.visibility` directly in the JOIN (cleanest) or call the viewer-aware DAL helper.
- **Plan ordering within Phase 12** — Planner decides wave structure. Implied order per privacy-first UAT rule: tests → Class A DAL ripple → activity metadata write-path update → Class B audit confirmation → worn_public column drop migration → settings UI cleanup.
- **Exact Drizzle query shape for `metadata->>'visibility'`** — Planner/executor decides jsonb accessor syntax.
- **Migration filenames and timestamps** — Executor decides using existing `supabase/migrations/*.sql` convention.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone / Requirements
- `.planning/ROADMAP.md` §"Phase 12: Visibility Ripple in DAL" — goal, success criteria, pitfalls list (G-1, G-3, G-4, G-5, G-7, F-1, B-6)
- `.planning/REQUIREMENTS.md` — requirement WYWT-10 (three-tier visibility rippled through every wear-reading DAL); WYWT-11 (`worn_public` column removed after backfill verified)
- `.planning/PROJECT.md` — v3.0 milestone constraints, two-layer privacy key decision, viewer-aware DAL pattern
- `.planning/STATE.md` §"Key Decisions (v3.0)" — D4 worn_public deprecated; Phase 12 separate from Phase 11 (highest-risk, tests-first); §"Todos" — "Phase 12 requires integration tests written BEFORE touching any DAL function"

### Phase 11 (direct predecessor)
- `.planning/phases/11-schema-storage-foundation/11-CONTEXT.md` §D-06 (Phase 12 drops worn_public column), §D-07 (backfill direction: false→'private', true→'public')
- `.planning/phases/11-schema-storage-foundation/11-VERIFICATION.md` — confirms Phase 11 success criteria landed (wear_visibility enum + column backfill with DO$$ verification; no rows have `visibility = 'followers'`)
- `.planning/phases/11-schema-storage-foundation/11-RESEARCH.md` — original DAL function audit and schema rationale

### v3.0 Research
- `.planning/research/SUMMARY.md` §"Phase 12: Visibility Ripple in DAL" — phase rationale, "Highest-risk phase. Modifies existing working privacy code. Write integration tests first."
- `.planning/research/ARCHITECTURE.md` §"Three-Tier Visibility Ripple — Full Audit of Wear-Reading DALs" — enumerated list of 8 call sites with current/after behavior
- `.planning/research/ARCHITECTURE.md` §"worn_public Migration Strategy" — backfill plan; transition window reasoning
- `.planning/research/PITFALLS.md` — G-1 (audit all 8+ DAL before touching), G-3 (wornPublic fallthrough removed), G-4 (profile_public outer gate preserved), G-5 (self-tile bypass unchanged), G-7 (visibility in activity metadata at write time), F-1 (table RLS does not protect Storage — separate), B-6 (no getCurrentUser inside use cache)

### Codebase Anchors (direct read before modification)
- `src/data/wearEvents.ts` — the three hot DAL functions (`getPublicWearEventsForViewer`, `getWearRailForViewer`, `getAllWearEventsByUser`); worn_public readers at lines 93, 98, 155, 172
- `src/data/activities.ts` — `getFeedForUser` hot feed path; `worn_public` gate at line 92; `logActivity` signature at line 22
- `src/app/u/[username]/layout.tsx:67-70` — profile layout stats call site (Class B; taste-tag count)
- `src/app/u/[username]/[tab]/page.tsx:107,170,212-213` — worn tab call sites (owner vs non-owner branches)
- `src/app/actions/wishlist.ts` — add-from-rail action with wornPublic gate (lines 33-81)
- `src/app/actions/wearEvents.ts` — `markAsWorn` action; must pass `visibility: 'public'` to logActivity call (line 39-43)
- `src/app/settings/page.tsx` line 42 — `wornPublic` read to remove
- `src/components/settings/SettingsClient.tsx` lines 31, 101-102 — toggle to remove
- `src/app/actions/profile.ts` line 49 — `'wornPublic'` entry in `ALLOWED_FIELDS` to remove
- `src/data/profiles.ts` lines 12, 19, 25, 69, 121 — `wornPublic` field in settings shape to remove
- `src/db/schema.ts` — `profileSettings` table; `wornPublic` column to drop in migration
- `src/lib/feedTypes.ts`, `src/lib/wywtTypes.ts` — DAL return shapes (may need visibility field in tile/row payload)

### Test Patterns (tests-first precedent)
- `tests/integration/home-privacy.test.ts` — two-layer privacy E2E pattern; conditional activation on env vars; this is the template
- `tests/integration/isolation.test.ts` — cross-user RLS enforcement pattern
- `tests/data/getFeedForUser.test.ts` — feed privacy/keyset integration cases (11 existing privacy tests — new visibility tests extend this file)

### Production Runbook
- `docs/deploy-db-setup.md` — prod migration flow, `supabase db push --linked --include-all`

### Memory (user instructions)
- `DB migration rules` — drizzle-kit push is LOCAL ONLY; prod migrations use `supabase db push --linked`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Viewer-aware DAL pattern** (quick-260421-rdb) — `getWatchById` (owner-only) vs `getWatchByIdForViewer` (viewer-aware with privacy gating). Same shape for `getWearEventsForViewer`.
- **`home-privacy.test.ts` integration test harness** — conditional `describe.skipIf(!env)` activation, seeded test users with follow relationships, direct Supabase client calls for RLS verification. Copy this shape for the Phase 12 visibility matrix test.
- **Drizzle jsonb accessor syntax** — existing `activities.metadata` reads; sql template for `metadata->>'key'` comparisons (Postgres operator).
- **Phase 11 `wear_visibility` pgEnum** — already declared in `src/db/schema.ts`; Drizzle-level filter conditions (`eq(wearEvents.visibility, 'public')`) available.
- **`(SELECT auth.uid())` InitPlan pattern** — standard for any new/changed RLS policies (though Phase 12 is DAL-only; RLS on wear_events already landed in Phase 11).

### Established Patterns
- **Two-layer privacy** (v2.0) — RLS at DB layer (Phase 7 + Phase 11 own-or-followed widen) + DAL WHERE clause. Phase 12 updates the DAL layer; RLS layer stays.
- **F-06 outer gate** — `profile_public = true` required as outer gate for non-owner viewers. Preserved in every Class A function.
- **Self-tile bypass** (G-5) — `eq(wearEvents.userId, viewerId)` short-circuits all privacy gates. Preserved in `getWearRailForViewer` self-include branch and `getFeedForUser` F-05 own-filter.
- **Metadata jsonb with TS-enforced shape** — `activities.metadata` has no DB CHECK; TS `ActivityMetadata` type is source of truth. Same pattern extends to `WatchWornMetadata` with the new `visibility` field.
- **Fire-and-forget activity logging** — `logActivity` in `markAsWorn` wrapped in try/catch; failure never rolls back the wear event insert. Unchanged by Phase 12.

### Integration Points
- `src/data/wearEvents.ts` — primary surgery target; `getPublicWearEventsForViewer` + `getWearRailForViewer` WHERE clauses replaced with three-tier predicate
- `src/data/activities.ts` — `getFeedForUser` WHERE clause replaces `profileSettings.wornPublic` read with `metadata->>'visibility'` gate
- `src/app/u/[username]/layout.tsx` — unchanged (Class B, full count preserved per D-02)
- `src/app/u/[username]/[tab]/page.tsx` — non-owner worn tab branch routes to new `getWearEventsForViewer`
- `src/app/actions/wishlist.ts` — JOIN replaces `profile_settings.wornPublic` with `wear_events.visibility` + follows relationship
- `src/app/actions/wearEvents.ts` → `markAsWorn` — add `visibility: 'public'` to metadata in `logActivity` call
- Settings surface (`page.tsx`, `SettingsClient.tsx`, `actions/profile.ts`, `data/profiles.ts`) — remove `wornPublic` field end-to-end
- Migration file — raw SQL `ALTER TABLE profile_settings DROP COLUMN worn_public` at phase end

</code_context>

<specifics>
## Specific Ideas

- **Pre-launch data posture** (per user guidance): "the app has no users except me and my test accounts which can effectively be deleted and i can start over if need be." This is the justification for D-08 (no migration backfill) and D-07 (simple public default on markAsWorn). Do not invent preservation logic for legacy data when the project has no legacy users to preserve.
- **Class B explicit keep-full-count** (D-02): counterargument considered ("private wears shouldn't influence tags shown to strangers"). Rejected because: tag is a derived label, not a raw count; aggregate math never leaks individual events; Common Ground / taste-tag accuracy matters more than theoretical score-delta inference at MVP scale. Same rationale extended to Class C being out of scope.
- **Tests-first is not negotiable** — Privacy-first UAT rule from v2.0 retrospective + STATE.md todo. Planner must structure Plan 01 as "integration test matrix" before any DAL function is touched. Failing-closed reads (D-09) must be covered in the test matrix.
- **One function for viewer-aware reads** (D-03): `getWearEventsForViewer` replaces `getPublicWearEventsForViewer`. Don't maintain two parallel functions during transition — renaming is atomic in one plan.
- **Drop-column is the last migration** — worn_public DROP runs after DAL ripple + tests pass. Prevents the "app reads dropped column" window even within a single phase.

</specifics>

<deferred>
## Deferred Ideas

- **Class C visibility filtering** (`recommendations.ts`, `suggestions.ts`, `follows.ts getTasteOverlapData`) — explicitly out of scope per D-01. Revisit if a concrete privacy-leak vector emerges from score-delta inference (none at MVP scale). If ever reopened, need a "math-only viewer-aware" variant that returns wear counts filtered by visibility for non-self reads.
- **Global `defaultWearVisibility` setting** to replace `worn_public` semantics — rejected for Phase 12. Every wear is per-row; schema DEFAULT handles new-wear fallback. Could be added in a future "settings UX polish" phase if users request it.
- **Master kill-switch override** (worn_public=false forces all wears to effectively-private) — rejected in research; complicates DAL with no clear UX win over a future "Make all private" bulk action.
- **Migration backfill of watch_worn activity rows** — rejected for Phase 12 (D-08). Pre-launch state. Revisit if the app ever carries real user history into a privacy-sensitive migration.
- **Signed URL minting in DAL return shapes** — Phase 15. No `photo_url` exists yet.
- **Bulk "Make all my wears private" action** — not in Phase 12 scope; candidate for future settings/UX phase once users discover the per-wear picker.

### Reviewed Todos (not folded)
*(No todos were cross-referenced — `gsd-tools todo match-phase 12` returned 0 matches. STATE.md's "Phase 12 requires integration tests written BEFORE touching any DAL function" is captured as Claude's Discretion + test-first sequencing above.)*

</deferred>

---

*Phase: 12-visibility-ripple-in-dal*
*Context gathered: 2026-04-22*
