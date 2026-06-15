<!-- LISTS.md — 6 curated lists for /explore editorial seed -->
<!-- Editorial rewrite applied 2026-06-14: user list rewrites; tropical-dial + trading-up cut -->
<!-- needs_catalog_add: true  = definitely missing, add via /api/extract-watch -->
<!-- needs_catalog_verify: true = family confirmed in prod rollup; exact ref may differ -->
<!-- Parser contract: each list starts with "## <slug>", frontmatter lines follow, -->
<!-- "items:" marks the start of YAML item blocks. Separator: --- between lists. -->

## starter-five
title: The Five-Watch Starter Collection
slug: starter-five
curator_name: Horlo Editorial
sort_order: 10
intro_markdown: |
  Five watches that cover everything a new collector needs without repeating
  themselves. Each one earns its slot by being genuinely different — not just a
  different brand wearing the same silhouette. A diver, a field watch, a GMT,
  a dress automatic, and a chronograph: together they answer every occasion,
  movement type, and wearing mood a collector will encounter in the first decade.
  Buy slowly, wear each one hard, and you'll understand why every watch that
  comes after is measured against this foundation.
items:
  - brand: Seiko
    model: 5 Sports SRPD51
    reference: SRPD51
    commentary: The spiritual successor to the discontinued SKX — automatic in-house movement, real bezel, screw-down crown. Start here, wear it hard.
    sort_order: 10
  - brand: Hamilton Watch
    model: Khaki Field Mechanical
    reference: H69399930
    needs_catalog_add: true      # Hamilton field watch; exact ref H69399930 not in prod
    commentary: The hand-wound field watch that converts people. At this price it is the honest answer to "what should my first serious automatic be?"
    sort_order: 20
  - brand: Certina
    model: DS Action GMT Powermatic 80
    reference: C032.929.11.051.00
    needs_catalog_add: true      # Certina brand not in prod catalog
    commentary: GMT complication on a Powermatic 80 movement — 80-hour reserve, sapphire, 200m. This is what a capable GMT costs when the logo isn't doing half the work.
    sort_order: 30
  - brand: Tissot
    model: Le Locle 39.3mm
    reference: T006.407.16.033.00
    needs_catalog_add: true      # Tissot brand not in prod catalog
    commentary: Dress automatic with a visible movement and a 39mm case that fits a wrist correctly. The formal slot, solved without compromise.
    sort_order: 40
  - brand: Hamilton Watch
    model: Intra-Matic Auto Chrono
    reference: H38416711
    needs_catalog_add: true      # Hamilton brand in prod but Intra-Matic Chrono ref not confirmed
    commentary: Automatic chronograph from a brand with genuine horological heritage — column-wheel movement, vintage-correct proportions, no fluff.
    sort_order: 50
cover_prompt_summary: Abstract compositional mood suggesting "the fundamentals" — see COVER-PROMPTS.md.

---

## bezel-math
title: Bezel Math: Why GMTs Are Easy Mode
slug: bezel-math
curator_name: Horlo Editorial
sort_order: 20
intro_markdown: |
  The GMT complication looks complicated until it doesn't. Track a second time
  zone with one extra hand and a 24-hour bezel — that's it. Once you understand
  the mechanic, you'll find the GMT reading becomes second nature faster than
  any other complication. This list works through a specific GMT ladder: entry
  point to horological benchmark, seven references that show exactly where the
  money goes and where it doesn't need to.
