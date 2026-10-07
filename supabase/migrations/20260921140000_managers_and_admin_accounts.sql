alter table public.profiles
  add column if not exists manager_id uuid references public.profiles (id) on delete set null;

create index if not exists profiles_manager_id_idx on public.profiles (manager_id);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role public.user_role := 'intern';
begin
  if coalesce(new.raw_app_meta_data ->> 'onboarding_role', '') = 'admin' then
    assigned_role := 'admin';
  elsif not exists (select 1 from public.profiles where role = 'admin') then
    assigned_role := 'admin';
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

create or replace function private.validate_intern_manager()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'admin' then
    new.manager_id := null;
    return new;
  end if;

  if new.manager_id is not null then
    if new.manager_id = new.id then
      raise exception 'An intern cannot be their own manager';
    end if;

    if not exists (
      select 1 from public.profiles
      where id = new.manager_id and role = 'admin'
    ) then
      raise exception 'Manager must be an admin account';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_validate_manager on public.profiles;
create trigger profiles_validate_manager
  before insert or update on public.profiles
  for each row execute function private.validate_intern_manager();

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

  if new.role is distinct from old.role and not private.is_admin() then
    raise exception 'Only admins can change roles';
  end if;

  if new.manager_id is distinct from old.manager_id and not private.is_admin() then
    raise exception 'Only admins can change an intern manager';
  end if;

  return new;
end;
$$;

drop policy if exists "profiles_select_admins" on public.profiles;
create policy "profiles_select_admins"
  on public.profiles for select to authenticated
  using (role = 'admin');

drop function if exists public.create_intern(text, text, text);
drop function if exists private.create_intern(text, text, text);

create or replace function private.create_intern(
  p_login text,
  p_password text,
  p_full_name text,
  p_manager_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  new_id uuid := gen_random_uuid();
  normalized_login text;
  intern_email text;
  manager uuid;
begin
  if not private.is_admin() then
    raise exception 'Only admins can create intern accounts';
  end if;

  normalized_login := lower(trim(p_login));
  if normalized_login !~ '^[a-z0-9._-]{3,32}$' then
    raise exception 'Login must be 3 to 32 letters, numbers, dots, underscores, or hyphens';
  end if;

  if length(coalesce(p_password, '')) < 5 then
    raise exception 'Password must be at least 5 characters';
  end if;

  intern_email := normalized_login || '@mana.internal';

  if exists (select 1 from auth.users where email = intern_email) then
    raise exception 'That login already exists';
  end if;

  manager := coalesce(p_manager_id, auth.uid());
  if not exists (
    select 1 from public.profiles
    where id = manager and role = 'admin'
  ) then
    raise exception 'Choose an admin account as the intern manager';
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
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
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
  set
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
    manager_id = manager
  where id = new_id;

  return new_id;
end;
$$;

create or replace function public.create_intern(
  p_login text,
  p_password text,
  p_full_name text,
  p_manager_id uuid
)
returns uuid
language sql
security invoker
set search_path = public
as $$
  select private.create_intern(p_login, p_password, p_full_name, p_manager_id);
$$;

revoke all on function public.create_intern(text, text, text, uuid) from public;
grant execute on function public.create_intern(text, text, text, uuid) to authenticated;
grant execute on function private.create_intern(text, text, text, uuid) to authenticated;

create or replace function private.create_login_user(
  p_login text,
  p_password text,
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
  normalized_login text;
  login_email text;
begin
  normalized_login := lower(trim(p_login));
  login_email := normalized_login || '@mana.internal';

  if exists (select 1 from auth.users where email = login_email) then
    update public.profiles
    set
      role = p_role,
      full_name = coalesce(nullif(trim(p_full_name), ''), full_name)
    where email = login_email;
    return (select id from public.profiles where email = login_email);
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
    login_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
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
    jsonb_build_object('sub', new_id::text, 'email', login_email, 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  );

  update public.profiles
  set
    role = p_role,
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name)
  where id = new_id;

  return new_id;
end;
$$;

select private.create_login_user('admin1', 'admin1', 'Admin 1', 'admin');
select private.create_login_user('admin2', 'admin2', 'Admin 2', 'admin');
select private.create_login_user('admin3', 'admin3', 'Admin 3', 'admin');

update public.profiles intern
set manager_id = manager.id
from public.profiles manager
where intern.email = 'intern1@mana.internal'
  and manager.email = 'admin1@mana.internal';

update public.profiles intern
set manager_id = manager.id
from public.profiles manager
where intern.email = 'intern2@mana.internal'
  and manager.email = 'admin2@mana.internal';

update public.profiles intern
set manager_id = manager.id
from public.profiles manager
where intern.email = 'intern3@mana.internal'
  and manager.email = 'admin3@mana.internal';
