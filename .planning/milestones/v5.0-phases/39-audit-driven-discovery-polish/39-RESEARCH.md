# Phase 39: Audit-Driven Discovery Polish — Cheap Patches — Research

**Researched:** 2026-05-12
**Domain:** Next.js 16 App Router presentational polish — Link wraps, soft fallback render, integration tests
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scope split (Phase 39 ≠ Phase 39b):**
- **D-01** — Two phases (Phase 39 + Phase 39b), not one mega-phase. Phase 39 ships first; Phase 39b shapes after observing 39 in production.
- **D-02** — Phase 39 = 3 items: NSV-01+15 mostSimilar Link wraps + NSV-08 Insights Link wraps (verify-before-patch) + NSV-12 common-ground 404 fallback.
- **D-03** — Phase 39b carry-forward (NOT in Phase 39 scope): NSV-06+20 fresh-account verdict, NSV-14 sub-cluster, NSV-18 catalog roster, NSV-02+16 lineage rails.
- **D-04** — Each plan in Phase 39 MUST cite ≥1 NSV-NN or DISC-AUDIT-NN row id in CONTEXT or SUMMARY.

**DISC-09 reshape:**
- **D-05** — DISC-09 DROPPED from Phase 39. Superseded by v5.1 milestone (SEED-008).
- **D-06** — 5-module /explore redesign promoted to v5.1 milestone. v5.0 ships `/explore` unchanged.

**Phase 39 implementation specifics (load-bearing for plan authoring):**
- **D-07** — NSV-01+15 patch shape: Wrap each `<li>` in `CollectionFitCard.tsx:69-78` with `<Link href={\`/watch/\${watch.id}\`} className="block hover:bg-accent rounded-md p-1">`. Keep existing flex layout inside the Link. Phase 20 D-04 import-boundary guard (`tests/static/CollectionFitCard.no-engine.test.ts`) unchanged — `next/link` is not an engine import.
- **D-08** — NSV-08 verify-before-patch protocol: Plan must `grep -nE "<Link|<a " src/components/insights/SleepingBeautiesSection.tsx src/components/insights/GoodDealsSection.tsx` BEFORE writing any code. If both already wrap, close audit row as "already shipped" and plan exits. If only one wraps, patch the other. If neither wraps, patch both. Do NOT fabricate work to fill the plan.
- **D-09** — NSV-12 fallback page implementation site: Replace `notFound()` at `src/app/u/[username]/[tab]/page.tsx:87` (the `if (!overlap || !overlap.hasAny) notFound()` line) with a render branch returning a soft fallback Card. The other two common-ground gate failures (`!isOwner` line 101 and upstream `!profile` line 54) keep `notFound()`. Test coverage: integration test asserting `/u/{user}/common-ground` returns 200 with walk-back CTAs when overlap is empty and viewer follows owner.
- **D-10** — NSV-12 fallback page copy lock: Card title "No shared watches yet." Body "You and @{username} don't share any watches in your collections. That doesn't mean you don't share taste — try one of these:" + two CTAs: "Browse {displayName}'s collection →" → `/u/{username}/collection` and "Find collectors with shared watches →" → `/explore`.

### Claude's Discretion

- **Phase 39 wave packaging** — three items can ship in 1-3 plans. NSV-01+15 and NSV-08 are component-level patches; NSV-12 is a route-level reshape. Planner discretion to package as one omnibus plan or three small plans.
- **NSV-12 fallback page copy refinement** — D-10 copy is a starting point; planner can refine prose during plan authoring as long as the structural decision (Card with profile context + 2 walk-back CTAs) holds.

### Deferred Ideas (OUT OF SCOPE for Phase 39)

- **All Phase 39b carry-forward items** (D-39b-01 through D-39b-08): ReferenceIdentityCard, NSV-14 sub-cluster, NSV-18 catalog roster, NSV-02+16 lineage rails, `scripts/seed-lineage.ts`.
- **v5.1 milestone / 5-module /explore redesign** per SEED-008.
- **`/family/{familyId}` dedicated page** — deferred to v5.x or absorbed by SEED-008 Browse the Catalog module.
- **Admin UI for lineage edge curation.**
- **NSV-41 search inline-expand fresh-account verdict.**
- **All 21 med/low-leverage Phase 33b cells** (NSV-03/04/07/09/10/13/17/21/23/24/25/27/29/30/31/33/34/36/37/38/39/41).
- **WishlistRail drag-handle silent no-op** (DISC-AUDIT-99) — "wired-but-broken" not "missing dead-end"; own bugfix.
- **Confidence numeric percentage display** on Reference Identity card.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-11 (cheap tier) | Audit-driven discovery surface polish closes specific DISC-AUDIT-NN row ids from Phase 33's click-path table AND addresses missing drift vectors from Phase 33b's DISCOVERY-NORTH-STAR-AUDIT. Phase 39 covers cheap tier: NSV-01+15 (DISC-AUDIT-82, DISC-AUDIT-71) mostSimilar Link wraps; NSV-08 (DISC-AUDIT-129) Insights Link wraps; NSV-12 (DISC-AUDIT-127) common-ground 404 fallback. | Code-anchor table verified against current HEAD (lines confirmed by Read); D-07/D-08/D-09/D-10 specify exact patch shape; test coverage strategy mapped to existing vitest infrastructure (jsdom + RTL + React-tree-walk assertions). |
</phase_requirements>

## Summary

Phase 39 is a 3-item mechanical polish phase. Two items are inline JSX edits to existing insight components (NSV-01+15 + NSV-08), and one item is a single-branch reshape inside an App Router server-component page (NSV-12). All decisions are pre-locked in `39-CONTEXT.md` (D-07..D-10) and the UI-SPEC fixes className, copy, and Card/Button composition. There are no new components, no new tokens, no schema work, no new dependencies.

The codebase has drifted favorably since Phase 33b's 2026-05-08 snapshot: I verified by Read that **both** `SleepingBeautiesSection.tsx:43-51` AND `GoodDealsSection.tsx:46-63` already wrap their `<li>` content in `<Link href={\`/watch/\${watch.id}\`} ...>`. This means NSV-08 is highly likely to close as "already shipped" — but D-08 still mandates the plan re-run the grep at execution time and capture evidence (drift could re-emerge between research and execution).

The integration-test infrastructure for NSV-12 is fully established: `tests/app/profile-tab-insights.test.tsx` is the canonical reference pattern for testing `[tab]/page.tsx` branches — it mocks `next/navigation.notFound` to throw `NEXT_NOT_FOUND`, mocks all data-access modules, and asserts on the returned React element's `type` and `props`. This pattern transplants directly to NSV-12's two test assertions (200 path renders fallback Card; existing 404 paths still throw).

