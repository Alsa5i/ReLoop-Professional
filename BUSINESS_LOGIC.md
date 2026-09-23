# ReLoop Business Logic — v3.0.0

## Platform model

ReLoop is one centrally operated recycling marketplace and operations platform. Customers, Collectors and Partners are participants in ReLoop; they are not independent tenants. The Owner controls platform rules and commercial settings.

## Role responsibilities

### Owner
Full platform authority: Admin accounts, platform settings, financial/business analytics, audit logs, backups, serious support/escalation and commercial rules.

### Admin
Daily operations: Customers/Collectors/Partners, verification, pickup assignment, payments, disputes, reports, support and content permitted by policy. Admin cannot create/remove/downgrade the Owner.

### Collector
Sees eligible/assigned collection work, accepts permitted jobs, updates collection status, records collected weight, uploads proof, confirms delivery and sees own history/earnings. Collector sees only Customer data necessary to perform the pickup.

### Partner
Manages its own recycling-operation workspace, incoming assigned deliveries, receipt confirmation, batches and related transactions. Partner cannot browse unrelated Customer records.

### Customer
Creates/tracks own pickup requests, sees own history/payments/impact, rates completed collection, submits support/safety issues, and may use business-account features when configured as a business customer.

## Pickup lifecycle

Supported workflow:

`pending → approved → assigned → accepted → en_route → arrived → collected → delivered → verified → completed`

Cancellation is supported where business rules allow. Each transition is validated server-side and appended to `pickup_status_history` with actor/time/notes as applicable.

## Weight integrity

Three different facts are preserved:

- `estimated_weight` — Customer's original estimate
- `collected_weight` — Collector's field measurement
- `verified_weight` — final authorized verification

The original Customer estimate is never silently overwritten by later collection/verification data.

## Collector assignment

Admin can assign an eligible Collector. Collectors may also claim available work where the route allows it. Claim logic is transaction-safe to prevent two Collectors from owning the same available pickup. Unavailable Collectors are not assigned automatically; an Admin override must be deliberate.

## Partner receipt and traceability

Where a Partner is assigned, receipt confirmation is tracked. Verified material can be associated with a material batch so traceability can follow:

`Customer → Pickup → Collector → Collected/Verified Weight → Material Batch → Recycling Partner → Transaction`

## Customer privacy

Collector access is limited to operationally necessary identity/contact/location/instructions for the relevant pickup. Full Customer transaction history, unrelated locations and private documents remain outside Collector access.

## Business customers

A business account is still a Customer of central ReLoop. It can hold business profile data, multiple recycling locations, recurring pickup schedules and reports. There is no tenant-specific ReLoop instance, company subscription tier or separate database.

## Recurring pickups

Supported frequencies are weekly, biweekly and monthly. The schedule is a generator only: each occurrence creates a normal independent pickup with its own reference, QR token, status history and auditability. This preserves operational traceability.

## Campaigns/sponsored programs

A campaign may define sponsor, location, material, date window and target weight. Progress is calculated from actual ReLoop pickup data; arbitrary impact numbers are not invented. Environmental conversion estimates remain disabled unless a documented factor is configured.

## Payments/commission

Payments begin `pending`. Manual confirmation requires authorized review until a real provider exists. Financial allocations use integer smallest-unit values for reconciliation. See `PAYMENTS.md`.

## Ratings

Only a Customer attached to a completed pickup can rate that service. Duplicate/unrelated ratings are prevented by pickup/customer scoping and uniqueness rules. Collector cannot edit their own rating.

## Support/disputes/safety

Support tickets have category/status/escalation. Admin handles normal tickets; serious items can be escalated to Owner. Disputes and safety reports preserve operational history instead of deleting evidence.

## Data retention / soft state

Important users/entities use status fields such as active/inactive/suspended/archived where appropriate. Historical completed pickups, transactions, status history, ratings and audit data are retained rather than destroyed simply because an account later becomes inactive.