items:
  - brand: Seiko
    model: 5 Sports GMT
    reference: SSK001
    needs_catalog_verify: true   # 5 Sports family has 2 in prod; SSK001 GMT likely missing
    commentary: The GMT gateway — automatic movement, rotating bezel, a price that makes the complication accessible before you commit to a nicer strap.
    sort_order: 10
  - brand: Mido
    model: Ocean Star GMT
    reference: M026.629.11.051.01
    needs_catalog_add: true      # Mido brand not in prod catalog
    commentary: Swiss-made, 200m, no-nonsense GMT execution from a movement brand that quietly over-delivers at this price tier.
    sort_order: 20
  - brand: Longines
    model: Spirit Zulu Time
    reference: L3.812.4.53.6
    needs_catalog_verify: true   # L3.812.4.63.6 is in prod; .53.6 variant — needs verification
    commentary: Military DNA, modern movement, 42mm case — the GMT that looks like it flew somewhere important and doesn't need to tell you about it.
    sort_order: 30
  - brand: Tudor
    model: Black Bay 58 GMT
    reference: 7939G1A0NRU
    needs_catalog_verify: true   # Black Bay family has 5 in prod; 58 GMT ref needs verification
    commentary: 39mm case, in-house movement, the GMT format in proper vintage proportions — Tudor's most focused execution of the complication.
    sort_order: 40
  - brand: Grand Seiko
    model: Elegance GMT
    reference: SBGM221
    commentary: Spring-Drive movement tracking two time zones in a finishing-forward Grand Seiko case — the GMT as an argument for Japanese watchmaking.
    sort_order: 50
  - brand: Omega
    model: Seamaster Aqua Terra 150M Worldtimer GMT
    reference: 220.10.43.22.03.001
    needs_catalog_add: true      # different ref from Aqua Terra already in prod; Worldtimer GMT not confirmed
    commentary: Master Chronometer certified, Co-Axial movement, world-time scale around the dial — the GMT that also happens to be an exceptional dress watch.
    sort_order: 60
  - brand: Rolex
    model: GMT-Master II "Batman"
    reference: 126710BLNR
    needs_catalog_verify: true   # GMT-Master II family has 5 in prod; 126710BLNR needs verification
    commentary: Black-and-blue Cerachrom bezel, Jubilee bracelet, calibre 3285 — the current benchmark for what the professional GMT is allowed to be.
    sort_order: 70
cover_prompt_summary: Abstract mood suggesting time zones, flight, navigation — see COVER-PROMPTS.md.

---

## quiet-luxury
title: Quiet Luxury, Loud Movement
slug: quiet-luxury
curator_name: Horlo Editorial
sort_order: 30
intro_markdown: |
  The loudest thing about these watches is what's inside. No carbon fiber, no
  overbuilt cases, no status signaling — just exceptional movements expressed
  through restrained, often beautiful dials. This list is for collectors who
  have moved past the billboard phase and arrived somewhere quieter. Each
  reference here would pass unnoticed at a business meeting and start a
  conversation at a watch dinner. Both are features.
items:
  - brand: Grand Seiko
    model: Snowflake
    reference: SBGA211
    needs_catalog_verify: true   # Elegance family has 2 in prod; SBGM221 confirmed, SBGA211 likely the other
    commentary: Spring-Drive movement under a dial that literally looks like snowfall — the definitive quiet-luxury argument.
    sort_order: 10
  - brand: Grand Seiko
    model: White Birch
    reference: SLGH005
    needs_catalog_verify: true   # Heritage family has 4 in prod; SLGH005 not confirmed individually
    commentary: Hi-Beat 36000 movement, forest-textured dial — precision made visible without any unnecessary decoration.
    sort_order: 20
  - brand: Omega
    model: Constellation Globemaster
    reference: 130.33.39.21.02.001
    commentary: Master Chronometer certified, pie-pan dial, annual calendar — horological substance behind a dressy face.
    sort_order: 30
  - brand: Junghans
    model: Max Bill Regulator Bauhaus
    reference: 27/4493.02
    commentary: Bauhaus discipline applied to timekeeping — the regulator display makes it look architectural, not watchy.
    sort_order: 40
  - brand: Longines
    model: ULTRA-CHRON CLASSIC
    reference: L2.937.4.72.6
    commentary: High-frequency movement in a slim dress case — the original chronometer bargain, now back in production.
    sort_order: 50
  - brand: Blancpain
    model: Villeret Quantième Complet
    reference: 6126N-1146-55B
    commentary: Complete calendar at eleven o'clock — understated case, grand feu enamel options, irreducibly classic.
    sort_order: 60
  - brand: A. Lange & Söhne
    model: 1815
    reference: 233.026
    needs_catalog_add: true      # not in prod catalog; iconic quiet-luxury anchor for the list
    commentary: Outsize date at twelve, three-quarter plate movement, German silver — the unambiguous argument that restraint and extraordinary cost are not contradictions.
    sort_order: 70
