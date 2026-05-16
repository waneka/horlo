# Phase 32: DEBT-09 notesPublic Fix - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Repair the Phase 23 server-action regression in `src/app/actions/watches.ts`:

1. Add `notesPublic: z.boolean().optional()` to `insertWatchSchema` so both `addWatch` and `editWatch` (which derives `updateWatchSchema` via `.partial()`) accept and pass-through the field.
2. Persist `notesPublic` to the DB on every successful write — accomplished automatically once the schema accepts it because `mapDomainToRow` (`src/data/watches.ts:84`) already maps the field.
3. Call `revalidatePath('/u/[username]', 'layout')` after every successful `addWatch` and `editWatch` so the per-row `<NoteVisibilityPill>` on `/u/{username}/notes` reflects the form's choice without a hard navigation.
4. Turn `tests/actions/watches.notesPublic.test.ts` from 4/4 RED → 4/4 GREEN.
5. Hold the existing test suite at zero new failures.

Not in scope: removeWatch parity, schema/types changes, DAL changes, WatchForm UI changes, broader notes.ts/profile.ts/follows.ts review. The pill UI, DB column, types, and DAL persistence path are all already correct on `main` — only the action-layer schema and revalidate are missing.

</domain>

<decisions>
## Implementation Decisions

### Revalidate path + selector

