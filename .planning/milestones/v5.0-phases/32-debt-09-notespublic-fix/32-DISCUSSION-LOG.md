# Phase 32: DEBT-09 notesPublic Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 32-debt-09-notespublic-fix
**Areas discussed:** Revalidate path + selector, Conditional vs always revalidate, removeWatch parity, ROADMAP correction strategy

---

## Conflict surfaced before discussion

A direct conflict was identified during `analyze_phase` between the v5.0 ROADMAP wording and the Phase 23 test scaffold. Surfaced explicitly to the user with full evidence:

| Source | Path / selector |
|---|---|
| ROADMAP success criterion #4 (v5.0, written 2026-05-06) | `revalidatePath('/u/[username]/[tab]', 'page')` |
| Test scaffold `tests/actions/watches.notesPublic.test.ts:131,158` | `revalidatePath('/u/[username]', 'layout')` |
| Phase 23 D-19 contract `23-VERIFICATION.md:143` | `revalidatePath('/u/[username]', 'layout')` |
| `notes.ts` WR-07 finding (lines 53–58, 108–113) | `'/u/[username]', 'layout'` (with explanatory note that the dynamic-segment + 'page' selector silently no-ops) |
| Codebase precedent | 5/6 sibling actions use the layout pattern; only `wishlist.ts:206` uses the tab/page pattern |

---

## Revalidate path + selector

| Option | Description | Selected |
|--------|-------------|----------|
| Honor the test (`'/u/[username]', 'layout'`) | Phase 23 D-19, WR-07, dominant codebase pattern, GREEN-test contract | ✓ (Claude discretion — see CONTEXT.md D-01) |
| Honor the ROADMAP wording (`'/u/[username]/[tab]', 'page'`) | Matches success criterion #4 literal text; would break the existing test (silent no-op per WR-07) | |
| Both calls (defense-in-depth) | Two revalidate calls per write; one of them is a known no-op | |

**User's choice:** "you can choose for this phase"
**Notes:** Locked as D-01 in CONTEXT.md. The test contract takes precedence over ROADMAP wording when they conflict because criterion #1 (4/4 GREEN) is the most concrete bar.

---

## Conditional vs always revalidate

| Option | Description | Selected |
|--------|-------------|----------|
| Unconditional revalidate | Fire on every successful add/edit regardless of whether notesPublic is in payload | ✓ (Claude discretion — see CONTEXT.md D-02) |
| Gated on `'notesPublic' in parsed.data` | Skip revalidate when payload doesn't touch the field | |

**User's choice:** "you can choose for this phase"
**Notes:** Locked as D-02 in CONTEXT.md. Unconditional matches ROADMAP wording ("after every successful write") and the unconditional pattern of `notes.ts` / `profile.ts` / `follows.ts`.

---

## removeWatch parity

| Option | Description | Selected |
|--------|-------------|----------|
| Stay strictly in DEBT-09 scope | Only modify addWatch/editWatch; removeWatch untouched | ✓ (Claude discretion — see CONTEXT.md D-04) |
| Add revalidate to removeWatch too | One-line consistency fix for the deletion-staleness bug on /u/{user}/notes | |
| Add revalidate + parity test | Same as above plus a test row to keep changes provable | |

**User's choice:** "you can choose for this phase"
**Notes:** Locked as D-04. Captured the deletion-staleness gap as a deferred idea in CONTEXT.md `<deferred>`.

---

## ROADMAP correction strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Edit ROADMAP.md inline + CONTEXT.md amendment | Fix success criterion #4 wording in the same PR as the action change | ✓ (Claude discretion — see CONTEXT.md D-05) |
| CONTEXT.md amendment only | Leave ROADMAP wrong; document deviation only in this phase's CONTEXT | |
| Leave as-is | No correction recorded | |

**User's choice:** "you can choose for this phase"
**Notes:** Locked as D-05. The doc fix and the implementation that satisfies it ship together so the audit trail is internally consistent.

---

## Claude's Discretion

User answered "you can choose for this phase" to the umbrella gray-area selection question, delegating all four decisions to Claude. Decisions D-01 through D-06 were made and locked in CONTEXT.md. The user retains the option to redirect any decision before `/gsd-plan-phase 32` runs.

## Deferred Ideas

- `removeWatch` parity revalidate — captured as future polish (see CONTEXT.md `<deferred>`).
- `wishlist.ts:206` pattern divergence — flagged for future hygiene pass (see CONTEXT.md `<deferred>`).
- Cross-action revalidate audit — broader sweep candidate (see CONTEXT.md `<deferred>`).
