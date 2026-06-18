<!--
  MASTER-ADD-LIST.md — deduped catalog adds and verifies for quick task 260614-f82.

  Combines the appendices from LISTS.md + PATHS.md, removes duplicates across the
  two sources, and groups by brand so you can batch your /api/extract-watch
  sessions by manufacturer site.

  - needs_catalog_add — watch is definitely not in prod; add via /api/extract-watch
  - needs_catalog_verify — family is in prod rollup; exact reference may already
    exist (re-run npm run explore:inventory after adds to confirm).

  After all rows below check out:
    1. Re-run inventory: PROD_DATABASE_URL=$DATABASE_URL npm run explore:inventory
    2. Diff: any item still flagged needs_catalog_add in INVENTORY.md → either
       add a missing brand/model, or update LISTS.md/PATHS.md to use the actual
       ref the catalog returned.
    3. Then proceed to cover-gen + migration.
-->

# Master Add List — Explore Editorial Seed

**Totals:** 40 unique adds · 25 unique verifies · 65 total items
**Cross-references absorbed:** 4 items appeared in both LISTS and PATHS appendices (Tissot PRX, CW The Twelve, Baltic Aquascaphe Classic, Hamilton Intra-Matic Auto Chronograph) — each appears once below.

---

## needs_catalog_add — 40 unique watches

Grouped by brand. Brands with **no prod presence at all** are marked _(brand-new)_ so you know they need a brand row created first if your `/api/extract-watch` flow doesn't auto-create brands.

### A. Lange & Söhne _(brand-new — 3 watches)_

- [ ] 1815 — `233.026` — _quiet-luxury list_
- [ ] Saxonia Thin — `211.027` — _going-deeper-2 path (Dress)_
- [ ] Odysseus — `363.179` — _trading-up-1 path (Everyday Steel)_

### anOrdain _(brand-new — 1 watch)_

- [ ] Model 2 — `anOrdain-Model-2` _(placeholder; replace with canonical ref)_ — _microbrand-picks list_

### Baltic _(brand has Hermétique in prod — 2 watches)_

- [ ] Aquascaphe Classic — `Aquascaphe-Classic-Blue` _(placeholder)_ — _first-real-watch list + trading-up-4 path seed_
- [ ] MR01 — `MR01-Salmon` _(placeholder)_ — _trading-up-3 path (Classic Dress)_

### Baume & Mercier _(brand-new — 1 watch)_

- [ ] Riviera — `10728` — _trading-up-2 path (Integrated Sports)_

### Blancpain _(brand has Villeret in prod — 1 watch)_

- [ ] Fifty Fathoms — `5015-1130-71S` — _trading-up-4 path (Vintage Dive)_

### Certina _(brand-new — 1 watch)_

- [ ] DS Action GMT Powermatic 80 — `C032.929.11.051.00` — _starter-five list_

### Christopher Ward _(brand has C60 Trident in prod — 1 watch)_

- [ ] The Twelve 40mm — `C12-40A-S00K0-S00B0-K` _(placeholder)_ — _first-real-watch list + trading-up-2 path_

### Formex _(brand-new — 1 watch)_

- [ ] Essence ThirtyNine Automatic Chronometer — `Formex-Essence-ThirtyNine-Auto-Chronometer` _(placeholder)_ — _microbrand-picks list_

### Furlan Marri _(brand-new — 1 watch)_

- [ ] Chronograph — `Furlan-Marri-Chronograph` _(placeholder)_ — _microbrand-picks list_

### Girard-Perregaux _(brand-new — 1 watch)_

- [ ] Laureato — `81005-11-431-11A` — _trading-up-2 path (Integrated Sports)_

### Hamilton Watch _(brand has American Classic Intra-Matic Auto in prod — 3 watches)_

- [ ] Khaki Field Mechanical (steel) — `H69399930` — _starter-five list_
- [ ] Khaki Field Murph (38mm) — `H70605731` — _first-real-watch list_
- [ ] Intra-Matic Auto Chrono — `H38416711` — _starter-five list + branching-out-1 path (Zulu)_

