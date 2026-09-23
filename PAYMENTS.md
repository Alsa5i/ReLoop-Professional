# ReLoop Payments and Commission Logic

## Principle

ReLoop is a central marketplace/operations platform. Payment records support recycling transactions and service fees; they are not SaaS subscription billing.

## Supported initiation methods

The UI can record initiation via:

- MTN MoMo
- Airtel Money
- Visa/Mastercard
- Bank Transfer

These labels do **not** mean an official provider API is connected.

## Status lifecycle

New payment:

`pending`

Authorized review/integration may then move it to:

- `paid`
- `failed`
- `cancelled`
- `refunded`

Until a real provider is connected, a payment is confirmed manually by an authorized Admin/Owner with a verification note/reference. ReLoop does not automatically mark initiation as paid.

## No fake escrow

The platform may describe money as **pending verification**. It must not claim funds are held in regulated escrow unless a licensed provider contract/API actually supplies that function.

## Money representation

Core financial reconciliation stores integer smallest-unit values:

- `gross_minor`
- `commission_minor`
- `provider_fee_minor`
- `collector_payout_minor`
- `partner_payout_minor`

The configured currency determines the factor: UGX (and other configured zero-decimal currencies) use factor 1; currencies with cents use factor 100. Historical REAL columns remain for compatibility but new initiated payments use integer units for reconciliation. Treat currency/minor-factor changes as a finance migration decision once live transactions exist; do not casually change them mid-ledger.

## Reconciliation invariant

Before a payment can be confirmed, ReLoop prevents allocations that exceed gross value:

`commission + provider fee + collector payout + partner payout <= gross transaction value`

Collector payout requires the linked pickup to be completed. Partner payout requires the linked Partner relationship.

## Commission

Owner-configurable settings can include:

- percentage commission
- fixed fee
- minimum fee

Rates are not hard-coded into the workflow. Material/partner-specific contractual pricing can be added later without turning ReLoop into a tenant subscription product.

## Revenue reporting

Do not report GMV as ReLoop revenue.

- **GMV**: total marketplace transaction value.
- **ReLoop revenue**: actual commission/service income attributable to ReLoop.
- **Provider fees**: payment-processing cost.
- **Collector/Partner payout**: money allocated to participating parties.
- **Expenses**: ReLoop operating costs.
- **Net platform performance**: ReLoop revenue less applicable expenses/fees, using the dashboard's defined calculation.

## Future live provider integration

A real provider adapter must implement, at minimum:

1. Official authentication/credential handling.
2. Server-created payment request.
3. Provider reference storage.
4. Signed webhook/callback verification exactly per provider documentation.
5. Idempotency/replay protection.
6. Independent status reconciliation where the provider supports it.
7. Correct failure/refund handling.
8. Audit events.
9. Test/sandbox and production-environment separation.
10. Security and financial reconciliation tests before public launch.

Never put live provider keys into source control.