cover_prompt_summary: Abstract minimal texture — cream, ivory, grey — suggesting restraint and quality. See COVER-PROMPTS.md.

---

## first-real-watch
title: The First Real Watch
slug: first-real-watch
curator_name: Horlo Editorial
sort_order: 40
intro_markdown: |
  There's a watch before your first real watch, and then there's the watch that
  makes you understand what you'd been missing. "Real" doesn't mean expensive
  — it means built for decades, powered by a movement worth respecting, worn
  because you chose it and not because a retailer chose for you. These picks
  each mark that threshold differently: some prioritize heritage, some
  value-per-millimeter, some the feeling of winding a movement for the first time.
items:
  - brand: Tissot
    model: PRX Powermatic 80
    reference: T137.407.11.041.00
    needs_catalog_add: true      # Tissot brand not in prod catalog
    commentary: Integrated bracelet, Powermatic 80 movement, 40mm — the watch that made people stop explaining why they didn't need an integrated bracelet.
    sort_order: 10
  - brand: Seiko
    model: Prospex Alpinist
    reference: SPB507
    needs_catalog_verify: true   # Alpinist family has 2 in prod; SPB507 needs verification
    commentary: Field-ready automatic with an internal compass bezel — the Alpinist lineage earns its place as a first serious automatic through dependability and quiet ambition.
    sort_order: 20
  - brand: Baltic
    model: Aquascaphe Classic
    reference: Aquascaphe-Classic-Blue   # user to confirm canonical reference at catalog-add time
    needs_catalog_add: true      # Baltic brand in prod (Hermétique) but Aquascaphe not confirmed
    commentary: French 37mm diver — domed sapphire, coin-edge bezel, Miyota movement. Proves the entry diver doesn't need a Swiss logo to be the right answer.
    sort_order: 30
  - brand: Hamilton Watch
    model: Khaki Field Murph
    reference: H70605731
    needs_catalog_add: true      # Hamilton in prod; Murph 38mm H70605731 not confirmed
    commentary: The hand-wound Christopher Nolan collaboration — 38mm, leather strap, legible field dial. The watch that convinced a generation hand-wound was not a limitation.
    sort_order: 40
  - brand: Christopher Ward
    model: The Twelve 40mm
    reference: C12-40A-S00K0-S00B0-K   # user to confirm canonical reference at catalog-add time
    needs_catalog_add: true      # Christopher Ward C12 not in prod
    commentary: UK-designed, Swiss-made, direct from the brand — twelve-sided case that earns its distinction through proportion rather than price.
    sort_order: 50
  - brand: Nomos Glashütte
    model: Tangente 38
    reference: "165"   # user to confirm canonical reference at catalog-add time
    needs_catalog_add: true      # Nomos brand not in prod catalog
    commentary: Hand-wound Glashütte movement, 38mm, silver-white dial — the argument that discipline and beauty are not in tension. The Tangente converts people permanently.
    sort_order: 60
  - brand: Longines
    model: HYDROCONQUEST
    reference: L3.781.4.06.6
    commentary: Swiss-made dive-capable at a non-dive price — ceramic bezel, automatic movement, proper water resistance. Already in catalog.
    sort_order: 70
  - brand: Oris
    model: Big Crown Pointer Date
    reference: "01 754 7741 4061-07 5 20 63FC"   # user to confirm canonical reference at catalog-add time
    needs_catalog_add: true      # Oris Big Crown Pointer Date not in prod catalog
    commentary: Pointer date complication, exhibition caseback, silver dial — the watch that asks you to engage with how a date display is supposed to feel.
    sort_order: 80
cover_prompt_summary: Abstract warm tone suggesting "first chapter, new beginning" — leather, worn linen. See COVER-PROMPTS.md.

---

## tool-watch-purist
title: The Essential Tool Watch List
slug: tool-watch-purist
curator_name: Horlo Editorial
sort_order: 50
intro_markdown: |
  A tool watch has a job. Readable under pressure, built to take abuse, designed
  around a specific professional need — not around a showroom floor. This list
  runs from entry-level purpose-built divers to the deepest production dive
  watches ever made, with a detour through German technical watchmaking that
  proves tool-watch thinking is not exclusive to Switzerland. Each reference has
  a genuine use case behind it and a movement that doesn't need to apologize for
  itself. Wear them in the water, wear them to the meeting: a real tool watch
  doesn't have an off switch.
