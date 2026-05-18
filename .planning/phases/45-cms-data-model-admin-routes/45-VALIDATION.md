---
phase: 45
slug: cms-data-model-admin-routes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — see `src/data/__tests__/`, `src/app/actions/__tests__/`) |
| **Config file** | (existing project test config) |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run && npm run lint && npx tsc --noEmit` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> Populated by the planner per task. The validation-sensitive behaviors for
> this phase are below — every plan covering them must carry an automated
> verify or a Wave 0 dependency.

| Behavior | Plan | Requirement | Test Type | Automated Command | Status |
|----------|------|-------------|-----------|-------------------|--------|
| RLS exposes only published lists/paths to non-owners | TBD | CMS-01, CMS-06 | integration | non-owner authenticated query asserts draft rows absent | ⬜ pending |
| RLS write policies reject non-owner writes to CMS tables | TBD | CMS-01, CMS-02 | integration | non-owner write rejected by policy | ⬜ pending |
| `assertOwner()` rejects non-owner Server Action calls | TBD | CMS-02 | unit | action returns failure / throws for non-admin user | ⬜ pending |
| `/admin/*` layout guard redirects non-owners | TBD | CMS-02 | manual | see Manual-Only table | ⬜ pending |
| Zero-watch list cannot be published | TBD | CMS-06 | unit | publish action rejects a list with 0 items | ⬜ pending |
| FK RESTRICT blocks deleting a referenced catalog watch | TBD | CMS-09 | integration | delete of referenced `watches_catalog` row raises FK error | ⬜ pending |
| List/item/path-node reorder persists order | TBD | CMS-04, CMS-05, CMS-07 | unit | reorder action yields expected order sequence | ⬜ pending |
| Hero pin set / clear writes `cms_settings` + revalidates | TBD | CMS-08 | unit | pin/clear action updates row; `revalidateTag('explore:hero','max')` called | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install react-markdown` — not yet installed (per RESEARCH.md)
- [ ] Test fixtures for an owner (is_admin=true) and a non-owner authenticated user — required for the RLS and assertOwner integration tests
- [ ] DAL test stubs for `curatedLists` / `collectionPaths` modules

*Existing vitest infrastructure covers the remaining phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/admin/lists` and `/admin/paths` unreachable by non-owner in a browser | CMS-02 | Layout-guard redirect is a request-lifecycle behavior; Next.js Partial Rendering means the layout guard is UX-layer (assertOwner is the real gate) | Sign in as a non-owner, navigate to `/admin/lists` and `/admin/paths` — confirm redirect away; sign in as owner — confirm access |
| Markdown intro live-preview pane renders correctly | CMS-03 | Visual rendering of react-markdown output | Author a list with headings/links/lists in the intro; confirm the preview pane matches |
| Cover image upload + display | CMS-03 | Storage upload + object-cover render | Upload an image to a list; confirm it stores in `cms-covers` and renders |
| Ten seed collection paths authored & published | CMS-10 | Content authoring through the admin UI | Author 10 paths via `/admin/paths`, publish each, confirm published state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
