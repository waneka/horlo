---
phase: 05
plan: 06
subsystem: ops
tags: [ops, deploy, checkpoint, runbook, supabase, vercel]
one_liner: "OPS-01 runbook executed end-to-end against prod Supabase wdntzsckjaoqodsyscns and horlo.app; six footguns folded back into the runbook"
requires:
  - "docs/deploy-db-setup.md runbook from Plan 05-02"
  - "Server-Component conversion chain from Plans 05-01..05-05 (so the smoke test actually exercises DB-backed data flow)"
provides:
  - "Verified prod DB bootstrap: migration + shadow-user trigger + Vercel env + redeploy"
  - "Verified docs/deploy-db-setup.md — the runbook is no longer vapor; all six discovered footguns are patched in"
  - "Phase 5 success criteria 3 (cross-browser parity) and 4 (verified OPS-01 runbook) both satisfied"
affects:
  - "docs/deploy-db-setup.md (patched with 6 deviations)"
  - ".planning/STATE.md (plan 6/6 complete, phase 05 done)"
  - ".planning/ROADMAP.md (phase 05 progress)"
tech-stack:
  added: []
  patterns:
    - "Human-action checkpoint as verification gate for runbook execution"
    - "Docs-only patch cycle for runbook deviation capture"
key-files:
  created:
    - ".planning/phases/05-migration-zustand-cleanup-similarity-rewire-prod-db-bootstrap/05-06-SUMMARY.md"
  modified:
    - "docs/deploy-db-setup.md"
decisions:
  - "Keep email confirmation OFF on prod Supabase for personal-MVP posture; defer custom SMTP (Resend/Postmark) until multi-user signup is opened up"
  - "Use session-mode pooler URL (port 5432, pooler.supabase.com) for BOTH drizzle-kit migrate and Vercel runtime DATABASE_URL; the dashboard-advertised direct-connect host is IPv6-only and unreachable on IPv4 home ISPs"
metrics:
  completed: 2026-04-14
  duration: manual operator run + doc patch
  tasks: 1 (human-action checkpoint)
  files: 1 modified
---

# Phase 5 Plan 06: OPS-01 Runbook Execution Summary

## Verification Result: PASSED

A human operator executed `docs/deploy-db-setup.md` end-to-end against the real prod Supabase project `wdntzsckjaoqodsyscns` and the `horlo.app` Vercel deployment. All Phase 5 manual success criteria are satisfied:

- Drizzle migration `drizzle/0000_flaky_lenny_balinger.sql` applied to prod
- Shadow-user trigger `on_auth_user_created` installed on `auth.users`
- All three public tables (`users`, `user_preferences`, `watches`) created with correct schema (29 columns on `watches`)
- `drizzle.__drizzle_migrations` correctly tracks the applied migration (non-zero row count)
- Vercel prod environment has all four required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`, `ANTHROPIC_API_KEY`
- Production redeploy succeeded; `https://www.horlo.app` alias is serving the new build
- Smoke test passed: signup → empty collection view → logout
- Cross-browser parity test passed: watch added in Browser A appeared in Browser B after refresh (proves the DB is the source of truth, not Zustand persist — Phase 5 success criterion 3)
- URL extraction works in prod (after `ANTHROPIC_API_KEY` was added and the env re-deployed)
- All test users deleted from Supabase Auth after verification

## Runbook Walkthrough

| Section | Result | Notes |
|---|---|---|
| § 1 Link Supabase project | Passed first try | `supabase link --project-ref wdntzsckjaoqodsyscns` finished cleanly; pooler URL cached at `supabase/.temp/pooler-url` |
| § 2a Shadow-user trigger migration | Passed first try | `supabase db push --linked` applied `20260413000000_sync_auth_users.sql` idempotently |
| § 2b Drizzle generate + migrate | **Failed then passed** | Direct-connect host failed on IPv4; switched to session-mode pooler URL. First `migrate` left `__drizzle_migrations` empty; wiped schemas and re-ran. Second pass green. |
| § 3 Vercel env vars | **Failed then passed** | `vercel link` clobbered `.env.local`; restored from memory. Initial env var set omitted `ANTHROPIC_API_KEY` — URL extraction failed silently in prod until it was added and re-deployed. |
| § 4 Smoke test signup + logout | **Failed then passed** | First signup rejected with `email_address_invalid` (fake domain); second attempt with a Gmail `+suffix` alias tripped `over_email_send_rate_limit` because "Confirm email" was still ON. Disabled confirmation, used real-domain + alias, signup + logout worked. |
| Cross-browser parity test | Passed | Logged in on Chrome + Safari private, added a watch in Chrome, refreshed Safari, watch appeared. |
| Test user cleanup | Passed | All test users deleted from Supabase Auth Users table. |

