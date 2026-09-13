---
phase: quick-260913-csl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/wear/WearDeleteDialog.tsx
  - src/components/wear/WearDeleteButton.tsx
  - tests/components/wear/WearDeleteButton.test.tsx
  - src/components/wear/WearOverflowMenu.tsx
  - src/components/wear/WearCard.tsx
  - src/app/wear/[wearEventId]/page.tsx
  - src/app/actions/wearEvents.ts
  - tests/components/wear/WearOverflowMenu.test.tsx
autonomous: true
requirements: [QUICK-260913-csl]

must_haves:
  truths:
    - "On /wear/[wearEventId], the wear owner opens the corner '…' (More options) menu and sees 'Delete wear' as the LAST item, below a separator, styled destructive via the DropdownMenuItem variant='destructive' token (no raw palette)"
    - "A non-owner viewer on /wear/[wearEventId] never sees 'Delete wear' in the menu (ownership is server-derived in page.tsx as wear.userId === viewerId and threaded down as canDelete)"
    - "On the stories lane (/wears/[username], commentHostVariant='bottom-sheet') the menu NEVER shows 'Delete wear', even on the viewer's own wears — WearCard forces canDelete false for the bottom-sheet variant and WearsLane passes nothing"
    - "The standalone 'Delete wear' button under the note on /wear/[wearEventId] is gone; WearDeleteButton.tsx no longer exists and nothing imports it"
    - "Selecting 'Delete wear' closes the menu and opens the same confirmation dialog as 260913-cae ('Delete this wear?' + photo or video / likes and comments copy); the dialog is rendered outside DropdownMenuContent so it survives the menu popup unmounting"
    - "Cancel closes the dialog without calling deleteWearEvent; Delete calls deleteWearEvent({ wearEventId }) once, shows 'Deleting…' disabled while pending, then toast('Wear deleted') and router.replace('/u/<username>/worn'); failure keeps the dialog open with an inline role='alert' error"
    - "The dialog's one-shot error state resets on the closed→open transition (not on mount), so reopening after a failure shows no stale error (Router Cache stale-instance lesson)"
  artifacts:
    - path: "src/components/wear/WearDeleteDialog.tsx"
      provides: "Controlled (open/onOpenChange) delete-confirmation Dialog, no trigger; owns useTransition + error state; calls deleteWearEvent"
      exports: ["WearDeleteDialog"]
    - path: "src/components/wear/WearOverflowMenu.tsx"
      provides: "Owner-gated 'Delete wear' menu item + sibling WearDeleteDialog"
      contains: "WearDeleteDialog"
    - path: "src/components/wear/WearCard.tsx"
      provides: "Optional canDelete prop (default false), forced false for bottom-sheet variant, passed to WearOverflowMenu with ownerUsername"
      contains: "canDelete"
    - path: "tests/components/wear/WearOverflowMenu.test.tsx"
      provides: "RTL coverage: owner/non-owner/stories-lane gating (presence AND absence after open) + ported dialog behaviors"
  key_links:
    - from: "src/app/wear/[wearEventId]/page.tsx"
      to: "WearCard canDelete prop"
      via: "canDelete={wear.userId === viewerId} passed into WearPhotoStreamed → WearCard"
      pattern: "canDelete=\\{wear\\.userId === viewerId\\}"
    - from: "src/components/wear/WearCard.tsx"
      to: "src/components/wear/WearOverflowMenu.tsx"
      via: "canDelete={canDelete && commentHostVariant === 'inline'} + ownerUsername"
      pattern: "commentHostVariant === 'inline'"
    - from: "src/components/wear/WearOverflowMenu.tsx"
      to: "src/components/wear/WearDeleteDialog.tsx"
      via: "menu item onClick sets deleteOpen=true; <WearDeleteDialog open={deleteOpen}> rendered as sibling of <DropdownMenu>"
      pattern: "<WearDeleteDialog"
    - from: "src/components/wear/WearDeleteDialog.tsx"
      to: "deleteWearEvent Server Action"
      via: "import from '@/app/actions/wearEvents' (unchanged)"
      pattern: "deleteWearEvent\\(\\{ wearEventId \\}\\)"
