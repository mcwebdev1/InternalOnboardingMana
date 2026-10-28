-- Google sign in for Mana staff only.
-- The allowlist below is the only source of staff roles for Google accounts.
-- Every other account is created by invite (create_intern, create_manager)
-- or by the demo seed, and keeps using email and PIN or password.

create table private.staff_allowlist (
  email text primary key check (email = lower(trim(email))),
  role public.user_role not null check (role in ('admin', 'master')),
  created_at timestamptz not null default now(),
  -- Set when a master removes the account, so the person cannot sign back
  -- in with Google and be recreated. Clear it by hand to restore access.
  revoked_at timestamptz,
  revoked_by uuid
);

revoke all on private.staff_allowlist from public, anon, authenticated;
-- No policies, so only the definer functions below can read it.
alter table private.staff_allowlist enable row level security;

insert into private.staff_allowlist (email, role) values
  ('webdev@manacommon.com', 'master'),
  ('vlad@manacommon.com', 'admin'),
  ('marie@manacommon.com', 'admin'),
  ('atari@manacommon.com', 'admin'),
  ('miguel@manacommon.com', 'admin');

-- Stop here if a password or PIN account already uses an allowlisted email.
-- Someone holding that PIN would otherwise share the account Google links to.
do $$
declare
  conflicts text;
begin
  select string_agg(u.email, ', ')
  into conflicts
  from auth.users u
  join private.staff_allowlist a on a.email = lower(u.email)
  where coalesce(u.raw_app_meta_data ->> 'provider', '') <> 'google';

  if conflicts is not null then
    raise exception 'Remove or rename these non-Google accounts before applying: %', conflicts;
  end if;
end;
$$;

-- Role for a sign in, or null for no access. Only a verified Google email
-- that is on the allowlist and not revoked gets a role.
create or replace function private.google_staff_role(
  p_provider text,
  p_email text,
  p_email_verified boolean
)
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select a.role
  from private.staff_allowlist a
  where p_provider = 'google'
    and coalesce(p_email_verified, false)
    and a.email = lower(trim(coalesce(p_email, '')))
    and a.revoked_at is null;
$$;

-- True for any allowlisted email, revoked or not. These addresses never get
-- a PIN account, and guard_auth_password_change below refuses any password
-- set on them later.
create or replace function private.is_reserved_staff_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.staff_allowlist a
    where a.email = lower(trim(coalesce(p_email, '')))
  );
$$;

-- Google signs up through GoTrue, which inserts auth.users with
-- raw_app_meta_data.provider = 'google' and the Google claims in
-- raw_user_meta_data, then confirms the email in a later update.
-- Email accounts must carry onboarding_role, which only the invite and demo
-- functions set. That closes public sign up and the first-user-is-master
-- fallback, which nothing relies on: the demo master was set by email.
-- email_verified comes from the Google claims, or from the Google identity if
-- one already exists. If neither carries it, the allowlist still decides here
-- and guard_google_identity refuses the identity unless Google verified the
-- email, which fails the whole sign up.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider text := coalesce(new.raw_app_meta_data ->> 'provider', '');
  requested_role text := coalesce(new.raw_app_meta_data ->> 'onboarding_role', '');
  assigned_role public.user_role;
  verified text;
begin
  if provider = 'google' then
    verified := coalesce(
      lower(new.raw_user_meta_data ->> 'email_verified'),
      (
        select lower(i.identity_data ->> 'email_verified')
        from auth.identities i
        where i.user_id = new.id
          and i.provider = 'google'
        order by i.created_at
        limit 1
      ),
      'true'
    );
    assigned_role := private.google_staff_role(provider, new.email, verified = 'true');
    if assigned_role is null then
      raise exception 'This Google account does not have access to Mana Onboarding';
    end if;
  elsif provider = 'email' and requested_role in ('admin', 'master', 'intern') then
    if private.is_reserved_staff_email(new.email) then
      raise exception 'That email signs in with Google only';
    end if;
    assigned_role := requested_role::public.user_role;
  else
    raise exception 'Accounts are created by invite only';
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

-- Every Google identity is checked when it is created or refreshed. This
-- covers GoTrue linking Google to an existing account with the same email,
-- such as an invited intern, which never inserts into auth.users. It also
-- re-checks on every later Google sign in, so a revoked address stops working.
-- It never changes the profile role. The allowlist sets the starting role in
-- handle_new_user, and after that only a master changes roles.
create or replace function private.guard_google_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed_role public.user_role;
  identity_email text := lower(trim(coalesce(new.identity_data ->> 'email', '')));
