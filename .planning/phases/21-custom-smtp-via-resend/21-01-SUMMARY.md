---
phase: 21-custom-smtp-via-resend
plan: 01
subsystem: infra

tags: [smtp, resend, cloudflare, dns, dkim, spf, dmarc, supabase-auth, signup-form, react, nextjs]

# Dependency graph
requires:
  - phase: 20
    provides: Existing signup-form.tsx baseline + Supabase Auth client wiring used as the amend target
provides:
  - DNS records for mail.horlo.app verified at Resend (DKIM + SPF + bounce MX)
  - DMARC v=DMARC1; p=none; published at _dmarc.mail.horlo.app (D-11)
  - signup-form.tsx renders "Check your email" success state when signUp() returns no session (D-10)
  - Backward-compatible immediate-session redirect path preserved for Confirm-email-OFF staging
  - Resend × Cloudflare auto-configure integration recorded as the chosen submission method
affects: [21-02, smtp, deliverability, auth-toggles, confirm-email]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "External-service DNS verified via vendor × DNS-provider one-click integration when available (Resend × Cloudflare auto-configure) — collapses manual entry, eliminates Pitfall 2 leftmost-label risk, short-circuits propagation wait"
    - "Auth signup form branches on `data.session` (not `data.user`) to avoid user-enumeration leakage (T-21-04)"

key-files:
  created:
    - .planning/phases/21-custom-smtp-via-resend/evidence/dns-submitted.md
    - .planning/phases/21-custom-smtp-via-resend/evidence/resend-records-verified.jpeg
  modified:
    - src/app/signup/signup-form.tsx

key-decisions:
  - "Resend × Cloudflare auto-configure used in place of manual DNS entry — Pitfall 2 N/A; verification was instant"
  - "DMARC added manually in Cloudflare (auto-configure skipped optional records) per D-11"
  - "Signup form gates on `data.session` (not `data.user.email_confirmed_at`) — keeps the new-account / already-exists paths indistinguishable (T-21-04)"
  - "Immediate-session redirect path retained verbatim so toggling Confirm-email OFF in staging requires no further code changes"

patterns-established:
  - "Vendor auto-configure preferred over manual DNS when the provider × DNS-host integration exists — capture the deviation in evidence/ rather than the original manual procedure"
  - "Conditional rendering of CardContent + CardFooter based on a sent-state flag, with the sign-in link present in BOTH states so the user is never stranded"

requirements-completed:
  - SMTP-01

# Metrics
duration: ~45min (mostly operator wait time at Resend dashboard + Cloudflare DNS UI)
completed: 2026-04-30
---

# Phase 21-01: DNS records + signup-form D-10 amend Summary

**Resend × Cloudflare auto-configure verified DKIM/SPF/bounce-MX in seconds; manual DMARC published at `_dmarc.mail.horlo.app`; signup-form now branches on `data.session` so flipping Confirm-email ON no longer silently bounces signups.**

## Performance

- **Duration:** ~45 min wall-clock (most of it operator browser work at Resend + Cloudflare)
- **Completed:** 2026-04-30
- **Tasks:** 3 (all completed)
- **Files modified:** 1 source file (`src/app/signup/signup-form.tsx`) + 2 evidence files created

## Accomplishments
- **DNS records live and verified at Resend** for `mail.horlo.app` (per D-03):
  - DKIM TXT at `resend._domainkey.mail.horlo.app` — Verified ✓
  - SPF TXT at `send.mail.horlo.app` — Verified ✓ (`v=spf1 include:amazonses.com ~all`)
  - Bounce MX at `send.mail.horlo.app` priority 10 — Verified ✓
