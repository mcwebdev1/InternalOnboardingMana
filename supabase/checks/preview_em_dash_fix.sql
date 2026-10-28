-- Read-only preview of the em dash fix in
-- migrations/20261027120000_access_rules.sql. Changes nothing.
--
-- Lists every line in modules and module_links that contains an em dash
-- (chr(8212)), with the same line after migration 10. Rows with
-- fixed_by_migration_10 = false keep their em dash, because migration 10 only
-- changes the three headings the init migration seeded.

with fixes(slug, before_text, after_text) as (
  values
    ('iterable-cms', '# Email ' || chr(8212) || ' Iterable CMS', '# Email: Iterable CMS'),
    ('automations-zapier-monday', '# Automations ' || chr(8212) || ' Zapier and Monday.com', '# Automations: Zapier and Monday.com'),
    ('monday-task-management', '# Task Management ' || chr(8212) || ' Monday.com', '# Task Management: Monday.com')
),
module_lines as (
  select m.id, m.slug, 'modules.title' as field, 1::bigint as line_no, m.title as line
  from public.modules m
  union all
  select m.id, m.slug, 'modules.description', 1, m.description
  from public.modules m
  union all
  select m.id, m.slug, 'modules.content', l.line_no, l.line
  from public.modules m
  cross join lateral regexp_split_to_table(m.content, E'\n') with ordinality as l(line, line_no)
  union all
  select k.id, m.slug, 'module_links.title', 1, k.title
  from public.module_links k
  join public.modules m on m.id = k.module_id
  union all
  select k.id, m.slug, 'module_links.description', 1, k.description
  from public.module_links k
  join public.modules m on m.id = k.module_id
)
select
  ml.slug,
  ml.id,
  ml.field,
  ml.line_no,
  ml.line as before,
  coalesce(
    case when ml.field = 'modules.content' then replace(ml.line, f.before_text, f.after_text) end,
    ml.line
  ) as after,
  f.slug is not null
    and ml.field = 'modules.content'
    and position(f.before_text in ml.line) > 0 as fixed_by_migration_10
from module_lines ml
left join fixes f on f.slug = ml.slug
where position(chr(8212) in coalesce(ml.line, '')) > 0
order by ml.slug, ml.field, ml.line_no;
