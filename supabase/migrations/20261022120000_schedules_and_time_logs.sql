-- Schedules and time logs ported from the activity tracker.
-- Interns set their own Monday to Friday schedule and clock in and out.
-- Staff read and override rows only for interns they may manage.

create type public.schedule_status as enum ('available', 'unavailable', 'remote', 'out');

-- Single source of the app timezone for all day and week math in SQL.
-- Must match APP_TIMEZONE in src/lib/schedule.ts. time_logs.work_date is a
-- stored generated column, so changing this also requires rewriting that column.
create or replace function private.app_timezone()
returns text
language sql
immutable
set search_path = public
as $$
  select 'America/New_York'::text;
$$;

create or replace function private.local_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone private.app_timezone())::date;
$$;

-- Friday of the week eight weeks after the current week.
create or replace function private.schedule_window_end()
returns date
language sql
stable
set search_path = public
as $$
  select private.local_today()
    - (extract(isodow from private.local_today())::int - 1)
    + 60;
$$;

create or replace function private.is_intern()
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
      and role = 'intern'
  );
$$;

-- Master manages every intern. An admin manages only interns linked to them.
-- Admin and master rows are never manageable.
create or replace function private.can_manage_intern(p_intern_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles target
    where target.id = p_intern_id
      and target.role = 'intern'
  )
  and (
    private.is_master()
    or (
      private.is_admin()
      and exists (
        select 1
        from public.intern_managers link
        where link.intern_id = p_intern_id
          and link.manager_id = auth.uid()
      )
    )
  );
$$;

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  intern_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  week_start date not null generated always as (
    day - (extract(isodow from day)::int - 1)
  ) stored,
  status public.schedule_status not null,
  start_time time,
  end_time time,
  expected_hours numeric(4, 2) not null generated always as (
    case
      when start_time is null or end_time is null then 0
      else round((extract(epoch from (end_time - start_time)) / 3600)::numeric, 2)
    end
  ) stored,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (intern_id, day),
  constraint schedules_weekday_only check (extract(isodow from day) between 1 and 5),
  constraint schedules_time_range check (
    (
      status in ('available', 'remote')
      and start_time is not null
      and end_time is not null
      and end_time > start_time
    )
    or (
      status in ('unavailable', 'out')
      and start_time is null
      and end_time is null
    )
  )
);

create table public.time_logs (
  id uuid primary key default gen_random_uuid(),
  intern_id uuid not null references public.profiles (id) on delete cascade,
  clock_in timestamptz not null,
  clock_out timestamptz,
  work_date date not null generated always as (
    (clock_in at time zone private.app_timezone())::date
  ) stored,
  actual_hours numeric(6, 2) generated always as (
    case
      when clock_out is null then null
      else round((extract(epoch from (clock_out - clock_in)) / 3600)::numeric, 2)
    end
  ) stored,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_logs_clock_out_after_clock_in check (
    clock_out is null or clock_out > clock_in
  )
);

create index schedules_week_start_idx on public.schedules (week_start);
create index time_logs_intern_work_date_idx on public.time_logs (intern_id, work_date);
create index time_logs_work_date_idx on public.time_logs (work_date);
create unique index time_logs_one_open_session_idx
  on public.time_logs (intern_id)
  where clock_out is null;

create or replace function private.stamp_intern_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.intern_id is distinct from old.intern_id then
      raise exception 'Rows cannot be moved to another intern';
    end if;
    new.created_at := old.created_at;
  end if;

  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.validate_time_log()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.clock_in > now() then
    raise exception 'Clock in cannot be in the future';
  end if;

  if new.clock_out is not null and new.clock_out > now() then
    raise exception 'Clock out cannot be in the future';
  end if;

  return new;
end;
$$;

create trigger schedules_stamp
  before insert or update on public.schedules
  for each row execute function private.stamp_intern_row();

create trigger time_logs_stamp
  before insert or update on public.time_logs
  for each row execute function private.stamp_intern_row();

create trigger time_logs_validate
  before insert or update on public.time_logs
  for each row execute function private.validate_time_log();

alter table public.schedules enable row level security;
alter table public.time_logs enable row level security;

