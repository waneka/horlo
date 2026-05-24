---
phase: 56A
slug: wear-view-unification
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-23
---

# Phase 56A — Security: Wear View Unification

> Per-phase security contract: threat register, accepted risks, and audit trail.
>
> **Verdict:** SECURED — 12/12 mitigate threats verified closed in code, 4/4 accept threats validated.
> **Auditor:** gsd-security-auditor (claude-sonnet-4-6) · **Register origin:** authored at plan time (56A-01..05 `<threat_model>` blocks).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → DAL (`getActiveWearsForUser`) | `username` from URL resolved server-side; `viewerId` always from session, never client-supplied | username (untrusted), viewerId (session) |
| DAL → Storage | `photoUrl` is a raw Storage path; signing happens later in the page, never in the read | raw storage path |
| client UI → `addToWishlistFromWearEvent` | Relocated server action is HTTP-callable; ownership/visibility gating is server-side, not UI-hidden | wearEventId (untrusted) |
| client URL (`/wears/[username]` + `?from`) → server page | `username` + `from` untrusted; actor resolved server-side, `from` used only as an index lookup within already-gated wears | username, wearEventId (both untrusted) |
| client URL (`/wear/[wearEventId]`) → server page | `wearEventId` untrusted; three-tier gate in `getWearEventByIdForViewer`; `notFound()` indistinguishable for missing/denied | wearEventId (untrusted) |
| client rail → `/wears/[username]` navigation | username sourced from `getWearRailForViewer`; the lane re-resolves and re-gates server-side | username (navigation hint, not authority) |
| client nav-render gate | `pathname.startsWith('/wears/')` hides nav chrome only; it is NOT the auth gate (proxy/`isPublicPath` remains the auth gate) | pathname (render-only) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-56A-01 | Information Disclosure | `getActiveWearsForUser` IDOR | mitigate | Three-tier gate — self-bypass `if (viewerId === actorId)`; non-owner requires `profilePublic=true` + visibility predicate (public, or followers when `viewerFollowsActor`). `wearEvents.ts:450,496-501,528` | closed |
| T-56A-02 | Information Disclosure | Signed-URL leak via DAL (F-2) | mitigate | DAL returns raw `photoUrl` (`wearEvents.ts:458,510`); zero `createSignedUrl`, no `'use cache'` in file | closed |
| T-56A-03 | Spoofing | viewerId spoofed via client input | accept | `import 'server-only'` (`wearEvents.ts:1`); viewerId from `getCurrentUser()` at page layer, never client caller | closed |
| T-56A-04 | Elevation of Privilege | Add-to-wishlist abuse on unauthorized wear (D-08/D-09) | mitigate | `wishlist.ts:27` zod `.strict()`; isSelf guard (L90-97), `profilePublic` gate (L117-120), follower check (L99-115), uniform opaque error | closed |
| T-56A-05 | Tampering | Double-submit duplicate wishlist rows | mitigate | WR-03 guard `if (pending \|\| status === 'added') return` (`WearOverflowMenu.tsx:81`) + `disabled` attr (L126) | closed |
| T-56A-06 | Information Disclosure | permalinkUrl exposes non-public wear via Copy link | accept | `/wear/[id]` route enforces three-tier gate + uniform `notFound()` (`wear/[wearEventId]/page.tsx:54-55`); copy bypasses nothing | closed |
| T-56A-07 | Spoofing / IDOR | `?from` surfaces a wear the viewer can't see | mitigate | `from` used only as `wears.findIndex()`; falls back to index 0; actor from `getProfileByUsername`, not client userId (`wears/[username]/page.tsx:120-125`) | closed |
| T-56A-08 | Information Disclosure | Username enumeration via redirect (D-07) | mitigate | Non-existent → `notFound()` (L51); zero-active → `redirect('/u/${username}')` outside try/catch (L58-60); `/u/` already auth-gated | closed |
| T-56A-09 | Information Disclosure | Signed-URL caching/leak across viewers (F-2) | mitigate | `createSignedUrl` per-request in uncached page body, `Promise.all`, 60-min TTL; no `'use cache'` (`wears/[username]/page.tsx:96-104`) | closed |
| T-56A-10 | Information Disclosure | Per-wear like state leaking across viewers | mitigate | `getLikesForTargetCached` serializes `viewer:${viewerId}:reactions` into cache key (SEC-05, `reactions.ts:149-151`); reused unchanged | closed |
| T-56A-11 | Information Disclosure | Removing anon path changes behavior for unauth visitors | accept | Both wear routes auth-only (EN-6); no `__anon__` branch; proxy redirects anon to /login (`proxy.ts:36-43`); removed branch was dead code | closed |
| T-56A-12 | Information Disclosure | Single-wear read leaking denied wear (IDOR) | mitigate | `getWearEventByIdForViewer` returns null on missing/private/private-visibility/unfollowed (`wearEvents.ts:277,285,289,303`); page `notFound()` uniform (L55) | closed |
| T-56A-13 | Information Disclosure | Signed-URL caching/leak (F-2) | mitigate | `WearPhotoStreamed` mints `createSignedUrl(photoUrl, 60*60)` per-request inside Suspense child; no `'use cache'` (`wear/[wearEventId]/page.tsx:157-163`) | closed |
| T-56A-14 | Elevation of Privilege | `/wears` nav-hide accidentally disabling proxy auth gate | mitigate | `PUBLIC_PATHS` has no `/wears` entry (`public-paths.ts:1-7`); `isPublicPath` is sole proxy gate (`proxy.ts:9`); `/wears/` startsWith check lives only in `BottomNav.tsx:108` + `SlimTopNav.tsx:52` as client render-only (T-56A-14 cited in comments) | closed |
| T-56A-15 | Information Disclosure | Rail navigation exposing username for unseen wear | accept | Rail from `getWearRailForViewer` three-tier gate (`wearEvents.ts:317-406`); `/wears/[username]` re-gates via `getActiveWearsForUser` every request (`wears/[username]/page.tsx:54`) | closed |
| T-56A-16 | DoS / regression | Deleting `WywtOverlay`/`WywtSlide` while importer remains | mitigate | Both files absent (`find` → 0); zero import statements (`grep` → 0); remaining hits are prose comments only | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Unregistered flags:** None. Plans 56A-06..09 (gap closure) declared no new threat surface (read-only client navigation only).

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-56A-01 | T-56A-03 | viewerId cannot be spoofed — DAL is server-only (`import 'server-only'`) and viewerId always flows from `getCurrentUser()` at the page layer. No control needed at the DAL layer. | gsd-security-auditor | 2026-05-23 |
| AR-56A-02 | T-56A-06 | `/wear/[id]` enforces three-tier gate + uniform `notFound()` for missing/denied. URL copying bypasses nothing. | gsd-security-auditor | 2026-05-23 |
| AR-56A-03 | T-56A-11 | Both wear routes are auth-only per EN-6. Removed anon branch was dead code (proxy redirects before it was reached). | gsd-security-auditor | 2026-05-23 |
| AR-56A-04 | T-56A-15 | Rail tiles are server-gated; lane page re-gates on arrival. Client username is a navigation hint, not an authority claim. | gsd-security-auditor | 2026-05-23 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-23 | 16 | 16 | 0 | gsd-security-auditor (claude-sonnet-4-6) |

