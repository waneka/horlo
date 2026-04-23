# Phase 14: Nav Shell + Explore Stub - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 14-nav-shell-explore-stub
**Areas discussed:** Wear cradle/notch, Nav destinations map, Search placeholder, DEBT-01 scope

---

## Gray Area Selection

User selected all four presented gray areas for discussion:

| Option | Description | Selected |
|--------|-------------|----------|
| Wear cradle/notch | NAV-02 — exact elevated Wear CTA visual treatment | ✓ |
| Nav destinations map | Where Insights/Preferences live after MobileNav retirement | ✓ |
| Search placeholder | What the search icon/input does before Phase 16 | ✓ |
| DEBT-01 scope | Verify vs re-implement given Phase 999.1 already shipped the fix | ✓ |

---

## Wear cradle/notch

### Initial question (rejected by user as "hard to follow — do you have the Figma reference?")
| Option | Description | Selected |
|--------|-------------|----------|
| True SVG cutout | Semi-circular cutout in the bar with a floating circle (Instagram/TikTok feel) | |
| Elevated circle (no cutout) | Flat bar + floating circle with shadow sitting half-above | |
| Inline larger Wear icon | No elevation, no cutout, just a bigger centered icon | |

**User response:** "your diagrams and descriptions were hard to follow. do you have the figma reference for design?"

### Resolution via Figma MCP (node 1:4714)

After pulling `get_screenshot`, `get_metadata`, `get_design_context`, and `get_variable_defs` on the user's active Figma selection, the cradle/notch question was answered directly by the spec:

- Container: 393 × 99.95px
- 4 non-Wear buttons at `top: 20`, `height: 60`; Wear button at `top: 0`, `height: 91.96` — so Wear extends ~20px above the bar top
- Wear inner circle: 56×56, `bg-[#5b8fb9]`, `shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)]`, watch icon 28×28 inside
- Non-Wear: 24×24 icons + 12/16 labels in IBM Plex Sans Medium
- Active color: `#5b8fb9` (Explore shown active, plus Wear label); inactive: `#8b9199`

**Decision:** Elevated circle (no cutout) — effectively option 2 from the rejected initial question, but with geometry locked by Figma rather than guessed at.

### Follow-up: accent color reconciliation
| Option | Description | Selected |
|--------|-------------|----------|
| Add brand-nav token | New scoped `--nav-accent` var; existing `--accent` (gold) unchanged | |
| Retheme global accent | Replace `--accent` globally with Figma teal | |
| Ignore Figma, use gold | Keep existing `--accent` warm-gold; defer palette work | ✓ |

**User's choice:** "we will update the color palette soon, ignore for now and use what we have."
**Notes:** Global palette update deferred to a future phase. Phase 14 uses existing `--accent` token.

### Follow-up: nav font
| Option | Description | Selected |
|--------|-------------|----------|
| Keep Geist | Render labels in existing Geist 12/16 medium | |
| Add IBM Plex Sans (nav-scoped) | Load IBM Plex Sans only for nav components via scoped CSS var | |
| Add IBM Plex Sans globally | Replace Geist sans with IBM Plex Sans across the whole app | ✓ |

**User's choice:** Add IBM Plex Sans globally.
**Notes:** Keep Geist Mono + Instrument Serif (existing uses). Replace Geist sans as the default body font.

---

## Nav destinations map

### Insights destination
| Option | Description | Selected |
|--------|-------------|----------|
| Inside Profile | Add Insights tab/section under /u/[me]/... | |
| Under Settings cog | Surface Insights via profile dropdown or settings | |
| Hide on mobile | No mobile entry point; desktop-only for now | |

**User's choice (free-text):** "what's the difference between insights and stats? i'm inclined to combine them potentially and i think insights is probably the better name."

### Clarification turn — Insights vs Stats
Claude explained the difference:
- `/insights` = owner-only, includes price/value + deal flags + sleeping beauties
- Profile Stats tab = public aggregate (Most/Least Worn, distribution charts, observations)
- Overlap: distribution charts, most-worn-type lists

