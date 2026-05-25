---
phase: 56A-wear-view-unification
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/wear/WearOverflowMenu.tsx
  - src/components/wear/WearCommentHost.tsx
  - src/components/wear/WearCard.tsx
autonomous: true
requirements: [SC-4]
must_haves:
  truths:
    - "There is exactly ONE shared WearCard component rendered by both routes; LikeButton (already shared) and one WearCommentHost are folded in (D-12, SC-4)"
    - "WearCard renders the engagement row with a comment trigger (left) + LikeButton (right) in both 'bottom-sheet' and 'inline' comment-host variants (D-10, D-11)"
    - "The overflow '…' menu always shows Copy link (D-01) and conditionally shows Add to wishlist only when showAddToWishlist is true (D-08, D-09)"
    - "Add to wishlist preserves the double-submit guard (pending OR status==='added' blocks re-submit) (D-08 / WR-03)"
    - "The comment host body is an empty placeholder ('No comments yet.') with full chrome (bottom-sheet open/close/swipe-pause hook + inline section) — Phase 57 drops the real component in (D-10)"
  artifacts:
    - path: "src/components/wear/WearCard.tsx"
      provides: "Shared wear-content card: photo layer + overlays + engagement row + overflow menu + comment host (D-12)"
      contains: "export function WearCard"
    - path: "src/components/wear/WearCommentHost.tsx"
      provides: "Comment host shell — bottom-sheet variant + inline variant, empty placeholder body (D-10)"
      contains: "export function WearCommentHost"
    - path: "src/components/wear/WearOverflowMenu.tsx"
      provides: "Overflow '…' menu — Copy link (always) + Add to wishlist (gated by showAddToWishlist) (D-01/D-08/D-09)"
      contains: "export function WearOverflowMenu"
  key_links:
    - from: "src/components/wear/WearCard.tsx"
      to: "src/components/shared/LikeButton.tsx"
      via: "engagement row renders <LikeButton target={{type:'wear',id:wearEventId}} />"
      pattern: "LikeButton"
    - from: "src/components/wear/WearOverflowMenu.tsx"
      to: "src/app/actions/wishlist.ts:addToWishlistFromWearEvent"
      via: "Add to wishlist menu item calls the relocated server action"
      pattern: "addToWishlistFromWearEvent"
    - from: "src/components/wear/WearCard.tsx"
      to: "src/components/wear/WearCommentHost.tsx"
      via: "renders WearCommentHost with variant from commentHostVariant prop"
      pattern: "WearCommentHost"
---

<objective>
Build the three shared components that both wear routes render (D-12): the extracted `WearCard` (one wear-content card), the `WearCommentHost` (comment host chrome with an empty Phase-57 placeholder body), and the `WearOverflowMenu` (the relocated share/add-to-wishlist "…" menu). This is the keystone of the phase — both `/wears/[username]` (Plan 03) and `/wear/[id]` (Plan 04) consume these.

Purpose: SC-4 requires the wear card, LikeButton, and comment host be single shared components with visual+behavioral parity — divergence limited to container chrome. Building the contracts first (interface-first ordering) means the two route plans implement against fixed props, not a scavenger hunt.

Output: Three new client components under `src/components/wear/`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/56A-wear-view-unification/56A-CONTEXT.md
@.planning/phases/56A-wear-view-unification/56A-PATTERNS.md
@.planning/phases/56A-wear-view-unification/56A-UI-SPEC.md

<interfaces>
<!-- Exact contracts the executor wires against. -->

WearCard props (the contract Plans 03 + 04 pass in — define this interface in WearCard.tsx):
```
interface WearCardProps {
  signedUrl: string | null        // null → hero fallback path
  watchImageUrl: string | null
  altText: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  createdAt: Date
  brand: string
  model: string
  watchId: string                 // brand/model → /watch/[watchId] link (already inside WearPhotoOverlays? no — see note)
  viewerId: string | null
  wearEventId: string
  initialLiked: boolean
  initialCount: number
  commentHostVariant: 'bottom-sheet' | 'inline'
  showAddToWishlist: boolean       // false on own wear / already-owned / already-wishlisted (D-09)
  permalinkUrl: string             // /wear/{wearEventId} (D-01)
}
```

From src/components/shared/LikeButton.tsx (unchanged — drop in):
```
<LikeButton viewerId={string|null} target={{type:'wear', id: wearEventId}} initialLiked={boolean} initialCount={number} />
// touch target min-h-[44px] min-w-[44px] already inside the button
```

