# ReLoop Professional — Version 1.0.1

# ReLoop Professional — Version 1.0.1

## Changes since 1.0.0

- Protected authenticated POST create/update actions use asynchronous `fetch` with CSRF and same-origin cookies, followed by an in-place dashboard content refresh; no full document reload in typical operations. Navigation, authentication, logout and backup downloads still navigate normally when necessary.
- Validation and server action errors appear **inside the form** rather than taking users to standalone plaintext error pages while JavaScript is active. Disabled-JavaScript fallback uses the original server response.
- Form values are preserved for the current browser tab via `sessionStorage`, scoped to user/page/form, excluding passwords, CSRF tokens, upload content and payment/verification secrets. Logout clears account drafts.
- Unified login restores email/username after reload, with explicit opt-in for longer-lived local email/username recall. Password is never persisted by ReLoop JavaScript; browser password manager may remember it by the user's choice.
- Added unique, editable **username** alongside display name on every role's profile; login accepts email or username. Username is optional and case-normalized. A database unique index prevents duplicates.
- Registration requires a 12+ character password and matching confirmation. Changing password requires the correct current password, a different 12+ character replacement and matching confirmation; other device sessions are revoked.
- Owner may update display name/username/password without having the original `.env` provisioning password reset the new UI password on every restart. A changed `OWNER_PASSWORD` still performs a controlled rotation when its provision fingerprint changes.
- Updated PWA static-cache version and expanded route-contract tests.

**Not claimed:** full Express/browser/mobile end-to-end verification or a live payment provider integration. See `TEST_REPORT_1.0.1.md`.

## Base project documentation

# ReLoop Professional — Version 1.0.1

# ReLoop Professional — Version 1.0.1

## Changes since 1.0.0

- Protected authenticated POST create/update actions use asynchronous `fetch` with CSRF and same-origin cookies, followed by an in-place dashboard content refresh; no full document reload in typical operations. Navigation, authentication, logout and backup downloads still navigate normally when necessary.
- Validation and server action errors appear **inside the form** rather than taking users to standalone plaintext error pages while JavaScript is active. Disabled-JavaScript fallback uses the original server response.
- Form values are preserved for the current browser tab via `sessionStorage`, scoped to user/page/form, excluding passwords, CSRF tokens, upload content and payment/verification secrets. Logout clears account drafts.
- Unified login restores email/username after reload, with explicit opt-in for longer-lived local email/username recall. Password is never persisted by ReLoop JavaScript; browser password manager may remember it by the user's choice.
- Added unique, editable **username** alongside display name on every role's profile; login accepts email or username. Username is optional and case-normalized. A database unique index prevents duplicates.
- Registration requires a 12+ character password and matching confirmation. Changing password requires the correct current password, a different 12+ character replacement and matching confirmation; other device sessions are revoked.
- Owner may update display name/username/password without having the original `.env` provisioning password reset the new UI password on every restart. A changed `OWNER_PASSWORD` still performs a controlled rotation when its provision fingerprint changes.
- Updated PWA static-cache version and expanded route-contract tests.

**Not claimed:** full Express/browser/mobile end-to-end verification or a live payment provider integration. See `TEST_REPORT_1.0.1.md`.

## Base project documentation

# ReLoop Professional 1.0.1

This package updates version 1.0.0. **Start with [FIXES_1.0.1.md](FIXES_1.0.1.md)** for changes, safe draft storage and operational verification requirements.

# ReLoop Professional — Version 1.0.0

**Official final release package requested for the centralized ReLoop platform.** This builds on all v3.2 work and is not a multi-tenant SaaS conversion. New in this release: **install ReLoop on Android/iPhone via `/install`** and optional real SMTP password recovery (not fake email delivery). See [`RELEASE_NOTES_1.0.0.md`](RELEASE_NOTES_1.0.0.md), [`PWA_INSTALLATION.md`](PWA_INSTALLATION.md) and [`TEST_REPORT.md`](TEST_REPORT.md).

Quick start: `cp .env.example .env` → configure your unique Owner/session credentials → `npm install` → `npm run test:release` → `npm start`. Use a persistent SQLite volume, HTTPS and remote backups for real hosting. Public Owner registration is disabled; `/login` is shared by all roles.

**Recovery:** `/forgot-password` and `/reset-password/:token` send actual email only after `SMTP_HOST`, `SMTP_FROM` and an approved SMTP configuration are present; otherwise users are told to contact Support. A reset invalidates other active sessions. The Owner rotates credentials through `OWNER_PASSWORD` in the server environment.

**PWA:** `/install` explains Android's install prompt/browser menu and iPhone's Share → Add to Home Screen. The app does not claim to collect or update materials while offline. Installation is not equivalent to a native Play Store/APK download.

---

## v3.2 — Unified sign-in and account creation

All five roles (Owner, Admin, Collector, Partner, Customer) now sign in from **`/login`**. Owner and Admin accounts cannot be created through public registration. Existing `/owner/login` bookmarks redirect to `/login`; old POST forms continue to authenticate through the unified handler. The Owner retains the stricter five-attempt rate limit, two-session cap and Owner-only routes.

At **`/register`**, visitors select Customer, Business Customer, Collector or Partner. Customers are signed in and sent to `/customer` or `/customer/pickups/new` (when coming from Request Pickup); business customers go to `/customer/business`. Collector and Partner applicants are signed in to their role dashboards, with manual verification required before sensitive work is enabled. Duplicate-email errors link to sign-in, without re-displaying passwords. Password recovery now uses optional real SMTP delivery and single-use expiring reset tokens; without SMTP it directs users to Support rather than claiming email was sent.

> **Historical v3.1.0 notes below.** The current public release name is Version 1.0.0; see the release notes above.

