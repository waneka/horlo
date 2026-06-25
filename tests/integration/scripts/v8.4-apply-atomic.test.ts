// Phase 79 / 79-01-PLAN.md — Wave 0 RED stub.
//
// Integration coverage for the v8.4 `--apply --mode=both` atomic transaction.
// Gates MIG-02 (brand_id resolved), MIG-03 (family_id resolved + aliases
// appended), MIG-04 (post-flight assertion + forced-fail rollback), DISP-03
// (hydration overwrites watches.brand+model, preserves notes/serial/...),
// D-79-03 (atomic rollback), D-79-09 (new rows default needs_review=false),
// and D-79-10 (POST-DEPLOY.md auto-generation).
//
// Test model (INVERSE of v8.4-readonly.test.ts): pre/post snapshots BRACKET a
// spawned `tsx scripts/v8.4-brand-canonicalization.ts --apply --mode=both`;
// assertions confirm the writes DID happen and the post-flight invariants
// hold. Both .planning/v8.4-brand-merge-decisions.md AND .planning/v8.4-family-
// merge-decisions.md are backed up + restored in beforeAll/afterAll so the
// operator's working files survive the test (per Phase 78 v8.4-readonly
// convention, extended to BOTH decision files per 79-PATTERNS.md L666-681).
//
// DATABASE_URL-gated per Phase 78 convention: when env unset the suite is
// described-skipped (↓ skipped) and only the outer sanity test runs.
// Plans 02/03/04 un-`todo` each assertion as the corresponding behavior ships.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import * as path from 'node:path'
import postgres from 'postgres'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

const SCRIPT_PATH = 'scripts/v8.4-brand-canonicalization.ts'
const BRAND_PATH = path.join(
  process.cwd(),
  '.planning/v8.4-brand-merge-decisions.md',
)
const BRAND_BACKUP = path.join(
  process.cwd(),
  '.planning/v8.4-brand-merge-decisions.md.apply-atomic-backup',
)
const FAMILY_PATH = path.join(
  process.cwd(),
  '.planning/v8.4-family-merge-decisions.md',
)
const FAMILY_BACKUP = path.join(
  process.cwd(),
  '.planning/v8.4-family-merge-decisions.md.apply-atomic-backup',
)
const POST_DEPLOY_PATH = path.join(
  process.cwd(),
  '.planning/phases/79-backfill-migration-display-hydration/79-POST-DEPLOY.md',
)

// Suppress unused-var noise — Plan 02+ will use these in the un-todoed tests.
void SCRIPT_PATH
void BRAND_PATH
void BRAND_BACKUP
void FAMILY_PATH
void FAMILY_BACKUP
void POST_DEPLOY_PATH
void spawnSync
void existsSync
void readFileSync
void writeFileSync
void unlinkSync
void postgres

it('Wave 0 RED stub loads', () => {
  expect(true).toBe(true)
})

maybe(
  'Phase 79 — v8.4 --apply --mode=both atomic transaction (MIG-02/03/04 + DISP-03 + D-79-03/09/10)',
  () => {
    beforeAll(() => {
      // TODO Plan 02+: back up both decision files so the test can install a
      // known-good fixture without clobbering the operator's working artifact.
      // if (existsSync(BRAND_PATH))  writeFileSync(BRAND_BACKUP,  readFileSync(BRAND_PATH,  'utf8'))
      // if (existsSync(FAMILY_PATH)) writeFileSync(FAMILY_BACKUP, readFileSync(FAMILY_PATH, 'utf8'))
    })

    afterAll(() => {
      // TODO Plan 02+: restore both decision files.
      // if (existsSync(BRAND_BACKUP))  { writeFileSync(BRAND_PATH,  readFileSync(BRAND_BACKUP,  'utf8')); unlinkSync(BRAND_BACKUP)  }
      // if (existsSync(FAMILY_BACKUP)) { writeFileSync(FAMILY_PATH, readFileSync(FAMILY_BACKUP, 'utf8')); unlinkSync(FAMILY_BACKUP) }
    })

    it.todo(
      'MIG-02: --apply --mode=both populates watches_catalog.brand_id for every catalog row (post-snapshot resolved_brand_count equals total_catalog_count)',
    )
    it.todo(
      "MIG-02 + B-78-01 + Hamilton merge: every catalog row with brand_raw in (Hamilton, Hamilton Watch) resolves to brand_id = '20969364-f3b1-4b1d-ab2f-e5d22e9ffabc'",
    )
    it.todo(
      'MIG-02 + D-79-09: new brands rows (33 per current operator decisions) all have needs_review = false',
    )
    it.todo(
      'MIG-03: --apply --mode=both populates watches_catalog.family_id for every catalog row (post-snapshot resolved_family_count equals total_catalog_count)',
    )
    it.todo(
      'MIG-03 + D-79-06: alias-append idempotent — re-running --apply does not produce duplicate elements in any watch_families.aliases array',
    )
    it.todo(
      'MIG-04: post-flight assertion uses positive predicate IS DISTINCT FROM NULL (snapshot via pg_stat_statements or stdout-grep) and rolls back when injected to fail',
    )
    it.todo(
      'D-79-03: atomic rollback — when the post-flight assertion is force-failed (test injects an unresolved row via a fixture or env flag), every prior INSERT/UPDATE rolls back; pre vs post snapshot is byte-identical',
    )
    it.todo(
      "DISP-03: every watches.catalog_id-non-NULL row has brand + model overwritten from canonical brands.name + watch_families.name (post-snapshot watches.brand for Hamilton-owners reads 'Hamilton' not 'Hamilton Watch')",
    )
    it.todo(
      'DISP-03: hydration preserves watches.notes, .serial, .reference, .price_paid, .style_tags (snapshot non-hydrated columns; assert pre == post for those columns)',
    )
    it.todo(
      'D-79-10: --apply writes .planning/phases/79-backfill-migration-display-hydration/79-POST-DEPLOY.md containing ## Apply Summary, ## Post-Flight Assertion (MIG-04), ## Operator Sign-Off Queries, ## What this push does NOT do sections',
    )
  },
)
