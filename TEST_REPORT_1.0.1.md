# ReLoop Professional v1.0.1 — Test Report

**Scope:** Patch of the actual ReLoop Professional v1.0.0 codebase. The original v1.0.0 ZIP was not overwritten.

## Completed in this environment

- `npm run check`: PASS (Node syntax for server, routes, services, scripts and both frontend JS files).
- `npm run test:static`: PASS, **88 dependency-free checks**.
- `npm run test:schema`: PASS, **33 SQLite tables** created in an in-memory DDL smoke test; the new username column and unique index are verified. This does **not** execute the full better-sqlite3 runtime migration.
- `npm run test:navigation`: PASS, **49 literal menu links, 144 template includes, 71 EJS pages/partials**.
- `npm run test:auth`: PASS, **34 route contract checks** using mocks (including shared login, username login, signup confirmation and role redirects).
- `npm run test:pwa`: PASS, **41 static PWA/password recovery contract checks**.
- `npm run test:account`: PASS, **56 route contract checks** using mocks: all five roles can change display name, username, and their own password; invalid current password, mismatch, duplicate username, session revocation and independent credentials are checked.
- Source archive integrity: checked while packaging.

## Important limits

- `npm install --offline --package-lock-only` failed with `ENOTCACHED` for bcryptjs. A live Express/better-sqlite3 HTTP run and a complete browser end-to-end run were **not completed** here.
- An optional Chromium frontend simulation did not finish within the environment timeout; it is **NOT marked as passed**.
- The asynchronous form workflow requires JavaScript. Authentication/logout and file downloads intentionally use traditional navigation. Direct GET navigation and back/forward can load a new document; ordinary authenticated POST create/update actions use in-place fetch and content replacement.
- Actual Android/iPhone PWA, screen-size checks, all role permissions, finance settlement and full pickup lifecycle require staging tests before public commercial launch.

## Acceptance checks after npm install

1. `npm install` on Node 20.12+ with network access, then `npm run test:release`.
2. Set a unique `SESSION_SECRET` and Owner credentials in `.env`; start against a fresh/preserved backup copy of SQLite.
3. Register each permitted role, sign out and sign back in with email or username; verify profile name and username edits, incorrect password messages, password confirmation and per-account password hashes.
4. Create, edit and assign pickups, save payment manual reviews, add a proof file, resolve support tickets; verify form stays on-page with inline errors while keeping non-secret fields after reload.
5. Test 360px, 390px, 412px, tablet and desktop, PWA installation/offline fallback and direct URL role access; check that private HTML is never cached.
6. Perform full staging security tests for cross-account access, CSRF, stored XSS, session caps/revocation and manual payment confirmation.
