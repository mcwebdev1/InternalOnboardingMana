create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role public.user_role := 'intern';
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
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

create or replace function private.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not private.is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function private.protect_profile_role();

create or replace function private.protect_assignment_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.is_admin() then
    if new.intern_id is distinct from old.intern_id
      or new.module_id is distinct from old.module_id
      or new.assigned_by is distinct from old.assigned_by then
      raise exception 'Interns can only update their progress';
    end if;
  end if;
  return new;
end;
$$;

create trigger assignments_protect_progress
  before update on public.assignments
  for each row execute function private.protect_assignment_progress();
