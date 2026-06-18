<!-- PATHS.md — 8 collection paths for /explore editorial seed -->
<!-- Editorial rewrite applied 2026-06-17: user editorial pass, paths cuts + rewrites -->
<!-- needs_catalog_add: true  = definitely missing, add via /api/extract-watch -->
<!-- needs_catalog_verify: true = family confirmed in prod rollup; exact ref may differ -->
<!-- Distribution: 2 Going Deeper / 2 Branching Out / 4 Trading Up / 0 Filling a Gap -->
<!-- Each path: 1 seed + exactly 3 or 4 follow-on nodes at sort_order 0, 1, 2[, 3] -->

## going-deeper-1
slug: going-deeper-1
path_type: Going Deeper
sort_order: 10
seed:
  brand: Seiko
  model: Prospex 1965 "62MAS"
  reference: SPB239
  needs_catalog_add: true   # Prospex Marinemaster family has 4 in prod — verify if SPB239 is one of them
rationale: |
  A single tool-ethos dive line — same conviction, properly executed and deepened
  at each rung. Same tool ethos, progressively more sophisticated execution. Every
  step adds something the previous could not without abandoning the original conviction.
nodes:
  - brand: Tudor
    model: Black Bay 58
    reference: 79030N
    needs_catalog_verify: true   # Black Bay family has 5 in prod
    rationale: The leap into Swiss manufacture — MT5400-U, COSC + METAS Master Chronometer, vintage-Sub DNA at 39mm. Still a tool, now with a chronometer's heart.
    sort_order: 0
  - brand: Omega
    model: Seamaster Planet Ocean 600M
    reference: 215.30.44.21.01.001
    needs_catalog_verify: true   # Seamaster Planet Ocean family has 2 in prod
    rationale: The depth step — 600m, Co-Axial cal. 8900, Master Chronometer. The genre pushed to its literal extreme.
    sort_order: 1
  - brand: Rolex
    model: Submariner No-Date
    reference: 124060
    needs_catalog_verify: true   # Submariner family has 8 in prod
    rationale: The source — cal. 3230, 300m, Cerachrom. The most influential tool diver ever made, where the SKX's conviction was first written.
    sort_order: 2

---

## going-deeper-2
slug: going-deeper-2
path_type: Going Deeper
sort_order: 20
seed:
  brand: Hamilton Watch
  model: American Classic Intra-Matic Auto
  reference: H38425540
  # Confirmed in INVENTORY.md top-50 row. No flag.
rationale: |
  A great dress watch says less and finishes more. The Hamilton sets the form.
  The Nomos adds the first movement decoration worth turning over for. The Grand
  Seiko moves the craft to the surfaces. The JLC brings ultra-thin manufacture
  pedigree. The Lange ends where finishing becomes the whole point. The watches
  get quieter as the work gets deeper.
nodes:
  - brand: Nomos Glashütte
    model: Tangente
    reference: "139"
    needs_catalog_add: true   # Nomos brand absent from catalog
    rationale: The first finishing you notice — in-house Alpha caliber with Glashütte decoration, sunburst graining, blued screws under a Bauhaus dial. The first time the caseback rewards turning over.
    sort_order: 0
  - brand: Grand Seiko
    model: SBGW231
    reference: SBGW231
    needs_catalog_verify: true   # Heritage family has 4 in prod; SBGW231 not individually confirmed
    rationale: Finishing that needs light to exist — Zaratsu-polished case, diamond-cut hands and indices, hand-wound 9S64. Swiss-level dial craft at half the Swiss price.
    sort_order: 1
  - brand: Jaeger-LeCoultre
    model: Master Ultra Thin Small Seconds
    reference: Q1218420
    needs_catalog_add: true   # JLC brand absent from catalog
    rationale: The watchmaker's watch — 39mm case at 8.1mm thick, eggshell dial, faceted indices. Ultra-thin tradition dating to 1907; the manufacture that once supplied Patek, AP, and Vacheron.
    sort_order: 2
  - brand: A. Lange & Söhne
    model: Saxonia Thin
    reference: "211.027"
    needs_catalog_add: true   # Lange brand absent from catalog
    rationale: The finishing summit — German-silver plates, gold chatons, hand-engraved balance cock. Arguably the best series finishing on earth on a dial of near-total silence.
    sort_order: 3

