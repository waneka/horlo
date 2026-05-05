# Phase 28: Add-Watch Flow & Verdict Copy Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 28-add-watch-flow-verdict-copy-polish
**Areas discussed:** UX-09 toast CTA shape, ADD-08 returnTo capture, ADD-08 allow-list shape, FIT-06 verdict copy + speech-act split

---

## A — UX-09 Toast CTA Shape

### A.1 — CTA label + destination

| Option | Description | Selected |
|--------|-------------|----------|
| "View" → status-matching tab | Toast: 'Added to wishlist  View →' / 'Added to collection  View →'. Link goes to /u/{username}/wishlist or /u/{username}/collection based on status. Short, parallel. | ✓ |
| Tab-named CTA → status-matching tab | "Open Wishlist →" / "Open Collection →". CTA names destination explicitly. | |
| "See it on your profile" → same tab | Identical CTA copy across statuses; href routes to matching tab. | |
| Single tab for everything | Always /u/{username}/collection regardless of status. | |

**User's choice:** "View" → status-matching tab (D-01, D-02)

---

### A.2 — Render mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Sonner action slot | toast.success(msg, { action: { label, onClick }}). Accessible button by default, theme-matching. | ✓ |
| Custom JSX inside toast.success(<>…</>) | Full markup control, but bypasses Sonner accessibility defaults; reinvents the affordance. | |

**User's choice:** Sonner action slot (D-03)

---

### A.3 — Hook extension shape

| Option | Description | Selected |
|--------|-------------|----------|
| Additive opts.successAction | run(action, { successMessage, successAction: { label, href }}). Hook owns useRouter; existing 8+ callers untouched. | ✓ |
| Generic opts.successContent: ReactNode | Caller passes any JSX; decoupled from router. Loses the action-slot win from A.2. | |
| Top-level on toast call sites | Bypass the hook entirely for Phase 28; ignores roadmap text "Extends useFormFeedback". | |

**User's choice:** Additive opts.successAction (D-04)

---

### A.4 — Toast firing rule (reformulated mid-discussion)

The originally drafted A.4 ("Should FormStatusBanner mirror the CTA?") was rejected for clarification. User pointed out that since ADD-08 returns the user to their entry point, in some cases the entry point IS the destination tab — toast+CTA would be redundant. The question was reformulated to address toast firing under the returnTo overlap.

| Option | Description | Selected |
|--------|-------------|----------|
| Suppress toast when returnTo == destination tab | Fire NO toast when post-commit page resolves to the destination tab. Otherwise toast 'Added to X  View →'. | ✓ |
| Always toast as confirmation, CTA only when needed | Always show 'Added to X' as transient cue. Drop CTA when post-commit page == destination tab. | |
| Always toast + always CTA (roadmap-literal) | Toast every time with CTA, even when CTA is a no-op refresh. | |

**User's choice:** Suppress toast when returnTo == destination tab (D-05, D-06)

**Notes:** The user's reframing ("we don't need to CTA or the toast at all in that case") collapsed the original A.4 banner question. FormStatusBanner stays out of Phase 28 entirely (D-07) — the four commit sites either don't mount the banner or unmount mid-nav, so banner-CTA mirroring is moot.

---

## B — ADD-08 returnTo Capture

### B.1 — Capture mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Append at every callsite | Each Link/router.push that targets /watch/new appends &returnTo=. Pattern parallels existing ?next= for /login (FollowButton.tsx:71). Touches ~6–8 callsites. | ✓ |
| Read document.referrer at /watch/new | Zero callsite changes, but Referrer-Policy strips it; new-tab opens lose it. | |
| Hybrid | Callsite when present, referrer fallback. Doubles surface area. | |

**User's choice:** Append at every callsite (D-08, D-09, D-10)

---

### B.2 — Exit paths that route to returnTo

| Option | Description | Selected |
|--------|-------------|----------|
| Commits only — rely on browser back for cancel | Wishlist commit + Collection commit → router.push(returnTo ?? default). Skip / in-flow Cancel / rationale Cancel stay as today. | ✓ |
| Commits + add explicit 'Done' affordance | Same as above, plus a small 'Done — back to {entryLabel}' button. Adds one UI element. | |
| Commits + Skip | Skip also routes to returnTo. Kills the rail-and-keep-evaluating loop. | |

**User's choice:** Commits only — rely on browser back for cancel (D-14)

---

### B.3 — Default destination when returnTo is null

| Option | Description | Selected |
|--------|-------------|----------|
| /u/{username}/{matching-tab} | Land on the tab where the new watch lives. Symmetric with suppress-toast rule. | ✓ |
| Keep current behavior (asymmetric) | Wishlist commit stays on /watch/new; Collection commit → /. | |
| Always / | Symmetric, simple, but '/' isn't anywhere near the new watch. | |

