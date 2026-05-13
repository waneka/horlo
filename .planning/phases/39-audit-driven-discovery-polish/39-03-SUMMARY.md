---
phase: 39-audit-driven-discovery-polish
plan: 03
subsystem: insights
tags: [component, server-component, insights, link-wrap, audit-closure, nsv-01, nsv-15, nsv-08, disc-audit-82, disc-audit-71, disc-audit-129]

# Dependency graph
requires:
  - phase: 33b-discovery-north-star-audit
    provides: Q3 verdict — NSV-01 / NSV-15 / NSV-08 audit rows scoped as high-leverage / single-file closures
  - phase: 20-server-component-collection-fit
    provides: CollectionFitCard.tsx pure-renderer surface + D-04 import-boundary guard (tests/static/CollectionFitCard.no-engine.test.ts)
provides:
  - Clickable mostSimilar rows in CollectionFitCard.tsx — every <li> wraps in <Link href={`/watch/${watch.id}`}> with D-07 verbatim className
  - Verify-before-patch evidence for NSV-08 / DISC-AUDIT-129 — grep stdout proves SleepingBeautiesSection + GoodDealsSection already wrap; closure documented without fabricated patches
  - Phase 33b audit-row state transitions: NSV-01 (DISC-AUDIT-82) → ship, NSV-15 (DISC-AUDIT-71) → ship, NSV-08 (DISC-AUDIT-129) → ship (already-shipped marker)