---

## branching-out-1
slug: branching-out-1
path_type: Branching Out
sort_order: 30
seed:
  brand: Longines
  model: Spirit Zulu Time 39mm
  reference: L3.802.4.63.6
  needs_catalog_verify: true   # Spirit family has 2 in prod; L3.812.4.63.6 confirmed — L3.802 is the 39mm variant, may not yet be in prod
rationale: |
  The Spirit Zulu Time is a versatile starting point — a contemporary aviator GMT
  with restrained design. This path branches laterally: the water branch trades GMT
  for dive utility; the craft branch trades complication for movement architecture;
  the complication branch trades dual-time for the mechanical stopwatch.
nodes:
  - brand: Oris
    model: Divers Sixty-Five
    reference: 01 733 7707 4063-07 5 20 89FC
    needs_catalog_add: true   # Oris brand absent from catalog
    rationale: The water branch — an independent-Swiss vintage diver with a rotating bezel and real dive utility in place of the GMT.
    sort_order: 0
  - brand: Nomos Glashütte
    model: Tangente neomatik 41
    reference: "180"
    needs_catalog_add: true   # Nomos brand absent from catalog
    rationale: The craft branch — German Bauhaus restraint over an in-house ultra-thin automatic, complications stripped away.
    sort_order: 1
  - brand: Hamilton Watch
    model: Intra-Matic Auto Chronograph
    reference: H38416711
    needs_catalog_add: true   # Same ref already in starter-five list
    rationale: The complication branch — a mid-century bicompax panda that swaps dual-time for the mechanical stopwatch.
    sort_order: 2

---

## branching-out-2
slug: branching-out-2
path_type: Branching Out
sort_order: 40
seed:
  brand: Omega
  model: Speedmaster Professional Moonwatch
  reference: 311.30.42.30.01.005
  needs_catalog_verify: true   # Speedmaster Moonwatch family has 8 in prod
rationale: |
  The Speedmaster Professional is the canonical starting chronograph. This path
  branches into four other relationships a serious watch can have with time:
  silence, manufacture, frequency, and tool clarity.
nodes:
  - brand: Grand Seiko
    model: Spring Drive GMT
    reference: SBGE285
    needs_catalog_verify: true   # Heritage family has 4 in prod; SBGE285 not individually confirmed
    rationale: A movement you've never felt — the silent Spring Drive glide plus a traveler GMT.
    sort_order: 0
  - brand: Jaeger-LeCoultre
    model: Polaris Date
    reference: Q9068681
    needs_catalog_add: true   # JLC brand absent from catalog
    rationale: A sports watch from a watchmaker's watchmaker, with Memovox dive heritage and real manufacture finishing.
    sort_order: 1
  - brand: Zenith
    model: Defy Skyline
    reference: 03.9300.3620/01.I001
    needs_catalog_add: true   # Zenith brand absent from catalog
    rationale: Modern, high-frequency integrated sport — the 5Hz El Primero and its 1/10th-second subdial.
    sort_order: 2
  - brand: Rolex
    model: Explorer 40
    reference: "224270"
    needs_catalog_verify: true   # Explorer family has 3 in prod
    rationale: The pared-down, time-only tool watch — blue-chip Everest heritage, no premium games.
    sort_order: 3

---

## trading-up-1
slug: trading-up-1
path_type: Trading Up
sort_order: 50
seed:
  brand: Seiko
  model: 5 Sports SRPE51
  reference: SRPE51
  needs_catalog_verify: true   # 5 Sports family has 2 in prod
rationale: |
  The everyday steel watch built five times over: same brief — go-anywhere,
  ask-nothing — interpreted by five tiers of watchmaking. Each rung adds finishing,
  certification, or movement architecture the tier below couldn't justify.
