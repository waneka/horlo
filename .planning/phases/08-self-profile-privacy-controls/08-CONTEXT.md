---
phase: 08-self-profile-privacy-controls
type: context
created: 2026-04-20
requirements: [PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06, PROF-07, PROF-10, PRIV-01, PRIV-02, PRIV-03, PRIV-04, PRIV-05, PRIV-06]
design_source: Figma (mobile Settings, desktop Profile Collection/Worn/Stats/Notes tabs); user-provided dark-mode calendar screenshot
---

## Phase Goal

A collector can view and edit their own full profile page at `/u/[username]/[tab]` and control exactly what other users can see via the Settings page.

## Decisions

### Architecture

**D-01: Routing**
- Profile: `/u/[username]/[tab]` server routes (App Router dynamic segments)
- Default redirect: `/u/[username]` → `/u/[username]/collection`
- Tabs: `collection | wishlist | worn | notes | stats`
- **Why:** Server routes give shareable deep links and native back/forward navigation. App Router pattern.

**D-02: Settings location**
- Desktop: `/settings` route (full page, not modal)
- Mobile: same `/settings` route, full-width screen layout
- **Why:** Easier to deep-link to specific privacy toggles, more room for future settings expansion.

**D-03: Home page (`/`) preserved**
- `/` remains the user's private dashboard (existing collection view)
- `/u/[me]` is the public-facing version
- Phase 10 will introduce the activity feed at `/`
- **Why:** No breaking change to existing UX until the feed exists.

**D-04: Mobile + desktop responsive in this phase**
- Both viewports built simultaneously per Figma designs
- Reuses existing dark mode (already supported app-wide); color palette tweaks deferred
- **Why:** Splitting mobile across phases means revisiting components twice.

### Profile Content

**D-05: Profile header**
- Username (large), bio, inline stats (followers · following · watches · wishlist), taste tag pills, avatar accent on left
- Avatar: URL field only, no upload (per PROF-07)
- Editable: display name, avatar URL, bio
- **Why:** Matches Figma. Upload requires separate storage phase (Vercel Blob or Supabase Storage).

**D-06: Taste tags (PROF-10) — rule-based, server-derived**
- Generated from collection composition, capped at **3 tags max**
- Rules:
  - `Vintage Collector` if >40% watches have `productionYear < 2000`
  - `{Brand} Fan` if any single brand >30% of collection (e.g., "Omega Fan", "Rolex Collector")
  - `Sport Watch Collector` if `roleTags` contains "sport" >50%
  - `Dress Watch Lover` if `roleTags` contains "dress" >50%
  - `Diver` if `roleTags` contains "dive" >40%
  - `Daily Rotator` if avg wear events / week > 5
- No ML, no similarity engine yet
- **Why:** Deterministic, explainable, ships fast. Can evolve in later phase.

### Tabs

**D-07: Collection tab (PROF-02)**
- 4-col desktop grid, 1-col mobile
- Watch cards: image, brand, model, single style/role tag pill, "Last worn X ago"
- Status badges (top-left of image): "Worn today" (brown solid), "Not worn recently" (white pill, shadow)
- Filter chips: "All / Sport / Dress / Dive" (derived dynamically from `roleTags` in collection, not hardcoded)
- Search input on far right
- "+ Add Watch" card at end of grid — **only on own profile**, hidden when viewing others

**D-08: Wishlist tab (PROF-03)**
- Reuse Collection card layout
- Filter to watches with `status` in `('wishlist', 'grail')`
- Show target price + notes prominently per requirement

**D-09: Worn tab (PROF-04) — Timeline + Calendar toggle**
- Toggle pill switches between "Timeline" and "Calendar" views
- Per-watch filter dropdown ("All watches" default)
- "+ Log Today's Wear" prominent CTA (writes to `wear_events` via existing `markAsWorn` action)
- **Calendar view:** week-grid layout (Sun–Sat header), each day cell shows watch image if worn, empty if not
- **Timeline view:** chronological list of wear events grouped by day, most recent first
- Data source: `wear_events` table (Phase 7)

**D-10: Notes tab (PROF-05)**
- List of all watches that HAVE a non-empty `notes` field
- Each row: thumbnail, brand, model, full note text, **per-note visibility pill (Public/Private)**, "X days ago" timestamp, 3-dot menu
- See D-13 for per-note visibility data model

