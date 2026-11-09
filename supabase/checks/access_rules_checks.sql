-- Optional checks for 20261027120000_access_rules.sql.
-- Run in the Supabase SQL editor after migration 10. It changes nothing and
-- raises an error naming the first check that fails. Success prints
-- "access rules checks passed" and then "profile edit checks passed". The
-- profile edit checks try real updates as the demo managers inside a
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
  -- 1. Manager links
  assert exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'intern_managers'
      and policyname = 'intern_managers_insert'
      and position('manager_id = auth.uid()' in with_check) > 0
  ), 'intern_managers insert lets an admin add only themselves';
  assert exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'intern_managers'
      and policyname = 'intern_managers_delete'
      and position('manager_id = auth.uid()' in qual) > 0
  ), 'intern_managers delete lets an admin remove only themselves';
  assert not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'intern_managers' and cmd = 'UPDATE'
  ), 'intern_managers rows cannot be updated';
  assert position('only add themselves' in pg_get_functiondef('private.create_intern(text, text, uuid[])'::regprocedure)) > 0,
    'create_intern lets an admin add only themselves';

  -- 2. Module assignments
  assert not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'assignments'
      and policyname in ('assignments_insert_admin', 'assignments_update_own_or_admin', 'assignments_delete_admin')
  ), 'old assignment write policies are gone';
  assert (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'assignments'
      and policyname in ('assignments_insert_managed', 'assignments_update_own_or_managed', 'assignments_delete_managed')
      and position('can_manage_intern' in coalesce(qual, '') || coalesce(with_check, '')) > 0
  ) = 3, 'assignment writes need can_manage_intern';
  assert exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'modules' and policyname = 'modules_update_admin'
  ), 'managers can still edit module content';

  -- 3. What interns see of staff
  assert not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_admins'
  ), 'profiles_select_admins is gone';
  assert exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own_or_admin'
  ), 'staff still read every profile';
  assert has_function_privilege('authenticated', 'public.my_managers()', 'execute'),
    'signed-in users can run my_managers';
  assert not has_function_privilege('anon', 'public.my_managers()', 'execute'),
    'anon cannot run my_managers';
  assert (
    select pg_get_function_result('public.my_managers()'::regprocedure)
  ) = 'TABLE(full_name text, email text)', 'my_managers returns only name and email';

  -- 4. Roles
  assert position('is_google_master' in pg_get_functiondef('private.protect_profile_role()'::regprocedure)) > 0,
    'role changes need a Google master';
  assert position('your own role' in pg_get_functiondef('private.protect_profile_role()'::regprocedure)) > 0,
    'a master cannot change their own role';
  assert exists (
    select 1 from pg_trigger
    where tgname = 'profiles_role_changed' and tgrelid = 'public.profiles'::regclass
  ), 'role change trigger exists';
  assert not has_function_privilege('authenticated', 'private.clean_links_after_role_change()', 'execute'),
    'signed-in users cannot run clean_links_after_role_change';
  assert not exists (
    select 1 from public.intern_managers link
    join public.profiles intern on intern.id = link.intern_id
    join public.profiles manager on manager.id = link.manager_id
    where intern.role <> 'intern' or manager.role not in ('admin', 'master')
  ), 'every manager link joins an intern to a staff account';

  -- 5. Seeded module content
  assert not exists (
    select 1 from public.modules
    where slug in ('iterable-cms', 'automations-zapier-monday', 'monday-task-management')
      and position(chr(8212) in content) > 0
      and (
        position('# Email ' || chr(8212) || ' Iterable CMS' in content) > 0
        or position('# Automations ' || chr(8212) || ' Zapier and Monday.com' in content) > 0
        or position('# Task Management ' || chr(8212) || ' Monday.com' in content) > 0
      )
  ), 'seeded headings have no em dash';

  -- 6. Profile edits
  assert not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'profiles_update_own_or_admin'
  ), 'profiles_update_own_or_admin is gone';
  assert exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'profiles_update_own_or_managed'
      and position('can_manage_intern' in qual) > 0
      and position('can_manage_intern' in with_check) > 0
  ), 'profile edits need own row, master, or can_manage_intern';

  insert into check_results (check_name, result)
  values ('access rules checks', 'PASSED');
  raise notice 'access rules checks passed';
end;
$$;

-- (d) Profile edits as a signed-in manager. Uses the demo logins: admin1
-- manages intern1, admin2 is another manager, admin is the master. Skips with
-- a notice if any of them is missing. Every update runs as the authenticated
-- role inside the inner block, which always ends by raising MC001. That rolls
-- the block back, including the role switch, so nothing is kept.
do $$
declare
  admin1_id uuid;
  admin2_id uuid;
  master_id uuid;
  managed_intern_id uuid;
  other_intern_id uuid;
  changed int;
begin
  select id into admin1_id from public.profiles
  where email = 'admin1@mana.internal' and role = 'admin';
  select id into admin2_id from public.profiles
  where email = 'admin2@mana.internal' and role = 'admin';
  select id into master_id from public.profiles
  where email = 'admin@mana.internal' and role = 'master';
  select id into managed_intern_id from public.profiles
  where email = 'intern1@mana.internal' and role = 'intern';
  select p.id into other_intern_id from public.profiles p
  where p.email = 'intern2@mana.internal' and p.role = 'intern'
    and not exists (
      select 1 from public.intern_managers link
      where link.intern_id = p.id and link.manager_id = admin1_id
    );

  if admin1_id is null or admin2_id is null or master_id is null
     or managed_intern_id is null or other_intern_id is null
     or not exists (
       select 1 from public.intern_managers link
       where link.intern_id = managed_intern_id and link.manager_id = admin1_id
     ) then
    insert into check_results (check_name, result)
    values ('profile edit checks d', 'SKIPPED: demo logins missing, or intern1 and intern2 not linked as expected');
    raise notice 'Skipped profile edit checks (d): the demo logins admin, admin1, admin2, intern1 and intern2 are not all present, intern1 is not linked to admin1, or intern2 is.';
    return;
  end if;

  begin
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', admin1_id, 'role', 'authenticated')::text,
      true
    );
    set local role authenticated;

    update public.profiles set full_name = 'Profile edit check' where id = admin2_id;
    get diagnostics changed = row_count;
    assert changed = 0, '(d) a manager must not edit another manager''s name';

    update public.profiles set full_name = 'Profile edit check' where id = master_id;
    get diagnostics changed = row_count;
    assert changed = 0, '(d) a manager must not edit the master''s name';

    update public.profiles set full_name = 'Profile edit check' where id = other_intern_id;
    get diagnostics changed = row_count;
    assert changed = 0, '(d) a manager must not edit an intern outside their team';

    update public.profiles set full_name = 'Profile edit check' where id = managed_intern_id;
    get diagnostics changed = row_count;
    assert changed = 1, '(d) a manager must be able to edit a managed intern''s name';

    raise exception 'undo profile edit checks' using errcode = 'MC001';
  exception when sqlstate 'MC001' then
    null;
  end;

  -- Outside the rolled back block above, so this row is kept. The role is
  -- back to the one that created check_results.
  insert into check_results (check_name, result)
  values ('profile edit checks d', 'PASSED');
  raise notice 'profile edit checks passed';
end;
$$;

select check_name, result from check_results order by seq;