**User's choice:** /u/{username}/{matching-tab} (D-13)

---

## C — ADD-08 Allow-List Shape

### C.1 — Validation shape

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse auth-callback syntactic guard | Same regex as ?next= today (/^\/(?!\/)[^\\\r\n\t]*$/). Plus self-loop guard rejecting /watch/new. Future entry points work without registry updates. | ✓ |
| Positive registry of approved prefixes | Hard-coded list of '/', '/u/', '/search', '/catalog', '/explore', '/watch/'. Stricter; every new entry point requires updating the list. | |
| Hybrid — syntactic guard + path normalization | Guard + strip trailing slashes, collapse double slashes. Hygiene, not security. | |

**User's choice:** Reuse auth-callback syntactic guard (D-11)

---

## D — FIT-06 Verdict Copy + Speech-Act Split

### D.1 — Diagnosis of "Unusual for your collection" today

| Option | Description | Selected |
|--------|-------------|----------|
| Tone — reads negative / dismissive | "Unusual" carries faint judgmental undertone. Outlier doesn't necessarily mean bad fit. | ✓ |
| Length — too terse, no signal | Five words gives no actionable signal. Other labels (e.g., role-duplicate "May compete for wrist time") at least gesture at why. | ✓ |
| Voice — reads like a label, not a sentence | Noun phrase, not a verb-led observation. | ✓ |
| Accuracy — "unusual" doesn't capture what Outlier means | Outlier semantic = "distinct / contrasting / expansive", not "rare/odd". | ✓ |

**User's choice:** All four diagnoses apply (multiSelect)

**Notes:** All four diagnoses → confirms the rewrite is structural, not a tone tweak. Drives D-16 (full DESCRIPTION_FOR_LABEL rewrite, not just outlier).

---

### D.2 — Two-context strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Add a rationale slot per Template | Each Template gains rationaleTemplate field. Composer collects rationalePhrasings parallel to contextualPhrasings. WishlistRationalePanel reads rationalePhrasings[0]. | ✓ |
| Empty auto-fill — user writes their own | defaultRationale() returns ''. Loses pre-fill convenience. | |
| Per-label rationale string (no per-Template) | Add RATIONALE_FOR_LABEL only. Coarser than per-Template but simpler. | |

**User's choice:** Add a rationale slot per Template (D-17, D-18, D-19, D-20)

**Notes:** User opted for the more structural fix — per-Template rationale slots. RATIONALE_FOR_LABEL is also added (D-18) but as the low-confidence fallback, not the primary source.

---

### D.3 — Scope of the rewrite

| Option | Description | Selected |
|--------|-------------|----------|
| Outlier description + all 12 Template rationale slots | Smallest change satisfying success criteria. | |
| Full DESCRIPTION_FOR_LABEL rewrite + rationale slots | All 6 descriptions + all 12 rationaleTemplate slots + RATIONALE_FOR_LABEL fallback. | ✓ |
| Outlier only — defer per-Template slots | Doesn't satisfy success criterion #4. | |

**User's choice:** Full DESCRIPTION_FOR_LABEL rewrite + rationale slots (D-16, D-17, D-18)

---

### D.4 — Who drafts the actual strings

| Option | Description | Selected |
|--------|-------------|----------|
| Planner proposes draft, user reviews in plan-check | Planner drafts all 24+ strings in PLAN.md; user refines during plan-checker review. Standard pattern. | ✓ |
| User drafts strings now, captured in CONTEXT.md | Pause discussion to draft 24+ strings together. | |
| Planner drafts + add explicit UAT 'review the copy' checkpoint | Heavier process; useful for high-stakes copy. | |

**User's choice:** Planner proposes draft, user reviews in plan-check (D-21)

---

## Claude's Discretion

- Sonner action-slot button styling details
- Path canonicalization algorithm for the suppress-toast rule (D-06) — `/u/me/...` resolves to canonical username before equality check
- Specific 24+ copy strings (drafted by planner per D-21)
- Whether `router.refresh()` removal in AddWatchFlow Wishlist commit (D-15) introduces verdict-cache races
- Exact test-coverage shape for D-22 (lockstep + rationale-fill cases)
- Server Component → Client Component conversion choice per entry-point Link (D-10)

## Deferred Ideas

- Add-Watch flow paid/target price capture UX (carried from Phase 27 deferred — explicitly NOT folded into Phase 28)
- FormStatusBanner CTA-link variant (deferred indefinitely)
- Verdict copy template predicate audit (out of scope; locked by Phase 20 FIT-02)
- `getSimilarityDisplay()` consolidation with DESCRIPTION_FOR_LABEL (planner-owned)
