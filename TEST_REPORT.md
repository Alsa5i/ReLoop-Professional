# Version 1.0.1 validation addendum

`npm run test:release` completed successfully in the working container, including:

- Node syntax for `server.js`, route/service/scripts and both public JS files.
- 88 static/security/view/financial source checks.
- Fresh SQLite schema smoke: 33 tables.
- Navigation/static EJS references: 49 literal links, 144 includes, 71 EJS pages/partials.
- 34 dependency-free actual-route login/registration contract checks.
- 41 dependency-free PWA/password recovery contracts.
- 56 dependency-free account/username/password handler contracts covering all five roles.
- 23 dependency-free no-reload/inline-feedback/draft/username static contracts.

**Not passed or not executed:** npm package installation and live Express startup. `npm install --offline` failed because the npm cache lacks bcryptjs (and other dependencies may be unavailable). A Chromium-based test against localhost/file navigation was attempted, but this environment blocks those navigations (`ERR_BLOCKED_BY_ADMINISTRATOR`); no successful browser end-to-end test is claimed. The optional `tests/browser-ux-smoke.py` is included for a normal local environment with Playwright/Chromium and localhost access.

These tests verify a substantial part of the code, **not** all runtime behavior. Before real launch, run the full role, password, pickup, notifications and finance workflows in a running environment and on phones.

---

# ReLoop Professional — Version 1.0.0 test report

**Status:** source release packaged; runtime and device acceptance testing still required before accepting real transactions. These results were run on the Version 1.0.0 source (not copied from the previous version).

| Test | Result | Evidence / limitation |
|---|---|---|
| Node syntax — all JS under `server.js`, `src/`, `scripts/`, public UI | PASS | `npm run check` |
| Static security/view/financial assertions | PASS — 88 checks | `npm run test:static`; does not replace real security tests |
| Fresh SQLite DDL smoke | PASS — 33 tables | `npm run test:schema`, checks password recovery token table as well |
| Literal menu links / EJS include references | PASS — 49 links, 144 includes, 71 templates/partials | `npm run test:navigation`; no live EJS render test |
| Unified login/registration mocked contract | PASS — 30 checks | `npm run test:auth`; not a real HTTP test |
| PWA installation/cache boundary and password recovery static contracts | PASS — 41 checks | `npm run test:pwa`; includes mocked service-worker fetch/caching behavior, icons, manifest, iOS metadata |
| Dependency installation / lockfile | BLOCKED | `npm install --offline --ignore-scripts --no-audit --no-fund --package-lock-only` fails `ENOTCACHED` for bcryptjs; npm packages not available in this runtime |
| Real Express startup, routes, SQLite auth and payment flow | NOT RUN | Requires `npm install` and staging Owner/role accounts |
| Real SMTP reset email delivery | NOT RUN | Requires verified provider SMTP values and public HTTPS base URL |
| Physical Android and iPhone home-screen installation | NOT RUN | Requires HTTPS host and device/browser acceptance testing |
| Full mobile/browser QA at 360/390/412/tablet/desktop | NOT RUN for 1.0.0 | Static responsive CSS added; no actual authenticated browser session |
| Real payment providers / settlement | NOT CONNECTED | Manual verification remains required; no paid status inferred from UI |

Run on the deployed staging host: `npm install && npm run test:release && npm start`. Test all five role dashboards with direct URLs; verify customer registration, account relogin, the complete pickup journey, collector claiming, partner proof/receipt, correct fees, cross-user privacy, CSRF, device revocation and suspension, password reset once/expired/owner exclusion and accurate payment states. Test on Android/iPhone over HTTPS and verify sensitive history never appears offline.

---

## Previous release reports (historical, not v1.0.0 test claims)

# ReLoop Professional v3.2 — Login/Onboarding Release Test Addendum

Date: 2026-09-23. The entries below were executed against the actual v3.2 source; any lower v3.1/v3.0 sections are historical results on previous releases.

| Check | v3.2 result |
|---|---|
| Node syntax, server, routes, services, scripts, client JavaScript | PASS |
| Actual login/registration route-handler contract tests with in-memory dependency substitutes | PASS — 30 assertions across 5 roles, 4 signup variants and error/legacy paths |
| Source security/view/financial checks | PASS — 85 assertions |
| Fresh SQLite DDL smoke | PASS — 32 tables |
| Navigation audit | PASS — 48 menu links and 139 EJS include refs; 68 views/partials |
| npm dependency installation | UNAVAILABLE — `npm install --offline` returned `ENOTCACHED` (bcryptjs) |
| Live Express + actual SQLite + bcrypt + session + CSRF end-to-end | NOT RUN: dependencies unavailable; mock-route tests do not prove this |
| Browser widths 360/390/412/768/1440 for v3.2 | NOT RUN: Chromium navigation blocked by environment administrator, including a local static preview |
| Production email/SMS password reset | NOT IMPLEMENTED; links to real `/contact` support instead of pretending automatic reset exists |

