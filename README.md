# Dhaka Resident

A rental marketplace for houses, apartments, single and shared rooms, hostels, sublets and commercial spaces — starting with Dhaka and the rest of Bangladesh. Tenants search, save, enquire and request viewings; owners and property managers publish listings and manage enquiries and viewings; administrators moderate listings, users and reports.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · Lucide · MariaDB 11 (MySQL protocol) · Prisma 7 · React Hook Form + Zod 4 · Argon2id · Vitest

---

## Quick start (macOS or Windows)

Requirements: **Node.js 20.9+** (22 LTS recommended), **npm**, and **Docker Desktop** (or your own MariaDB 10.6+ / MySQL 8).

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Create your environment file
cp .env.example .env            # Windows PowerShell: Copy-Item .env.example .env

# 3. Start MariaDB (host port 33061, creates the app and test databases)
npm run db:up

# 4. Migrate, seed sample data and create a local administrator
npm run setup

# 5. Run the app
npm run dev
```

`npm run setup` prints every login you need. Open **http://localhost:3000**.

| What | URL |
| --- | --- |
| Website | http://localhost:3000 |
| Admin login | http://localhost:3000/login?next=/admin |
| Owner login | http://localhost:3000/login?next=/dashboard/listings |
| Tenant login | http://localhost:3000/login?next=/dashboard/saved |

> Using your own MariaDB/MySQL instead of Docker? Set `DATABASE_URL` (and `TEST_DATABASE_URL` for integration tests) in `.env` — both are `mysql://` URLs — then run `npm run setup`.

## Local credentials

No passwords are hard-coded. They're generated when you run the commands below and printed in the terminal.

| Account | How to get it |
| --- | --- |
| **Administrator** | Created by `npm run setup` as `admin@example.com` (override with `npm run setup -- --admin-email you@example.com`). The password is shown **once** and never written to disk. Create more admins with `npm run admin:create -- --email you@example.com --name "Your Name"`. Lost it? `npm run admin:create -- --email admin@example.com --reset-password`. |
| **Owners** (4) and **tenants** (2) | Created by the seed with fresh random passwords, printed in the terminal and saved to the git-ignored file **`.demo-credentials.txt`**. Regenerate anytime with `npm run demo:passwords`. |

Demo emails (all `@example.com`, marked as demo accounts in the app):

- Owners: `farhana.rahman`, `tanvir.ahmed`, `nusrat.jahan` (hostels), `imran.chowdhury` (commercial)
- Tenants: `sadia.islam`, `arif.hossain`

The seed refuses to run when `NODE_ENV=production`. Users can never make themselves administrators — registration only allows the tenant or owner roles, and only an existing admin (or the CLI command) can grant admin access.

## Sample content

`npm run db:seed` (included in `setup`) creates:

- Bangladesh with BDT (৳) and the Asia/Dhaka time zone; Dhaka, Chattogram, Sylhet, Rajshahi, Khulna and Cox's Bazar with neighbourhoods
- 7 property categories and 22 amenities (including accessibility features)
- **26 published sample listings** plus draft, pending, rejected and rented examples
- Sample conversations, viewing slots and requests in every status, favourites, a report and notifications

Every sample listing is flagged in the database and clearly labelled **“Sample listing”** on cards and detail pages; search can hide them. Re-running the seed replaces only demo accounts and their content. Sample photos are bundled in `public/demo-photos` (from Unsplash — see `CREDITS.txt`), so the demo works offline.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run setup` | Migrate + seed + first admin (safe to re-run) |
| `npm run db:up` / `db:down` | Start / stop the Docker MariaDB |
| `npm run db:migrate` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:migrate:dev` | Create a new migration after editing `schema.prisma` |
| `npm run db:seed` | Reseed reference and sample data |
| `npm run db:reset` | Drop everything, migrate and seed |
| `npm run admin:create` | Create an admin or reset an admin password |
| `npm run demo:passwords` | Generate new demo owner/tenant passwords |
| `npm test` | Unit tests |
| `npm run test:integration` | Integration tests against `TEST_DATABASE_URL` (data is wiped) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |

## Features

**Public site** — compact search-first homepage (keyword, type, budget, move-in date), quick categories, featured and recent listings, popular locations with live counts, how-it-works, help, contact, privacy and terms.

