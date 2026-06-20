-- ============================================================================
-- Quick task 260614-f82: seed /explore editorial content
-- 6 curated lists + items + 8 collection paths + nodes.
-- Idempotent: re-running this migration is a no-op after the first apply.
--
-- Catalog references resolved by (brand, model, reference) natural key per
-- project-catalog-id-divergence memory — prod/local uuids differ.
-- ============================================================================

BEGIN;

-- ---------- 6 curated lists ----------
-- For each list: SELECT existing id; if not found, INSERT then get id.
-- Items always use ON CONFLICT DO NOTHING so adding items and re-running is additive.

DO $$
DECLARE
  v_list_id    uuid;
  v_catalog_id uuid;
BEGIN
        -- ---------- LIST: starter-five ----------
        SELECT id INTO v_list_id FROM public.curated_lists
         WHERE curator_name = 'Horlo Editorial' AND title = $L1TITLE$The Five-Watch Starter Collection$L1TITLE$;
        IF v_list_id IS NULL THEN
          INSERT INTO public.curated_lists
            (title, curator_name, cover_url, intro_markdown, status, sort_order, published_at)
          VALUES (
            $L1TITLEV$The Five-Watch Starter Collection$L1TITLEV$,
            'Horlo Editorial',
            'https://wdntzsckjaoqodsyscns.supabase.co/storage/v1/object/public/cms-covers/seed/starter-five-c1bf0588-36c7-4430-a9ee-28dddfab975c.png',
            $L1INTRO$Five watches that cover everything a new collector needs without repeating
themselves. Each one earns its slot by being genuinely different — not just a
different brand wearing the same silhouette. A diver, a field watch, a GMT,
a dress automatic, and a chronograph: together they answer every occasion,
movement type, and wearing mood a collector will encounter in the first decade.
Buy slowly, wear each one hard, and you'll understand why every watch that
comes after is measured against this foundation.$L1INTRO$,
            'published',
            10,
            NOW()
          ) RETURNING id INTO v_list_id;
        END IF;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Seiko' AND reference IS NOT DISTINCT FROM 'SRPD51'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list starter-five item sort_order 10)', 'Seiko', 'SRPD51';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L1C10$The spiritual successor to the discontinued SKX — automatic in-house movement, real bezel, screw-down crown. Start here, wear it hard.$L1C10$, 10)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Hamilton Watch' AND reference IS NOT DISTINCT FROM 'H69399930'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list starter-five item sort_order 20)', 'Hamilton Watch', 'H69399930';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L1C20$The hand-wound field watch that converts people. At this price it is the honest answer to "what should my first serious automatic be?"$L1C20$, 20)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Certina' AND reference IS NOT DISTINCT FROM 'C032.929.11.051.00'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list starter-five item sort_order 30)', 'Certina', 'C032.929.11.051.00';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L1C30$GMT complication on a Powermatic 80 movement — 80-hour reserve, sapphire, 200m. This is what a capable GMT costs when the logo isn't doing half the work.$L1C30$, 30)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Tissot' AND reference IS NOT DISTINCT FROM 'T006.407.16.033.00'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list starter-five item sort_order 40)', 'Tissot', 'T006.407.16.033.00';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L1C40$Dress automatic with a visible movement and a 39mm case that fits a wrist correctly. The formal slot, solved without compromise.$L1C40$, 40)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Hamilton Watch' AND reference IS NOT DISTINCT FROM 'H38416711'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list starter-five item sort_order 50)', 'Hamilton Watch', 'H38416711';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L1C50$Automatic chronograph from a brand with genuine horological heritage — column-wheel movement, vintage-correct proportions, no fluff.$L1C50$, 50)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;

        -- ---------- LIST: bezel-math ----------
        SELECT id INTO v_list_id FROM public.curated_lists
         WHERE curator_name = 'Horlo Editorial' AND title = $L2TITLE$Bezel Math: Why GMTs Are Easy Mode$L2TITLE$;
        IF v_list_id IS NULL THEN
          INSERT INTO public.curated_lists
            (title, curator_name, cover_url, intro_markdown, status, sort_order, published_at)
          VALUES (
            $L2TITLEV$Bezel Math: Why GMTs Are Easy Mode$L2TITLEV$,
            'Horlo Editorial',
            'https://wdntzsckjaoqodsyscns.supabase.co/storage/v1/object/public/cms-covers/seed/bezel-math-a131b053-9256-484b-a003-50a7785fc46b.png',
            $L2INTRO$The GMT complication looks complicated until it doesn't. Track a second time
zone with one extra hand and a 24-hour bezel — that's it. Once you understand
the mechanic, you'll find the GMT reading becomes second nature faster than
any other complication. This list works through a specific GMT ladder: entry
point to horological benchmark, seven references that show exactly where the
money goes and where it doesn't need to.$L2INTRO$,
            'published',
            20,
            NOW()
          ) RETURNING id INTO v_list_id;
        END IF;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Seiko' AND reference IS NOT DISTINCT FROM 'SSK001'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list bezel-math item sort_order 10)', 'Seiko', 'SSK001';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L2C10$The GMT gateway — automatic movement, rotating bezel, a price that makes the complication accessible before you commit to a nicer strap.$L2C10$, 10)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Mido' AND reference IS NOT DISTINCT FROM 'M026.629.11.041.00'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list bezel-math item sort_order 20)', 'Mido', 'M026.629.11.041.00';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L2C20$Swiss-made, 200m, no-nonsense GMT execution from a movement brand that quietly over-delivers at this price tier.$L2C20$, 20)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Longines' AND reference IS NOT DISTINCT FROM 'L3.812.4.53.6'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list bezel-math item sort_order 30)', 'Longines', 'L3.812.4.53.6';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L2C30$Military DNA, modern movement, 42mm case — the GMT that looks like it flew somewhere important and doesn't need to tell you about it.$L2C30$, 30)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Tudor' AND reference IS NOT DISTINCT FROM '7939G1A0NRU'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list bezel-math item sort_order 40)', 'Tudor', '7939G1A0NRU';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L2C40$39mm case, in-house movement, the GMT format in proper vintage proportions — Tudor's most focused execution of the complication.$L2C40$, 40)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Grand Seiko' AND reference IS NOT DISTINCT FROM 'SBGM221'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list bezel-math item sort_order 50)', 'Grand Seiko', 'SBGM221';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L2C50$Spring-Drive movement tracking two time zones in a finishing-forward Grand Seiko case — the GMT as an argument for Japanese watchmaking.$L2C50$, 50)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Omega' AND reference IS NOT DISTINCT FROM '220.10.43.22.03.001'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list bezel-math item sort_order 60)', 'Omega', '220.10.43.22.03.001';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L2C60$Master Chronometer certified, Co-Axial movement, world-time scale around the dial — the GMT that also happens to be an exceptional dress watch.$L2C60$, 60)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Rolex' AND reference IS NOT DISTINCT FROM '126710BLNR'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list bezel-math item sort_order 70)', 'Rolex', '126710BLNR';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L2C70$Black-and-blue Cerachrom bezel, Jubilee bracelet, calibre 3285 — the current benchmark for what the professional GMT is allowed to be.$L2C70$, 70)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;

        -- ---------- LIST: quiet-luxury ----------
        SELECT id INTO v_list_id FROM public.curated_lists
         WHERE curator_name = 'Horlo Editorial' AND title = $L3TITLE$Quiet Luxury, Loud Movement$L3TITLE$;
        IF v_list_id IS NULL THEN
          INSERT INTO public.curated_lists
            (title, curator_name, cover_url, intro_markdown, status, sort_order, published_at)
          VALUES (
            $L3TITLEV$Quiet Luxury, Loud Movement$L3TITLEV$,
            'Horlo Editorial',
            'https://wdntzsckjaoqodsyscns.supabase.co/storage/v1/object/public/cms-covers/seed/quiet-luxury-476141a9-f479-4ede-8382-c10593b361ef.png',
            $L3INTRO$The loudest thing about these watches is what's inside. No carbon fiber, no
overbuilt cases, no status signaling — just exceptional movements expressed
through restrained, often beautiful dials. This list is for collectors who
have moved past the billboard phase and arrived somewhere quieter. Each
reference here would pass unnoticed at a business meeting and start a
conversation at a watch dinner. Both are features.$L3INTRO$,
            'published',
            30,
            NOW()
          ) RETURNING id INTO v_list_id;
        END IF;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Grand Seiko' AND reference IS NOT DISTINCT FROM 'SBGA211'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list quiet-luxury item sort_order 10)', 'Grand Seiko', 'SBGA211';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L3C10$Spring-Drive movement under a dial that literally looks like snowfall — the definitive quiet-luxury argument.$L3C10$, 10)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Grand Seiko' AND reference IS NOT DISTINCT FROM 'SLGH005'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list quiet-luxury item sort_order 20)', 'Grand Seiko', 'SLGH005';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L3C20$Hi-Beat 36000 movement, forest-textured dial — precision made visible without any unnecessary decoration.$L3C20$, 20)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Omega' AND reference IS NOT DISTINCT FROM '130.33.39.21.02.001'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list quiet-luxury item sort_order 30)', 'Omega', '130.33.39.21.02.001';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L3C30$Master Chronometer certified, pie-pan dial, annual calendar — horological substance behind a dressy face.$L3C30$, 30)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Junghans' AND reference IS NOT DISTINCT FROM '27/4493.02'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list quiet-luxury item sort_order 40)', 'Junghans', '27/4493.02';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L3C40$Bauhaus discipline applied to timekeeping — the regulator display makes it look architectural, not watchy.$L3C40$, 40)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Longines' AND reference IS NOT DISTINCT FROM 'L2.937.4.72.6'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list quiet-luxury item sort_order 50)', 'Longines', 'L2.937.4.72.6';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L3C50$High-frequency movement in a slim dress case — the original chronometer bargain, now back in production.$L3C50$, 50)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Blancpain' AND reference IS NOT DISTINCT FROM '6126N-1146-55B'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list quiet-luxury item sort_order 60)', 'Blancpain', '6126N-1146-55B';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L3C60$Complete calendar at eleven o'clock — understated case, grand feu enamel options, irreducibly classic.$L3C60$, 60)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'A. Lange & Söhne' AND reference IS NOT DISTINCT FROM '233.026'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list quiet-luxury item sort_order 70)', 'A. Lange & Söhne', '233.026';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L3C70$Outsize date at twelve, three-quarter plate movement, German silver — the unambiguous argument that restraint and extraordinary cost are not contradictions.$L3C70$, 70)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;

        -- ---------- LIST: first-real-watch ----------
        SELECT id INTO v_list_id FROM public.curated_lists
         WHERE curator_name = 'Horlo Editorial' AND title = $L4TITLE$The First Real Watch$L4TITLE$;
        IF v_list_id IS NULL THEN
          INSERT INTO public.curated_lists
            (title, curator_name, cover_url, intro_markdown, status, sort_order, published_at)
          VALUES (
            $L4TITLEV$The First Real Watch$L4TITLEV$,
            'Horlo Editorial',
            'https://wdntzsckjaoqodsyscns.supabase.co/storage/v1/object/public/cms-covers/seed/first-real-watch-2092e0b2-84ab-4e71-a2a0-467fe7ae9aa2.png',
            $L4INTRO$There's a watch before your first real watch, and then there's the watch that
makes you understand what you'd been missing. "Real" doesn't mean expensive
— it means built for decades, powered by a movement worth respecting, worn
because you chose it and not because a retailer chose for you. These picks
each mark that threshold differently: some prioritize heritage, some
value-per-millimeter, some the feeling of winding a movement for the first time.$L4INTRO$,
            'published',
            40,
            NOW()
          ) RETURNING id INTO v_list_id;
        END IF;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Tissot' AND reference IS NOT DISTINCT FROM 'T137.407.11.041.00'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list first-real-watch item sort_order 10)', 'Tissot', 'T137.407.11.041.00';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L4C10$Integrated bracelet, Powermatic 80 movement, 40mm — the watch that made people stop explaining why they didn't need an integrated bracelet.$L4C10$, 10)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Seiko' AND reference IS NOT DISTINCT FROM 'SPB507'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list first-real-watch item sort_order 20)', 'Seiko', 'SPB507';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L4C20$Field-ready automatic with an internal compass bezel — the Alpinist lineage earns its place as a first serious automatic through dependability and quiet ambition.$L4C20$, 20)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Baltic' AND reference IS NOT DISTINCT FROM 'Aquascaphe-Classic-Blue'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list first-real-watch item sort_order 30)', 'Baltic', 'Aquascaphe-Classic-Blue';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L4C30$French 37mm diver — domed sapphire, coin-edge bezel, Miyota movement. Proves the entry diver doesn't need a Swiss logo to be the right answer.$L4C30$, 30)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Hamilton Watch' AND reference IS NOT DISTINCT FROM 'H70605731'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list first-real-watch item sort_order 40)', 'Hamilton Watch', 'H70605731';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L4C40$The hand-wound Christopher Nolan collaboration — 38mm, leather strap, legible field dial. The watch that convinced a generation hand-wound was not a limitation.$L4C40$, 40)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Christopher Ward' AND reference IS NOT DISTINCT FROM 'C12-40A-S00K0-S00B0-K'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list first-real-watch item sort_order 50)', 'Christopher Ward', 'C12-40A-S00K0-S00B0-K';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L4C50$UK-designed, Swiss-made, direct from the brand — twelve-sided case that earns its distinction through proportion rather than price.$L4C50$, 50)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Nomos Glashütte' AND reference IS NOT DISTINCT FROM '165'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list first-real-watch item sort_order 60)', 'Nomos Glashütte', '165';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L4C60$Hand-wound Glashütte movement, 38mm, silver-white dial — the argument that discipline and beauty are not in tension. The Tangente converts people permanently.$L4C60$, 60)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Longines' AND reference IS NOT DISTINCT FROM 'L3.781.4.06.6'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list first-real-watch item sort_order 70)', 'Longines', 'L3.781.4.06.6';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L4C70$Swiss-made dive-capable at a non-dive price — ceramic bezel, automatic movement, proper water resistance. Already in catalog.$L4C70$, 70)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Oris' AND reference IS NOT DISTINCT FROM '01 754 7741 4065-07 5 20 63'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list first-real-watch item sort_order 80)', 'Oris', '01 754 7741 4065-07 5 20 63';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L4C80$Pointer date complication, exhibition caseback, silver dial — the watch that asks you to engage with how a date display is supposed to feel.$L4C80$, 80)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;

        -- ---------- LIST: tool-watch-purist ----------
        SELECT id INTO v_list_id FROM public.curated_lists
         WHERE curator_name = 'Horlo Editorial' AND title = $L5TITLE$The Essential Tool Watch List$L5TITLE$;
        IF v_list_id IS NULL THEN
          INSERT INTO public.curated_lists
            (title, curator_name, cover_url, intro_markdown, status, sort_order, published_at)
          VALUES (
            $L5TITLEV$The Essential Tool Watch List$L5TITLEV$,
            'Horlo Editorial',
            'https://wdntzsckjaoqodsyscns.supabase.co/storage/v1/object/public/cms-covers/seed/tool-watch-purist-0b8a0302-c7af-4757-bf37-52f6f3f54c29.png',
            $L5INTRO$A tool watch has a job. Readable under pressure, built to take abuse, designed
around a specific professional need — not around a showroom floor. This list
runs from entry-level purpose-built divers to the deepest production dive
watches ever made, with a detour through German technical watchmaking that
proves tool-watch thinking is not exclusive to Switzerland. Each reference has
a genuine use case behind it and a movement that doesn't need to apologize for
itself. Wear them in the water, wear them to the meeting: a real tool watch
doesn't have an off switch.$L5INTRO$,
            'published',
            50,
            NOW()
          ) RETURNING id INTO v_list_id;
        END IF;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Seiko' AND reference IS NOT DISTINCT FROM 'SRP777'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list tool-watch-purist item sort_order 10)', 'Seiko', 'SRP777';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L5C10$Curved cushion case, 200m rating, Hardlex crystal — the entry point for serious dive watch collecting.$L5C10$, 10)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Seiko' AND reference IS NOT DISTINCT FROM 'SBDC001'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list tool-watch-purist item sort_order 20)', 'Seiko', 'SBDC001';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L5C20$Sapphire crystal, 200m, the original Sumo proportions — a more understated tool than the Turtle and equally capable.$L5C20$, 20)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Mühle Glashütte' AND reference IS NOT DISTINCT FROM 'M1-37-42-102-CB'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list tool-watch-purist item sort_order 30)', 'Mühle Glashütte', 'M1-37-42-102-CB';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L5C30$German movement, anti-magnetic construction, 500m rating — the argument that tool-watch thinking thrives in Glashütte as naturally as it does in Switzerland.$L5C30$, 30)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Steinhart' AND reference IS NOT DISTINCT FROM 'Ocean-One-39'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list tool-watch-purist item sort_order 40)', 'Steinhart', 'Ocean-One-39';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L5C40$Swiss ETA movement in a 39mm case with 300m rating — the independent tool watch that keeps its proportions.$L5C40$, 40)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Squale' AND reference IS NOT DISTINCT FROM '1521-026'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list tool-watch-purist item sort_order 50)', 'Squale', '1521-026';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L5C50$1521 caliber, 50 ATM rated, Italian manufacture — the depth-rated workhorse from the brand that supplied the navies.$L5C50$, 50)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Sinn' AND reference IS NOT DISTINCT FROM '856.010'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list tool-watch-purist item sort_order 55)', 'Sinn', '856.010';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L5C55$German case hardening, TEGIMENT technology, UTC hand — the engineering case for buying German before buying Swiss.$L5C55$, 55)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Tudor' AND reference IS NOT DISTINCT FROM '25600TN'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list tool-watch-purist item sort_order 60)', 'Tudor', '25600TN';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L5C60$Titanium case, 500m rating, in-house movement with a helium escape valve — Tudor's deep-dive professional.$L5C60$, 60)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Omega' AND reference IS NOT DISTINCT FROM '210.30.42.20.01.001'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list tool-watch-purist item sort_order 70)', 'Omega', '210.30.42.20.01.001';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L5C70$Co-Axial Master Chronometer, ceramic bezel, 300m — the modern standard for a professional diving watch.$L5C70$, 70)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Rolex' AND reference IS NOT DISTINCT FROM '126600'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list tool-watch-purist item sort_order 80)', 'Rolex', '126600';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L5C80$1220m rating, ceramic bezel, cyclops-free dial — the deepest purpose-built production diver Rolex makes.$L5C80$, 80)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;

        -- ---------- LIST: microbrand-picks ----------
        SELECT id INTO v_list_id FROM public.curated_lists
         WHERE curator_name = 'Horlo Editorial' AND title = $L6TITLE$Microbrand Picks That Earn Their Spot$L6TITLE$;
        IF v_list_id IS NULL THEN
          INSERT INTO public.curated_lists
            (title, curator_name, cover_url, intro_markdown, status, sort_order, published_at)
          VALUES (
            $L6TITLEV$Microbrand Picks That Earn Their Spot$L6TITLEV$,
            'Horlo Editorial',
            'https://wdntzsckjaoqodsyscns.supabase.co/storage/v1/object/public/cms-covers/seed/microbrand-picks-dae41036-7728-4a89-bafa-830e8747dad5.png',
            $L6INTRO$The strongest case for a microbrand is simple: no heritage tax, no boutique
margin, no marketing department deciding what you should want. These makers
sell direct, design with intention, and compete on specification and craft
rather than logo recognition. Each pick here has earned its place against
established alternatives — not by imitating them, but by solving the same
problem differently, often better. These are the brands worth watching before
the watch world catches up.$L6INTRO$,
            'published',
            60,
            NOW()
          ) RETURNING id INTO v_list_id;
        END IF;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Baltic' AND reference IS NOT DISTINCT FROM 'HER11SUY E81'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list microbrand-picks item sort_order 10)', 'Baltic', 'HER11SUY E81';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L6C10$French 37mm field/tool watch on a Miyota 9039; vintage-correct sizing with a summery sector dial. Baltic at its most confident.$L6C10$, 10)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Héron Watches' AND reference IS NOT DISTINCT FROM '3001-A'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list microbrand-picks item sort_order 20)', 'Héron Watches', '3001-A';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L6C20$Montréal mid-century diver, Miyota 9039, 300m, with a hardened ~1,200-Vickers case that resists scratches most microbrands don't bother engineering for.$L6C20$, 20)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Wren' AND reference IS NOT DISTINCT FROM 'Wren-Diver-38-Aqua'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list microbrand-picks item sort_order 30)', 'Wren', 'Wren-Diver-38-Aqua';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L6C30$Swiss-made 38mm diver on the ultra-slim ETA 2892, fully lumed ceramic bezel, 200m; enthusiast-run and built to the spec the segment usually charges twice for.$L6C30$, 30)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'echo/neutra' AND model = 'Rivanera' AND reference IS NULL
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% model=% reference=NULL (list microbrand-picks item sort_order 40)', 'echo/neutra', 'Rivanera';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L6C40$Italian rectangular dress watch in sandblasted Grade 5 titanium (21g) on a hand-wound ETA 7001; argues with the Tank rather than copying it.$L6C40$, 40)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Serica' AND reference IS NOT DISTINCT FROM '8315-BLACK-3H'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list microbrand-picks item sort_order 50)', 'Serica', '8315-BLACK-3H';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L6C50$French-designed, Swiss-made, fully COSC-certified; reinvents the traveler GMT with an enamel-and-ceramic bezel and Soprod movement.$L6C50$, 50)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Formex' AND reference IS NOT DISTINCT FROM '0333.1.6611.101'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list microbrand-picks item sort_order 60)', 'Formex', '0333.1.6611.101';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L6C60$Patented case-suspension system and COSC certification as standard; pure engineering nobody markets hard enough.$L6C60$, 60)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'Furlan Marri' AND reference IS NOT DISTINCT FROM 'Furlan-Marri-Chronograph'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list microbrand-picks item sort_order 70)', 'Furlan Marri', 'Furlan-Marri-Chronograph';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L6C70$Geneva, GPHG Horological Revelation winner; sector-dial chronographs the establishment is chasing — meca-quartz at the entry, mechanical (La Joux-Perret) above.$L6C70$, 70)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;


        SELECT id INTO v_catalog_id FROM public.watches_catalog
         WHERE brand = 'anOrdain' AND reference IS NOT DISTINCT FROM 'anOrdain-Model-2'
         LIMIT 1;
        IF v_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (list microbrand-picks item sort_order 80)', 'anOrdain', 'anOrdain-Model-2';
        END IF;
        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)
        VALUES (v_list_id, v_catalog_id, $L6C80$Glasgow workshop making hand-fired vitreous enamel dials the century-old way; grand-feu craft at a fraction of luxury pricing.$L6C80$, 80)
        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;