---

<objective>
Move the owner-only "Delete wear" action (shipped standalone in quick task 260913-cae) from the ghost button under the note on /wear/[wearEventId] into the corner overflow menu (WearOverflowMenu), as the last item below "Copy link". Detail page only — the stories lane menu must never offer delete.

Purpose: declutter the detail page and put the destructive action where secondary post actions already live, without touching the Server Action / DAL.
Output: new dialog-only WearDeleteDialog component, WearOverflowMenu delete item, canDelete prop threaded page → WearCard → menu, WearDeleteButton (component + test) removed, new WearOverflowMenu RTL test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@./AGENTS.md
@.planning/STATE.md
@.planning/quick/260913-cae-delete-wear-owner-only-action-delete-but/260913-cae-SUMMARY.md

Rendered path (traced — verified before planning):
- /wear/[wearEventId] → src/app/wear/[wearEventId]/page.tsx `WearDetailPage` → `<Suspense>` → `WearPhotoStreamed` (same file, async server child) → `<WearCard commentHostVariant="inline" ... ownerUsername=...>` → `<WearOverflowMenu showGoToPost={commentHostVariant === 'bottom-sheet'} ...>`. The standalone `<WearDeleteButton>` currently renders in `WearDetailPage` directly after `<WearDetailMetadata>`, gated `wear.userId === viewerId`.
- /wears/[username] → src/components/wears/WearsLane.tsx line ~402: `<WearCard {...slide} viewerId={viewerId} commentHostVariant="bottom-sheet" onCommentOpenChange={setCommentOpen} />`. `WearSlide` (WearsLane.tsx line 25) has NO canDelete field — do not add one.
- Only importers of WearDeleteButton: page.tsx and tests/components/wear/WearDeleteButton.test.tsx. src/app/actions/wearEvents.ts line ~738 mentions it in a comment only.

<interfaces>
Existing contracts (do not change):

From src/app/actions/wearEvents.ts:
- `deleteWearEvent({ wearEventId }: { wearEventId: string })` → `Promise<{ success: true; data: { username: string | null } } | { success: false; error: string }>` (username may be null; existing code falls back to the ownerUsername prop, then '/').

From src/components/ui/dropdown-menu.tsx (base-ui Menu wrappers):
- `DropdownMenuItem` accepts `variant?: "default" | "destructive"` (destructive variant applies text-destructive + focus bg-destructive/10 + dark:bg-destructive/20 tokens), base-ui item props incl. `onClick`, `closeOnClick`, `disabled`.
- `DropdownMenuContent` spreads extra props onto `MenuPrimitive.Popup`, which supports `finalFocus?: boolean | RefObject | ((closeType) => boolean | HTMLElement | null | void)`.
- `DropdownMenuSeparator` exists and is already imported in WearOverflowMenu.

From src/components/ui/dialog.tsx: `Dialog` (base-ui Dialog.Root, supports controlled `open` / `onOpenChange`), `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`. `DialogTrigger` is NOT needed for the controlled dialog.

Current WearOverflowMenuProps: `wearEventId: string; permalinkUrl: string; showAddToWishlist: boolean; onPhoto: boolean; showGoToPost: boolean`. WearCard is its only caller.

Current WearCardProps already include `commentHostVariant: 'bottom-sheet' | 'inline'` and `ownerUsername: string`.

