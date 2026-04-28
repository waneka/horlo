---
id: SEED-003
status: dormant
planted: 2026-04-27
planted_during: v4.0 / Phase 18
trigger_when: planning the first-run / onboarding / signup experience, OR when the recommender milestone needs initial-user signal, OR when sparse-network UX surfaces (see Phase 18 hero) feel like patches instead of fixes
scope: medium-to-large
related_phases: [Phase 18 (sparse-network welcome hero — fallback that this onboarding flow would prevent), Phase 25 (UX-01..04 contextual empty-state CTAs — adjacent territory), future onboarding milestone]
---

# SEED-003: 4-step taste-calibration onboarding (the cold-start make-or-break)

## The Idea

The onboarding flow that gets enough signal in 3–5 minutes for the first feed to feel uncannily good. Four steps:

**Step 1 — Taste calibration via pairwise choice.**
- ~15–20 pairs of References. "Which speaks to you more?"
- Tinder-style A/B, **not** rating sliders.
- Pairs are *designed* to disambiguate axes: dressy vs tool, vintage vs modern, mainstream vs indie, integrated vs traditional, manual vs auto, large vs small, polished vs brushed, color-forward vs monochrome, etc.
- By pair 15 you have a usable initial embedding in the same attribute space the recommender uses (see SEED-002 Layer 2).
- Higher signal than rating UIs. Feels like a game, not a survey.

**Step 2 — Anchor your collection.**
- "Add 1–3 watches you own or have owned."
- Heavy weight in the model (`owned = 1.0` in SEED-002 weights).
- Optional but strongly encouraged. Frame: "the more you add, the better your feed."

**Step 3 — Pick your grails.**
- "What 3–5 watches do you dream about?"
- High signal, low friction, emotionally engaging — people *want* to declare grails.
- Maps to `wishlist` (`0.7` weight in SEED-002).

**Step 4 — Follow 5 curators.**
- Hand-picked editorial accounts at launch (this is where editorial-led bootstrap does real work — see SEED-002).
- Show their list previews so the follow decision is informed.
- Critical for the "people with taste like yours" feeling on day one.

After this, the home feed should already feel sharp:
- Recommended References with explanations
- Posts from followed curators
- "People with taste like yours" module

The first session needs at least one *"huh, I've never heard of that, but I love it"* moment — that's the Rdio feeling, and it's what gets them back tomorrow.

## Why This Matters

> "This is the make-or-break flow. You need enough signal in 3–5 minutes to make the first feed feel uncannily good, or the user bounces and you never get them back."

- **Cold start defines retention.** A boring/empty first session has compounding negative effect.
- **Pairwise > rating.** Pairs reveal preferences people can't articulate. Ratings collect noise. Pairs are also faster and feel like discovery, not work.
- **Owned + wishlist anchors are gold.** They're high-confidence signal and the user is happy to provide them — these are *fun* to declare, not chores.
- **Editorial follows are the cold-start trojan horse.** Until the user × Reference matrix densifies, curator follows are how the user discovers anything personalized. Without them, the first feed is generic.
- **Each step unlocks the next.** By step 4, you've collected enough signal to *show* recommendations during onboarding ("based on your pairs, here are some collectors you might like"). Each step earns its place.

## Phase 18 Alignment Check (per user request)

Phase 18 ships a **sparse-network welcome hero** that conditionally renders when `followingCount < 3 AND wearEventsCount < 1` (D-05, D-06). This is a *patch for users who landed on /explore without enough signal*.

**Is this onboarding vision in conflict with Phase 18?**

**No — they're complementary.** A few notes:

1. **The hero is a safety net for users in the sparse state. The proper fix (this onboarding flow) prevents most users from ever being in that state.** Both should ship.
2. **Even with onboarding, the sparse-network hero still earns its place.** Users who skip onboarding, return after a long absence, or land in edge cases will still hit it. Belt-and-suspenders.
3. **D-05 says "ONE primary CTA"** — when this onboarding ships, that CTA's destination is worth re-examining. Today (D-08) it routes to `/explore/collectors`. With a real onboarding flow, the better destination might be "Restart taste calibration" or "Pick more grails" — i.e., complete the missing onboarding step rather than browse a list.
4. **Popular Collectors rail in Phase 18 is *one* signal. Onboarding step 4 (Follow 5 curators) is a *different* surface** — editorial-curated, not just most-followed. They can coexist; the rail can later add a "Featured curators" sub-section once the editorial slot ships (DISC-09, deferred to v4.x).
5. **Hero CTA copy/framing depends on whether onboarding has shipped.** Until onboarding exists, "Find collectors" is the right action. Once onboarding exists, the hero may want "Resume your taste calibration" or "Tell us your grails" instead.

**Recommendation: ship Phase 18 as planned.** Revisit the hero's CTA target in the onboarding-shipping milestone, but don't re-scope Phase 18.

## When to Surface

**Trigger:** When planning the first-run / signup experience milestone, OR when the recommender milestone (SEED-002) needs initial-user signal infrastructure, OR when an `/onboarding` route appears in the roadmap.

Likely milestone: v5.0 ("recommender + onboarding" pairing makes sense — they're the same project from a signal perspective).

## Scope Estimate

**Medium-to-large** — depends on how much of the recommender (SEED-002) is in place:
- Pairwise chooser UI + 100+ curated pairs (manual curation effort, 1–2 weeks of editorial work)
- Pair-axis design (taxonomy: which axes are we disambiguating?) — coupled to SEED-001 attributes
- Initial-embedding pipeline (pair choices → user vector in attribute space)
- Watch picker for collection / grail steps (existing components in `src/components/watch/` likely reusable)
- Curator browser (UI + the 10–20 launch curators populated)
- Onboarding completion gate (first-run only, skippable, resumable)
- Telemetry on completion rate per step + signal quality post-onboarding

## Breadcrumbs

- `src/proxy.ts` — auth gate; onboarding route would land here
- `src/components/watch/WatchPicker.tsx` (if exists) — likely reusable for steps 2 + 3
- `src/lib/similarity.ts` — attribute space already exists, taste-calibration vector should live in the same space
- `.planning/REQUIREMENTS.md` DISC-09 — Editorial featured collector slot (overlaps with step 4's curator list)
- `.planning/phases/18-explore-discovery-surface/18-CONTEXT.md` D-05..D-08 — sparse-network hero behavior to revisit
- `.planning/phases/18-explore-discovery-surface/18-CONTEXT.md` D-12 — "Not enough data yet" empty-state pattern (similar tone for early-onboarding user)

## Notes

- **Pair-axis taxonomy is the long-pole work.** The pairs only generate good embeddings if the axes are well-chosen. Treat this as a design problem with a watch-domain expert, not a technical problem.
- **Don't gate the app behind onboarding.** Skippable, resumable, reminder-based. The 3–5 minute quote is "what's available", not "what's required."
- **Onboarding feeds the recommender; not the other way around.** Build the signal-extraction layer (SEED-002) first, then onboarding plugs into it. Don't bootstrap onboarding before the recommender knows what to do with the signal.
- **`sold` signal is not part of onboarding** — it's collected later via collection management. Don't ask new users to declare watches they sold; the friction kills completion rate.
- **The "uncanny first feed" requires the recommender to be live.** Onboarding without a recommender is just a data-collection survey. They ship together or onboarding waits.
