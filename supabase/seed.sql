-- Local dev seed — auto-runs on `supabase db reset`, also safe to re-run
-- standalone via:
--   docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/seed.sql
--
-- Creates 4 dev users (1 viewer + 3 peers with diverse collection overlap)
-- so the home "From Collectors Like You" rail has a meaningful local
-- pool to render against. All users get a public profile + public
-- collection so the peer-overlap query picks them up. Password for all
-- seeded users is "password123".
--
-- Watches link to existing `watches_catalog` rows by brand+model (catalog
-- is populated from prod via the catalog import — see the local-dev
-- catchup quick task). If a referenced (brand, model) doesn't exist in
-- the catalog, that watch INSERT will silently skip (subquery returns
-- NULL → catalog_id NOT NULL constraint fails → INSERT errors; we run
-- with ON_ERROR_STOP=0 so the rest of the seed proceeds).

BEGIN;

-- ── 4 dev users via auth.users (trigger mirrors to public.users) ─────
-- bcrypt-hashed "password123" via pgcrypto's crypt() + gen_salt('bf').
-- Token columns (confirmation_token, recovery_token, etc.) must be
-- empty strings, NOT NULL — gotrue (Supabase Auth) compares them with
-- `= ''` during sign-in and a NULL silently fails the comparison,
-- producing "Invalid email or password". The DEFAULT for these columns
-- is NULL even though gotrue assumes empty string, so be explicit.
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token,
  reauthentication_token
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'viewer@horlo.test', crypt('password123', gen_salt('bf')),
    NOW(), '{}', '{"provider":"email","providers":["email"]}',
    NOW(), NOW(),
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'vintage-anna@horlo.test', crypt('password123', gen_salt('bf')),
    NOW(), '{}', '{"provider":"email","providers":["email"]}',
    NOW(), NOW(),
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'modern-mike@horlo.test', crypt('password123', gen_salt('bf')),
    NOW(), '{}', '{"provider":"email","providers":["email"]}',
    NOW(), NOW(),
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'dress-dan@horlo.test', crypt('password123', gen_salt('bf')),
    NOW(), '{}', '{"provider":"email","providers":["email"]}',
    NOW(), NOW(),
    '', '', '', '', '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

-- ── Profile display_name + bio (the auth.users insert triggers
--    handle_new_public_user() which auto-creates profile rows with
--    derived usernames and default public settings; we just UPDATE
--    the display_name + bio fields the trigger leaves NULL). ──
UPDATE profiles SET display_name = 'Viewer Test',  bio = 'Local dev viewer — diverse 5-brand collection' WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE profiles SET display_name = 'Vintage Anna', bio = 'Vintage divers and chronographs'                WHERE id = '00000000-0000-0000-0000-000000000002';
UPDATE profiles SET display_name = 'Modern Mike',  bio = 'Modern tool watches'                            WHERE id = '00000000-0000-0000-0000-000000000003';
UPDATE profiles SET display_name = 'Dress Dan',    bio = 'Dress watches and dressy GMTs'                  WHERE id = '00000000-0000-0000-0000-000000000004';

-- ── Owned watches — link to real catalog rows by brand+model lookup ──
-- catalog_id is NOT NULL so missing catalog rows silently drop the INSERT.
-- Style tags chosen to give dominantStyleOf() a clear signal per user.

-- Viewer (5 brands → tests multi-brand match + variety cap)
INSERT INTO watches (user_id, brand, model, status, catalog_id, style_tags, role_tags)
SELECT u.user_id, c.brand, c.model, 'owned', c.id, c.style_tags, c.role_tags
FROM (VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Baltic',         'Aquascaphe Classic'),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Seiko',          '5 Sports'),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Hamilton Watch', 'Khaki Field Mechanical'),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Omega',          'Speedmaster Professional'),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Tudor',          'Black Bay 58')
) u(user_id, brand, model)
JOIN LATERAL (
  -- Catalog has occasional dupe (brand, model) rows; pick the most-
  -- popular row deterministically so the seed produces exactly one
  -- watch per VALUES entry. NOTE: this matches the recommender's
  -- in-memory dedup key — `lower(brand)|lower(model)`.
  SELECT id, brand, model, style_tags, role_tags FROM watches_catalog wc
  WHERE lower(trim(wc.brand)) = lower(trim(u.brand))
    AND lower(trim(wc.model)) = lower(trim(u.model))
  ORDER BY wc.owners_count DESC NULLS LAST, wc.id
  LIMIT 1
) c ON true
ON CONFLICT DO NOTHING;

