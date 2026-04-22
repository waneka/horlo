# Phase 12: Visibility Ripple in DAL - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 12-visibility-ripple-in-dal
**Areas discussed:** DAL audit scope, worn_public lifecycle, Activity metadata backfill

---

## Gray Area Selection

**Question:** Which areas do you want to discuss for Phase 12?

| Option | Description | Selected |
|--------|-------------|----------|
| DAL audit scope | How deep: Class A only, A+B, or A+B+C | ✓ |
| worn_public lifecycle | Column drop timing, settings UI fate, master kill switch | ✓ |
| Activity metadata backfill | How to handle pre-v3.0 watch_worn rows | ✓ |
| Test-first scope & sequencing | Per-function tests vs E2E matrix vs hybrid | (deferred to Claude's Discretion) |

**User's choice:** DAL audit scope, worn_public lifecycle, Activity metadata backfill

---

## DAL Audit Scope

### Audit depth

| Option | Description | Selected |
|--------|-------------|----------|
| A+B only | Class A event-surface call sites + Class B profile-layout taste-tag count. Class C keeps raw counts for math. (Recommended) | ✓ |
| A only | Only the 4 event-returning call sites. Taste-tag counts stay full. | |
| A+B+C (full audit) | Every wear-reading call site gets a viewer-aware variant. | |

**User's choice:** A+B (with follow-up "could an argument be made that private wear posts should count towards these scores/rankings?")

**Notes:** User pressure-tested the Class C exclusion. Discussion weighed privacy-first strict interpretation (private means private from every surface, including math) against the aggregate-never-surfaces argument (individual events never leak; Common Ground accuracy matters). User re-confirmed A+B after discussion — math-only paths (Class C) continue reading full counts.

### Taste-tag count for non-owner viewer

| Option | Description | Selected |
|--------|-------------|----------|
| Filter by visibility | Non-owner viewers see taste tags derived only from wears they can see. | |
| Always full count | Pass full `wearEvents.length` regardless of viewer. Aligns with aggregate-math reasoning. | ✓ |
| Owner-only tag | Hide taste tags entirely when viewer != owner. | |

**User's choice:** Always full count ("i think all, related to my question above")

### DAL function shape

| Option | Description | Selected |
|--------|-------------|----------|
| New viewer-aware variants | `getWearEventsForViewer(viewerId, profileUserId)`; keep `getAllWearEventsByUser` as owner-only. Mirrors quick-260421-rdb pattern. (Recommended) | ✓ (Claude's Discretion) |
| Modify `getPublicWearEventsForViewer` in place | Less new API surface. | |

**User's choice:** Claude's discretion → chose new viewer-aware variant

### Storage layer handling

| Option | Description | Selected |
|--------|-------------|----------|
| Defer signed URLs | Phase 12 only gates visibility; Phase 15 handles signed URL minting. (Recommended) | ✓ (Claude's Discretion) |
| Also mint signed URLs now | Phase 12 DAL mints signed URLs when visibility != 'public'. | |

**User's choice:** Claude's discretion → chose defer to Phase 15

---

## worn_public Lifecycle

### Column drop timing

| Option | Description | Selected |
|--------|-------------|----------|
| Drop in Phase 12 | Cleanup migration drops `profile_settings.worn_public` after DAL ripple + tests pass. Matches Phase 11 D-06. (Recommended) | ✓ |
| DAL-only in Phase 12, drop column later | Leave column as dead code; drop in a future cleanup phase. | |
| Keep as master kill switch | worn_public=false overrides all per-wear visibility. | |

**User's choice:** Drop in Phase 12

### Settings UI cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Remove toggle in Phase 12 | End-to-end removal: profiles.ts field, actions/profile.ts allowed list, SettingsClient.tsx toggle, settings/page.tsx read. (Recommended) | ✓ |
| Leave UI for future phase | Would orphan the toggle (breaks at runtime). | |
| Move to future setting (defaultWearVisibility) | Replaces toggle with per-user default visibility dropdown. | |

**User's choice:** Remove toggle in Phase 12

### markAsWorn transition default

| Option | Description | Selected |
|--------|-------------|----------|
| Always 'public' | Schema DEFAULT handles it. Users with prior worn_public=false get a v2→v3 transition note. (Recommended) | ✓ |
| Preserve prior worn_public | Read column at write time, write 'private' for legacy worn_public=false users. | |
| Always 'private' | Fail-closed; users choose public in Phase 15 picker. | |

**User's choice:** Always 'public'

---

## Activity Metadata Backfill

### Backfill strategy

| Option | Description | Selected (initial) | Selected (clarified) |
|--------|-------------|-------|-------|
| Copy from current worn_public | Migration joins activities to profile_settings; SET metadata.visibility accordingly. (Originally recommended) | | |
| Match to wear_events row | Fuzzy JOIN by (userId, watchId, closest timestamp). | | |
| Default to 'public' | Skip backfill; treat missing as 'public' at read time. | ✓ | |
| Default to 'private' | Skip backfill; fail-closed. Legacy activity drops from non-self feeds. | | ✓ (effective) |

**User's initial choice:** "Default to 'public'" for backfill + "Fail-closed ('private')" for reads — Claude flagged the contradiction.

**User's clarification:** "use your discretion - here's the rub: the app has no users except me and my test accounts which can effectively be deleted and i can start over if need be. there will come a point when i will want to keep data long term but we're a ways away from that. i don't want to slow us down or make long-lasting product decisions if it's easier to just remove some database rows."

**Claude's resolution:** Option B (skip backfill, fail-closed at reads). Legacy watch_worn activity drops from non-self feeds; acceptable given pre-launch state. Simplicity wins over migration complexity for users who don't exist yet.

### Feed DAL read-time default

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-closed ('private') | Missing metadata.visibility treated as 'private'. Defense in depth. (Recommended) | ✓ |
| Trust the backfill | Read metadata.visibility directly; rely on migration as single source of truth. | |
| Fail-open ('public') | Missing treated as 'public'. Rejected as privacy regression. | |

**User's choice:** Fail-closed ('private')

### logActivity signature

| Option | Description | Selected |
|--------|-------------|----------|
| Extend metadata type per-type | Widen `WatchWornMetadata` to require `visibility`. Caller passes in metadata object. Keeps logActivity signature stable. (Recommended) | ✓ |
| Add visibility parameter | New required arg on logActivity. | |
| Separate logWearActivity helper | Keep logActivity generic; add dedicated wear helper. | |

**User's choice:** Extend metadata type per-type

---

## Claude's Discretion

Areas where the user deferred to Claude:
- DAL function shape (D-03) — chose new viewer-aware variant (`getWearEventsForViewer`)
- Storage signed URL handling (D-04) — chose to defer to Phase 15
- Activity metadata backfill final call (D-08) — after flagging the read/write tension, chose skip-backfill + fail-closed-reads per user's "pre-launch, no users" guidance
- Integration test strategy (not selected as a gray area) — captured as Claude's Discretion in CONTEXT.md: hybrid approach (per-function units + one E2E matrix), tests-first per privacy-first UAT rule
- Shared visibility-check helper vs inline — planner decides
- Exact Drizzle jsonb accessor syntax — executor decides
- Plan ordering within Phase 12 — planner decides (implied: tests → Class A ripple → activity metadata → Class B confirm → column drop → settings UI cleanup)

---

## Deferred Ideas

- Class C visibility filtering (recommendations / suggestions / taste-overlap math) — aggregate math only, no leak vector at MVP scale
- Global `defaultWearVisibility` user setting to replace worn_public semantics — not needed pre-launch; per-row visibility is the whole model
- Master kill-switch override (worn_public=false forces all wears private) — rejected in research
- Migration backfill of watch_worn activity rows — rejected per pre-launch data posture
- Signed URL minting in DAL return shapes — Phase 15
- Bulk "Make all my wears private" action — candidate for future UX phase
