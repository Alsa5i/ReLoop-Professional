# Changelog

## 3.0.0 — source-based continuation
- Retained the actual ReLoop v2.0 centralized Node/Express/EJS/better-sqlite3 code and legacy data import.
- Added `app_sessions` persistence, device details, per-role limits and device revocation.
- Password changes revoke other sessions; account suspension revokes all.
- Enforced production Owner/session environment configuration and one-Owner identity.
- Added PWA install metadata and restricted static-only/offline caching.
- Added MIME-signature proof validation and randomized proof filenames.
- Added business profiles/locations, independently generated recurring pickups, and CSV history.
- Added material campaigns with attributed verified-weight progress, editable FAQ/other content, support center and escalation.
- Added integer smallest-unit fields for new payment allocation calculations while retaining legacy monetary columns for compatibility.
- Added Owner-only SQLite backup download, tests and release documentation.
- No multi-tenancy or fake payment/gps/emissions integrations.
