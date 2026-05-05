---
phase: 28-add-watch-flow-verdict-copy-polish
slug: 28-add-watch-flow-verdict-copy-polish
status: verified
threats_total: 21
threats_closed: 21
threats_open: 0
audit_date: 2026-05-05
asvs_level: 1
block_on: high
created: 2026-05-05
---

# Phase 28 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verifies the threats declared in `.planning/phases/28-add-watch-flow-verdict-copy-polish/28-0{1..5}-PLAN.md`
> against the merged `main` implementation. Read-only audit — no implementation
> files modified.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → `/watch/new` (Server Component) | `?returnTo=` is attacker-controllable; any user can craft a URL containing this param | URL-decoded query string |
| Server → AddWatchFlow / WatchSearchRowsAccordion / CatalogPageActions (Client) | Server-validated `initialReturnTo`, server-resolved `viewerUsername` flow as typed React props | `string \| null` |
| Client (entry-point callsites) → URL bar | 8 active callsites append `?returnTo=ENC(pathname[+search])` to outbound `/watch/new` links | encodeURIComponent'd path |
| Client onClick (Sonner action slot) → router.push | Hooked-internal `router.push(href)` where `href` is the server-resolved `/u/{viewerUsername}/{tab}` path | path-only string |
| Composer → React render | Server-emitted `contextualPhrasings` / `rationalePhrasings` strings flow to JSX text nodes | template-filled strings (no HTML) |

---

## Threat Register

### Plan 01 — FIT-06 verdict copy & speech-act split (`28-01-PLAN.md`)

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-28-01-01 | Tampering | rationalePhrasings via composer | accept | Composer is `'server-only'` (verified at `src/lib/verdict/composer.ts:1`); `fillTemplate` uses `${slot}` lookup against predicate-returned slots; slot values derive from server DB rows. No user-input pathway. | closed |
| T-28-01-02 | Information disclosure | textarea pre-fill exposes verdict | accept | `WishlistRationalePanel` renders the user's own taste-profile-derived rationale; `framing === 'self-via-cross-user'` early-return-empty preserved at `src/components/watch/WishlistRationalePanel.tsx:46`. | closed |
| T-28-01-03 | XSS via verdict copy | WishlistRationalePanel render | mitigate | No `dangerouslySetInnerHTML` anywhere on Phase 28 surfaces (verified by repo-wide grep across `src/components/{watch,search,insights}`). React escapes JSX text-node interpolations by default. | closed |

### Plan 02 — UX-09 useFormFeedback successAction extension (`28-02-PLAN.md`)

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-28-02-01 | Tampering | Hook forwarding caller-supplied href to `router.push` | accept | Hook is generic forwarder. The href flows from server-resolved `viewerUsername` (resolved via `getProfileById(user.id)` in Server Components) — see WatchForm `buildSuccessOpts` at `src/components/watch/WatchForm.tsx:725`. `router.push` is same-origin only. | closed |
| T-28-02-02 | XSS via toast action label | Sonner action.label | mitigate | Hook accepts `label: string` (typed); callers (WatchForm, AddWatchFlow, WatchSearchRowsAccordion, CatalogPageActions) all pass the literal string `'View'`. No `dangerouslySetInnerHTML`. React/Sonner default escaping applies. | closed |
| T-28-02-03 | Information disclosure via router.push race | useTransition + setState | accept | Hook's success branch (`useFormFeedback.ts:163`+) lives AFTER the existing `if (!mountedRef.current) return` gate (Phase 25 baseline test 15 lock — preserved). | closed |

