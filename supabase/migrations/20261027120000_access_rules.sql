-- Access rules from the access review.
--  1. Manager links: an admin links and unlinks only themselves. Master links
--     and unlinks anyone.
--  2. Module assignments: only for interns the caller manages. Module content
--     stays editable by every manager.
--  3. Interns read only their own managers' name and email.
--  4. Roles: only a master signed in with Google changes roles, never their
--     own. Links that no longer fit the new role are removed.
--  5. Removes the em dashes the init migration seeded into module content.
--  6. Profile edits: everyone edits their own row, master edits any row, and
--     an admin edits only interns they manage.
-- Needs migrations 8 and 9 (can_manage_intern, is_google_master).

-- 1. Manager links -----------------------------------------------------------

-- No update policy exists on intern_managers, so rows can only be added or
-- removed, never edited.
drop policy if exists intern_managers_insert on public.intern_managers;
create policy intern_managers_insert
  on public.intern_managers for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      private.is_master()
      or (private.is_admin() and manager_id = auth.uid())
    )
  );

drop policy if exists intern_managers_delete on public.intern_managers;
create policy intern_managers_delete
  on public.intern_managers for delete to authenticated
  using (
    private.is_master()
    or (private.is_admin() and manager_id = auth.uid())
  );

-- create_intern links managers as the definer and skips the policy above, so
-- it applies the same rule: an admin can only add themselves.
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

  if not private.is_master() and exists (
    select 1
    from unnest(managers) as manager_id
    where manager_id is distinct from auth.uid()
  ) then
    raise exception 'Managers can only add themselves to a new intern';
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

-- 2. Module assignments ------------------------------------------------------

-- Reading stays as it was: interns their own, staff everyone's progress.
-- Sending, changing and removing need can_manage_intern: master for any
-- intern, an admin only for interns linked to them.
drop policy if exists "assignments_insert_admin" on public.assignments;
create policy "assignments_insert_managed"
  on public.assignments for insert to authenticated
  with check (private.can_manage_intern(intern_id));

drop policy if exists "assignments_update_own_or_admin" on public.assignments;
create policy "assignments_update_own_or_managed"
  on public.assignments for update to authenticated
  using (intern_id = auth.uid() or private.can_manage_intern(intern_id))
  with check (intern_id = auth.uid() or private.can_manage_intern(intern_id));

drop policy if exists "assignments_delete_admin" on public.assignments;
create policy "assignments_delete_managed"
  on public.assignments for delete to authenticated
  using (private.can_manage_intern(intern_id));

-- 3. What interns see of staff -----------------------------------------------

-- profiles_select_admins let every signed-in user read every staff row.
-- Staff keep full access through profiles_select_own_or_admin, and interns
-- now read only their own row.
drop policy if exists "profiles_select_admins" on public.profiles;

-- An intern's own managers, name and email only.
create or replace function private.my_managers()
returns table (full_name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name, p.email
  from public.intern_managers link
  join public.profiles p on p.id = link.manager_id
  where link.intern_id = auth.uid()
    and p.role in ('admin', 'master')
  order by lower(coalesce(p.full_name, p.email));
$$;

create or replace function public.my_managers()
returns table (full_name text, email text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.my_managers();
$$;

-- 4. Roles --------------------------------------------------------------------

-- Changes made in the SQL editor (no auth.uid()) are not checked.
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

  if new.role is distinct from old.role then
    if not private.is_master() then
      raise exception 'Only the master admin can change roles';
    end if;

    if new.id = auth.uid() then
      raise exception 'You cannot change your own role';
    end if;

    if not private.is_google_master() then
      raise exception 'Only a master signed in with Google can change roles';
    end if;
  end if;

  if new.email is distinct from old.email then
    raise exception 'Emails cannot be changed here';
  end if;

  return new;
end;
$$;

-- After a role change, drop manager links that no longer fit. An intern who
-- becomes staff loses their own managers. Staff who become an intern stop
-- managing anyone. Assignments, schedules and time logs are kept.
create or replace function private.clean_links_after_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'intern' and new.role <> 'intern' then
    delete from public.intern_managers where intern_id = new.id;
  end if;

  if old.role <> 'intern' and new.role = 'intern' then
    delete from public.intern_managers where manager_id = new.id;
  end if;

  return null;
end;
$$;

drop trigger if exists profiles_role_changed on public.profiles;
create trigger profiles_role_changed
  after update of role on public.profiles
  for each row
  when (old.role is distinct from new.role)
  execute function private.clean_links_after_role_change();

-- 5. Seeded module content ---------------------------------------------------

-- The init migration seeded three headings with an em dash (chr(8212)).
-- Only those exact headings change, and only while still present, so module
-- text that managers edited stays as it is. Preview with
-- supabase/checks/preview_em_dash_fix.sql.
update public.modules
set content = replace(content, '# Email ' || chr(8212) || ' Iterable CMS', '# Email: Iterable CMS')
where slug = 'iterable-cms'
  and position('# Email ' || chr(8212) || ' Iterable CMS' in content) > 0;

update public.modules
set content = replace(
  content,
  '# Automations ' || chr(8212) || ' Zapier and Monday.com',
  '# Automations: Zapier and Monday.com'
)
where slug = 'automations-zapier-monday'
  and position('# Automations ' || chr(8212) || ' Zapier and Monday.com' in content) > 0;

update public.modules
set content = replace(
  content,
  '# Task Management ' || chr(8212) || ' Monday.com',
  '# Task Management: Monday.com'
)
where slug = 'monday-task-management'
  and position('# Task Management ' || chr(8212) || ' Monday.com' in content) > 0;

-- 6. Profile edits -----------------------------------------------------------

-- profiles_update_own_or_admin let every admin edit every profile, including
-- other admins, the master, and interns outside their team. Now an admin
-- edits only their own row and interns they manage. protect_profile_role
-- still decides role and email changes on top of this.
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
drop policy if exists "profiles_update_own_or_managed" on public.profiles;
create policy "profiles_update_own_or_managed"
  on public.profiles for update to authenticated
  using (id = auth.uid() or private.is_master() or private.can_manage_intern(id))
  with check (id = auth.uid() or private.is_master() or private.can_manage_intern(id));

-- Grants ----------------------------------------------------------------------

revoke all on function private.my_managers() from public, anon;
revoke all on function public.my_managers() from public, anon;
grant execute on function private.my_managers() to authenticated;
grant execute on function public.my_managers() to authenticated;

revoke all on function private.clean_links_after_role_change() from public, anon, authenticated;
