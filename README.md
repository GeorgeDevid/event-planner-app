# Event Planner App

A marketplace that connects clients in the Greater Toronto Area with event vendors: planners, photographers, caterers, entertainers, emcees, car rentals, florists, salons, spas, tailors, and suit and gown rentals.

Phase 0 covers the client, vendor and admin sides, with no payments. Specs live in Confluence ("Event Planner App – Phase 0 User Stories") and work is tracked in Jira project **MP**.

## Stack

- **Next.js 16** (App Router, Cache Components, Turbopack), React 19, TypeScript, Tailwind CSS 4
- **Convex** for the database and backend functions
- **Convex Auth** (email + password) with Client / Vendor / Admin roles
- **@convex-dev/geospatial** for "vendors within X km" search
- Design: **Dusk & Gold** tokens in `src/app/globals.css` (navy, gold, cream; Cormorant Garamond + Plus Jakarta Sans, self-hosted)

## Getting started

```bash
npm install

# 1. Connect Convex (first run asks you to log in and create a project).
#    This writes CONVEX_DEPLOYMENT and NEXT_PUBLIC_CONVEX_URL to .env.local,
#    pushes the schema and functions, and regenerates convex/_generated.
npx convex dev

# 2. In a second terminal: seed categories and event types (safe to re-run).
npm run seed

# 3. Start the web app.
npm run dev
```

### Create the first Super Admin

Sign up in the app with your email, then run:

```bash
npx convex run users:grantAdminRole '{"email":"you@example.com","adminRole":"super_admin"}'
```

Log out and back in; you'll land in the admin portal. After that, admins are managed in the portal.

## Project layout

```
convex/
  schema.ts            Phase 0 data model
  auth.ts              Convex Auth setup (email + password)
  users.ts             createUser / onSignIn callbacks, me, onboarding, grantAdminRole
  catalog.ts           categories and event types
  vendorSearch.ts      geospatial index and the nearby() query
  admin.ts             admin dashboard totals
  seed.ts              starting categories and event types
  lib/permissions.ts   A-10 default permission matrix
  lib/access.ts        requireUser / requireRole / requirePermission / audit
src/
  proxy.ts             session refresh + signed-in/out redirects
  lib/convex-auth.ts   Next.js auth helpers and /auth route handlers
  app/                 landing, sign-up, sign-in, onboarding, /app, /vendor, /admin
  components/          UI kit (buttons, fields, pills), role gate, navigation
```

## How access works

- Every Convex function that touches protected data checks the caller on the server (`requireRole`, `requirePermission`). The UI hides what a role can't use, but never relies on that.
- New sign-ups start as clients. Onboarding lets them choose a vendor account, which creates a business in **Pending review**; pending businesses never appear in search.
- Admin accounts can't be created by public sign-up; a Super Admin grants them.
- Suspended accounts are refused at sign-in.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run dev:backend` | `convex dev`: push functions and watch for changes |
| `npm run seed` | Seed categories and event types |
| `npm run typecheck` | Typecheck the app and the Convex functions |
| `npm run lint` | ESLint |
| `npm run codegen:offline` | Regenerate `convex/_generated` without a deployment (only for environments that can't reach Convex; `npx convex dev` replaces it) |

## Known limits (Step 1)

- Passwords need at least 10 characters (Convex Auth's minimum); story C-01 says 8.
- No email verification, password reset or Google sign-in yet. These need a Resend API key and Google OAuth credentials and come in a later step.
- Client, vendor and admin areas are shells; features arrive step by step.