From src/components/wear/WearPhotoClient.tsx (existing — WearCard wraps it for the signed-URL branch):
```
<WearPhotoClient signedUrl={string} altText brand model username displayName avatarUrl createdAt /> // 3-retry CDN state machine; renders WearPhotoOverlays internally; suppresses overlays during 'pending'
```
From src/components/wear/WearDetailHero.tsx (existing — WearCard wraps it for the no-signed-URL branch):
```
<WearDetailHero watchImageUrl brand model altText username displayName avatarUrl createdAt /> // watchImageUrl branch + no-photo placeholder; both render WearPhotoOverlays
export function WearPhotoOverlays({ username, displayName, avatarUrl, createdAt, brand, model, hasPhoto }) // brand/model bottom overlay has NO link today — link is added by WearCard's overflow/engagement layer, NOT here
```

From src/components/ui/sheet.tsx (existing — exports do NOT include SheetPortal/SheetOverlay):
```
export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }
// SheetContent side="bottom" already has slide-up/down animation + showCloseButton default true. Portal handled internally by SheetContent.
```

From src/components/ui/dropdown-menu.tsx (existing):
```
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, ... } // wraps @base-ui/react/menu
```

From src/app/actions/wishlist.ts (existing — relocated, NOT modified):
```
export async function addToWishlistFromWearEvent(data: unknown): Promise<ActionResult<{ watchId: string }>>
// expects { wearEventId: string } (zod .strict()); enforces three-tier visibility gate + revalidatePath('/') server-side
```

WearOverflowMenu props:
```
interface WearOverflowMenuProps {
  wearEventId: string
  permalinkUrl: string         // /wear/{wearEventId}
  showAddToWishlist: boolean
  onPhoto: boolean             // true → text-white trigger (over photo); false → text-foreground
}
```

WearCommentHost props:
```
interface WearCommentHostProps {
  variant: 'bottom-sheet' | 'inline'
  open?: boolean               // bottom-sheet: controlled open state lifted to WearCard
  onOpenChange?: (v: boolean) => void
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: WearOverflowMenu (Copy link + gated Add-to-wishlist)</name>
  <files>src/components/wear/WearOverflowMenu.tsx</files>
  <read_first>
    - src/components/ui/dropdown-menu.tsx (the primitive — confirm exported member names: DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator)
    - src/components/home/WywtSlide.tsx (the double-submit guard pattern at lines 30-44: useTransition + latched status 'idle'|'added'|'error', the WR-03 `if (pending || status === 'added') return` guard)
    - src/app/actions/wishlist.ts (the addToWishlistFromWearEvent contract — expects { wearEventId }, returns ActionResult<{watchId}>)
    - .planning/phases/56A-wear-view-unification/56A-PATTERNS.md (§ WearOverflowMenu — trigger button, menu items, double-submit guard + toast copy)
    - .planning/phases/56A-wear-view-unification/56A-UI-SPEC.md (§3 Overflow Menu — icon MoreHorizontal, copy strings, toast copy)
  </read_first>
  <action>
    Create `src/components/wear/WearOverflowMenu.tsx` as a `'use client'` component exporting `WearOverflowMenu` with the props in `<interfaces>` (wearEventId, permalinkUrl, showAddToWishlist, onPhoto).

    Trigger: `DropdownMenuTrigger` rendering a `MoreHorizontal` (lucide-react, `className="size-5"`) inside an inline-flex button with `min-h-[44px] min-w-[44px] inline-flex items-center justify-center`, `aria-label="More options"` (UI-SPEC §3 copy). Trigger text color: `onPhoto ? 'text-white' : 'text-foreground'` via cn().

    Menu (`DropdownMenuContent` align end): always render a "Copy link" `DropdownMenuItem` (D-01) with a `Link` icon (lucide-react `Link as LinkIcon`, size-4) whose onClick calls `navigator.clipboard.writeText(permalinkUrl)`. No toast for copy (silent is fine per PATTERNS.md). Copy string exactly "Copy link".

    Conditionally — only when `showAddToWishlist` is true (D-09) — render a `DropdownMenuSeparator` then an "Add to wishlist" `DropdownMenuItem` (copy exactly "Add to wishlist"). Wire the WR-03 double-submit guard from WywtSlide.tsx: `const [pending, startTransition] = useTransition()` and `const [status, setStatus] = useState<'idle'|'added'|'error'>('idle')`; the handler returns early `if (pending || status === 'added')`, then `startTransition(async () => { const result = await addToWishlistFromWearEvent({ wearEventId }); ... })`. On `result.success`: `setStatus('added')` and `toast('Added to wishlist')` (sonner). On failure: `setStatus('error')` and `toast('Could not add to wishlist. Try again.')` (exact UI-SPEC §Copywriting toast strings). Set the item `disabled={pending || status === 'added'}`.

    Import `toast` from 'sonner' and `addToWishlistFromWearEvent` from '@/app/actions/wishlist'. Use `cn` from '@/lib/utils' for the conditional text color.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -c "WearOverflowMenu" | grep -q "^0$" && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export function WearOverflowMenu" src/components/wear/WearOverflowMenu.tsx` returns one match
    - File contains `navigator.clipboard.writeText(permalinkUrl)` and the literal string `Copy link`
    - File contains `addToWishlistFromWearEvent({ wearEventId })` and the literal strings `Added to wishlist` and `Could not add to wishlist. Try again.`
    - The Add-to-wishlist block is wrapped in `{showAddToWishlist && (` (D-09 conditional)
    - File contains the WR-03 guard `if (pending || status === 'added') return`
    - Trigger button has `min-h-[44px]` and `min-w-[44px]` and `aria-label="More options"`
    - `npx tsc --noEmit` reports no errors referencing WearOverflowMenu.tsx
  </acceptance_criteria>
  <done>WearOverflowMenu renders Copy link always, Add to wishlist only when showAddToWishlist, preserves the double-submit guard, and uses the exact toast copy.</done>