- **D-01:** Use `revalidatePath('/u/[username]', 'layout')` — NOT the ROADMAP wording `'/u/[username]/[tab]', 'page'`. Rationale: the test scaffold (the GREEN contract — success criterion #1, the highest-priority criterion) literally asserts `'/u/[username]', 'layout'` at `tests/actions/watches.notesPublic.test.ts:131,158`. Phase 23 D-19 contract (`23-VERIFICATION.md:143`) specified the same. The `notes.ts` WR-07 finding (lines 53–58, 108–113) explicitly documents that `'/u/[username]/notes'` with `'page'` selector silently no-ops because the actual route template uses a dynamic `[tab]` segment. Codebase precedent: 5/6 sibling actions (`notes.ts` ×2, `profile.ts` ×2, `follows.ts` ×2) use the layout pattern; only `wishlist.ts:206` uses the tab/page pattern. Layout-scoped invalidation correctly bubbles to all tabs (notes, collection, stats) where the pill could render.

### Revalidation triggering

- **D-02:** Fire `revalidatePath('/u/[username]', 'layout')` UNCONDITIONALLY on every successful `addWatch`/`editWatch` — not gated on `'notesPublic' in parsed.data`. ROADMAP success criterion #4 specifies "after every successful write" (unconditional). All three sibling action files (`notes.ts`, `profile.ts`, `follows.ts`) call their layout revalidate unconditionally. The cost is a single no-op call on edits that don't touch visibility-relevant fields; the benefit is a simpler call site and parity with sibling action lore.

### Call-site placement

- **D-03:** Place the new revalidate alongside the existing `revalidatePath('/')` calls — `addWatch` line 267, `editWatch` line 340. Order: `revalidatePath('/')` → `revalidatePath('/u/[username]', 'layout')` → existing `revalidateTag('explore', 'max')`. Keeps the path revalidates grouped before the tag fan-out and minimizes diff churn.

### Scope discipline

- **D-04:** `removeWatch` is intentionally NOT modified. DEBT-09 names "addWatch and editWatch" precisely in REQUIREMENTS.md and ROADMAP.md. Adding revalidate to `removeWatch` would be untested scope creep — the test scaffold doesn't cover it, and ROADMAP success criterion #5 ("no new test failures introduced") is satisfied trivially by leaving it untouched. The deletion-staleness gap on `/u/{user}/notes` is a real but smaller bug; captured as a deferred idea below.

### ROADMAP correction

- **D-05:** Edit `.planning/ROADMAP.md` Phase 32 success criterion #4 inline this phase to read `revalidatePath('/u/[username]', 'layout')` instead of `'/u/[username]/[tab]', 'page'`. Rationale: ROADMAP and the test cannot both be authoritative; the test is the contract per success criterion #1. A doc fix that closes the contradiction belongs alongside the fix that satisfies it. This single-line ROADMAP edit ships in the same PR as the action change.

### Test strategy

- **D-06:** No new tests authored in this phase. The 4 existing tests in `tests/actions/watches.notesPublic.test.ts` are the GREEN target as-is — adding tests would expand scope. The companion suite `tests/actions/watches.test.ts` (and other action tests) must remain GREEN as a regression check (success criterion #5).

### Claude's Discretion

User said "you can choose for this phase" on all four surfaced gray areas. Decisions D-01 through D-06 above were made by Claude and locked into this CONTEXT.md so the planner and executor act without re-asking. If the user disagrees with any single decision, this file is the place to redirect before `/gsd-plan-phase 32` runs.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 23 lineage (the regression's birthplace)
- `.planning/milestones/v4.0-phases/23-settings-sections-schema-field-ui/23-VERIFICATION.md` §"notesPublic cross-page revalidation (D-19)" (lines 140–146) — original D-19 contract; the `'/u/[username]', 'layout'` semantics that the test asserts.
- `.planning/milestones/v4.0-phases/23-settings-sections-schema-field-ui/23-VERIFICATION.md` §"Gaps Summary" (line 156) — DEBT-09 origin; defines the exact one-line schema add + the exact revalidate call site that this phase must reintroduce.

### v4.1 audit (the discovery + remediation deferral)
- `.planning/milestones/v4.1-MILESTONE-AUDIT.md` §DEBT-09 (lines 58–67, 165–177) — reproducible evidence (`grep -cnE "notesPublic|notes_public" src/app/actions/watches.ts → 0`; `git merge-base --is-ancestor 4d362ff HEAD → 1`); user impact described.

### v5.0 framing
- `.planning/ROADMAP.md` §"Phase 32: DEBT-09 notesPublic Fix" (lines 118–128) — phase goal + success criteria. NOTE: criterion #4 wording is being corrected this phase (D-05).
- `.planning/REQUIREMENTS.md` §DEBT-09 (line 15) — full requirement text.
- `.planning/STATE.md` §"Key Decisions (v5.0)" — "DEBT-09 before audit: RED scaffold blocks CI confidence".

### Test contract (the GREEN target — read literally)
- `tests/actions/watches.notesPublic.test.ts` — 4 tests: (1) addWatch persists notesPublic to DAL, (2) editWatch revalidates `/u/[username]` layout, (3) addWatch revalidates `/u/[username]` layout, (4) Zod rejects non-boolean notesPublic.

### Sibling action precedent (codebase pattern study)
- `src/app/actions/notes.ts` — `updateNoteVisibility` and `removeNote` both call `revalidatePath('/u/[username]', 'layout')`; WR-07 explanatory comment lines 53–58 and 108–113 — the dynamic-`[tab]` pitfall.
- `src/app/actions/profile.ts` — 2 calls to the layout revalidate (lines 34, 83).
- `src/app/actions/follows.ts` — 2 calls to the layout revalidate (lines 53, 118).
- `src/app/actions/wishlist.ts:206` — sole exception using `'/u/[username]/[tab]', 'page'`. Not the pattern this phase follows; out of scope to revisit.

### DB and types (already correct — confirm-only)
- `src/db/schema.ts:95` — `notesPublic: boolean('notes_public').notNull().default(true)` (column exists with the right default).
- `src/lib/types.ts:53` — `notesPublic?: boolean` (domain type already declares it).
- `src/data/watches.ts:43, 84` — `mapRowToWatch` reads it; `mapDomainToRow` writes it. DAL persistence is automatic once the action passes `notesPublic` through.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `insertWatchSchema` at `src/app/actions/watches.ts:17–54` — the only Zod schema needing the one-line addition. `updateWatchSchema = insertWatchSchema.partial()` (line 57) means a single edit covers both `addWatch` and `editWatch`.
- `mapDomainToRow` at `src/data/watches.ts:56–92` — already maps `notesPublic` (line 84). No DAL work required.
- `WatchForm` at `src/components/watch/WatchForm.tsx:83, 127, 641–668` — already collects `notesPublic` in form state and submits it via `...formData` spread. Pre-existing UI is correct; the action layer is the only broken segment.

### Established Patterns
- **Action-level revalidate placement:** call `revalidatePath('/')` first, then any user-scoped layout revalidate, then `revalidateTag('explore', 'max')`. Pattern is consistent across `addWatch`, `editWatch`, `removeWatch` for the path+tag pair already; this phase extends the pair to a triple by inserting the user-scoped layout call between the two existing calls.
- **`notesPublic` semantics:** server-side default `true` (DB column NOT NULL DEFAULT true; `mapRowToWatch` falls back to `true` when row column is null/undefined). The schema entry is `.optional()`, not `.default(true)` — the DB owns the default; the schema only ensures the field passes through when supplied. Per Phase 23 D-13/D-16.

### Integration Points
- `addWatch` (lines 65–287) — 5 success-path concerns persist (catalog wiring, taste enrichment, activity logging, overlap notifications, explore tag fan-out). The new revalidate must be inserted without disturbing the order or the fire-and-forget semantics. Insertion point: after `revalidatePath('/')` line 267, before `revalidateTag('explore', 'max')` line 277.
- `editWatch` (lines 295–358) — much smaller. Insertion point: after `revalidatePath('/')` line 340, before `revalidateTag('explore', 'max')` line 348.
- Tests that mock `next/cache` (e.g., `tests/actions/watches.test.ts:18`, `tests/actions/wishlist.test.ts`, `tests/actions/preferences.test.ts`) will see one extra `revalidatePath` call per add/edit — verify none of them assert call counts or argument signatures that the new call would violate.

</code_context>

<specifics>
## Specific Ideas

The user delegated all four gray-area decisions to Claude. The fix is mechanical:
- Add `notesPublic: z.boolean().optional(),` as a new line inside the `insertWatchSchema` z.object body.
- Add `revalidatePath('/u/[username]', 'layout')` between the existing `revalidatePath('/')` and `revalidateTag('explore', 'max')` calls in both `addWatch` and `editWatch`.
- Edit ROADMAP.md success criterion #4 to match the test's literal assertion.

Run `npx vitest run tests/actions/watches.notesPublic.test.ts` to confirm 4/4 GREEN. Run the full suite to confirm no regressions.

</specifics>

<deferred>
## Deferred Ideas

- **`removeWatch` parity revalidate** — `removeWatch` does not call `revalidatePath('/u/[username]', 'layout')`. When a watch with a note is deleted, `/u/{username}/notes` keeps stale rows until a hard refresh. Real but smaller bug than DEBT-09 itself; not named in DEBT-09 scope. Capture as a follow-up: either a separate `/gsd-quick` ticket or roll into v4.2/v5.x polish. Decision rationale logged in D-04.
- **`wishlist.ts:206` pattern divergence** — sole holdout using `'/u/[username]/[tab]', 'page'`. Not addressed this phase. Worth revisiting in a future hygiene pass if the WR-07 lesson generalizes (the literal-template-with-page-selector silently no-ops). Could be a one-liner correctness improvement; flag for v5.x technical-debt review.
- **Cross-action revalidate audit** — broader sweep across all server actions to verify none have the same dynamic-segment pitfall WR-07 documents. Not for this phase; could pair with the v4.2 / v5.x technical-debt pass.

</deferred>

---

*Phase: 32-debt-09-notespublic-fix*
*Context gathered: 2026-05-06*