**D-11: Stats tab (PROF-06)**
- 2-col grid (desktop) / 1-col (mobile) of cards:
  - **Most Worn** — top 3 watches by wear count (thumbnails + count)
  - **Least Worn** — bottom watches by wear count
  - **Style Distribution** — horizontal bar chart with percentages (derived from `styleTags`)
  - **Role Distribution** — horizontal bar chart with percentages (derived from `roleTags`)
- Full-width below: **Collection Observations** — bulleted insights
  - Style lean (e.g., "leans heavily toward sport watches (50%)")
  - Most-worn brand frequency
  - Neglected watches ("X is due for some wrist time — hasn't been worn in N days")
  - Most active wearing day (derived from `wear_events.worn_date` weekday)
  - Rotation pattern ("rotate between N watches regularly")
  - Movement consistency ("All your watches use automatic movements")
- Reuse logic from existing `/insights` page where applicable; add wear_events aggregations

### Privacy

**D-12: Privacy controls scope (Phase 8)**
- Build only the **4 PRIV requirements** as functional toggles in Settings:
  - PRIV-01: Profile visibility
  - PRIV-02: Collection visibility
  - PRIV-03: Wishlist visibility
  - PRIV-04: Worn visibility
- Plus **Notes visibility default** dropdown (see D-13) for the per-note model
- Build the rest of the Settings page structure as designed (Appearance, Notifications, Data Preferences, Account sections) but **only the 4 PRIV toggles + Notes default are functional this phase**
- Other sections show as designed but disabled / "Coming soon" or hidden
- **Why:** Stays in scope; rest is its own polish phase.

**D-13: Per-note visibility — extend `watches` schema (Option A)**
- Add `notes_public: boolean default true` column to `watches` table
- Add `notes_updated_at: timestamp` column to `watches` table (separate from `updated_at` so editing brand/model doesn't bump the note timestamp)
- Settings includes "New Note Visibility" dropdown that sets the default for new notes (matches Figma)
- Per-note pill toggles `notes_public` directly
- **Why:** Matches Figma intent. Simpler than splitting into a separate `notes` table; no complex history needed for MVP.

**D-14: Locked private profile state (PRIV-06) — Letterboxd pattern**
- When viewing a private profile (`profile_settings.profile_public = false`) AND viewer is not the owner:
  - Show: avatar, username, bio, follower/following counts, **Follow button** (button is here for Phase 9)
  - Hide: watches/wishlist/worn/notes/stats counts and all tab content
  - Replace tab area with: lock icon + "This profile is private" message
- Owner always sees their own profile fully (regardless of own privacy settings)

**D-15: Privacy enforcement — RLS + DAL (PRIV-05)**
- RLS policies on `wear_events`, `activities`, plus existing tables: read access conditioned on the owner's `profile_settings` flags AND the viewer's identity
- DAL functions also check visibility before returning rows (defense in depth)
- A direct DB query with a foreign user's token cannot read private rows
- **Why:** Belt-and-suspenders — RLS handles untrusted clients, DAL handles bugs/regressions and provides clearer error semantics.

## Out of Scope (deferred)

- Avatar image upload (URL only this phase)
- Notifications functionality (UI in Settings is non-functional)
- Data Preferences (Download Data, Export Collection) — non-functional
- Account section (Change Password, Blocked Users, Delete Account) — non-functional
- "Show Collection Value" / "Activity Status" / generic "New Watch Visibility" toggles
- Theme toggle UI (already supported app-wide; toggle UI not in Phase 8)
- Follow button functionality (button rendered for Phase 9; non-functional this phase)
- Common Ground taste overlap (Phase 9)
- Activity feed (Phase 10)

## Design Tokens (from Figma)

- Brand text: `#2b1f14` (dark warm brown)
- Body muted: `#6b5d4f`
- Active toggle/accent: `#8b6f47`
- Inactive toggle: `#d4b896`
- Card border: `rgba(139,111,71,0.15)`
- Background: `#fefdfb` warm white
- Destructive: `#c44536` (e.g., Delete Account)
- Font: IBM Plex Sans (already in project)
- Card radius: 12px; dropdown radius: 6px

Note: project already supports light/dark via existing theming. New components must respect both modes; user will refine palette tokens later.

## Open Questions for Researcher

- How are existing `watches` filter/sort utilities organized? Reuse for tab filtering.
- What's the existing pattern for tab navigation in this codebase (if any)?
- Best approach for the Calendar view in React 19 / Next.js 16 — build custom or library? (Avoid pulling in heavy date libs if possible.)
- How should `taste_tags` be cached/recomputed? On-demand server component, or a derived view/materialized?
