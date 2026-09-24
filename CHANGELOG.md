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

---
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

---
# Version 1.0.1 — Forms, accounts & experience patch

- See `FIXES_1.0.1.md` for the full change list and caveats.

# Version 1.0.0 — Official ReLoop Professional release
- Retained centralized v3.2 platform and unified login; gave the requested public release a fresh semantic version.
- Made phone installation discoverable throughout the public site and account dashboards; added `/install`, Android and iOS instructions, iOS metadata and reviewed versioned static-only SW cache.
- Added optional SMTP password reset with hashed single-use 30-minute tokens and active-session revocation, plus Owner environment-managed password notice.
- Added `PWA_INSTALLATION.md`, `RELEASE_NOTES_1.0.0.md` and new dependency-free install/cache/recovery tests.
- Did not overwrite prior releases, and did not claim live payment or browser tests without running them.

# v3.2.0 — Unified identity and onboarding
- One professionally redesigned responsive login for Owner, Admin, Customer, Collector and Partner; old Owner login URL remains a compatibility redirect.
- Owner retains its role-specific attempt throttling, restricted dashboard, no public registration, and existing session cap.
- One account form offering personal/customer, business/customer, collector and partner roles, with conditional fields and server validation.
- Automatic login after account creation; applicant dashboards communicate pending manual verification.
- Dedicated Owner/Admin roles remain provisioned through the existing secure flows, not public signup.
- Show/hide password, autofill attributes, preserved nonsecret form inputs, duplicate-account guidance, support route and retry-safe form loading.
- Partner delivery receipt explicitly rejects unverified partner accounts.

## v3.1.0 — Navigation & UX repair

- Task-grouped Owner, Admin, Customer, Collector and Partner navigation; expanded/collapsed desktop sidebar and accessible mobile drawer.
- Quick page search (Ctrl/Cmd+K), breadcrumbs, account menu, current-route feedback and clearer action shortcuts.
- Three-step pickup request, optional coordinates under Advanced, explicit collector availability update and confirmed partner receipt.
- Indeterminate saving/navigation feedback, real-success POST redirect alerts, clear error recovery, improved empty states and semantic status colors.
- Source-backed monthly revenue-vs-GMV chart on Owner dashboard and role-specific dashboard actions.
- Added `UX_AUDIT.md` and dependency-free navigation audit. Original 3.0 archive is unchanged.

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
