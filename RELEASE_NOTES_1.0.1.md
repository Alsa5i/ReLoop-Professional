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
