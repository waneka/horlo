-- supabase/migrations/20260413000000_sync_auth_users.sql
-- Shadow-user sync: mirror auth.users -> public.users on INSERT
-- so Phase 3 FKs (watches.userId, user_preferences.userId) resolve on first sign-up.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
