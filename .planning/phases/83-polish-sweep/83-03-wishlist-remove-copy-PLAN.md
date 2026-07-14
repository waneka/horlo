---
phase: 83-polish-sweep
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/watch/WatchDetail.tsx
autonomous: true
requirements:
  - POLISH-03
tags:
  - ui
  - watch-detail
  - copy
  - polish

must_haves:
  truths:
    - "On a watch detail page for a `wishlist` or `grail` watch (`isWishlistLike === true`), the action button label reads `Remove from wishlist` and its variant is `outline` (POLISH-03, per D-07 / D-09 / D-10)."
    - "On a watch detail page for a `wishlist` or `grail` watch, the confirmation dialog title reads `Remove from wishlist`, the body reads `Remove {brand} {model} from your wishlist? You can add it back any time.`, the confirm button reads `Remove from wishlist` and stays `variant=\"destructive\"`, and the cancel button remains `Cancel` (per D-09)."
    - "On a watch detail page for an `owned` (or any non-wishlist-like) watch, the action button label remains `Delete`, its variant remains `destructive`, the dialog title remains `Delete Watch`, the body remains `Are you sure you want to delete {brand} {model}? This action cannot be undone.`, and the confirm button remains `Delete` (per D-08)."
    - "`handleDelete` handler name is unchanged; `removeWatch` server action call is unchanged (per D-11)."
    - "The `isWishlistLike = status === 'wishlist' || status === 'grail'` gate at line 135 is preserved and drives the conditional copy/variant (per D-07)."
  artifacts:
    - path: src/components/watch/WatchDetail.tsx
      provides: "Wishlist/grail-aware delete UI: softened copy + outline variant for wishlist-like; destructive Delete for owned"
      contains: "conditional label + variant on the DialogTrigger Button (lines 303-305 area); conditional DialogTitle + DialogDescription + confirm button label (lines 307-329 area); still branches on `isWishlistLike`"
  key_links:
    - from: "src/components/watch/WatchDetail.tsx (isWishlistLike gate)"
      to: "DialogTrigger Button + DialogTitle + DialogDescription + confirm Button"
      via: "conditional expressions keyed on `isWishlistLike`; same handler wired to both branches"
      pattern: "isWishlistLike ? 'Remove from wishlist' : 'Delete'"
    - from: "handleDelete → removeWatch server action"
      to: "watchDAL.deleteWatch (server-side DELETE of the user's `watches` row + purge of uploaded watch photos)"
      via: "unchanged — copy is UI-only per D-11; the shared `watches_catalog` row is never touched (rationale for D-09's 'You can add it back any time' copy)"
      pattern: "removeWatch(watch.id)"
---

<objective>
POLISH-03: Soften the destructive-delete UX for wishlist and grail watches from "Delete" to "Remove from wishlist" copy on both the action button and the confirmation dialog, and change the action button's variant to `outline`. Owned-watch deletion is untouched (per D-08) — Phase 85 owns the owned-watch UX redesign. Grail is treated identically to wishlist via the existing `isWishlistLike` gate (per D-07) — one string, one behavior, no status-adapted variant.

Purpose: The user clarified during discussion that "Delete" is misleading — nothing is deleted from the shared `watches_catalog`; only the user's per-user `watches` row (and their uploaded photos, which don't exist for wishlist/grail entries in practice) is detached. Softening the copy and lowering the button's visual weight to `outline` matches the actual stakes for wishlist/grail removes.

Output: `src/components/watch/WatchDetail.tsx` with the DialogTrigger Button and dialog contents (title, description, confirm button) conditionally rendered off `isWishlistLike`. No changes to `handleDelete`, `removeWatch`, `isWishlistLike` derivation, the `Dialog` primitive, or any other part of the file.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/83-polish-sweep/83-CONTEXT.md
@CLAUDE.md

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. -->

From src/components/watch/WatchDetail.tsx (existing):

