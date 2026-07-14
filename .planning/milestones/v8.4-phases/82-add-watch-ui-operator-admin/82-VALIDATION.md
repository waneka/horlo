---
phase: 82
slug: add-watch-ui-operator-admin
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-13
---

# Phase 82 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (configured, existing test suite) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/components/watch/BrandPicker.test.tsx src/app/actions/__tests__/cms-brands.test.ts src/app/actions/__tests__/cms-families.test.ts --reporter=verbose` |
| **Full suite command** | `npx vitest run && npm run build` |
| **Estimated runtime** | ~90 seconds (vitest ~30s + build ~60s) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/watch/BrandPicker.test.tsx src/app/actions/__tests__/cms-brands.test.ts src/app/actions/__tests__/cms-families.test.ts`
- **After every plan wave:** Run `npx vitest run && npm run build`
- **Before `/gsd-verify-work`:** Full suite green + `npm run build` exit 0 + local-first walkthrough
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 82-01-* | 01 | 1 | UI-01 | — | BrandPicker renders, filters, selects | unit/jsdom | `npx vitest run src/components/watch/BrandPicker.test.tsx` | ❌ W0 | ⬜ pending |
| 82-01-* | 01 | 1 | UI-02 | — | Affordance mount+close (assert-disappearance-too) | unit/jsdom | same | ❌ W0 | ⬜ pending |
| 82-02-* | 02 | 1 | UI-01 | — | StructuredEntryPanel threads `brands` prop | unit/jsdom | `npx vitest run src/components/watch/StructuredEntryPanel.test.tsx` | ⚠️ extend | ⬜ pending |
| 82-03-* | 03 | 2 | UI-03 | T-82-04 | Read-only chip renders when catalogId!=null | unit/jsdom | `npx vitest run src/components/watch/WatchForm.test.tsx` | ❌ W0 | ⬜ pending |
| 82-03-* | 03 | 2 | UI-03 | T-82-04 | Admin link cluster hidden when viewerIsAdmin=false | unit/jsdom | same | ❌ W0 | ⬜ pending |
| 82-04-* | 04 | 2 | OPS-01 | T-82-01 | confirmBrandAsNew unauth → error envelope | unit | `npx vitest run src/app/actions/__tests__/cms-brands.test.ts` | ❌ W0 | ⬜ pending |
| 82-04-* | 04 | 2 | OPS-01 | T-82-02 | renameBrand Zod .strict() rejects unknown keys | unit | same | ❌ W0 | ⬜ pending |
| 82-04-* | 04 | 2 | OPS-01 | T-82-01 | mergeBrand unauth → error envelope | unit | same | ❌ W0 | ⬜ pending |
| 82-05-* | 05 | 2 | OPS-02 | T-82-01 | addFamilyAlias unauth → error envelope | unit | `npx vitest run src/app/actions/__tests__/cms-families.test.ts` | ❌ W0 | ⬜ pending |
| 82-05-* | 05 | 2 | OPS-02 | T-82-01 | removeFamilyAlias unauth → error envelope | unit | same | ❌ W0 | ⬜ pending |
| 82-06-* | 06 | 3 | OPS-01/02 | T-82-03 | Merge transaction atomicity (source→target family+catalog refs, source deleted) | integration | local Supabase fixture | ❌ W0 (optional) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/watch/BrandPicker.test.tsx` — new file; covers UI-01/02 (filter, select, affordance mount+close per `[[assert-disappearance-too]]`)
- [ ] `src/components/watch/WatchForm.test.tsx` — new file; covers UI-03 (chip render vs Input fallback, admin-link visibility gate 4 cases)
- [ ] `src/app/actions/__tests__/cms-brands.test.ts` — new file; covers OPS-01 auth gate + Zod `.strict()` (3 actions × 2 cases)
- [ ] `src/app/actions/__tests__/cms-families.test.ts` — new file; covers OPS-02 auth gate + Zod `.strict()` (4 actions × 2 cases)
- [ ] Extend `src/components/watch/StructuredEntryPanel.test.tsx` — add test for `brands` prop threading to BrandPicker
- [ ] vitest + jsdom already installed — no framework install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| BrandPicker interaction on iPhone Safari | UI-01/02 | Mobile-Safari behavior verifies on prod per `[[mobile-ui-verify-on-prod]]` | Deploy → open `/watch/new` on iPhone Safari → type unknown brand → tap "Couldn't find" affordance → verify popup closes and typed string is locked → tap Find specs → verify no block |
| /admin/brands merge with 1+ families | OPS-01 | SQL transaction atomicity not asserted by unit tests | `npm run dev` → sign in as admin → seed a source brand with 1 family + 1 catalog row → hit /admin/brands → click Merge into… → confirm pre-flight radiogroup fires → assert target has both refs + source deleted (`select * from brands where id = source_id` returns 0 rows) |
| /admin/families add-alias round-trip | OPS-02 | Aliases feed back into resolver tier-2 — must exercise ingest to prove | Admin: add alias "Brut Date" to Rolex Datejust family → `/watch/new` → structured entry with brand=Rolex, model="Brut Date" → Find specs → assert resolved to Datejust family via alias tier |
| WatchForm chip render on catalogId=null legacy watch | UI-03 | Rare edge case; hard to seed synthetically | Manually update a local watch row `set catalog_id = null` → visit `/w/[ref]/edit` → verify Input still editable |
| Deep-link `/admin/brands#brand-{id}` scroll+highlight | UI-03 | Visual pulse animation not unit-testable | Admin: click "Edit brand" from WatchForm → verify scroll to row + brief background highlight |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
