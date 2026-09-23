# ReLoop Security Notes — v3.0.0

## Authentication

- Passwords are hashed with `bcryptjs`.
- Public registration cannot create Owner or Admin accounts.
- Owner uses a separate `/owner/login` entry and environment-provisioned credentials.
- Login endpoints are throttled; Owner login has a stricter rate limit.
- Production rejects missing/weak or known placeholder `SESSION_SECRET` values and weak/missing/placeholder Owner credentials.
- Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- All state-changing form requests use CSRF validation.

## Server-side authorization

Authorization is enforced in Express middleware/routes, not merely by hiding navigation:

- Owner routes require Owner.
- Admin operational routes require Owner/Admin.
- Collector routes require Collector.
- Partner routes require Partner.
- Customer routes require Customer.

A user changing a URL must not gain another role's records. Customer record lookups are additionally scoped to the signed-in customer. Collector and Partner queries are scoped to assigned/eligible operational records.

## Owner/Admin separation

Only the Owner can manage Admin accounts and the most sensitive platform/business settings. An ordinary Admin cannot remove/downgrade the Owner or create a replacement Owner through public/admin registration paths.

## Sessions and devices

Sessions are persisted in SQLite `app_sessions`; Express MemoryStore is not used for production sessions. Metadata includes the session ID, approximate device/browser/OS derived from User-Agent, last active and timestamps. IP addresses are present in audit logs, not stored in the session metadata.

Active-session limits:

- Customer: 3
- Collector: 2
- Partner: 3
- Admin: 3
- Owner: 2

Users can revoke a selected device or all other devices. Password changes revoke other sessions and audit the action. Account suspension revokes all active sessions.

## Private data boundaries

Collectors receive only pickup information needed to complete assigned work, such as customer name, pickup contact, address and instructions. They do not receive a customer's full transaction history, unrelated addresses or verification/private documents.

Partner views are restricted to their own assigned deliveries/material/batches/transactions and do not expose unrelated Customer records.

Verification files and collection proof are served through authorization-checked routes and `no-store` behavior rather than public static URLs.

## File validation

Collection proof uploads are restricted to supported image/PDF MIME types and a server-enforced 2 MB size limit. Server-side parsing generates random safe filenames rather than trusting a user filename. Production should additionally integrate malware scanning if document volume/risk warrants it.

## Audit trail

Sensitive actions emit audit records, including login/failure/logout, password changes, session revocation, suspension/reactivation, verification, pickup assignment/completion, payment confirmation/status changes, commission/settings changes, Admin creation, dispute resolution and backup actions.

## Payment security

A payment record is not proof that money moved. New payments start `pending`. Manual `paid` confirmation is restricted to authorized staff and requires verification information. Integer smallest-unit fields are used for core reconciliation. See `PAYMENTS.md`.

## PWA/cache security

The service worker caches only public/static shell resources. Account, pickup, payment, proof and other private routes are deliberately excluded from normal cache handling. Offline writes/synchronization are not claimed.

## Production infrastructure responsibilities

Before public launch:

- Terminate HTTPS correctly and keep secure cookies enabled.
- Run behind a correctly configured trusted reverse proxy.
- Protect `.env`/host secrets and restrict filesystem permissions.
- Keep SQLite and backups on persistent encrypted-at-rest storage where available.
- Schedule remote backups and test restore procedures.
- Apply OS/Node dependency security updates.
- Configure centralized logs/monitoring without logging passwords, CSRF tokens or provider secrets.
- Perform deployment-environment penetration/authorization testing.
- Obtain legal/privacy review for real operating jurisdiction and data-retention policy.

## Known boundary

This source does not include live telecom/card credentials, licensed escrow, automatic government identity verification, fake GPS, or external-message-provider claims. Those integrations must be implemented against official provider documentation and retested before being described as live.