END $$;

-- ---------- 8 collection paths ----------
-- Idempotency key: (seed_catalog_id, source='manual', path_type, sort_order).
-- Nodes always use ON CONFLICT DO NOTHING on collection_path_nodes_unique_slot.

DO $$
DECLARE
  v_path_id         uuid;
  v_seed_catalog_id uuid;
  v_node_catalog_id uuid;
BEGIN
        -- ---------- PATH: going-deeper-1 ----------

        SELECT id INTO v_seed_catalog_id FROM public.watches_catalog
         WHERE brand = 'Seiko' AND reference IS NOT DISTINCT FROM 'SPB239'
         LIMIT 1;
        IF v_seed_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path going-deeper-1 seed)', 'Seiko', 'SPB239';
        END IF;

        -- Idempotency: (seed_catalog_id, source='manual', path_type, sort_order)
        SELECT id INTO v_path_id FROM public.collection_paths
         WHERE seed_catalog_id = v_seed_catalog_id
           AND source = 'manual'
           AND path_type = 'Going Deeper'
           AND sort_order = 10;
        IF v_path_id IS NULL THEN
          INSERT INTO public.collection_paths
            (seed_catalog_id, status, path_type, rationale, source, sort_order)
          VALUES (
            v_seed_catalog_id,
            'published',
            'Going Deeper',
            $P1RAT$A single tool-ethos dive line — same conviction, properly executed and deepened
at each rung. Same tool ethos, progressively more sophisticated execution. Every
step adds something the previous could not without abandoning the original conviction.$P1RAT$,
            'manual',
            10
          ) RETURNING id INTO v_path_id;
        END IF;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Tudor' AND reference IS NOT DISTINCT FROM '79030N'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path going-deeper-1 node sort_order 0)', 'Tudor', '79030N';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P1N0R$The leap into Swiss manufacture — MT5400-U, COSC + METAS Master Chronometer, vintage-Sub DNA at 39mm. Still a tool, now with a chronometer's heart.$P1N0R$, 0)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Omega' AND reference IS NOT DISTINCT FROM '215.30.44.21.01.001'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path going-deeper-1 node sort_order 1)', 'Omega', '215.30.44.21.01.001';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P1N1R$The depth step — 600m, Co-Axial cal. 8900, Master Chronometer. The genre pushed to its literal extreme.$P1N1R$, 1)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Rolex' AND reference IS NOT DISTINCT FROM '124060'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path going-deeper-1 node sort_order 2)', 'Rolex', '124060';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P1N2R$The source — cal. 3230, 300m, Cerachrom. The most influential tool diver ever made, where the SKX's conviction was first written.$P1N2R$, 2)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;

        -- ---------- PATH: going-deeper-2 ----------

        SELECT id INTO v_seed_catalog_id FROM public.watches_catalog
         WHERE brand = 'Hamilton Watch' AND reference IS NOT DISTINCT FROM 'H38425540'
         LIMIT 1;
        IF v_seed_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path going-deeper-2 seed)', 'Hamilton Watch', 'H38425540';
        END IF;

        -- Idempotency: (seed_catalog_id, source='manual', path_type, sort_order)
        SELECT id INTO v_path_id FROM public.collection_paths
         WHERE seed_catalog_id = v_seed_catalog_id
           AND source = 'manual'
           AND path_type = 'Going Deeper'
           AND sort_order = 20;
        IF v_path_id IS NULL THEN
          INSERT INTO public.collection_paths
            (seed_catalog_id, status, path_type, rationale, source, sort_order)
          VALUES (
            v_seed_catalog_id,
            'published',
            'Going Deeper',
            $P2RAT$A great dress watch says less and finishes more. The Hamilton sets the form.
The Nomos adds the first movement decoration worth turning over for. The Grand
Seiko moves the craft to the surfaces. The JLC brings ultra-thin manufacture
pedigree. The Lange ends where finishing becomes the whole point. The watches
get quieter as the work gets deeper.$P2RAT$,
            'manual',
            20
          ) RETURNING id INTO v_path_id;
        END IF;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Nomos Glashütte' AND reference IS NOT DISTINCT FROM '139'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path going-deeper-2 node sort_order 0)', 'Nomos Glashütte', '139';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P2N0R$The first finishing you notice — in-house Alpha caliber with Glashütte decoration, sunburst graining, blued screws under a Bauhaus dial. The first time the caseback rewards turning over.$P2N0R$, 0)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Grand Seiko' AND reference IS NOT DISTINCT FROM 'SBGW231'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path going-deeper-2 node sort_order 1)', 'Grand Seiko', 'SBGW231';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P2N1R$Finishing that needs light to exist — Zaratsu-polished case, diamond-cut hands and indices, hand-wound 9S64. Swiss-level dial craft at half the Swiss price.$P2N1R$, 1)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Jaeger-LeCoultre' AND reference IS NOT DISTINCT FROM 'Q1218420'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path going-deeper-2 node sort_order 2)', 'Jaeger-LeCoultre', 'Q1218420';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P2N2R$The watchmaker's watch — 39mm case at 8.1mm thick, eggshell dial, faceted indices. Ultra-thin tradition dating to 1907; the manufacture that once supplied Patek, AP, and Vacheron.$P2N2R$, 2)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'A. Lange & Söhne' AND reference IS NOT DISTINCT FROM '211.027'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path going-deeper-2 node sort_order 3)', 'A. Lange & Söhne', '211.027';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P2N3R$The finishing summit — German-silver plates, gold chatons, hand-engraved balance cock. Arguably the best series finishing on earth on a dial of near-total silence.$P2N3R$, 3)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;

        -- ---------- PATH: branching-out-1 ----------

        SELECT id INTO v_seed_catalog_id FROM public.watches_catalog
         WHERE brand = 'Longines' AND reference IS NOT DISTINCT FROM 'L3.802.4.63.6'
         LIMIT 1;
        IF v_seed_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path branching-out-1 seed)', 'Longines', 'L3.802.4.63.6';
        END IF;

        -- Idempotency: (seed_catalog_id, source='manual', path_type, sort_order)
        SELECT id INTO v_path_id FROM public.collection_paths
         WHERE seed_catalog_id = v_seed_catalog_id
           AND source = 'manual'
           AND path_type = 'Branching Out'
           AND sort_order = 30;
        IF v_path_id IS NULL THEN
          INSERT INTO public.collection_paths
            (seed_catalog_id, status, path_type, rationale, source, sort_order)
          VALUES (
            v_seed_catalog_id,
            'published',
            'Branching Out',
            $P3RAT$The Spirit Zulu Time is a versatile starting point — a contemporary aviator GMT
with restrained design. This path branches laterally: the water branch trades GMT
for dive utility; the craft branch trades complication for movement architecture;
the complication branch trades dual-time for the mechanical stopwatch.$P3RAT$,
            'manual',
            30
          ) RETURNING id INTO v_path_id;
        END IF;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Oris' AND reference IS NOT DISTINCT FROM '01 733 7707 4053-07 5 20 89'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path branching-out-1 node sort_order 0)', 'Oris', '01 733 7707 4053-07 5 20 89';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P3N0R$The water branch — an independent-Swiss vintage diver with a rotating bezel and real dive utility in place of the GMT.$P3N0R$, 0)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Nomos Glashütte' AND reference IS NOT DISTINCT FROM '180'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path branching-out-1 node sort_order 1)', 'Nomos Glashütte', '180';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P3N1R$The craft branch — German Bauhaus restraint over an in-house ultra-thin automatic, complications stripped away.$P3N1R$, 1)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Hamilton Watch' AND reference IS NOT DISTINCT FROM 'H38416711'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path branching-out-1 node sort_order 2)', 'Hamilton Watch', 'H38416711';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P3N2R$The complication branch — a mid-century bicompax panda that swaps dual-time for the mechanical stopwatch.$P3N2R$, 2)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;

        -- ---------- PATH: branching-out-2 ----------

        SELECT id INTO v_seed_catalog_id FROM public.watches_catalog
         WHERE brand = 'Omega' AND reference IS NOT DISTINCT FROM '311.30.42.30.01.005'
         LIMIT 1;
        IF v_seed_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path branching-out-2 seed)', 'Omega', '311.30.42.30.01.005';
        END IF;

        -- Idempotency: (seed_catalog_id, source='manual', path_type, sort_order)
        SELECT id INTO v_path_id FROM public.collection_paths
         WHERE seed_catalog_id = v_seed_catalog_id
           AND source = 'manual'
           AND path_type = 'Branching Out'
           AND sort_order = 40;
        IF v_path_id IS NULL THEN
          INSERT INTO public.collection_paths
            (seed_catalog_id, status, path_type, rationale, source, sort_order)
          VALUES (
            v_seed_catalog_id,
            'published',
            'Branching Out',
            $P4RAT$The Speedmaster Professional is the canonical starting chronograph. This path
branches into four other relationships a serious watch can have with time:
silence, manufacture, frequency, and tool clarity.$P4RAT$,
            'manual',
            40
          ) RETURNING id INTO v_path_id;
        END IF;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Grand Seiko' AND reference IS NOT DISTINCT FROM 'SBGE285'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path branching-out-2 node sort_order 0)', 'Grand Seiko', 'SBGE285';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P4N0R$A movement you've never felt — the silent Spring Drive glide plus a traveler GMT.$P4N0R$, 0)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Jaeger-LeCoultre' AND reference IS NOT DISTINCT FROM 'Q9068681'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path branching-out-2 node sort_order 1)', 'Jaeger-LeCoultre', 'Q9068681';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P4N1R$A sports watch from a watchmaker's watchmaker, with Memovox dive heritage and real manufacture finishing.$P4N1R$, 1)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Zenith' AND reference IS NOT DISTINCT FROM '03.9300.3620/01.I001'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path branching-out-2 node sort_order 2)', 'Zenith', '03.9300.3620/01.I001';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P4N2R$Modern, high-frequency integrated sport — the 5Hz El Primero and its 1/10th-second subdial.$P4N2R$, 2)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Rolex' AND reference IS NOT DISTINCT FROM '224270'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path branching-out-2 node sort_order 3)', 'Rolex', '224270';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P4N3R$The pared-down, time-only tool watch — blue-chip Everest heritage, no premium games.$P4N3R$, 3)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;

        -- ---------- PATH: trading-up-1 ----------

        SELECT id INTO v_seed_catalog_id FROM public.watches_catalog
         WHERE brand = 'Seiko' AND reference IS NOT DISTINCT FROM 'SRPE51'
         LIMIT 1;
        IF v_seed_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-1 seed)', 'Seiko', 'SRPE51';
        END IF;

        -- Idempotency: (seed_catalog_id, source='manual', path_type, sort_order)
        SELECT id INTO v_path_id FROM public.collection_paths
         WHERE seed_catalog_id = v_seed_catalog_id
           AND source = 'manual'
           AND path_type = 'Trading Up'
           AND sort_order = 50;
        IF v_path_id IS NULL THEN
          INSERT INTO public.collection_paths
            (seed_catalog_id, status, path_type, rationale, source, sort_order)
          VALUES (
            v_seed_catalog_id,
            'published',
            'Trading Up',
            $P5RAT$The everyday steel watch built five times over: same brief — go-anywhere,
ask-nothing — interpreted by five tiers of watchmaking. Each rung adds finishing,
certification, or movement architecture the tier below couldn't justify.$P5RAT$,
            'manual',
            50
          ) RETURNING id INTO v_path_id;
        END IF;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Mido' AND reference IS NOT DISTINCT FROM 'M038.430.11.051.00'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-1 node sort_order 0)', 'Mido', 'M038.430.11.051.00';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P5N0R$The everyday brief in Swiss form — robust, day/date, 80-hour Caliber 80, on a bracelet.$P5N0R$, 0)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Grand Seiko' AND reference IS NOT DISTINCT FROM 'SBGR253'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-1 node sort_order 1)', 'Grand Seiko', 'SBGR253';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P5N1R$The family trade-up — the same do-it-all automatic, elevated to Zaratsu-polished, diamond-cut craft.$P5N1R$, 1)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Rolex' AND reference IS NOT DISTINCT FROM '126334'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-1 node sort_order 2)', 'Rolex', '126334';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P5N2R$The archetype — the one-watch-do-it-all with the durability and gravitas of the steel-sports benchmark.$P5N2R$, 2)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'A. Lange & Söhne' AND reference IS NOT DISTINCT FROM '363.179'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-1 node sort_order 3)', 'A. Lange & Söhne', '363.179';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P5N3R$The haute terminus — a day-and-date steel sports watch. The original's exact DNA at the summit of hand-finishing.$P5N3R$, 3)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;

        -- ---------- PATH: trading-up-2 ----------

        SELECT id INTO v_seed_catalog_id FROM public.watches_catalog
         WHERE brand = 'Tissot' AND reference IS NOT DISTINCT FROM 'T137.407.11.041.00'
         LIMIT 1;
        IF v_seed_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-2 seed)', 'Tissot', 'T137.407.11.041.00';
        END IF;

        -- Idempotency: (seed_catalog_id, source='manual', path_type, sort_order)
        SELECT id INTO v_path_id FROM public.collection_paths
         WHERE seed_catalog_id = v_seed_catalog_id
           AND source = 'manual'
           AND path_type = 'Trading Up'
           AND sort_order = 60;
        IF v_path_id IS NULL THEN
          INSERT INTO public.collection_paths
            (seed_catalog_id, status, path_type, rationale, source, sort_order)
          VALUES (
            v_seed_catalog_id,
            'published',
            'Trading Up',
            $P6RAT$The Genta-lineage integrated steel sports watch across five tiers: from the entry
icon to the trinity, each rung a serious step in case finishing and movement
pedigree within the same archetype.$P6RAT$,
            'manual',
            60
          ) RETURNING id INTO v_path_id;
        END IF;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Christopher Ward' AND reference IS NOT DISTINCT FROM 'C12-40A-S00K0-S00B0-K'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-2 node sort_order 0)', 'Christopher Ward', 'C12-40A-S00K0-S00B0-K';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P6N0R$The first real step up — sharper case angles, a more refined bracelet, and finishing that embarrasses watches twice its price.$P6N0R$, 0)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Baume & Mercier' AND reference IS NOT DISTINCT FROM '10728'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-2 node sort_order 1)', 'Baume & Mercier', '10728';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P6N1R$The heritage rung — one of the original 1973 integrated sports watches; dodecagonal bezel, in-house Baumatic movement with five-day reserve.$P6N1R$, 1)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Girard-Perregaux' AND reference IS NOT DISTINCT FROM '81010-11-431-11A'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-2 node sort_order 2)', 'Girard-Perregaux', '81010-11-431-11A';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P6N2R$The "fourth icon" — a genuine 1975 Genta-era integrated sports watch, fully in-house, the connoisseur's pick one step below the trinity.$P6N2R$, 2)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Vacheron Constantin' AND reference IS NOT DISTINCT FROM '4500V/110A-B128'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-2 node sort_order 3)', 'Vacheron Constantin', '4500V/110A-B128';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P6N3R$The haute terminus — in-house Caliber 5100 with a 22k gold rotor. The trinity's most understated entry; integrated sports as quiet flex rather than hype object.$P6N3R$, 3)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;

        -- ---------- PATH: trading-up-3 ----------

        SELECT id INTO v_seed_catalog_id FROM public.watches_catalog
         WHERE brand = 'Orient' AND reference IS NOT DISTINCT FROM 'FAC0000DD0'
         LIMIT 1;
        IF v_seed_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-3 seed)', 'Orient', 'FAC0000DD0';
        END IF;

        -- Idempotency: (seed_catalog_id, source='manual', path_type, sort_order)
        SELECT id INTO v_path_id FROM public.collection_paths
         WHERE seed_catalog_id = v_seed_catalog_id
           AND source = 'manual'
           AND path_type = 'Trading Up'
           AND sort_order = 70;
        IF v_path_id IS NULL THEN
          INSERT INTO public.collection_paths
            (seed_catalog_id, status, path_type, rationale, source, sort_order)
          VALUES (
            v_seed_catalog_id,
            'published',
            'Trading Up',
            $P7RAT$The round classic dress watch built five times: same form — clean dial, simple
complication, restrained case — interpreted by five tiers of watchmaking. The
thesis the Orient states, the Patek defined in 1932.$P7RAT$,
            'manual',
            70
          ) RETURNING id INTO v_path_id;
        END IF;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Baltic' AND reference IS NOT DISTINCT FROM 'MR01-Salmon'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-3 node sort_order 0)', 'Baltic', 'MR01-Salmon';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P7N0R$The story rung — an accessible Calatrava in 36mm, thin micro-rotor movement, Breguet numerals. Haute-horlogerie flavor at a microbrand price.$P7N0R$, 0)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Grand Seiko' AND reference IS NOT DISTINCT FROM 'SBGW231'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-3 node sort_order 1)', 'Grand Seiko', 'SBGW231';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P7N1R$The family trade-up — Orient to its group's luxury arm. Clean hand-wound classic in a Zaratsu-polished case, diamond-cut hands that need light to reveal themselves.$P7N1R$, 1)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Jaeger-LeCoultre' AND reference IS NOT DISTINCT FROM 'Q1342520'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-3 node sort_order 2)', 'Jaeger-LeCoultre', 'Q1342520';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P7N2R$The leap into haute horlogerie — ultra-thin, manufacture-finished, from the maison that once supplied movements to the trinity itself.$P7N2R$, 2)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Patek Philippe' AND reference IS NOT DISTINCT FROM '5227G-001'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-3 node sort_order 3)', 'Patek Philippe', '5227G-001';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P7N3R$The terminus and the source — the watch that defined the modern round dress watch in 1932. The form every rung beneath it is an echo of.$P7N3R$, 3)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;

        -- ---------- PATH: trading-up-4 ----------

        SELECT id INTO v_seed_catalog_id FROM public.watches_catalog
         WHERE brand = 'Baltic' AND reference IS NOT DISTINCT FROM 'Aquascaphe-Classic-Blue'
         LIMIT 1;
        IF v_seed_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-4 seed)', 'Baltic', 'Aquascaphe-Classic-Blue';
        END IF;

        -- Idempotency: (seed_catalog_id, source='manual', path_type, sort_order)
        SELECT id INTO v_path_id FROM public.collection_paths
         WHERE seed_catalog_id = v_seed_catalog_id
           AND source = 'manual'
           AND path_type = 'Trading Up'
           AND sort_order = 80;
        IF v_path_id IS NULL THEN
          INSERT INTO public.collection_paths
            (seed_catalog_id, status, path_type, rationale, source, sort_order)
          VALUES (
            v_seed_catalog_id,
            'published',
            'Trading Up',
            $P8RAT$The vintage-inspired dive watch across five tiers: each rung a more authentic
relationship with mid-century dive heritage. From homage at the entry, to
genuine reissue, to the literal source.$P8RAT$,
            'manual',
            80
          ) RETURNING id INTO v_path_id;
        END IF;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Squale' AND reference IS NOT DISTINCT FROM 'Sub-37-Legend'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-4 node sort_order 0)', 'Squale', 'Sub-37-Legend';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P8N0R$The heritage jump — 37mm, 1959-proportioned diver from the house that made cases for the golden-age originals. Homage by birthright.$P8N0R$, 0)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Longines' AND reference IS NOT DISTINCT FROM 'L3.795.4.59.9'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-4 node sort_order 1)', 'Longines', 'L3.795.4.59.9';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P8N1R$A genuine golden-age reissue — Longines's 1959 super-compressor with twin crowns, internal bezel, COSC-certified, silicon hairspring. A contemporary of the Fifty Fathoms.$P8N1R$, 1)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Omega' AND reference IS NOT DISTINCT FROM '234.30.41.21.03.001'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-4 node sort_order 2)', 'Omega', '234.30.41.21.03.001';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P8N2R$Not a homage but a time capsule — a literal re-edition of the 1957 Seamaster 300, carrying the Co-Axial Master Chronometer movement.$P8N2R$, 2)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;


        SELECT id INTO v_node_catalog_id FROM public.watches_catalog
         WHERE brand = 'Blancpain' AND reference IS NOT DISTINCT FROM '5015-1130-71S'
         LIMIT 1;
        IF v_node_catalog_id IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (path trading-up-4 node sort_order 3)', 'Blancpain', '5015-1130-71S';
        END IF;
        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)
        VALUES (v_path_id, v_node_catalog_id, $P8N3R$The terminus and the source — the 1953 watch widely held to be the first modern dive watch. The template every rung beneath it descends from.$P8N3R$, 3)
        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;

