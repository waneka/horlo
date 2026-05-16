# Roadmap: Horlo

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-04-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Taste Network Foundation** — Phases 6-10 (shipped 2026-04-22) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 Production Nav & Daily Wear Loop** — Phases 11-16 + 999.1 (shipped 2026-04-27) — [archive](milestones/v3.0-ROADMAP.md)
- ✅ **v4.0 Discovery & Polish** — Phases 17-26 + 19.1 + 20.1 (shipped 2026-05-03) — [archive](milestones/v4.0-ROADMAP.md)
- ✅ **v4.1 Polish & Patch** — Phases 27-31 (shipped 2026-05-05) — [archive](milestones/v4.1-ROADMAP.md)
- ✅ **v5.0 Discovery North Star** — Phases 32-42 (shipped 2026-05-16) — [archive](milestones/v5.0-ROADMAP.md)
- 📋 **v5.1 Explore Page Redesign** — planted (SEED-008)
- 📋 **v5.2 Catalog Expansion** — planted (SEED-009)
- 📋 **v5.3 Add-Watch Redesign** — planted (SEED-010)
- 📋 **v6.0 Market Value** — planted (SEED-005)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-04-19</summary>

- [x] Phase 1: Visual Polish & Security Hardening (6/6 plans)
- [x] Phase 2: Feature Completeness & Test Foundation (5/5 plans)
- [x] Phase 3: Data Layer Foundation (3/3 plans)
- [x] Phase 4: Authentication (6/6 plans)
- [x] Phase 5: Zustand Cleanup, Similarity Rewire & Prod DB Bootstrap (6/6 plans)
- [ ] Phase 6: Test Suite Completion — deferred to v1.1 (TEST-04/05/06)