items:
  - brand: Seiko
    model: Prospex Turtle
    reference: SRP777
    needs_catalog_verify: true   # Prospex Turtle family has 3 in prod
    commentary: Curved cushion case, 200m rating, Hardlex crystal — the entry point for serious dive watch collecting.
    sort_order: 10
  - brand: Seiko
    model: Prospex Sumo
    reference: SBDC001
    needs_catalog_verify: true   # Prospex Sumo family has 2 in prod
    commentary: Sapphire crystal, 200m, the original Sumo proportions — a more understated tool than the Turtle and equally capable.
    sort_order: 20
  - brand: Mühle Glashütte
    model: Terrasport II USA 2025 Limited Edition
    reference: M1-37-42-102-CB
    commentary: German movement, anti-magnetic construction, 500m rating — the argument that tool-watch thinking thrives in Glashütte as naturally as it does in Switzerland.
    sort_order: 30
  - brand: Steinhart
    model: Ocean One 39
    reference: Ocean-One-39
    needs_catalog_verify: true   # Ocean family has 2 in prod (Steinhart)
    commentary: Swiss ETA movement in a 39mm case with 300m rating — the independent tool watch that keeps its proportions.
    sort_order: 40
  - brand: Squale
    model: 1521 Classic
    reference: 1521-026
    commentary: 1521 caliber, 50 ATM rated, Italian manufacture — the depth-rated workhorse from the brand that supplied the navies.
    sort_order: 50
  - brand: Sinn
    model: 856 UTC
    reference: 856.010
    needs_catalog_add: true      # Sinn brand has 3 in prod (SI-517 confirmed); 856 not confirmed
    commentary: German case hardening, TEGIMENT technology, UTC hand — the engineering case for buying German before buying Swiss.
    sort_order: 55
  - brand: Tudor
    model: Pelagos
    reference: 25600TN
    needs_catalog_verify: true   # Pelagos family has 2 in prod; 25600TN not individually confirmed
    commentary: Titanium case, 500m rating, in-house movement with a helium escape valve — Tudor's deep-dive professional.
    sort_order: 60
  - brand: Omega
    model: Seamaster Diver 300M
    reference: 210.30.42.20.01.001
    needs_catalog_verify: true   # Seamaster Diver 300M family has 3 in prod
    commentary: Co-Axial Master Chronometer, ceramic bezel, 300m — the modern standard for a professional diving watch.
    sort_order: 70
  - brand: Rolex
    model: Sea-Dweller
    reference: 126600
    needs_catalog_verify: true   # Sea-Dweller family has 4 in prod
    commentary: 1220m rating, ceramic bezel, cyclops-free dial — the deepest purpose-built production diver Rolex makes.
    sort_order: 80
cover_prompt_summary: Abstract industrial texture — matte titanium, rubber, neoprene. No watches. See COVER-PROMPTS.md.

---

## microbrand-picks
title: Microbrand Picks That Earn Their Spot
slug: microbrand-picks
curator_name: Horlo Editorial
sort_order: 60
intro_markdown: |
  The strongest case for a microbrand is simple: no heritage tax, no boutique
  margin, no marketing department deciding what you should want. These makers
  sell direct, design with intention, and compete on specification and craft
  rather than logo recognition. Each pick here has earned its place against
  established alternatives — not by imitating them, but by solving the same
  problem differently, often better. These are the brands worth watching before
  the watch world catches up.
