-- Read-only preview of the cleanup in migrations/20261022130000_google_staff_allowlist.sql.
-- Lists every auth user that migration 9 would delete: accounts whose every
-- identity is Google, where neither the auth email nor any Google identity
-- email is on the staff allowlist. Changes nothing.
--
-- Runs before migration 9, so the five allowlisted emails are listed here
-- instead of read from private.staff_allowlist. Keep them in sync with the
-- migration's seed.

with staff(email) as (
  values
    ('webdev@manacommon.com'),
    ('vlad@manacommon.com'),
    ('marie@manacommon.com'),
    ('atari@manacommon.com'),
    ('miguel@manacommon.com')
)
select
  u.id,
  u.email,
  u.created_at,
  (
    select string_agg(distinct i.provider, ', ' order by i.provider)
    from auth.identities i
    where i.user_id = u.id
  ) as identity_providers
from auth.users u
where exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'google'
  )
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider <> 'google'
  )
  and not exists (
    select 1 from staff s
    where s.email = lower(trim(coalesce(u.email, '')))
  )
  and not exists (
    select 1
    from auth.identities i
    join staff s on s.email = lower(trim(coalesce(i.identity_data ->> 'email', '')))
    where i.user_id = u.id and i.provider = 'google'
  )
order by u.created_at;
