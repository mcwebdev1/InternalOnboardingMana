-- Optional checks for 20261022130000_google_staff_allowlist.sql.
-- Run in the Supabase SQL editor after the migration. It changes nothing and
-- raises an error naming the first check that fails. Success prints
-- "google allowlist checks passed" and then "google allowlist behavior checks
-- passed". The behavior checks try real updates on auth.users inside a
-- subtransaction that is always rolled back, so nothing is kept. The results
-- are also listed as rows at the end.

-- Results land in this table so the SQL editor shows them even when it
-- hides notices. The last statement in this file lists them.
drop table if exists pg_temp.check_results;
create temporary table check_results (
  seq integer generated always as identity,
  check_name text not null,
  result text not null
);

do $$
begin
  assert private.google_staff_role('google', 'webdev@manacommon.com', true) = 'master',
    'webdev is master';
  assert private.google_staff_role('google', 'vlad@manacommon.com', true) = 'admin',
    'vlad is admin';
  assert private.google_staff_role('google', '  Marie@ManaCommon.COM ', true) = 'admin',
    'case and spaces are ignored';
  assert private.google_staff_role('google', 'someone@gmail.com', true) is null,
    'unknown email gets no role';
  assert private.google_staff_role('google', 'vlad@manacommon.com', false) is null,
    'unverified email gets no role';
  assert private.google_staff_role('google', 'vlad@manacommon.com', null) is null,
    'missing verification gets no role';
  assert private.google_staff_role('email', 'vlad@manacommon.com', true) is null,
    'email provider never gets a staff role';
  assert private.google_staff_role('github', 'vlad@manacommon.com', true) is null,
    'other providers never get a staff role';
  assert private.is_reserved_staff_email('ATARI@manacommon.com'),
    'allowlisted email is reserved';
  assert not private.is_reserved_staff_email('intern1@mana.internal'),
    'demo email is not reserved';
  assert exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_identity_saved' and tgrelid = 'auth.identities'::regclass
  ), 'identity trigger exists';
  assert exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass
  ), 'auth user trigger exists';
  assert exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_email_change' and tgrelid = 'auth.users'::regclass
  ), 'auth email change trigger exists';
  assert exists (
    select 1 from pg_trigger
    where tgname = 'on_auth_user_password_change' and tgrelid = 'auth.users'::regclass
  ), 'auth password change trigger exists';
  assert not has_table_privilege('authenticated', 'private.staff_allowlist', 'select'),
    'signed-in users cannot read the allowlist';
  assert (select relrowsecurity from pg_class where oid = 'private.staff_allowlist'::regclass),
    'allowlist has row level security on';

  -- Functions nobody calls through the API.
  assert not has_function_privilege('authenticated',
    'private.create_invited_user(text, text, text, public.user_role)', 'execute'),
    'signed-in users cannot run create_invited_user';
  assert not has_function_privilege('anon',
    'private.create_invited_user(text, text, text, public.user_role)', 'execute'),
    'anon cannot run create_invited_user';
  assert not has_function_privilege('authenticated', 'private.handle_new_user()', 'execute'),
    'signed-in users cannot run handle_new_user';
  assert not has_function_privilege('authenticated', 'private.guard_google_identity()', 'execute'),
    'signed-in users cannot run guard_google_identity';
  assert not has_function_privilege('authenticated', 'private.guard_auth_email_change()', 'execute'),
    'signed-in users cannot run guard_auth_email_change';
  assert not has_function_privilege('authenticated', 'private.guard_auth_password_change()', 'execute'),
    'signed-in users cannot run guard_auth_password_change';
  assert not has_function_privilege('authenticated', 'private.is_google_master()', 'execute'),
    'signed-in users cannot run is_google_master directly';

  -- Sign ins never change roles. The allowlist only sets the starting role.
  assert position('update public.profiles' in pg_get_functiondef('private.guard_google_identity()'::regprocedure)) = 0,
    'guard_google_identity does not sync roles';
  assert position('is_google_master' in pg_get_functiondef('private.delete_manager(uuid)'::regprocedure)) > 0,
    'delete_manager uses is_google_master';

  -- The new functions run with an empty search_path.
  assert not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname, p.proname) in (
        ('private', 'google_staff_role'),
        ('private', 'is_reserved_staff_email'),
        ('private', 'guard_google_identity'),
        ('private', 'guard_auth_email_change'),
        ('private', 'guard_auth_password_change'),
        ('private', 'is_google_master'),
        ('private', 'delete_manager'),
        ('public', 'delete_manager'),
        ('private', 'google_access_facts'),
        ('public', 'google_access_facts')
      )
      and not ('search_path=""' = any(coalesce(p.proconfig, array[]::text[])))
  ), 'new functions use an empty search_path';

  -- delete_manager protects only the four demo logins and needs the Google
  -- master to revoke a staff address.
  assert position('%@mana.internal' in pg_get_functiondef('private.delete_manager(uuid)'::regprocedure)) = 0,
    'delete_manager no longer protects every mana.internal address';
  assert position('Only the Google master' in pg_get_functiondef('private.delete_manager(uuid)'::regprocedure)) > 0,
    'delete_manager requires the Google master for staff addresses';

  -- No Google-only account outside the allowlist is left over.
  assert not exists (
    select 1 from auth.users u
    where exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google')
      and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider <> 'google')
      and not private.is_reserved_staff_email(u.email)
  ), 'no Google-only account outside the allowlist';

  -- No PIN or password account holds a staff address, now or as a pending change.
  assert not exists (
    select 1 from auth.users u
    where not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google')
      and (private.is_reserved_staff_email(u.email) or private.is_reserved_staff_email(u.email_change))
  ), 'no non-Google account uses a staff address';
  insert into check_results (check_name, result)
  values ('google allowlist checks', 'PASSED');
  raise notice 'google allowlist checks passed';
