-- Phase 7: Profile auto-creation trigger
-- Fires on public.users INSERT (after the existing auth sync trigger)
-- Creates profiles and profile_settings rows automatically (D-01)

CREATE OR REPLACE FUNCTION public.handle_new_public_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
  candidate_username text;
  suffix int;
BEGIN
  -- Generate username from email prefix (D-03)
  base_username := lower(regexp_replace(
    split_part(NEW.email, '@', 1),
    '[^a-z0-9_]', '_', 'g'
  ));

  -- Ensure starts with a letter (D-04)
  IF base_username !~ '^[a-z]' THEN
    base_username := 'u_' || base_username;
  END IF;

  -- Ensure minimum length of 3
  IF length(base_username) < 3 THEN
    base_username := base_username || '_user';
  END IF;

  -- Truncate to 26 chars (leaves room for _XXXX suffix)
  base_username := left(base_username, 26);

  -- Deduplication loop (D-03)
  candidate_username := base_username;
  suffix := 0;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate_username) LOOP
    suffix := floor(random() * 9000 + 1000)::int;
    candidate_username := left(base_username, 25) || '_' || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, candidate_username);

  INSERT INTO public.profile_settings (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_public_user_created ON public.users;
CREATE TRIGGER on_public_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_public_user();