**Primary recommendation:** Ship Phase 39 as a single omnibus plan with three small wave items (NSV-01+15 in CollectionFitCard, NSV-08 grep-and-close, NSV-12 page.tsx reshape) plus a fourth test-only wave that adds `tests/app/common-ground-fallback.test.tsx`. Total LOC delta should be well under 200 lines.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| NSV-01+15 mostSimilar Link wrap | Frontend Server (RSC) | — | `CollectionFitCard.tsx` is a server-renderable pure renderer (no `'use client'`). `next/link` works in Server Components. No client-side state needed; the row click is browser navigation. |
| NSV-08 Insights Link wraps | Frontend Server (RSC) | Client (`'use client'`) | `SleepingBeautiesSection` + `GoodDealsSection` both carry `'use client'` (they're inside a client-rendered insights tab). The `<Link>` wrap remains client-renderable; existing pattern verified. |
| NSV-12 common-ground walk-back fallback | Frontend Server (RSC) | — | `src/app/u/[username]/[tab]/page.tsx` is a Server Component (no `'use client'`). The fallback Card + buttonVariants-styled `<Link>` CTAs are pure server-renderable. DO NOT add `'use client'`. |
| NSV-12 integration assertion | Test (vitest + jsdom) | — | Existing `tests/app/profile-tab-insights.test.tsx` proves the pattern: mock `next/navigation.notFound`, mock all DAL modules, await the page function, walk the returned React element tree to assert on Card / Link children. |

## Standard Stack

### Core (already installed — Phase 39 adds zero deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.3 | App Router server components; `next/link`, `notFound()` | Project's framework. Phase 39 uses zero new APIs beyond what's already in the codebase. [VERIFIED: package.json + node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md] |
| `react` | 19.2.4 | RSC rendering | Project's framework. [VERIFIED: package.json] |
| `vitest` | ^2.1.9 | Test runner | Project's standard test runner. `npm test` → `vitest run`. [VERIFIED: package.json + vitest.config.ts] |
| `@testing-library/react` | ^16.3.2 | Component testing | Already used across `tests/app/*` and `tests/components/*`. Phase 39 test wave reuses the same patterns. [VERIFIED: package.json] |
| `jsdom` | ^25.0.1 | DOM environment for vitest | `vitest.config.ts → test.environment: 'jsdom'`. [VERIFIED] |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-variance-authority` (`cva`) | ^0.7.1 | `buttonVariants` factory | Already exported from `src/components/ui/button.tsx`. UI-SPEC mandates importing `buttonVariants({ variant: 'default'/'outline' })` for NSV-12 CTAs. [VERIFIED: Read src/components/ui/button.tsx] |
| `lucide-react` | ^1.8.0 | Icon set | Not strictly needed for Phase 39 — UI-SPEC's fallback Card has no icon in the title (D-10 copy lock). Optional polish per planner discretion. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `buttonVariants(...)` className on `<Link>` | Render `<Button asChild>` wrapping `<Link>` | Project's `Button` does NOT support `asChild` (no Radix Slot — wraps `@base-ui/react/button` directly per `src/components/ui/button.tsx:48-50`). UI-SPEC § "Button + Link composition" explicitly documents this — use `buttonVariants()` className on `<Link>`. **REJECTED — incompatible with project's Button primitive.** |
| `useRouter().push()` on row click | `<Link href>` element | UI-SPEC § Server vs Client constraint mandates SSR-friendly anchor (no `'use client'` conversion). `<Link>` is the only correct primitive. |
| Custom 404 boundary via `not-found.tsx` file | Inline branch render | NSV-12 must NOT 404 (success criterion #4 — returns HTTP 200). A `not-found.tsx` file would still be hit when `notFound()` throws. Inline branch return is the only path. |

**Installation:** Phase 39 ships ZERO `npm install` calls. All primitives are present.

**Version verification:**
- `next@16.2.3` — confirmed in package.json (also locked by AGENTS.md "This is NOT the Next.js you know" warning; consult `node_modules/next/dist/docs/` for any API call patterns). [VERIFIED: package.json + ls node_modules/next/dist/docs/ shows 01-app/02-pages/03-architecture/04-community]
- `vitest@^2.1.9` — confirmed. [VERIFIED: package.json]
- No new dependencies introduced.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────┐
                          │   User clicks /u/alice/      │
                          │   common-ground (no overlap) │
                          └──────────────┬───────────────┘
                                         │
                                         ▼
              ┌────────────────────────────────────────────────────┐
              │ src/app/u/[username]/[tab]/page.tsx (Server Comp)  │
              │                                                    │
              │  1. params.tab === 'common-ground' (line 80)       │
              │  2. resolveCommonGround({viewerId, ownerId,        │
              │     isOwner, collectionPublic}) (line 81-86)       │
              │                                                    │
              │  ┌─────────────────────────────────────────────┐   │
              │  │ Three-way gate (in common-ground-gate.ts):  │   │
              │  │  - viewerId !== null                        │   │
              │  │  - !isOwner                                 │   │
              │  │  - collectionPublic === true                │   │
              │  │  → if any fail: returns null                │   │
              │  └─────────────────────────────────────────────┘   │
              │                                                    │
              │           gate result?                             │
              │       ┌────────┴────────┐                          │
              │       ▼                 ▼                          │
              │  overlap === null    overlap.hasAny === false      │
              │       │                 │                          │
              │       ▼                 ▼                          │
              │  notFound()    ┌──────────────────────────────┐    │
              │  [CURRENT      │ PHASE 39 NEW BEHAVIOR:        │   │
              │   line 87]     │ return <FallbackCard          │   │
              │                │   profile={profile}            │   │
              │                │   displayName={displayName}/>  │   │
              │                │ [line 87 reshape — D-09]       │   │
              │                └──────────────────────────────┘    │
              │       ▼                 ▼                          │
              │ overlap !== null && overlap.hasAny === true        │
              │       │                                            │
              │       ▼                                            │
              │  return <CommonGroundTabContent overlap=... />     │
              │  [line 88-93 unchanged]                            │
              └────────────────────────────────────────────────────┘

NSV-01+15 flow (no architectural change):
   /watch/{id} OR /catalog/{id}
        │
        ▼
   <CollectionFitCard verdict={...} />
        │
        ├── mostSimilar.map → <li>  ← CURRENT: text-only span
        │                            ← PHASE 39 D-07: wrap in <Link href={`/watch/${watch.id}`}>
        │
        └── (rest of card unchanged)

NSV-08 flow:
   /u/{user}/insights (owner-only)
        │
        ▼
   <InsightsTabContent profileUserId=.../>
        │
        ├── <GoodDealsSection watches=.../>      ← ALREADY wraps Link (verified 2026-05-12)
        └── <SleepingBeautiesSection watches=.../>  ← ALREADY wraps Link (verified 2026-05-12)
        ⇒ Plan re-runs grep, captures evidence, closes audit row as "already shipped" [D-08]
```

### Recommended Project Structure (unchanged — Phase 39 ships zero new files except optional tests)

```
src/
├── app/
│   └── u/[username]/[tab]/
│       └── page.tsx            # ← EDIT: line 87 reshape
├── components/insights/
│   ├── CollectionFitCard.tsx   # ← EDIT: lines 69-78 mostSimilar <li> wrap
│   ├── SleepingBeautiesSection.tsx  # ← grep-and-verify only (likely no edit)
│   └── GoodDealsSection.tsx    # ← grep-and-verify only (likely no edit)
tests/
└── app/
    └── common-ground-fallback.test.tsx  # ← NEW: test wave (D-09 mandate)
```

### Pattern 1: Server-component `<Link>` wrap inside server-renderable insight card
**What:** Wrap text-only list-item children in `<Link>` from `next/link` to make the row a navigable surface.
**When to use:** Any list of identity-bearing rows where the identity has a canonical detail route. Phase 39 NSV-01+15.
**Example (from `SleepingBeautiesSection.tsx:42-51` — established pattern, mirror this shape):**
```typescript
// Source: src/components/insights/SleepingBeautiesSection.tsx (HEAD 2026-05-12)
{sleeping.map(({ watch, days }) => (
  <li key={watch.id}>
    <Link
      href={`/watch/${watch.id}`}
      className="flex items-center justify-between rounded-md p-2 hover:bg-accent"
    >
      <span className="truncate font-semibold">
        {watch.brand} {watch.model}
      </span>
      <span className="text-sm text-muted-foreground shrink-0">{days} days</span>
    </Link>
  </li>
))}
```

**NSV-01+15 specific shape (D-07 lock — note: `block` not `flex` per the lock):**
```typescript
// CollectionFitCard.tsx lines 69-78 — TARGET SHAPE
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

**Important:** D-07 specifies `className="block hover:bg-accent rounded-md p-1"` (block + p-1) — DIFFERENT from `SleepingBeautiesSection`'s `flex items-center justify-between rounded-md p-2 hover:bg-accent` (flex + p-2). The DOM tree must preserve the inner flex layout. The simplest preservation is the inner `<span className="flex items-center justify-between">` shown above. Planner may also reorder utility classes (Tailwind 4 is order-agnostic) — the load-bearing tokens are `block`, `hover:bg-accent`, `rounded-md`, `p-1`. [CITED: 39-CONTEXT.md D-07; 39-UI-SPEC.md line 102]

### Pattern 2: Server-component inline branch reshape (no `'use client'`)
**What:** Replace a single `notFound()` call with an inline `return <Card>...</Card>` branch in a server-component page.
**When to use:** NSV-12. The page is already a Server Component; the branch reshape is purely server-renderable.
**Example shape for NSV-12 (D-10 copy + UI-SPEC composition):**
```typescript
// src/app/u/[username]/[tab]/page.tsx — line 87 reshape (TARGET)
if (tab === 'common-ground') {
  const overlap = await resolveCommonGround({
    viewerId, ownerId: profile.id, isOwner,
    collectionPublic: settings.collectionPublic,
  })
  if (!overlap) notFound()  // ← gate failure (viewer null / isOwner / !collectionPublic) — UNCHANGED
  if (!overlap.hasAny) {     // ← PHASE 39 NEW BRANCH
    return (
      <Card>
        <CardHeader>
          <CardTitle>No shared watches yet.</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You and @{profile.username} don&apos;t share any watches in your collections.
            That doesn&apos;t mean you don&apos;t share taste — try one of these:
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              href={`/u/${profile.username}/collection`}
              className={buttonVariants({ variant: 'default', size: 'default' })}
            >
              Browse {displayName ?? `@${profile.username}`}&apos;s collection →
            </Link>
            <Link
              href="/explore"
              className={buttonVariants({ variant: 'outline', size: 'default' })}
            >
              Find collectors with shared watches →
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }
  return (
    <CommonGroundTabContent
      overlap={overlap}
      ownerDisplayLabel={ownerDisplayLabel}
    />
  )
}
```

**Notes:**
- Split `if (!overlap || !overlap.hasAny) notFound()` into two distinct guards: `if (!overlap) notFound()` (gate-failure path) and `if (!overlap.hasAny) { return <Card .../> }` (no-overlap path). This preserves the existing 404 behavior on gate failures (line 87 sub-branch where `overlap === null` because `resolveCommonGround` returned null) and only reshapes the no-overlap branch — directly aligned with D-09's "only the no-overlap branch reshapes".
- Body apostrophes: use `&apos;` to match project ESLint convention (`react/no-unescaped-entities`). Verified by grep: `GoodDealsSection.tsx:34` uses `you&apos;ve`; `WatchPickerDialog.tsx:144` uses `don&apos;t`. [VERIFIED via grep]
- Em-dash `—` (U+2014) verbatim per UI-SPEC. Arrow `→` (U+2192) verbatim.

### Pattern 3: Integration test for page.tsx branches (vitest + React-tree walk)
**What:** Mock `next/navigation`, mock all DAL modules, await the page function, walk the returned React element tree to assert on Card / Link children.
**When to use:** NSV-12 integration test wave.
**Example (from `tests/app/profile-tab-insights.test.tsx`, established pattern):**
```typescript
// Source: tests/app/profile-tab-insights.test.tsx:4-8, 70-103
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
}))
// ... mock all DAL ...
vi.mock('@/app/u/[username]/common-ground-gate', () => ({
  resolveCommonGround: vi.fn().mockResolvedValue(null),  // ← override per test
}))

