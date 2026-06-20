-- Quick task 260620-gk9 follow-up — replace 3 broken Nomos Glashütte image URLs.
--
-- All three Nomos cdn URLs were 400-ing in prod. The replacement URLs differ
-- only in the CDN transform query (added `,bg=gray,sf=png`) and the file
-- extension (`.png` → `.jpg`). Same path slug, same image asset.
--
-- Apply via: supabase db push --linked
-- Do NOT use: drizzle-kit push / supabase db reset / local psql
-- Per memory: project_drizzle_supabase_db_mismatch
--
-- Idempotency: each UPDATE guards on the OLD broken URL, so re-applying
-- this migration is a no-op once the new URL is set. If anyone later
-- manually changes the URL to something else, this migration leaves that
-- value alone.
--
-- Per memory project_post_flight_assertion_predicate_divergence: the
-- post-flight assertion below uses a DIFFERENT predicate
-- (image_url = '<new url>') than the WHERE clause (image_url = '<old url>')
-- so it cannot trivially pass if the UPDATE silently no-ops.
--
-- All 3 rows keyed by (brand, model, reference) natural triple per
-- project_catalog-id-divergence.

BEGIN;

UPDATE public.watches_catalog
   SET image_url = 'https://cdn.nomos-glashuette.com/img/f=scale-down,w=2560,bg=gray,sf=png/webshop/fc/bf/e1/1743068623/0101_0139_tangente-2d-front-masked.jpg',
       updated_at = now()
 WHERE brand = 'Nomos Glashütte'
   AND model = 'Tangente'
   AND coalesce(reference, '') = '139'
   AND image_url = 'https://cdn.nomos-glashuette.com/img/f=scale-down,w=2560/webshop/fc/bf/e1/1743068623/0101_0139_tangente-2d-front-masked.png';

UPDATE public.watches_catalog
   SET image_url = 'https://cdn.nomos-glashuette.com/img/f=scale-down,w=2560,bg=gray,sf=png/webshop/38/c3/03/1761300428/0164_0165_Tangente_38_2d-front-masked.jpg',
       updated_at = now()
 WHERE brand = 'Nomos Glashütte'
   AND model = 'Tangente 38'
   AND coalesce(reference, '') = '165'
   AND image_url = 'https://cdn.nomos-glashuette.com/img/f=scale-down,w=2560/webshop/38/c3/03/1761300428/0164_0165_Tangente_38_2d-front-masked.png';

UPDATE public.watches_catalog
   SET image_url = 'https://cdn.nomos-glashuette.com/img/f=scale-down,w=2560,bg=gray,sf=png/webshop/6b/a1/18/1743071546/0180_tangente_neomatik_41_update-2d-front-masked.jpg',
       updated_at = now()
 WHERE brand = 'Nomos Glashütte'
   AND model = 'Tangente neomatik 41'
   AND coalesce(reference, '') = '180'
   AND image_url = 'https://cdn.nomos-glashuette.com/img/f=scale-down,w=2560/webshop/6b/a1/18/1743071546/0180_tangente_neomatik_41_update-2d-front-masked.png';

-- Post-flight: assert each of the 3 rows now has the NEW URL.
-- Uses a different predicate (= new url) than the UPDATE's WHERE (= old url),
-- so a silent no-op would be caught.
DO $$
DECLARE matched int;
BEGIN
  SELECT count(*) INTO matched FROM public.watches_catalog
   WHERE (brand, model, coalesce(reference, ''), image_url) IN (
     ('Nomos Glashütte', 'Tangente',              '139', 'https://cdn.nomos-glashuette.com/img/f=scale-down,w=2560,bg=gray,sf=png/webshop/fc/bf/e1/1743068623/0101_0139_tangente-2d-front-masked.jpg'),
     ('Nomos Glashütte', 'Tangente 38',           '165', 'https://cdn.nomos-glashuette.com/img/f=scale-down,w=2560,bg=gray,sf=png/webshop/38/c3/03/1761300428/0164_0165_Tangente_38_2d-front-masked.jpg'),
     ('Nomos Glashütte', 'Tangente neomatik 41', '180', 'https://cdn.nomos-glashuette.com/img/f=scale-down,w=2560,bg=gray,sf=png/webshop/6b/a1/18/1743071546/0180_tangente_neomatik_41_update-2d-front-masked.jpg')
   );
  IF matched <> 3 THEN
    RAISE EXCEPTION 'post-flight: expected 3 Nomos rows with new image_url, found %', matched;
  END IF;
END $$;

COMMIT;
