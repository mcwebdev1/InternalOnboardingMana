-- Optional read-only checks for 20261022130000_google_staff_allowlist.sql.
-- Run in the Supabase SQL editor after the migration. It changes nothing and
-- raises an error naming the first check that fails. Success prints
-- "google allowlist checks passed".

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
  raise notice 'google allowlist checks passed';
end;
$$;
