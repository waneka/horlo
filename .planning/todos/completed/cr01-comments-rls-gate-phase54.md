---
id: cr01-comments-rls-gate
created: 2026-05-22
source: 53-REVIEW.md (CR-01)
resolves_phase: 54
priority: high
tags: [rls, security, comments, gate, phase54-input]
---

# CR-01 — comments RLS gate is non-functional at the RLS layer (carry into Phase 54)

**Decided (2026-05-22):** Option A — accept for Phase 53 (safe, fail-closed, no leak; matches the
project's "RLS blocks anon; service-role DAL is the load-bearing gate" invariant). Resolve cleanly
in Phase 54 when the DAL gate (GATE-01/04/05, SEC-02) is built.

## What CR-01 is

The Phase 53 `comments` RLS policies (`comments_select` USING and `comments_insert` WITH CHECK)
gate watch-target comments via `EXISTS (SELECT 1 FROM watches w WHERE w.id = comments.watch_id
AND (w.status IN ('owned','sold','grail') OR w.user_id = auth.uid() OR (wishlist AND mutual-follow)))`.

That subquery runs under the **caller's** RLS on `watches`, and `watches` is **owner-only SELECT**
on prod (`watches_select_own USING (user_id = (SELECT auth.uid()))` — confirmed, no later migration
broadens it). So under a **direct authenticated** role, a non-owner's `watches` subquery returns
**zero rows** → the gate denies. Net: the watch-target gate **fails closed** for all non-owners,
on BOTH read and write. It never leaks (fail-closed, not fail-open), but it does **not**
independently enforce GATE-01 the way D-06 intended.

Unaffected: wear-target comments (open branch, no watches subquery); the owner's own watches
(owner can see own watch row, so the `w.user_id = auth.uid()` branch works at RLS).

## Why it's safe to ship Phase 53 as-is

- No leak (fail-closed). Anon is still fully blocked (SEC-01 ✓).
- All comment reads/writes go through the **service-role DAL** (`src/lib/supabase/admin.ts`),
  which bypasses RLS — same pattern as `watches` itself. The RLS gate is never the live path.
- GATE-01/04/05 + SEC-02 are **Phase 54 (DAL)** requirements; SEC-02's test is "non-mutual-follower
  calling the DAL directly is rejected" — the DAL is the verification surface, not raw RLS.

## What Phase 54 must decide / do

1. **Build the real gate in the DAL** (`isMutualFollow` bidirectional, GATE-05) — the load-bearing layer.
2. **Resolve the RLS layer** — pick ONE:
   - (a) **DAL-only + minimal RLS** — simplify `comments` RLS to anon-block + author-ownership write
     guard; drop the non-functional watches-subquery gate; document that visibility is DAL-enforced.
     (Cleanest; one source of truth; matches the project invariant. Do NOT naively set
     `comments_select USING (true)` — that would leak wishlist comments on any authenticated-client path.)
   - (b) **True two-layer via shared SECDEF helper** — a `SECURITY DEFINER` visibility/ mutual-follow
     function (REVOKE EXECUTE FROM public, anon + `has_function_privilege('anon',…)=false` assertion,
     per SEC-04 and project memory `project_supabase_secdef_grants`) that BOTH the RLS policy AND the
     DAL call (single source of truth, no logic drift). This reverses D-07's "no SECDEF" bet, which
     CR-01 disproved.
3. **Do NOT trust the current Phase 53 RLS comments gate** as a functioning second layer until (2) is done.

## Also (WR-03, trivial)

`supabase/migrations/20260522000001_phase53_notification_enum.sql` asserts `enum_count <> 6`
(hard-coded). A future 7th enum value will break `supabase db reset` replay of this historical
migration. When convenient, change it to assert **presence of the 4 Phase 53 values** rather than
an exact total. (Non-urgent; historical migration.)

Full detail: `.planning/phases/53-schema-rls-enum-extension/53-REVIEW.md`.
