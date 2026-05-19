---
id: SEED-013
status: dormant
planted: 2026-05-19
planted_during: 2026-05-19 bug/feature triage — post-v5.1 notes review
trigger_when: starting milestone v7.0, after v6.0 closes.
scope: large
related_phases: [v3.0 WYWT wear photo flow (Phase 15 — EXIF strip, wear-photos bucket, upload pipeline), watch data model (single imageUrl), v5.0/v5.1 add-watch flow]
---

# SEED-013: v7.0 Watch Photos — multi-photo carousel + wear-pic surfacing

## The Idea

Give each watch multiple photos and surface real wear photography on watch detail.

Verbatim notes:
> wear pics should persist in the wears tab. so instead of seeing the generic watch image, you'd see the wear pic. Rail on home can still be visually ephemeral - wears only appear for 24/48 hours
> each watch should be able to show multiple photos in a carousel type thing (one at a time, navigate via arrows or swipe gestures). any wear pic that has "public" visibility should be added to the watch and surfaced on that watch's detail page
> also when adding a watch (to your collection), adding photos should be highly encouraged and these should also surface on watch details (with permission). we'd probably want a (per-person?) cap at some point

## Scope

- **Multi-photo model** — watches currently hold a single `imageUrl`. Replace with a real multi-photo model (photos table or array) + a carousel UI (one photo at a time, arrow / swipe navigation).
- **Public wear pics → watch detail** — any wear photo with `public` visibility is added to the watch and surfaced on its detail page.
- **Wear pics persist in the Wears tab** — the persistent Wears tab shows the actual wear photo instead of the generic catalog image; the Home rail stays visually ephemeral (wears appear for 24/48h only).
- **Add-watch photo encouragement** — the add-watch flow strongly encourages uploading photos; they surface on watch detail with permission; a per-person cap applies at some point.

## Why This Matters

- Real photography (the user's own shots + wear pics) makes a watch page feel owned and alive vs. a generic stock image.
- Wear pics are already captured (v3.0 WYWT flow) but currently evaporate after the ephemeral rail window — surfacing them on watch detail and persisting them in the Wears tab gives that content a lasting home.

## When to Surface

Trigger: `/gsd-new-milestone` for v7.0, after v6.0 ships.

## Open Questions (for the milestone's discuss / spec step)

- Per-person photo cap — what number, and per-watch or per-account?
- "With permission" surfacing — opt-in or opt-out for a wear pic appearing on the watch's detail page?
- Which photo is the card thumbnail / carousel cover; ordering and reordering.
- Wears-tab persistence — which wear photo shows if a watch has many wear events; relationship to the multi-photo carousel.
- Interaction with the v6.0 Social layer — public wear pics on watch detail will also carry the likes/comments shipped in v6.0.
- Storage — reuse the v3.0 `wear-photos` EXIF-strip / ≤1080px JPEG pipeline; a new bucket for watch photos or a shared one.

## Breadcrumbs

- Watch data model — single `imageUrl` today; needs a multi-photo model.
- `wear_events.photo_url` + `wear-photos` Supabase bucket + EXIF-strip / canvas-reencode upload pipeline (v3.0 Phase 15) — reuse for watch photos; build the public-wear-pic → watch-photo linkage.
- Wears tab + Home wear rail — persistence vs ephemerality.
- `AddWatchFlow` / `WatchForm` — add-watch photo encouragement.