**Search** — city, neighbourhood, keyword, type, min/max rent, billing period, bedrooms, bathrooms, floor area, furnishing, available-by date, private/shared bathroom, amenities, pet policy, accessibility, hide samples; sort by relevance, newest, lowest or highest price. All filters live in the URL (bookmarkable), with removable filter chips, pagination, loading skeletons, empty state and reset. Desktop filters apply as you change them; mobile uses a bottom drawer.

**Property page** — photo gallery with keyboard lightbox, rent/deposit/advance/service charge/utilities/other fees, facts, amenities by group, house rules and tenant preferences, rooms-and-beds table for hostels and shared rooms, approximate-area map (OpenStreetMap, ~1 km precision, never a pin), owner-controlled address visibility (public / after an accepted viewing / private), owner profile, enquiry, viewing request, save, report, related listings. Enquiries and viewings are explicitly *not* bookings.

**Accounts** — sign up and log in with a **password** or a **one-time code** sent to an email address or a mobile number (SMS). Bangladeshi numbers can be typed as `01712-345678` and are stored as `+8801712345678`. Code-only accounts can add a password later; any account can verify a mobile number from the account page to enable SMS login. Password reset by email, plus admin-created reset links.

**Notifications** — the header bell opens a popup with the latest notifications, unread highlighting, mark-as-read and a link to the full list. It checks for new notifications every 30 seconds while the tab is visible, updates the badge and shows a toast with a “View” button. Users with an email can also receive copies by email.

**Tenant dashboard** — overview, saved properties, conversations with unread state, viewing requests (pending/accepted/declined/cancelled) with cancel, notifications, profile, notification settings and password change.

**Owner dashboard** — 7-step listing editor (type → location → details incl. room types → rent & fees → amenities & rules → photos → preview & submit) with drafts, per-step validation and a completeness checklist; photo upload, reorder, cover selection and removal; submit, withdraw, pause/resume, mark rented/relist, delete drafts; quick availability and free-bed updates (no re-review); viewing slots with overlap protection; enquiry inbox with open/closed threads; accept/decline/cancel viewings. Editing an approved listing's content sends it back for review.

**Admin dashboard** — live counts; approval queue; approve, reject with reason, unpublish with reason, feature; user search, role changes and suspension (signs the user out, pauses their listings), one-time password-reset links when email isn't configured; report review with optional unpublish; countries, cities, neighbourhoods, categories and amenities; site settings and announcement banner; email delivery status and log; full activity log of administrative changes.

## Architecture

```
prisma/                 schema, migrations, seed + seed data
scripts/                setup, create-admin, demo-passwords
src/app/(site)/         public pages, auth pages, /dashboard, /admin
src/app/api/…/photos    photo upload route (multipart)
src/app/media/[...key]  serves uploaded photos
src/proxy.ts            optimistic redirect to /login (real checks happen server-side)
src/components/         ui (shadcn), layout, listings, property, owner, dashboard, admin, forms
src/lib/                validation (Zod), auth/session, labels, formatting, dates, search params, status rules
src/server/services/    business logic with permission checks (used by actions, routes, scripts and tests)
src/server/actions/     Server Actions: session → service → revalidate
src/server/queries/     read models for pages
tests/unit, tests/integration
```

Business rules live in `src/server/services` and take the acting user explicitly, so every rule is enforced on the server and covered by integration tests independent of the UI.

**Multi-country ready:** countries carry currency code, symbol, locale and time zone; cities and neighbourhoods belong to countries; listings store their currency; viewing times are interpreted in the listing country's time zone. To add a market, add the country and cities in **Admin → Locations & catalogue** and, for local number formatting, an entry in `CURRENCIES` in `src/lib/format.ts`.

## Security

