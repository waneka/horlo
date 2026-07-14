---
phase: 82
plan: "06"
subsystem: post-deploy-runbook
tags: [post-deploy, operator-runbook, local-first, prod-deploy, uat, human-verify]
dependency_graph:
  requires: [82-02, 82-03, 82-04, 82-05]
  provides: [82-POST-DEPLOY.md, operator-verification-gate]
  affects:
    - .planning/phases/82-add-watch-ui-operator-admin/82-POST-DEPLOY.md
tech_stack:
  added: []
  patterns: [operator-runbook, bundled-deploy, local-first-gate, iPhone-Safari-UAT]
key_files:
  created:
    - .planning/phases/82-add-watch-ui-operator-admin/82-POST-DEPLOY.md
  modified: []
decisions:
  - "Runbook mirrors Phase 81 POST-DEPLOY shape: frontmatter + purpose narrative + pre-deploy checklist + step-by-step operator instructions + sign-off table"
  - "Step 1a seeds 'CustomWatchCoTest82' brand (guaranteed non-existent) with cleanup after to unblock Step 1c queue"
  - "Step 1c seeds two brands (TestBrand82Seed for confirm+rename, TestBrand82MergeSource+TestFam82 for merge with family count pre-flight) with cleanup"
  - "Step 1d seeds TestFamily82 family with full rename+add-alias+remove-alias cycle + optional alias resolver round-trip"
  - "Step 3b explicitly prohibits destructive actions on prod (read-only UAT for admin queue pages)"
  - "Step 4 post-close checklist explicitly deferred to operator after prod UAT: REQUIREMENTS.md flip, ROADMAP.md update, phase.complete, STATE.md hand-correct, /gsd-complete-milestone v8.4"
metrics:
  duration: "~5 minutes"
  completed: "2026-07-13"
  tasks_completed: 1
  files_changed: 1
---

# Phase 82 Plan 06: POST-DEPLOY Runbook Summary

**One-liner:** Authored operator-facing 82-POST-DEPLOY.md runbook with 4 local-first verification steps (BrandPicker/affordance/auto-create, WatchForm chips/admin-links, /admin/brands Confirm+Rename+Merge, /admin/families Rename+Add-alias+Remove-alias), bundled Vercel push instructions, iPhone Safari + desktop prod UAT steps, and requirement sign-off table for UI-01/02/03 + OPS-01/02.

## What Was Built

### Task 1 — 82-POST-DEPLOY.md operator runbook (commit `1a5338ea`)

- **Step 1a** (UI-01/02): `/watch/new` structured entry → BrandPicker typeahead filter → "Couldn't find" affordance click → Find specs → SQL verify `needs_review = true` row in `brands` → cleanup
- **Step 1b** (UI-03): `/w/[ref]/edit` as admin → read-only chips + "Edit brand"/"Edit family" link cluster visible; same page as non-admin viewer → chips visible, links absent; optional null-catalogId fallback check
- **Step 1c** (OPS-01): `/admin/brands` → seed TestBrand82Seed (needs_review) → Confirm as new → Rename → seed TestBrand82MergeSource with TestFam82 family → Merge (WAI-ARIA radiogroup pre-flight fires with family count) → SQL verify source deleted + family repointed → cleanup + deep-link scroll+pulse check
- **Step 1d** (OPS-02): `/admin/families` → seed TestFamily82 → Rename → Add alias (normalized + dedup no-op) → Remove alias → SQL verify → optional alias resolver round-trip via `/watch/new` → `?brandId=` filter banner check + Clear filter → cleanup
- **Step 2**: Bundled prod push (`git log` verify + `git push origin main` + Vercel dashboard + smoke `curl`)
- **Step 3a** (UI-01/02 mobile): iPhone Safari `/watch/new` → BrandPicker popup, known-brand tap, unknown-brand affordance, Find specs
- **Step 3b** (OPS-01/02 desktop): `/admin/brands` and `/admin/families` render on prod; read-only navigation only — no destructive prod actions during UAT
- **Step 3c** (UI-03 + OPS-02 seam): WatchForm admin "Edit family" → `/admin/families?brandId=` filter + banner + Clear filter; "Edit brand" → `/admin/brands#brand-{id}` scroll + highlight
- **Requirement sign-off table**: UI-01/02/03/OPS-01/OPS-02 with local step + prod step columns
- **Step 4 post-close checklist**: REQUIREMENTS.md flip, ROADMAP.md update, phase.complete, STATE.md hand-correct (5th recurrence per `[[phase-complete-999-1-misset]]` expected), `/gsd-complete-milestone v8.4`
- **Rollback plan**: plan-level revert targets (Plans 01-05 commit hashes listed)

## Verification Results

- File exists: `82-POST-DEPLOY.md` ✅
- Automated grep checks from plan `<verify>` block:
  - `grep -c "Step 1a" 82-POST-DEPLOY.md` → 4 (≥1) ✅
  - `grep -c "Step 3" 82-POST-DEPLOY.md` → 13 (≥3) ✅
  - `grep -c "UI-01" 82-POST-DEPLOY.md` → 6 (≥1) ✅
  - `grep -c "OPS-02" 82-POST-DEPLOY.md` → 7 (≥1) ✅

## Deviations from Plan

None — the execution context made it explicit that this plan's sole deliverable is the runbook document. The commit is `1a5338ea`.

## Human UAT Checkpoints Remaining

**This plan's executor work is complete.** The following human-driven checkpoints in `82-POST-DEPLOY.md` must be walked by the operator (Tyler) before running `phase.complete`:

1. **Task 2 (checkpoint:human-verify)** — Local-first walkthrough on `npm run dev` + local Supabase: Steps 1a/1b/1c/1d all 4 sign-off checkboxes ticked ✅
2. **Task 3 (checkpoint:human-action)** — `git push origin main` + Vercel deploy green
3. **Task 4 (checkpoint:human-verify)** — iPhone Safari + desktop prod UAT: Steps 3a/3b/3c all sign-off checkboxes ticked ✅
4. **Task 5 (auto, post-UAT)** — REQUIREMENTS.md flip (UI-01/02/03/OPS-01/OPS-02), ROADMAP.md update, `phase.complete`, STATE.md hand-correct, `/gsd-complete-milestone v8.4`

## Known Stubs

None. The runbook is a complete operator-facing document with exact SQL commands, expected outcomes, and cleanup steps for every seed row.

## Threat Flags

None. This plan creates a planning artifact only — no new code, no new network surface.

## Self-Check: PASSED

- FOUND: `.planning/phases/82-add-watch-ui-operator-admin/82-POST-DEPLOY.md`
- FOUND: commit `1a5338ea`