See [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v2.0 Taste Network Foundation (Phases 6-10) — SHIPPED 2026-04-22</summary>

- [x] Phase 6: RLS Foundation (1/1 plans)
- [x] Phase 7: Social Schema & Profile Auto-Creation (3/3 plans)
- [x] Phase 8: Self Profile & Privacy Controls (4/4 plans)
- [x] Phase 9: Follow System & Collector Profiles (4/4 plans)
- [x] Phase 10: Network Home (9/9 plans)

35/35 requirements shipped. Cross-phase integration verified. End-to-end privacy flows audited.

See [v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md) for full phase details and [v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md) for the audit report.

</details>

<details>
<summary>✅ v3.0 Production Nav & Daily Wear Loop (Phases 11-16 + 999.1) — SHIPPED 2026-04-27</summary>

- [x] Phase 11: Schema + Storage Foundation (5/5 plans)
- [x] Phase 12: Visibility Ripple in DAL (7/7 plans)
- [x] Phase 13: Notifications Foundation (5/5 plans)
- [x] Phase 14: Nav Shell + Explore Stub (9/9 plans)
- [x] Phase 15: WYWT Photo Post Flow (5/5 plans)
- [x] Phase 16: People Search (5/5 plans)
- [x] Phase 999.1: Phase 5 Code Review Follow-ups (1/1 plan, inserted)

51/51 requirements shipped at code level. Cross-phase integration verified. Audit status `tech_debt` — 31 deferred human-verification UAT items + ~30 advisory tech-debt items, none blocking.

See [v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md) for full phase details and [v3.0-MILESTONE-AUDIT.md](milestones/v3.0-MILESTONE-AUDIT.md) for the audit report.

</details>

<details>
<summary>✅ v4.0 Discovery & Polish (Phases 17-26 + 19.1 + 20.1) — SHIPPED 2026-05-03</summary>

- [x] Phase 17: Catalog Foundation (6/6 plans)
- [x] Phase 18: /explore Discovery Surface (5/5 plans)
- [x] Phase 19: /search Watches + Collections (6/6 plans)
- [x] Phase 19.1: Catalog Taste Enrichment (6/6 plans, inserted)
- [x] Phase 20: Collection Fit Surface Polish + Verdict Copy (6/6 plans)
- [x] Phase 20.1: Add-Watch Flow Rethink + Verdict-as-Step (8/8 plans incl. gap-closure 06/07/08, inserted)
- [x] Phase 21: Custom SMTP via Resend (2/2 plans)
- [x] Phase 22: Settings Restructure + Account Section (5/5 plans)
- [x] Phase 23: Settings Sections + Schema-Field UI (6/6 plans, no phase-level VERIFICATION.md → backfilled in v4.1 Phase 31)
- [x] Phase 24: Notification Stub Cleanup + Test Fixture/Carryover (8/8 plans, no phase-level VERIFICATION.md → backfilled in v4.1 Phase 31)
- [x] Phase 25: Profile Nav Prominence + Empty States + Form Polish (6/6 plans, UAT approved on prod)
- [x] Phase 26: WYWT Auto-Nav (2/2 plans, gap closed inline)

75/75 actionable requirements satisfied + 1 deferred (SMTP-06 staging-prod sender split). Audit status `tech_debt` — 2 phases without phase-level VERIFICATION.md (closed in v4.1), ~33 deferred human UAT items, Nyquist coverage partial. None blocking.

See [v4.0-ROADMAP.md](milestones/v4.0-ROADMAP.md) for full phase details and [v4.0-MILESTONE-AUDIT.md](milestones/v4.0-MILESTONE-AUDIT.md) for the audit report.

</details>

<details>
<summary>✅ v4.1 Polish & Patch (Phases 27-31) — SHIPPED 2026-05-05</summary>

- [x] Phase 27: Watch Card & Collection Render Polish (5/5 plans)
- [x] Phase 28: Add-Watch Flow & Verdict Copy Polish (5/5 plans)
- [x] Phase 29: Nav & Profile Chrome Cleanup (6/6 plans + 1 quick task)
- [x] Phase 30: WYWT Capture Alignment Fix (2/2 plans + 1 post-ship hotfix)
- [x] Phase 31: v4.0 Verification Backfill (3/3 plans)

12/12 requirements satisfied at code level. Cross-phase integration verified (7/7 seams pass). E2E flows trace cleanly (4/4). Audit status `tech_debt` — 1 NEW finding (DEBT-09: Phase 23-era `notesPublic` / `revalidatePath` regression discovered by Phase 31 audit) deferred to v4.2 / v5.0; Nyquist 4/5 partial. None blocking.

See [v4.1-ROADMAP.md](milestones/v4.1-ROADMAP.md) for full phase details and [v4.1-MILESTONE-AUDIT.md](milestones/v4.1-MILESTONE-AUDIT.md) for the audit report.

</details>

<details>
<summary>✅ v5.0 Discovery North Star (Phases 32-42) — SHIPPED 2026-05-16</summary>

- [x] Phase 32: DEBT-09 notesPublic Fix (1/1 plans) — completed 2026-05-06
- [x] Phase 33: Discovery Audit (4/4 plans) — completed 2026-05-08
- [x] Phase 33b: Discovery North-Star Audit (3/3 plans, inserted) — completed 2026-05-09
- [x] Phase 34: Layer A — Brand + Family Entities (4/4 plans) — completed 2026-05-09
- [x] Phase 35: Layer B — Lineage Edges + Structured Movement + Era/Material (7/7 plans) — completed 2026-05-10
- [x] Phase 36: Layer C — Variant Split + Clean-Slate Wipe + CAT-14 NOT NULL (5/5 plans) — completed 2026-05-11
- [x] Phase 37: Layer D — Provenance Fields + Divestments Table (5/5 plans) — completed 2026-05-11
- [x] Phase 38: CAT-13 Engine Rewire (4/4 plans) — completed 2026-05-12
- [x] Phase 39: Audit-Driven Discovery Polish — Cheap Patches (3/3 plans) — completed 2026-05-12
- [x] Phase 39b: Audit-Driven Discovery Polish — Heavier UX (5/5 plans) — completed 2026-05-13
- [x] Phase 39c: Profile Layout Next 16 Conformance (7/7 plans, inserted) — completed 2026-05-14
- [x] Phase 40: Search & Verdict Polish (7/7 plans) — completed 2026-05-14
- [x] Phase 41: Account Danger Zone + Branded Auth Emails (4/4 plans, parallel track) — completed 2026-05-16
- [x] Phase 42: Nyquist Hardening Sweep + UAT Triage (5/5 plans, parallel track) — completed 2026-05-16

16/16 in-scope v5.0 requirements shipped. DEBT-12 (prod drizzle journal repair) carried to v5.x as opportunistic housekeeping. Phase 33b and 39c were inserted phases (north-star audit reframe; Profile Layout Next 16 conformance bugfix). Milestone closed without a formal `/gsd-audit-milestone`; 4 verification gaps (Phases 35/38/40/41) + 2 human-UAT gaps (Phases 35/41) operator-approved at close.

See [v5.0-ROADMAP.md](milestones/v5.0-ROADMAP.md) for full phase details.

</details>

### 📋 v5.1 Explore Page Redesign (Planned)

Not yet roadmapped — seeded as SEED-008 (`.planning/seeds/SEED-008-v5.1-explore-redesign.md`). A 5-module `/explore` redesign (Hero / Collector Archetypes / Curated Lists Rail / Where Collections Go / Browse the Catalog), inheriting DISC-09 promoted out of v5.0 on 2026-05-12. A CMS-approach spike (in-app admin vs Sanity vs Contentlayer) is a candidate before the v5.1 roadmap. Runs before SEED-007 pricing API spike and v6.0.

### 📋 v6.0 Market Value (Planned)

Not yet roadmapped — seeded as SEED-005. Watch Charts integration + total-value insights. Requires the SEED-007 market-pricing API spike first.

## Next Up

Start the next milestone with `/gsd-new-milestone` — questioning → research → requirements → roadmap. Phase numbering continues from 43.