### Héron Watches _(brand has Marinor Gilt & Black in prod — 1 watch)_

- [ ] Marinor Atlantic Blue — `Marinor-Atlantic-Blue` _(placeholder)_ — _microbrand-picks list_

### Jaeger-LeCoultre _(brand-new — 3 watches)_

- [ ] Master Ultra Thin Small Seconds — `Q1218420` — _going-deeper-2 path (Dress)_
- [ ] Master Ultra Thin (39mm steel) — `Q1342520` — _trading-up-3 path (Classic Dress)_
- [ ] Polaris Date — `Q9068681` — _branching-out-2 path (Speedmaster Branches)_

### Mido _(brand-new — 2 watches)_

- [ ] Ocean Star GMT — `M026.629.11.051.01` — _bezel-math list_
- [ ] Multifort — `M005.430.11.031.00` — _trading-up-1 path (Everyday Steel)_

### Nomos Glashütte _(brand-new — 3 watches)_

- [ ] Tangente 38 (hand-wound) — `165` — _first-real-watch list_
- [ ] Tangente (35mm hand-wound) — `139` — _going-deeper-2 path (Dress)_
- [ ] Tangente neomatik 41 — `180` — _branching-out-1 path (Zulu)_

### Omega _(brand has 16 watches in prod — 2 watches)_

- [ ] Seamaster Aqua Terra 150M Worldtimer GMT — `220.10.43.22.03.001` — _bezel-math list_
- [ ] Seamaster 300 (heritage re-edition) — `234.30.41.21.01.001` — _trading-up-4 path (Vintage Dive)_

### Oris _(brand-new — 2 watches)_

- [ ] Big Crown Pointer Date (40mm) — `01 754 7741 4061-07 5 20 63FC` — _first-real-watch list_
- [ ] Divers Sixty-Five — `01 733 7707 4063-07 5 20 89FC` — _branching-out-1 path (Zulu)_

### Orient _(brand has Star M45 in prod — 1 watch)_

- [ ] Bambino Version 7 — `FAC0000DD0` — _trading-up-3 path (Classic Dress)_

### Patek Philippe _(brand-new — 1 watch)_

- [ ] Calatrava — `5227G-001` — _trading-up-3 path (Classic Dress)_

### Seiko _(brand has 17 watches in prod — 1 watch)_

- [ ] Prospex 1965 "62MAS" — `SPB239` — _going-deeper-1 path seed (Dive Deepening)_

### Serica _(brand-new — 1 watch)_

- [ ] 8315 GMT — `Serica-8315-GMT` _(placeholder)_ — _microbrand-picks list_

### Sinn _(brand has 556 I RS in prod — 1 watch)_

- [ ] 856 UTC — `856.010` — _tool-watch-purist list_

### Squale _(brand has 1521 Classic in prod — 1 watch)_

- [ ] SUB-37 Legend — `Sub-37-Legend` _(placeholder)_ — _trading-up-4 path (Vintage Dive)_

### Tissot _(brand-new — 2 watches)_

- [ ] Le Locle 39.3mm — `T006.407.16.033.00` — _starter-five list_
- [ ] PRX Powermatic 80 (40mm) — `T137.407.11.041.00` — _first-real-watch list + trading-up-2 path seed_

### Vacheron Constantin _(brand-new — 1 watch)_

- [ ] Overseas — `4500V/110A-B128` — _trading-up-2 path (Integrated Sports)_

### Wren _(brand-new — 1 watch)_

- [ ] Diver 38 Aqua — `Wren-Diver-38-Aqua` _(placeholder)_ — _microbrand-picks list_

### Zenith _(brand-new — 1 watch)_

- [ ] Defy Skyline — `03.9300.3620/01.I001` — _branching-out-2 path (Speedmaster Branches)_

---

## needs_catalog_verify — 25 unique references

These watches' brand + family are in prod (per per-family rollup in INVENTORY.md). The specific reference may already exist; check before treating as a needed add.

Verification path: open Supabase Studio → `watches_catalog` → filter by brand + family → confirm the exact reference.