# Previous release documentation: ReLoop Professional v3.0.0

ReLoop is **one centralized recycling and circular-economy marketplace and operations platform** operated by the ReLoop Owner. It connects customers/waste producers, collectors, recycling partners/facilities, ReLoop Admins and the Platform Owner.

ReLoop is **not** a multi-tenant SaaS product. Business customers and recycling partners participate in the same central ReLoop platform; they do not receive separate tenant applications, databases or subscription-controlled copies of ReLoop.

## Preserved technology stack

- Node.js 20.12+
- Express.js
- EJS, HTML, CSS and vanilla JavaScript
- SQLite via `better-sqlite3`
- Server-side sessions stored in SQLite (`app_sessions`)
- `bcryptjs` password hashing
- QR generation with `qrcode`

## Roles

| Role | Purpose | Main entry |
|---|---|---|
| Owner / Super Admin | Full platform control, Admin management, financial/settings/security oversight | `/login` → `/owner` |
| Admin | Daily operational administration, verifications, pickups, payments, disputes and support | `/login` → `/admin` |
| Collector | Mobile-first collection workflow, proof, weights, availability and earnings | `/login` → `/collector` |
| Partner | Incoming material/delivery workspace, batches and transaction history | `/login` → `/partner` |
| Customer | Pickup requests, history, payments, ratings, support and impact | `/login` → `/customer` |

Owner registration is **never** exposed publicly. Owner credentials are supplied through environment variables.

## Major commercial capabilities

- Public marketing site, accepted materials, FAQ, campaigns, contact and legal-policy templates
- Customer pickup requests with configurable materials and service zones
- Separate `estimated_weight`, `collected_weight` and `verified_weight`
- Controlled pickup status transitions plus immutable status history
- Admin assignment and transaction-safe collector claiming
- Collector verification, availability, collection proof and mobile-first job actions
- Partner verification, delivery confirmation and material batch traceability
- Persistent in-app notifications
- Ratings limited to completed pickups
- Disputes, safety reports and support tickets with Owner escalation
- Manual-verification payment flow for MTN MoMo, Airtel Money, card and bank-transfer initiation
- Integer smallest-unit financial fields for reconciliation
- Configurable commission/service economics without hard-coded rates
- GMV separated from ReLoop revenue, expenses and payouts
- Collector earnings ledger
- Business-customer locations and recurring weekly/biweekly/monthly pickups
- Sponsored recycling campaigns based on real recorded pickup weights
- Admin/Owner-controlled additional FAQ and policy-template content
- Owner SQLite backup controls and audit trail
- PWA manifest/service worker/install prompt with safe offline fallback
- Device/session management with per-role active-session limits
- Role-based private-file protection
- Pagination for Owner/Admin users, pickups and payments, plus Owner audit records
- Safe `/health` endpoint
- Legacy MVP records retained for controlled migration rather than silently deleted

## Session/device limits

These are security limits, **not subscription licenses**:

- Customer: 3 active sessions
- Collector: 2
- Partner: 3
- Admin: 3
- Owner: 2

Users can view devices at `/account/devices`, revoke one device, or log out all other devices. Password changes revoke other sessions. Suspending an account revokes its active sessions.

## Local installation

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
2. Set a strong `SESSION_SECRET`, Owner email and Owner password.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run static checks:
   ```bash
   npm run check
   npm run test:static
   ```
5. Run the fresh SQLite schema check:
   ```bash
   npm run test:schema
   ```
6. Start ReLoop:
   ```bash
   npm start
   ```
7. Open `http://localhost:3000` unless `PORT`/`BASE_URL` are changed.

Node.js 20.12+ can load the local `.env` file through native environment-file support used by this project. In production, prefer the hosting provider's secret manager/environment configuration and never commit `.env`.

## Production safety rules

When `NODE_ENV=production`, ReLoop refuses to start with a missing, weak or known placeholder `SESSION_SECRET`, or missing/weak/placeholder Owner credentials. Values copied unchanged from `.env.example` are not valid production credentials. Production must use HTTPS and persistent storage for the SQLite database. Do not run the database on an ephemeral filesystem.

The bundled payment UI does **not** imply a live provider integration. New payments are `pending` until an authorized Admin/Owner verifies them or a future real provider adapter/webhook is implemented. No licensed escrow is claimed.

## PWA/offline behavior

ReLoop can be installed as a PWA. The service worker caches only a small public/static shell. It deliberately avoids caching account dashboards, pickups, payments, proofs or other private dynamic pages. When offline, the interface explains that an internet connection is required to update pickup status or submit changes. There is no fake offline synchronization.

## Backups

The Owner can create/download local SQLite backups. Production should additionally schedule **automatic remote/off-host backups** and periodically test restoration. A backup stored only beside the live database is not sufficient disaster recovery.

## Documentation

- `CHANGELOG.md` — release changes
- `FEATURE_MATRIX.md` — implemented vs deferred capability matrix
- `SECURITY_NOTES.md` — authentication, authorization, sessions and private-data rules
- `TEST_REPORT.md` — tests actually executed and remaining deployment tests
- `DEPLOYMENT.md` — commercial hosting requirements
- `PAYMENTS.md` — payment, commission and reconciliation rules
- `BUSINESS_LOGIC.md` — roles, pickup lifecycle, traceability and business rules
- `COMMERCIAL_UPGRADE_REPORT.md` — summary of the upgrade

## Important launch boundary

The codebase is prepared for public-launch/pilot deployment, but the final production environment must still be tested after `npm install` and configuration. Real telecom/card/bank APIs, external email/SMS/WhatsApp, maps, push notifications, remote backups, monitoring and jurisdiction-specific legal/privacy review require actual provider infrastructure and are intentionally not faked in this repository.
