---
slug: button-nativebutton-warning
status: resolved
trigger: |
  Base UI Button console error: "A component that acts as a button expected a
  native <button> because the nativeButton prop is true." Triggered by
  WishlistTabContent.tsx:67 rendering <Button render={<Link/>}>. Suspected root
  cause: src/components/ui/button.tsx wraps Base UI ButtonPrimitive which
  defaults nativeButton=true; when callers pass render={<Link/>} (an <a>),
  native button semantics are lost. Same pattern at ProfileSection.tsx:55,
  CollectionTabContent.tsx:120, NoteRow.tsx:96, NotesTabContent.tsx:57.
created: 2026-05-15
updated: 2026-05-15
---

# Debug Session: button-nativebutton-warning

## Symptoms

- **Expected behavior:** `<Button render={<Link href=... />}>` renders an
  anchor with no console warnings; button styling/variants still apply.
- **Actual behavior:** Console Error from Base UI: "A component that acts as a
  button expected a native <button> because the `nativeButton` prop is true.
  Rendering a non-<button> removes native button semantics, which can impact
  forms and accessibility."
- **Error messages:** See trigger. Stack: Button (src/components/ui/button.tsx:50)
  → WishlistTabContent (src/components/profile/WishlistTabContent.tsx:67) →
  ProfileTabPage (src/app/u/[username]/[tab]/page.tsx:247).
- **Timeline:** Surfaced on the profile wishlist tab (owner, empty state).
- **Reproduction:** Visit `/u/{username}/wishlist` as the owner with an empty
  wishlist — the empty-state CTA `<Button render={<Link/>}>` triggers the error.

## Current Focus

- hypothesis: CONFIRMED — ui/button.tsx forwarded no `nativeButton` value, so
  Base UI's default `nativeButton=true` applied even when `render` swapped in
  an `<a>` element.
- next_action: resolved
- reasoning_checkpoint: Base UI NativeButtonProps declares `nativeButton`
  default as `true`. When render={<Link>} is passed, Link renders an `<a>` not
  a `<button>`, violating the nativeButton=true expectation.
- tdd_checkpoint:

## Evidence

- timestamp: 2026-05-15T00:00:00Z
  source: node_modules/@base-ui/react/utils/types.d.ts
  finding: >
    NativeButtonProps.nativeButton defaults to true. Docs say: "Set to false
    if the rendered element is not a button (e.g. <div>)." Button.d.ts extends
    NativeButtonProps, so ButtonPrimitive inherits this default.

- timestamp: 2026-05-15T00:00:00Z
  source: src/components/ui/button.tsx (original)
  finding: >
    Button wrapper passed all props via spread (...props) but never extracted
    or set nativeButton. Result: ButtonPrimitive always received nativeButton=true
    (the Base UI default), even when callers passed render={<Link>}.

- timestamp: 2026-05-15T00:00:00Z
  source: grep across src/
  finding: >
    Five call sites pass render={<Link>} to our Button wrapper:
    WishlistTabContent.tsx:70, CollectionTabContent.tsx:120,
    NotesTabContent.tsx:57, NoteRow.tsx:96, ProfileSection.tsx (settings):55.
    All affected by the same root cause.

## Eliminated

- Caller-side fix (adding nativeButton={false} at every call site): rejected
  as too fragile — future callers would repeat the mistake. Wrapper-level fix
  is the correct single-responsibility boundary.

## Resolution

- root_cause: >
    src/components/ui/button.tsx spread all props onto ButtonPrimitive without
    ever setting nativeButton. Base UI ButtonPrimitive defaults nativeButton to
    true. When render={<Link>} is passed, Link renders an <a> element, which
    does not satisfy the nativeButton=true contract, producing the console error
    and degrading accessibility semantics.

- fix: >
    In src/components/ui/button.tsx, destructure render and nativeButton from
    props explicitly. Compute resolvedNativeButton = nativeButton ?? (render !==
    undefined ? false : true). Pass resolvedNativeButton and render explicitly
    to ButtonPrimitive. This makes the wrapper self-correcting: any render prop
    automatically sets nativeButton=false unless the caller explicitly overrides.

- verification: >
    `npx tsc --noEmit` reports no errors in src/components/ui/button.tsx.
    All five call sites (WishlistTabContent, CollectionTabContent, NotesTabContent,
    NoteRow, settings/ProfileSection) are fixed without any changes at those
    call sites. Callers that do NOT pass render continue to get nativeButton=true
    (correct for a real <button>).

- files_changed:
    - src/components/ui/button.tsx
