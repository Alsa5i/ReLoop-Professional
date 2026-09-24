# ReLoop Professional — Version 1.0.0

**Official release name:** `ReLoop_Professional_version_1.0.0`.

The 1.0.0 label is the requested public product release name. It is a continuation of the v3.2 source, **not a downgrade** or newly invented software. The prior archives were not overwritten.

## In this release

- Kept centralized Owner/Admin/Collector/Partner/Customer roles, SQLite-backed sessions, existing service workflows and the responsive v3.2 design.
- Visible `/install` page, public and logged-in installation links, manifest identity/start URL/shortcuts, Android browser prompt, iOS Share → Add to Home Screen instructions, and Apple touch icon metadata.
- Static-only service worker with versioned cache and network-first authenticated navigation; offline page states explicitly that pickups/payments cannot be updated offline.
- Real optional SMTP password recovery: 32 random bytes per token, SHA-256 hashed token in SQLite, 30-minute expiry, one-use atomic claim, per-IP throttling, account-nondisclosure, and revocation of all active sessions after reset. Owner password remains centrally controlled by `OWNER_PASSWORD` and is excluded from public reset.
- New documentation and dependency-free PWA/password recovery contract tests.

## External requirements before accepting real customers

Run `npm install` on a Node.js 20.12+ machine with access to npm. Test real HTTP auth/CSRF/roles/pickup/payment routes and browsers; deploy via HTTPS, persistent SQLite volume and external backups. Configure real SMTP credentials for password recovery and verify delivery. Telecom/card/bank automatic collection and automated SMS/WhatsApp are **not connected** and payments require independent verification. Complete legal and data-protection review before public operation.