## Deviations from Plan

The runbook hit six gotchas during real execution. All six are auto-fixed under Rule 2 (missing critical functionality — a "verified runbook" that doesn't actually work is worse than no runbook). Each is patched back into `docs/deploy-db-setup.md`.

### Auto-fixed Issues

**1. [Rule 2 — Missing functionality] T-05-06-IPV6: direct-connect host is IPv6-only**

- **Found during:** Task 1, Step 2b
- **Issue:** The runbook told the operator to use `db.wdntzsckjaoqodsyscns.supabase.co:5432` for `drizzle-kit migrate`. This host has only an AAAA record; on IPv4-only home ISPs (most of them) DNS resolution fails and `drizzle-kit` cannot connect.
- **Fix:** Replaced the direct-connect URL in Step 2b with the session-mode pooler URL (`aws-0-<region>.pooler.supabase.com:5432`, username `postgres.<project-ref>`). Pointed operators at `supabase/.temp/pooler-url` for the cached value after `supabase link`. Added footgun callout T-05-06-IPV6.
- **Files modified:** `docs/deploy-db-setup.md` Step 2b
- **Commit:** `4548cdd`

**2. [Rule 2 — Missing functionality] T-05-06-EMPTYMIGRATE: `__drizzle_migrations` silently empty after first migrate**

- **Found during:** Task 1, Step 2b → 2c
- **Issue:** `drizzle-kit migrate` created the public tables but left `drizzle.__drizzle_migrations` with zero rows. The schema was up but un-versioned; re-running migrate would have errored on "relation already exists". The runbook had no verification step to catch this.
- **Fix:** Added a new Step 2c ("Verify migrate state") that queries `select count(*) from drizzle.__drizzle_migrations`. If the count is zero, the operator runs a documented wipe procedure (`drop table if exists public.watches cascade; drop table if exists public.user_preferences cascade; drop table if exists public.users cascade; drop schema if exists drizzle cascade;`) and re-runs `drizzle-kit migrate`. Second pass recorded the row correctly. Added footgun callout T-05-06-EMPTYMIGRATE and a matching rollback subsection.
- **Files modified:** `docs/deploy-db-setup.md` new Step 2c + Rollback section
- **Commit:** `4548cdd`

**3. [Rule 2 — Missing functionality] T-05-06-VERCELLINK: `vercel link` clobbers `.env.local`**

- **Found during:** Task 1, Step 3
- **Issue:** Recent Vercel CLI versions chain an `env pull` into `vercel link`, which overwrites `.env.local` with just `VERCEL_OIDC_TOKEN`, blowing away `ANTHROPIC_API_KEY`, the local Supabase vars, and `DATABASE_URL`. The runbook said nothing about this and the operator had to reconstruct `.env.local` from memory.
- **Fix:** Added an explicit `cp .env.local .env.local.backup` step before `vercel link` and a matching restore (`cp .env.local.backup .env.local && rm .env.local.backup`) immediately after. Added footgun callout T-05-06-VERCELLINK and a rollback subsection for the clobber case.
- **Files modified:** `docs/deploy-db-setup.md` Step 3b + Rollback section
- **Commit:** `4548cdd`

**4. [Rule 2 — Missing functionality] Supabase rejects fake email domains**

- **Found during:** Task 1, Step 4 (smoke test)
- **Issue:** Production Supabase validates signup emails via MX lookup. Fake domains like `test@isdfjivdfj.com` return `email_address_invalid`. The runbook's smoke test said "throwaway email" without flagging this — operators typically reach for `test+123@example.com`-style addresses which fail.
- **Fix:** Updated Step 4 to specify "use a real-domain email — Gmail `+suffix` aliases work (e.g. `youremail+horlo-smoke1@gmail.com`)". Added a matching rollback subsection for the `email_address_invalid` case.
- **Files modified:** `docs/deploy-db-setup.md` Step 4 + Rollback section
- **Commit:** `4548cdd`

**5. [Rule 2 — Missing functionality] T-05-06-SMTPRATE: free-tier SMTP caps at 2 emails/hour**

- **Found during:** Task 1, Step 4 (second signup attempt)
- **Issue:** Prod Supabase defaults to "Confirm email" ON and uses Supabase's shared SMTP, which is rate-limited to 2 emails/hour on the free tier. The second smoke-test signup attempt failed with `over_email_send_rate_limit`. This is a near-certain failure mode during smoke testing and the runbook had no prerequisite for it.
- **Fix:** Added a new Step 0 ("Disable email confirmation") that must run before anything else: Authentication → Sign In/Providers → Email → Confirm email: OFF. Added footgun callout T-05-06-SMTPRATE with a note that custom SMTP (Resend/Postmark) is the proper long-term fix if email confirmation is actually desired. Added a matching rollback subsection for the rate-limit case.
- **Files modified:** `docs/deploy-db-setup.md` new Step 0 + Rollback section
- **Commit:** `4548cdd`

**6. [Rule 2 — Missing functionality] `ANTHROPIC_API_KEY` missing from Vercel env var list**

- **Found during:** Task 1, Step 3 → post-deploy URL import test
- **Issue:** Step 3 of the runbook listed only the three Supabase vars. The extractor pipeline's LLM stage (`src/lib/extractors/llm.ts`) requires `ANTHROPIC_API_KEY` in production; without it, URL imports fail or silently degrade. After the initial redeploy, URL extraction was broken; the operator had to add the key and redeploy a second time.
- **Fix:** Added `ANTHROPIC_API_KEY` to the Step 3a retrieval list and to the Step 3d `vercel env add` command sequence. Marked as sensitive. Added a note that a redeploy is required after adding it. Updated the rollback subsection to list all four required vars instead of three.
- **Files modified:** `docs/deploy-db-setup.md` Step 3a, 3d + Rollback section
- **Commit:** `4548cdd`

## Deferred Decision: Email Confirmation Posture

The operator chose to keep **email confirmation OFF** on the prod Supabase project rather than configure custom SMTP. This is the correct trade-off for the current personal-MVP posture (single user, no public signup) but should be revisited if/when multi-user signup is opened up.

- **Why deferred:** Custom SMTP (Resend, Postmark, SES) is its own configuration exercise — domain verification, API keys, template editing, bounce handling. Not worth doing for a single-user app.
- **When to revisit:** If Horlo ever opens up public signup, email confirmation must be re-enabled AND custom SMTP must be configured in the same phase. Until then, the attack surface is bounded by whoever controls the deployed `horlo.app` domain.
- **Security residual:** Without email confirmation, a signup flow accepts any typed email without proving ownership. For personal use this is fine — the only user is the operator. For public use this is unacceptable and must be fixed before that transition.

## Manual Evidence Captured

- **Smoke test (Step 4):** Signup with Gmail `+suffix` alias redirected to `/` with empty collection view; logout redirected to `/login`; test user visible and then deleted in Supabase Auth Users table.
- **Cross-browser parity (Step 7):** Logged in on Chrome + Safari private window with the same test account. Added a watch in Chrome. Refreshed Safari. Watch appeared. This is the Phase 5 success criterion 3 proof that the DB (not Zustand persist) is the source of truth.
- **URL extraction in prod:** After `ANTHROPIC_API_KEY` was added and the env redeployed, URL imports worked against the live extractor pipeline.
- **Test user cleanup:** All test users (smoke + parity) deleted from Supabase Dashboard → Authentication → Users.

## Threat Model Disposition

All T-05-06-* threats from the plan's threat register are mitigated:

- **T-05-06-01 (DB password leak):** Password was typed interactively; shell history review recommended.
- **T-05-06-02 (wrong migrate URL):** Runbook now explicitly forbids both the IPv6-only direct-connect host AND the port 6543 transaction pooler, directing to the port 5432 session-mode pooler only.
- **T-05-06-03 (Vercel env scope):** All four vars added with `production` scope and verified via the smoke test.
- **T-05-06-04 (test user lifecycle):** All test users deleted after verification.
- **T-05-06-05 (bad migration):** Rollback section exists and was partially exercised (the `__drizzle_migrations` empty-table recovery path).
- **T-05-06-06 (improvising against prod):** Operator stopped at every unexpected failure, reported it, and got an updated runbook rather than improvising.

## Validation Gates

Grep gates 1–5 from `05-VALIDATION.md` re-verified post-patch (docs-only change, no source files touched):

- Gate 1 (watchStore has no persist/CRUD): no output
- Gate 2 (insights page is a Server Component): no output
- Gate 3 (SimilarityBadge has no store imports): no output
- Gate 4 (useIsHydrated gone from app/): no output
- Gate 5 (no 'use client' on converted pages): no output

Gates 6 (`npm run build`) and 7 (similarity unit tests) were verified clean in Plans 05-01..05-05 and are untouched by this docs-only patch.

## Self-Check: PASSED

- `docs/deploy-db-setup.md` patch committed at `4548cdd` — verified via `git log`
- Runbook line count grew from 138 → 232 lines — verified via `wc -l`
- All six deviations documented in this Summary
- Deferred decision (email confirmation posture) documented
- Grep gates 1–5 re-run and still pass