- **DMARC published manually** at `_dmarc.mail.horlo.app` (D-11): `v=DMARC1; p=none;` — confirmed via direct query against both Cloudflare authoritative nameservers (`thaddeus.ns.cloudflare.com`, `mia.ns.cloudflare.com`).
- **Signup-form (D-10)**: branches on `data.session === null` to render "Check your email to confirm your account." inside the existing CardContent; preserves the immediate-session `router.push('/')` path for the Confirm-email-OFF case so staging is unaffected.
- **User-enumeration guard (T-21-04)**: branch decision uses `data.session`, not `data.user.email_confirmed_at` — Supabase returns the same `{ user, session: null }` shape for new and pre-existing emails, and the success copy is identical in both cases. Error path copy (`'Could not create account.'`) unchanged.

## Task Commits

Each task was committed atomically:

1. **Tasks 1 + 2: DNS submission (probe + Resend domain add + Cloudflare auto-configure + manual DMARC + evidence capture)** — `089c848` (feat)
2. **Task 3: signup-form D-10 amend** — `fbf3b8f` (feat)

(Tasks 1 and 2 were combined into a single commit because Cloudflare auto-configure collapsed manual entry into the same operator session — the evidence file documents both phases inline.)

## Files Created/Modified
- `.planning/phases/21-custom-smtp-via-resend/evidence/dns-submitted.md` (NEW) — NS probe, Resend record-set transcription, Cloudflare auto-configure deviation note, DMARC dig-verification block, screenshot reference
- `.planning/phases/21-custom-smtp-via-resend/evidence/resend-records-verified.jpeg` (NEW) — Resend dashboard screenshot showing all four record categories with Verified ✓ badges (DKIM, SPF, MX) and the Optional DMARC row
- `src/app/signup/signup-form.tsx` (MODIFIED) — added `signupSent` state + `data.session` branch + conditional CardContent/CardFooter for the success state; replaced stale D-09 comment with D-10 reference

## Decisions Made
- **Used Resend × Cloudflare auto-configure** instead of the manual record-entry flow the plan assumed. Rationale: Resend detected Cloudflare as the DNS provider for `horlo.app` (via `dig NS horlo.app +short` → `*.ns.cloudflare.com`) and offered a one-click integration that wrote DKIM/SPF/MX directly. Bypassed Pitfall 2 (leftmost-label entry mistakes) entirely and short-circuited the 15min–24h propagation wait the plan budgeted for. Evidence captures both the chosen method and a verbatim transcription of the records as they appear in the dashboard.
- **Added DMARC manually after auto-configure**. Resend marked DMARC "(Optional)" and Cloudflare auto-configure skipped it. Operator added `_dmarc.mail` TXT = `v=DMARC1; p=none;` in Cloudflare DNS UI manually to honor D-11. Verified against both Cloudflare authoritative NS (default resolver returned empty due to negative-cache TTL — irrelevant for acceptance).
- **Subdomain scoped strictly to D-03 (`mail.horlo.app`)**. Operator initially added `email.horlo.app` at Resend; deleted and re-added as `mail.horlo.app` before any DNS records were committed, so cleanup cost was zero. Decision records (D-03 / D-04 / D-05 / D-11) untouched.

## Deviations from Plan

### Auto-fixed / accepted deviations

**1. [Process] DNS submission method changed from manual entry to vendor auto-configure**
- **Found during:** Task 2 (operator at Resend dashboard saw the "Auto configure" button after the Cloudflare-detection probe)
- **Issue:** Plan Task 2 prescribed manual record entry at Cloudflare with explicit Pitfall 2 mitigation (leftmost-label discipline). Resend × Cloudflare integration writes records via API and renders the discipline N/A.
- **Fix:** Used auto-configure. Manually added DMARC afterward (auto-configure skipped optional records).
- **Files modified:** evidence/dns-submitted.md, evidence/resend-records-verified.jpeg
- **Verification:** All four record FQDNs verified via `dig +short @<NS> TXT|MX <fqdn>` returning expected values; negative checks confirmed no apex DMARC and no FQDN doubling.
- **Committed in:** 089c848

