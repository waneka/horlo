<!-- LISTS.md — 8 curated lists for /explore editorial seed -->
<!-- Editorial-ideal picks pass applied 2026-06-14: see known_issues_to_fix audit -->
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
    model: SKX007
    reference: SKX007
    needs_catalog_verify: true   # SKX family has 2 in prod; exact ref likely matches
    commentary: The dive watch that permanently resets expectations on what a great movement and a real bezel can cost.
    sort_order: 10
  - brand: Seiko
    model: Alpinist
    reference: SARB017
    needs_catalog_verify: true   # Alpinist family has 2 in prod
    commentary: A field-ready automatic with a compass bezel and an internal discipline that punches well above its price.
    sort_order: 20
  - brand: Tudor
    model: Black Bay GMT
    reference: 79830RB
    needs_catalog_verify: true   # Black Bay family has 5 in prod
    commentary: Tracks a second time zone without asking you to think about it; the "Pepsi" bezel is a bonus.
    sort_order: 30
  - brand: Grand Seiko
    model: Elegance
    reference: SBGM221
    commentary: Spring-Drive movement in a dress case that anchors the collection's formal slot — the finish here quietly outclasses anything near the price.
    sort_order: 40
  - brand: Omega
    model: Speedmaster Professional
    reference: 3590.50
    commentary: The pre-Co-Axial Moonwatch — hand-wound, historically unimpeachable, and surprisingly wearable daily.
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
  any other complication. This list works through the canonical GMT references
  from their entry point all the way to the horological benchmark, showing
  exactly where the money goes (and where it doesn't need to).
items:
  - brand: Longines
    model: LONGINES SPIRIT ZULU TIME 1925
    reference: L3.803.5.53.6
    commentary: Vintage military aesthetic, modern movement — the GMT gateway that doesn't require a mortgage.
    sort_order: 10
  - brand: Tudor
    model: Black Bay GMT
    reference: 79830RB
    needs_catalog_verify: true   # Black Bay family has 5 in prod
    commentary: The "Pepsi" two-tone bezel at a Tudor price: legitimate in-house movement, heirloom build quality.
    sort_order: 20
  - brand: Longines
    model: LONGINES SPIRIT ZULU TIME
    reference: L3.812.4.63.6
    commentary: Clean modern dial with military bones — proves you don't need a BMW-priced bezel to read a GMT.
    sort_order: 30
  - brand: Rolex
    model: GMT-Master II
    reference: 116710LN
    needs_catalog_verify: true   # GMT-Master II family has 5 in prod
    commentary: The all-black Cerachrom version — the reference that defined what "professional GMT" means.
    sort_order: 40
  - brand: Rolex
    model: GMT-Master II
    reference: 126710BLNR
    needs_catalog_verify: true   # GMT-Master II family has 5 in prod
    commentary: Batman bezel, Jubilee bracelet, updated case — the current benchmark for tool-watch GMT.
    sort_order: 50
  - brand: Rolex
    model: GMT-Master II
    reference: 126710BLRO
    needs_catalog_verify: true   # GMT-Master II family has 5 in prod
    commentary: The reissued "Pepsi" with a steel Jubilee; arguably the most coveted steel sport Rolex in production.
    sort_order: 60
  - brand: Rolex
    model: GMT-Master
    reference: 1675
    needs_catalog_add: true      # vintage ref; Rolex GMT-Master family not in prod rollup
    commentary: The original GMT — born to fly Pan Am routes, now a vintage benchmark with naturally-aging dials.
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
  - brand: Seiko
    model: 5 Sports
    reference: SRPD51
    needs_catalog_verify: true   # 5 Sports family has 2 in prod
    commentary: Automatic in-house movement, day-date display, screw-down crown — more watch than it has any right to be.
    sort_order: 10
  - brand: Seiko
    model: Alpinist
    reference: SARB017
    needs_catalog_verify: true   # Alpinist family has 2 in prod
    commentary: The Alpinist earns its place as "first serious automatic" through the compass bezel, coin-edge case, and SARB dependability.
    sort_order: 20
  - brand: Hamilton Watch
    model: Khaki Field Mechanical
    reference: H69439931
    needs_catalog_add: true      # standard steel edition not in prod; bronze H69459510 is — this is the universally relatable first pick
    commentary: Hand-wound field watch in steel — at $475 the H69439931 is the entry point that converts people. Clean, honest, wearable anywhere.
    sort_order: 30
  - brand: Hamilton Watch
    model: Khaki Field Mechanical Bronze
    reference: H69459510
    commentary: Same caliber as the steel; the bronze case develops visible patina — a better editorial choice once a collector wants something that ages with them.
    sort_order: 35
  - brand: Longines
    model: HYDROCONQUEST
    reference: L3.781.4.06.6
    commentary: Swiss-made dive capable at a non-dive price — ceramic bezel, automatic movement, proper water resistance.
    sort_order: 40
  - brand: Tudor
    model: Black Bay 58
    reference: 79030N
    needs_catalog_verify: true   # Black Bay family has 5 in prod
    commentary: 39mm in the age of 41mm cases — the Black Bay that got proportions right, in-house movement included.
    sort_order: 50
  - brand: Christopher Ward
    model: C60 Trident Pro 300
    reference: C60-LDP38
    commentary: UK designed, Swiss movement, 300m rating — the direct-to-consumer argument made watchable.
    sort_order: 60
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
  sell direct, use top-tier Swiss or Japanese movements, and compete on
  specification and design rather than logo recognition. Each pick here has
  earned its place against established alternatives — not by imitating them,
  but by solving the same problem differently. These are the brands worth
  watching before the watch world catches up.
items:
  - brand: Baltic
    model: Aquascaphe Classic Blue
    reference: AQUASCAPHE-CLASSIC-BLUE
    needs_catalog_add: true      # Baltic brand has 2 in prod (Hermétique); Aquascaphe not confirmed
    commentary: Baltic's diver flagship — domed sapphire, bidirectional bezel, coin-edge case at a price that embarrasses the competition.
    sort_order: 10
  - brand: Steinhart
    model: Ocean One 39
    reference: Ocean-One-39
    needs_catalog_verify: true   # Ocean family has 2 in prod (Steinhart)
    commentary: 300m diver with a Swiss ETA 2824-2 in a 39mm case — the microbrand that actually has the proportions right.
    sort_order: 20
  - brand: Steinhart
    model: Ocean Vintage Military
    reference: Ocean-OVM
    needs_catalog_verify: true   # Ocean family has 2 in prod (Steinhart)
    commentary: Military field aesthetic over the same robust Swiss movement — shows that tool-watch design has more than one direction.
    sort_order: 30
  - brand: Christopher Ward
    model: C60 Trident Pro 600
    reference: C60-300
    commentary: 600m depth rating, in-house calibre option, Cosc-certified movement — spec-for-spec, it beats watches at double the price.
    sort_order: 40
  - brand: Squale
    model: 1521 Classic
    reference: 1521-026
    commentary: Italian OEM heritage for major dive brands, now with their own reference — the 1521 Classic is authenticity in a case.
    sort_order: 50
  - brand: Baltic
    model: Hermétique Summer - Yellow
    reference: HER11SUY E81
    commentary: Baltic proves microbrands can play in the dress-watch space; the Hermétique's gilt accents and summer dial are quietly excellent.
    sort_order: 60
cover_prompt_summary: Abstract mood suggesting independent craft, small-batch, workshop — matte surfaces, hand-applied indices. See COVER-PROMPTS.md.

---

## tropical-dial
title: Tropical Dial Tour
slug: tropical-dial
curator_name: Horlo Editorial
sort_order: 70
intro_markdown: |
  "Tropical" is collector shorthand for dials that have aged from their original
  black or silver into rich brown tones — a chemical process that happens to
  certain vintage lacquer formulations over decades. You cannot fake it and you
  cannot rush it. This list covers the references most famous for developing
  tropical characteristics: vintage Rolex sport models, early Omega
  Speedmasters, and Japanese professional divers from the era when the lacquer
  chemistry was doing something nobody planned. Each watch here is a time
  capsule of unintended beauty.
items:
  - brand: Rolex
    model: Submariner
    reference: 5513
    needs_catalog_add: true      # vintage ref; not in prod catalog (skews modern)
    commentary: The no-date Submariner most famous for developing tropical chocolate dials — the original goal post for the genre.
    sort_order: 10
  - brand: Rolex
    model: GMT-Master
    reference: 1675
    needs_catalog_add: true      # vintage ref; not in prod catalog
    commentary: Long-running GMT reference whose matte black dials are among the most documented tropical cases in the market.
    sort_order: 20
  - brand: Rolex
    model: Cosmograph Daytona
    reference: 6263
    needs_catalog_add: true      # vintage Paul Newman ref; Daytona family (5) skews modern
    commentary: The Paul Newman Daytona — its exotic dials are the benchmark tropical reference, period.
    sort_order: 30
  - brand: Omega
    model: Speedmaster
    reference: CK2998
    needs_catalog_add: true      # pre-moon vintage ref; Speedmaster Moonwatch family (8) skews modern
    commentary: The first Speedmaster reference; pre-moon program models aged differently than anything that came after.
    sort_order: 40
  - brand: Seiko
    model: 6105-8110
    reference: 6105-8110
    needs_catalog_add: true      # vintage ref; no matching Seiko family in prod rollup
    commentary: The dive Seiko worn in Apocalypse Now — its chapter ring and dial age in ways the modern reissues cannot replicate.
    sort_order: 50
  - brand: Seiko
    model: 6309-7040
    reference: 6309-7040
    needs_catalog_add: true      # vintage ref; no matching Seiko family in prod rollup
    commentary: Successor to the 6105, predecessor to the modern Turtle — an undervalued tropical candidate among vintage Seiko collectors.
    sort_order: 60
  - brand: Seiko
    model: 62MAS
    reference: 6217-8001
    needs_catalog_add: true      # vintage 1967 ref; no matching Seiko family in prod rollup
    commentary: The original 150m professional diver from 1967 — the lacquer formulation makes it a prime candidate for tropicalization.
    sort_order: 70
cover_prompt_summary: Abstract warm-brown aged texture — like old paper, warm lacquer, autumn light. No watches. See COVER-PROMPTS.md.

---

## trading-up
title: Trading Up Without Trading Out
slug: trading-up
curator_name: Horlo Editorial
sort_order: 80
intro_markdown: |
  The best upgrade is the one that keeps everything you loved about the previous
  watch and adds one meaningful dimension. Trading up is not about spending more
  — it is about understanding exactly what the extra money buys and deciding
  whether it's worth it. This list pairs entry points with their natural
  next chapters: same DNA, higher expression. Each pairing is a lesson in
  what separates levels in watchmaking and what turns out to be less different
  than the price gap suggests.
items:
  - brand: Seiko
    model: SKX007
    reference: SKX007
    needs_catalog_verify: true   # SKX family has 2 in prod
    commentary: The baseline. Every serious dive watch purchase starts here — or should have.
    sort_order: 10
  - brand: Tudor
    model: Black Bay 58
    reference: 79030N
    needs_catalog_verify: true   # Black Bay family has 5 in prod
    commentary: First meaningful step up: in-house movement, better bracelet, same purposeful spirit — at roughly four times the cost.
    sort_order: 20
  - brand: Omega
    model: Seamaster Diver 300M
    reference: 210.30.42.20.01.001
    needs_catalog_verify: true   # Seamaster Diver 300M family has 3 in prod
    commentary: Co-Axial movement with a co-axial reputation — the level where build quality stops surprising you and starts reassuring you.
    sort_order: 30
  - brand: Rolex
    model: Submariner No-Date
    reference: 124060
    needs_catalog_verify: true   # Submariner family has 8 in prod
    commentary: The apex of the dive-watch trade-up ladder: Oystersteel, Oyster bracelet, 300m — and the resale graph agrees.
    sort_order: 40
  - brand: Longines
    model: LONGINES LEGEND DIVER BRONZE
    reference: L3.774.1.50.2
    commentary: A lateral trade: bronze case ages visibly, Legend Diver proportions are vintage-correct in a way modern steel cannot be.
    sort_order: 50
  - brand: Grand Seiko
    model: Snowflake
    reference: SBGA211
    needs_catalog_verify: true   # Elegance family has 2 in prod; SBGM221 confirmed, SBGA211 likely the other
    commentary: The category pivot: Spring-Drive accuracy in a dial that stops conversations — trading dive utility for mechanical artistry.
    sort_order: 60

---

## TO ADD TO CATALOG (or verify in prod)

### needs_catalog_add (definitely missing — add via /api/extract-watch or admin import)
- [ ] **bezel-math / tropical-dial**: Rolex GMT-Master 1675 — vintage 1960s–70s ref; used in both lists as vintage arc anchor and tropical-dial example
- [ ] **quiet-luxury**: A. Lange & Söhne 1815 ref 233.026 — quintessential quiet-luxury; brand not in prod catalog
- [ ] **first-real-watch**: Hamilton Watch Khaki Field Mechanical H69439931 (steel standard edition) — the universally relatable ~$475 entry pick; bronze H69459510 already in prod
- [ ] **tool-watch-purist**: Sinn 856 UTC ref 856.010 — German technical cornerstone; Sinn brand has 3 in prod but 856 not confirmed
- [ ] **microbrand-picks**: Baltic Aquascaphe Classic Blue ref AQUASCAPHE-CLASSIC-BLUE — Baltic's diver flagship; Baltic brand in prod but Aquascaphe not confirmed
- [ ] **tropical-dial**: Rolex Submariner 5513 — vintage no-date Sub; prod catalog skews modern
- [ ] **tropical-dial**: Rolex Cosmograph Daytona 6263 — Paul Newman ref; Daytona family (5) skews modern
- [ ] **tropical-dial**: Omega Speedmaster CK2998 — first Speedmaster ref; Speedmaster Moonwatch family (8) skews modern
- [ ] **tropical-dial**: Seiko 6105-8110 — Apocalypse Now dive Seiko; no matching modern family in prod
- [ ] **tropical-dial**: Seiko 6309-7040 — vintage Turtle predecessor; no matching modern family in prod
- [ ] **tropical-dial**: Seiko 62MAS 6217-8001 — 1967 original 150m diver; no matching modern family in prod

### needs_catalog_verify (family confirmed in prod rollup — check exact ref before migration)
- [ ] **starter-five**: Seiko SKX007 (SKX family has 2 in prod)
- [ ] **starter-five / first-real-watch / trading-up**: Seiko Alpinist SARB017 (Alpinist family has 2 in prod)
- [ ] **starter-five / bezel-math / filling-a-gap-2 / branching-out-1 (paths)**: Tudor Black Bay GMT 79830RB (Black Bay family has 5 in prod)
- [ ] **first-real-watch / going-deeper-1 / trading-up-2 (paths)**: Tudor Black Bay 58 79030N (Black Bay family has 5 in prod)
- [ ] **quiet-luxury / trading-up / filling-a-gap-2 (paths)**: Grand Seiko Snowflake SBGA211 (Elegance family has 2; SBGM221 confirmed as one — SBGA211 likely the other)
- [ ] **quiet-luxury**: Grand Seiko White Birch SLGH005 (Heritage family has 4 in prod; SLGH005 not individually listed)
- [ ] **tool-watch-purist**: Seiko Prospex Turtle SRP777 (Prospex Turtle family has 3 in prod)
- [ ] **tool-watch-purist**: Seiko Prospex Sumo SBDC001 (Prospex Sumo family has 2 in prod)
- [ ] **tool-watch-purist**: Steinhart Ocean One 39 Ocean-One-39 (Ocean family has 2 in prod — Steinhart)
- [ ] **microbrand-picks**: Steinhart Ocean One 39 Ocean-One-39 (same as above)
- [ ] **microbrand-picks**: Steinhart Ocean Vintage Military Ocean-OVM (Ocean family has 2 in prod — Steinhart)
- [ ] **tool-watch-purist**: Tudor Pelagos 25600TN (Pelagos family has 2 in prod)
- [ ] **tool-watch-purist / trading-up / trading-up-2 (paths)**: Omega Seamaster Diver 300M 210.30.42.20.01.001 (Seamaster Diver 300M family has 3 in prod)
- [ ] **tool-watch-purist / filling-a-gap-2 (paths)**: Rolex Sea-Dweller 126600 (Sea-Dweller family has 4 in prod)
- [ ] **trading-up / going-deeper-1 (paths)**: Rolex Submariner No-Date 124060 (Submariner family has 8 in prod)
- [ ] **bezel-math**: Rolex GMT-Master II 116710LN (GMT-Master II family has 5 in prod)
- [ ] **bezel-math**: Rolex GMT-Master II 126710BLNR (GMT-Master II family has 5 in prod)
- [ ] **bezel-math**: Rolex GMT-Master II 126710BLRO (GMT-Master II family has 5 in prod)
- [ ] **first-real-watch / trading-up-1 (paths)**: Seiko 5 Sports SRPD51 (5 Sports family has 2 in prod)
