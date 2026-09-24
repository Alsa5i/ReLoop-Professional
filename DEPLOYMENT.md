Version 1.0.1: upgrade by backing up your existing `data.db`, extracting the new source separately, configuring the same persistent DATABASE_PATH and applying the automatic additive username migration on first startup. Verify the Owner can sign in with the password they last set. **Do not overwrite `.env` or your existing SQLite database with files from a ZIP.** PWA users should reload the site once online so the v1.0.1 static cache activates. Run `npm run test:release`.

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
- `APP_BASE_URL=https://your-domain.example` (legacy `BASE_URL` also accepted)
- `DATABASE_PATH=/persistent/path/reloop.sqlite`
- `SESSION_SECRET` — strong random value, minimum 48 characters
- `OWNER_NAME`
- `OWNER_EMAIL`
- `OWNER_PASSWORD` — strong unique password, minimum 14 characters in production

Production startup fails if the critical session/Owner secrets are missing, too weak, or still use known example/placeholder values.

## Installation

```bash
npm install
npm run test:release
NODE_ENV=production npm start
```

The ZIP does not contain a verified npm lockfile because npm packages could not be fetched here. Run `npm install` in a controlled build environment, review the generated lockfile and commit it before public deployment. Afterwards use `npm ci` for reproducible builds.

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

SMTP recovery email is implemented but **disabled until you configure a real SMTP_HOST, SMTP_FROM and any required SMTP_USER/SMTP_PASSWORD**; set APP_BASE_URL to the public HTTPS origin and send a test email. SMS, WhatsApp, Maps and push remain unconnected and require provider-specific code, credentials and testing.

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

## Installable phone app (PWA)

After enabling HTTPS open `/install`; check the Android Chrome/Samsung Internet prompt or browser menu, and iPhone/iPad Share → Add to Home Screen. Confirm `/sw.js` and icons return 200 and no private page is cached. See `PWA_INSTALLATION.md`. No APK/IPA or app-store submission is included.

## Password recovery testing

With real SMTP credentials, request reset for a test Customer; verify delivery and expiry after 30 minutes; submit once and confirm password change. Reusing the link must fail, and active device sessions must be revoked. Owner password changes through OWNER_PASSWORD and requires a restart. Without configured SMTP, the page accurately directs visitors to Support.