END $$;

-- ---------- Sanity assertion ----------
DO $$
DECLARE
  list_count  integer;
  item_count  integer;
  path_count  integer;
  node_count  integer;
BEGIN
  SELECT count(*) INTO list_count
    FROM public.curated_lists
   WHERE curator_name = 'Horlo Editorial' AND status = 'published';
  SELECT count(*) INTO item_count
    FROM public.curated_list_items cli
    JOIN public.curated_lists cl ON cl.id = cli.list_id
   WHERE cl.curator_name = 'Horlo Editorial';
  SELECT count(*) INTO path_count
    FROM public.collection_paths
   WHERE source = 'manual' AND status = 'published';
  SELECT count(*) INTO node_count
    FROM public.collection_path_nodes;
  IF list_count < 6 THEN
    RAISE EXCEPTION 'seed_explore_editorial: expected >=6 published Horlo Editorial lists, got %', list_count;
  END IF;
  IF item_count < 44 THEN
    RAISE EXCEPTION 'seed_explore_editorial: expected >=44 list items, got %', item_count;
  END IF;
  IF path_count < 8 THEN
    RAISE EXCEPTION 'seed_explore_editorial: expected >=8 published manual paths, got %', path_count;
  END IF;
  IF node_count < 30 THEN
    RAISE EXCEPTION 'seed_explore_editorial: expected >=30 path nodes, got %', node_count;
  END IF;
END $$;

COMMIT;