**2. [Filename] Screenshot saved as `.jpeg` rather than `.png`**
- **Found during:** Task 2 evidence capture
- **Issue:** Plan acceptance grep checked literally for `evidence/resend-record-set.png`; operator screenshot was saved as `.jpeg` (browser default).
- **Fix:** Renamed to `resend-records-verified.jpeg` to capture both Task 1 ("issued record set") and Task 2 ("records as submitted") in one file (auto-configure made them the same view). Documented the rename in `evidence/dns-submitted.md`.
- **Files modified:** evidence/resend-records-verified.jpeg
- **Verification:** `test -f .planning/phases/21-custom-smtp-via-resend/evidence/resend-records-verified.jpeg` passes.
- **Committed in:** 089c848

**3. [Inherited baseline] `npx tsc --noEmit` reports 11 pre-existing errors in test files**
- **Found during:** Task 3 verification (`npx tsc --noEmit`)
- **Issue:** Plan Task 3 acceptance required tsc to exit 0. Project tsconfig includes test files which have pre-existing type errors (`RecentlyEvaluatedRail.test.tsx`, `DesktopTopNav.test.tsx`, `PreferencesClient.debt01.test.tsx`, `useSearchState.test.tsx`, `phase17-extract-route-wiring.test.ts`). My signup-form.tsx edit introduces zero tsc errors.
- **Fix:** Confirmed pre-existing via stash baseline (`git stash push src/app/signup/signup-form.tsx && npx tsc --noEmit && git stash pop` → identical 11 errors before and after my edit). `npm run build` is clean (Next.js excludes test files). Targeted `npx eslint src/app/signup/signup-form.tsx` is clean (exit 0, zero issues).
- **Files modified:** none — pre-existing baseline, not introduced
- **Verification:** Stash baseline confirms parity with HEAD. signup-form.tsx itself has zero tsc errors.
- **Committed in:** N/A (not introduced by this plan; cleanup belongs in a future tsc-hygiene phase)

---

**Total deviations:** 3 (1 process simplification, 1 filename rename, 1 pre-existing baseline)
**Impact on plan:** Process simplification (#1) is upside — collapsed propagation wait + bypassed Pitfall 2 risk. Filename (#2) is cosmetic. tsc baseline (#3) is inherited project state, not regression. None block Plan 21-02.

## Issues Encountered
- **Initial subdomain mismatch** — operator added `email.horlo.app` at Resend on the first attempt; restored to `mail.horlo.app` (D-03) before any DNS records were entered. Zero downstream cost.
- **DMARC dig returned empty initially** — caught Cloudflare auto-configure's skip of the Optional DMARC record before declaring Tasks 1-2 done. Manual DMARC add resolved it.

## User Setup Required

**External services were configured by the operator during this plan:**
- Resend domain `mail.horlo.app` added at https://resend.com/domains
- Cloudflare integration authorized (Resend × Cloudflare auto-configure)
- DNS records (DKIM/SPF/MX) auto-written by Resend; DMARC manually added in Cloudflare DNS UI

**No environment variables were touched in this plan.** API key creation is in Plan 21-02 Task 1.

## Next Phase Readiness

**Plan 21-02 is unblocked.** The originally-budgeted "wait for DNS propagation" gate is already satisfied:
- Resend dashboard shows DKIM/SPF/MX as Verified ✓
- DMARC verified via authoritative dig
- signup-form.tsx D-10 amendment shipped — flipping Confirm-email ON in Plan 21-02 will no longer silently bounce signups

**Remaining work for Plan 21-02:**
1. Create Resend SMTP API key (`smtp.resend.com:465`) and store in 1Password / `.env.local`
2. Wire Supabase Auth → SMTP settings in dashboard
3. Run D-07 round-trip gate (dashboard test email + end-to-end Gmail signup with inbox-not-spam check)
4. Flip Confirm-email / Secure email change / Secure password change toggles ON in prod
5. Append backout-plan section to `docs/deploy-db-setup.md`
6. Update PROJECT.md Key Decisions and mark SMTP-06 Deferred in REQUIREMENTS.md

**Concerns:** None. Plan 21-02 can begin immediately.

---
*Phase: 21-custom-smtp-via-resend / Plan 01*
*Completed: 2026-04-30*
