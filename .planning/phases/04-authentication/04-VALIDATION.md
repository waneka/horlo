---
phase: 4
slug: authentication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. The planner fills in the per-task rows; this scaffold establishes the framework, commands, and sampling rate.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (TBD — Wave 0 installs if not present; confirm against Phase 3 test state) |
| **Config file** | `vitest.config.ts` (Wave 0 creates if missing) |
| **Quick run command** | `npx vitest run --reporter=dot tests/auth` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15–30 seconds (auth suite) / ~60 seconds (full) |

> **Note:** Phase 3 test state not inspected during research (flagged in RESEARCH.md). Wave 0 must verify whether vitest is already installed+configured; if not, Wave 0 installs and configures it. If Phase 3 landed on a different runner (jest, node:test), the planner should reconcile before creating tasks.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot tests/auth`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green + manual UAT items signed off
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Planner fills this table during plan creation. Every task that touches auth/session behavior must have a row pointing to an automated command OR a Wave 0 dependency that creates the missing infrastructure.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *TBD by planner* | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Planner must include these as explicit Wave 0 tasks (or confirm equivalent Phase 3 state):

- [ ] `tests/auth/getCurrentUser.test.ts` — stubs for AUTH-02, AUTH-03
- [ ] `tests/auth/proxy.test.ts` — stubs for AUTH-02 proxy matcher behavior
- [ ] `tests/auth/idor.test.ts` — stubs for AUTH-03 cross-user access denial
- [ ] `tests/auth/extract-watch-authz.test.ts` — stubs for AUTH-04 / SEC-01 layering
- [ ] `tests/fixtures/users.ts` — multi-user seed helper (two real Supabase Auth users)
- [ ] `vitest.config.ts` + `npm i -D vitest @vitest/coverage-v8` — if Phase 3 did not install a runner
- [ ] Install `@supabase/ssr` + `@supabase/supabase-js` (dependency, not dev) — required by app code and tests
- [ ] Confirm local Supabase stack is running (flagged: `supabase/` dir missing — may need `supabase init && supabase start`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sign-up → immediately logged in (email verification off) | AUTH-01 | End-to-end browser flow through real Supabase Auth + cookies | 1. `npm run dev` 2. Visit `/signup`, submit new email+password 3. Confirm redirect to `/` 4. Confirm header shows user menu |
| Log out clears session | AUTH-01 | Header dropdown + Server Action form POST in browser | 1. While logged in, open header menu 2. Click Log out 3. Confirm redirect to `/login` 4. Confirm protected routes now redirect back to `/login?next=...` |
| Password reset email delivery | AUTH-01 | Requires SMTP / local Inbucket inspection | 1. Visit `/forgot-password`, submit email 2. Open `localhost:54324` (Supabase Inbucket) 3. Click reset link 4. Set new password on `/reset-password` 5. Confirm login with new password works |
| Proxy log line confirms execution on protected route | AUTH-02 success criterion 2 | Requires watching dev server stdout | 1. `npm run dev` 2. Visit `/` while logged in 3. Confirm `proxy.ts` log line appears in terminal |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (vitest, @supabase/ssr, supabase local stack, multi-user fixture)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter after planner completes the per-task map

**Approval:** pending
