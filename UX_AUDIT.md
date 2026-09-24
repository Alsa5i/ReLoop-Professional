# RELOOP v3.1 — PAGE & FUNCTION AUDIT

This inventory covers every EJS page from the actual previous v3 archive. It describes a **source-level review and common-shell redesign**, not a claim that every POST route passed a live server test. The original ZIP remains untouched.

## User problems and product decisions

- Waste producers need a simple request with material, approximate weight, a usable address/landmark and confirmation that their request is tracked. The form now follows that order rather than presenting optional map fields as normal requirements.
- Collectors need readable, mobile-first actions and availability under their control. Work remains protected by server-side permissions; an explicit availability-save button avoids accidental changes.
- Facilities need incoming receipts and verified quantities, not other customers’ records; the receipt control now prompts for physical confirmation.
- Staff and Owner need consistent places to find pickups, payments, disputes, site content and reports. Navigation is role- and task-based; Owner-only controls remain separate.
- The platform must distinguish actual verified pickup/revenue information from demonstrations and unconnected external systems. Revenue chart reuses the existing paid-payment SQL; it does not estimate arbitrary transactions.

## Reference product research (not cloned)

| Professional product | Publicly documented service | ReLoop adaptation |
|---|---|---|
| Rubicon RUBICONConnect | Scheduling/service changes, pickup tracking, multiple locations and recycling metrics | Clear customer pickup CTA, business locations/recurring link, step-based form and transparent status/weights |
| Recycle Coach | Material guide, collection schedules and report-a-problem | Accepted-material links, pickup tracking, persistent support and actionable navigation |
| RTS Portal | Operational visibility, customer support and audit-ready reporting | Operational dashboard, grouped nav, payment/collection reports, audit access |

Sources: https://www.rubicon.com/independent-businesses/ ; https://www.recyclecoach.com/solutions/features-overview ; https://www.rts.com/products/ ; W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/

## Common UI applied to all authenticated pages

- Unified deep-navy/teal workspace with consistent cards, headings, tables, status badges and touch targets.
- Role-based menu sections, active route, account menu, breadcrumbs, quick role action and Ctrl/Cmd+K navigation search.
- Desktop collapsed sidebar remembers an interface preference; it stores no private recycling/customer content.
- Mobile overlay/drawer supports Escape, outside tap, navigation close and visible focus; forms receive saving indicator after valid submission.
- Success toast occurs only after an actual POST handler redirects to a local GET; 4xx/5xx are not shown as success.
- ReLoop still operates as one centralized marketplace; no tenant subscriptions or fabricated payment, GPS or environmental analytics.

## Page inventory (the common shell propagates across these)

### Public — 13 pages

General visitor — learn which materials ReLoop accepts, understand the service, access support and register. Navigation remains separate from the logged-in operational workspace.

| Page | Existing function and current UI treatment |
|---|---|
| `public/about.ejs` | About — visitor/account flow retained; public menu styling, responsive controls and accessible focus updated. |
| `public/campaigns.ejs` | Campaigns — visitor/account flow retained; public menu styling, responsive controls and accessible focus updated. |
| `public/contact.ejs` | Contact — visitor/account flow retained; public menu styling, responsive controls and accessible focus updated. |
| `public/faq.ejs` | Faq — visitor/account flow retained; public menu styling, responsive controls and accessible focus updated. |
| `public/home.ejs` | Home — visitor/account flow retained; public menu styling, responsive controls and accessible focus updated. |
| `public/how-it-works.ejs` | How It Works — visitor/account flow retained; public menu styling, responsive controls and accessible focus updated. |
| `public/impact.ejs` | Impact — visitor/account flow retained; public menu styling, responsive controls and accessible focus updated. |
| `public/materials.ejs` | Materials — visitor/account flow retained; public menu styling, responsive controls and accessible focus updated. |
| `public/partners.ejs` | Partners — visitor/account flow retained; public menu styling, responsive controls and accessible focus updated. |
| `public/policy.ejs` | Policy — visitor/account flow retained; public menu styling, responsive controls and accessible focus updated. |
| `public/privacy.ejs` | Privacy — visitor/account flow retained; public menu styling, responsive controls and accessible focus updated. |
| `public/terms.ejs` | Terms — visitor/account flow retained; public menu styling, responsive controls and accessible focus updated. |
| `public/verify.ejs` | Verify — visitor/account flow retained; public menu styling, responsive controls and accessible focus updated. |

### Auth — 2 active pages (v3.2)

One universal `/login` for Owner/Admin/Collector/Partner/Customer with role-specific session limits and redirects. The old Owner URL redirects to this one screen; it is not a second visual portal. One `/register` for personal/business customers and Collector/Partner applicants, auto-login on registration and pending-verification messaging. Owner/Admin registration remains private. Retired redundant `apply.ejs`, `application-sent.ejs`, and `owner-login.ejs` screens.

