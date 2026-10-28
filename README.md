# Mana Onboarding

Internal app for assigning function-specific onboarding modules to interns.

Managers own the module library and intern accounts. Interns only see the modules a manager sends them, then mark each one assigned, started, or finished. The original `admin` account is the master: it can invite managers and interns, and override assignments.

## V1 stack

Lean on purpose so Cursor MCPs stay useful:

- **Next.js 16** App Router, Server Actions, `proxy.ts`
- **Supabase** Auth + Postgres + RLS (no Drizzle)
- **Tailwind CSS v4 + shadcn/ui + Lucide**
- **Kinsta Application Hosting** for the Next.js app (`npm run build` / `npm start`)

Skipping Drizzle keeps schema work in SQL, which the Supabase MCP can apply and inspect directly.

## Data model

```
profiles  1 - *  intern_managers  * - 1  profiles (managers)
profiles  1 - *  assignments  * - 1  modules  1 - *  module_links
```

- `profiles.role`: `master` | `admin` (manager) | `intern`
- `intern_managers`: an intern can have more than one manager
- `modules`: title, description, `created_by`
- `module_links`: titled URLs (contents) with optional description, ordered by `sort_order`
- `assignments`: intern + module + `assigned_by` + `not_started` (Assigned) | `in_progress` (Started) | `completed` (Finished)
- `schedules`: one row per intern per weekday with a status (`available`, `remote`, `unavailable`, `out`) and a time range for Available and Remote
- `time_logs`: clock in and clock out sessions. Interns write them only through the `clock_in()` and `clock_out()` functions
- `private.staff_allowlist`: the five Google staff addresses and their roles. Not reachable through the API

All day and week math uses America/New_York (`APP_TIMEZONE` in `src/lib/schedule.ts` and `private.app_timezone()` in SQL).

## Sign in

- **Mana staff** sign in with Google. Only the addresses in `private.staff_allowlist` get in, and only with a verified Google email. `webdev@manacommon.com` is master. `vlad@`, `marie@`, `atari@` and `miguel@manacommon.com` are managers. The allowlist decides who may sign in with Google and sets the starting role at the first sign in. After that, a master can change the role and later sign ins never change it back.
- **Interns and invited managers** sign in with their email and the 6-digit PIN from their invite. A Google sign in for any other address is refused, even if that address has an invited account.
- **Demo accounts** keep their passwords (below).
- Public sign up is closed in the database. New email accounts are created only by `create_intern`, `create_manager`, or the demo seed.
- **Adding a user by hand in the Supabase dashboard now fails**. Dashboard users carry no `onboarding_role`, so the database refuses them. Invite people from the app instead.
- Allowlisted addresses can never get a PIN account. Staff Google accounts can never have a password either: setting one, including through a password reset, is refused, so staff always sign in with Google.
- No account can change its email to a staff address. The one exception is a Google account moving back to its own Google email.

Only a Google master (a master signed in with an allowlisted Google account, such as `webdev@manacommon.com`) can remove a manager who is on the allowlist. The demo `admin` login cannot. The four demo logins `admin`, `admin1`, `admin2` and `admin3` can never be removed. When an allowlisted manager is removed, their address is marked revoked so Google cannot recreate the account. To let them back in, clear it in the SQL editor:

```sql
update private.staff_allowlist set revoked_at = null, revoked_by = null
where email = 'name@manacommon.com';
```

## Who can do what

- **Manager links.** A manager adds or removes only themselves on an intern (Assign to me, Remove me). Only master links or unlinks other managers, on the intern's page, and when inviting an intern. A manager who invites an intern becomes their manager.
- **Modules.** Every manager can create and edit module content. Sending, changing, or removing an intern's modules needs that intern on your team. Master can do it for any intern.
- **Profile edits.** Everyone can edit their own profile. A manager can also edit the profiles of interns on their team, and master can edit anyone's. A manager cannot edit another manager, the master, or an intern outside their team. Roles and emails stay locked as described below.
- **What interns see.** Interns read their own profile, and only the name and email of their own managers (`my_managers()`). They cannot read any other staff row.
- **Roles.** Only a Google master changes roles, on the Interns page (Managers section) and on an intern's page. They can promote anyone to master and demote anyone, but never change their own role. The demo `admin` login cannot change roles. Regular managers never can. When an intern becomes staff they lose their managers, and when staff become an intern they stop managing anyone. Assignments, schedules and time logs are kept.

## Demo logins

These still work. Do not remove them while we are testing.

| Login | Password | Role | Notes |
|-------|----------|------|-------|
| `admin` | `admin` | Master | Invites managers and interns, can override everything |
| `admin1` | `admin1` | Manager | Manager for intern1 |
| `admin2` | `admin2` | Manager | Manager for intern2 |
| `admin3` | `admin3` | Manager | Manager for intern3 |
| `intern1` | `intern1` | Intern | Reports to admin1 |
| `intern2` | `intern2` | Intern | Reports to admin2 |
| `intern3` | `intern3` | Intern | Reports to admin3 |

Temporary intern and manager accounts are there so you can switch users, add more than one manager, and send different modules to each intern.

## App routes