</task>

<task type="auto">
  <name>Task 2: WearCommentHost (bottom-sheet + inline, empty placeholder)</name>
  <files>src/components/wear/WearCommentHost.tsx</files>
  <read_first>
    - src/components/ui/sheet.tsx (the bottom-sheet primitive — confirm `SheetContent side="bottom"`, SheetHeader, SheetTitle exports; note SheetPortal is NOT exported, so do not import it)
    - .planning/phases/56A-wear-view-unification/56A-UI-SPEC.md (§5 Bottom-Sheet Variant + §6 Inline Variant — exact classes, "Comments" title, "No comments yet." placeholder copy, separator)
    - .planning/phases/56A-wear-view-unification/56A-PATTERNS.md (§ WearCommentHost — both variant snippets + props interface)
  </read_first>
  <action>
    Create `src/components/wear/WearCommentHost.tsx` as a `'use client'` component exporting `WearCommentHost` with props `{ variant: 'bottom-sheet' | 'inline'; open?: boolean; onOpenChange?: (v: boolean) => void }`.

    When `variant === 'bottom-sheet'`: render `<Sheet open={open} onOpenChange={onOpenChange}>` with `<SheetContent side="bottom" className="max-h-[60vh] overflow-y-auto">`, a `<SheetHeader><SheetTitle>Comments</SheetTitle></SheetHeader>`, and the placeholder body `<p className="text-sm text-muted-foreground px-4 py-6 text-center">No comments yet.</p>`. Do NOT pass `showCloseButton={false}` (the default true gives the sheet's own X). This is the Phase-57 insertion seam — the `<p>` placeholder is the single point where Phase 57 drops the real comment component (D-10). Leave a comment `{/* Phase 57: shared comment component renders here */}` adjacent to the placeholder.

    When `variant === 'inline'`: render a `<section>` with `className="border-t border-border px-4 pt-4 pb-6 md:max-w-[600px] md:mx-auto"`, an `<h2 className="text-sm font-semibold text-foreground mb-3">Comments</h2>`, and the placeholder `<p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>`. Same Phase-57 comment seam marker. Expose a forwarded ref OR an `id="wear-comments"` on the section so the detail page's comment trigger can scroll to it (Plan 04 wires the scroll). Use `id="wear-comments"` for simplicity. (NOTE: PATTERNS.md's inline-variant snippet shows `ref={sectionRef}` — ignore that; use `id="wear-comments"`, which is sufficient for `scrollIntoView` and is what the acceptance criterion checks.)

    Import Sheet/SheetContent/SheetHeader/SheetTitle from '@/components/ui/sheet'. Do NOT import SheetPortal (not exported).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -c "WearCommentHost" | grep -q "^0$" && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export function WearCommentHost" src/components/wear/WearCommentHost.tsx` returns one match
    - File contains `side="bottom"` and `className="max-h-[60vh] overflow-y-auto"` for the bottom-sheet variant
    - Both variants contain the literal placeholder `No comments yet.`
    - The bottom-sheet variant title is exactly `Comments` via SheetTitle; the inline variant heading is exactly `Comments` via an h2
    - The inline `<section>` has `id="wear-comments"` and class `border-t border-border px-4 pt-4 pb-6 md:max-w-[600px] md:mx-auto`
    - File does NOT import `SheetPortal` (not exported by sheet.tsx)
    - A `Phase 57` comment marker appears adjacent to each placeholder body
    - `npx tsc --noEmit` reports no errors referencing WearCommentHost.tsx
  </acceptance_criteria>
  <done>WearCommentHost renders the bottom-sheet chrome and the inline section, both with an empty "No comments yet." body and a clearly marked Phase-57 insertion seam.</done>
