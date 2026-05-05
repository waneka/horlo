# Phase 28: Add-Watch Flow & Verdict Copy Polish - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Three coordinated changes that make the Add-Watch loop coherent end-to-end:

1. **UX-09 — Success toast with profile-tab CTA-link variant.** Every Add-Watch entry-point commit (AddWatchFlow Wishlist commit, AddWatchFlow Collection commit / WatchForm submit, /search row 3-CTA Wishlist commit, /catalog/[id] 3-CTA Wishlist commit) fires a success toast that includes a `View →` link to the user's profile collection or wishlist tab — *unless* the post-commit page already equals that destination tab, in which case the toast is suppressed entirely. Implementation: extend `useFormFeedback` and the toast emitter (NOT the FormStatusBanner).

2. **ADD-08 — Return-to-entry-point on Add-Watch commit.** Every callsite that links into `/watch/new` appends `?returnTo={encodeURIComponent(pathname + search)}`. The /watch/new page validates that value against an open-redirect-safe syntactic guard plus a self-loop guard, threads the validated value through AddWatchFlow, and routes the user to it on commit (Wishlist commit OR Collection/manual-entry WatchForm commit). When `returnTo` is null, both commit paths default to `/u/{username}/{matching-tab}` (collection for owned/sold, wishlist for wishlist/grail). Skip / in-flow Cancel / WishlistRationalePanel Cancel stay as today.

