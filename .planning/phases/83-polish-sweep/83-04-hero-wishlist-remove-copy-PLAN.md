---
phase: 83-polish-sweep
plan: 04
type: execute
wave: 1
depends_on: []
gap_closure: true
files_modified:
  - src/components/watch/WatchDetailHero.tsx
  - tests/components/watch/WatchDetailHero.removeCopy.test.tsx
autonomous: true
requirements:
  - POLISH-03
tags:
  - ui
  - watch-detail
  - copy
  - polish
  - gap-closure

must_haves:
  truths:
    - "On /w/[ref] for a `wishlist` or `grail` watch viewed by its owner, the delete-dialog trigger rendered by WatchDetailHero (the component /w/[ref]/page.tsx actually renders) reads `Remove from wishlist` with `variant=\"outline\"` (POLISH-03, per D-07 / D-10) — closes 83-HUMAN-UAT test 2 gap."
    - "In that wishlist/grail dialog, title reads `Remove from wishlist`, body reads `Remove {brand} {model} from your wishlist? You can add it back any time.`, confirm button reads `Remove from wishlist` and keeps `variant=\"destructive\"`, Cancel stays `Cancel` (per D-09)."
    - "On /w/[ref] for an `owned` (any non-wishlist-like) watch, WatchDetailHero keeps trigger `Delete` + `variant=\"destructive\"`, title `Delete Watch`, body `Are you sure you want to delete {brand} {model}? This action cannot be undone.`, confirm `Delete` (per D-08)."
    - "`handleDelete`, `removeWatch(watch.id)`, `isDeleteDialogOpen`, and the existing `isWishlistLike` derivation in WatchDetailHero.tsx are unchanged (per D-07 / D-11)."
    - "A component test renders WatchDetailHero (not legacy WatchDetail) and asserts wishlist, grail, and owned branches of trigger label/variant + dialog title/body/confirm copy."
    - "Legacy src/components/watch/WatchDetail.tsx is NOT modified or deleted by this plan (out of scope; follow-up cleanup candidate)."
  artifacts:
    - path: src/components/watch/WatchDetailHero.tsx
      provides: "Live /w/[ref] delete dialog branched on isWishlistLike: softened Remove-from-wishlist copy + outline trigger for wishlist/grail; destructive Delete for owned"
      contains: "You can add it back any time"
    - path: tests/components/watch/WatchDetailHero.removeCopy.test.tsx
      provides: "Rendered-component test covering wishlist, grail, and owned delete-dialog branches"
      contains: "WatchDetailHero"
  key_links:
    - from: "src/app/w/[ref]/page.tsx"
      to: "src/components/watch/WatchDetailHero.tsx"
      via: "import { WatchDetailHero } from '@/components/watch/WatchDetailHero' + <WatchDetailHero viewerCanEdit ...> render"
      pattern: "import \\{ WatchDetailHero \\} from '@/components/watch/WatchDetailHero'"
    - from: "WatchDetailHero isWishlistLike gate"
      to: "DialogTrigger Button + DialogTitle + DialogDescription + confirm Button"
      via: "conditional expressions keyed on isWishlistLike; same handleDelete on both branches"
      pattern: "isWishlistLike \\? 'Remove from wishlist' : 'Delete'"
    - from: "tests/components/watch/WatchDetailHero.removeCopy.test.tsx"
      to: "src/components/watch/WatchDetailHero.tsx"
      via: "import { WatchDetailHero } from '@/components/watch/WatchDetailHero'"
      pattern: "from '@/components/watch/WatchDetailHero'"
---

<objective>
Gap closure for 83-HUMAN-UAT test 2 (POLISH-03). Plan 83-03 ported the "Remove from wishlist" copy into the legacy `src/components/watch/WatchDetail.tsx`, which `/w/[ref]` stopped rendering in Phase 64 (D-02/D-09 replaced it with `WatchDetailHero`). Its verification grepped the edited file instead of the rendered route, so the gap shipped. The live delete dialog in `src/components/watch/WatchDetailHero.tsx` (Actions cluster, currently ~lines 379-408) still hardcodes `Delete` / `Delete Watch` / destructive trigger.

This plan ports the exact 83-03 branching (commit c868740e) into WatchDetailHero, adds a component test that renders WatchDetailHero and asserts all three status branches, and verifies the RENDERED path (page.tsx imports WatchDetailHero and the copy lives there).

