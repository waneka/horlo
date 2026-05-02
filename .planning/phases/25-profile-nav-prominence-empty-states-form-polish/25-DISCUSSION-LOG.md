# Phase 25: Profile Nav Prominence + Empty States + Form Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 25-Profile Nav Prominence + Empty States + Form Polish
**Areas discussed:** Avatar dual-affordance & mobile, Empty-state CTAs per tab, URL-extract error taxonomy, Form feedback hybrid + pending audit

---

## Avatar Dual-Affordance & Mobile

### Q1: How should the avatar dual-affordance be structured visually?

| Option | Description | Selected |
|--------|-------------|----------|
| Avatar Link + small ChevronDown Button | Two adjacent hit targets in one rounded container — avatar to /u/{username}, chevron opens UserMenu | ✓ |
| Avatar Link only — dropdown via long-press / hover | Avatar primary Link; hover/long-press reveals dropdown | |
| Single Button — opens menu with 'View profile' as first item | Today's behavior + 'View profile' as dropdown item | |

**User's choice:** Avatar Link + small ChevronDown Button (Recommended)
**Notes:** Most discoverable; chevron is universal "there's more here" signal. Single-button does not satisfy NAV-13's literal "clicking the avatar navigates to /u/{username}".

### Q2: What does the avatar render as visually?