import ProfileTabPage from '@/app/u/[username]/[tab]/page'

it('returns 200 with fallback Card when overlap.hasAny is false', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({ id: 'viewer-1', email: 'v@b.co' })
  vi.mocked(getProfileByUsername).mockResolvedValue({
    id: 'owner-1', username: 'alice', displayName: 'Alice'
  } as any)
  vi.mocked(getProfileSettings).mockResolvedValue({
    collectionPublic: true /* ...rest */
  } as any)
  vi.mocked(resolveCommonGround).mockResolvedValue({
    hasAny: false,
    sharedWatches: [], sharedTasteTags: [], overlapLabel: 'Different taste',
    sharedStyleRows: [], sharedRoleRows: [],
  })
  const result = await ProfileTabPage({
    params: Promise.resolve({ username: 'alice', tab: 'common-ground' }),
  }) as any
  expect(result).toBeTruthy()
  // notFound was NOT called → 200
  expect(notFound).not.toHaveBeenCalled()
  // Walk tree to find the title and CTA hrefs
  // (use findInTree helper pattern from tests/app/layout.test.tsx:23)
})
```

### Anti-Patterns to Avoid

- **Adding `'use client'` to `[tab]/page.tsx`** — UI-SPEC § "Server vs Client component constraint" explicitly forbids. Card + Link composition is fully server-renderable.
- **Using `<Button asChild>`** — project's `Button` does NOT support `asChild` (wraps `@base-ui/react/button`, no Radix Slot). Use `buttonVariants()` className on `<Link>` directly per UI-SPEC § "Button + Link composition".
- **Fabricating NSV-08 patch when both Insights sections already wrap** — D-08 explicit: "Do NOT fabricate work to fill the plan." Capture grep evidence and close audit row.
- **Reshaping more than line 87** — D-09 explicit: lines 51, 54, 101 (other `notFound()` calls) survive unchanged. UI-SPEC § "Out-of-Scope Visual Concerns" reinforces.
- **Introducing new color / spacing / typography tokens** — UI-SPEC § Spacing/Color/Typography all explicitly "Phase 39 ships zero new tokens."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Linking a row to a detail page | Custom click-handler + `useRouter().push()` | `<Link href>` from `next/link` | Server-renderable, prefetched, accessible (real `<a>`), no client conversion. UI-SPEC mandates. |
| Styling a Link like a button | Manual className duplication | `import { buttonVariants } from '@/components/ui/button'` then `className={buttonVariants({ variant, size })}` | Single source of truth for button styles; CVA handles variant/size composition. Already exported from `src/components/ui/button.tsx:58`. |
| Soft 404 fallback page | Custom `not-found.tsx` boundary file | Inline branch `return <Card>...</Card>` in the page | A `not-found.tsx` file is triggered AFTER `notFound()` throws — that path still returns HTTP 404. Phase 39 must return HTTP 200 (success criterion #4). Inline return is the only correct path. |
| Mocking `notFound()` for tests | Manually patching `next/navigation` exports | Copy the `vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }) }))` pattern from `tests/app/profile-tab-insights.test.tsx:4-8` | Established convention; lets you assert with `rejects.toThrow('NEXT_NOT_FOUND')`. |
| Walking a React tree to assert on children | Custom recursion | Reuse `findInTree(node, predicate)` helper from `tests/app/layout.test.tsx:23-36` | Already in repo (not exported — copy or extract). Pattern is well-established. |

**Key insight:** Phase 39 is a "wire existing primitives" phase. Every problem has a project-canonical answer. The risk is overbuilding (introducing tokens, new components, custom click handlers) rather than underbuilding.

## Runtime State Inventory

**Phase 39 is NOT a rename / refactor / migration phase** — it's net-new affordance addition (Link wraps + soft fallback render). No stored data names change, no env vars change, no OS state, no build artifacts.

Stating explicitly per protocol:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 39 ships no schema or DAL change; the `Watch.id` referenced in `/watch/${watch.id}` is already in the verdict payload. | None |
| Live service config | None — no external service config touched. | None |
| OS-registered state | None — no OS-level registrations changed. | None |
| Secrets/env vars | None — no env var renames or additions. (`ANTHROPIC_API_KEY` already gates `hasUrlExtract` upstream of Phase 39 scope; unchanged.) | None |
| Build artifacts | None — no `pyproject.toml` / `package.json` / lockfile changes; no scripts renamed. | None |

## Common Pitfalls

### Pitfall 1: Splitting `if (!overlap || !overlap.hasAny) notFound()` incorrectly
**What goes wrong:** Naive split sends ALL gate-failure paths to the new fallback Card. Result: anonymous viewers / private-collection viewers / self-viewers see "No shared watches yet" instead of getting 404 — leaks the existence of the common-ground tab.
**Why it happens:** The current single-line guard collapses two semantically distinct conditions. `!overlap` means "the three-way gate (viewerId/isOwner/collectionPublic) failed → privacy/policy reason"; `!overlap.hasAny` means "gate passed but no actual overlap → discoverable state". Treating them identically is a privacy leak.
**How to avoid:** Split into TWO branches per D-09: `if (!overlap) notFound()` (preserves privacy boundary) THEN `if (!overlap.hasAny) { return <Card .../> }` (new soft fallback).
**Warning signs:** Test wave doesn't include a "anonymous viewer still 404" assertion. Add this assertion explicitly.

### Pitfall 2: NSV-08 fabricated patch when both sections already wrap
**What goes wrong:** Plan author lazy-skips the grep, writes a patch to "add" the Link wraps that are already there, ends up with no-op diff or duplicated wrap.
**Why it happens:** Phase 33b audit was dated 2026-05-08; codebase drift could have closed NSV-08 before Phase 39 began. D-08 anticipates this — "Do NOT fabricate work to fill the plan."
**How to avoid:** Plan executor runs the D-08 grep first, captures stdout in the plan SUMMARY artifact, then decides patch action.
**Warning signs:** Plan author writes a NSV-08 patch task before showing the grep result. Reject in plan-check.

**Verified state at HEAD (2026-05-12 by phase-researcher):**
```
src/components/insights/SleepingBeautiesSection.tsx:43:                <Link
src/components/insights/SleepingBeautiesSection.tsx:44:                  href={`/watch/${watch.id}`}
src/components/insights/SleepingBeautiesSection.tsx:45:                  className="flex items-center justify-between rounded-md p-2 hover:bg-accent"
src/components/insights/GoodDealsSection.tsx:47:                <Link
src/components/insights/GoodDealsSection.tsx:48:                  href={`/watch/${w.id}`}
src/components/insights/GoodDealsSection.tsx:49:                  className="flex items-center gap-3 rounded-md p-2 hover:bg-accent"
```
Both wrap. Highly likely NSV-08 closes as "already shipped." Plan must still re-run at execution time to capture fresh evidence.

### Pitfall 3: Phase 20 import-boundary guard tripped by accident
**What goes wrong:** Plan author "helpfully" adds an unrelated import while editing `CollectionFitCard.tsx` (e.g., a click handler from `@/lib/utils` that transitively pulls similarity) — the static guard test fails.
**Why it happens:** Phase 20 D-04 imposes a strict no-engine-import contract on `CollectionFitCard.tsx`. The test forbids three patterns: `from '@/lib/similarity'`, `from '@/lib/verdict/composer'`, `from '@/lib/verdict/viewerTasteProfile'` AND `from 'server-only'`. Source: `tests/static/CollectionFitCard.no-engine.test.ts:22-39`.
**How to avoid:** D-07 patch is import-neutral — `next/link` is already imported (line 1 of `CollectionFitCard.tsx`). Plan executor adds zero new imports. Run `npm test -- tests/static/CollectionFitCard.no-engine.test.ts` after the edit to confirm.
**Warning signs:** Diff shows new imports beyond what's already in the file. Re-justify or reject.

### Pitfall 4: Apostrophe linting failure on D-10 copy
**What goes wrong:** ESLint `react/no-unescaped-entities` flags raw `'` in JSX text — build fails.
**Why it happens:** Project convention is to write `&apos;` in JSX text content for ESLint compliance. Verified in `GoodDealsSection.tsx:34` ("you&apos;ve"), `WatchPickerDialog.tsx:144` ("don&apos;t"), `SearchPageClient.tsx:231` ("you&apos;d").
**How to avoid:** Render the D-10 body as `You and @{profile.username} don&apos;t share any watches in your collections. That doesn&apos;t mean you don&apos;t share taste — try one of these:`. Same for the primary CTA: `Browse {displayName}&apos;s collection →`.
**Warning signs:** Plan diff shows raw `'` in JSX text inside the new Card. Use `&apos;`.

