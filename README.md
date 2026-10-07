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

Login is an email. New people get a generated 6-digit PIN. Google Workspace is the usual sign in once the Google provider is enabled.

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
| `/admin` | Manager / master | Intern progress |
| `/admin/people` | Manager / master | Intern portal; master can also invite managers |
| `/admin/people/[id]` | Manager / master | Intern profile, progress, send modules |
| `/admin/modules` | Manager / master | Create / edit modules and URLs |
| `/admin/assign` | Manager / master | Send modules to interns on your team |

## Local setup

1. Env is already wired to the `InternalOnboardingMana` Supabase project in `.env.local`.
2. In the [Supabase Auth settings](https://supabase.com/dashboard/project/nwkmnjosszawzvtieied/auth/providers), turn **Confirm email** off for internal use.
3. To turn on Google sign in:
   - Create a Google Cloud OAuth client (Web application).
   - Authorized redirect URI: `https://nwkmnjosszawzvtieied.supabase.co/auth/v1/callback`
   - Enable Google under Supabase Auth providers and paste the client ID and secret.
   - Add `http://127.0.0.1:3000/auth/callback` and your production URL to Supabase redirect URLs.
4. Start the app:

```bash
npm install
npm run dev
```

5. Sign in as `admin` / `admin` for the master account, or `admin1` / `admin1` as a manager.
6. Use Interns to invite people with a work email. A 6-digit PIN is shown once. They can also sign in with Google using that same email.

## Cursor MCPs already connected

- **Supabase**: project `InternalOnboardingMana` (`nwkmnjosszawzvtieied`)
- **GitHub**: repo [mcwebdev1/InternalOnboardingMana](https://github.com/mcwebdev1/InternalOnboardingMana)

## Later, not V1

- Function/track templates that assign a bundle in one click
- Email/Slack reminders
- Quiz or sign-off steps inside a module
