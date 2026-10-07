-- Internal Onboarding V1 schema
-- Admins manage a module library and assign selected modules per intern.
-- Interns only see assignments that belong to them.

create schema if not exists private;

create type public.user_role as enum ('admin', 'intern');
create type public.assignment_status as enum ('not_started', 'in_progress', 'completed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'intern',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  platform text,
  content text not null default '',
  estimated_minutes integer,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  intern_id uuid not null references public.profiles (id) on delete cascade,
  module_id uuid not null references public.modules (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  status public.assignment_status not null default 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (intern_id, module_id)
);

create index assignments_intern_id_idx on public.assignments (intern_id);
create index assignments_module_id_idx on public.assignments (module_id);
create index profiles_role_idx on public.profiles (role);

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
      and role = 'admin'
  );
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  );
  return new;
end;
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

create trigger modules_touch_updated_at
  before update on public.modules
  for each row execute function private.touch_updated_at();

create trigger assignments_touch_updated_at
  before update on public.assignments
  for each row execute function private.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.modules enable row level security;
alter table public.assignments enable row level security;

create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_admin());

create policy "profiles_update_own_or_admin"
  on public.profiles for update to authenticated
  using (id = auth.uid() or private.is_admin())
  with check (id = auth.uid() or private.is_admin());

create policy "modules_select_assigned_or_admin"
  on public.modules for select to authenticated
  using (
    private.is_admin()
    or exists (
      select 1
      from public.assignments a
      where a.module_id = modules.id
        and a.intern_id = auth.uid()
    )
  );

create policy "modules_write_admin"
  on public.modules for insert to authenticated
  with check (private.is_admin());

create policy "modules_update_admin"
  on public.modules for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());

create policy "modules_delete_admin"
  on public.modules for delete to authenticated
  using (private.is_admin());

create policy "assignments_select_own_or_admin"
  on public.assignments for select to authenticated
  using (intern_id = auth.uid() or private.is_admin());

create policy "assignments_insert_admin"
  on public.assignments for insert to authenticated
  with check (private.is_admin());

create policy "assignments_update_own_or_admin"
  on public.assignments for update to authenticated
  using (intern_id = auth.uid() or private.is_admin())
  with check (intern_id = auth.uid() or private.is_admin());

create policy "assignments_delete_admin"
  on public.assignments for delete to authenticated
  using (private.is_admin());

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;
grant usage on schema private to authenticated;

insert into public.modules (slug, title, description, platform, estimated_minutes, sort_order, content)
values
  (
    'general-onboarding',
    'General Onboarding',
    'Company basics, tools access, and how internships run at Mana.',
    'Mana',
    45,
    10,
    $md$# General Onboarding

Welcome in. This module covers the shared context every intern needs before function-specific work.

## What you will walk away with
- How we communicate day to day
- Where work lives
- Who to ping, and when

## First-week checklist
1. Confirm your email, calendar, and Slack access
2. Read the working-hours and meeting norms
3. Introduce yourself in the intern channel
4. Review the tools you were assigned in this app

Replace this draft with the live company handbook.
$md$
  ),
  (
    'iterable-cms',
    'Email (Iterable CMS)',
    'Campaign setup, templates, and how we ship email in Iterable.',
    'Iterable',
    60,
    20,
    $md$# Email — Iterable CMS

Use this module if you are supporting lifecycle or campaign email.

## You will learn
- Where templates, campaigns, and journeys live
- How we name, preview, and QA sends
- Who approves copy before it goes live

## Suggested practice
1. Open a recent campaign and map the audience
2. Duplicate a template and make a safe draft change
3. Document the QA checklist you followed

Keep credentials in the password manager. Do not paste secrets here.
$md$
  ),
  (
    'automations-zapier-monday',
    'Automations (Zapier, Monday.com)',
    'How we connect tools and keep intern workflows moving without manual busywork.',
    'Zapier',
    50,
    30,
    $md$# Automations — Zapier and Monday.com

This module is for interns who will maintain or extend automations.

## You will learn
- Which Zaps are allowed to touch production data
- How Monday.com boards trigger automations
- How to pause, debug, and hand off a broken Zap

## Guardrails
- Never enable a Zap against live data without a manager review
- Name Zaps with owner, system, and purpose
- Log every change in the related Monday item
$md$
  ),
  (
    'monday-task-management',
    'Task Management System (Monday.com)',
    'Boards, statuses, and how intern work gets assigned and reviewed.',
    'Monday.com',
    40,
    40,
    $md$# Task Management — Monday.com

Your source of truth for assigned work lives in Monday.com.

## You will learn
- How boards map to functions
- Status meanings we actually use
- How to update an item so managers can see progress

## Working agreement
- Move an item when the work moves
- Leave a short update, not a novel
- Flag blockers the same day they appear
$md$
  );