nodes:
  - brand: Mido
    model: Multifort
    reference: M005.430.11.031.00
    needs_catalog_add: true   # Mido brand absent from catalog
    rationale: The everyday brief in Swiss form — robust, day/date, 80-hour Caliber 80, on a bracelet.
    sort_order: 0
  - brand: Grand Seiko
    model: SBGR253
    reference: SBGR253
    needs_catalog_verify: true   # Sport family has 2 in prod; SBGR253 not individually confirmed
    rationale: The family trade-up — the same do-it-all automatic, elevated to Zaratsu-polished, diamond-cut craft.
    sort_order: 1
  - brand: Rolex
    model: Datejust 41
    reference: "126334"
    needs_catalog_verify: true   # Datejust family has 2 in prod
    rationale: The archetype — the one-watch-do-it-all with the durability and gravitas of the steel-sports benchmark.
    sort_order: 2
  - brand: A. Lange & Söhne
    model: Odysseus
    reference: "363.179"
    needs_catalog_add: true   # Lange brand absent from catalog
    rationale: The haute terminus — a day-and-date steel sports watch. The original's exact DNA at the summit of hand-finishing.
    sort_order: 3

---

## trading-up-2
slug: trading-up-2
path_type: Trading Up
sort_order: 60
seed:
  brand: Tissot
  model: PRX Powermatic 80
  reference: T137.407.11.041.00
  needs_catalog_add: true   # Same ref already in first-real-watch list
rationale: |
  The Genta-lineage integrated steel sports watch across five tiers: from the entry
  icon to the trinity, each rung a serious step in case finishing and movement
  pedigree within the same archetype.
nodes:
  - brand: Christopher Ward
    model: The Twelve 40mm
    reference: C12-40A-S00K0-S00B0-K
    needs_catalog_add: true   # Same placeholder as first-real-watch list
    rationale: The first real step up — sharper case angles, a more refined bracelet, and finishing that embarrasses watches twice its price.
    sort_order: 0
  - brand: Baume & Mercier
    model: Riviera
    reference: "10728"
    needs_catalog_add: true   # Baume & Mercier brand absent from catalog
    rationale: The heritage rung — one of the original 1973 integrated sports watches; dodecagonal bezel, in-house Baumatic movement with five-day reserve.
    sort_order: 1
  - brand: Girard-Perregaux
    model: Laureato
    reference: 81005-11-431-11A
    needs_catalog_add: true   # Girard-Perregaux brand absent from catalog
    rationale: The "fourth icon" — a genuine 1975 Genta-era integrated sports watch, fully in-house, the connoisseur's pick one step below the trinity.
    sort_order: 2
  - brand: Vacheron Constantin
    model: Overseas
    reference: 4500V/110A-B128
    needs_catalog_add: true   # Vacheron Constantin brand absent from catalog
    rationale: The haute terminus — in-house Caliber 5100 with a 22k gold rotor. The trinity's most understated entry; integrated sports as quiet flex rather than hype object.
    sort_order: 3

---

## trading-up-3
slug: trading-up-3
path_type: Trading Up
sort_order: 70
seed:
  brand: Orient
  model: Bambino Version 7
  reference: FAC0000DD0
  needs_catalog_add: true   # Orient in prod with Star M45 but Bambino not confirmed
rationale: |
  The round classic dress watch built five times: same form — clean dial, simple
  complication, restrained case — interpreted by five tiers of watchmaking. The
  thesis the Orient states, the Patek defined in 1932.
nodes:
  - brand: Baltic
    model: MR01
    reference: MR01-Salmon
    needs_catalog_add: true   # Baltic has Hermétique in prod; MR01 not confirmed
    rationale: The story rung — an accessible Calatrava in 36mm, thin micro-rotor movement, Breguet numerals. Haute-horlogerie flavor at a microbrand price.
    sort_order: 0
  - brand: Grand Seiko
    model: SBGW231
    reference: SBGW231
    needs_catalog_verify: true   # Heritage family has 4 in prod; same ref as going-deeper-2 — intentional cross-list reuse
    rationale: The family trade-up — Orient to its group's luxury arm. Clean hand-wound classic in a Zaratsu-polished case, diamond-cut hands that need light to reveal themselves.
    sort_order: 1
  - brand: Jaeger-LeCoultre
    model: Master Ultra Thin
    reference: Q1342520
    needs_catalog_add: true   # JLC brand absent from catalog
    rationale: The leap into haute horlogerie — ultra-thin, manufacture-finished, from the maison that once supplied movements to the trinity itself.
    sort_order: 2
  - brand: Patek Philippe
    model: Calatrava
    reference: 5227G-001
    needs_catalog_add: true   # Patek Philippe brand absent from catalog
    rationale: The terminus and the source — the watch that defined the modern round dress watch in 1932. The form every rung beneath it is an echo of.
    sort_order: 3