- **Passwords:** Argon2id (OWASP parameters); dummy verification for unknown emails to avoid account enumeration.
- **Sessions:** random 256-bit tokens in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` + `__Host-` prefix when `APP_URL` is https); only a SHA-256 hash is stored server-side; 30-day expiry; sessions revoked on password change/reset, role change and suspension.
- **Authorization:** every page, Server Action and route handler re-checks the session and role; services scope queries by ownership and return “not found” for other users' data. Conversations and viewings are visible only to their participants.
- **CSRF:** Server Actions use Next.js's Origin/Host check; the upload route checks Origin explicitly; cookies are `SameSite=Lax`.
- **One-time codes:** 6-digit codes from a CSPRNG, stored only as a hash, valid for 10 minutes, single use, 5 attempts per code (counted atomically before comparing), constant-time comparison, 60-second resend cooldown, at most 5 codes per destination per hour and per-IP limits. Login by code never reveals whether an account exists (unknown contacts get an identical response and cooldown). SMS login requires a verified number; verifying a number removes it from any account where it was never verified. Codes are never logged in production.
- **Rate limiting** (database-backed, atomic — a single `INSERT … ON DUPLICATE KEY UPDATE`): login per IP and per account, registration, password reset, one-time codes, enquiries, messages, viewing requests, reports, uploads.
- **Validation:** shared Zod schemas on client and server; control characters stripped; lengths bounded; lenient URL parsing for search.
- **Uploads:** size limit, decoded by `sharp` (MIME type and file name are not trusted), minimum dimensions, auto-rotated, EXIF/GPS stripped, re-encoded to WebP with random names; strict key pattern when serving (no path traversal).
- **Duplicate submissions:** idempotency keys on enquiries, messages and viewing requests; buttons disabled while pending; conditional status updates.
- **Viewing conflicts:** accepting a viewing runs in a transaction that row-locks both participants (`SELECT … FOR UPDATE`), re-checks the request is pending and rejects overlaps with confirmed appointments for the owner or the tenant. Slot offers can't overlap. Tested with concurrent accepts.
- **Content safety:** user content is rendered as text (no `dangerouslySetInnerHTML`); Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- **Privacy:** exact addresses and coordinates are never sent to the browser unless the owner allows it; the map is approximate. Dev logging of Server Action arguments is disabled so passwords never reach the terminal.
- **Secrets:** only in `.env` (git-ignored). No secrets are exposed to client code (no `NEXT_PUBLIC_` variables).

## Tests

```bash
npm test                    # unit tests: search params, status rules, validation, phone numbers, dates/time zones, formatting
npm run test:integration    # integration tests on a real MariaDB database
```

Integration tests cover authentication (hashing, sessions, suspension, rate limiting, reset tokens), one-time codes (sign-up by email and SMS, wrong-code lockout, expiry, reuse, cooldowns, per-destination limits, no account enumeration, verified-number rules, setting a password), permissions (ownership, roles, admin-only actions), the listing approval workflow, every search filter and sort, private messaging access and idempotency, and viewing conflicts including concurrent accepts. They use `TEST_DATABASE_URL`, which must differ from `DATABASE_URL`.

## External services that need configuration

| Service | Status without configuration | How to enable |
| --- | --- | --- |
| **Email (SMTP)** | Emails are **not sent**. The app says so on the notifications, account, forgot-password and admin pages; skipped emails appear in Admin → Settings. In development, password reset links are printed in the `npm run dev` terminal, and admins can create reset links from Admin → Users. | Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` in `.env` and restart. |
| **SMS (one-time codes)** | No SMS is sent. In development, codes are printed in the `npm run dev` terminal (the sign-up/login screen says so). In production, the mobile-number option is unavailable; email codes still work if SMTP is set. Admin → Settings shows the status. | Set `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. To use a Bangladeshi SMS gateway instead, add a provider in `src/server/services/sms.ts`. |
| **Map tiles** | Approximate-area maps load from OpenStreetMap's public embed (no key; internet required). | For production traffic, consider a tile provider that fits OSM's usage policy. |
| **Photo storage** | Uploads are stored on local disk in `storage/uploads` (`UPLOAD_DIR`). | For multiple servers or serverless hosting, move `src/server/services/uploads.ts` to object storage (e.g. S3/R2). |
| **Fonts** | Plus Jakarta Sans and Noto Sans Bengali are downloaded by `next/font` at build time (self-hosted afterwards). | No action needed; the first build needs internet access. |

## Troubleshooting

- **Pages show “We couldn't find that page” in development after running `npm run build`:** stop the dev server, delete the `.next` folder and run `npm run dev` again.
- **Where's my sign-up/login code?** Without SMTP or an SMS provider, the development server prints codes in its terminal: look for `[dev] One-time code for …`.
- **`Cannot find module 'mariadb-…'` or `@prisma/client-…/runtime/client` after deploying:** the bundle was built with Turbopack. Rebuild with `npx next build --webpack`.
- **Demo accounts and SMS login:** demo owners and tenants have verified numbers (e.g. `01711-000101` for Farhana), so you can try “Email or SMS code” login with them.

## Production notes

- Set `APP_URL` to your https URL (enables `Secure` cookies and correct links in emails and the sitemap).
- Run `npm run db:migrate` on deploy; do **not** run the full seed. `SEED_MODE=reference` seeds only countries, cities, neighbourhoods, categories and amenities — no demo users or sample listings. Create the first admin with `npm run admin:create`.
- Set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` when running more than one instance.
- `DB_CONNECTION_LIMIT` caps the connection pool (default 5). Shared hosting usually caps `max_user_connections` at 20 or so; raise it on a dedicated server.
- The privacy policy and terms are starter texts — have them reviewed before launch.