Test harness: tests/setup.tsx globally mocks next/navigation (per-file `vi.mock('next/navigation', ...)` overrides it). Existing tests/components/wear/WearCard.test.tsx opens the menu with `fireEvent.click(screen.getByRole('button', { name: 'More options' }))`; base-ui portals menu items, so they are absent until the trigger is clicked.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extract controlled WearDeleteDialog, add owner-gated "Delete wear" item to WearOverflowMenu, with RTL tests</name>
  <files>src/components/wear/WearDeleteDialog.tsx, src/components/wear/WearOverflowMenu.tsx, tests/components/wear/WearOverflowMenu.test.tsx</files>
  <read_first>
    - src/components/wear/WearDeleteButton.tsx (source of dialog copy, pending guard, success/failure logic to port verbatim)
    - tests/components/wear/WearDeleteButton.test.tsx (7 behaviors + mock block to port)
    - src/components/wear/WearOverflowMenu.tsx
    - src/components/ui/dropdown-menu.tsx lines 25-100 (Content props spread, Item variant)
    - tests/components/wear/WearCard.test.tsx lines 95-120 (menu-open pattern)
  </read_first>
  <behavior>
    Menu gating (render WearOverflowMenu directly with wearEventId, permalinkUrl='/wear/<id>', showAddToWishlist=false, onPhoto=false, showGoToPost=false, ownerUsername='alice'):
    - canDelete=true: before opening, no 'Delete wear' text in document; after clicking 'More options', `getByRole('menuitem', { name: /delete wear/i })` exists and it is the last menuitem (last element of `getAllByRole('menuitem')`), and a separator (`getByRole('separator')`) is present.
    - canDelete=false: after clicking 'More options', `queryByRole('menuitem', { name: /delete wear/i })` is null AND `queryByText(/delete wear/i)` is null, while 'Copy link' IS present (proves the menu actually opened).
    - Stories-lane config (showGoToPost=true, canDelete=false): after open, 'Go to wear post' present, 'Delete wear' absent.
    Dialog flow (canDelete=true, open menu, click the 'Delete wear' menuitem):
    - dialog opens (`findByRole('dialog')`) with 'Delete this wear?', /photo or video/, /likes and comments/; and the menu closed — `waitFor` that `queryByRole('menuitem', { name: /copy link/i })` is null.
    - Cancel closes the dialog (waitFor 'Delete this wear?' absent) and deleteWearEvent not called.
    - Delete calls deleteWearEvent({ wearEventId }) exactly once; 'Deleting…' button disabled while pending; after resolve the dialog disappears.
    - success → mockReplace called with '/u/alice/worn', toast('Wear deleted'), push/back never called, dialog text absent.
    - failure ({ success:false, error:'Wear not found' }) → role='alert' with that text, dialog still open, no replace/push/toast.
    - reopen after failure: Cancel → reopen via menu again → no role='alert' rendered.
  </behavior>
  <action>
    RED first: create tests/components/wear/WearOverflowMenu.test.tsx covering every bullet in behavior. Port the mock block from WearDeleteButton.test.tsx (vi.mock '@/app/actions/wearEvents' with deleteWearEvent vi.fn; per-file vi.mock 'next/navigation' with mockReplace/mockPush/mockBack; vi.mock 'sonner' toast) and additionally vi.mock '@/app/actions/wishlist' with addToWishlistFromWearEvent vi.fn so the wishlist action module never loads. Use a local renderMenu(overrides) helper and an openMenu() helper that clicks the 'More options' button. Pair every presence assertion with the matching disappearance/absence assertion (memory: feedback_test_assert_disappearance_too). Run it and confirm it fails.

    GREEN, step A — create src/components/wear/WearDeleteDialog.tsx ('use client', named export WearDeleteDialog). Props: wearEventId: string, ownerUsername: string, open: boolean, onOpenChange: (open: boolean) => void. Port from WearDeleteButton.tsx verbatim: useRouter, useTransition, error state, the handleConfirm body (deleteWearEvent({ wearEventId }) → on failure setError(result.error) and return; on success onOpenChange(false), toast('Wear deleted'), router.replace(username ? `/u/${username}/worn` : '/') using result.data.username ?? ownerUsername), the DialogContent/Header/Title/Description/alert/Footer markup and copy exactly (title 'Delete this wear?', same description sentence, Cancel outline button, destructive confirm button 'Delete' / 'Deleting…'). Differences: no DialogTrigger and no wrapper div/ghost button; the Dialog is controlled by the `open` prop. Internal handleOpenChange(next): if pending return (block closing mid-delete); otherwise call onOpenChange(next). One-shot reset on open (not mount, not effect): use the React "adjust state while rendering" pattern — keep a `prevOpen` useState initialized to `open`; during render, if `open !== prevOpen` then setPrevOpen(open) and, if `open` is true, setError(null). Do NOT use useEffect+setState for this (flashes stale error for a frame and trips react-hooks set-state-in-effect lint). Doc comment: explain it is the confirmation dialog for quick tasks 260913-cae/260913-csl, rendered by WearOverflowMenu outside DropdownMenuContent, does not re-check ownership (deleteWearEvent's DAL owner scoping is the real IDOR gate).

    GREEN, step B — edit src/components/wear/WearOverflowMenu.tsx. Add required props canDelete: boolean and ownerUsername: string (document: canDelete is server-derived ownership, true only on the detail page for the wear owner; WearCard forces false on the stories lane). Add Trash2 to the lucide import and import WearDeleteDialog. Add `const [deleteOpen, setDeleteOpen] = useState(false)`. Add handleDeleteSelect: setOpen(false) then setDeleteOpen(true) (item uses default closeOnClick, so base-ui also closes the menu). Inside DropdownMenuContent, AFTER the showAddToWishlist block, render when canDelete: a DropdownMenuSeparator followed by `DropdownMenuItem variant="destructive" onClick={handleDeleteSelect}` containing `Trash2 className="size-4" aria-hidden` and the text 'Delete wear' — destructive styling comes only from the variant token (no raw palette classes, no font-bold). Change the return to a fragment: the existing DropdownMenu unchanged, then as a SIBLING (outside DropdownMenu/DropdownMenuContent) render `{canDelete && <WearDeleteDialog wearEventId={wearEventId} ownerUsername={ownerUsername} open={deleteOpen} onOpenChange={setDeleteOpen} />}`. Focus-return guard: pass a finalFocus function to DropdownMenuContent that returns false when a ref flag `deleteSelectedRef.current` is true (set the ref true in handleDeleteSelect; reset it to false in handleOpenChange when the menu opens) and otherwise returns true (default trigger focus-return for Copy link / Escape) — this stops the closing menu from pulling focus back to the trigger after the modal dialog has taken focus. Update the component doc comment: detail page shows Copy link (+ wishlist when applicable) + owner-only Delete wear last; stories lane never shows delete.

    Leave WearDeleteButton.tsx, its test, and page.tsx untouched in this task so the tree stays buildable at this commit; removal happens in Task 2 together with the page edit.
  </action>
  <verify>
    <automated>npx vitest run tests/components/wear/WearOverflowMenu.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/components/wear/WearOverflowMenu.test.tsx` passes, with at least 9 tests (3 gating + 6 dialog-flow).
    - `grep -c "variant=\"destructive\"" src/components/wear/WearOverflowMenu.tsx` returns >= 1.
    - `grep -n "<WearDeleteDialog" src/components/wear/WearOverflowMenu.tsx` line number is greater than the line number of `</DropdownMenu>` in the same file (dialog rendered outside the menu).
    - `grep -c "useEffect" src/components/wear/WearDeleteDialog.tsx` returns 0.
    - `grep -En "text-(red|rose)-|font-bold" src/components/wear/WearOverflowMenu.tsx src/components/wear/WearDeleteDialog.tsx` returns no matches.
  </acceptance_criteria>
  <done>WearDeleteDialog exists as a controlled dialog with the unchanged confirm/delete/navigate behavior; WearOverflowMenu shows 'Delete wear' last and destructive only when canDelete, opening the dialog rendered outside the menu; new test file green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Thread server-derived canDelete page → WearCard → menu, remove the standalone button, add stories-lane gating test, build gate</name>
  <files>src/components/wear/WearCard.tsx, src/app/wear/[wearEventId]/page.tsx, src/app/actions/wearEvents.ts, tests/components/wear/WearOverflowMenu.test.tsx, src/components/wear/WearDeleteButton.tsx (delete), tests/components/wear/WearDeleteButton.test.tsx (delete)</files>
  <read_first>
    - src/components/wear/WearCard.tsx (props interface + WearOverflowMenu call site ~line 184)
    - src/app/wear/[wearEventId]/page.tsx (WearDeleteButton import line 13, render ~line 118, WearPhotoStreamed props)
    - src/components/wears/WearsLane.tsx lines 25-60 and 400-410 (confirm stories lane passes no canDelete)
    - tests/components/wear/WearCard.video.test.tsx lines 15-45 (mkProps full WearCard prop set to reuse)
  </read_first>
  <behavior>
    Add to tests/components/wear/WearOverflowMenu.test.tsx a WearCard describe block (import WearCard, reuse a mkProps like WearCard.video.test.tsx with signedUrl null / watchImageUrl null):
    - commentHostVariant='inline', canDelete=true → after clicking 'More options', 'Delete wear' menuitem present.
    - commentHostVariant='inline', canDelete omitted → after open, 'Delete wear' absent ('Copy link' present).
    - commentHostVariant='bottom-sheet', canDelete=true (own wear on the stories lane) → after open, 'Go to wear post' present AND 'Delete wear' absent.
  </behavior>
  <action>
    RED: add the three WearCard cases above to tests/components/wear/WearOverflowMenu.test.tsx (the mocks from Task 1 already cover the actions; if WearCard's other children pull in modules that fail to load in jsdom, add minimal vi.mock stubs for those action modules rather than mocking WearCard's children). Run and confirm the canDelete=true inline case fails.

    GREEN — src/components/wear/WearCard.tsx: add optional prop `canDelete?: boolean` to WearCardProps with a doc comment (server-derived owner flag, set only by /wear/[wearEventId] page; the stories lane passes nothing; ignored for the bottom-sheet variant — stories lane never offers delete, locked user decision). Destructure with default `canDelete = false`. At the WearOverflowMenu call site pass `canDelete={canDelete && commentHostVariant === 'inline'}` and `ownerUsername={ownerUsername}`. Add one line to the component doc comment noting the owner-only delete item on the inline variant. Do NOT modify WearsLane.tsx or WearSlide.

    src/app/wear/[wearEventId]/page.tsx: remove the `import { WearDeleteButton }` line and the entire `{wear.userId === viewerId && (<WearDeleteButton .../>)}` block after WearDetailMetadata. Add `canDelete: boolean` to WearPhotoStreamed's param destructuring and its inline prop type; at the WearPhotoStreamed call site pass `canDelete={wear.userId === viewerId}`; forward `canDelete={canDelete}` to `<WearCard>`. Update the page doc comment paragraph for quick task 260913-cae to say the owner-only "Delete wear" action lives in the WearCard overflow menu (quick task 260913-csl), gated on wear.userId === viewerId (server-derived) and threaded down as canDelete.

    Delete src/components/wear/WearDeleteButton.tsx and tests/components/wear/WearDeleteButton.test.tsx with git rm (all 7 dialog behaviors are already ported into WearOverflowMenu.test.tsx by Task 1).

    src/app/actions/wearEvents.ts: COMMENT-ONLY edit at ~line 738 — replace the WearDeleteButton reference with WearOverflowMenu (canDelete). No code changes in this file.

    Then run the full gates: the wear component tests, `npm run lint` scoped is optional, and `npm run build` (authoritative gate — exit 0 required; known unrelated failing tests elsewhere are baseline, do not chase them). Use the main checkout, not a worktree (build needs gitignored .env.local).

    In the SUMMARY, record an "Operator Local Walk — PENDING" section (runtime UI change; not a blocking checkpoint): (1) `npm run dev` against local Supabase, sign in as vintage-anna@horlo.test / password123, open one of her /wear/<id> pages — no button under the note; '…' menu shows Copy link then separator then red 'Delete wear' last; (2) choose Delete wear → menu closes, dialog opens with focus inside it → Cancel → nothing deleted; reopen → Delete → toast 'Wear deleted', lands on /u/vintage-anna/worn without the wear, browser Back does not return to the deleted page; (3) open /wears/vintage-anna (own stories lane) → '…' menu shows Go to wear post + Copy link, NO Delete wear; (4) sign in as viewer@horlo.test, open another user's /wear/<id> → no Delete wear in the menu.
  </action>
  <verify>
    <automated>npx vitest run tests/components/wear/ && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/components/wear/` passes (WearOverflowMenu.test.tsx, WearCard.test.tsx, WearCard.video.test.tsx, WearVideoClient.test.tsx).
    - `npm run build` exits 0.
    - `test ! -e src/components/wear/WearDeleteButton.tsx && test ! -e tests/components/wear/WearDeleteButton.test.tsx` succeeds.
    - `grep -rn "WearDeleteButton" src tests` returns no matches (comment in wearEvents.ts updated too).
    - `grep -vE '^\s*(\*|//|/\*)' "src/app/wear/[wearEventId]/page.tsx" | grep -cE "WearDeleteButton|Delete wear"` returns 0 (standalone button gone from the page; doc-comment lines excluded).
    - `grep -c "canDelete={wear.userId === viewerId}" "src/app/wear/[wearEventId]/page.tsx"` returns 1.
    - `grep -c "canDelete && commentHostVariant === 'inline'" src/components/wear/WearCard.tsx` returns 1.
    - `grep -c "canDelete" src/components/wears/WearsLane.tsx` returns 0.
    - `git diff --name-only` shows no changes to src/data/ and src/app/actions/wearEvents.ts diff contains only comment lines (`git diff src/app/actions/wearEvents.ts | grep -E '^[+-][^+-]' | grep -vE '^[+-]\s*(//|\*)'` returns nothing).
  </acceptance_criteria>
  <done>Detail page owner sees Delete wear only inside the overflow menu; non-owners and the stories lane never do; no standalone button; build green; SUMMARY lists the pending local-dev walk.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → Server Action | deleteWearEvent receives an untrusted wearEventId from the browser |
| server page → client props | canDelete is computed server-side and only controls UI visibility |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-QK-csl-01 | Elevation of Privilege | deleteWearEvent (unchanged) | mitigate | UI flag is not the gate: existing DAL `deleteWearEventForOwner(user.id, id)` owner-scoped SELECT returns uniform 'Wear not found' for cross-user ids; this plan makes no server/DAL changes (acceptance criterion asserts it) |
| T-QK-csl-02 | Information Disclosure / Spoofing | WearCard canDelete | mitigate | canDelete derived only in page.tsx from `wear.userId === viewerId`; never inferred client-side; WearCard forces false for bottom-sheet variant so stories lane cannot surface it even if a future caller passes true |
| T-QK-csl-03 | Denial of Service (accidental destructive action) | WearOverflowMenu delete item | mitigate | Item is last, below a separator, destructive-styled, and only opens a confirmation dialog; pending guard blocks double-submit and closing mid-delete |
</threat_model>

<verification>
- `npx vitest run tests/components/wear/` green.
- `npm run build` exit 0 (authoritative gate).
- Grep gates in both tasks' acceptance criteria pass.
- Local-dev walk documented as PENDING operator step in SUMMARY (CLAUDE.md Local-First Development).
</verification>

<success_criteria>
- Owner on /wear/[id]: Delete wear is the last overflow-menu item and opens the existing confirmation flow; delete + toast + replace to /u/<username>/worn unchanged.
- Non-owner on /wear/[id] and anyone on /wears/[username]: no Delete wear item (tested, including after menu open).
- No standalone delete button; WearDeleteButton removed with no dangling imports.
- No changes to Server Action behavior, DAL, or WearsLane.
</success_criteria>

<output>
Create `.planning/quick/260913-csl-move-delete-wear-into-wear-overflow-menu/260913-csl-SUMMARY.md` when done
</output>