---

## trading-up-4
slug: trading-up-4
path_type: Trading Up
sort_order: 80
seed:
  brand: Baltic
  model: Aquascaphe Classic
  reference: Aquascaphe-Classic-Blue
  needs_catalog_add: true   # Same as first-real-watch list
rationale: |
  The vintage-inspired dive watch across five tiers: each rung a more authentic
  relationship with mid-century dive heritage. From homage at the entry, to
  genuine reissue, to the literal source.
nodes:
  - brand: Squale
    model: SUB-37 Legend
    reference: Sub-37-Legend
    needs_catalog_add: true   # Squale has 1521 in prod; SUB-37 not confirmed
    rationale: The heritage jump — 37mm, 1959-proportioned diver from the house that made cases for the golden-age originals. Homage by birthright.
    sort_order: 0
  - brand: Longines
    model: Legend Diver 59
    reference: L3.781.4.50.0
    needs_catalog_verify: true   # Legend Diver family has 2 in prod; L3.781.4.50.0 not individually confirmed
    rationale: A genuine golden-age reissue — Longines's 1959 super-compressor with twin crowns, internal bezel, COSC-certified, silicon hairspring. A contemporary of the Fifty Fathoms.
    sort_order: 1
  - brand: Omega
    model: Seamaster 300
    reference: 234.30.41.21.01.001
    needs_catalog_add: true   # Seamaster Diver 300M in prod but not the heritage Seamaster 300
    rationale: Not a homage but a time capsule — a literal re-edition of the 1957 Seamaster 300, carrying the Co-Axial Master Chronometer movement.
    sort_order: 2
  - brand: Blancpain
    model: Fifty Fathoms
    reference: 5015-1130-71S
    needs_catalog_add: true   # Blancpain has Villeret in prod; Fifty Fathoms not confirmed
    rationale: The terminus and the source — the 1953 watch widely held to be the first modern dive watch. The template every rung beneath it descends from.
    sort_order: 3

---

## TO ADD TO CATALOG (paths)

Watches in paths that require catalog additions or verification. Does not duplicate
items already covered in the LISTS.md appendix unless they are new picks specific
to paths.

### needs_catalog_add (paths only — brand absent or exact ref unconfirmed)

