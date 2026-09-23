# ReLoop Professional Final v3.0.0

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
| Owner / Super Admin | Full platform control, Admin management, financial/settings/security oversight | `/owner/login` → `/owner` |
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