```typescript
// Line 135 — the gate that drives the conditional copy/variant. DO NOT change.
const isWishlistLike = watch.status === 'wishlist' || watch.status === 'grail'

// Lines 140-147 — the handler. DO NOT rename per D-11.
const handleDelete = () => {
  startTransition(async () => {
    const result = await removeWatch(watch.id)
    if (result.success) {
      router.push('/')
    }
  })
}
```

From src/lib/types.ts (reference — do not modify):
`WatchStatus = 'owned' | 'wishlist' | 'sold' | 'grail'`. Phase 85 later adds `previously_owned`; NOT in scope here.

From src/app/actions/watches.ts (lines 779-819) `removeWatch` (reference — do not modify):
- Real DELETE of the user's `watches` row via `watchDAL.deleteWatch`.
- Purges uploaded watch-photo storage objects for the row.
- `watches_catalog` (shared row) is NEVER touched — user can re-add any time. This factual property is what makes D-09's "You can add it back any time" copy accurate.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Conditional wishlist/grail-aware delete copy + variant in WatchDetail.tsx</name>
  <read_first>
    - src/components/watch/WatchDetail.tsx (target file — full file must be read; the `isWishlistLike` gate is at line 135, `handleDelete` is at 140-147, the Actions block starts at line 288, the Dialog is at lines 302-331 including the DialogTrigger Button at 303-305, DialogHeader/Title/Description at 307-313, and the DialogFooter with Cancel + Delete buttons at 314-329)
    - src/app/actions/watches.ts lines 779-819 (skim only — verifies that `removeWatch` behavior does NOT need to change; the copy softening is UI-only per D-11)
    - .planning/phases/83-polish-sweep/83-CONTEXT.md (locked decisions D-07 / D-08 / D-09 / D-10 / D-11)
  </read_first>
  <files>src/components/watch/WatchDetail.tsx</files>
  <action>
    Per D-07 / D-08 / D-09 / D-10 / D-11 (POLISH-03):

    All edits are inside the `<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>` block (currently lines 302-331) inside the `viewerCanEdit && (...)` Actions cluster. The `Dialog` primitive itself is NOT touched — only its trigger button and inner content copy/variants.

    1) `DialogTrigger` (currently lines 303-305): change from a fixed `variant="destructive"` button labeled `Delete` to a conditional expression keyed on `isWishlistLike`:
       - When `isWishlistLike === true`: render a Button with `variant="outline"` and inner text `Remove from wishlist`.
       - When `isWishlistLike === false`: render a Button with `variant="destructive"` and inner text `Delete` (unchanged from today per D-08).

       Preserve the `<DialogTrigger render={<Button ... />}>` primitive form the file already uses (this is the shadcn/base-ui trigger-render pattern; do NOT convert to a plain `<Button>` wrapped by a fragment or an `asChild` shape).

    2) `DialogTitle` (currently line 308): change from the fixed string `Delete Watch` to a conditional keyed on `isWishlistLike`:
       - `isWishlistLike === true` → `Remove from wishlist`
       - `isWishlistLike === false` → `Delete Watch` (unchanged from today per D-08)

    3) `DialogDescription` (currently lines 309-312, the body copy): change from the fixed string `Are you sure you want to delete {watch.brand} {watch.model}? This action cannot be undone.` to a conditional keyed on `isWishlistLike`:
       - `isWishlistLike === true` → `Remove {watch.brand} {watch.model} from your wishlist? You can add it back any time.` (exactly per D-09 — do NOT include the "cannot be undone" phrasing, which is misleading for wishlist per the user's discussion clarification)
       - `isWishlistLike === false` → `Are you sure you want to delete {watch.brand} {watch.model}? This action cannot be undone.` (unchanged from today per D-08)

    4) Confirm Button (currently lines 322-328, the destructive-variant button that calls `handleDelete`): change the inner text `Delete` to a conditional keyed on `isWishlistLike`:
       - `isWishlistLike === true` → `Remove from wishlist` (per D-09 — visual weight matches finality inside the confirm step)
       - `isWishlistLike === false` → `Delete` (unchanged from today per D-08)

       The confirm button's `variant="destructive"` STAYS on both branches (per D-09 — the softening is on the action-trigger button, not the confirm button). The `onClick={handleDelete}` and `disabled={isPending}` props stay unchanged. The Cancel button (lines 315-321) is unchanged (label `Cancel`, variant `outline`).

    5) Do NOT rename `handleDelete`, `removeWatch`, `isDeleteDialogOpen`, or `setIsDeleteDialogOpen` (per D-11 — internal naming stays as-is to keep the diff surgical).

    6) Do NOT modify the `isWishlistLike` derivation at line 135 (per D-07 — the existing predicate stays and drives the softened UX). Do NOT introduce a new derived boolean like `showSoftRemoveCopy` — read `isWishlistLike` directly at each conditional site.

    7) Do NOT modify anything outside the `<Dialog ...>` block (no changes to imports, JSDoc, other buttons like Edit/Mark as Worn, spec cards, gap-fill callout, etc.).

    Recommended local pattern for readability (executor discretion — do NOT add explanatory comments beyond what's naturally warranted):
    - Compute two shared strings near the top of the Actions block (or inline at each site) like `const removeLabel = isWishlistLike ? 'Remove from wishlist' : 'Delete'` and reuse for the trigger + confirm buttons; use inline ternaries for the title and description. Either shape is acceptable — the acceptance criteria assert the rendered output, not the JSX pattern.
  </action>
  <verify>
    <automated>cd /Users/tylerwaneka/Documents/horlo &amp;&amp; ( grep -n 'Remove from wishlist' src/components/watch/WatchDetail.tsx ; echo '---should be &gt;= 3 matches (trigger button + dialog title + confirm button; may be 2 if a shared const is used at trigger+confirm, but the dialog title is a separate string)---' ; grep -n 'You can add it back any time' src/components/watch/WatchDetail.tsx ; echo '---should be 1 match---' ; grep -n 'Delete Watch' src/components/watch/WatchDetail.tsx ; echo '---should still be 1 (non-wishlist branch preserved per D-08)---' ; grep -n 'This action cannot be undone' src/components/watch/WatchDetail.tsx ; echo '---should still be 1 (non-wishlist branch preserved per D-08)---' ; grep -n 'isWishlistLike' src/components/watch/WatchDetail.tsx ; echo '---should be &gt;= 4 matches: 1 declaration + gapFill gate + flag-deal gate + at least 1 new conditional site---' ; npm run build 2>&amp;1 | tail -5 )</automated>
  </verify>
  <acceptance_criteria>
    - Source assertion: `grep -c 'Remove from wishlist' src/components/watch/WatchDetail.tsx` returns at least 2 (the string appears at minimum on the trigger button, dialog title, and confirm button; a shared `const` may collapse trigger+confirm into one literal, but the dialog title is always a separate literal — so ≥ 2 minimum; ≥ 3 preferred).
    - Source assertion: `grep -c 'You can add it back any time' src/components/watch/WatchDetail.tsx` returns exactly 1 (dialog description for wishlist-like branch).
    - Source assertion: `grep -c 'Delete Watch' src/components/watch/WatchDetail.tsx` returns exactly 1 (non-wishlist-like dialog title preserved per D-08).
    - Source assertion: `grep -c 'This action cannot be undone' src/components/watch/WatchDetail.tsx` returns exactly 1 (non-wishlist-like dialog description preserved per D-08).
    - Source assertion: `grep -c 'const isWishlistLike' src/components/watch/WatchDetail.tsx` returns exactly 1 (derivation unchanged; not re-declared).
    - Source assertion: `grep -c 'const handleDelete' src/components/watch/WatchDetail.tsx` returns exactly 1 (handler name preserved per D-11).
    - Source assertion: `grep -c 'removeWatch(watch.id)' src/components/watch/WatchDetail.tsx` returns exactly 1 (server action call unchanged per D-11).
    - Source assertion: `variant="outline"` appears on the DialogTrigger's Button in the wishlist-like branch. Verify structurally: `grep -n 'variant="outline"' src/components/watch/WatchDetail.tsx` produces a match inside the `<Dialog ...>` block near the DialogTrigger (in addition to the existing outline uses on Edit button + Mark as Worn button + Cancel button).
    - Source assertion: the confirm-side Button STILL has `variant="destructive"` regardless of branch. Verify by inspecting the DialogFooter section — the second Button (onClick={handleDelete}) must retain `variant="destructive"`.
    - Build gate: `npm run build` exits 0.
    - Test gate: existing WatchDetail tests still pass — `npx vitest run tests/components/watch/WatchDetail.isChronometer.test.tsx` reports 0 failed (this test does not touch the delete flow, so it should pass unchanged; used as a canary that the file still compiles/renders).
    - Local-First verification surface (per D-13 — for the human walker, not the automated gate): `npm run dev` against local Supabase; sign in as `viewer@horlo.test` (or any seeded user with both wishlist and owned watches — vintage-anna has mixed statuses).
      - Navigate to a **wishlist** watch detail page (`/w/{watchId}`). Confirm action button reads `Remove from wishlist` and looks outlined (not filled red). Click it. Confirm dialog title = `Remove from wishlist`, body ends with `You can add it back any time.`, confirm button = `Remove from wishlist` (still destructive-styled red inside the confirm step), cancel = `Cancel`. Click confirm → watch removes; back on profile confirm it's gone from wishlist.
      - Navigate to an **owned** watch detail page. Confirm action button reads `Delete` and is destructive-styled (filled red). Click it. Confirm dialog title = `Delete Watch`, body = `Are you sure you want to delete {brand} {model}? This action cannot be undone.`, confirm button = `Delete`. Cancel (do NOT confirm — no need to lose owned test data).
      - Mobile-Safari on prod (per D-13 + `feedback_mobile_ui_verify_on_prod`): repeat the wishlist walk to confirm dialog copy renders correctly on iOS Safari.
  </acceptance_criteria>
  <done>WatchDetail.tsx renders softened "Remove from wishlist" copy + outline trigger variant for `isWishlistLike === true` watches; retains "Delete" + destructive variant for all other watches (owned); `handleDelete`, `removeWatch`, and `isWishlistLike` names/derivations unchanged; existing test file still passes.</done>
</task>

</tasks>

<verification>
- `npm run build` exits 0.
- `grep -c 'Remove from wishlist' src/components/watch/WatchDetail.tsx` returns ≥ 2.
- `grep -c 'You can add it back any time' src/components/watch/WatchDetail.tsx` returns 1.
- `grep -c 'Delete Watch' src/components/watch/WatchDetail.tsx` returns 1 (non-wishlist branch preserved).
- `grep -c 'This action cannot be undone' src/components/watch/WatchDetail.tsx` returns 1 (non-wishlist branch preserved).
- `npx vitest run tests/components/watch/WatchDetail.isChronometer.test.tsx` — 0 failed (canary that file still compiles/renders).
- Local-First per D-13: desktop `npm run dev` walk confirms wishlist and owned branches show the correct copy + variants; mobile Safari prod walk (per `feedback_mobile_ui_verify_on_prod`) confirms same on prod.
</verification>

<success_criteria>
- POLISH-03 satisfied: wishlist/grail action button + dialog show "Remove from wishlist" copy with outline trigger; owned watches keep "Delete" copy with destructive trigger.
- Internal handler/action names unchanged (D-11).
- Diff scope is a single component; no test additions (D-12 — WatchDetail.tsx has no existing delete-flow tests; no new ones added).
</success_criteria>

<output>
After completion, create `.planning/phases/83-polish-sweep/83-03-SUMMARY.md`.
</output>