| Page | Function and UI treatment |
|---|---|
| `auth/login.ejs` | Unified identity screen, back-to-site, account creation, show password, support, generic login error, mobile-first design. |
| `auth/register.ejs` | Role-selector, conditional fields, duplicate email guidance, immediate role dashboard, manually verified role notice. |

### Customer — 4 pages

Create a pickup, monitor its history, report a problem, rate eligible completed jobs, and manage business sites/recurring collection.

| Page | Existing function and current UI treatment |
|---|---|
| `customer/business.ejs` | Business — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `customer/dashboard.ejs` | Clear first-pickup action and impact/reward labels retained. |
| `customer/pickup-detail.ejs` | Pickup Detail — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `customer/pickup-new.ejs` | Now a three-step form, optional technical coordinates hidden under Advanced; original business fields and POST route retained. |

### Collector — 4 pages

See only eligible work/assigned pickups, update availability, record evidence and pickup status, and review earnings/history.

| Page | Existing function and current UI treatment |
|---|---|
| `collector/dashboard.ejs` | Availability requires explicit Update, not an automatic submit on selecting a value. |
| `collector/earnings.ejs` | Earnings — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `collector/history.ejs` | History — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `collector/pickup-detail.ejs` | Pickup Detail — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |

### Partner — 4 pages

See material deliveries assigned to the partner, confirm physical receipt, review business profile and financial history.

| Page | Existing function and current UI treatment |
|---|---|
| `partner/dashboard.ejs` | Receipt confirmation now requests confirmation before POST. |
| `partner/history.ejs` | History — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `partner/profile.ejs` | Profile — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `partner/transactions.ejs` | Transactions — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |

### Admin — 16 pages

Run operations: assign pickups, verify people/materials, manage materials/zones/batches, review payments and support, export reports.

| Page | Existing function and current UI treatment |
|---|---|
| `admin/batch-detail.ejs` | Batch Detail — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `admin/batches.ejs` | Batches — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `admin/campaigns.ejs` | Campaigns — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `admin/content.ejs` | Content — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `admin/dashboard.ejs` | Quick access to pickup and verification work, sensible recent-pickups empty state. |
| `admin/disputes.ejs` | Disputes — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `admin/materials.ejs` | Materials — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `admin/payments.ejs` | Payments — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `admin/pickup-detail.ejs` | Pickup Detail — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `admin/pickups.ejs` | Pickups — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `admin/reports.ejs` | Reports — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `admin/safety.ejs` | Safety — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `admin/support.ejs` | Support — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `admin/users.ejs` | Users — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `admin/verifications.ejs` | Verifications — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `admin/zones.ejs` | Zones — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |

### Owner — 9 pages

Govern the single platform: admins/users, commissions/settings, payment records, expenses, audit and business analytics; Owner can access operational Admin routes.

| Page | Existing function and current UI treatment |
|---|---|
| `owner/admins.ejs` | Admins — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `owner/announcements.ejs` | Announcements — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `owner/audit.ejs` | Audit — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `owner/dashboard.ejs` | Live-data monthly revenue-vs-GMV bars and shortcut links, zero-data message; metrics not fabricated. |
| `owner/expenses.ejs` | Expenses — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `owner/payments.ejs` | Payments — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `owner/settings.ejs` | Settings — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `owner/staff-performance.ejs` | Staff Performance — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `owner/users.ejs` | Users — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |

### Common — 5 pages

Authenticated profile, password/device sessions, in-app notifications, support and actionable errors.

| Page | Existing function and current UI treatment |
|---|---|
| `common/devices.ejs` | Devices — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `common/error.ejs` | Back/dashboard/support recovery controls added. |
| `common/notifications.ejs` | Notifications — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `common/profile.ejs` | Profile — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |
| `common/support.ejs` | Support — existing EJS route/data/permission logic retained; now uses shared layout/navigation and consistent components where authenticated. |

### Legacy — 3 pages

Backward-compatible historical generic records, separated from the modern day-to-day workflows.

| Page | Existing function and current UI treatment |
|---|---|
| `legacy/form.ejs` | Historical record access retained, kept out of main operational groups except the authorized Legacy records link. |
| `legacy/index.ejs` | Historical record access retained, kept out of main operational groups except the authorized Legacy records link. |
| `legacy/module.ejs` | Historical record access retained, kept out of main operational groups except the authorized Legacy records link. |

## Known gaps: do not interpret static checks as all features verified

- A full Express/browser end-to-end run is **not verified**: npm packages could not be installed from the offline cache here (`ENOTCACHED`).
- The isolated HTML/CSS shell was checked in Chromium at widths 360, 390, 412, 768, 1024 and 1440px. This is **not** a claim that each rendered EJS view or server workflow passed visual testing.
- The new loader is indeterminate and waits for a server redirect. It is not real-time progress or a promise of successful payment.
- External payment providers, GPS/maps, outbound SMS, email and remote production backups remain unconnected; do not advertise them as connected.
- Run the complete role permissions/pickup/payment workflow against a persistent staging SQLite copy before public launch.