begin
  if new.provider = 'email' then
    return new;
  end if;

  if new.provider <> 'google' then
    raise exception 'Only Google sign in is enabled';
  end if;

  allowed_role := private.google_staff_role(
    new.provider,
    identity_email,
    lower(coalesce(new.identity_data ->> 'email_verified', '')) = 'true'
  );
  if allowed_role is null then
    raise exception 'This Google account does not have access to Mana Onboarding';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = new.user_id
      and lower(p.email) = identity_email
  ) then
    raise exception 'This Google account does not match its Mana Onboarding profile';
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_identity_saved on auth.identities;
create trigger on_auth_identity_saved
  before insert or update on auth.identities
  for each row execute function private.guard_google_identity();

-- No account can move its auth email onto a staff address, either directly
-- or as a pending email change. Otherwise Google would later link the real
-- staff member to that account and the guard above would lock them out. This
-- covers Google accounts too, so one staff member cannot take another's
-- address. The only exemption is a Google account moving onto the email of
-- its own Google identity.
create or replace function private.guard_auth_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(trim(coalesce(new.email, ''))) is distinct from lower(trim(coalesce(old.email, '')))
     and private.is_reserved_staff_email(new.email)
     and not exists (
       select 1 from auth.identities i
       where i.user_id = new.id
         and i.provider = 'google'
         and lower(trim(coalesce(i.identity_data ->> 'email', ''))) = lower(trim(coalesce(new.email, '')))
     ) then
    raise exception 'That email signs in with Google only';
  end if;

  if lower(trim(coalesce(new.email_change, ''))) is distinct from lower(trim(coalesce(old.email_change, '')))
     and private.is_reserved_staff_email(new.email_change)
     and not exists (
       select 1 from auth.identities i
       where i.user_id = new.id
         and i.provider = 'google'
         and lower(trim(coalesce(i.identity_data ->> 'email', ''))) = lower(trim(coalesce(new.email_change, '')))
     ) then
    raise exception 'That email signs in with Google only';
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_change on auth.users;
create trigger on_auth_user_email_change
  before update of email, email_change on auth.users
  for each row execute function private.guard_auth_email_change();

-- Staff accounts sign in with Google only. Setting or changing a password on
-- an allowlisted address, or on any account with a Google identity, is
-- refused, so a staff session cannot add a password login that outlives their
-- Google account. Inserts are not checked: new accounts are covered by
-- handle_new_user and create_invited_user.
create or replace function private.guard_auth_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_reserved_staff_email(old.email)
     or exists (
       select 1 from auth.identities i
       where i.user_id = new.id and i.provider = 'google'
     ) then
    raise exception 'Staff accounts sign in with Google only and cannot have a password';
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_password_change on auth.users;
create trigger on_auth_user_password_change
  before update of encrypted_password on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password)
  execute function private.guard_auth_password_change();

-- True when the caller is a master who signed in with Google: their profile
-- role is master and they hold a verified, allowlisted, not revoked Google
-- identity for their own profile email. The demo master password login never
-- counts. Revoking a staff Google account and changing roles need this.
create or replace function private.is_google_master()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join auth.identities i
      on i.user_id = p.id
     and i.provider = 'google'
    where p.id = auth.uid()
      and p.role = 'master'
      and lower(p.email) = lower(trim(coalesce(i.identity_data ->> 'email', '')))
      and private.google_staff_role(
        'google',
        i.identity_data ->> 'email',
        lower(coalesce(i.identity_data ->> 'email_verified', '')) = 'true'
      ) is not null
  );
$$;

-- Profile emails mirror auth emails and the allowlist matches on them, so
-- nobody changes one through the API.
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

  if new.email is distinct from old.email then
    raise exception 'Emails cannot be changed here';
  end if;

  return new;
end;
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

  if private.is_reserved_staff_email(intern_email) then
    raise exception 'That email signs in with Google only and cannot get a PIN';
  end if;

  if length(coalesce(p_pin, '')) <> 6 or p_pin !~ '^[0-9]{6}$' then
    raise exception 'PIN must be 6 digits';
  end if;

  if exists (select 1 from auth.users where lower(email) = intern_email) then
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

