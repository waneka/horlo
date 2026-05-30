---
phase: 66
slug: api-route-extension
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 66 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- tests/api/extract-watch.test.ts tests/extractors/llm-structured.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds (per-file ~5s; full suite ~30s) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- <touched test file>`
- **After every plan wave:** Run `npm run test -- tests/api tests/extractors` (route + extractor scope)
- **Before `/gsd-verify-work`:** `npm run build` (exit 0) and `npm run test` (full suite green)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

The planner fills this table from PLAN.md `<tasks>` entries. Below is the framing the planner must honor (one row per task, EXTR-IDs from CONTEXT.md mapped to test type):

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 66-01-* | 01 (llm-structured) | 1 | EXTR-04 | — | Strict tool-use returns ExtractedWatchData; no hallucinated brand/model | unit | `npm run test -- tests/extractors/llm-structured.test.ts` | ❌ W0 | ⬜ pending |
| 66-02-* | 02 (route extension) | 2 | EXTR-01, EXTR-02, EXTR-03, EXTR-08 | T-25-04-01 (sanitized errors) | Auth-first, mode dispatch, structured short-circuits before cheerio, upsertCatalogFromUserInput called (NOT upsertCatalogFromExtractedUrl), response includes `mode` field | integration | `npm run test -- tests/api/extract-watch.test.ts` | ✅ (exists, extend) | ⬜ pending |
| 66-03-* | 03 (regression + EXTR-02/08 pins) | 2 | EXTR-02, EXTR-08 (assertion) | — | URL branch unchanged (18-property contract from RESEARCH §URL-branch behavior contract) | regression | `npm run test -- tests/api/extract-watch.test.ts -t "URL branch"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/extractors/llm-structured.test.ts` — NEW file, stubs for EXTR-04 (mock `@anthropic-ai/sdk` Anthropic client; assert `tool_choice` forced, `input_schema` shape, response mapping to `ExtractedWatchData`)
- [ ] Extend `tests/api/extract-watch.test.ts` — add `mode: 'structured'` block with spies on `cheerio` (EXTR-02), `upsertCatalogFromUserInput` (EXTR-08 ✓), `upsertCatalogFromExtractedUrl` (EXTR-08 ✗)
- [ ] No new framework install — vitest already in package.json

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Anthropic API returns plausible specs for a popular reference (e.g. Rolex 116610LN) | EXTR-04 (quality) | LLM output quality is not deterministic; integration test mocks the SDK | After Phase 66 lands, `curl -X POST /api/extract-watch -d '{"mode":"structured","brand":"Rolex","model":"Submariner","reference":"116610LN"}'` and visually verify `caseSizeMm: 40`, `waterResistanceM: 300`, `movement` populated |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`tests/extractors/llm-structured.test.ts` is the only new test file)
- [ ] No watch-mode flags (`npm run test` runs once, not `--watch`)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