| Route | Who | Purpose |
|-------|-----|---------|
| `/login` | Public | Google sign in, or email plus PIN/password |
| `/auth/callback` | Public | Google OAuth return |
| `/` | Signed in | Redirects by role |
| `/onboarding` | Intern | Assigned modules and progress toggles |
| `/onboarding/[id]` | Intern | Resource links + progress |
| `/schedule` | Intern | Weekly schedule up to 8 weeks out, clock in and out |
| `/admin` | Manager / master | Intern progress |
| `/admin/people` | Manager / master | Intern portal; master can also invite managers |
| `/admin/people/[id]` | Manager / master | Intern profile, progress, send modules |
| `/admin/modules` | Manager / master | Create / edit modules and URLs |
| `/admin/assign` | Manager / master | Send modules to interns on your team |
| `/admin/schedule` | Manager / master | Team availability, week report, schedule override, time session editing |

## Local setup

1. Env is already wired to the `InternalOnboardingMana` Supabase project in `.env.local`.
2. In the [Supabase Auth settings](https://supabase.com/dashboard/project/nwkmnjosszawzvtieied/auth/providers), turn **Confirm email** off for internal use.
3. Apply the database migrations (see below).
4. To turn on Google sign in:
   - Create a Google Cloud OAuth client (Web application).
   - Authorized redirect URI in Google Cloud: `https://nwkmnjosszawzvtieied.supabase.co/auth/v1/callback`
   - Enable Google under Supabase Auth providers and paste the client ID and secret there. Never put the secret in this repo.
   - Keep **Allow new users to sign up** on in Supabase Auth. Google needs it to create a staff account the first time. The database still refuses everyone who is not invited or allowlisted.
   - Turn **Secure email change** on in Supabase Auth (Providers > Email). An email change then has to be confirmed from both the old and the new address. The database also refuses any change onto a staff address.
   - In Supabase Authentication > URL Configuration, add these **Redirect URLs**:

     | Environment | Redirect URL |
     |-------------|--------------|
     | Local | `http://127.0.0.1:3000/auth/callback` |
     | Local | `http://localhost:3000/auth/callback` |
     | Kinsta live | `https://<live domain>/auth/callback` |
     | Kinsta staging | `https://<staging domain>/auth/callback` |

     Use the exact Kinsta domains once they exist, including any custom domain. Set **Site URL** to the live domain.
5. Start the app:

```bash
npm install
npm run dev
```

6. Sign in as `admin` / `admin` for the master account, or `admin1` / `admin1` as a manager.
7. Use Interns to invite people with their email. A 6-digit PIN is shown once.

## Database migrations

Apply the files in `supabase/migrations` in filename order. Each one assumes the ones before it. In the Supabase SQL editor, paste and run one whole file at a time, so a failure rolls back that file.

| Order | File | What it does |
|-------|------|--------------|
| 1 | `20260921120000_init.sql` | Profiles, modules, assignments, RLS |
| 2 | `20260921121000_bootstrap_admin_and_guards.sql` | Role and progress guards |
| 3 | `20260921123000_module_links_and_intern_admin.sql` | Module links, intern accounts |
| 4 | `20260921140000_managers_and_admin_accounts.sql` | Manager accounts, demo managers |
| 5 | `20260921150000_master_role.sql` | Adds the `master` role |
| 6 | `20260921151000_intern_managers_and_invites.sql` | Many managers per intern, PIN invites |
| 7 | `20260921152000_module_link_description.sql` | Link descriptions |
| 8 | `20261022120000_schedules_and_time_logs.sql` | Schedules, time logs, clock in and out |
| 9 | `20261022130000_google_staff_allowlist.sql` | Google staff allowlist, invite-only accounts, `delete_manager`, tighter `delete_intern` |
| 10 | `20261027120000_access_rules.sql` | Manager link rules, team-only module assignments, interns see only their managers, role changes, seeded heading fix |

The live project already runs files 1 to 7. Check which later ones are applied before running anything. Migration 9 stops with an error if a PIN or password account already uses an allowlisted address, so nothing is changed silently. Migration 9 also deletes any Google-only account made before it that is not on the allowlist, along with its profile and data. Accounts with a PIN or password are never touched. After migration 9, you can run `supabase/checks/google_allowlist_checks.sql` in the SQL editor. It confirms the allowlist rules and keeps no changes. Its behavior checks (no password on a staff account, no move onto another staff address) need a staff member who has signed in with Google. Until then they print a "Skipped" notice, so run the file again after the first staff Google sign in.

Before migration 10, run `supabase/checks/preview_em_dash_fix.sql` to see each module line with an em dash before and after. Migration 10 only fixes the three headings the init migration seeded. After it, run `supabase/checks/access_rules_checks.sql`. Its profile edit checks sign in as the demo logins inside a rolled back block, and print a "Skipped" notice if those demo accounts are missing.

To undo migration 10, run `supabase/rollbacks/20261027120000_access_rules_down.sql`. To undo migration 9, undo 10 first, then run `supabase/rollbacks/20261022130000_google_staff_allowlist_down.sql`. The migration 9 rollback stops with an error if migration 10 is still applied, and it keeps accounts invite only. The top of each file lists what it cannot bring back.

Copy in this repo never uses the em dash character. The only ones left are in the applied init migration, which is not edited, and in `AGENTS.md`, which `next dev` writes and rewrites.

## Checks

```bash
npm test      # schedule, report, timezone, Google access, redirect, and access rules logic
npm run lint
npx tsc --noEmit
```

## Cursor MCPs already connected

- **Supabase**: project `InternalOnboardingMana` (`nwkmnjosszawzvtieied`)
- **GitHub**: repo [mcwebdev1/InternalOnboardingMana](https://github.com/mcwebdev1/InternalOnboardingMana)

## Later, not V1

- Function/track templates that assign a bundle in one click
- Email/Slack reminders
- Quiz or sign-off steps inside a module