Purpose: The user saw "Delete" on their wishlist on prod. Nothing is deleted from the shared `watches_catalog` — only the user's own `watches` row — so the softened copy is the accurate one (D-09).

Output: Modified `WatchDetailHero.tsx` (Dialog block only) + new `tests/components/watch/WatchDetailHero.removeCopy.test.tsx`. No change to legacy WatchDetail.tsx, `removeWatch`, or page.tsx.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/83-polish-sweep/83-CONTEXT.md
@.planning/phases/83-polish-sweep/83-HUMAN-UAT.md
@.planning/phases/83-polish-sweep/83-03-wishlist-remove-copy-SUMMARY.md
@CLAUDE.md

<interfaces>
<!-- Extracted from codebase. Executor should not need to explore further. -->

Rendered route — src/app/w/[ref]/page.tsx line 21:
  import { WatchDetailHero } from '@/components/watch/WatchDetailHero'
  (rendered at ~line 347 and ~line 603). Legacy WatchDetail is imported ONLY by
  tests/components/watch/WatchDetail.isChronometer.test.tsx.

src/components/watch/WatchDetailHero.tsx (existing, 'use client'):
- Named export `WatchDetailHero(props: WatchDetailHeroProps)`.
- Required props: `watch: Watch`, `collection: Watch[]`. All others optional;
  `viewerCanEdit` defaults to false (owner actions only render when true).
- Imports that need mocking in jsdom: `useRouter` from 'next/navigation';
  `editWatch`, `removeWatch` from '@/app/actions/watches'; `markAsWorn` from
  '@/app/actions/wearEvents'. Heavy children are skipped by prop omission:
  `WatchPhotoSection` renders only when `signedPhotos !== undefined` (omit it →
  falls back to plain image/WatchIcon); `LikeButton` renders only when both
  `viewerId` and `initialLikeState` are defined (omit them);
  `FollowedOwnersModule` returns null for empty owners (default `[]`).
  Mocking `@/components/insights/FollowedOwnersModule` / `@/components/shared/LikeButton`
  to `() => null` is acceptable if import-time failures appear.
- ~line 142: `const isWishlistLike = watch.status === 'wishlist' || watch.status === 'grail'` — DO NOT change.
- ~lines 144-151: `const handleDelete = () => { startTransition(async () => { const result = await removeWatch(watch.id); if (result.success) router.push('/') }) }` — DO NOT change.
- Current Dialog block (~lines 379-408), inside `{viewerCanEdit && (<div className="flex flex-wrap gap-2"> ...`:
  DialogTrigger `render={<Button variant="destructive" />}` with child text `Delete`;
  DialogTitle `Delete Watch`; DialogDescription `Are you sure you want to delete {watch.brand} {watch.model}? This action cannot be undone.`;
  DialogFooter: Cancel Button (variant outline, onClick closes) + confirm Button (variant destructive, onClick handleDelete, disabled isPending) with text `Delete`.

Exact 83-03 branching to port (from commit c868740e on WatchDetail.tsx — same JSX shape):
- Trigger: `render={<Button variant={isWishlistLike ? 'outline' : 'destructive'} />}`, child `{isWishlistLike ? 'Remove from wishlist' : 'Delete'}`
- Title: `{isWishlistLike ? 'Remove from wishlist' : 'Delete Watch'}`
- Description: template-literal ternary — wishlist: `Remove ${watch.brand} ${watch.model} from your wishlist? You can add it back any time.`; else: `Are you sure you want to delete ${watch.brand} ${watch.model}? This action cannot be undone.`
- Confirm button child: `{isWishlistLike ? 'Remove from wishlist' : 'Delete'}`; `variant="destructive"` unchanged on both branches.

Button variant class markers (src/components/ui/button.tsx) usable in tests:
- destructive variant class string includes `text-destructive` and `bg-destructive/10`.
- outline variant does NOT include `text-destructive`.

Dialog test precedent: tests/components/DeleteAccountModal.test.tsx uses
`userEvent.setup()` + `await user.click(...)`, `screen.getByRole('button', { name: ... })`.
Base-UI Dialog renders its popup in a portal with role="dialog"; use
`within(await screen.findByRole('dialog'))` for scoped queries.