### Plan 03 — ADD-08 server foundation (`28-03-PLAN.md`) — **HIGH severity**

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-28-03-01 | Tampering / Open redirect | `?returnTo=` query at `/watch/new` | mitigate | Two-stage validator at `src/lib/watchFlow/destinations.ts:22-27` (regex + self-loop guard). Source-equality assertion at `src/lib/watchFlow/destinations.test.ts:18` proves `RETURN_TO_REGEX.source === '^\\/(?!\\/)[^\\\\\\r\\n\\t]*$'` — byte-equivalent to auth-callback `route.ts:60-61`. Validator invoked at `src/app/watch/new/page.tsx:81` (`const initialReturnTo = validateReturnTo(sp.returnTo)`). All 15 destinations tests pass (see audit-trail run). | closed |
| T-28-03-02 | Tampering / Header injection | URL-decoded CRLF in returnTo | mitigate | Regex `[^\\\r\n\t]*` excludes CR/LF/tab/backslash post-URL-decode. Test cases at `destinations.test.ts:34-39` cover all 4 vectors (`\\`, `\r`, `\n`, `\t`) returning null. | closed |
| T-28-03-03 | Denial of Service | Self-loop infinite-trap (`?returnTo=/watch/new...`) | mitigate | Self-loop guard at `destinations.ts:25` (`value.startsWith('/watch/new')` returns null). Test cases at `destinations.test.ts:41-45` cover `/watch/new`, `/watch/new?returnTo=/foo`, `/watch/new/manual`. | closed |
| T-28-03-04 | Information disclosure | viewerUsername resolution | accept | Username is the viewer's own; already exposed via UserMenu, profile pages, FollowButton. Resolved server-side via `getProfileById(user.id)` from authenticated `getCurrentUser()` (`page.tsx:90-95`). No new exposure. | closed |
| T-28-03-05 | Tampering / Type confusion | searchParams type confusion (e.g., array) | mitigate | `validateReturnTo` first stage `typeof value !== 'string'` at `destinations.ts:23`. Test case at `destinations.test.ts:47-52` covers `undefined`, `null`, `42`, `[]` returning null. Server Component `searchParams` typed as `string \| undefined` at `page.tsx:30-41` so non-string already filtered by typing layer. | closed |

### Plan 04 — UX-09 inline toast (`28-04-PLAN.md`)

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-28-04-01 | XSS via toast body | Sonner `toast.success` body string | mitigate | Body is the literal string `'Saved to your wishlist'` at both inline sites: `WatchSearchRowsAccordion.tsx:102,109` and `CatalogPageActions.tsx:103,110`. No template interpolation, no user input. React/Sonner escape. | closed |
| T-28-04-02 | XSS via action label | Sonner `action.label` | mitigate | Label is the literal `'View'` at both sites (`WatchSearchRowsAccordion.tsx:104`, `CatalogPageActions.tsx:105`). | closed |
| T-28-04-03 | Open redirect via action onClick | `router.push('/u/{viewerUsername}/wishlist')` | accept | `viewerUsername` is server-resolved via `getProfileById(user.id)` in Server Components (`/search/page.tsx`, `/catalog/[catalogId]/page.tsx`); same-origin path-only construction. No untrusted-input pathway into the href. | closed |
| T-28-04-04 | Information disclosure | Toast surfaces watch-add to other tabs | accept | Sonner is portal-mounted at the layout root via `<ThemedToaster>`; visible only in the user's own session. No cross-user data leakage. | closed |

### Plan 05 — ADD-08 callsite append + nav-on-commit (`28-05-PLAN.md`)

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-28-05-01 | Tampering / Open redirect | Callsite-side `?returnTo=` capture | accept (handled by Plan 03) | The 8 callsites encode `pathname[+search]` (honest values); the `/watch/new` chokepoint validates via Plan 03's `validateReturnTo`. AddWatchFlow + WatchForm consume the validated `initialReturnTo` PROP — never the URL value directly (verified at `AddWatchFlow.tsx:303` and `WatchForm.tsx:232,240`). | closed |
| T-28-05-02 | Information disclosure | Query strings round-tripped via returnTo | accept (LOW) | No current callsite carries secrets in URL query strings. Documented for future-watchfulness in `28-05-PLAN.md` threat block + this SECURITY.md accepted risks log. | closed |
| T-28-05-03 | Tampering / Race | router.refresh() removed from AddWatchFlow Wishlist commit (D-15) | mitigate | `grep -E "^[[:space:]]*router\.refresh\(\)" src/components/watch/AddWatchFlow.tsx \| wc -l` returns **0** (confirms no actual call sites — 2 textual matches are JSDoc/comment documentation). RESEARCH Pitfall 1 verified `/u/[username]/[tab]/page.tsx` is a Server Component that re-fetches `getWatchesByUser(profile.id)` on every render; no `'use cache'` directive. | closed |
| T-28-05-04 | XSS via toast bodies + action labels (AddWatchFlow + WatchForm) | Sonner | mitigate | Bodies/labels are literal strings: `'Saved to your wishlist'` (`AddWatchFlow.tsx:312`), `'Added to your collection'` (`WatchForm.tsx:176`), `'View'` (both sites). React/Sonner escape. | closed |
| T-28-05-05 | Tampering | AddWatchCard label preservation (Server Component) | accept | AddWatchCard stays a Server Component (Pattern D); existing labels `'Add to Wishlist'` / `'Add to Collection'` preserved verbatim — Phase 28 only threads the `returnTo` prop. No user-input concatenation in JSX (verified at `src/components/profile/AddWatchCard.tsx:30-39`). | closed |

