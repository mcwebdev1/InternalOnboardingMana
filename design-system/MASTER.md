# Design System Master File

> When building a page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules override this Master file.

---

**Project:** Mana Onboarding  
**Product:** Internal intern onboarding workspace  
**Generated:** 2026-09-21  
**Style:** Dark cinematic dashboard with brand gradient accents  

---

## Product rules

- Interns see **only assigned modules**. The library can contain many tracks; assignment is selective.
- Admins populate modules once, then assign per intern/function.
- Each intern belongs to one manager admin account. From Interns, toggle All interns vs Assigned to me, then assign or remove yourself.
- Open an intern profile to see progress. Sending modules to someone who is not yours asks you to assign them to yourself first.
- Only admins can create or remove intern accounts. There is no public signup.
- Modules are a title, a description, and titled URLs. Interns open resources through those links.
- Intern progress is Assigned / Started / Finished and should be visible on the admin side.
- Dark mode only. Do not introduce a light theme in V1.
- Gradient colors are never used as large standalone fills. Use them for the logo ring, progress, hairlines, and small chips.
- Copy must not use em dashes.

## Color palette

| Role | Hex | CSS variable |
|------|-----|----------------|
| Canvas | `#1D1D25` | `--background` |
| Surface | `#25252F` | `--card` |
| Text | `#F4F4F7` | `--foreground` |
| Muted text | `#A8A8B3` | `--muted-foreground` |
| Border | `rgb(255 255 255 / 8%)` | `--border` |
| Gold | `#F5C443` | `--brand-gold` |
| Orange | `#EC8F43` | `--brand-orange` |
| Pink | `#EB4B80` | `--brand-pink` |
| Purple | `#9533B2` | `--brand-purple` |
| Blue | `#5CA1F3` | `--brand-blue` |
| Green | `#4EAD63` | `--brand-green` |

Brand gradient:

```css
linear-gradient(90deg, #F5C443, #EC8F43, #EB4B80, #9533B2, #5CA1F3, #4EAD63)
```

Status colors:
- Completed: green `#4EAD63`
- In progress: blue `#5CA1F3`
- Not started: muted gray

## Typography

- **UI font:** Plus Jakarta Sans via `next/font`
- Body: 16px / 1.5–1.75
- Headings: 600–700, tight tracking
- Do not load Google Fonts from a `<link>` tag

## Spacing and shape

- 4/8px spacing rhythm
- Card radius: 16px
- Control height for primary actions: 44px (`h-11`)
- Page max width: `max-w-6xl`
- Header is sticky and content is padded below it

## Motion

- 150–300ms color/opacity transitions
- Transform/opacity only
- Respect `prefers-reduced-motion`

## Components

- Icons: Lucide only. No emoji as UI.
- Logo: `/brand/logo.png` only. Do not recolor or crop the mark.
- Primary CTA: light on dark (`--primary`)
- Secondary: outline on elevated surface
- Empty states always include a sentence and next step

## Page patterns

### Login
Centered card, logo, short product promise, sign-in only. Accounts are created by an admin.

### Intern home
Welcome + gradient progress ring, then assigned module cards with Assigned / Started / Finished toggles. Empty state if nothing is assigned.

### Module detail
Back link, titled resource URLs, progress toggles.

### Admin overview
Three stats, intern table with assigned / started / finished counts.

### Interns
All vs assigned to me. Assign to me / remove me. Open an intern profile for progress and module sending. If they are not yours, ask before taking them on.

### Modules / Assign
Library CRUD (title, description, titled URLs) and intern switching with checkboxes. Send only to interns on your team unless you take them on first.

## Accessibility

- Contrast 4.5:1 for body text
- Visible focus rings (`--ring`)
- Labels on every input
- Touch targets 44px
- Color is never the only status signal

## Anti-patterns

- Light mode default
- Drizzle/ORM layer for V1
- Assigning the full catalog by default
- Emoji icons
- Gradient backgrounds behind whole pages
- Hover-only actions
- Placeholder-only form labels