-- Vintage Anna: shares Seiko + Omega with viewer (strong peer)
INSERT INTO watches (user_id, brand, model, status, catalog_id, style_tags, role_tags)
SELECT u.user_id, c.brand, c.model, 'owned', c.id, c.style_tags, c.role_tags
FROM (VALUES
  ('00000000-0000-0000-0000-000000000002'::uuid, 'Seiko',  '6105-8110'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'Omega',  'Speedmaster Professional'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'Rolex',  'Submariner'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'Tudor',  'Black Bay 58')
) u(user_id, brand, model)
JOIN LATERAL (
  -- Catalog has occasional dupe (brand, model) rows; pick the most-
  -- popular row deterministically so the seed produces exactly one
  -- watch per VALUES entry. NOTE: this matches the recommender's
  -- in-memory dedup key — `lower(brand)|lower(model)`.
  SELECT id, brand, model, style_tags, role_tags FROM watches_catalog wc
  WHERE lower(trim(wc.brand)) = lower(trim(u.brand))
    AND lower(trim(wc.model)) = lower(trim(u.model))
  ORDER BY wc.owners_count DESC NULLS LAST, wc.id
  LIMIT 1
) c ON true
ON CONFLICT DO NOTHING;

-- Modern Mike: shares Seiko + Tudor with viewer (moderate peer)
INSERT INTO watches (user_id, brand, model, status, catalog_id, style_tags, role_tags)
SELECT u.user_id, c.brand, c.model, 'owned', c.id, c.style_tags, c.role_tags
FROM (VALUES
  ('00000000-0000-0000-0000-000000000003'::uuid, 'Seiko',          'SKX007'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'Tudor',          'Pelagos'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'Sinn',           '556 I RS on H'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'Hamilton Watch', 'Khaki Field Mechanical')
) u(user_id, brand, model)
JOIN LATERAL (
  -- Catalog has occasional dupe (brand, model) rows; pick the most-
  -- popular row deterministically so the seed produces exactly one
  -- watch per VALUES entry. NOTE: this matches the recommender's
  -- in-memory dedup key — `lower(brand)|lower(model)`.
  SELECT id, brand, model, style_tags, role_tags FROM watches_catalog wc
  WHERE lower(trim(wc.brand)) = lower(trim(u.brand))
    AND lower(trim(wc.model)) = lower(trim(u.model))
  ORDER BY wc.owners_count DESC NULLS LAST, wc.id
  LIMIT 1
) c ON true
ON CONFLICT DO NOTHING;

-- Dress Dan: zero brand overlap with viewer (weak/no peer — tests
-- top-up fallback when peer pool has nothing relevant)
INSERT INTO watches (user_id, brand, model, status, catalog_id, style_tags, role_tags)
SELECT u.user_id, c.brand, c.model, 'owned', c.id, c.style_tags, c.role_tags
FROM (VALUES
  ('00000000-0000-0000-0000-000000000004'::uuid, 'Junghans',        'Max Bill Regulator Bauhaus'),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'Nomos Glashütte', 'Tangente'),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'Grand Seiko',     'Snowflake')
) u(user_id, brand, model)
JOIN LATERAL (
  -- Catalog has occasional dupe (brand, model) rows; pick the most-
  -- popular row deterministically so the seed produces exactly one
  -- watch per VALUES entry. NOTE: this matches the recommender's
  -- in-memory dedup key — `lower(brand)|lower(model)`.
  SELECT id, brand, model, style_tags, role_tags FROM watches_catalog wc
  WHERE lower(trim(wc.brand)) = lower(trim(u.brand))
    AND lower(trim(wc.model)) = lower(trim(u.model))
  ORDER BY wc.owners_count DESC NULLS LAST, wc.id
  LIMIT 1
) c ON true
ON CONFLICT DO NOTHING;

COMMIT;

-- Verification queries (output silently absorbed when run via supabase reset;
-- visible when run manually).
SELECT 'seeded_users' AS k, COUNT(*) FROM profiles WHERE id::text LIKE '00000000-0000-0000-0000-00000000000%';
SELECT 'seeded_watches' AS k, COUNT(*) FROM watches WHERE user_id::text LIKE '00000000-0000-0000-0000-00000000000%';