### Pitfall 5: Missing fallback for `displayName === null` in CTA label
**What goes wrong:** Primary CTA renders "Browse 's collection →" (missing name) when `displayName` is null.
**Why it happens:** `profile.displayName` is `string | null` per `getProfileByUsername`'s return type (verified by Read of `src/data/profiles.ts:101` — `displayName?: string | null`). Page already computes `displayName = profile.displayName ?? null` at line 65. UI-SPEC's primary CTA copy is "Browse {displayName}'s collection →" but planner must add the null fallback.
**How to avoid:** Use `displayName ?? \`@${profile.username}\`` in the CTA label. UI-SPEC line 128 explicitly notes: "If `displayName` is null, fall back to `@{profile.username}`."
**Warning signs:** Plan body shows literal `{displayName}` without nullish coalescing. Apply the fallback.

### Pitfall 6: Test runs against a stale module cache
**What goes wrong:** `vi.mock(...)` declared after `import ProfileTabPage` resolves — mocks don't take effect; test asserts against real module.
**Why it happens:** vitest hoists `vi.mock` calls but ONLY for module-scope `vi.mock`. Inline-after-import patterns silently fail.
**How to avoid:** Place ALL `vi.mock(...)` calls at top of test file, BEFORE the `import ProfileTabPage from '@/app/u/[username]/[tab]/page'` line. Pattern verified in `tests/app/profile-tab-insights.test.tsx:4-69` — all 13 `vi.mock` calls precede line 70 `import ProfileTabPage`.
**Warning signs:** `notFound` is the real Next.js function in test — test throws an unexpected `NEXT_HTTP_ERROR_FALLBACK;404` instead of the mocked `NEXT_NOT_FOUND` string.

