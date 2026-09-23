# ReLoop Production Deployment Guide

## Hosting requirements

Use hosting that supports:

- Node.js 20.12 or newer
- HTTPS/custom domain
- environment variables/secrets
- a **persistent writable filesystem** for SQLite
- process restart/health supervision
- logs and basic monitoring
- scheduled remote/off-host backups

Do not deploy the live SQLite database on a filesystem that disappears on restart/redeploy.

## Required environment

Start from `.env.example`. At minimum configure:

- `NODE_ENV=production`
- `PORT`
- `BASE_URL=https://your-domain.example`
- `DATABASE_PATH=/persistent/path/reloop.sqlite`
- `SESSION_SECRET` — strong random value, minimum 32 characters
- `OWNER_NAME`
- `OWNER_EMAIL`
- `OWNER_PASSWORD` — strong unique password, minimum 14 characters in production

Production startup fails if the critical session/Owner secrets are missing, too weak, or still use known example/placeholder values.

## Installation

```bash
npm ci
npm run check
npm run test:static
npm run test:schema
NODE_ENV=production npm start
```

If a lockfile is not yet generated in your build workflow, run `npm install` once in a controlled development/build environment and commit the generated lockfile after dependency review.

## Reverse proxy / HTTPS

Use a reverse proxy or hosting ingress that terminates TLS and forwards the request correctly. ReLoop's production cookie security expects HTTPS. Confirm the proxy/trust configuration matches your provider before launch; do not blindly trust arbitrary forwarding headers on an internet-exposed Node process.

## SQLite production guidance

SQLite is intentionally retained for the current ReLoop scale. Recommended operational rules:

- Put `DATABASE_PATH` (or `DB_PATH`) on persistent storage.
- Keep WAL mode enabled as configured.
- Keep sufficient free disk space for DB/WAL/backups.
- Avoid network filesystems that do not safely support SQLite locking.
- Run only the concurrency model validated for the host; avoid multiple independent app instances sharing an unsuitable SQLite filesystem.
- Schedule off-host encrypted backups and test restore regularly.
- Move to a managed client/server database only when usage/concurrency/availability needs justify it, not for fashion.

## Backups

Owner UI and `npm run backup` create local SQLite backups. A local backup is only the first layer. Production should copy backups to independent remote storage with retention policy and restoration drills.

## Process management

Use the hosting provider's supervisor or a process manager/system service to restart the Node process after crashes/reboots. Configure graceful shutdown and log retention. `/health` can be used for a safe health probe.

## Payment integrations

Do not enable a live payment claim until official merchant credentials, provider endpoints, callback signature verification, idempotency and reconciliation are implemented and tested. Current source supports a pending/manual-verification workflow. See `PAYMENTS.md`.

## External integrations

Email, SMS, WhatsApp, Maps and push credentials in `.env.example` are placeholders only. Connecting them requires provider-specific code, credentials and testing.

## Launch checklist

1. Run `npm run check`, `npm run test:static` and `npm run test:schema` in a production-like build environment.
2. Test every role using direct URLs, not only navigation.
3. Test the complete Customer → Admin → Collector → Partner → verification → payment → rating journey.
4. Verify payment reconciliation with representative amounts/currency rules.
5. Test device revocation, suspension and password-change session invalidation.
6. Test private proof/verification documents with unrelated accounts.
7. Browser-test 360px, 390px, 412px, tablet and desktop widths.
8. Confirm PWA install/offline fallback and that private pages are not cached.
9. Configure HTTPS/domain/monitoring/backups.
10. Complete legal/privacy/payment-provider review before accepting real money or sensitive operational documents.

## Database persistence

Set `DATABASE_PATH=/app/data/reloop.db` for a mounted persistent volume on a compatible host, or use `DB_PATH`. Create the `/app/data` directory/mount before starting Node. Sessions and operational data use the same SQLite file; preserve its WAL requirements.

## Scheduled business pickups

ReLoop generates due recurring pickups when the server starts and hourly while the server is running. For operational reliability, also arrange an appropriate controlled server cron job (`npm run pickups:generate`) in deployments that may sleep; generator advances each independent occurrence transactionally.