-- Interns read their own schedule and write only today through the window end.
-- Staff read and write any week for interns they manage. Interns never delete.
create policy "schedules_select_own_or_managed"
  on public.schedules for select to authenticated
  using (
    (intern_id = auth.uid() and private.is_intern())
    or private.can_manage_intern(intern_id)
  );

create policy "schedules_insert_own_or_managed"
  on public.schedules for insert to authenticated
  with check (
    (
      intern_id = auth.uid()
      and private.is_intern()
      and day between private.local_today() and private.schedule_window_end()
    )
    or private.can_manage_intern(intern_id)
  );

create policy "schedules_update_own_or_managed"
  on public.schedules for update to authenticated
  using (
    (
      intern_id = auth.uid()
      and private.is_intern()
      and day >= private.local_today()
    )
    or private.can_manage_intern(intern_id)
  )
  with check (
    (
      intern_id = auth.uid()
      and private.is_intern()
      and day between private.local_today() and private.schedule_window_end()
    )
    or private.can_manage_intern(intern_id)
  );

create policy "schedules_delete_managed"
  on public.schedules for delete to authenticated
  using (private.can_manage_intern(intern_id));

-- Interns only read their own time logs. Their writes go through
-- clock_in() and clock_out(), which use server time.
create policy "time_logs_select_own_or_managed"
  on public.time_logs for select to authenticated
  using (
    (intern_id = auth.uid() and private.is_intern())
    or private.can_manage_intern(intern_id)
  );

create policy "time_logs_insert_managed"
  on public.time_logs for insert to authenticated
  with check (private.can_manage_intern(intern_id));

create policy "time_logs_update_managed"
  on public.time_logs for update to authenticated
  using (private.can_manage_intern(intern_id))
  with check (private.can_manage_intern(intern_id));

create policy "time_logs_delete_managed"
  on public.time_logs for delete to authenticated
  using (private.can_manage_intern(intern_id));

-- Supabase grants new tables to anon and authenticated by default.
-- TRUNCATE ignores RLS, so it is revoked along with anon access.
revoke all on public.schedules from anon;
revoke all on public.time_logs from anon;
revoke truncate, references, trigger on public.schedules from authenticated;
revoke truncate, references, trigger on public.time_logs from authenticated;

create or replace function private.clock_in()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  started_at timestamptz;
begin
  if not private.is_intern() then
    raise exception 'Only interns can clock in';
  end if;

  insert into public.time_logs (intern_id, clock_in)
  values (auth.uid(), now())
  returning clock_in into started_at;

  return started_at;
exception
  when unique_violation then
    raise exception 'You are already clocked in';
end;
$$;

create or replace function private.clock_out()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  ended_at timestamptz;
begin
  if not private.is_intern() then
    raise exception 'Only interns can clock out';
  end if;

  update public.time_logs
  set clock_out = now()
  where intern_id = auth.uid()
    and clock_out is null
  returning clock_out into ended_at;

  if ended_at is null then
    raise exception 'You are not clocked in';
  end if;

  return ended_at;
end;
$$;

create or replace function public.clock_in()
returns timestamptz
language sql
security invoker
set search_path = public
as $$
  select private.clock_in();
$$;

create or replace function public.clock_out()
returns timestamptz
language sql
security invoker
set search_path = public
as $$
  select private.clock_out();
$$;

revoke all on function private.app_timezone() from public;
revoke all on function private.local_today() from public;
revoke all on function private.schedule_window_end() from public;
revoke all on function private.is_intern() from public;
revoke all on function private.can_manage_intern(uuid) from public;
revoke all on function private.clock_in() from public;
revoke all on function private.clock_out() from public;
revoke all on function public.clock_in() from public, anon;
revoke all on function public.clock_out() from public, anon;

grant execute on function private.app_timezone() to authenticated;
grant execute on function private.local_today() to authenticated;
grant execute on function private.schedule_window_end() to authenticated;
grant execute on function private.is_intern() to authenticated;
grant execute on function private.can_manage_intern(uuid) to authenticated;
grant execute on function private.clock_in() to authenticated;
grant execute on function private.clock_out() to authenticated;
grant execute on function public.clock_in() to authenticated;
grant execute on function public.clock_out() to authenticated;
