# Phase 29 — Discussion Log

**Date:** 2026-05-05
**Phase:** Nav & Profile Chrome Cleanup

This log records the discuss-phase conversation that produced `29-CONTEXT.md`. It is a human-reference audit trail; downstream agents (researcher, planner, executor) consume CONTEXT.md, not this file.

---

## Gray Areas Presented

Claude analyzed the phase scope (NAV-16 + PROF-10 from ROADMAP.md) and surfaced 4 phase-specific gray areas:

1. **Dropdown structure after Profile row removal** — collapse the orphaned separator above Settings, or keep current section dividers?
2. **PROF-10 CSS technique** — `overflow-y-hidden` on TabsList, `overflow: clip` wrapper, hide scrollbar utilities, or wrap TabsList in an outer scroll container?
3. **PROF-10 active-tab indicator clip** — `after:bottom-[-5px]` indicator might clip under tightened vertical bounds. Mitigate via padding-bottom, move indicator to `bottom-0`, or accept different active-state visual?
4. **Scope of TabsList fix** — patch `ProfileTabs.tsx` only, or push into shared `tabsListVariants`?

## User Selection

User trusted Claude's judgment on all 4 gray areas: *"i trust you on all of the above"*

User added a NEW bug to surface: **Add-Watch form retains stale data when navigating back to `/watch/new`** — *"clicking into the add new watch flow from any CTA will surface this"* (i.e., not just bfcache; any CTA-driven entry shows stale state).

## Locked Decisions From Trusted Gray Areas

- **D-01 (NAV-16 dropdown structure)** — Drop only the Profile DropdownMenuItem and its trailing orphaned separator. No structural rework.
- **D-06 (PROF-10 CSS)** — `overflow-y: hidden` on TabsList alongside existing `overflow-x-auto`, plus `[scrollbar-width:none]` + `[&::-webkit-scrollbar]:hidden` to hide the horizontal scrollbar visually.
- **D-07 (PROF-10 indicator clip)** — Add `pb-2` to TabsList so the `after:bottom-[-5px]` indicator falls inside the clip region. Don't touch the shared TabsTrigger primitive.
- **D-09 (PROF-10 scope)** — Patch `ProfileTabs.tsx` only. Do NOT modify `tabsListVariants` in `src/components/ui/tabs.tsx`. `/settings` vertical TabsList and `/search` 4-tab TabsList have different concerns.

## Scope-Creep Decision (Folded into Phase 29)

**Surfaced bug:** Add-Watch form persists stale data across entries to `/watch/new`.

**Scope analysis:** Bug is outside locked Phase 29 requirements (NAV-16 + PROF-10). Folding requires a new requirement + ROADMAP edit. Three options offered:
1. Fold into Phase 29 (add FORM-04 to REQUIREMENTS + ROADMAP)
2. Insert as a new dedicated bug-fix phase (29.5 / 30-prefix)
3. Backlog as deferred (note in CONTEXT, schedule v4.2 / v5.0)

**User choice:** Fold into Phase 29.

User clarification: bug is NOT bfcache-only — it surfaces on every CTA-driven entry. This rules out `pageshow` listener as the sole fix and points at React state surviving Next.js 16 router cache replays.

## FORM-04 Reset Scope Question

**Question presented:** What should reset on every entry to `/watch/new` — and what should survive?
1. **Full flow reset (Recommended)** — AddWatchFlow.state, .url, .rail + WatchForm formData/photo/errors
2. **Form fields only; preserve evaluated rail** — keep RecentlyEvaluatedRail entries (cross-entry feature)
3. **Reset only WatchForm fields** — tightest scope

**User choice:** Full flow reset (Recommended).

## FORM-04 Decisions Locked

- **D-12 (Reset technique)** — `key` prop on `<AddWatchFlow>` derived from a per-navigation nonce in the page Server Component (e.g., `crypto.randomUUID()`). Forces fresh React tree on every entry; useState lazy-initializers run again.
- **D-13 (Trigger paths covered)** — Browser back/forward, refresh, CTA click, post-commit re-navigation all generate a fresh nonce → fresh tree.
- **D-14 (Defense-in-depth)** — Explicit state reset right before `router.push(returnTo ?? default)` on commit success. Planner verifies whether key-prop alone is sufficient.
- **D-15 (Reset scope)** — AddWatchFlow.state + .url + .rail + WatchForm formData/photoBlob/photoError/errors all reset. `useWatchSearchVerdictCache` does NOT reset (cross-session by design; planner hoists it above the key boundary).
- **D-16 (URL params still drive initial state)** — page Server Component's existing whitelist logic unchanged. Deep-link entry from `/search` 3-CTA still short-circuits to form-prefill.
- **D-17 (Within-flow paths unchanged)** — Skip / in-flow Cancel / WishlistRationalePanel-Cancel still loop back to idle inside the same mount. FORM-04 only addresses route re-entry.
- **D-18 (No client storage)** — bug is purely React state replay through Next 16 router cache, not a storage-layer issue.

## Roadmap & Requirements Edits Made During Discuss-Phase

- `.planning/REQUIREMENTS.md` — added FORM-04 to "Add-Watch Form Reset (Phase 20.1 follow-up)" section. Updated Traceability table (12/12 coverage). Updated Last-updated note.
- `.planning/ROADMAP.md` — Phase 29 line updated; Phase 29 details rewritten with 3 success criteria + canonical refs section + dependency on Phase 20.1.

## Deferred Ideas Captured

- Push PROF-10 fix into shared `tabsListVariants` primitive — deferred to v5.0+ primitive cleanup if `/search` tabs exhibit same leak
- Browser autofill on WatchForm fields — out of scope; `autocomplete="off"` follow-up if surfaces during UAT
- `useWatchSearchVerdictCache` true cross-route cache migration — deferred to v5.0+
- `pageshow` Safari bfcache listener — not needed; key approach covers this
- Settings menu reordering after Profile removal — out of scope; v5.0+ design concern
- JSDOM touch-gesture-passthrough simulation for PROF-10 — manual UAT only

## Claude's Discretion (Planner-Owned)

- Exact key-source technique (D-12) — `crypto.randomUUID()` vs request-id headers vs searchParams hash
- `useWatchSearchVerdictCache` hoisting strategy (D-15)
- Whether to drop the explicit reset-on-commit (D-14) if `key` alone is sufficient
- Test technique balance for PROF-10 (D-11) — className vs computed-style assertions
- Whether to ship a TabsList-level primitive fix in a future phase (D-09 explicitly defers)

---

*Discussion completed: 2026-05-05*