## Code Examples

Verified patterns from current HEAD:

### NSV-08 verification pattern (D-08 mandate)
```bash
# Run BEFORE writing any NSV-08 patch code.
# Source: 39-CONTEXT.md D-08, verified by researcher 2026-05-12.
grep -nE "<Link|<a " src/components/insights/SleepingBeautiesSection.tsx \
                     src/components/insights/GoodDealsSection.tsx
```

Expected current output (both wrap):
```
src/components/insights/SleepingBeautiesSection.tsx:43:                <Link
src/components/insights/GoodDealsSection.tsx:47:                <Link
```

If output shows both `<Link>` matches → close NSV-08 as "already shipped" with grep evidence in plan SUMMARY.

### NSV-01+15 Link wrap target shape (D-07 lock)
```typescript
// Source: target shape derived from 39-CONTEXT.md D-07 + 39-UI-SPEC.md
// File: src/components/insights/CollectionFitCard.tsx lines 69-78 (target)
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

### NSV-12 fallback Card target shape (D-09 + D-10 + UI-SPEC)
```typescript
// Source: target shape derived from 39-CONTEXT.md D-09/D-10 + 39-UI-SPEC.md § Component Inventory
// File: src/app/u/[username]/[tab]/page.tsx lines 80-94 (target)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
// ... existing imports unchanged ...

if (tab === 'common-ground') {
  const overlap = await resolveCommonGround({
    viewerId,
    ownerId: profile.id,
    isOwner,
    collectionPublic: settings.collectionPublic,
  })
  if (!overlap) notFound()  // gate failure — privacy boundary preserved
  if (!overlap.hasAny) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No shared watches yet.</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You and @{profile.username} don&apos;t share any watches in your
            collections. That doesn&apos;t mean you don&apos;t share taste —
            try one of these:
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <Link
              href={`/u/${profile.username}/collection`}
              className={buttonVariants({ variant: 'default', size: 'default' })}
            >
              Browse {displayName ?? `@${profile.username}`}&apos;s collection →
            </Link>
            <Link
              href="/explore"
              className={buttonVariants({ variant: 'outline', size: 'default' })}
            >
              Find collectors with shared watches →
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }
  return (
    <CommonGroundTabContent
      overlap={overlap}
      ownerDisplayLabel={ownerDisplayLabel}
    />
  )
}
```

### Integration test target shape (D-09 mandate)
```typescript
// Source: pattern lifted from tests/app/profile-tab-insights.test.tsx:1-103
// Target file: tests/app/common-ground-fallback.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  UnauthorizedError: class extends Error {
    constructor(msg = 'Not authenticated') { super(msg); this.name = 'UnauthorizedError' }
  },
}))

vi.mock('@/data/profiles', () => ({
  getProfileByUsername: vi.fn(),
  getProfileSettings: vi.fn(),
}))

vi.mock('@/data/watches', () => ({ getWatchesByUser: vi.fn().mockResolvedValue([]) }))
vi.mock('@/data/wearEvents', () => ({
  getMostRecentWearDates: vi.fn().mockResolvedValue(new Map()),
  getWearEventsForViewer: vi.fn().mockResolvedValue([]),
  getAllWearEventsByUser: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/data/preferences', () => ({
  getPreferencesByUser: vi.fn().mockResolvedValue({ collectionGoal: 'balanced' }),
}))