---

## Key Files Audited

- `src/data/wearEvents.ts` — `getActiveWearsForUser` + `getWearEventByIdForViewer` three-tier gates, `import 'server-only'`, raw photoUrl return
- `src/app/actions/wishlist.ts` — `addToWishlistFromWearEvent` zod `.strict()`, three-tier gate, isSelf guard
- `src/app/wears/[username]/page.tsx` — actor resolution, `?from` index-only use, D-07 redirect outside try/catch, per-request `Promise.all` signed URLs
- `src/app/wear/[wearEventId]/page.tsx` — `getWearEventByIdForViewer` + uniform `notFound()`, `WearPhotoStreamed` per-request signed URL, EN-6 cleanup
- `src/components/wear/WearOverflowMenu.tsx` — WR-03 double-submit guard
- `src/components/layout/BottomNav.tsx` + `SlimTopNav.tsx` — `/wears/` render-only hide, not touching `isPublicPath`
- `src/lib/constants/public-paths.ts` — `PUBLIC_PATHS` allow-list (no `/wears` entry)
- `src/proxy.ts` — `isPublicPath`-based auth gate, `Cache-Control: no-store` on redirect
- `src/data/reactions.ts` — `getLikesForTargetCached` viewerId-keyed cache tag (SEC-05)

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-23
