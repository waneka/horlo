# Requirements: Horlo — v6.0 Social Interaction

**Defined:** 2026-05-22
**Core Value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Milestone goal:** Add a scoped, tasteful likes-and-comments layer on individual watches and wears — social warmth atop the existing Rdio-style discovery, explicitly *not* "Instagram for watches."

## v1 Requirements

Requirements for this milestone (v6.0). Each maps to a roadmap phase.

### Likes (LIKE)

- [ ] **LIKE-01**: A user can like and unlike any individual watch on a collector's profile (owned/sold/grail/wishlist); the control reflects the viewer's current like state.
- [ ] **LIKE-02**: A user can like and unlike any wear post at `/wear/[wearEventId]`.
- [ ] **LIKE-03**: Like state and count update optimistically and roll back on server failure.
- [ ] **LIKE-04**: The like count shows next to the control on watch detail and wear detail; hidden when zero.
- [ ] **LIKE-05**: A user cannot like the same target twice (idempotent, enforced by a UNIQUE constraint).

### Comments (CMNT)

- [ ] **CMNT-01**: A user can post a comment on an individual watch (subject to the wishlist gate, GATE-01).
- [ ] **CMNT-02**: A user can post a comment on a wear post.
- [ ] **CMNT-03**: Comments render as a flat, **newest-first** list showing the author avatar, linked username, body, and relative timestamp. (Operator decision 2026-05-22 — overrides the research SUMMARY's oldest-first suggestion; compose box sits above the list.)
- [ ] **CMNT-04**: A comment is limited to 500 characters, enforced at the input, the Server Action (Zod `.strict()`), and the database (CHECK); empty/whitespace-only comments are rejected.
- [ ] **CMNT-05**: The comment box shows a live character counter as the user nears the 500-char limit.
- [ ] **CMNT-06**: A comment author can edit their own comment in place; an edited comment shows an "[edited]" indicator.
- [ ] **CMNT-07**: A comment author can delete their own comment via an inline confirm; non-authors cannot edit or delete.
- [ ] **CMNT-08**: A new comment appears optimistically at the top of the list (pending state) and reconciles on success / rolls back on failure.
- [ ] **CMNT-09**: The comment count shows on watch detail and wear detail.

### Wishlist Comment Gate (GATE)

- [ ] **GATE-01**: Comments on a watch with status `wishlist` are restricted to mutual followers; comments on owned/sold/grail watches and on wears are open to any authenticated user.
- [ ] **GATE-02**: Likes remain open to any authenticated user on all watches, including wishlist watches (the intended asymmetry).
- [ ] **GATE-03**: A non-mutual-follower viewing a wishlist watch sees a "Follow [username] to comment" locked-state CTA instead of the compose box, with no gated comment content leaked.
- [ ] **GATE-04**: The collection owner can always comment on their own watches regardless of the gate.
- [ ] **GATE-05**: The mutual-follow relationship is computed bidirectionally via a dedicated `isMutualFollow` check (not reused from one-directional `isFollowing`).

### Notifications (NOTIF — continues Phase 13's NOTIF-01..10)

- [ ] **NOTIF-11**: An owner is notified when another user likes their watch or wear (never self-notified).
- [ ] **NOTIF-12**: An owner is notified when another user comments on their watch or wear (never self-notified).
- [ ] **NOTIF-13**: Like notifications for the same target are grouped ("X and N others liked …") rather than one per like.
- [ ] **NOTIF-14**: Rapid like/unlike churn does not produce duplicate/spam notifications (deduped).
- [ ] **NOTIF-15**: A user can independently opt out of like notifications and comment notifications in Settings → Notifications (`notifyOnLike`, `notifyOnComment`).
- [ ] **NOTIF-16**: Like/comment notifications render with clear copy and deep-link to the target in the existing inbox + bell.

### Activity Feed (FEED — continues v2.0's FEED-01..05)

- [ ] **FEED-06**: When a user comments on a watch or wear, a comment activity is recorded and surfaces in the home Network Activity feed for that user's followers (respecting the existing own-or-followed feed privacy). **Likes do NOT generate feed activities** (operator decision — likes live only in bell notifications).
- [ ] **FEED-07**: Comment feed activities respect the comment's own visibility — a comment on a mutual-follow-gated wishlist watch, or on a private collection/profile, is not surfaced to feed viewers who are not eligible to see that comment (no leak of gated content via the feed).

### Privacy & Security (SEC)

- [ ] **SEC-01**: The new likes and comments tables enforce two-layer privacy — Postgres RLS (authenticated-only, no anon read/write) AND an explicit DAL `WHERE`/gate check.
- [ ] **SEC-02**: The wishlist-comment mutual-follow gate is enforced in BOTH layers, verified by an integration test where a non-mutual-follower calling the DAL directly is rejected.
- [ ] **SEC-03**: Like/comment create/edit/delete Server Actions re-verify auth + ownership/authorship server-side (no IDOR, no client-trusted author/target, Zod `.strict()`).
- [ ] **SEC-04**: Any SECURITY DEFINER helper introduced (e.g., mutual-follow) revokes EXECUTE from PUBLIC and anon, asserted in-migration.
- [ ] **SEC-05**: Viewer-specific like state and gated comment threads do not leak across viewers via the cache (per-viewer scoping; gated threads not served from a shared cache).
- [ ] **SEC-06**: Deleting a watch or wear event removes its associated likes and comments (no orphaned interaction rows).

### Display (DISP)

- [ ] **DISP-01**: Profile collection/wishlist grid cards show a combined "X likes · Y comments" line per watch, sourced from a single batched query (no N+1).

## Future Requirements

Deferred to a later release. Tracked, not in this roadmap.

### Social (later)

- **SOC-F1**: Liker avatar strip / "who liked" surfacing (follow-aware AvatarStack).
- **SOC-F2**: Notify prior commenters when a new comment lands on the same target (reply-style fan-out).
- **SOC-F3**: Email digest for social notifications (protect `mail.horlo.app` reputation; in-app only for v6.0).
- **SOC-F4**: @mention / user tagging within comments.
- **SOC-F5**: Threaded / nested comment replies.

## Out of Scope

Explicitly excluded from v6.0 to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Threaded / nested comment replies | Flat comments only this milestone (locked scope). |
| Report / hide / moderation tools | Single-user scale; revisit when the network grows. |
| Likes on whole collections or whole wishlists | Likes target individual watches + wears only (operator decision). |
| Surface-level (whole collection/wishlist) comments | Comments target individual watches + wears only (operator decision). |
| Supabase Realtime / live updates | Optimistic UI + `revalidateTag` is sufficient; live updates run against the "not Instagram" guardrail. |
| Public likers list / like leaderboards | Count-only display; "not Instagram." |
| Email notifications for likes/comments | In-app notifications only; protect sender reputation. |
| Anonymous (unauthenticated) likes/comments | Authenticated users only. |

## Traceability

Which phases cover which requirements. Filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LIKE-01 | — | Pending |
| LIKE-02 | — | Pending |
| LIKE-03 | — | Pending |
| LIKE-04 | — | Pending |
| LIKE-05 | — | Pending |
| CMNT-01 | — | Pending |
| CMNT-02 | — | Pending |
| CMNT-03 | — | Pending |
| CMNT-04 | — | Pending |
| CMNT-05 | — | Pending |
| CMNT-06 | — | Pending |
| CMNT-07 | — | Pending |
| CMNT-08 | — | Pending |
| CMNT-09 | — | Pending |
| GATE-01 | — | Pending |
| GATE-02 | — | Pending |
| GATE-03 | — | Pending |
| GATE-04 | — | Pending |
| GATE-05 | — | Pending |
| NOTIF-11 | — | Pending |
| NOTIF-12 | — | Pending |
| NOTIF-13 | — | Pending |
| NOTIF-14 | — | Pending |
| NOTIF-15 | — | Pending |
| NOTIF-16 | — | Pending |
| FEED-06 | — | Pending |
| FEED-07 | — | Pending |
| SEC-01 | — | Pending |
| SEC-02 | — | Pending |
| SEC-03 | — | Pending |
| SEC-04 | — | Pending |
| SEC-05 | — | Pending |
| SEC-06 | — | Pending |
| DISP-01 | — | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 34 ⚠️ (filled by roadmapper)

---
*Requirements defined: 2026-05-22*
*Last updated: 2026-05-22 after /gsd-new-milestone (v6.0 Social Interaction)*