// Mock all tab content components so module-level resolution doesn't break.
vi.mock('@/components/profile/CollectionTabContent', () => ({ CollectionTabContent: vi.fn(() => null) }))
vi.mock('@/components/profile/WishlistTabContent', () => ({ WishlistTabContent: vi.fn(() => null) }))
vi.mock('@/components/profile/NotesTabContent', () => ({ NotesTabContent: vi.fn(() => null) }))
vi.mock('@/components/profile/WornTabContent', () => ({ WornTabContent: vi.fn(() => null) }))
vi.mock('@/components/profile/StatsTabContent', () => ({ StatsTabContent: vi.fn(() => null) }))
vi.mock('@/components/profile/LockedTabCard', () => ({ LockedTabCard: vi.fn(() => null) }))
vi.mock('@/components/profile/CommonGroundTabContent', () => ({ CommonGroundTabContent: vi.fn(() => null) }))
vi.mock('@/components/profile/InsightsTabContent', () => ({ InsightsTabContent: vi.fn(() => null) }))
vi.mock('@/app/u/[username]/common-ground-gate', () => ({ resolveCommonGround: vi.fn() }))

import ProfileTabPage from '@/app/u/[username]/[tab]/page'
import { getCurrentUser } from '@/lib/auth'
import { getProfileByUsername, getProfileSettings } from '@/data/profiles'
import { resolveCommonGround } from '@/app/u/[username]/common-ground-gate'
import { notFound } from 'next/navigation'

function findInTree(node: any, predicate: (n: any) => boolean): any | null {
  if (!node || typeof node !== 'object') return null
  if (predicate(node)) return node
  const children = node.props?.children
  if (Array.isArray(children)) for (const c of children) {
    const hit = findInTree(c, predicate); if (hit) return hit
  } else if (children) return findInTree(children, predicate)
  return null
}

