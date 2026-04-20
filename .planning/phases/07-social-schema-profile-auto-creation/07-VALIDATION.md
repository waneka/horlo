---
phase: 7
slug: social-schema-profile-auto-creation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x / vitest |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test -- --coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test -- --coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | DATA-02 | — | N/A | migration | `npx drizzle-kit migrate` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | DATA-03 | — | N/A | migration | `supabase db push --linked` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | DATA-04 | — | RLS blocks cross-user access | integration | `npm run test` | ❌ W0 | ⬜ pending |
| 07-01-04 | 01 | 1 | DATA-05 | — | Activity events written on mutations | integration | `npm run test` | ❌ W0 | ⬜ pending |
| 07-01-05 | 01 | 1 | DATA-06 | — | Wear events replace lastWornDate | integration | `npm run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test framework setup if not present
- [ ] Database test fixtures for new tables
- [ ] Stubs for RLS policy verification tests

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Profile auto-created on signup | DATA-03 | Requires Supabase auth flow | Create new user via Supabase dashboard, verify profile row exists |
| RLS blocks cross-user reads | DATA-04 | Requires Supabase User Impersonation | Use Supabase impersonation tool to query as User B, verify User A data invisible |
| Migration applies cleanly to prod | DATA-02 | Requires live Supabase project | Run `supabase db push --linked` against prod project |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
