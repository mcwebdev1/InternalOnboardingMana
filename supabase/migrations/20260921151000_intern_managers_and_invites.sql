create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'master')
  );
$$;

create or replace function private.is_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'master'
  );
$$;

revoke all on function private.is_master() from public;
grant execute on function private.is_master() to authenticated;

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

create table if not exists public.intern_managers (
  intern_id uuid not null references public.profiles (id) on delete cascade,
  manager_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  primary key (intern_id, manager_id)
);

create index if not exists intern_managers_manager_id_idx
  on public.intern_managers (manager_id);

insert into public.intern_managers (intern_id, manager_id)
select intern.id, intern.manager_id
from public.profiles intern
where intern.role = 'intern'
  and intern.manager_id is not null
on conflict do nothing;

drop trigger if exists profiles_validate_manager on public.profiles;
drop function if exists private.validate_intern_manager();

alter table public.profiles drop column if exists manager_id;

create unique index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));

create or replace function private.validate_intern_manager_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.intern_id = new.manager_id then
    raise exception 'An intern cannot be their own manager';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = new.intern_id and role = 'intern'
  ) then
    raise exception 'Managers can only be assigned to intern accounts';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = new.manager_id and role in ('admin', 'master')
  ) then
    raise exception 'Manager must be a manager or master account';
  end if;

  return new;
end;
$$;

drop trigger if exists intern_managers_validate on public.intern_managers;
create trigger intern_managers_validate
  before insert or update on public.intern_managers
  for each row execute function private.validate_intern_manager_row();

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

alter table public.intern_managers enable row level security;

drop policy if exists intern_managers_select on public.intern_managers;
create policy intern_managers_select
  on public.intern_managers for select to authenticated
  using (intern_id = auth.uid() or private.is_admin());

drop policy if exists intern_managers_insert on public.intern_managers;
create policy intern_managers_insert
  on public.intern_managers for insert to authenticated
  with check (private.is_admin());

drop policy if exists intern_managers_delete on public.intern_managers;
create policy intern_managers_delete
  on public.intern_managers for delete to authenticated
  using (private.is_admin() and (manager_id = auth.uid() or private.is_master()));

drop policy if exists "profiles_select_admins" on public.profiles;
create policy "profiles_select_admins"
  on public.profiles for select to authenticated
  using (role in ('admin', 'master'));

create or replace function private.normalize_login_email(p_email text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  value text;
begin
  value := lower(trim(coalesce(p_email, '')));
  if value = '' then
    raise exception 'Email is required';
  end if;

  if position('@' in value) = 0 then
    value := value || '@mana.internal';
  end if;

  if value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email';
  end if;

  return value;
end;
$$;

create or replace function private.random_pin()
returns text
language sql
volatile
as $$
  select lpad(floor(random() * 1000000)::int::text, 6, '0');
$$;

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

drop function if exists public.create_intern(text, text, text, uuid);
drop function if exists private.create_intern(text, text, text, uuid);
drop function if exists public.create_intern(text, text, text);
drop function if exists private.create_intern(text, text, text);

create or replace function private.create_intern(
  p_email text,
  p_full_name text,
  p_manager_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  intern_email text;
  pin text := private.random_pin();
  managers uuid[] := coalesce(p_manager_ids, array[]::uuid[]);
begin
  if not private.is_admin() then
    raise exception 'Only managers can create intern accounts';
  end if;

  intern_email := private.normalize_login_email(p_email);

  if exists (
    select 1
    from unnest(managers) as manager_id
    where not exists (
      select 1 from public.profiles
      where id = manager_id and role in ('admin', 'master')
    )
  ) then
    raise exception 'Every selected manager must be a manager or master account';
  end if;

  new_id := private.create_invited_user(intern_email, pin, p_full_name, 'intern');

  insert into public.intern_managers (intern_id, manager_id, created_by)
  select distinct new_id, manager_id, auth.uid()
  from unnest(managers) as manager_id
  where manager_id is not null;

  return jsonb_build_object(
    'id', new_id,
    'email', intern_email,
    'pin', pin
  );
end;
$$;

create or replace function public.create_intern(
  p_email text,
  p_full_name text,
  p_manager_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select private.create_intern(p_email, p_full_name, p_manager_ids);
$$;

revoke all on function public.create_intern(text, text, uuid[]) from public;
grant execute on function public.create_intern(text, text, uuid[]) to authenticated;
grant execute on function private.create_intern(text, text, uuid[]) to authenticated;

create or replace function private.create_manager(
  p_email text,
  p_full_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  manager_email text;
  pin text := private.random_pin();
begin
  if not private.is_master() then
    raise exception 'Only the master admin can invite managers';
  end if;

  manager_email := private.normalize_login_email(p_email);
  new_id := private.create_invited_user(manager_email, pin, p_full_name, 'admin');

  return jsonb_build_object(
    'id', new_id,
    'email', manager_email,
    'pin', pin
  );
end;
$$;

create or replace function public.create_manager(
  p_email text,
  p_full_name text
)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select private.create_manager(p_email, p_full_name);
$$;

revoke all on function public.create_manager(text, text) from public;
grant execute on function public.create_manager(text, text) to authenticated;
grant execute on function private.create_manager(text, text) to authenticated;

update public.profiles
set role = 'master'
where email = 'admin@mana.internal';
