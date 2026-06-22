---
phase: 76
slug: video-schema-storage-paths-server-action
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-22
---

# Phase 76 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- --run <file>` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run <relevant file>`
- **After every plan wave:** Run `npm run test -- --run` (full suite)
- **Before `/gsd-verify-work`:** Full suite + `npm run build` (exit 0) must both be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Populated by the planner. One row per task; map every REQ to at least one row. See `76-RESEARCH.md` for the Phase 15 Parity Table → testable invariants.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | VID-07 | T-76-PATH | Server-constructed `{userId}/{wearEventId}.mp4` path; client-supplied path rejected | unit | `npm run test -- --run wearEventsVideo` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VID-08 | T-76-PROBE | Both `.mp4` and `-poster.jpg` probed BEFORE INSERT; missing object → reject | unit | `npm run test -- --run wearEventsVideo` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VID-09 | T-76-SIZE | Video > 5 MB rejected with client-displayable error | unit | `npm run test -- --run wearEventsVideo` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VID-10 | T-76-COMPENSATE | INSERT failure best-effort deletes both Storage objects | unit | `npm run test -- --run wearEventsVideo` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VID-11 | — | Existing photo rows readable post-migration; `photo_url` untouched | integration | `npm run test -- --run wearEventsMigration` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VID-12 | — | media_type='video' row persists with both paths non-NULL (CHECK constraint) | integration | `npm run test -- --run wearEventsVideo` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VID-16 | T-76-IDOR | Path must start with `${currentUser.id}/`; other-user prefix rejected | unit | `npm run test -- --run wearEventsVideo` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/wearEventsVideo.test.ts` — stubs for VID-07/08/09/10/12/16
- [ ] `tests/wearEventsMigration.test.ts` — VID-11 photo-row preservation (additive migration check)
- [ ] Shared Supabase test fixtures (reuse existing wear-events test helpers from Phase 15 path)

*Existing vitest infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Storage RLS bucket SELECT policy for `.mp4` filename UUID extraction (research open question #3) | VID-16 | Requires real Supabase Storage + bucket policy evaluation; not reproducible in jsdom | After deploy: upload .mp4 as user A, attempt SELECT signed-URL as user B → 403 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