Watch fixture shape (from tests/components/watch/WatchDetail.isChronometer.test.tsx):
  { id: 'w1', brand: 'Rolex', model: 'Datejust', reference: '', status: 'owned',
    movement: 'auto', complications: [], styleTags: [], designTraits: [], roleTags: [],
    notes: '', imageUrl: '' }  (type Watch from '@/lib/types')
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — component test rendering WatchDetailHero delete-dialog branches</name>
  <files>tests/components/watch/WatchDetailHero.removeCopy.test.tsx</files>
  <read_first>
    - src/components/watch/WatchDetailHero.tsx (full file, one pass — confirm prop gating for WatchPhotoSection / LikeButton / FollowedOwnersModule and the Dialog block location)
    - tests/components/watch/WatchDetail.isChronometer.test.tsx (mock + fixture pattern to mirror)
    - tests/components/DeleteAccountModal.test.tsx lines 1-80 (userEvent dialog interaction pattern)
  </read_first>
  <behavior>
    - wishlist (viewerCanEdit=true, status 'wishlist'): a button named exactly `Remove from wishlist` exists; no button named exactly `Delete` exists (assert disappearance too, per project memory feedback_test_assert_disappearance_too); trigger className does NOT contain `text-destructive` (outline variant).
    - wishlist: after clicking the trigger, within role="dialog": text `Remove from wishlist` appears as the title, body text `Remove Rolex Datejust from your wishlist? You can add it back any time.` is present, a button named `Remove from wishlist` exists whose className contains `text-destructive` (confirm stays destructive per D-09), a button named `Cancel` exists, and the text `cannot be undone` and `Delete Watch` are absent.
    - grail (status 'grail'): same trigger label `Remove from wishlist` and softened dialog body (D-07 — grail treated identically).
    - owned (status 'owned'): trigger button named exactly `Delete` exists with className containing `text-destructive`; no button named `Remove from wishlist`; after click, dialog shows `Delete Watch`, body `Are you sure you want to delete Rolex Datejust? This action cannot be undone.`, confirm button named `Delete`; `You can add it back any time` absent (D-08).
    - non-owner (viewerCanEdit=false, status 'wishlist'): neither `Remove from wishlist` nor `Delete` button renders (existing owner gate preserved).
  </behavior>
  <action>
    Create `tests/components/watch/WatchDetailHero.removeCopy.test.tsx` (jsdom default env — this test renders React, it does NOT read the filesystem, so no `@vitest-environment node` pragma). Mirror the mock layout of `WatchDetail.isChronometer.test.tsx`: `vi.mock('next/navigation', ...)` returning `useRouter` with push/refresh/back; `vi.mock('@/app/actions/watches', ...)` exposing `removeWatch` and `editWatch` async stubs returning `{ success: true, data: undefined }`; `vi.mock('@/app/actions/wearEvents', ...)` exposing `markAsWorn`. Import `WatchDetailHero` from `@/components/watch/WatchDetailHero` AFTER mocks (named import, `@/` absolute path). Render with only `watch`, `collection={[]}`, and `viewerCanEdit` — omit `signedPhotos`, `viewerId`, `initialLikeState` so WatchPhotoSection and LikeButton do not mount. If an import-time or render failure comes from `FollowedOwnersModule`, `LikeButton`, or `WatchPhotoSection` modules, add `vi.mock(...)` stubs returning `() => null` for those modules (document which were needed in the SUMMARY).

    Implement each `<behavior>` bullet as its own `it(...)` inside a `describe('<WatchDetailHero> — delete dialog copy (POLISH-03 gap closure, D-07..D-11)')`. Use `userEvent.setup()` and `await user.click(screen.getByRole('button', { name: 'Remove from wishlist' }))` (or `'Delete'`) to open the dialog, then scope assertions with `within(await screen.findByRole('dialog'))`. Use exact-string button names (not regex) so `Delete` does not match `Delete Watch`. The brand/model headings render twice (mobile h1 + desktop h2) — do not assert on those; assert only on the dialog/actions.

    Run the test and confirm it FAILS on the wishlist/grail cases (trigger still reads `Delete`) while the owned and non-owner cases pass. Commit RED: `test(83-04): add failing WatchDetailHero wishlist remove-copy test`.
  </action>
  <verify>
    <automated>cd /Users/tylerwaneka/Documents/horlo && npx vitest run tests/components/watch/WatchDetailHero.removeCopy.test.tsx 2>&1 | tail -25</automated>
  </verify>
  <done>Test file exists, imports WatchDetailHero (not WatchDetail), covers wishlist/grail/owned/non-owner branches; wishlist + grail cases fail for the right reason (label/copy mismatch, not a mount crash); owned + non-owner cases pass; RED commit made.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — port isWishlistLike branching into the live WatchDetailHero dialog + rendered-path verification</name>
  <files>src/components/watch/WatchDetailHero.tsx</files>
  <read_first>
    - src/components/watch/WatchDetailHero.tsx lines 370-415 (the Dialog block only — file already read in Task 1)
    - .planning/phases/83-polish-sweep/83-CONTEXT.md lines 30-45 (D-07..D-11)
  </read_first>
  <behavior>
    - All Task 1 test cases pass.
    - Rendered route /w/[ref] imports WatchDetailHero, and WatchDetailHero contains the softened copy.
  </behavior>
  <action>
    Per D-07 / D-08 / D-09 / D-10 / D-11 (POLISH-03), edit ONLY the `<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>` block inside the `viewerCanEdit &&` Actions cluster of `src/components/watch/WatchDetailHero.tsx`, applying the exact 83-03 branching listed in `<interfaces>`:

    1) DialogTrigger: keep the `render={<Button ... />}` primitive form; set the Button's `variant` to `isWishlistLike ? 'outline' : 'destructive'` (D-10) and the child text to `isWishlistLike ? 'Remove from wishlist' : 'Delete'` (D-08 preserves `Delete` for owned).
    2) DialogTitle: `isWishlistLike ? 'Remove from wishlist' : 'Delete Watch'`.
    3) DialogDescription: template-literal ternary — wishlist-like: `Remove ${watch.brand} ${watch.model} from your wishlist? You can add it back any time.` (D-09; no "cannot be undone"); otherwise the unchanged `Are you sure you want to delete ${watch.brand} ${watch.model}? This action cannot be undone.`
    4) Confirm Button: child text `isWishlistLike ? 'Remove from wishlist' : 'Delete'`; keep `variant="destructive"`, `onClick={handleDelete}`, `disabled={isPending}` exactly (D-09).
    5) Cancel Button unchanged.

    Do NOT: rename `handleDelete` / `removeWatch` / `isDeleteDialogOpen` (D-11); re-declare or alter `isWishlistLike` (D-07); introduce a new derived boolean; touch imports, JSDoc, Mark as Worn / Edit buttons, or anything outside the Dialog block; add any className (no raw palette classes, no font-medium — typography is not touched); modify or delete legacy `src/components/watch/WatchDetail.tsx` (out of scope — note in SUMMARY as follow-up cleanup candidate: WatchDetail.tsx is a dead island whose only consumer is WatchDetail.isChronometer.test.tsx); modify `src/app/w/[ref]/page.tsx`.

    Run the Task 1 test → all pass. Run the rendered-path verification commands (below). Run `npm run build` → exit 0 (authoritative gate per project memory project_baseline_not_green_build_is_gate; do not attribute pre-existing full-tsc or full-suite noise to this plan). Commit GREEN: `fix(83-04): port wishlist remove copy into live WatchDetailHero dialog`.

    Local-first (CLAUDE.md § Local-First Development): before push, run `npm run dev` against local Supabase, sign in as a seeded user with a wishlist or grail watch (e.g. `vintage-anna@horlo.test` / `password123`; if none has one, add a wishlist watch via the add flow), open `/w/{id}` for a wishlist watch and confirm the outline `Remove from wishlist` trigger + softened dialog; open an owned watch and confirm `Delete` / `Delete Watch` (Cancel — do not delete owned seed data). Record results in SUMMARY. Mobile-Safari re-walk of 83-HUMAN-UAT test 2 happens on prod after push (feedback_mobile_ui_verify_on_prod).
  </action>
  <verify>
    <automated>cd /Users/tylerwaneka/Documents/horlo && npx vitest run tests/components/watch/WatchDetailHero.removeCopy.test.tsx tests/components/watch/WatchDetail.isChronometer.test.tsx 2>&1 | tail -8 && echo '--- rendered route imports hero (expect 1) ---' && grep -c "import { WatchDetailHero } from '@/components/watch/WatchDetailHero'" "src/app/w/[ref]/page.tsx" && echo '--- route does NOT import legacy WatchDetail (expect 0) ---' && (grep -c "from '@/components/watch/WatchDetail'" "src/app/w/[ref]/page.tsx" || true) && echo '--- copy in LIVE hero, comment lines excluded (expect >=2, 1, 1) ---' && grep -Ev '^[[:space:]]*(//|[*]|[{]/[*])' src/components/watch/WatchDetailHero.tsx | grep -c 'Remove from wishlist' && grep -Ev '^[[:space:]]*(//|[*]|[{]/[*])' src/components/watch/WatchDetailHero.tsx | grep -c 'You can add it back any time' && grep -Ev '^[[:space:]]*(//|[*]|[{]/[*])' src/components/watch/WatchDetailHero.tsx | grep -c 'Delete Watch' && echo '--- invariants (expect 1, 1) ---' && grep -c 'const isWishlistLike' src/components/watch/WatchDetailHero.tsx && grep -c 'removeWatch(watch.id)' src/components/watch/WatchDetailHero.tsx && echo '--- legacy WatchDetail untouched since 83-03 (expect empty) ---' && git diff --stat c868740e -- src/components/watch/WatchDetail.tsx && npm run build 2>&1 | tail -5</automated>
    <human-check>Desktop at http://localhost:3000/w/{wishlistWatchId} (npm run dev, local Supabase, seeded owner): outline "Remove from wishlist" trigger; dialog title/body/confirm softened; owned watch still shows destructive "Delete" / "Delete Watch". After push: re-walk 83-HUMAN-UAT test 2 on iPhone Safari against prod.</human-check>
  </verify>
  <done>
    - WatchDetailHero.removeCopy.test.tsx: all cases pass; WatchDetail.isChronometer.test.tsx still passes.
    - `src/app/w/[ref]/page.tsx` imports WatchDetailHero (count 1) and not legacy WatchDetail.
    - WatchDetailHero.tsx (non-comment lines): `Remove from wishlist` ≥ 2, `You can add it back any time` = 1, `Delete Watch` = 1; `const isWishlistLike` = 1; `removeWatch(watch.id)` = 1; confirm Button retains `variant="destructive"`.
    - `git diff` shows no change to src/components/watch/WatchDetail.tsx or page.tsx.
    - `npm run build` exits 0.
    - Local desktop walk recorded in SUMMARY; prod mobile re-walk of UAT test 2 flagged as post-push step.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client UI → removeWatch Server Action | Unchanged by this plan; only user-facing copy and a button variant prop change |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-83-04-01 | Elevation of Privilege | WatchDetailHero owner-actions gate | mitigate | `viewerCanEdit &&` gate left intact; Task 1 non-owner test asserts no Remove/Delete button renders for viewerCanEdit=false; `removeWatch` server-side ownership check (T-RDB-06) untouched |