### Grand Seiko _(Heritage 4 + Sport 2 + Elegance 2 in prod)_

- [ ] Snowflake — `SBGA211` — _quiet-luxury list_ (Elegance family — SBGM221 confirmed as one of two)
- [ ] White Birch — `SLGH005` — _quiet-luxury list_ (Heritage family)
- [ ] SBGW231 — `SBGW231` — _going-deeper-2 + trading-up-3 paths (intentional reuse)_ (Heritage family)
- [ ] SBGR253 — `SBGR253` — _trading-up-1 path_ (Sport family)
- [ ] Spring Drive GMT — `SBGE285` — _branching-out-2 path_ (Heritage family)

### Longines _(Spirit 2 + Legend Diver 2 in prod)_

- [ ] Spirit Zulu Time (39mm variant) — `L3.802.4.63.6` — _branching-out-1 path seed_ (Spirit family; `L3.812.4.63.6` confirmed)
- [ ] Spirit Zulu Time (`.53.6` variant) — `L3.812.4.53.6` — _bezel-math list_ (Spirit family)
- [ ] Legend Diver 59 — `L3.781.4.50.0` — _trading-up-4 path_ (Legend Diver family)

### Omega _(Seamaster Diver 300M 3 + Seamaster Planet Ocean 2 + Speedmaster Moonwatch 8 in prod)_

- [ ] Seamaster Diver 300M — `210.30.42.20.01.001` — _tool-watch-purist list_
- [ ] Seamaster Planet Ocean 600M — `215.30.44.21.01.001` — _going-deeper-1 path_
- [ ] Speedmaster Professional Moonwatch — `311.30.42.30.01.005` — _branching-out-2 path seed_

### Rolex _(Submariner 8 + Sea-Dweller 4 + GMT-Master II 5 + Datejust 2 + Explorer 3 in prod)_

- [ ] Submariner No-Date — `124060` — _going-deeper-1 path_
- [ ] Sea-Dweller — `126600` — _tool-watch-purist list_
- [ ] GMT-Master II "Batman" — `126710BLNR` — _bezel-math list_
- [ ] Datejust 41 — `126334` — _trading-up-1 path_
- [ ] Explorer 40 — `224270` — _branching-out-2 path_

### Seiko _(5 Sports 2 + Prospex Turtle 3 + Prospex Sumo 2 + Alpinist 2 in prod)_

- [ ] 5 Sports GMT — `SSK001` — _bezel-math list_ (5 Sports family — only 2 in prod, GMT likely missing)
- [ ] 5 Sports SRPE51 — `SRPE51` — _trading-up-1 path seed_ (5 Sports family)
- [ ] Prospex Alpinist — `SPB507` — _first-real-watch list_ (Alpinist family)
- [ ] Prospex Turtle — `SRP777` — _tool-watch-purist list_
- [ ] Prospex Sumo — `SBDC001` — _tool-watch-purist list_

### Steinhart _(Ocean 2 in prod)_

- [ ] Ocean One 39 — `Ocean-One-39` — _tool-watch-purist list_

### Tudor _(Black Bay 5 + Pelagos 2 in prod)_

- [ ] Black Bay 58 GMT — `7939G1A0NRU` — _bezel-math list_
- [ ] Black Bay 58 — `79030N` — _going-deeper-1 path_
- [ ] Pelagos — `25600TN` — _tool-watch-purist list_

---

## After you finish adding

1. **Re-run inventory** to get an updated INVENTORY.md:
   ```bash
   PROD_DATABASE_URL=$DATABASE_URL npm run explore:inventory
   ```
2. **Reconcile any remaining gaps** — if a placeholder ref (e.g. `Aquascaphe-Classic-Blue`) needs to be replaced with the actual ref returned by `/api/extract-watch`, update LISTS.md and PATHS.md before the migration runs.
3. **Generate covers**:
   ```bash
   AI_GATEWAY_API_KEY=... npm run explore:covers
   ```
4. Signal "covers ready" and the migration generator + local apply runs next.
