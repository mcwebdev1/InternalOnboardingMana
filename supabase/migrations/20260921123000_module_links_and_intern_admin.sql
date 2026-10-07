create table if not exists public.module_links (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  title text not null,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists module_links_module_id_idx on public.module_links (module_id);

alter table public.module_links enable row level security;

create policy "module_links_select_assigned_or_admin"
  on public.module_links for select to authenticated
  using (
    private.is_admin()
    or exists (
      select 1
      from public.assignments a
      where a.module_id = module_links.module_id
        and a.intern_id = auth.uid()
    )
  );

create policy "module_links_insert_admin"
  on public.module_links for insert to authenticated
  with check (private.is_admin());

create policy "module_links_update_admin"
  on public.module_links for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "module_links_delete_admin"
  on public.module_links for delete to authenticated
  using (private.is_admin());

insert into public.module_links (module_id, title, url, sort_order)
select id, 'Company handbook', 'https://www.mana.com', 10
from public.modules where slug = 'general-onboarding'
and not exists (select 1 from public.module_links l where l.module_id = modules.id);

insert into public.module_links (module_id, title, url, sort_order)
select id, 'First week checklist', 'https://www.mana.com', 20
from public.modules where slug = 'general-onboarding';

insert into public.module_links (module_id, title, url, sort_order)
select id, 'Iterable Academy', 'https://support.iterable.com/', 10
from public.modules where slug = 'iterable-cms';

insert into public.module_links (module_id, title, url, sort_order)
select id, 'Campaign setup guide', 'https://support.iterable.com/hc/en-us/articles/360035224312-Campaigns-Overview', 20
from public.modules where slug = 'iterable-cms';

insert into public.module_links (module_id, title, url, sort_order)
select id, 'Zapier University', 'https://learn.zapier.com/', 10
from public.modules where slug = 'automations-zapier-monday';

insert into public.module_links (module_id, title, url, sort_order)
select id, 'Monday.com automations', 'https://support.monday.com/hc/en-us/articles/360000225829-Automations', 20
from public.modules where slug = 'automations-zapier-monday';

insert into public.module_links (module_id, title, url, sort_order)
select id, 'Monday.com Academy', 'https://support.monday.com/', 10
from public.modules where slug = 'monday-task-management';

insert into public.module_links (module_id, title, url, sort_order)
select id, 'Boards and statuses', 'https://support.monday.com/hc/en-us/articles/115005317365-The-Basics-of-a-Board', 20
from public.modules where slug = 'monday-task-management';

update public.modules
set description = 'Company basics, tools access, and how internships run at Mana.'
where slug = 'general-onboarding';

update public.modules
set description = 'Campaign setup, templates, and how we ship email in Iterable.'
where slug = 'iterable-cms';

update public.modules
set description = 'How we connect tools and keep intern workflows moving without manual busywork.'
where slug = 'automations-zapier-monday';

update public.modules
set description = 'Boards, statuses, and how intern work gets assigned and reviewed.'
where slug = 'monday-task-management';

create or replace function private.create_intern(p_login text, p_password text, p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  new_id uuid := gen_random_uuid();
  normalized_login text;
  intern_email text;
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

  if nullif(trim(p_full_name), '') is not null then
    update public.profiles
    set full_name = trim(p_full_name)
    where id = new_id;
  end if;

  return new_id;
end;
$$;

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

create or replace function public.create_intern(p_login text, p_password text, p_full_name text)
returns uuid
language sql
security invoker
set search_path = public
as $$
  select private.create_intern(p_login, p_password, p_full_name);
$$;

create or replace function public.delete_intern(p_user_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  select private.delete_intern(p_user_id);
$$;

revoke all on function public.create_intern(text, text, text) from public;
revoke all on function public.delete_intern(uuid) from public;
grant execute on function public.create_intern(text, text, text) to authenticated;
grant execute on function public.delete_intern(uuid) to authenticated;
grant execute on function private.create_intern(text, text, text) to authenticated;
grant execute on function private.delete_intern(uuid) to authenticated;