### Trust posture across Plans 01 + 02 (declared "no security threats")

Plans 01 + 02 declared their threat models as essentially mitigation-by-existing-architecture (server-only composer; React default escaping). Verification of declared invariants:

- **Composer `'server-only'`:** confirmed at `src/lib/verdict/composer.ts:1` (first line). No client-side template fill.
- **No `dangerouslySetInnerHTML`** on any Phase 28 surface: confirmed by repo-wide grep across `src/components/{watch,search,insights}` (zero matches).
- **Sonner action.onClick href is server-resolved:** confirmed across all 4 commit sites. The hook's `router.push(successAction.href)` (`useFormFeedback.ts:184`) receives only hrefs derived from server-resolved `viewerUsername` or server-validated `initialReturnTo`. No user-input pathway into `href`.

No new attack surface emerged from Plans 01 + 02.

---

## Threat Verification (consolidated)

| Threat ID | Disposition | Evidence |
|-----------|-------------|----------|
| T-28-01-01 | accept | `src/lib/verdict/composer.ts:1` (`'server-only'`); `fillTemplate` at `composer.ts:99+` uses slot lookup; predicates at `templates.ts` consume server-derived data only |
| T-28-01-02 | accept | `src/components/watch/WishlistRationalePanel.tsx:46` (`if (verdict.framing === 'self-via-cross-user') return ''`) |
| T-28-01-03 | mitigate | repo-wide grep `dangerouslySetInnerHTML` returns 0 across Phase 28 surfaces |
| T-28-02-01 | accept | `src/lib/hooks/useFormFeedback.ts:184` `router.push(successAction.href)`; href validated upstream |
| T-28-02-02 | mitigate | `useFormFeedback.ts:74` typed `successAction?: { label: string; href: string }`; all callers pass literal `'View'` |
| T-28-02-03 | accept | `useFormFeedback.ts` mountedRef gate preserved (Phase 25 Test 15 lock) |
| T-28-03-01 | mitigate | `destinations.ts:19` regex; `destinations.ts:22-27` validator; `destinations.test.ts:18` source-equality; `page.tsx:81` invocation |
| T-28-03-02 | mitigate | `destinations.test.ts:34-39` (CR/LF/tab/backslash all return null) |
| T-28-03-03 | mitigate | `destinations.ts:25` (`startsWith('/watch/new')` self-loop guard); `destinations.test.ts:41-45` |
| T-28-03-04 | accept | `page.tsx:90-95` server-side `getProfileById(user.id)` with authenticated user; existing exposure pattern |
| T-28-03-05 | mitigate | `destinations.ts:23` (`typeof value !== 'string'`); `destinations.test.ts:47-52` |
| T-28-04-01 | mitigate | `WatchSearchRowsAccordion.tsx:102,109`; `CatalogPageActions.tsx:103,110` (literal `'Saved to your wishlist'`) |
| T-28-04-02 | mitigate | `WatchSearchRowsAccordion.tsx:104`; `CatalogPageActions.tsx:105` (literal `'View'`) |
| T-28-04-03 | accept | `viewerUsername` server-resolved at both Server Components; same-origin path-only |
| T-28-04-04 | accept | `<ThemedToaster>` portal-mounted at layout root; per-session visibility |
| T-28-05-01 | accept | callsites encode honest pathname; chokepoint at `page.tsx:81` (`validateReturnTo`); AddWatchFlow consumes `initialReturnTo` PROP (`AddWatchFlow.tsx:303`) |
| T-28-05-02 | accept | accepted-risks log entry below |
| T-28-05-03 | mitigate | `grep -E "^[[:space:]]*router\.refresh\(\)" AddWatchFlow.tsx` = 0; destination Server Component re-fetches |
| T-28-05-04 | mitigate | literal toast bodies/labels at `AddWatchFlow.tsx:312-315`; `WatchForm.tsx:176,734` |
| T-28-05-05 | accept | `AddWatchCard.tsx:30-39` literal labels preserved; no user-input concat |