-- A regular admin removes only interns on their team. Master removes any intern.
create or replace function private.delete_intern(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not private.is_admin() then
    raise exception 'Only managers can remove intern accounts';
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

  if not private.is_master() and not exists (
    select 1 from public.intern_managers
    where intern_id = p_user_id and manager_id = auth.uid()
  ) then
    raise exception 'You can only remove interns on your team';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

-- Master removes a manager. Never a master, never the caller, never one of
-- the four demo logins. An allowlisted manager can only be removed by the
-- Google master, and is revoked first so Google cannot recreate the account
-- on their next sign in.
create or replace function private.delete_manager(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles;
begin
  if not private.is_master() then
    raise exception 'Only the master admin can remove managers';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot remove your own account';
  end if;

  select * into target from public.profiles where id = p_user_id;

  if not found or target.role <> 'admin' then
    raise exception 'Only manager accounts can be removed';
  end if;

  if lower(target.email) in (
    'admin@mana.internal',
    'admin1@mana.internal',
    'admin2@mana.internal',
    'admin3@mana.internal'
  ) then
    raise exception 'Demo accounts cannot be removed';
  end if;

  -- Revoking a staff Google account cannot be undone in the app, so only the
  -- Google master may do it, never the demo master password login.
  if private.is_reserved_staff_email(target.email) and not private.is_google_master() then
    raise exception 'Only the Google master can remove a staff Google account';
  end if;

  update private.staff_allowlist
  set revoked_at = now(), revoked_by = auth.uid()
  where email = lower(target.email)
    and revoked_at is null;

  delete from auth.users where id = p_user_id;
end;
$$;

create or replace function public.delete_manager(p_user_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.delete_manager(p_user_id);
$$;

-- What the auth callback needs to confirm a Google session: the caller's own
-- Google identity, its allowlist role, and their profile. Null when the
-- caller has no Google identity.
create or replace function private.google_access_facts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'google_email', i.identity_data ->> 'email',
    'email_verified', lower(coalesce(i.identity_data ->> 'email_verified', '')) = 'true',
    'allowlist_role', private.google_staff_role(
      'google',
      i.identity_data ->> 'email',
      lower(coalesce(i.identity_data ->> 'email_verified', '')) = 'true'
    ),
    'profile_role', p.role,
    'profile_email', p.email
  )
  from auth.identities i
  left join public.profiles p on p.id = i.user_id
  where i.user_id = auth.uid()
    and i.provider = 'google'
  order by i.created_at
  limit 1;
$$;

create or replace function public.google_access_facts()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.google_access_facts();
$$;

-- One time only: bring any Google profile created before this migration in
-- line with the allowlist. Sign ins never sync roles after this. Accounts not
-- on the allowlist are removed below.
update public.profiles p
set role = a.role
from auth.identities i
join private.staff_allowlist a
  on a.email = lower(i.identity_data ->> 'email')
where i.user_id = p.id
  and i.provider = 'google'
  and lower(p.email) = a.email
  and p.role is distinct from a.role;

-- Remove Google accounts made before this migration that are not on the
-- allowlist. Refreshing a token never touches auth.identities, so their
-- sessions would otherwise keep working. Only accounts whose every identity is
-- Google are touched. Anyone with an email (PIN or password) identity, or
-- whose auth or Google email is allowlisted, is left alone.
delete from auth.users u
where exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'google'
  )
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider <> 'google'
  )
  and not private.is_reserved_staff_email(u.email)
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id
      and i.provider = 'google'
      and private.is_reserved_staff_email(i.identity_data ->> 'email')
  );

revoke all on function private.google_staff_role(text, text, boolean) from public;
revoke all on function private.is_reserved_staff_email(text) from public;
revoke all on function private.is_google_master() from public, anon, authenticated;
revoke all on function private.delete_manager(uuid) from public;
revoke all on function private.google_access_facts() from public;
revoke all on function public.delete_manager(uuid) from public, anon;
revoke all on function public.google_access_facts() from public, anon;
revoke all on function private.create_invited_user(text, text, text, public.user_role)
  from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.guard_google_identity() from public, anon, authenticated;
revoke all on function private.guard_auth_email_change() from public, anon, authenticated;
revoke all on function private.guard_auth_password_change() from public, anon, authenticated;

grant execute on function private.delete_manager(uuid) to authenticated;
grant execute on function private.google_access_facts() to authenticated;
grant execute on function public.delete_manager(uuid) to authenticated;
grant execute on function public.google_access_facts() to authenticated;
