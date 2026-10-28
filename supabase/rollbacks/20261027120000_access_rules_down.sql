-- Rollback for migrations/20261027120000_access_rules.sql.
-- Run only if migration 10 must be undone, and before the migration 9
-- rollback if both are needed. Paste and run the whole file in the Supabase
-- SQL editor.
--
-- This cannot bring back:
--   - Manager links removed because someone's role changed.
--   - Role changes themselves. Roles stay as the master set them.
--   - The em dashes in the three seeded module headings. They stay fixed.
--
-- After this runs, every manager can link any manager to any intern and send
-- modules to any intern, every signed-in user can read every staff profile,
-- every manager can edit every profile row again, and any master, including
-- the demo login, can change roles of others or their own. My modules then shows interns "No manager", because
-- public.my_managers is gone, and Remove on a staff Google account still
-- needs the Google master (that rule is in migration 9).

-- 6. Profile edits. From 20260921120000_init.sql.
drop policy if exists "profiles_update_own_or_managed" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update to authenticated
  using (id = auth.uid() or private.is_admin())
  with check (id = auth.uid() or private.is_admin());

-- 4. Roles
drop trigger if exists profiles_role_changed on public.profiles;
drop function if exists private.clean_links_after_role_change();

-- From 20261022130000_google_staff_allowlist.sql.
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

-- 3. What interns see of staff. From 20260921151000_intern_managers_and_invites.sql.
drop function if exists public.my_managers();
drop function if exists private.my_managers();

drop policy if exists "profiles_select_admins" on public.profiles;
create policy "profiles_select_admins"
  on public.profiles for select to authenticated
  using (role in ('admin', 'master'));

-- 2. Module assignments. From 20260921120000_init.sql.
drop policy if exists "assignments_insert_managed" on public.assignments;
create policy "assignments_insert_admin"
  on public.assignments for insert to authenticated
  with check (private.is_admin());

drop policy if exists "assignments_update_own_or_managed" on public.assignments;
create policy "assignments_update_own_or_admin"
  on public.assignments for update to authenticated
  using (intern_id = auth.uid() or private.is_admin())
  with check (intern_id = auth.uid() or private.is_admin());

drop policy if exists "assignments_delete_managed" on public.assignments;
create policy "assignments_delete_admin"
  on public.assignments for delete to authenticated
  using (private.is_admin());

-- 1. Manager links. From 20260921151000_intern_managers_and_invites.sql.
drop policy if exists intern_managers_insert on public.intern_managers;
create policy intern_managers_insert
  on public.intern_managers for insert to authenticated
  with check (private.is_admin());

drop policy if exists intern_managers_delete on public.intern_managers;
create policy intern_managers_delete
  on public.intern_managers for delete to authenticated
  using (private.is_admin() and (manager_id = auth.uid() or private.is_master()));

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
