---
phase: 41
slug: account-danger-zone-branded-auth-emails-parallel-track
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-15
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest `^2.1.9` + `@testing-library/react` `^16.3.2` + jsdom `^25.0.1` |
| **Config file** | `vitest.config.ts` (does NOT auto-load `.env.local` — STATE.md Phase 36-04 lesson) |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | full suite ~30-60s (planner estimate; confirm during Wave 0) |

> DB-touching integration tests require env: `set -a; source .env.local; set +a; npx vitest run <file>`.
> Project baseline is ~48-51 pre-existing failing tests and ~27-28 tsc errors — measure regression delta, not absolute zero.

---

## Sampling Rate

- **After every task commit:** `npx vitest run <touched-test-file>`
- **After every plan wave:** `npm test -- --run` (full suite)
- **Before `/gsd-verify-work`:** Full suite green (no regression delta) + `npm run build` exit 0
- **Max feedback latency:** < 60s per quick run

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 41-01-T1 | 01 | 1 | SET-14 | T-41-01 | react-email is a devDependency only (not shipped to app bundle) | config | `node -e` package.json + .gitignore check | ✅ (this plan creates) | ⬜ pending |
| 41-01-T2 | 01 | 1 | SET-13 / SET-14 | T-41-02 | RED scaffolds carry no secret values; env-gated skips | scaffold | `npx vitest run` (5 RED files collect) | ✅ (this plan creates) | ⬜ pending |
| 41-01-T3 | 01 | 1 | SET-13 | — | service-role env var name confirmed by operator | checkpoint | (human-action checkpoint) | N/A | ⬜ pending |
| 41-01-T4 | 01 | 1 | SET-13 | T-41-01 | `.env.example` carries redacted placeholder only | config | `grep -E 'SUPABASE_SERVICE_ROLE_KEY' .env.example` | ✅ | ⬜ pending |
| 41-02-T1 | 02 | 2 | SET-13 | T-41-04 | service-role client server-only, per-call, RLS-bypassing | source | `node -e` admin.ts assertion | ❌ Wave 0 (41-01) | ⬜ pending |
| 41-02-T2 | 02 | 2 | SET-13 | T-41-03, T-41-06 | wipeCollection scoped to caller's own id; storage purge before DB delete | integration | `npx vitest run tests/integration/account-wipe.test.ts` | ❌ Wave 0 (41-01) | ⬜ pending |
| 41-02-T3 | 02 | 2 | SET-13 | T-41-03, T-41-05, T-41-07 | deleteAccount purges storage first, deletes public.users explicitly, scoped to caller | integration | `npx vitest run tests/integration/account-delete.test.ts` | ❌ Wave 0 (41-01) | ⬜ pending |
| 41-03-T1 | 03 | 3 | SET-13 | T-41-08, T-41-09 | WipeCollectionModal: re-auth precedes action; WIPE-gated execute button | component | `npx vitest run tests/components/WipeCollectionModal.test.tsx` | ❌ Wave 0 (41-01) | ⬜ pending |
| 41-03-T2 | 03 | 3 | SET-13 | T-41-08, T-41-09, T-41-11 | DeleteAccountModal: re-auth precedes action; DELETE-gated; sign-out + redirect | component | `npx vitest run tests/components/DeleteAccountModal.test.tsx` | ❌ Wave 0 (41-01) | ⬜ pending |
| 41-03-T3 | 03 | 3 | SET-13 | — | DangerZoneSection client island; AccountSection stays Server Component | build | `npm run build` exit 0 | N/A (build gate) | ⬜ pending |
| 41-04-T1 | 04 | 2 | SET-14 | T-41-15 | emails/ build-excluded; no leak into Next build | config | `node -e` tsconfig.json exclude check | ✅ | ⬜ pending |
| 41-04-T2 | 04 | 2 | SET-14 | T-41-13 | HorloEmailLayout: hex colors only, no oklch, dark-mode meta | source | `node -e` HorloEmailLayout.tsx assertion | ✅ (this plan creates) | ⬜ pending |
| 41-04-T3 | 04 | 2 | SET-14 | T-41-12 | exported HTML carries literal {{ .ConfirmationURL }}, no oklch | static | `npx vitest run tests/static/email-templates.test.ts` | ❌ Wave 0 (41-01) | ⬜ pending |
| 41-04-T4 | 04 | 2 | SET-14 | T-41-14 | HTML pasted into Supabase dashboard; cross-client verified | checkpoint | (human-action checkpoint) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Plan 41-01 IS the Wave 0 scaffold. It creates these MISSING test files (RESEARCH §Validation Architecture, Wave 0 Gaps):

- [ ] `tests/integration/account-wipe.test.ts` — SET-13 Wipe scope (DB-env-gated per Phase 36-04 `set -a; source .env.local` pattern)
- [ ] `tests/integration/account-delete.test.ts` — SET-13 Delete scope + storage-before-DB ordering + `public.users` cascade
- [ ] `tests/components/WipeCollectionModal.test.tsx` — type-to-confirm `WIPE` gate + step flow
- [ ] `tests/components/DeleteAccountModal.test.tsx` — type-to-confirm `DELETE` gate + step flow
- [ ] `tests/static/email-templates.test.ts` — exported HTML static properties (SET-14)
- [ ] Framework install: `npm install --save-dev react-email @react-email/components` (Track B)

Plans 41-02, 41-03, 41-04 each turn their corresponding RED files GREEN. Plan 41-01 is `autonomous: false` (carries the service-role env var operator checkpoint) and must complete before 41-02/03/04.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-client email rendering (Apple Mail iOS dark mode, Outlook MSO, Gmail web) | SET-14 SC#4 | No automated email-client renderer in-project; would require a paid service (Litmus / Email on Acid) | Plan 41-04 Task 4 checkpoint — paste exported HTML into the Supabase dashboard, trigger each email against a real address, verify wordmark + CTA render in brand gold (not black) across all three clients |
| Service-role env var name confirmation | SET-13 | The exact var name (legacy `service_role` vs newer `secret`) is dashboard state no tool can read | Plan 41-01 Task 3 checkpoint — operator confirms the name against the live Supabase dashboard and adds the key to `.env.local` + Vercel |
| End-to-end Wipe / Delete against a real account | SET-13 | The integration tests verify the actions; a full UAT walk (open modal, type keyword, re-auth, observe toast / redirect) is a human flow | `/gsd-verify-work` UAT — exercise both modals on `/settings#account` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are checkpoint / Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (checkpoints 41-01-T3 / 41-04-T4 are bracketed by automated tasks)
- [x] Wave 0 covers all MISSING references (41-01 creates all 5 test files)
- [x] No watch-mode flags (all commands use `vitest run`)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