### Follow-up: how to handle the overlap
| Option | Description | Selected |
|--------|-------------|----------|
| Defer merge, link from Profile | Keep /insights; add mobile entry via Profile; merge later | |
| Merge into Stats this phase | Retire /insights; Profile Stats becomes visibility-aware | |
| Defer merge, hide /insights on mobile | Desktop-only for now; mobile gets no Insights | |

**User's choice (free-text):** "ok we won't merge, let's make them separate tabs on user profile. insights is only shown to user, not public to followers"
**Notes:** Resolution is a hybrid — don't merge, but co-locate both as tabs. Insights tab is owner-only (not visible to followers or public).

### Follow-up: does /insights top-level route stay?
| Option | Description | Selected |
|--------|-------------|----------|
| Tab links to /insights | Profile Insights tab just navigates to existing /insights route | |
| Move content into tab, retire route | Content moves into profile tab segment; /insights redirects | ✓ |
| Tab renders /insights inline | Duplicate same content in two locations | |

**User's choice:** Move content into tab, retire route.
**Notes:** Cleaner URL structure; /insights redirects to the profile's Insights tab.

### Preferences destination
| Option | Description | Selected |
|--------|-------------|----------|
| Inside Settings | Link row in /settings that routes to /preferences | ✓ |
| Inside Profile | Preferences tab under /u/[me]/... | |
| Keep standalone | No nav entry; deep-link only | |

**User's choice:** Inside Settings.
**Notes:** Settings cog in slim top nav becomes the single entry point for both core settings and preferences.

---

## Search placeholder

| Option | Description | Selected |
|--------|-------------|----------|
| Link to /search stub | Phase 14 ships a /search coming-soon stub page; nav links to it | ✓ |
| Disabled visual | Mobile icon + desktop input rendered disabled; no route exists | |
| Hide until Phase 16 | Omit search chrome entirely until Phase 16 | |

**User's choice:** Link to /search stub.
**Notes:** Scope addition to Phase 14 beyond the ROADMAP wording — a `/search` stub page is added alongside the `/explore` stub. Phase 16 will rewrite the stub into the real search page without nav edits.

---

## DEBT-01 scope

| Option | Description | Selected |
|--------|-------------|----------|
| Verify + no-op note | Phase 14 plan includes a verification task; no new code | ✓ |
| Skip entirely | Drop DEBT-01 from Phase 14; update traceability silently | |
| Re-audit + hardening | Treat as open; add additional coverage | |

**User's choice:** Verify + no-op note.
**Notes:** Phase 999.1 already shipped the `role="alert"` banner + `isPending` "Saving…" hint in `PreferencesClient.tsx` L44-60. Phase 14 adds a small verification task that re-asserts the DEBT-01 acceptance criteria and updates REQUIREMENTS.md traceability. No new code.

---

## Claude's Discretion

Three gray areas not selected for explicit discussion; defaults locked in CONTEXT.md:
- **Profile dropdown composition (NAV-08)** — inline 3-button segmented Theme row inside the UserMenu dropdown; items = Profile, Settings, Theme, Sign out.
- **Explore stub content (NAV-11)** — minimal Sparkles icon + "Coming soon" copy; mirrors NotificationsEmptyState styling.
- **Auth-route hide mechanism (NAV-05)** — extract `PUBLIC_PATHS` from `proxy.ts` into `src/lib/constants/public-paths.ts`; client nav components use `usePathname()` against it.

User confirmed "I'm ready for context" — no further discussion requested on these items.

---

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section:
- Global accent palette update (Figma teal vs gold) — future design-system phase
- Insights/Stats unification into a single visibility-aware tab — future
- `/explore` feed content — beyond v3.0
- Desktop Preferences link keep-or-remove — planner's discretion
- Moving notification preferences inline to bell dropdown — future UX phase

---

*Discussion completed: 2026-04-23*
