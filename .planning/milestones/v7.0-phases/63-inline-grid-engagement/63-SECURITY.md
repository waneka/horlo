---
phase: 63
slug: inline-grid-engagement
status: verified
threats_open: 0
asvs_level: 2
created: 2026-05-27
---

# Phase 63 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time across 63-01/02/03-PLAN.md; verified against the implementation by gsd-security-auditor.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client (chip / sheet) → Server Action (toggleLikeAction / addCommentAction) | Viewer interaction crosses into server mutation | `{ type, id, body }` (viewer-supplied) |
| Server Action → cache-tag namespace | `revalidateTag` controls which viewers' cached counts are invalidated | tag string `viewer:{userId}:counts` |
| `getBatchedWatchCountsCached` `'use cache'` scope | Per-viewer `liked`/`canComment` fields are cached | `viewerId`-scoped reaction/gate state |
| RSC → client-component props | Server-resolved identity + gate flag passed into the client bundle | `viewerId` (viewer's own id), `canComment` (UX gate flag) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-63-01 | Tampering (IDOR) | toggleLikeAction / addCommentAction target id | mitigate | ownerId resolved from DB via `db.select` (not client input); `toggleLikeSchema.strict()` rejects extra fields — `src/app/actions/reactions.ts:52-62`, schema :26 | closed |
| T-63-02 | Information Disclosure | per-viewer `liked`/`canComment` via `getBatchedWatchCountsCached` `'use cache'` | mitigate | Q6 filters `eq(watchLikes.userId, viewerId)`; cache entry tagged `viewer:{viewerId}:counts`; `viewerId` resolved OUTSIDE the cached scope — `src/data/reactions.ts:295,339`, `page.tsx:188` | closed |
| T-63-03 | Elevation of Privilege | `canComment` flag as a gate | accept | `canComment` is a read-only UX flag from `allowedSet` (reactions.ts:307); real write gate is `createComment` → `canViewerCommentOnTarget` (throws `CommentGateError`) — `src/data/comments.ts:107-108` | closed (accepted) |
| T-63-04 | Information Disclosure (stale cache) | `viewer:{userId}:counts` not busted on mutation | mitigate | `revalidateTag('viewer:{userId}:counts','max')` added inside the owner-username block of BOTH actions — `reactions.ts:111`, `comments.ts:167` | closed |
| T-63-05 | Tampering (XSS) | comment body rendered / stored | mitigate | No `dangerouslySetInnerHTML` (React escapes); `addCommentSchema` `.trim().min(1).max(500).strict()` before write — `WatchCommentSheet.tsx`, `comments.ts:29-35` | closed |
| T-63-06 | Elevation of Privilege (gate bypass) | posting from the sheet when the viewer is gated | mitigate | `createComment` re-checks `canViewerCommentOnTarget` server-side; `CommentGateError` returned as `code:'gate'`; service-role DAL is authoritative — `comments.ts:147-156, 7-10` | closed |
| T-63-07 | Tampering (IDOR) | watch.id passed as the comment target | mitigate | ownerId resolved from DB by id; `addCommentSchema.strict()`; sheet passes only `{ type:'watch', id, body }` — `comments.ts:76-98`, `WatchCommentSheet.tsx:51` | closed |
| T-63-08 | Elevation of Privilege (UI manipulation) | hidden 💬 chip on a gated card | mitigate | `{canComment && …}` is UX-only; `createComment` re-checks the gate regardless of chip visibility — `ProfileWatchCard.tsx:188`, `comments.ts:107-108` | closed |
| T-63-09 | Information Disclosure | `viewerId` threaded into the client bundle | accept | `viewerId` is the viewer's OWN id from `getCurrentUser()`, already client-accessible via the auth session on `/u/*`; never a third party's id — `page.tsx:188` | closed (accepted) |
| T-63-10 | Tampering (IDOR) | watch.id as like/comment target from client | mitigate | Chip passes only `{ type:'watch', id }`; both actions resolve ownerId from DB + Zod `.strict()` — `ProfileWatchCard.tsx:91`, `reactions.ts:52-62`, `comments.ts:76-98` | closed |
| T-63-11 | Information Disclosure (stale / cross-viewer liked) | optimistic chip state seeded from cached counts | mitigate | `liked` seeded from viewer-scoped `getBatchedWatchCountsCached` (tag `viewer:{viewerId}:counts`); tag busted on every mutation — `reactions.ts:339`, `reactions.ts:111`, `comments.ts:167`, `ProfileWatchCard.tsx:77` | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Unregistered flags from SUMMARY.md `## Threat Flags`

All three SUMMARY files reported no new attack surface beyond the plan's threat model. No unregistered flags.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-63-01 | T-63-03 | `canComment` is a UX-only flag, not an enforcement gate. The authoritative gate is `createComment` → `canViewerCommentOnTarget` server-side re-check in the service-role DAL (comments.ts:107-108); un-hiding the chip cannot bypass it. | gsd-secure-phase | 2026-05-27 |
| AR-63-02 | T-63-09 | `viewerId` threaded into the client bundle is the viewer's OWN authenticated id, already present client-side via the auth session on `/u/*`. No third-party identity is exposed. | gsd-secure-phase | 2026-05-27 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-27 | 11 | 11 | 0 | gsd-security-auditor (sonnet) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-27