</task>

<task type="auto">
  <name>Task 3: WearCard — shared content card (D-12)</name>
  <files>src/components/wear/WearCard.tsx</files>
  <read_first>
    - src/components/wear/WearPhotoClient.tsx (the signed-URL branch WearCard wraps — note it already renders WearPhotoOverlays internally and suppresses them during 'pending'; do NOT re-add overlays)
    - src/components/wear/WearDetailHero.tsx (the no-signed-URL branch + WearPhotoOverlays export; the photo container class string `relative w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto`)
    - src/components/shared/LikeButton.tsx (the LikeButton contract — viewerId, target {type:'wear',id}, initialLiked, initialCount; touch target already inside)
    - .planning/phases/56A-wear-view-unification/56A-PATTERNS.md (§ WearCard — directive/imports, props interface, photo container class, engagement-row stories vs detail variants)
    - .planning/phases/56A-wear-view-unification/56A-UI-SPEC.md (§1 Shared WearCard, §2 Engagement Row, §3 Overflow Menu position, §4 close affordance note)
    - src/components/wear/WearCommentHost.tsx + src/components/wear/WearOverflowMenu.tsx (the two components built in Tasks 1-2 that WearCard composes)
  </read_first>
  <action>
    Create `src/components/wear/WearCard.tsx` as a `'use client'` component exporting `WearCard` with the `WearCardProps` interface from `<interfaces>`. Define the interface in this file.

    Photo layer: branch exactly as the existing `/wear/[id]` page's `WearPhotoStreamed` does. When `signedUrl` is non-null, render `<WearPhotoClient signedUrl={signedUrl} altText brand model username displayName avatarUrl createdAt />`. When null, render `<WearDetailHero watchImageUrl brand model altText username displayName avatarUrl createdAt />`. Both already render `WearPhotoOverlays` internally — do NOT add a second overlay. Do NOT switch to next/image (Pitfall F-2 — the wrapped components already use native `<img>`).

    Overflow menu position: render `<WearOverflowMenu wearEventId={wearEventId} permalinkUrl={permalinkUrl} showAddToWishlist={showAddToWishlist} onPhoto={signedUrl !== null || watchImageUrl !== null} />` absolutely positioned `absolute top-3 right-3 z-20` over the photo (above the gradient scrims at z-10) — wrap the photo layer + overflow in a `relative` container so the absolute positioning anchors correctly (the photo container itself is already relative; place the overflow as a sibling inside an outer relative wrapper, OR inside the photo container — use the photo-container-relative anchor by wrapping photo layer in a `relative` div and rendering the menu as its child).

    Engagement row: comment-host-variant-driven.
    - When `commentHostVariant === 'bottom-sheet'` (stories): render the row with `className="flex items-center px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"`. Left slot: a comment trigger button — `aria-label="Open comments"`, `min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-white`, `MessageCircle` (lucide-react, size-5) — whose onClick sets a local `commentOpen` state true. `<div className="flex-1" />` spacer. Right slot: `<LikeButton viewerId target={{type:'wear', id: wearEventId}} initialLiked initialCount />`. Then render `<WearCommentHost variant="bottom-sheet" open={commentOpen} onOpenChange={setCommentOpen} />`.
    - When `commentHostVariant === 'inline'` (detail): render the row with `className="flex items-center px-4 py-3 border-t border-border md:max-w-[600px] md:mx-auto"`. Left slot: comment trigger button — `aria-label="View comments"`, `min-h-[44px] min-w-[44px] inline-flex items-center justify-center`, `MessageCircle size-5 text-muted-foreground` — whose onClick calls `document.getElementById('wear-comments')?.scrollIntoView({ behavior: 'smooth' })`. `<div className="flex-1" />`. Right slot: same LikeButton. Then render `<WearCommentHost variant="inline" />` below the row (no controlled state needed for inline).

    Manage `commentOpen` with `useState(false)` (only used by the bottom-sheet variant). Import LikeButton, WearCommentHost, WearOverflowMenu, WearPhotoClient, WearDetailHero, and `MessageCircle` from lucide-react.

    NOTE on swipe-pause: WearCard exposes the comment-open state to its parent so the lane can pause embla. Add an optional `onCommentOpenChange?: (open: boolean) => void` prop to WearCardProps; call it from the bottom-sheet trigger / sheet onOpenChange. The lane (Plan 03) uses this to drive `emblaApi.reInit({ watchDrag: !open })`. Document this prop in the interface.
  </action>
  <verify>
    <automated>npm run test -- WearCard</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export function WearCard" src/components/wear/WearCard.tsx` returns one match
    - File renders `<WearPhotoClient` (signed branch) and `<WearDetailHero` (fallback branch) — single shared photo layer, no inline next/image
    - `grep -c "next/image" src/components/wear/WearCard.tsx` returns 0 (Pitfall F-2)
    - File renders `<LikeButton` with `target={{ type: 'wear', id: wearEventId }}` (or equivalent inline object)
    - File renders `<WearOverflowMenu` and `<WearCommentHost`
    - The bottom-sheet engagement row contains `pb-[calc(0.75rem+env(safe-area-inset-bottom))]`; the inline row contains `border-t border-border md:max-w-[600px] md:mx-auto`
    - The inline comment trigger calls `getElementById('wear-comments')?.scrollIntoView`
    - WearCardProps includes `commentHostVariant`, `showAddToWishlist`, `permalinkUrl`, and `onCommentOpenChange?`
    - `npm run test -- WearCard` exits 0 (the Plan 01 RED scaffold for SC-4 + D-09 now passes)
  </acceptance_criteria>
  <done>WearCard is the single shared card: it wraps the existing photo layer, folds in LikeButton + WearOverflowMenu + WearCommentHost, supports both comment-host variants, and exposes comment-open state for swipe-pause. The Plan 01 WearCard RED scaffold turns green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client UI → addToWishlistFromWearEvent | The relocated server action is HTTP-callable; ownership/visibility gating must be server-side, not UI-hidden |