items:
  - brand: Baltic
    model: Hermétique Summer - Yellow
    reference: HER11SUY E81
    commentary: French 37mm field/tool watch on a Miyota 9039; vintage-correct sizing with a summery sector dial. Baltic at its most confident.
    sort_order: 10
  - brand: Héron
    model: Marinor Atlantic Blue
    reference: Marinor-Atlantic-Blue   # user to confirm canonical reference at catalog-add time
    needs_catalog_add: true      # Héron Marinor Gilt & Black in prod; Atlantic Blue variant not confirmed
    commentary: Montréal mid-century diver, Miyota 9039, 300m, with a hardened ~1,200-Vickers case that resists scratches most microbrands don't bother engineering for.
    sort_order: 20
  - brand: Wren
    model: Diver 38 Aqua
    reference: Wren-Diver-38-Aqua   # user to confirm canonical reference at catalog-add time
    needs_catalog_add: true      # Wren not in prod catalog
    commentary: Swiss-made 38mm diver on the ultra-slim ETA 2892, fully lumed ceramic bezel, 200m; enthusiast-run and built to the spec the segment usually charges twice for.
    sort_order: 30
  - brand: echo/neutra
    model: Rivanera
    reference: null
    commentary: Italian rectangular dress watch in sandblasted Grade 5 titanium (21g) on a hand-wound ETA 7001; argues with the Tank rather than copying it.
    sort_order: 40
  - brand: Serica
    model: 8315 GMT
    reference: Serica-8315-GMT   # user to confirm canonical reference at catalog-add time
    needs_catalog_add: true      # Serica not in prod catalog
    commentary: French-designed, Swiss-made, fully COSC-certified; reinvents the traveler GMT with an enamel-and-ceramic bezel and Soprod movement.
    sort_order: 50
  - brand: Formex
    model: Essence ThirtyNine Automatic Chronometer
    reference: Formex-Essence-ThirtyNine-Auto-Chronometer   # user to confirm canonical reference at catalog-add time
    needs_catalog_add: true      # Formex not in prod catalog
    commentary: Patented case-suspension system and COSC certification as standard; pure engineering nobody markets hard enough.
    sort_order: 60
  - brand: Furlan Marri
    model: Chronograph Salmon Sector-Dial
    reference: Furlan-Marri-Chronograph   # user to confirm canonical reference at catalog-add time
    needs_catalog_add: true      # Furlan Marri not in prod catalog
    commentary: Geneva, GPHG Horological Revelation winner; sector-dial chronographs the establishment is chasing — meca-quartz at the entry, mechanical (La Joux-Perret) above.
    sort_order: 70
  - brand: anOrdain
    model: Model 2
    reference: anOrdain-Model-2   # user to confirm canonical reference at catalog-add time
    needs_catalog_add: true      # anOrdain not in prod catalog
    commentary: Glasgow workshop making hand-fired vitreous enamel dials the century-old way; grand-feu craft at a fraction of luxury pricing.
    sort_order: 80
cover_prompt_summary: Abstract mood suggesting independent craft, small-batch, workshop — matte surfaces, hand-applied indices. See COVER-PROMPTS.md.

---

## TO ADD TO CATALOG (or verify in prod)

### needs_catalog_add (definitely missing — add via /api/extract-watch or admin import)

#### starter-five
- [ ] **starter-five**: Hamilton Watch Khaki Field Mechanical ref `H69399930` — Hamilton Field family in prod; this specific ref needs verification
- [ ] **starter-five**: Certina DS Action GMT Powermatic 80 ref `C032.929.11.051.00` — Certina brand not in prod catalog
- [ ] **starter-five**: Tissot Le Locle 39.3mm ref `T006.407.16.033.00` — Tissot brand not in prod catalog
- [ ] **starter-five**: Hamilton Watch Intra-Matic Auto Chrono ref `H38416711` — Hamilton in prod; Intra-Matic Chrono ref not confirmed

#### bezel-math
- [ ] **bezel-math**: Mido Ocean Star GMT ref `M026.629.11.051.01` — Mido brand not in prod catalog
- [ ] **bezel-math**: Omega Seamaster Aqua Terra 150M Worldtimer GMT ref `220.10.43.22.03.001` — different ref from Aqua Terra already in prod; Worldtimer GMT not confirmed

#### quiet-luxury
- [ ] **quiet-luxury**: A. Lange & Söhne 1815 ref `233.026` — brand not in prod catalog

