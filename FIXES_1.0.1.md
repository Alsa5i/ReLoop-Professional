# ReLoop Professional — Version 1.0.1

Patch update of Version 1.0.0. Original ZIP is unchanged.

## Fixed for everyday use

- Authenticated add/edit/action forms progressively submit with fetch. After a successful server redirect the dashboard's main content is replaced in place; navigation and the address bar update without a full document reload. When JavaScript is unavailable, the original HTML form submission continues to work.
- The request body is URL-encoded, matching the existing Express `express.urlencoded()` middleware. No uninstalled multipart library or new framework is needed.
- The submitting button is disabled only during the request and re-enabled on failure; form fields remain intact. Network errors and validation errors appear inside the form, not a separate raw-text page. No success notification appears before a server response.
- Each of the five roles (Owner, Admin, Customer, Collector, Partner) can edit a display name and a **unique username** from `/profile`. Sign in through the shared `/login` using email or username. Username is optional, case-normalized and validated by a unique SQLite index.
- Every account maintains its own bcrypt password. New accounts and Admin creation require password confirmation. Changing password requires current password, a different strong new password and confirmation; other devices are revoked and the action audited. No public/shared production demo password is created.
- Owner can change password in the same security page. `OWNER_PASSWORD` is used for bootstrap and explicit environment rotation, not to overwrite an in-app change at each normal restart.
- Non-secret form fields survive same-tab reloads in `sessionStorage`. The login identifier is restored after reload; remembering it beyond the tab is opt-in. Passwords, CSRF tokens, file contents, private verification/payment credentials are not stored by this feature. Browser password-manager autofill is the safe option for passwords.
- CSRF, login-throttle and account/password errors stay in the relevant form when supported, while HTTP status codes remain errors.
- PWA's versioned static cache includes the updated form script; private pages remain network-only.

## Important limits

A real Express deployment, native phone PWA installation, browser integration against the running server, and payment provider APIs were **not** verified in this container. Do not call this release fully production-tested until the deployment checklist is completed.

Run: `npm install`, configure `.env`, `npm run test:release`, `npm start`. Then test registration, sign-in, username changes, uploads, pickup forms, Admin creation, device revocation and password changes with each role against the actual host.