3. **FIT-06 — Verdict copy rewrite + speech-act split.** All 6 `DESCRIPTION_FOR_LABEL` strings are rewritten (verb-led sentences, neutral-to-positive tone, accurate to each label's similarity-engine semantic). Each of the 12 `TEMPLATES` entries gains a parallel `rationaleTemplate` slot in 1st-person user-self voice ("I want this even though…"); a new `RATIONALE_FOR_LABEL` table mirrors `DESCRIPTION_FOR_LABEL` for the low-confidence fallback path. The verdict bundle gains a parallel `rationalePhrasings: string[]` array filled by composer. `WishlistRationalePanel.defaultRationale()` is rewired to read `rationalePhrasings[0]` instead of `contextualPhrasings[0]`, making the auto-fill source intentional rather than incidental.

**In scope:** Sonner action-slot wiring on `useFormFeedback`; `?returnTo=` capture at every Add-Watch entry callsite; allow-list validation at /watch/new server entry; entry-point routing on AddWatchFlow Wishlist commit + WatchForm post-submit; suppress-toast rule when destination matches; full DESCRIPTION_FOR_LABEL rewrite (all 6 labels); rationaleTemplate slot on all 12 TEMPLATES; new RATIONALE_FOR_LABEL fallback table; verdict bundle type extension (`rationalePhrasings: string[]`); composer parallel-fill; WishlistRationalePanel auto-fill source switch.

**Out of scope:**
- Capturing `pricePaid` / `targetPrice` during the Add-Watch flow (carried over from Phase 27 deferred — needs its own phase / requirement).
- Reorder UX on the Collection tab (deferred from Phase 27).
- FormStatusBanner CTA-link variant (banner stays terse "Saved"; the four Phase 28 commit sites either don't mount the banner or unmount mid-nav).
- Re-architecting the Add-Watch state machine, the rail, or any of the 8 stay-mounted forms that already use `useFormFeedback`.
- Verdict template predicate changes — this is pure copy + new fields, no behavior change in which templates fire.
- The Outlier label's underlying similarity-engine semantic (only the user-facing copy changes).

</domain>

<decisions>
## Implementation Decisions

### UX-09 — Success Toast & CTA-Link Variant

- **D-01:** Toast CTA copy = literal `"View"` (chevron `→` is iconographic, not part of the label). Sonner's action slot renders as a button; copy is the button label.
- **D-02:** CTA destination = `/u/{username}/wishlist` when the new watch's status ∈ {`wishlist`, `grail`}; `/u/{username}/collection` when status ∈ {`owned`, `sold`}. Username resolved from the current viewer's profile (already loaded server-side in /watch/new and the search/catalog Server Components).
- **D-03:** Toast renders via Sonner's built-in `action: { label, onClick }` slot — NOT custom JSX inside `toast.success(<>…</>)`. Action slot gives accessibility + theming for free.
- **D-04:** `useFormFeedback` extends additively. New optional field on the `run()` opts: `successAction?: { label: string; href: string }`. Existing 8+ callers stay unchanged. The hook itself imports `useRouter` from `next/navigation` and wires `onClick: () => router.push(href)` internally — callers pass declarative `{ label, href }`, not imperative onClick.
- **D-05:** **Suppress-toast rule.** When `successAction.href` (resolved to its absolute path form) equals the path the user will land on post-commit, fire NO toast and pass NO action. Practically:
  - AddWatchFlow Wishlist commit / WatchForm Collection commit on `/watch/new`: post-commit landing = `returnTo ?? defaultDestination`. If that equals `/u/{username}/{matching-tab}`, suppress.
  - /search row Wishlist commit and /catalog/[id] Wishlist commit: stay on /search and /catalog/[id] respectively, so post-commit page never matches the destination tab — toast always fires here.
- **D-06:** Path comparison for the suppress rule normalizes trailing slashes only. `/u/me/wishlist` vs `/u/{actualUsername}/wishlist` is NOT considered equivalent — the planner should resolve `/u/me` to the canonical username at capture time so the comparison is apples-to-apples. (See `WishlistGapCard.tsx:24` for the existing `/u/me/...` shorthand pattern that needs canonicalization on capture.)
- **D-07:** `FormStatusBanner` does NOT get a CTA variant. Phase 25 default copy ("Saved" / "Could not save…") stays locked. The four Phase 28 commit sites either don't mount the banner (inline 3-CTA paths) or unmount the form mid-nav (AddWatchFlow + WatchForm on commit), so banner-CTA mirroring is moot. UI-SPEC §"FormStatusBanner Component Contract" + Anti-Pattern #16 stay intact.

### ADD-08 — returnTo Capture & Routing

- **D-08:** `?returnTo=` is captured **at every entry-point callsite**, NOT inferred from `document.referrer`. Each Link/router.push that points at `/watch/new` appends `&returnTo={encodeURIComponent(window.location.pathname + window.location.search)}` (or the equivalent server-rendered href on Server Components). Pattern parallels the existing `?next=` capture in `FollowButton.tsx:71`.
- **D-09:** Entry-point callsites that need to start appending `?returnTo=` (planner enumerates exhaustively via grep — likely set):
  - Top-nav "Add a watch" Link (DesktopTopNav, SlimTopNav, BottomNav)
  - Profile empty-state CTAs on `/u/[username]/[tab]` (Phase 25 4-empty-state-CTAs)
  - /search row 3-CTA "Add to Collection" `router.push('/watch/new?catalogId=…&intent=owned')` in `WatchSearchRowsAccordion.tsx:104`
  - /catalog/[id] 3-CTA "Add to Collection" `router.push('/watch/new?catalogId=…&intent=owned')` in `CatalogPageActions.tsx:107`
  - WishlistGapCard / homepage CTAs that link to /watch/new
  - Any /explore CTAs that route to /watch/new
- **D-10:** Server Components linking to `/watch/new` need to either (a) move to a Client component that reads `usePathname()` to set returnTo, or (b) skip returnTo (rare path — bottom-nav / global header CTA can fall back to D-13 default). Planner picks per callsite; (a) for high-value paths, (b) acceptable for header-style global CTAs since the default destination still routes the user to a sensible tab.
- **D-11:** Validation lives **server-side at `/watch/new`** (NOT in AddWatchFlow). Same shape as the existing intent / manual / status / catalogId whitelisting in `src/app/watch/new/page.tsx:50-70`. Two-stage validation:
  1. Syntactic guard (reuse the auth-callback regex): `/^\/(?!\/)[^\\\r\n\t]*$/` — must start with `/`, second char ≠ `/`, no backslash, CR, LF, or tab.
  2. Self-loop guard: reject if returnTo `startsWith('/watch/new')`. Prevents `?returnTo=/watch/new?returnTo=/watch/new...` infinite-trap vectors.
  Validated value flows into AddWatchFlow as a typed prop (`initialReturnTo: string | null`); invalid → null → default destination kicks in.
- **D-12:** AddWatchFlow holds `returnTo` in its existing `initialX` props pattern. The validated value is passed to handleWishlistConfirm and through to WatchForm so both commit paths can route to it. AddWatchFlow does NOT push it back into the URL bar — it's a one-way "where to go on commit" parameter, consumed by commit handlers.
- **D-13:** Default destination when `returnTo` is null = `/u/{username}/{matching-tab}` based on the new watch's status (same status→tab mapping as D-02). Both Wishlist commit and Collection/manual commit converge on this default. WatchForm's hardcoded `router.push('/')` at line 209 is replaced by the `returnTo ?? defaultDestination` resolution.
- **D-14:** Exit paths that route to `returnTo`: AddWatchFlow Wishlist commit (`handleWishlistConfirm` success branch, replaces `router.refresh + setState idle`), AddWatchFlow→WatchForm Collection commit (replaces line 209 `router.push('/')`), AddWatchFlow→WatchForm manual-entry commit (same code path). Exit paths that DO NOT change: Skip (rail loop), `← Cancel — paste a URL instead` (in-flow restart), `WishlistRationalePanel` Cancel (returns to verdict-ready). Browser back continues to handle "true exit without committing" naturally since /watch/new pushed onto history.
- **D-15:** Wishlist commit currently calls `router.refresh()` to bump `collectionRevision` so the verdict cache invalidates (Pitfall 3). With Phase 28's nav-on-commit, `router.refresh()` is no longer needed — the `router.push(returnTo ?? default)` + landing on a different page naturally re-fetches collectionRevision via the destination page's Server Component. Planner verifies this and removes the refresh call to avoid double-fetch.

### FIT-06 — Verdict Copy & Speech-Act Split

- **D-16:** All 6 `DESCRIPTION_FOR_LABEL` strings (`src/lib/verdict/templates.ts:130-137`) are rewritten — not just `outlier`. Direction: verb-led sentence, tonally neutral or positive, accurately captures the similarity-engine semantic, descriptive enough to convey what the label means. (Tone diagnosis: "unusual" reads dismissive; voice diagnosis: noun-phrase reads label-y; accuracy diagnosis: "unusual" doesn't capture distinct/contrasting; length diagnosis: 5 words gives no signal.) Same diagnoses don't apply equally to all 6 today (`role-duplicate` and `hard-mismatch` are already verb-led), but for cross-label voice coherence we rewrite all 6.
- **D-17:** Each entry in `TEMPLATES` (12 entries today, `src/lib/verdict/templates.ts:14-119`) gains a new field `rationaleTemplate: string`. Same `${slot}` interpolation grammar as `template`. Voice: 1st-person user-self statement of *why they want it*, parallel to the `template`'s system→user observation. Example pairing:
  - Existing template: `'Fills a hole in your collection — your first ${archetype}.'`
  - New rationaleTemplate (planner draft): `'My first ${archetype} — fills a real hole in what I own.'`
  Predicate is unchanged; same firing logic; composer fills both arrays in lockstep.
- **D-18:** New constant `RATIONALE_FOR_LABEL: Record<SimilarityLabel, string>` mirrors the existing `DESCRIPTION_FOR_LABEL`. Used by composer's low-confidence fallback (the `isFallback` branch at composer.ts:59) to fill `rationalePhrasings` when no Template fires. Same 6-label coverage.
- **D-19:** `VerdictBundleFull` type (`src/lib/verdict/types.ts:28`) gains a parallel field: `rationalePhrasings: string[]`. Same length and ordering as `contextualPhrasings`. Composer fills both inside the same loop; if a Template's predicate fires, both `template` and `rationaleTemplate` get filled and pushed in lockstep. Hedge prefix logic (`Possibly …` for confidence ∈ [0.5, 0.7)) applies to both arrays the same way.
- **D-20:** `WishlistRationalePanel.defaultRationale()` (`src/components/watch/WishlistRationalePanel.tsx:42-46`) is rewired to read `verdict.rationalePhrasings[0] ?? ''` instead of `verdict.contextualPhrasings[0] ?? ''`. The `framing === 'self-via-cross-user'` early-return-empty-string branch stays. The hint copy below the textarea ("Pre-filled from the fit verdict. Edit or clear as you like.") is updated to match the new voice — planner drafts.
- **D-21:** The 24+ specific copy strings (6 DESCRIPTION_FOR_LABEL + 12 rationaleTemplate + 6 RATIONALE_FOR_LABEL) are **drafted by the planner** in PLAN.md and **reviewed by the user during plan-check**. CONTEXT.md does not lock the literal strings — only the structural shape (which fields, which voice direction).
- **D-22:** Existing `composer.test.ts` assertions on the 4 roadmap-mandated templates (FIT-02 lock per Phase 20 D-01) MUST continue to pass. The new `rationaleTemplate` slot is additive — it does not change which templates fire, in what order, or under what predicates. New tests added for rationalePhrasings filling + lockstep ordering with contextualPhrasings.

### Claude's Discretion

- **Sonner action-slot rendering details** — the exact button styling that Sonner's action slot produces is theme-driven; any minor visual mismatch with the rest of the toast is planner-owned. If a custom variant is needed, that's a UI-SPEC decision but not a Phase 28 blocker.
- **Path canonicalization for the suppress-toast comparison** (D-06) — exact algorithm (e.g., resolve `/u/me/wishlist` → `/u/{actualUsername}/wishlist` using the viewer's username server-side; strip trailing `/`; lowercase nothing because the route is case-sensitive). Planner picks the implementation; the rule is "two strings match iff they refer to the same URL path."
- **Specific copy strings for D-16/D-17/D-18** — the planner drafts all 24+ strings in PLAN.md following the voice direction in D-16 (verdict) and D-17 (rationale). User reviews + refines during plan-check before any code lands.
- **Whether `router.refresh()` removal in D-15 introduces any verdict-cache races** — planner verifies the destination page's Server Component re-fetches `collectionRevision` cleanly. If a race exists, planner can keep `router.refresh()` and add a small delay or revalidatePath call.
- **Test-coverage shape for D-22** — exact test names + fixtures for the lockstep + rationale-fill cases are planner-owned. Constraint: do not regress existing FIT-02 lock tests.
- **Server Component → Client Component conversion choice (D-10)** — for each entry-point Link, planner decides whether to thread `usePathname()` via Client wrapper or fall back to default-destination behavior.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/REQUIREMENTS.md` §"Empty-State CTAs + Toast" (UX-09), §"Verdict Copy" (FIT-06), §"Add-Watch Flow" (ADD-08) — the three locked requirements for this phase
- `.planning/ROADMAP.md` §"Phase 28" — goal + 4 success criteria
- `.planning/PROJECT.md` — current product context (v4.1 Polish & Patch milestone)
- `.planning/STATE.md` — milestone status

### Add-Watch flow (UX-09 + ADD-08)
- `src/components/watch/AddWatchFlow.tsx` — flow orchestrator. `handleWishlistConfirm` (line 266) and the props-shape extension (line 46) are the primary edit sites. Pitfall 3 (`router.refresh`) is touched by D-15.
- `src/app/watch/new/page.tsx` — Server-Component-level whitelist for searchParams (line 50-70). New `returnTo` validation lands here.
- `src/components/watch/WatchForm.tsx` — Collection commit path. Line 209 `router.push('/')` is replaced per D-13/D-14.
- `src/components/watch/WishlistRationalePanel.tsx:42-46` — `defaultRationale()` source switch per D-20.
- `src/components/search/WatchSearchRowsAccordion.tsx:73-105` — search row 3-CTA: handleAddToWishlist (line 73, inline commit, gets toast+CTA), handleAddToCollection (line 103, navigates to /watch/new — gets `?returnTo=` appended).
- `src/components/watch/CatalogPageActions.tsx:65-113` — /catalog 3-CTA: handleWishlist (line 65, inline commit, gets toast+CTA), handleCollection (line 105, navigates to /watch/new — gets `?returnTo=` appended).

### Form feedback primitives (UX-09)
- `src/lib/hooks/useFormFeedback.ts` — primary edit site. New `successAction` opt + `useRouter` import + onClick wiring. Hook signature shape per D-04.
- `src/components/ui/FormStatusBanner.tsx` — read-only reference; D-07 explicitly does NOT modify this. Phase 25 UI-SPEC anti-pattern #16 stays in force.
- `src/components/ui/ThemedToaster.tsx` — Sonner mount + theme binding. Action-slot styling inherits from this.

### Open-redirect-safe path validation (ADD-08)
- `src/app/auth/callback/route.ts:60-61` — canonical regex `/^\/(?!\/)[^\\\r\n\t]*$/`. **Reuse this exact pattern** in /watch/new validation per D-11.
- `src/components/profile/FollowButton.tsx:65-73` — existing `?next=` capture pattern at a callsite. Mirror this shape for `?returnTo=` capture.

### Verdict copy (FIT-06)
- `src/lib/verdict/templates.ts` — primary edit site. Add `rationaleTemplate` to each TEMPLATES entry; rewrite DESCRIPTION_FOR_LABEL; add RATIONALE_FOR_LABEL.
- `src/lib/verdict/types.ts:28` — extend `VerdictBundleFull` with `rationalePhrasings: string[]`.
- `src/lib/verdict/composer.ts:42-85` — fill `rationalePhrasings` in lockstep with `contextualPhrasings`; mirror the fallback path at line 60.
- `src/lib/verdict/composer.test.ts` — existing 4-roadmap-template assertions must continue to pass per D-22.
- `src/lib/similarity.ts:340-379` — `getSimilarityDisplay()` also defines per-label description/text/color. Cross-check that this stays consistent with the rewritten `DESCRIPTION_FOR_LABEL` if both are surfaced; planner decides whether to consolidate or leave them parallel.

### Profile destination resolution (UX-09 + ADD-08)
- `src/components/layout/BottomNav.tsx:110-112` — pattern for resolving `/u/${username}/{tab}` from the viewer's username
- `src/data/profiles.ts:34` — `getProfileByUsername` (and existing `getProfileById` at line 48) for username resolution server-side
- `src/components/home/WishlistGapCard.tsx:24` — example of `/u/me/{tab}` shorthand that needs canonicalization for the suppress-toast comparison (D-06)

### Memory / decision pointers
- Memory: Phase 27 `27-CONTEXT.md` deferred-ideas section names "Add-Watch flow paid/target capture UX → Phase 28 candidate" — explicitly **NOT** folded into Phase 28 scope per the locked roadmap requirements list (UX-09 / FIT-06 / ADD-08 only). Documented for traceability; if user wants to fold, that's a roadmap edit.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Sonner action slot** — Sonner already mounted via `<ThemedToaster>` at the layout root, supports `toast.success(msg, { action: { label, onClick } })` natively. No new toast library needed.
- **`?next=` capture pattern** (`FollowButton.tsx:65-73`) — `encodeURIComponent(window.location.pathname)` shape. Reuse for `?returnTo=` at every entry-point callsite (D-08).
- **Auth-callback path-safety regex** (`auth/callback/route.ts:60-61`) — `/^\/(?!\/)[^\\\r\n\t]*$/`. Already battle-tested across `?next=`. Reuse verbatim for ADD-08 validation (D-11).
- **searchParams whitelist pattern** (`watch/new/page.tsx:50-70`) — strict literal-match for `intent`, `manual`, `status`, plus UUID regex for `catalogId`. The new `returnTo` validation slots into this same Server-Component-level pre-check shape.
- **`useFormFeedback` hook** — already used by 8+ stay-mounted forms. Additive `successAction` opt (D-04) keeps every existing caller untouched.
- **`getCurrentUser()` in /watch/new** (`page.tsx:42`) — Server Component already auth-loads the viewer. Username for the destination tab path is one Drizzle hop away via `getProfileById(user.id)`.

### Established Patterns
- **Add-Watch state machine has typed `initialX` props** (AddWatchFlow.tsx:46-63: `initialCatalogId`, `initialIntent`, `initialCatalogPrefill`, `initialManual`, `initialStatus`). New prop `initialReturnTo: string | null` follows the same shape; `/watch/new` validates and passes the typed value.
- **Pitfall 3 explicitness in AddWatchFlow** (line 38-44, comment at line 282-287): `router.refresh()` after Wishlist commit was a verdict-cache invalidation hack. With Phase 28's nav-on-commit, this is no longer needed — but the planner must verify the destination page's collectionRevision re-fetch path is clean.
- **Composer fallback** (`composer.ts:55-72`) — `isFallback` branch fires `[DESCRIPTION_FOR_LABEL[label]]` when confidence is null/<0.5. The new `rationalePhrasings` array needs the same fallback shape but using `RATIONALE_FOR_LABEL[label]` (D-18).
- **Lockstep arrays in composer** — `contextualPhrasings` is built by iterating TEMPLATES; the new `rationalePhrasings` builds in the same loop, same predicate, same hedge-prefix application. Index parity is the invariant: `rationalePhrasings[i]` is the rationale-voice version of `contextualPhrasings[i]`.

### Integration Points
- **`/watch/new` Server Component** (`page.tsx:39-92`) is the chokepoint for ADD-08 validation. Add returnTo whitelisting here; pass through to `<AddWatchFlow initialReturnTo={validatedReturnTo} />`.
- **Username resolution at /watch/new** — Server Component already loads `user`. Add `await getProfileById(user.id)` to obtain `username`; pass through to AddWatchFlow as `viewerUsername` so the suppress-toast rule (D-05) can resolve `/u/me/...` → `/u/{actualUsername}/...` for the comparison.
- **Verdict bundle producers** — there are two: `getVerdictForCatalogWatch()` Server Action and `getVerdictForOwnedWatch()` (or equivalent for self-via-cross-user). Both go through `composer.computeVerdictBundle()`. The new `rationalePhrasings` field appears uniformly because composer is the single emit point.
- **VerdictStep / CollectionFitCard read sites** — these display `contextualPhrasings`. They do NOT read `rationalePhrasings` — that field is consumed only by `WishlistRationalePanel.defaultRationale()`. No render-side changes outside that one helper.

### Pre-existing Constraints
- **Phase 25 UI-SPEC § FormStatusBanner Component Contract** locks default copy ("Saved" / "Could not save…"). D-07 says we don't touch the banner.
- **Phase 20 D-01 / FIT-02 lock** — the 4 roadmap-mandated templates' predicates and templates must remain operational. Phase 28 adds rationaleTemplate slots but does NOT change predicates or `template` strings of those 4 (only DESCRIPTION_FOR_LABEL and the new rationaleTemplate slots). composer.test.ts assertions stay green.
- **Pitfall 6** — `photoSourcePath` is NEVER set on URL-extract surface. Phase 28 doesn't touch the photo path; just noting for the planner that nav-on-commit doesn't change Pitfall 6 invariants.

</code_context>

<specifics>
## Specific Ideas

- **Toast suppression when destination matches entry point.** This was the user's key insight that reframed UX-09 from "always show toast+CTA" to "only show when there's somewhere new to go." The result: at AddWatchFlow's Wishlist commit, if returnTo (or default) lands on the destination tab, the user just sees their new watch in place — no redundant overlay. The CTA-toast remains valuable on `/search` and `/catalog/[id]` inline commits where the page doesn't change.

- **Speech-act split as the heart of FIT-06.** The user explicitly named this: "the verdict-to-user phrasing and the user's-own-note-about-why-they-want-it are different speech acts." The structural fix (rationaleTemplate on Templates + rationalePhrasings on the bundle) treats the two voices as parallel artifacts of the same predicate firing — same logic, two voices, lockstep arrays.

- **Browser back as the natural cancel.** User chose option 1 on B.2 ("commits only — rely on browser back for cancel"). Don't add an explicit "Done" button. The Skip + rail loop stays as today; users who want to truly exit hit browser back. Phase 28 doesn't introduce a new exit affordance.

- **Planner drafts copy.** User chose option 1 on D.4 — Phase 28 plan-check is the copy-review gate. Planner drafts ALL 24+ strings (6 DESCRIPTION_FOR_LABEL rewrites + 12 rationaleTemplate slots + 6 RATIONALE_FOR_LABEL fallbacks) in PLAN.md; user refines during plan-checker review before code lands. This is the standard pattern, not a heavyweight UAT gate.

- **`/u/me/...` shorthand canonicalization.** WishlistGapCard already uses `/u/me/wishlist`. The suppress-toast comparison (D-05/D-06) needs to resolve this to the actual username before path-equality. Planner owns the algorithm but the rule is locked: two paths match iff they refer to the same URL.

</specifics>

<deferred>
## Deferred Ideas

### Add-Watch flow paid/target price capture UX → carried over from Phase 27, NOT folded into Phase 28
Phase 27's CONTEXT.md flagged "Add-Watch flow paid/target capture UX → Phase 28 candidate" — but the locked Phase 28 requirements (UX-09 / FIT-06 / ADD-08) don't include it, and folding would expand scope mid-discuss-phase. If user wants this, it needs a new requirement (e.g., `ADD-09: Capture paid/target price during Add-Watch flow`) and either a roadmap edit (insert into Phase 28) or a new phase in v4.1 / v5.0.

### Other DESCRIPTION_FOR_LABEL strings as their own pass → bundled with FIT-06
Originally a "scope choice" gray area (Outlier-only vs all 6) — user picked all 6, so this is folded into Phase 28 (D-16). No deferral.

### FormStatusBanner CTA-link variant → deferred indefinitely
D-07 locks "no banner CTA in Phase 28." If a future phase has a stay-mounted form whose post-commit deserves a CTA-link affordance (none on the v4.1 roadmap), revisit. Phase 25 UI-SPEC anti-pattern #16 stays in force until then.

### Verdict copy template predicate audit → out of scope
Phase 28 only changes copy + adds rationaleTemplate slots. The 12 templates' predicates fire-or-don't logic is locked by Phase 20 FIT-02. If a label feels mis-fired (e.g., outlier triggers when user expected taste-expansion), that's a v5.0 Discovery North Star concern, not Phase 28.

### Document.referrer fallback for returnTo → rejected
Considered as the ADD-08 capture mechanism (B.1 option 2) but rejected — Referrer-Policy strips it, new-tab opens lose it, cross-origin masking varies. Callsite-explicit capture is more reliable and matches the existing `?next=` convention.

### Strict positive allow-list registry for returnTo → rejected
Considered as C.1 option 2. Horlo has no scary internal pages to protect against; the syntactic guard + self-loop guard cover the actual security threat. Strict registry would buy list-maintenance overhead with no incremental security gain.

### Pre-fill empty wishlist note → rejected
Considered as D.2 option 2 ("user writes their own"). User picked the rationaleTemplate slot approach — pre-fill stays, but the source becomes intentional (rationalePhrasings, not contextualPhrasings).

### `getSimilarityDisplay()` consolidation with `DESCRIPTION_FOR_LABEL` → planner-owned
`src/lib/similarity.ts:340-379` defines a parallel per-label description/text/color map. Phase 28 doesn't mandate consolidation; planner decides whether to keep parallel or merge. If they diverge after the rewrite (different copy on `/watch/[id]` vs the verdict bundle), that's a code-review item.

</deferred>

---

*Phase: 28-add-watch-flow-verdict-copy-polish*
*Context gathered: 2026-05-04*