| path | node | brand | model | reference | notes |
| ---- | ---- | ----- | ----- | --------- | ----- |
| going-deeper-1 | seed | Seiko | Prospex 1965 "62MAS" | SPB239 | Prospex Marinemaster family has 4 in prod — verify if SPB239 is one of them; add if not |
| going-deeper-2 | node 1 | Nomos Glashütte | Tangente | 139 | Nomos brand absent |
| going-deeper-2 | node 3 | Jaeger-LeCoultre | Master Ultra Thin Small Seconds | Q1218420 | JLC brand absent |
| going-deeper-2 | node 4 | A. Lange & Söhne | Saxonia Thin | 211.027 | Lange brand absent |
| branching-out-1 | node 1 | Oris | Divers Sixty-Five | 01 733 7707 4063-07 5 20 89FC | Oris brand absent |
| branching-out-1 | node 2 | Nomos Glashütte | Tangente neomatik 41 | 180 | Nomos brand absent |
| branching-out-1 | node 3 | Hamilton Watch | Intra-Matic Auto Chronograph | H38416711 | Cross-reference LISTS.md appendix — same ref in starter-five list |
| branching-out-2 | node 2 | Jaeger-LeCoultre | Polaris Date | Q9068681 | JLC brand absent |
| branching-out-2 | node 3 | Zenith | Defy Skyline | 03.9300.3620/01.I001 | Zenith brand absent |
| trading-up-1 | node 1 | Mido | Multifort | M005.430.11.031.00 | Mido brand absent |
| trading-up-1 | node 4 | A. Lange & Söhne | Odysseus | 363.179 | Lange brand absent |
| trading-up-2 | seed | Tissot | PRX Powermatic 80 | T137.407.11.041.00 | Cross-reference LISTS.md appendix — same ref in first-real-watch list |
| trading-up-2 | node 1 | Christopher Ward | The Twelve 40mm | C12-40A-S00K0-S00B0-K | Cross-reference LISTS.md appendix — same placeholder in first-real-watch list |
| trading-up-2 | node 2 | Baume & Mercier | Riviera | 10728 | Baume & Mercier brand absent |
| trading-up-2 | node 3 | Girard-Perregaux | Laureato | 81005-11-431-11A | Girard-Perregaux brand absent |
| trading-up-2 | node 4 | Vacheron Constantin | Overseas | 4500V/110A-B128 | Vacheron Constantin brand absent |
| trading-up-3 | seed | Orient | Bambino Version 7 | FAC0000DD0 | Orient in prod with Star M45; Bambino not confirmed |
| trading-up-3 | node 1 | Baltic | MR01 | MR01-Salmon | Baltic has Hermétique in prod; MR01 not confirmed |
| trading-up-3 | node 3 | Jaeger-LeCoultre | Master Ultra Thin | Q1342520 | JLC brand absent |
| trading-up-3 | node 4 | Patek Philippe | Calatrava | 5227G-001 | Patek Philippe brand absent |
| trading-up-4 | seed | Baltic | Aquascaphe Classic | Aquascaphe-Classic-Blue | Cross-reference LISTS.md appendix — same ref in first-real-watch list |
| trading-up-4 | node 1 | Squale | SUB-37 Legend | Sub-37-Legend | Squale has 1521 in prod; SUB-37 not confirmed |
| trading-up-4 | node 3 | Omega | Seamaster 300 | 234.30.41.21.01.001 | Seamaster Diver 300M in prod but not the heritage Seamaster 300 |
| trading-up-4 | node 4 | Blancpain | Fifty Fathoms | 5015-1130-71S | Blancpain has Villeret in prod; Fifty Fathoms not confirmed |

### needs_catalog_verify (family in prod but exact ref unconfirmed)

| path | node | brand | model | reference | family / count |
| ---- | ---- | ----- | ----- | --------- | -------------- |
| going-deeper-1 | node 1 | Tudor | Black Bay 58 | 79030N | Black Bay (5 in prod) |
| going-deeper-1 | node 2 | Omega | Seamaster Planet Ocean 600M | 215.30.44.21.01.001 | Seamaster Planet Ocean (2 in prod) |
| going-deeper-1 | node 3 | Rolex | Submariner No-Date | 124060 | Submariner (8 in prod) |
| going-deeper-2 | node 2 | Grand Seiko | SBGW231 | SBGW231 | Heritage (4 in prod) |
| branching-out-1 | seed | Longines | Spirit Zulu Time 39mm | L3.802.4.63.6 | Spirit (2 in prod; L3.812 confirmed, .802 may differ) |
| branching-out-2 | seed | Omega | Speedmaster Professional Moonwatch | 311.30.42.30.01.005 | Speedmaster Moonwatch (8 in prod) |
| branching-out-2 | node 1 | Grand Seiko | Spring Drive GMT | SBGE285 | Heritage (4 in prod) |
| branching-out-2 | node 4 | Rolex | Explorer 40 | 224270 | Explorer (3 in prod) |
| trading-up-1 | seed | Seiko | 5 Sports SRPE51 | SRPE51 | 5 Sports (2 in prod) |
| trading-up-1 | node 2 | Grand Seiko | SBGR253 | SBGR253 | Sport (2 in prod) |
| trading-up-1 | node 3 | Rolex | Datejust 41 | 126334 | Datejust (2 in prod) |
| trading-up-3 | node 2 | Grand Seiko | SBGW231 | SBGW231 | Heritage (4 in prod) — intentional reuse with going-deeper-2 |
| trading-up-4 | node 2 | Longines | Legend Diver 59 | L3.781.4.50.0 | Legend Diver (2 in prod) |