affects: [33b audit ledger, future verdict surfaces that consume CollectionFitCard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Link-wrap-with-inner-flex-span: <li> contains <Link className=\"block ...\"> wrapping an inner <span className=\"flex items-center justify-between\"> that preserves the original two-span row layout — block keeps the row a single hover target, flex moves inside to keep the visual contract intact"
    - "D-08 verify-before-patch: before touching any audit-flagged file, run the canonical grep at execution time; if the row is already closed by sibling phase work, document the grep evidence and close the row without fabricating duplicate code"

key-files:
  created:
    - .planning/phases/39-audit-driven-discovery-polish/39-03-SUMMARY.md (this file)
  modified:
    - src/components/insights/CollectionFitCard.tsx (lines 69-83, +12/-7 — mostSimilar Link wrap)

key-decisions:
  - "D-07 verbatim className: 'block hover:bg-accent rounded-md p-1' — intentionally differs from SleepingBeautiesSection's 'flex items-center justify-between rounded-md p-2 hover:bg-accent' because the CollectionFitCard row sits inside a card already and needs the more compact p-1 + block shape; the flex layout moves into an inner <span> wrapper"
  - "NSV-08 closed via grep evidence, not patch — D-08 explicit: 'Do NOT fabricate work to fill the plan'. Both target sections (SleepingBeautiesSection, GoodDealsSection) already wrap their rows in <Link>; the audit drift was a stale snapshot, not a code regression. Closure is documentation, not code"
  - "Reuse existing Link import at CollectionFitCard.tsx:1 — no new imports added. Phase 20 D-04 deny-list compliance is therefore vacuous; the static guard test passes unchanged"

patterns-established:
  - "Audit-row-as-grep-closure: when a planner snapshot disagrees with an executor snapshot, the executor's grep stdout becomes the authoritative ledger update — verbatim capture in the SUMMARY is the audit-trail artifact"
  - "Two-step Link wrap shape preservation: when promoting a <li className='flex …'> into a <li><Link className='block …'><span className='flex …'>...</span></Link></li>, the inner span keeps the original layout class intact so no visual contract changes — only the click target widens"

requirements-completed: [DISC-11]

# Metrics
duration: ~10min
completed: 2026-05-13
---

# Phase 39 Plan 03: CollectionFitCard mostSimilar Link Wraps + NSV-08 Audit-Row Closure Summary

**One file modified (CollectionFitCard.tsx, +12/-7) wraps the mostSimilar list rows in `<Link href={`/watch/${watch.id}`}>`, closing NSV-01 + NSV-15 audit rows. NSV-08 closed without code changes via D-08 verify-before-patch grep evidence — both SleepingBeautiesSection and GoodDealsSection already wrap their rows in `<Link>` and shipped before Phase 39 began.**

## Performance

- **Duration:** ~10 min (worktree rebase + edit + verify + SUMMARY)
- **Tasks:** 2
- **Files modified:** 1 (`src/components/insights/CollectionFitCard.tsx`, 142 lines, +12/-7 diff)
- **Files created:** 1 (this SUMMARY)
- **Commits:**
  - `ef949ec` — `feat(39-03): wrap CollectionFitCard mostSimilar rows in <Link> (NSV-01 + NSV-15)`
  - (final SUMMARY commit follows)

## Accomplishments

- **NSV-01 / DISC-AUDIT-82 closed:** clicking a mostSimilar row on `/watch/{id}` now navigates to `/watch/{rowWatchId}`. Single component edit reaches both audit surfaces because CollectionFitCard is the only renderer of the mostSimilar list.
- **NSV-15 / DISC-AUDIT-71 closed:** same fix simultaneously closes the `/catalog/{id}` audit row — the catalog detail surface renders the same CollectionFitCard component.
- **NSV-08 / DISC-AUDIT-129 closed via D-08 protocol:** verify-before-patch grep run at execution time confirmed both SleepingBeautiesSection.tsx and GoodDealsSection.tsx already wrap their rows in `<Link>`. Audit row is closed as pre-existing sibling-phase work with verbatim grep stdout captured below — see canonical closure statement in the NSV-08 section.
- **Phase 20 D-04 import-boundary guard preserved:** `tests/static/CollectionFitCard.no-engine.test.ts` ran 3/3 PASS before and after the edit — the `Link` import already existed at line 1, so zero new imports were added.
- **tsc baseline preserved:** zero new tsc errors in CollectionFitCard.tsx (0/0 — file remains clean).

## NSV-01 + NSV-15 / DISC-AUDIT-82 + DISC-AUDIT-71 — CollectionFitCard mostSimilar Link Wrap

### File modified

`src/components/insights/CollectionFitCard.tsx` — lines 69-83 reshape, 142 lines total. Diff: **+12 / -7**.

### Before (HEAD `d8f65b5`, lines 69-78)

```tsx
{verdict.mostSimilar.map(({ watch, score }) => (
  <li key={watch.id} className="flex items-center justify-between">
    <span className="truncate">
      {watch.brand} {watch.model}
    </span>
    <span className="text-muted-foreground/70">
      {Math.round(score * 100)}% similar
    </span>
  </li>
))}
```

### After (commit `ef949ec`, lines 69-83)

```tsx
{verdict.mostSimilar.map(({ watch, score }) => (
  <li key={watch.id}>
    <Link
      href={`/watch/${watch.id}`}
      className="block hover:bg-accent rounded-md p-1"
    >
      <span className="flex items-center justify-between">
        <span className="truncate">{watch.brand} {watch.model}</span>
        <span className="text-muted-foreground/70">
          {Math.round(score * 100)}% similar
        </span>
      </span>
    </Link>
  </li>
))}
```

### Grep evidence (Link + className shape)

Command:

```bash
grep -nE "<Link|className=\"block hover" src/components/insights/CollectionFitCard.tsx
```

Stdout:

```
71:                  <Link
73:                    className="block hover:bg-accent rounded-md p-1"
119:        <Link
```

Line 71 is the new mostSimilar wrap. Line 73 is the D-07 verbatim className. Line 119 is the pre-existing `<Link>` in YouOwnThisCallout (unchanged).

### Phase 20 D-04 static guard test result

Command:

```bash
npx vitest run tests/static/CollectionFitCard.no-engine.test.ts
```

Summary line:

```
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

All three D-04 deny-list assertions pass after the edit (no `@/lib/similarity`, no `@/lib/verdict/composer`, no `server-only`, no `@/lib/verdict/viewerTasteProfile` imports added — vacuous compliance because zero new imports were introduced).

### tsc baseline check

- Errors in `src/components/insights/CollectionFitCard.tsx`: **0** (unchanged — file remains clean).
- Repo-wide tsc error total: 29 (the plan-quoted baseline of 27 was relative to HEAD before Plan 39-01 RED scaffold landed; the +2 delta is the RED test file landing in the rebased base, not from this plan).

### Phase 33b row status update note

- NSV-01 (DISC-AUDIT-82): `partial` → **`ship`**
- NSV-15 (DISC-AUDIT-71): `partial` → **`ship`**

## NSV-08 / DISC-AUDIT-129 — Verify-Before-Patch Evidence

### Exact command run (D-08 verbatim lock)

```bash
grep -nE "<Link|<a " src/components/insights/SleepingBeautiesSection.tsx src/components/insights/GoodDealsSection.tsx
```

### Verbatim stdout

```
src/components/insights/SleepingBeautiesSection.tsx:43:                <Link
src/components/insights/GoodDealsSection.tsx:47:                <Link
```

### Decision tree branch hit

**Case A — Both files contain `<Link` matches.** Decision-tree verify command echoed `NSV08_CASE_A_BOTH_WRAP`.

Both files wrap their row content in `<Link href={`/watch/${...}`}>`:

- **SleepingBeautiesSection.tsx:43-51** — `<Link href={\`/watch/${watch.id}\`} className="flex items-center justify-between rounded-md p-2 hover:bg-accent">`
- **GoodDealsSection.tsx:47-49** — `<Link href={\`/watch/${w.id}\`} className="flex items-center gap-3 rounded-md p-2 hover:bg-accent">`

### Closure statement

**NSV-08 / DISC-AUDIT-129 closed as 'already shipped before Phase 39 began'. Zero code changes per D-08 ('Do NOT fabricate work to fill the plan').** The Phase 33b 2026-05-08 audit snapshot showed neither section wrapped; the 2026-05-12 phase-researcher snapshot showed both wrapped; the 2026-05-13 executor grep (above) confirms the 2026-05-12 finding. The audit row's `partial` status was a stale snapshot, not a code regression — the wraps shipped in a sibling phase before Phase 39 was scoped.

### Files unmodified (D-08 anti-fabrication compliance)

`git diff --name-only HEAD src/components/insights/SleepingBeautiesSection.tsx src/components/insights/GoodDealsSection.tsx` returns empty after this plan completes — neither file is touched by Phase 39 Plan 03.

### Phase 33b row status update note

- NSV-08 (DISC-AUDIT-129): `partial` → **`ship`** (with closure note: pre-existing sibling-phase work — Phase 39-03 captured grep evidence; see canonical closure statement above)

### Execution timestamp

`2026-05-13T01:49:14Z` (UTC, captured via `date -u +"%Y-%m-%dT%H:%M:%SZ"` immediately after the grep ran).

## Deviations from Plan

### None

Plan executed exactly as written. Both tasks landed on their first attempt:

- Task 1: Link-wrap edit matched the plan's `<action>` target shape verbatim; all 14 acceptance grep criteria passed first try; Phase 20 D-04 static guard PASSED (3/3).
- Task 2: D-08 grep hit Case A (expected — both wrap); zero code changes; SUMMARY captures verbatim stdout.

One **environment fix** worth noting (not a plan deviation):

- The worktree did not have `node_modules/` populated. Created a symlink `node_modules -> /Users/tylerwaneka/Documents/horlo/node_modules` so `npx vitest` and `npx tsc` could run. The symlink is gitignored (per `.gitignore` standard for `node_modules`) — never committed.

## Self-Check: PASSED

- File `src/components/insights/CollectionFitCard.tsx` exists (FOUND, 142 lines).
- File `.planning/phases/39-audit-driven-discovery-polish/39-03-SUMMARY.md` exists (FOUND — this file).
- Commit `ef949ec` exists in `git log` (FOUND).
- Phase 20 D-04 static guard test PASSED (3/3, vacuously — zero new imports).
- NSV-08 grep stdout captured verbatim above with file:line:content shape preserved.
- `git diff --name-only HEAD~1 HEAD -- src/components/insights/SleepingBeautiesSection.tsx src/components/insights/GoodDealsSection.tsx` returns empty (neither file modified by this plan).