describe('NSV-12 common-ground walk-back fallback (Phase 39 D-09)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const baseSettings = {
    userId: 'owner-1', profilePublic: true, collectionPublic: true,
    wishlistPublic: true, notificationsLastSeenAt: new Date(0),
    notifyOnFollow: true, notifyOnWatchOverlap: true,
  } as any

  it('returns 200 with fallback Card when overlap.hasAny is false (viewer follows owner)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'viewer-1', email: 'v@b.co' })
    vi.mocked(getProfileByUsername).mockResolvedValue({
      id: 'owner-1', username: 'alice', displayName: 'Alice',
    } as any)
    vi.mocked(getProfileSettings).mockResolvedValue(baseSettings)
    vi.mocked(resolveCommonGround).mockResolvedValue({
      hasAny: false, sharedWatches: [], sharedTasteTags: [],
      overlapLabel: 'Different taste', sharedStyleRows: [], sharedRoleRows: [],
    })
    const result = await ProfileTabPage({
      params: Promise.resolve({ username: 'alice', tab: 'common-ground' }),
    }) as any
    expect(result).toBeTruthy()
    expect(notFound).not.toHaveBeenCalled()
    // Walk tree to find the title text "No shared watches yet."
    const title = findInTree(result, (n) =>
      n?.props?.children === 'No shared watches yet.')
    expect(title).toBeTruthy()
    // Walk tree to find the two CTA hrefs
    const primaryCta = findInTree(result, (n) =>
      n?.props?.href === '/u/alice/collection')
    expect(primaryCta).toBeTruthy()
    const secondaryCta = findInTree(result, (n) => n?.props?.href === '/explore')
    expect(secondaryCta).toBeTruthy()
  })

  it('still calls notFound() when overlap === null (gate failure preserves privacy)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'viewer-1', email: 'v@b.co' })
    vi.mocked(getProfileByUsername).mockResolvedValue({
      id: 'owner-1', username: 'alice', displayName: 'Alice',
    } as any)
    vi.mocked(getProfileSettings).mockResolvedValue(baseSettings)
    vi.mocked(resolveCommonGround).mockResolvedValue(null)  // gate failed
    await expect(
      ProfileTabPage({
        params: Promise.resolve({ username: 'alice', tab: 'common-ground' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('still calls notFound() when profile not found (line 54 unchanged)', async () => {
    vi.mocked(getProfileByUsername).mockResolvedValue(null)
    await expect(
      ProfileTabPage({
        params: Promise.resolve({ username: 'nobody', tab: 'common-ground' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
```

### Static guard test (Phase 20 D-04 — keep passing)
```typescript
// Source: tests/static/CollectionFitCard.no-engine.test.ts (existing, lines 12-40)
// Phase 39 must not break this. next/link is allowed (not on the deny list).
describe('Phase 20 D-04 — <CollectionFitCard> pure-renderer invariant', () => {
  // Forbidden imports (regex source-of-truth):
  // - from '@/lib/similarity'   (and any analyzeSimilarity( call)
  // - from '@/lib/verdict/composer'  (and composeVerdictCopy(/computeVerdictBundle( calls)
  // - from 'server-only'
  // - from '@/lib/verdict/viewerTasteProfile'
  //
  // ALLOWED: next/link, lucide-react, @/components/ui/*, @/components/ui/badge, type-only imports.
})
```

Phase 39 D-07 edit adds zero new imports — `Link` is already imported at line 1 of `CollectionFitCard.tsx`. Guard test passes vacuously.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router `getServerSideProps` for SSR | Next.js App Router Server Components (`async function Page()`) | Next.js 13.0+ (2022); Horlo uses App Router exclusively | Phase 39 NSV-12 reshape is a pure RSC pattern — no client conversion needed |
| `useRouter().push()` for navigation | `<Link href>` from `next/link` | App Router default | Phase 39 NSV-01+15 / NSV-12 CTAs all use `<Link>` |
| Radix Slot `<Button asChild>` pattern | `buttonVariants()` className applied to `<Link>` (project-specific because Button wraps `@base-ui/react/button`) | Project decision (no Radix Slot in this codebase) | Phase 39 CTAs must use `buttonVariants()` className, NOT `asChild` |
| `react/no-unescaped-entities` raw apostrophes | `&apos;` in JSX text | ESLint default + project convention | Phase 39 D-10 body copy uses `&apos;` |

**Deprecated/outdated:**
- **`getServerSideProps` / Pages Router** — Horlo does NOT use Pages Router (verified: no `pages/` directory; `next.config.ts` is minimal). All routing is App Router. Don't reach for Pages Router idioms.
- **`<Button asChild>` pattern from Radix** — does NOT apply here. Project's `Button` wraps `@base-ui/react/button` which has no Slot equivalent. [VERIFIED: Read src/components/ui/button.tsx]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | — | — | — |

**All claims in this research were verified via Read on current HEAD or cited from project documents (CONTEXT.md, UI-SPEC.md, REQUIREMENTS.md, ROADMAP.md) or Next.js docs in `node_modules/next/dist/docs/`. No `[ASSUMED]` tags needed.**

## Open Questions

1. **Should NSV-08 plan-task exist at all if grep confirms both wrap?**
   - What we know: D-08 says "the plan closes the audit row as 'already shipped' and the plan exits."
   - What's unclear: Is "the plan exits" a one-task plan that captures grep evidence and closes the audit row in SUMMARY, or zero-task no-plan-needed?
   - Recommendation: Make NSV-08 a one-task plan (`task: run grep, capture output, write SUMMARY closure note`) so the audit-row-close has an auditable artifact. The grep run + SUMMARY note IS the "work" — it's documentation work, not code work. Planner discretion under D-08.

2. **Does the fallback Card need a `space-y-8` wrapper to match `CommonGroundTabContent`'s outer spacing?**
   - What we know: UI-SPEC § "Optional section-wrapper consistency" answers this — NO. The fallback renders INSTEAD of `CommonGroundTabContent` (different branch); the profile layout's parent provides page-level spacing. Card renders directly as the return value.
   - Recommendation: Skip the wrapper per UI-SPEC. No open question — just verify in implementation.

3. **Should the integration test live in `tests/app/common-ground-fallback.test.tsx` or appended to an existing test?**
   - What we know: `tests/app/profile-tab-insights.test.tsx` tests the same page file (`[tab]/page.tsx`) for the insights branch; could append common-ground branch tests there. UI-SPEC § "Test Coverage Contract" suggests "New `tests/app/common-ground-fallback.test.ts` (or appended to existing common-ground test if one exists)."
   - Recommendation: Create new `tests/app/common-ground-fallback.test.tsx` (mirrors the per-branch convention already established — `profile-tab-insights.test.tsx`, `layout-common-ground-gate.test.ts`). Clearer ownership; easier to remove or refactor in isolation.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All build / test | ✓ | (not pinned — `.nvmrc` absent; assume current LTS) | — |
| npm | Install / scripts | ✓ | bundled with Node | — |
| `next` | Build / dev server | ✓ | 16.2.3 | — |
| `vitest` | Test runner | ✓ | ^2.1.9 | — |
| `jsdom` | Test environment | ✓ | ^25.0.1 | — |
| `@testing-library/react` | Test assertions | ✓ | ^16.3.2 | — |
| ESLint | `npm run lint` | ✓ | ^9 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

Phase 39 ships zero external dependencies. All required tooling is present and verified.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.9 + @testing-library/react ^16.3.2 + jsdom ^25.0.1 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/static/CollectionFitCard.no-engine.test.ts tests/app/common-ground-fallback.test.tsx` (after test file exists) |
| Full suite command | `npm test` (alias for `vitest run` — runs all matched tests) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISC-11 / NSV-01 | `CollectionFitCard.tsx` mostSimilar `<li>` wraps in `<Link href={\`/watch/\${watch.id}\`}>` | Grep assertion (in plan SUMMARY) + Phase 20 static guard survival | `grep -nE "<Link" src/components/insights/CollectionFitCard.tsx` AND `npx vitest run tests/static/CollectionFitCard.no-engine.test.ts` | ✅ static guard exists |
| DISC-11 / NSV-15 | Same component (same fix); affects `/catalog/{id}` page | (Same as NSV-01) | (Same) | ✅ static guard exists |
| DISC-11 / NSV-08 | `SleepingBeautiesSection.tsx` + `GoodDealsSection.tsx` rows wrap in `<Link>` | Grep evidence in plan SUMMARY (D-08) | `grep -nE "<Link\|<a " src/components/insights/SleepingBeautiesSection.tsx src/components/insights/GoodDealsSection.tsx` | N/A — verify-and-document only |
| DISC-11 / NSV-12 (200 path) | `/u/{user}/common-ground` returns 200 with fallback Card when overlap empty AND viewer follows owner | Integration (vitest + jsdom + React tree walk) | `npx vitest run tests/app/common-ground-fallback.test.tsx` | ❌ Wave 0 — create new file |
| DISC-11 / NSV-12 (404 paths) | `/u/{user}/common-ground` still 404s when gate fails (`!overlap`) and when profile not found (`!profile`) | Integration | (Same file as above) | ❌ Wave 0 — same file |
| Phase 20 D-04 invariant | `CollectionFitCard.tsx` does not import similarity / composer / server-only | Static guard (existing) | `npx vitest run tests/static/CollectionFitCard.no-engine.test.ts` | ✅ exists |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/static/CollectionFitCard.no-engine.test.ts tests/app/common-ground-fallback.test.tsx`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/app/common-ground-fallback.test.tsx` — covers DISC-11 / NSV-12 (200 path) AND (404 paths). Wave 0 creates this file before any code wave runs.
- [x] No framework install needed — vitest already in repo.
- [x] No shared fixtures needed — pattern matches `tests/app/profile-tab-insights.test.tsx` which uses inline per-test mock setup.

*Note: NSV-01+15 has no MANDATED unit test per D-07 (the Phase 20 static guard is sufficient — it survives, and the JSX edit is grep-verifiable). UI-SPEC § "Test Coverage Contract" marks NSV-01+15 component test as "planner discretion; not mandated." NSV-08 has no test — the verify-and-patch evidence is captured in plan SUMMARY, not a test file (D-08 mandate).*

## Security Domain

> `security_enforcement` not explicitly set in `.planning/config.json` — defaults to enabled. Below covers what's relevant to Phase 39's tight scope.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 39 ships no auth surface or auth-bypass risk. Existing auth via `getCurrentUser()` already handled upstream of Phase 39 changes. |
| V3 Session Management | no | No session-related changes. |
| V4 Access Control | **YES** | NSV-12 reshape touches a privacy-gated branch. The three-way gate (viewerId / !isOwner / collectionPublic) is single-sourced in `src/app/u/[username]/common-ground-gate.ts` and protected by `tests/app/layout-common-ground-gate.test.ts`. Phase 39 MUST NOT widen the gate — only the post-gate `overlap.hasAny === false` branch reshapes. **Pitfall 1 documents the specific failure mode.** |
| V5 Input Validation | no | Phase 39 reads existing typed props; no new user input surfaces. |
| V6 Cryptography | no | N/A. |
| V14 Configuration | no | N/A. |

### Known Threat Patterns for Phase 39 stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Existence-leak via inconsistent 404 vs 200 response | Information Disclosure | NSV-12 reshape MUST preserve `notFound()` on gate failures (`overlap === null` path). Only the `hasAny === false` path returns 200. **Pitfall 1 + integration test (404 path assertion) is the mitigation.** |
| Server-component leaking server-only modules to client | Information Disclosure | `[tab]/page.tsx` is a Server Component; the fallback Card / Link composition uses only client-safe primitives (`@/components/ui/card`, `@/components/ui/button buttonVariants`, `next/link`). No `'use client'` directive added. |
| Cross-user data leak through fallback Card body | Information Disclosure | The fallback Card body only references `profile.username` (the route param, public) and `profile.displayName` (already public-display). No private fields touched. **Verified against D-10 copy lock.** |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/39-audit-driven-discovery-polish/39-CONTEXT.md` — D-01..D-10 locked decisions; D-07/D-08/D-09/D-10 are load-bearing patch specs.
- `.planning/phases/39-audit-driven-discovery-polish/39-UI-SPEC.md` — className, copy, Card layout, Button composition pattern (verified against current `src/components/ui/button.tsx`).
- `.planning/REQUIREMENTS.md` line 43-46 — DISC-11 phase split definition.
- `.planning/ROADMAP.md` § Phase 39 — 5 success criteria.
- `src/components/insights/CollectionFitCard.tsx` (HEAD 2026-05-12) — verified lines 1-93; D-07 edit site at lines 69-78 within the `verdict.mostSimilar.length > 0` block at lines 63-81.
- `src/components/insights/SleepingBeautiesSection.tsx` (HEAD 2026-05-12) — verified lines 1-60; `<Link>` wrap confirmed at lines 43-51. **NSV-08 already shipped on this surface.**
- `src/components/insights/GoodDealsSection.tsx` (HEAD 2026-05-12) — verified lines 1-71; `<Link>` wrap confirmed at lines 47-63. **NSV-08 already shipped on this surface too.**
- `src/app/u/[username]/[tab]/page.tsx` (HEAD 2026-05-12) — verified; line 87 is `if (!overlap || !overlap.hasAny) notFound()`; D-09 reshape target.
- `src/app/u/[username]/common-ground-gate.ts` (HEAD 2026-05-12) — verified gate logic; three-way gate semantics confirmed.
- `src/components/ui/button.tsx` (HEAD 2026-05-12) — verified `buttonVariants` is exported (line 58); `Button` wraps `@base-ui/react/button` with NO `asChild` support (lines 1, 48-55).
- `tests/static/CollectionFitCard.no-engine.test.ts` (HEAD 2026-05-12) — verified forbidden import regex list (lines 22-39); `next/link` is NOT forbidden.
- `tests/app/profile-tab-insights.test.tsx` (HEAD 2026-05-12) — verified canonical mock-and-assert pattern for `[tab]/page.tsx` branch tests.
- `tests/app/layout-common-ground-gate.test.ts` (HEAD 2026-05-12) — verified gate-behavior test pattern; pins the three-way gate.
- `vitest.config.ts` (HEAD 2026-05-12) — verified test environment, alias, server-only shim.
- `package.json` (HEAD 2026-05-12) — verified all dependency versions.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md` — Next.js 16.2.3 official `notFound()` semantics.

### Secondary (MEDIUM confidence)
- `.planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` lines 83-101 — NSV-01/08/12/15 row definitions; high-leverage anchor for Phase 39 closure.
- Project-wide apostrophe convention (`&apos;` in JSX text) — verified by grep across 3 components (`GoodDealsSection.tsx:34`, `WatchPickerDialog.tsx:144`, `SearchPageClient.tsx:231`).

### Tertiary (LOW confidence)
- None — every claim in this research has at least one HIGH-confidence source.

## Project Constraints (from CLAUDE.md)

Extracted from `./CLAUDE.md` and `./AGENTS.md`:

| Constraint | Source | Phase 39 Impact |
|------------|--------|-----------------|
| **Tech stack: Next.js 16 App Router — continue with existing framework, no rewrites** | CLAUDE.md § Constraints | Phase 39 stays in App Router idioms; no Pages Router; no framework swap. |
| **Data model: Watch and UserPreferences types are established — extend, don't break existing structure** | CLAUDE.md § Constraints | Phase 39 reads existing typed props only; no schema or DAL changes; `Watch.id` already in `VerdictMostSimilar.watch`. |
| **Personal first: Single-user experience and data isolation must remain correct even after multi-user auth is added** | CLAUDE.md § Constraints | NSV-12 reshape preserves the three-way privacy gate (Pitfall 1 + V4 ASVS controls). |
| **Performance: Target <500 watches per user; no need for complex pagination or infinite scroll in MVP** | CLAUDE.md § Constraints | N/A — Phase 39 ships no list rendering or pagination work. |
| **"This is NOT the Next.js you know"** | AGENTS.md | Researcher consulted `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md` — confirmed `notFound()` semantics unchanged from training-data understanding for the Phase 39 use case. App Router only (no `pages/`). |
| **GSD Workflow Enforcement: Before Edit/Write, work through a GSD command** | CLAUDE.md § GSD Workflow | Phase 39 plans execute via `/gsd-execute-phase` (already in motion). |
| **Naming: Component files PascalCase.tsx; Non-component files camelCase.ts; Route segments kebab-case** | CLAUDE.md § Conventions | New test file: `tests/app/common-ground-fallback.test.tsx` — follows convention. |
| **Absolute imports via `@/*` (no relative `../../`)** | CLAUDE.md § Conventions | All Phase 39 imports use `@/...`. |
| **Type-only imports use `import type` syntax consistently** | CLAUDE.md § Conventions | No new type imports introduced by Phase 39; existing `import type { VerdictBundle }` in CollectionFitCard preserved. |
| **`'use client'` directive only when needed; Server Components by default** | CLAUDE.md § Conventions | Phase 39 NSV-12 stays server-rendered; no `'use client'` added. |
| **Tailwind CSS 4 utility classes inline in JSX — no CSS modules** | CLAUDE.md § Conventions | All Phase 39 className strings are inline Tailwind utilities. |
| **No barrel files (no `index.ts` re-exports)** | CLAUDE.md § Conventions | No new exports introduced. |

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every primitive verified by direct Read at HEAD; zero new deps.
- Architecture: HIGH — three patterns documented match existing established patterns (SleepingBeautiesSection Link wrap, profile-tab-insights.test.tsx test mock pattern, server-component inline branch return).
- Pitfalls: HIGH — Pitfall 1 (privacy boundary split) is the only non-trivial trap; Pitfalls 2-6 are mechanical and documented.
- Security: HIGH — V4 Access Control specifically addressed; existing three-way gate single-sourced and pinned by existing test.

**Research date:** 2026-05-12
**Valid until:** 2026-06-11 (30 days — Phase 39 is small mechanical patch work; underlying surface is stable)
