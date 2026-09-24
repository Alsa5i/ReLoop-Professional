# ReLoop Version 1.0.0 — Phone Installation Guide

ReLoop is an installable **Progressive Web App (PWA)**. It is the same centrally hosted website, launched from a phone home-screen icon. This package does **not** include an APK, IPA or an App Store/Play Store release.

## Before installation

1. Deploy ReLoop behind HTTPS on a public domain. Mobile browsers cannot treat a non-HTTPS IP/local-hosted website as an installable PWA. `http://localhost` is only a developer exception on the machine itself.
2. Visit `https://YOUR-DOMAIN/install`; it is linked from the public header/footer, login/registration, every role's sidebar and the app topbar.
3. Confirm `/manifest.webmanifest`, `/sw.js`, `/icons/reloop-192.png`, `/icons/reloop-512.png` and `/offline.html` load with HTTP 200.

## Android

Open ReLoop in Chrome or Samsung Internet. Go to **Install app** in the browser's menu, or tap **Install ReLoop now** when the site offers it. Confirm the prompt and find the icon on your phone's home screen/app launcher. Behavior can differ by browser and device; some add a shortcut rather than a WebAPK.

## iPhone / iPad

Open ReLoop in Safari or another supported browser. Tap the **Share** icon, then **Add to Home Screen**, then **Add**. On iOS, the Android-style `beforeinstallprompt` event is not supported; ReLoop shows accurate manual installation steps instead of a nonfunctional button.

## Offline boundaries and data protection

- The service worker caches only a small allowlist of public static files and the offline explanation.
- **It does not cache** personalized pages, account information, customer addresses, proofs, transactions, support tickets, authenticated API responses or POST bodies.
- Offline navigations display `/offline.html`. Pickup status changes, payments, login and verification require internet. Nothing is queued or synchronized while offline.
- Browser-managed storage can be cleared independently of user account data. ReLoop accounts/records remain in the server's persistent SQLite database.

## Acceptance test on a real phone

1. Log in as a Collector and Customer separately; visit `/install` and confirm device instructions.
2. Install and launch from the icon; verify it opens in standalone mode when supported.
3. Disconnect internet; navigate from the app. You should see a plain offline warning and no private cached data.
4. Reconnect and reload; submit a test pickup and ensure it is recorded exactly once.
5. Update `/sw.js` and deployment assets; verify the update replaces the old static cache.
6. Test mobile widths 360, 390 and 412 px, plus tablet. Verify forms, hamburger menu and safe-area insets on the actual target devices.

No claim is made that real-device testing has been completed by these dependency-free checks.