| T-83-04-02 | Repudiation / accidental data loss | Softened wishlist confirm copy | accept | Confirmation dialog retained with destructive confirm variant (D-09); wishlist removal only detaches the user's `watches` row, `watches_catalog` untouched, user can re-add |
</threat_model>

<verification>
- `npx vitest run tests/components/watch/WatchDetailHero.removeCopy.test.tsx` → 0 failed (wishlist, grail, owned, non-owner cases).
- Rendered-path check: `src/app/w/[ref]/page.tsx` imports `WatchDetailHero`; the softened copy lives in `WatchDetailHero.tsx` (non-comment grep), NOT merely in legacy WatchDetail.tsx.
- `npm run build` exits 0.
- Local desktop walk at localhost confirms both branches before push; iPhone Safari re-walk of 83-HUMAN-UAT test 2 on prod after push.
</verification>

<success_criteria>
- 83-HUMAN-UAT test 2 gap closed: owner viewing a wishlist/grail watch at /w/[ref] sees outline "Remove from wishlist" trigger and softened dialog copy; owned watches keep destructive "Delete".
- Decisions D-07, D-08, D-09, D-10, D-11 honored in the live component.
- Regression test targets the rendered component, preventing a repeat of the dead-island failure mode.
- Legacy WatchDetail.tsx left in place (follow-up cleanup noted in SUMMARY).
</success_criteria>

<output>
After completion, create `.planning/phases/83-polish-sweep/83-04-hero-wishlist-remove-copy-SUMMARY.md`.
Include a "Follow-ups" section noting: legacy `src/components/watch/WatchDetail.tsx` is a dead island (only consumer: WatchDetail.isChronometer.test.tsx) — candidate for deletion + test migration to WatchDetailHero in a future quick task.
</output>