Before production deployment, run `npm install`, `npm run check`, `npm run test:auth`, `npm run test:static`, `npm run test:schema`, `npm run test:navigation`, and test sign-in, account creation and all five dashboards using a staging database and real Chrome/Android devices. Full auth, CSRF, Owner throttling, and pending-verification browser flows require a live smoke test. Keep original SQLite backups and do not use demo production secrets.

---

## v3.1.0 UI/navigation update — test addendum

- PASS `npm run check`: server, routes, services and scripts pass Node syntax check.
- PASS `node --check public/js/app.js`: client JS parses.
- PASS `npm run test:static`: 91 source/security/view/money assertions.
- PASS `npm run test:schema`: clean SQLite schema generation; 32 tables.
- PASS `python3 tests/navigation-audit.py`: 48 literal nav destinations correspond to GET endpoints, 142 local EJS includes resolve, 71 EJS views/partials inspected.
- PASS isolated Chromium CSS shell smoke at widths 360, 390, 412, 768, 1024, 1440px: no document-width overflow in the representative shell. This preview used illustrative local content, not real server data.
- NOT RUN complete Express request, EJS render, authenticated workflow, live payment or every-page browser tests because `npm install --offline` failed `ENOTCACHED` for bcryptjs and dependencies were unavailable.
- NOT VERIFIED all device/browser combinations; check a real Android browser and tablet after staging deployment.
- Original ZIP was not overwritten; run production/staging migrations against a backup.

# ReLoop Professional Final v3.0.0 — TEST REPORT

Date: 2026-09-23

## Source verified

This package was reconstructed from the **actual ReLoop Professional Platform v2.0 ZIP** available in this conversation plus newly applied improvements. The original ZIP was not overwritten. Previously described v3 source files were **not available**; older v3 reports describing a 33-table schema or a completed runtime suite are not evidence of this reconstructed source.

## Tests performed in this execution

| Test | Result | Evidence |
|---|---|---|
| All JavaScript source syntax | PASS | `npm run check` (`node --check` on server/src/scripts) |
| Source security/authorization/route-view checks | PASS | `npm run test:static`: **91 checks** |
| Currency-integer arithmetic helper checks | PASS within static suite | UGX and 2-decimal cases; commission and allocation invariant |
| Fresh SQLite DDL smoke | PASS | `npm run test:schema`: **32 tables**; required fields and a session foreign-key insert |
| Original archive preserved | PASS | Build is in independent `ReLoop_Professional_Final` folder |
| Runtime HTTP test | **NOT RUN** | Dependencies missing; `npm install --offline` reports `ENOTCACHED` for bcryptjs |
| Actual browser/mobile tests | **NOT RUN** | No running Express deployment/browser test suite |
| Live payment/webhook, maps, email/SMS, remote backups | **NOT RUN** | Real provider infrastructure absent |

## Must complete before public commercial launch

1. Run `npm install` in a Node.js 20.12+ build environment with access to npm, then `npm run check`, `npm run test:static`, `npm run test:schema`, and start the server against a throwaway database.
2. Verify direct URL permissions for Owner, Admin, Collector, Partner, Customer and unauthenticated visitors. Verify access to another customer's pickup and collection proof is blocked.
3. Test the full Customer → Admin assignment → Collector status → Partner receipt → Admin verification/completion → Customer rating journey.
4. Test 3/2/3/3/2 session caps, device revocation, password-change revocation, suspension, CSRF, login throttling and stale-session behavior.
5. Test payout allocations and recorded currency values, invalid amounts, refunds and finance reconciliation. Financial controls need an independent accounting review before live money.
6. Test PWA install/offline behavior and mobile widths 360px, 390px, 412px, tablet and desktop; ensure no account content is cached offline.
7. Test recurring pickup generation over month boundaries/timezones and service-area rules. Review campaign attribution and impact data against original receipt evidence.
8. Configure HTTPS, a persistent SQLite volume, remote backups, strong secrets and production monitoring. Review all legal-policy templates with qualified counsel.

**Scope statement:** Syntax/static/DDL success is not a substitute for a complete running app, real browser, security penetration or financial integration test. The package is an implementation candidate for pilot deployment, not independently certified production-ready.
