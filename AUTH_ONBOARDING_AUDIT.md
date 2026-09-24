# ReLoop v3.2 — Login, registration and onboarding review

## User problem → correction

| v3.1 behavior | v3.2 correction |
|---|---|
| Owner rejected by `/login` with a separate Owner portal | All five roles use `/login`; credentials map to the correct role on the server. Owner-specific 5-attempt budget, 2-device cap and `/owner` permissions remain. |
| Collector/partner account was created but applicant only saw a static application-sent page | Session starts immediately, then Collector/Partner dashboard displays pending manual verification. No collector job acceptance or partner receipt while unverified. |
| Create-account form was customer-only with separate application links | One registration screen for household customer, business customer, collector and recycling partner; Owner/Admin cannot self-register. |
| Duplicate email left new users stuck | Nonsecret inputs survive validation errors; duplicate email message links back to Sign in. Passwords never repopulate. |
| Request Pickup signup intent was lost in many entry paths | New household customer or returning customer signing in from that flow opens the create-pickup page. Business customers start at business-location setup. |
| Basic inputs without password visibility | Clear labels, accessible show/hide password button, autocomplete, contact support, inline validation. |
| Mobile auth used generic narrow-card style | One dedicated navy/teal desktop layout and compact single-column mobile layout; 44px+ touch targets and responsive fields. |

## Professional references (patterns, not copied design)

- https://design-system.service.gov.uk/patterns/create-accounts/ — simple and consistent account creation.
- https://design-system.service.gov.uk/components/password-input/ — show/hide password and error guidance.
- https://customer.rubicon.com/account/login — single sign-in with clear registration/help route.

## Security and support

The shared login does not mean shared privileges: Owner/Admin roles are never accepted from public registration, all access remains server-side, and application verification cannot be self-granted. Owner credentials are provisioned through environment settings; no fixed production credentials. The support link is real `/contact`; email/SMS password reset is **not** represented as available without a configured provider. Login failures intentionally avoid confirming whether an address belongs to the Owner.

## Validation

`node tests/auth-flow-contract.js` exercises the actual login and registration handlers under an isolated Express/DB/bcrypt mock, including five role redirects, legacy Owner URL, duplicates, blocked Owner signup, suspended accounts, business signup, and pending collector/partner state. `node tests/static-validation.js` plus Python schema/navigation checks cover source consistency. Full Express/browser testing remains necessary after npm dependencies are installed. Static visual preview by Chromium was attempted here but browser navigation was blocked by environment policy, so no viewport result is claimed.