| Option | Description | Selected |
|--------|-------------|----------|
| Avatar image with initials fallback | <img src={avatarUrl}/> when set, initials in colored circle as fallback | ✓ |
| Initials only (today's behavior) | Keep 'TW' text Button | |
| Avatar image only — lucide User icon fallback | Image when set, generic silhouette icon otherwise | |

**User's choice:** Avatar image with initials fallback (Recommended)
**Notes:** Matches /u/{username} profile-page avatar; needs avatarUrl threading from Header → UserMenu.

### Q3: Where does the avatar land in SlimTopNav (mobile <768px)?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace Settings cog with avatar | Mobile right edge: Search · Bell · Avatar(+chevron); Settings stays in dropdown | ✓ |
| Add avatar; keep all 4 right-side icons | Search · Bell · Settings · Avatar(+chevron); risks cramped layout | |
| Replace Search icon — rely on bottom-nav Search slot | Bell · Settings · Avatar(+chevron); riskier user re-learning | |

**User's choice:** Replace Settings cog with avatar (Recommended)

### Q4: Where does the avatar live on DesktopTopNav (≥768px)?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace existing UserMenu trigger in-place | Same right-edge position, same dropdown, just dual-affordance | ✓ |
| Avatar to right of Bell as a new slot | Dedicated avatar slot with extra visual weight | |

**User's choice:** Replace existing UserMenu trigger in-place (Recommended)

---

## Empty-State CTAs per Tab

### Q1: What should the Wishlist empty-state CTA do?

| Option | Description | Selected |
|--------|-------------|----------|
| 'Add a wishlist watch' → /watch/new?status=wishlist | Reuse add-watch flow with status pre-set | ✓ |
| 'Add a wishlist watch' → /watch/new (no pre-fill) | Default status owned; user manually flips to Wishlist | |
| Open a smaller 'Quick add wishlist' dialog inline | Build new lightweight dialog | |

**User's choice:** /watch/new?status=wishlist (Recommended)

### Q2: What should the Worn empty-state CTA do?

| Option | Description | Selected |
|--------|-------------|----------|
| 'Log a wear' → opens existing WywtPostDialog | Reuses canonical photo+note+visibility flow | ✓ |
| 'Log today's wear' → opens LogTodaysWearButton picker | Lighter no-photo flow; loses 'first wear' celebration | |
| Two CTAs side-by-side: with photo + without photo | Violates 'single primary CTA' criterion | |

**User's choice:** WywtPostDialog (Recommended)

### Q3: What should the Notes empty-state CTA do?

| Option | Description | Selected |
|--------|-------------|----------|
| 'Add notes from any watch' — picker → /watch/{id}/edit#notes | Reuse WatchPickerDialog; threads to canonical notes-input | ✓ |
| 'Go to Collection' → /u/{username}/collection | Punt to user; two extra steps | |
| Suppress CTA when zero collection; show 'Add a watch first' | Conditional; covers edge case | |

**User's choice:** Picker flow (Recommended) — combined with Q5 conditional below.

### Q4: How does the Collection 'Add manually' fallback render when ANTHROPIC_API_KEY is unset?

| Option | Description | Selected |
|--------|-------------|----------|
| Two buttons: 'Add by URL' (disabled w/ tooltip) + 'Add manually' | Both visible; URL grayed when key missing | ✓ |
| Show only 'Add manually' when key missing; only 'Add a watch' when present | Hide unavailable; cleaner but less discoverable | |
| Always show 'Add a watch' — form handles missing-key case downstream | Defer key check to form; risk of friction at wrong moment | |

**User's choice:** Two buttons side-by-side (Recommended)

### Q5: What do non-owner viewers see when they visit a public profile and a tab is empty?

| Option | Description | Selected |
|--------|-------------|----------|
| Owner-aware copy + NO CTA buttons | Mirrors today's CollectionTabContent isOwner branch | ✓ |
| Same empty state as owner; CTAs are inert / route to viewer's own surface | Encourages engagement but conflates owner/viewer | |
| Hide empty state entirely; render blank tab | Confusing without context | |

**User's choice:** Owner-aware copy + NO CTAs (Recommended)

### Q6: Notes picker edge — viewer with zero watches in collection?

| Option | Description | Selected |
|--------|-------------|----------|
| Conditional CTA: zero → 'Add a watch first'; non-zero → picker | Branch on collection count via server-side prop | ✓ |
| Always show picker; picker shows its own empty state | Two-step UX feels janky | |
| Always route to /watch/new — skip picker entirely | Loses 'add notes to existing watch' affordance | |

**User's choice:** Conditional CTA (Recommended)

---

## URL-Extract Error Taxonomy

### Q1: Where does the error categorization happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Route handler maps caught errors to a category enum | Smallest diff; categorization at the boundary | ✓ |
| Throw typed errors from fetchAndExtract / extractWithLlm | Strongly typed; requires extractor refactor | |
| Categorize on the client in AddWatchFlow | Worst location; logic hidden in UI; harder to test | |

**User's choice:** Route handler (Recommended)

### Q2: What does 'structured-data-missing' mean?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-fail when extraction returns confidence='low' AND brand+model both null | Post-extract gate in route | ✓ |
| Only when ALL fields are null — partial extracts still 'succeed' | Stricter; misses garbage non-null without brand/model | |
| Only when LLM step throws 'No JSON found in LLM response' | Tight LLM coupling; brittle | |

**User's choice:** Brand+model both null gate (Recommended)

### Q3: What does 'quota-exceeded' map to?

| Option | Description | Selected |
|--------|-------------|----------|
| Anthropic API 429 ONLY | rate_limit_error / overloaded_error from SDK | ✓ |
| Anthropic 429 OR a future per-user / per-day cap | Reserve slot for both; out of scope | |
| Drop 'quota-exceeded' entirely from the 5-category list | Deviation from locked roadmap copy | |

**User's choice:** Anthropic 429 only (Recommended)

### Q4: Where does the categorized error display in AddWatchFlow?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace today's PasteSection error string with structured ErrorCard | New <ExtractErrorCard/> with category icon + recovery actions inline | ✓ |
| Sonner toast only | Loses persistent recovery affordance | |
| Replace entire AddWatchFlow with a full-page error | Too aggressive | |

**User's choice:** ExtractErrorCard (Recommended)

### Q5: Recovery copy per category

| Option | Description | Selected |
|--------|-------------|----------|
| Use proposed strings (locked) | host-403 / structured-data-missing / LLM-timeout / quota-exceeded / generic-network copy spelled out in CONTEXT D-15 | ✓ |
| Use these but defer wording polish to planner | Lock structure; planner refines wording | |
| User writes copy themselves later | Defer to post-discuss editing | |

**User's choice:** Use proposed strings (Recommended)

---

## Form Feedback Hybrid + Pending Audit

### Q1: What's the structure of the Sonner+aria-live hybrid?

| Option | Description | Selected |
|--------|-------------|----------|
| Sonner toast (3s auto-dismiss) + persistent inline banner with auto-dismiss after 5s | Both visible; banner stays slightly longer for a11y | ✓ |
| Sonner toast (3s) + persistent banner that stays until next interaction | Indefinite; can feel stale on navigate-back | |
| Sonner toast only; aria-live region is screen-reader-only | Loses visible inline confirmation for sighted users | |
| Inline banner only — no Sonner toast | Skip toast; less aligned with roadmap success criterion | |

**User's choice:** Toast + auto-dismissing banner (Recommended)

### Q2: How is the hybrid implemented?

| Option | Description | Selected |
|--------|-------------|----------|
| Shared <FormStatusBanner> + useFormFeedback() hook | Single source of truth; consistent UX; tested in one place | ✓ |
| Shared component, no hook — each form manages state inline | Less abstraction; risk of subtle drift | |
| Per-form inline implementation (no shared) | Fastest to write; hardest to keep consistent | |

**User's choice:** Shared component + hook (Recommended)

### Q3: Which Server Action surfaces get the hybrid?

| Option | Description | Selected |
|--------|-------------|----------|
| All Server Action submit forms across the app | Satisfies 'across the app' literal reading | ✓ |
| Only the surfaces that today have NO success feedback | Conservative; smaller diff but inconsistent | |
| Only Settings tab forms + Profile edit + mark-all-read | Narrowest; doesn't cover watch add/edit | |

**User's choice:** All forms (Recommended)

### Q4: How does Mark all read get a pending state?

| Option | Description | Selected |
|--------|-------------|----------|
| Convert to Client Component using useFormStatus + <SubmitButton> | Idiomatic Next 16 pattern | ✓ |
| Wrap in Client Component using useTransition + manual call | Same outcome, more code | |
| Leave as-is — server-action form without pending state | Doesn't satisfy UX-07 | |

**User's choice:** useFormStatus (Recommended)

### Q5: ProfileEditForm dialog edge case

| Option | Description | Selected |
|--------|-------------|----------|
| Toast only — hybrid banner skipped because dialog dismounts | Pragmatic carve-out; document in shared hook | ✓ |
| Keep dialog open briefly to show banner; auto-close after 1.5s | Awkward UX | |
| Don't auto-close; user dismisses dialog manually | Adds friction | |
| Render inline banner on parent profile page after dialog closes | Plumbing complexity for marginal a11y gain | |

**User's choice:** Toast only with documented carve-out (Recommended)

---

## Claude's Discretion

User accepted all recommended options across all four areas — no "you decide" handoffs. Claude/planner has discretion on:

- Empty-state copy wording (rough drafts in CONTEXT.md; final tightening in plan-phase)
- Lucide icon choice per error category (D-14 lists suggestions: Lock / FileQuestion / Clock / Gauge / WifiOff)
- AddWatchCard's two-button layout direction (horizontal vs vertical) — depends on container width
- Button styling (primary/outline) for empty-state CTAs — match existing Cards
- Whether `useFormFeedback` exposes results as values or callbacks — pick whichever tests cleanest
- Scroll-anchor mechanism for `/watch/{id}/edit#notes` (CSS `scroll-margin-top` vs `useEffect` scrollIntoView)
- Whether to convert existing `toast.success`-only forms (`EmailChangeForm`, `PasswordReauthDialog`) to the hybrid hook — D-18 includes them but D-19 dialog carve-out may apply

## Deferred Ideas

- Per-user / per-day URL-extract usage cap (under D-13) — quota-exceeded category currently only fires on Anthropic 429
- Avatar redesign on `/u/{username}` profile pages — only NAV avatar is touched
- `<FormStatusBanner>` extension into a generic `<StatusBanner>` for non-form contexts
- `StatusToastHandler` (hash-routed toasts) refactor to use `useFormFeedback` — orthogonal, leave as-is
- Investigate whether `.planning/debug/no-escape-from-manual-entry.md` is closed by D-09's manual fallback after this phase ships
