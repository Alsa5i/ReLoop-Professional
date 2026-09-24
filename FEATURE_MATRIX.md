# ReLoop Feature Matrix — v3.0.0

Legend: **Implemented** = present in code; **Prepared** = architecture/UI placeholder exists but real provider integration is intentionally absent; **Deferred** = not added because it would require unsupported infrastructure or was optional/nonessential.

| Area | Status | Notes |
|---|---|---|
| Centralized ReLoop platform | Implemented | No tenant/subscription SaaS model |
| Owner / Super Admin | Implemented | Shared `/login` with all roles; Owner-only controls and additional throttling |
| Admin operations | Implemented | Operational access without Owner-only Admin/settings authority |
| Customer workspace | Implemented | Own pickups/history/payments/ratings/support |
| Collector mobile workspace | Implemented | Availability, jobs, statuses, proof, weights, earnings |
| Partner workspace | Implemented | Assigned deliveries, batches and transactions only |
| Material categories | Implemented | Database managed |
| Service zones | Implemented | Configurable city/area service definitions |
| Pickup lifecycle/history | Implemented | Controlled states and history records |
| Separate weight values | Implemented | Estimate, collected, verified preserved separately |
| Admin collector assignment | Implemented | Availability respected; explicit override possible |
| Available-job claiming | Implemented | Transaction-safe claim logic |
| Collector verification | Implemented | Manual approval; no fake identity API |
| Partner verification | Implemented | Manual approval; private identification information stored in protected profile fields (document uploads are not implemented) |
| Collection proof | Implemented | Authorized private storage/access |
| Material batches | Implemented | Traceability for combined material |
| QR verification | Implemented | Random token; no sensitive raw DB payload |
| Ratings | Implemented | Completed service only, one pickup review |
| Disputes | Implemented | Operational resolution and audit history |
| Safety reports | Implemented | Fraud/harassment/suspicious-conduct reporting |
| In-app notifications | Implemented | Persistent DB notifications |
| External email/SMS/WhatsApp | Prepared | Requires real provider/API credentials |
| Socket.IO realtime | Deferred | Not forced into current architecture; normal persisted updates remain authoritative |
| Chat/messaging | Deferred | Not added simply to increase feature count; support/assigned workflows remain safer |
| Payments UI | Implemented | MTN MoMo, Airtel Money, card, bank-transfer initiation |
| Live payment APIs | Prepared | No fake live API; provider integration required |
| Manual payment verification | Implemented | Authorized, audited, note/reference required |
| Licensed escrow | Deferred | ReLoop does not claim technical escrow without provider support |
| Commission/service economics | Implemented | Configurable Owner settings; integer reconciliation |
| Collector earnings | Implemented | Traced to completed jobs |
| GMV vs ReLoop revenue | Implemented | Separated in analytics |
| Expenses/net performance | Implemented | Owner financial analytics |
| Environmental volume | Implemented | Real recorded/verified weights |
| Derived CO2/tree estimates | Prepared | Display only when Owner configures a documented factor; defaults off |
| Customer impact profile | Implemented | Based on actual completed/recycled data |
| Rewards/referrals | Deferred | Optional; not added without a sustainable rule/business model |
| Campaigns/sponsored programs | Implemented | Target/progress from real pickup weights |
| Business customers | Implemented | Central-platform customers, not tenants |
| Business locations | Implemented | Multiple saved recycling locations |
| Recurring pickups | Implemented | Weekly, biweekly, monthly; each generated pickup is independent |
| Support center | Implemented | Categories/status/escalation |
| Public content management | Implemented | Additional FAQ entries and legal-policy templates; announcements/campaigns have dedicated management |
| Terms/privacy/policies | Implemented | Templates explicitly require professional legal review |
| Persistent device sessions | Implemented | SQLite `app_sessions` |
| Device management | Implemented | View/revoke individual/all-other devices |
| Role session limits | Implemented | 3/2/3/3/2 by Customer/Collector/Partner/Admin/Owner |
| Password-change revocation | Implemented | Retains current session where appropriate |
| Suspension revocation | Implemented | Active sessions revoked |
| bcrypt hashing | Implemented | Passwords stored as bcrypt hashes |
| CSRF | Implemented | Mutating requests require session token |
| Login throttling | Implemented | Separate Owner limit |
| PWA | Implemented | Manifest/icons/SW/install prompt |
| Full offline data sync | Deferred | Explicitly not claimed |
| Responsive UI | Implemented | Mobile/tablet/desktop CSS; Collector prioritized |
| Pagination | Implemented | Major high-volume operational lists |
| Soft status/history | Implemented | Historical pickup/payment records retained |
| Local SQLite backups | Implemented | Owner controls + CLI backup |
| Remote/off-host backups | Prepared | Deployment responsibility |
| Safe health endpoint | Implemented | No paths/secrets/credentials |
| Multi-tenant SaaS | Not implemented by design | Violates ReLoop business principle |

## Official Version 1.0.0 additions
| Capability | Status | Notes |
|---|---|---|
| Install on Android | Code added; device verification pending | `/install`, manifest, browser install prompt/menu |
| Install on iPhone | Code added; device verification pending | Apple touch icon, Share → Add to Home Screen instructions |
| Offline safety | Tested in dependency-free SW harness | Public static-only cache, offline fallback, no private pages |
| Password recovery | Implemented; SMTP/live HTTP testing pending | 30-minute single-use tokens, session revocation, email requires real relay |
| All 5 role login | Preserved from v3.2; live runtime retest pending | Unified login and role dashboards |
