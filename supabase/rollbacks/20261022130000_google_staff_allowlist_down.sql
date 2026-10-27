-- Rollback for migrations/20261022130000_google_staff_allowlist.sql.
-- Run only if migration 9 must be undone. Paste and run the whole file in the
-- Supabase SQL editor.
--
-- This cannot bring back:
--   - Google-only accounts the migration deleted because they were not on the
--     allowlist, or their profiles, assignments, schedules and time logs.
--   - Managers removed with delete_manager.
--   - Profile roles the migration or a Google sign in synced to the allowlist.
--
-- After this runs, the old handle_new_user is back: public email sign up works
-- again, and the first account without a role becomes master if none exists.
-- Google sign in is refused by the app callback, because google_access_facts
-- is gone, and Remove on a manager fails, because delete_manager is gone.
-- The revokes on create_invited_user and handle_new_user stay in place, since
-- create or replace keeps them and the old functions never needed them.

drop trigger if exists on_auth_user_email_change on auth.users;
drop trigger if exists on_auth_identity_saved on auth.identities;

drop function if exists private.guard_auth_email_change();
drop function if exists private.guard_google_identity();
drop function if exists public.google_access_facts();
drop function if exists private.google_access_facts();
drop function if exists public.delete_manager(uuid);
drop function if exists private.delete_manager(uuid);

-- From 20260921151000_intern_managers_and_invites.sql.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role public.user_role := 'intern';
  requested_role text := coalesce(new.raw_app_meta_data ->> 'onboarding_role', '');
begin
  if requested_role in ('admin', 'master', 'intern') then
    assigned_role := requested_role::public.user_role;
  elsif not exists (select 1 from public.profiles where role = 'master') then
    assigned_role := 'master';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    assigned_role
  );
  return new;
end;
$$;

-- From 20260921151000_intern_managers_and_invites.sql.
create or replace function private.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.role is distinct from old.role and not private.is_master() then
    raise exception 'Only the master admin can change roles';
  end if;

  return new;
end;
$$;

-- From 20260921151000_intern_managers_and_invites.sql.
create or replace function private.create_invited_user(
  p_email text,
  p_pin text,
  p_full_name text,
  p_role public.user_role
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  new_id uuid := gen_random_uuid();
  intern_email text;
begin
  intern_email := private.normalize_login_email(p_email);

  if length(coalesce(p_pin, '')) <> 6 or p_pin !~ '^[0-9]{6}$' then
    raise exception 'PIN must be 6 digits';
  end if;

  if exists (select 1 from auth.users where email = intern_email) then
    raise exception 'That email already has an account';
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_id,
    'authenticated',
    'authenticated',
    intern_email,
    extensions.crypt(p_pin, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'onboarding_role', p_role::text
    ),
    jsonb_build_object('full_name', nullif(trim(p_full_name), '')),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    new_id::text,
    new_id,
    jsonb_build_object('sub', new_id::text, 'email', intern_email, 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  );

  update public.profiles
  set full_name = coalesce(nullif(trim(p_full_name), ''), full_name)
  where id = new_id;

  return new_id;
end;
$$;

-- From 20260921123000_module_links_and_intern_admin.sql.
create or replace function private.delete_intern(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not private.is_admin() then
    raise exception 'Only admins can remove intern accounts';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot remove your own account';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_user_id and role = 'intern'
  ) then
    raise exception 'Only intern accounts can be removed';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

-- Nothing above calls these any more.
drop function if exists private.is_reserved_staff_email(text);
drop function if exists private.google_staff_role(text, text, boolean);
drop table if exists private.staff_allowlist;