end;
$$;

-- Behavior checks on auth.users. They need one staff member who has already
-- signed in with Google, and skip with a notice until then. Every update runs
-- inside the inner block, which always ends by raising MC001. That rolls the
-- block back, so the changes are never kept. A failed check raises a
-- different error and stops the file instead.
do $$
declare
  staff_id uuid;
  staff_google_email text;
  other_staff_email text;
  temp_email text := 'allowlist-check-' || gen_random_uuid()::text || '@example.invalid';
  err text;
begin
  select u.id, lower(trim(i.identity_data ->> 'email'))
  into staff_id, staff_google_email
  from auth.users u
  join auth.identities i on i.user_id = u.id and i.provider = 'google'
  where private.is_reserved_staff_email(i.identity_data ->> 'email')
    and lower(u.email) = lower(trim(i.identity_data ->> 'email'))
  order by u.created_at
  limit 1;

  if staff_id is null then
    insert into check_results (check_name, result)
    values ('behavior checks a, b, c', 'SKIPPED: no staff member has signed in with Google yet');
    raise notice 'Skipped behavior checks (a), (b) and (c): no staff member has signed in with Google yet. Run this file again after the first Google sign in.';
    return;
  end if;

  select a.email
  into other_staff_email
  from private.staff_allowlist a
  where a.email <> staff_google_email
  order by a.email
  limit 1;

  begin
    -- (a) A staff Google account cannot get a password.
    err := null;
    begin
      update auth.users
      set encrypted_password = extensions.crypt('allowlist-check', extensions.gen_salt('bf'))
      where id = staff_id;
    exception when others then
      err := sqlerrm;
    end;
    assert coalesce(err, '') like '%cannot have a password%',
      format('(a) setting a password on %s must fail, got: %s', staff_google_email, coalesce(err, 'no error'));

    -- (b) A staff Google account cannot move onto another staff address,
    -- directly or as a pending email change.
    err := null;
    begin
      update auth.users set email = other_staff_email where id = staff_id;
    exception when others then
      err := sqlerrm;
    end;
    assert coalesce(err, '') like '%signs in with Google only%',
      format('(b) changing %s to %s must fail, got: %s', staff_google_email, other_staff_email, coalesce(err, 'no error'));

    err := null;
    begin
      update auth.users set email_change = other_staff_email where id = staff_id;
    exception when others then
      err := sqlerrm;
    end;
    assert coalesce(err, '') like '%signs in with Google only%',
      format('(b) a pending change from %s to %s must fail, got: %s', staff_google_email, other_staff_email, coalesce(err, 'no error'));

    -- (c) A Google account may move back onto its own Google email.
    err := null;
    begin
      update auth.users set email = temp_email where id = staff_id;
      update auth.users set email = staff_google_email where id = staff_id;
    exception when others then
      err := sqlerrm;
    end;
    assert err is null,
      format('(c) changing %s back to its own Google email must work, got: %s', staff_google_email, err);

    raise exception 'undo behavior checks' using errcode = 'MC001';
  exception when sqlstate 'MC001' then
    null;
  end;

  -- Outside the rolled back block above, so this row is kept.
  insert into check_results (check_name, result)
  values ('behavior checks a, b, c', 'PASSED for ' || staff_google_email);
  raise notice 'google allowlist behavior checks passed for %', staff_google_email;
end;
$$;

select check_name, result from check_results order by seq;

