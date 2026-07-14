# Phase 80: NOT NULL Constraint Flip + Ingest Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-25
**Phase:** 80-not-null-constraint-flip-ingest-hardening
**Areas discussed:** Fuzzy match tie-breaks, Family resolution order, Migration + code-release sequencing, Log event + response signal
**User tone request:** "in plain english please" — discussion held in plain prose without acronym walls. CONTEXT.md preserves technical precision for downstream agents; this log + any operator-facing artifacts (POST-DEPLOY.md, README comments) keep the accessible tone.

---

## Fuzzy match tie-breaks

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse to pick — auto-create needs_review row | If two or more brands clear the 0.6 threshold, the resolver does not guess. Creates a new brand row from the typed string with needs_review = true. Matches Phase 78 D-78-04's "exact-only auto-resolve" philosophy. Costs one extra brand row per ambiguous case. | |
| Pick highest score, log runner-ups | Always pick the top score. Log runner-ups in the fuzzy_brand_match event for audit. Faster, fewer needs_review rows. Risk: Hamilton vs Hamilton Watch (the EXACT case Phase 79 just merged) could flip-flop based on tiny scoring drift. | |
| Pick highest only if there's a clear gap; otherwise auto-create | Pick top score only if it beats next-best by ≥ 0.1. Otherwise treat as ambiguous and auto-create. Middle ground — fewer needs_review rows than option A, safer than B in the near-tie zone. | ✓ |

**User's choice:** Clear-gap rule (option 3)
**Notes:** Locked as D-80-01. The 0.1 delta is the constant; both candidates logged for operator audit. Hamilton vs Hamilton Watch was the implicit motivating example — Phase 79 just merged that exact pair, and we want fuzzy-ingest to not reverse the merge under near-tie scoring.

---

## Family resolution order

| Option | Description | Selected |
|--------|-------------|----------|
| Exact → alias → fuzzy → auto-create | Try exact name first (cheapest, most explicit). Then aliases array (catches Phase 79's operator decisions like Brut Date → Brut Datejust). Then fuzzy. Only auto-create if all three fail. | ✓ |
| Alias → exact → fuzzy → auto-create | Aliases trump exact names. Defensive ordering useful if an exact-match family was accidentally created. In practice rarely matters since Phase 80 auto-create can't reintroduce the Brut Date conflict. | |
| Same as option 1, but apply the same clear-gap rule to family fuzzy | Symmetric to D-80-01 for families. If two families both clear 0.6 within 0.1 of each other, auto-create instead. | |

**User's choice:** Option 1
**Notes:** Locked as D-80-02. The user explicitly did NOT pick the symmetric clear-gap rule for family fuzzy — family lookups are already brand-scoped and per-brand family counts are small enough that multi-family ties are rare. Asymmetric resolver behavior between brand and family is deliberate.

---

## Migration + code-release sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Staged: ingest first, soak, then flip | Deploy ingest code → manual prod extract proves brand_id + family_id land → then run supabase db push --linked. Slowest, safest. Soak step catches "I forgot to wire the resolver into one of the two upsert paths" before the door slams shut. | ✓ |
| Bundled: push code and migration in close sequence | Vercel deploys ingest code; immediately push migration. ~30-second window where new code runs with old constraints (harmless). Faster, fewer steps. Risk: a silent regression that drops brand_id won't surface until the migration runs and starts rejecting writes. | |
| Migration in its own SQL file, code+migration in one commit, staged push | Same execution as option 1 but documented as a single Phase 80 deliverable. Audit trail reads as one change set. | |

**User's choice:** Staged (option 1)
**Notes:** Locked as D-80-03. Three ordered steps for prod: deploy ingest code → one manual URL extract proving FK columns populate → run migration. Migration is its own additive SQL file per `[[drizzle-supabase-db-mismatch]]`. Matches Phase 79 POST-DEPLOY's forward-armor note explicitly deferring CANON-01/02 to Phase 80.

---

## Log event + response signal

| Option | Description | Selected |
|--------|-------------|----------|
| Structured console.log, response silent | console.log('[extract-watch] fuzzy_brand_match', { input_raw, decision, matched_id, matched_name, score, runner_up_* }). Response shape unchanged. AddWatchFlow keeps working zero-change. Operator audits through Vercel logs + Phase 82 admin queue. Matches "user flow has no visible delay" + "user flow never blocks". | ✓ |
| Structured log + response carries a resolution field | Same log shape AND response gains optional brandResolution: { kind, brandId, brandName } (same for family). AddWatchFlow can display "We added 'Héron Watches' — operator will review" hints. Costs client-side update and response contract expansion. | |
| Structured log, response silent, but emit a needsReview boolean | Single boolean on response when EITHER brand or family was auto-created. Generic "this brand is new" chip without leaking mechanism. Lighter than option B; less informative. | |

**User's choice:** Silent response + structured log (option 1)
**Notes:** Locked as D-80-04. Four event types: fuzzy_brand_match, fuzzy_family_match, brand_auto_created, family_auto_created. Family events include brand_id (scope). Response envelope unchanged: existing `{ success, catalogId, catalogIdError, ...result, mode }`. AddWatchFlow needs zero client-side changes. Adding a response field is forward-compatible — a future phase can add it without breaking existing clients.

---

## Claude's Discretion

- **Resolver module location** — single helper module exporting `resolveBrandId` + `resolveFamilyId`. Planner picks file (`src/lib/catalog/resolver.ts` vs `src/data/catalog-resolver.ts` vs inline in `src/data/catalog.ts`).
- **Empty/whitespace `model_raw` handling** — planner picks: (a) treat as NULL family path (not possible after NOT NULL flip), (b) auto-create placeholder family `(unspecified)` with needs_review = true, (c) extend route's empty-gate to also fail when model is empty. Recommended (b); planner can argue (c) from the test surface.
- **Re-extract behavior on ON CONFLICT** — recommend DO NOTHING on brand_id / family_id (don't reverse operator merges in /admin/brands). Planner can override.
- **Idempotency + test strategy** — vitest vs integration split is planner's call; fixtures must cover the six resolution paths (exact, fuzzy clear gap, fuzzy ambiguous, no candidates, family alias, family fuzzy).
- **Trigram GIN index on `brands.name_normalized`** — fuzzy match runs sequential scans against ~50 brand rows at v8.4 scale; no perf risk. Planner picks whether to add the index here or defer.
- **Migration filename + ordering** — timestamp must be later than Phase 78's `20260624000000`. Verify at write time per `[[drizzle-supabase-db-mismatch]]` filename rule.

## Deferred Ideas

- Threshold tuning beyond 0.6 — Phase 82+ admin surface.
- Telemetry table for fuzzy match decisions — v9+ if Vercel-logs aggregation becomes painful.
- `brandResolution` / `familyResolution` field on API response — forward-compatible to add later when client needs the signal.
- Re-extract resolver re-run + UPDATE brand_id / family_id on conflict — Phase 82+ coupled with admin merge actions.
- Per-row needs_review extended grammar — already deferred from Phase 79; not needed since Phase 82 queue UI is the right surface.
- Operator dry-run preview of resolver decisions — Phase 79's `--apply` dry-run covered the batch audit; per-extract dry-run not needed.
- Bundled deploy (option B in Q3) — rejected in favor of staged.
- Symmetric clear-gap rule on family fuzzy (option 3 in Q2) — rejected; family lookups are brand-scoped.