**Status: 21/21 closed; 0 open.**

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-28-01 | T-28-03-04 | viewerUsername is the viewer's own and already exposed via UserMenu, profile pages, FollowButton; threading as a Client prop adds no new exposure | gsd-secure-phase | 2026-05-05 |
| AR-28-02 | T-28-04-03, T-28-04-04, T-28-05-01, T-28-05-05 | viewerUsername-derived hrefs are server-resolved + same-origin; toasts portal-mounted per-session; AddWatchCard labels preserved verbatim | gsd-secure-phase | 2026-05-05 |
| AR-28-03 | T-28-05-02 | LOW severity — no current callsite has secrets in URL query strings. Future-watchfulness: if a feature adds tokens to query strings, audit `WatchSearchRowsAccordion.handleAddToCollection` (`window.location.pathname + window.location.search`) before shipping | gsd-secure-phase | 2026-05-05 |
| AR-28-04 | T-28-01-01, T-28-01-02, T-28-02-01, T-28-02-03 | Composer server-only; framing-based early-return blocks cross-user rationale; hook forwards typed strings; mountedRef gate preserved | gsd-secure-phase | 2026-05-05 |

---

## Unregistered Flags

None. SUMMARY.md `## Threat Flags` sections (Plans 03, 04, 05) and `## Threat Surface Scan` (Plan 02) all reported "None — no files created/modified introduce security-relevant surface outside the plan's enumerated threat model." Plan 01 has no Threat Flags section but its threat model is fully covered.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-05 | 21 | 21 | 0 | gsd-secure-phase |

### Verification commands run

- `npx vitest run src/lib/watchFlow/destinations.test.ts` — **15/15 passing** including source-equality parity assertion at `destinations.test.ts:18`
- `node -e "/^\/(?!\/)[^\\\\\r\n\t]*$/.source"` produces `^\/(?!\/)[^\\\r\n\t]*$` — byte-equivalent at runtime to the regex literal in `auth/callback/route.ts:61`
- `grep -c "watch/new" src/components/layout/BottomNav.tsx` returns **0** (D-09 phantom verified — no Add slot)
- `grep -c "returnTo" src/components/profile/NotesTabContent.tsx` returns **0** (D-10 deliberate skip verified)
- `grep -E "^[[:space:]]*router\.refresh\(\)" src/components/watch/AddWatchFlow.tsx` returns **0** (D-15 actual call sites removed)
- `grep -rn "dangerouslySetInnerHTML" src/components/{watch,search,insights}` returns **0**
- HIGH-severity chokepoint code-level verification: `validateReturnTo` invoked at `src/app/watch/new/page.tsx:81` BEFORE the value is threaded into `<AddWatchFlow initialReturnTo={initialReturnTo} ... />` at `page.tsx:109`; AddWatchFlow consumes the validated PROP at `AddWatchFlow.tsx:303` (`const dest = initialReturnTo ?? defaultDestinationForStatus(...)`); no callsite reads `searchParams.get('returnTo')` directly anywhere downstream

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
- [x] HIGH-severity threats T-28-03-01..03 verified by:
  - regex source-equality test (`destinations.test.ts:18` PASSING)
  - code-level confirmation that `/watch/new` page.tsx invokes `validateReturnTo` BEFORE prop pass-through (`page.tsx:81` → `page.tsx:109`)
- [x] Accepted risks T-28-03-04, T-28-04-03, T-28-05-02 documented in PLAN.md AND in Accepted Risks Log; no additional unaccepted leakage observable in implementation

**Approval:** verified 2026-05-05