| client UI → LikeButton/toggleLikeAction | Existing Phase 56 control; unchanged |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-56A-04 | Elevation of Privilege | Add-to-wishlist abuse on an unauthorized wear (D-08/D-09) | mitigate | The relocated `addToWishlistFromWearEvent` already enforces the three-tier visibility gate + zod `.strict()` server-side (src/app/actions/wishlist.ts lines 89-118). D-09 UI hiding (`showAddToWishlist`) is a UX layer, NOT the security gate. The action is reused verbatim — no gate weakened. |
| T-56A-05 | Tampering | Double-submit creating duplicate wishlist rows | mitigate | WR-03 double-submit guard preserved verbatim from WywtSlide.tsx: `if (pending || status === 'added') return`. Asserted by Task 1 acceptance grep. |
| T-56A-06 | Information Disclosure | permalinkUrl exposing a non-public wear via Copy link | accept | permalinkUrl is `/wear/{wearEventId}`; the target route itself enforces the three-tier gate and returns notFound() for denied/missing (indistinguishable). Copying a URL does not bypass that gate. No new control. |
</threat_model>

<verification>
- `npm run test -- WearCard` exits 0 (Plan 01 SC-4 + D-09 scaffold passes)
- `npx tsc --noEmit` reports no new type errors in the three new files
- `grep -c "next/image" src/components/wear/WearCard.tsx` returns 0
</verification>

<success_criteria>
- WearCard, WearCommentHost, WearOverflowMenu exist as the single shared source for both routes (D-12, SC-4)
- The comment host body is an empty placeholder with the full open/close + inline chrome and a marked Phase-57 seam (D-10)
- Add-to-wishlist is gated by showAddToWishlist (D-09), Copy link always present (D-01), double-submit guard preserved (D-08)
</success_criteria>

<output>
After completion, create `.planning/phases/56A-wear-view-unification/56A-02-SUMMARY.md`
</output>