#### first-real-watch
- [ ] **first-real-watch**: Tissot PRX Powermatic 80 ref `T137.407.11.041.00` — Tissot brand not in prod catalog
- [ ] **first-real-watch**: Baltic Aquascaphe Classic ref `Aquascaphe-Classic-Blue` (placeholder) — Baltic in prod; Aquascaphe not confirmed
- [ ] **first-real-watch**: Hamilton Watch Khaki Field Murph ref `H70605731` — Hamilton in prod; Murph 38mm ref not confirmed
- [ ] **first-real-watch**: Christopher Ward The Twelve 40mm ref `C12-40A-S00K0-S00B0-K` (placeholder) — C12 not in prod
- [ ] **first-real-watch**: Nomos Glashütte Tangente 38 ref `165` (placeholder) — Nomos brand not in prod catalog
- [ ] **first-real-watch**: Oris Big Crown Pointer Date ref `01 754 7741 4061-07 5 20 63FC` (placeholder) — Oris Big Crown Pointer Date not in prod

#### tool-watch-purist
- [ ] **tool-watch-purist**: Sinn 856 UTC ref `856.010` — Sinn brand has 3 in prod (SI-517 confirmed); 856 not confirmed

#### microbrand-picks
- [ ] **microbrand-picks**: Héron Marinor Atlantic Blue ref `Marinor-Atlantic-Blue` (placeholder) — Marinor Gilt & Black in prod; Atlantic Blue variant not confirmed
- [ ] **microbrand-picks**: Wren Diver 38 Aqua ref `Wren-Diver-38-Aqua` (placeholder) — Wren not in prod catalog
- [ ] **microbrand-picks**: Serica 8315 GMT ref `Serica-8315-GMT` (placeholder) — Serica not in prod catalog
- [ ] **microbrand-picks**: Formex Essence ThirtyNine Automatic Chronometer ref `Formex-Essence-ThirtyNine-Auto-Chronometer` (placeholder) — Formex not in prod catalog
- [ ] **microbrand-picks**: Furlan Marri Chronograph ref `Furlan-Marri-Chronograph` (placeholder) — Furlan Marri not in prod catalog
- [ ] **microbrand-picks**: anOrdain Model 2 ref `anOrdain-Model-2` (placeholder) — anOrdain not in prod catalog

### needs_catalog_verify (family confirmed in prod rollup — check exact ref before migration)
- [ ] **bezel-math**: Seiko 5 Sports GMT ref `SSK001` — 5 Sports family has 2 in prod; SSK001 GMT likely missing
- [ ] **bezel-math**: Longines Spirit Zulu Time ref `L3.812.4.53.6` — similar to `L3.812.4.63.6` in prod; `.53.6` variant needs verification
- [ ] **bezel-math**: Tudor Black Bay 58 GMT ref `7939G1A0NRU` — Black Bay family has 5 in prod; 58 GMT ref needs verification
- [ ] **bezel-math**: Rolex GMT-Master II "Batman" ref `126710BLNR` — GMT-Master II family has 5 in prod
- [ ] **quiet-luxury**: Grand Seiko Snowflake ref `SBGA211` — Elegance family has 2 in prod; SBGM221 confirmed as one, SBGA211 likely the other
- [ ] **quiet-luxury**: Grand Seiko White Birch ref `SLGH005` — Heritage family has 4 in prod; SLGH005 not individually confirmed
- [ ] **first-real-watch**: Seiko Prospex Alpinist ref `SPB507` — Alpinist family has 2 in prod; SPB507 needs verification
- [ ] **tool-watch-purist**: Seiko Prospex Turtle ref `SRP777` — Prospex Turtle family has 3 in prod
- [ ] **tool-watch-purist**: Seiko Prospex Sumo ref `SBDC001` — Prospex Sumo family has 2 in prod
- [ ] **tool-watch-purist**: Steinhart Ocean One 39 ref `Ocean-One-39` — Ocean family has 2 in prod (Steinhart)
- [ ] **tool-watch-purist**: Tudor Pelagos ref `25600TN` — Pelagos family has 2 in prod; 25600TN not individually confirmed
- [ ] **tool-watch-purist**: Omega Seamaster Diver 300M ref `210.30.42.20.01.001` — Seamaster Diver 300M family has 3 in prod
- [ ] **tool-watch-purist**: Rolex Sea-Dweller ref `126600` — Sea-Dweller family has 4 in prod
