---
phase: 80
slug: not-null-constraint-flip-ingest-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-25
---

# Phase 80 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- catalog-resolver` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5 seconds quick / ~60 seconds full |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- catalog-resolver`
- **After every plan wave:** Run `npm run test` (full suite) + Local-First Verification Recipe Step 2 (manual extract proof)
- **Before `/gsd-verify-work`:** Full suite green + manual prod extract proof + NOT NULL migration applied locally
- **Max feedback latency:** ~5 seconds (quick) / ~60 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 80-01-01 | 01 | 1 | INGEST-01 | T-80-V5 | Exact `name_normalized` match attaches existing `brand_id` (no fuzzy, no new row) | unit | `npm run test -- catalog-resolver` | ❌ W0 | ⬜ pending |
| 80-01-02 | 01 | 1 | INGEST-02 | T-80-V5 | Fuzzy clear-gap (≥0.6 with ≥0.1 runner-up gap) attaches matched `brand_id` + logs `fuzzy_brand_match` | unit | `npm run test -- catalog-resolver` | ❌ W0 | ⬜ pending |
| 80-01-03 | 01 | 1 | INGEST-02 | T-80-V5 | Fuzzy ambiguous (top within 0.1 of runner-up) falls through to auto-create, NOT silent guess | unit | `npm run test -- catalog-resolver` | ❌ W0 | ⬜ pending |
| 80-01-04 | 01 | 1 | INGEST-03 | T-80-V5 | No candidates auto-creates `brands` row with `needs_review=true` + emits `brand_auto_created` event | unit | `npm run test -- catalog-resolver` | ❌ W0 | ⬜ pending |
| 80-01-05 | 01 | 1 | INGEST-04 | T-80-V5 | Family exact match on `name_normalized` scoped to resolved `brand_id` | unit | `npm run test -- catalog-resolver` | ❌ W0 | ⬜ pending |
| 80-01-06 | 01 | 1 | INGEST-04 | T-80-V5 | Family alias hit via `aliases @>` containment beats fuzzy tier | unit + integration | `npm run test -- catalog-resolver` + local-DB integration | ❌ W0 | ⬜ pending |
| 80-01-07 | 01 | 1 | INGEST-04 | T-80-V5 | Family fuzzy `word_similarity ≥ 0.6` attaches family_id + logs `fuzzy_family_match` | unit | `npm run test -- catalog-resolver` | ❌ W0 | ⬜ pending |
| 80-01-08 | 01 | 1 | INGEST-04 | T-80-V5 | Family no-match auto-creates `watch_families` row with `needs_review=true` scoped to brand | unit | `npm run test -- catalog-resolver` | ❌ W0 | ⬜ pending |
| 80-02-01 | 02 | 2 | INGEST-01, 02, 03 | T-80-A1 | `upsertCatalogFromExtractedUrl` invokes resolver and writes both FKs to catalog row | integration | `npm run test -- upsertCatalogFromExtractedUrl` | ❌ W0 | ⬜ pending |
| 80-03-01 | 03 | 2 | INGEST-01, 04 | T-80-A1 | `upsertCatalogFromUserInput` invokes resolver and writes both FKs to catalog row | integration | `npm run test -- upsertCatalogFromUserInput` | ❌ W0 | ⬜ pending |
| 80-04-01 | 04 | 3 | CANON-01 | T-80-NN | `brand_id IS NULL` insert raises `23502` not-null violation after migration | integration | `npm run test -- 80-not-null-constraint` | ❌ W0 | ⬜ pending |
| 80-04-02 | 04 | 3 | CANON-02 | T-80-NN | `family_id IS NULL` insert raises `23502` not-null violation after migration | integration | `npm run test -- 80-not-null-constraint` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs use `{phase}-{plan}-{seq}` shorthand; actual IDs assigned at planning time. Plan + Wave columns are research-recommended (planner picks final decomposition — see Open Questions in RESEARCH.md).*

---

## Wave 0 Requirements

- [ ] `tests/unit/data/catalog-resolver.test.ts` — 8 unit cases (INGEST-01..04 all branches incl. ambiguous fuzzy + family alias precedence)
- [ ] `tests/integration/data/catalog-resolver-against-local-db.test.ts` — INGEST-04 alias path verified end-to-end against local Supabase
- [ ] `tests/integration/migrations/80-not-null-constraint.test.ts` — CANON-01 + CANON-02 (`23502` assertions on NULL inserts)
- [ ] Framework install: NONE — vitest 3.x already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Manual prod extract proves both FKs populated before NOT NULL flip | CANON-01, CANON-02 (D-80-03 staged deploy step 2) | Production-side proof gate — must run between ingest deploy and migration push; cannot be automated (uses prod data + real Vercel logs) | After ingest code lands on prod: extract one URL for a known brand+model (e.g. Hamilton Khaki Field); query `SELECT brand_id, family_id FROM watches_catalog WHERE id = '...'`; both must be non-NULL. Verify Vercel logs show NO `brand_auto_created` for a known brand. Then run `supabase db push --linked`. |
| `fuzzy_brand_match` Vercel log payload contains expected fields | INGEST-02 (D-80-04) | Log format inspection against Vercel's log explorer | After fuzzy clear-gap path fires in prod, find the `[extract-watch] fuzzy_brand_match` log entry in Vercel logs and verify: `input_raw`, `decision`, `matched_id`, `matched_name`, `score`, `runner_up_*` (when present) are all present and JSON-parseable. |
| Local-First Verification Recipe — 4 URL extractions | INGEST-01..04 (full path coverage) | Required before push per CLAUDE.md § Local-First Development; exercises real LLM extraction + DB writes through `npm run dev` | See `80-RESEARCH.md` § Local-First Verification Recipe — 4 URLs (exact-match, fuzzy clear-gap, no-match auto-create, alias-resolved family); each followed by verification SQL against `127.0.0.1:54322`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (3 test files listed above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60 seconds (full) / < 5 seconds (quick)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