## Deploying to cPanel (CloudLinux Node.js / Passenger)

This is how `dhakaresident.com` is deployed; the same recipe fits any cPanel account with the **Setup Node.js App** feature.

**1. Database.** Create a MySQL database and user in cPanel (MariaDB speaks the MySQL protocol, so `provider = "mysql"` and a `mysql://` URL are correct). Put the URL in the app's `.env`.

**2. Build locally, not on the server.** Shared hosting LVE limits usually kill `next build` (`EAGAIN` / `ERR_WORKER_INIT_FAILED`), and the Turbopack build is not portable between machines:

```bash
rm -rf .next
npx next build --webpack          # --webpack is required: a Turbopack standalone build
                                  # hard-codes machine-specific module ids and fails to boot
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
rm -f .next/standalone/.env       # never ship your local secrets
tar -czf deploy.tgz -C .next/standalone .
```

**3. Upload and swap the native binaries.** `output: "standalone"` bundles the `node_modules` of the *build* machine, so the Linux builds of `sharp` and `@node-rs/argon2` have to replace the local ones (install them once on the server in a scratch directory, then copy them in):

```bash
scp deploy.tgz user@host:~/
ssh user@host 'APP=~/nodeapps/dhaka-resident; cp $APP/.env ~/env.bak
  rm -rf $APP/* $APP/.next && tar -xzf ~/deploy.tgz -C $APP && cd $APP
  rm -rf node_modules/@img/sharp-win32-x64 node_modules/@node-rs/argon2-win32-x64-msvc
  cp -r ~/apps/build/node_modules/@img/* node_modules/@img/
  cp -r ~/apps/build/node_modules/@node-rs/* node_modules/@node-rs/
  mv ~/env.bak .env && chmod 600 .env
  mkdir -p tmp && touch tmp/restart.txt'      # tmp/restart.txt restarts Passenger
```

**4. Point the domain at the app.** The Node.js app root is `~/nodeapps/<app>` with startup file `server.js`; cPanel writes a Passenger `.htaccess` into the domain's document root. **The document root stays empty apart from that hidden `.htaccess`** — that is expected, and File Manager hides it unless "Show Hidden Files (dotfiles)" is on. Do not copy application files there.

**5. Migrations.** `prisma migrate deploy` downloads a platform-specific schema engine and often stalls on shared hosting. Applying `prisma/migrations/<name>/migration.sql` with the `mysql` client and inserting the matching `_prisma_migrations` row (`checksum` = SHA-256 of the file) achieves the same result.

**6. Scripts.** `tsx` needs esbuild, which may not run on the host. Pre-bundle the seed and admin scripts locally (`esbuild --bundle --platform=node --format=esm`, externalising `mariadb`, `@node-rs/argon2`, `sharp`, `@prisma/client`, `@prisma/adapter-mariadb`, `dotenv`) and run the output with plain `node`.

**7. Email.** Point `SMTP_HOST` at the mail hostname the certificate actually covers (`mail.<domain>`, port 465, `SMTP_SECURE=true`); `localhost` fails TLS verification. Any address the app sends *to* on the same server needs a real mailbox, or delivery is rejected with `550 No Such User Here`.
