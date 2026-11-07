# Software Requirements Specification (SRS)
## Amar Gram, Organic & General E-commerce Platform

| Field | Value |
|---|---|
| Document | Software Requirements Specification |
| Product (working title) | **Amar Gram** |
| Version | 3.1 (Draft for stakeholder review) |
| Date | 2026-11-07 |
| Status | Draft — pending sign-off |
| Source brief | Amar Gram brief from the business owner, 2026-10-23 (replaces the original brief, retired in v3.0) |
| Change control | See [§0 Document Revision History](#0-document-revision-history) |

---

## 0. Document Revision History

Every change to this document is recorded here before the change is made. The version number increments as:
**major** (x.0) when the product itself changes — a business line added or removed, or a fundamental change of purpose · **minor** (1.x) for requirements added, removed, deferred to a later phase, or materially reworded · **patch** (1.0.x) for typos, formatting and clarifications that do not change meaning.

*Note: deferring a capability to a later phase is a minor change, because the product's scope is unchanged — only its delivery sequence moves. Removing a capability permanently, or changing which business lines exist, is major.*

| Version | Date | Author | Change summary | Sections / IDs affected |
|---|---|---|---|---|
| 1.0 | 2026-09-19 | Claude Opus 5 | Initial draft created from the business brief in `instructions/srs_instruction.md`, covering the original product's four business lines, among them the retail shop and imported-food sourcing. 181 functional requirements, 46 non-functional, 15 business rules, 22 acceptance scenarios, 15 open questions. | All (new document) |
| 1.0.1 | 2026-09-19 | Claude Opus 5 | Added §0 Document Revision History and the change-control procedure below; added it to the header table and table of contents. No requirement text changed. | §0 (new), header table, ToC |
| 1.0.2 | 2026-09-19 | Claude Opus 5 | Derived the product backlog `docs/USER_STORIES.md` v1.0 from this SRS: 180 user stories, each tracing to the requirement IDs it satisfies. No requirement text changed; cross-reference to the backlog added in §0.2. A two-way coverage audit initially found four requirements with no story (FR-ACC-11, FR-IMP-16, FR-SHP-15, and an apparent FR-BRD-23 that proved to be example text in §0.1, not a real requirement); stories US-ACC-13, US-IMP-16 and US-SHP-14 were added to close the three real gaps. Every FR ID in this document is now traced by at least one story. | §0.2 (new cross-reference); no requirement IDs added, changed or removed |
| 2.0 | 2026-09-20 | Claude Opus 5 | **An identification capability removed from the product entirely at the business owner's instruction.** It is not in general use in Bangladesh, so it was removed permanently rather than deferred — which makes this a major version under the rule in §0 above. Struck HW-3 (reader input) in place, preserving the ID, and removed the identifier from the UI-2 global search fields, the §2.4 peripherals list and §6. The corresponding story was updated in `docs/USER_STORIES.md`. Requested and approved by the business owner. *(The sections it touched were later withdrawn in v3.0.)* | §2.4, §3.1 UI-2, §3.2 HW-3, §6 |
| 1.1 | 2026-09-19 | Claude Opus 5 | **Payment gateway integration deferred out of current scope at the business owner's instruction.** Online card and mobile-wallet payment, saved payment tokens, and automated gateway refunds are removed from the launch build and moved to a later phase. Launch payment methods are now cash on delivery, in-store cash, in-store card via a standalone terminal recorded manually, and bank transfer confirmed by staff. Reworded FR-ORD-8, FR-ORD-9, FR-ORD-14, FR-ORD-17, FR-BRD-7, FR-SUB-2, FR-BIL-7; added FR-ORD-21, FR-ORD-22, FR-BIL-12; amended A-2, BR-15, §1.2 scope, §3.3 interfaces, §10 release plan, AC-8, AC-17. Parks Q-2 (gateway choice) and raises the priority of Q-3 (COD policy), which now governs the primary payment method rather than a secondary one. Corresponding stories updated in `docs/USER_STORIES.md` v1.1. Requested and approved by the business owner. | §1.2, §2.6 A-2, §3.3, §4.6, §4.9, §4.10, §4.11, §7 BR-15, §9, §10, §11 |
| 2.1 | 2026-09-22 | Claude Opus 5 | **Phone and email verification removed from the product at the business owner's instruction; registration protected by a CAPTCHA instead.** An account is usable as soon as it is created — no OTP or signed-link verification gates registration or checkout. Withdrew FR-ACC-2 (struck through, ID retained). Added FR-ACC-13: a self-hosted, single-use CAPTCHA on registration, with an in-person alternative for users who cannot solve it. Reworded FR-ACC-4 (reset token now goes to the *registered* mobile number or email, since no channel is verified). Extended NFR-SEC-6 to the registration and CAPTCHA-issue endpoints. Amended AC-1 (no OTP verification in the pass condition). Added Q-16 (what "incomplete" means for a walk-in record now that there is no verification, FR-ACC-9) and Q-17 (acceptability of the non-visual CAPTCHA alternative). OTP **login** (FR-ACC-3) and OTP as a transactional notification (FR-NTF-4) are unchanged — they are sign-in, not verification. This is a minor version: a requirement is withdrawn, no business line changes. Corresponding stories updated in `docs/USER_STORIES.md` v2.2 (US-ACC-01 reworded, US-ACC-02 and US-ACC-03 withdrawn, US-ACC-05 and US-ACC-10 amended), and `docs/handover/HO-US-ACC-01-BE.md` / `-FE.md` amended before implementation started. Requested by the business owner. | §4.1 FR-ACC-2, FR-ACC-4, FR-ACC-13 (new); §6.3 NFR-SEC-6; §9 AC-1; §11 Q-16, Q-17 (new) |
| 2.2 | 2026-09-22 | Claude Opus 5 | **Accounts and Identity simplified to identifier + password, at the business owner's instruction: no phone, email or OTP verification of any kind.** Customers register with a mobile number and/or an email plus a password (behind the CAPTCHA of FR-ACC-13) and log in with either identifier and their password. Reworded FR-ACC-1 (either identifier may be used; each is unique across customer accounts, because both are now login identifiers). Reworded FR-ACC-3 (OTP login removed; login failures do not reveal whether the identifier exists). FR-ACC-4 password reset **retained** at the owner's choice — a single-use reset token is account recovery, not verification. **Withdrew FR-ACC-8** (two-factor authentication for privileged staff) at the owner's instruction — staff also sign in with identifier and password. Reworded FR-ACC-9 (a walk-in record is incomplete until the customer sets a password) and narrowed Q-16 accordingly. Removed OTP from NFR-SEC-6, FR-NTF-4 and the §3.3 SMS gateway row. Minor version: requirements withdrawn and reworded, no business line changes. Corresponding stories updated in `docs/USER_STORIES.md` v2.3. Requested by the business owner. | §3.3; §4.1 FR-ACC-1, FR-ACC-3, FR-ACC-4, FR-ACC-8, FR-ACC-9; §4.12 FR-NTF-4; §6.3 NFR-SEC-6; §11 Q-16 |
| 2.3 | 2026-09-22 | Claude Opus 5 | **Staff sign-in made explicit, at the business owner's instruction.** No requirement said how staff authenticate: FR-ACC-3 covered customers only, and the staff sign-in step had lived inside the now-withdrawn FR-ACC-8. Reworded FR-ACC-3 to cover staff as well as customers (mobile number or email plus password, no OTP; staff and customer sessions are separate). Reworded FR-ACC-4 so password reset also serves staff, and so a new staff account's first password is set through it. Corresponding story US-ACC-14 added in `docs/USER_STORIES.md` v2.4; the Accounts handovers are consolidated into `docs/handover/HO-ACC-001.md` (backend) and `HO-ACC-002.md` (frontend). Requested by the business owner. | §4.1 FR-ACC-3, FR-ACC-4 |
| 2.4 | 2026-09-23 | Claude Opus 5 | **Constraint C-6 aligned with how money is actually implemented, and the platform choices for file storage and message transports recorded.** C-6 said money is *stored* as integer minor units. The implementation computes in integer minor units — which is what C-6 exists to guarantee — but stores `numeric(12,2)`, matching the column type already specified across the handovers and keeping amounts readable in SQL for reconciliation. Two handovers reached that conclusion independently before the disagreement was noticed. Reworded C-6 to require integer-minor-unit **arithmetic** and an exact decimal **column**, and to keep the prohibition on floating-point money, which is unchanged. Recorded as ADR-317. No functional requirement changes and no business line is affected, so this is a minor version. Also records the owner's choice of **Google Cloud Storage** for uploaded files (ADR-318) and **ClamAV** for scanning them (ADR-319), which close NFR-SEC-5's implementation gap, and **SMTP/MailKit plus a config-driven SMS gateway** for notification transports (ADR-320); an SMS aggregator account is still an outstanding commercial decision. | §7 C-6; §6.3 NFR-SEC-5 (implementation note); §3.3 |
| 3.0 | 2026-10-23 | Claude Opus 5.5 | **Product pivot at the business owner's instruction: the platform becomes Amar Gram, a general e-commerce shop that sells any kind of product, with an initial focus on organic goods.** The original product's service business lines, and the shared profile record that tied them together, are removed permanently — a change of business lines, so this is a major version. §4.2–§4.6 are withdrawn in full; their IDs are retained as withdrawn and never reused. Appendix E withdrawn. §1.1, §1.2 and §1.3 rewritten for a multi-category shop. References remaining in other sections were superseded by this row and removed in v3.1. Corresponding sections removed from `docs/USER_STORIES.md` v3.0, and the handovers for the withdrawn areas are retired. Requested by the business owner. | §1.1, §1.2, §1.3, §4.2–§4.6 (all requirements withdrawn), Appendix E |
| 3.1 | 2026-11-07 | Claude Opus 5.5 | **Leftovers of the original product removed, at the business owner's instruction (2026-11-07).** Every section now describes Amar Gram only. Rewritten for the shop: §1.4, §1.6, §2.1–§2.6, §3.1–§3.3, FR-ACC-10, FR-ACC-11, FR-SHP-1, FR-SHP-4, FR-SHP-5, FR-SHP-9, FR-SHP-13, FR-IMP-3, FR-IMP-6, FR-IMP-9, FR-IMP-11, FR-IMP-15, FR-ORD-4, FR-ORD-15, FR-ORD-19, FR-SUB-1, FR-BIL-2, FR-NTF-3, FR-NTF-4, FR-ADM-3, FR-ADM-4, FR-ADM-5, FR-POR-1, §5, NFR-PRF-4, NFR-AVL-1, NFR-AVL-3, NFR-SEC-8, NFR-USA-1–3, NFR-LEG-4, NFR-LEG-5, NFR-SCL-2, BR-3, BR-10, BR-11, BR-16, §8, AC-1, AC-5, AC-10, AC-16, AC-18–AC-20, §10, Q-1 and Appendices A–D. **Withdrawn, IDs never reused:** C-1, C-2, A-6, A-7, A-8, UI-7, FR-SHP-11, FR-SHP-12, FR-SUB-6, FR-NTF-7, FR-POR-2, FR-POR-3, FR-POR-4, D-1, D-7, D-8, D-10, NFR-LEG-1, BR-1, BR-2, BR-5–BR-9, BR-12, BR-13, AC-2–AC-4, AC-7, AC-11–AC-15, Q-6, Q-7, Q-9, Q-10, Q-11, Q-15, release Phase 3, Appendix B.1, B.2 and B.4. Stories updated in `docs/USER_STORIES.md` v3.1. | As listed |

### 0.1 Change control procedure
1. Each edit adds one row above, newest last, before the edit is applied.
2. The **Version** and **Date** fields in the header table are updated to match the newest row.
3. Rows name the specific requirement IDs added, changed or removed (e.g. "added FR-SHP-16; reworded FR-SHP-10") so changes are traceable to design and test artifacts.
4. Requirement IDs are **never reused**. A withdrawn requirement is struck through and marked *Withdrawn in vX.Y* rather than deleted, so historical references remain resolvable.
5. Changes that resolve an open question from §11 cite the question ID (e.g. "resolves Q-8").
6. A change that alters agreed scope requires re-approval from the business owner; the row records who approved it.

### 0.2 Related documents
| Document | Contents | Kept in step with this SRS by |
|---|---|---|
| [`docs/USER_STORIES.md`](USER_STORIES.md) | 180 implementation-ready user stories derived from these requirements, each carrying a `Traces:` line back to the FR/NFR IDs it satisfies | Any change to a requirement here must be reflected in the stories that trace to it; the revision row names the affected IDs so the impacted stories can be found by searching for them |

---

## Table of Contents
0. [Document Revision History](#0-document-revision-history)
1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [External Interface Requirements](#3-external-interface-requirements)
4. [Functional Requirements](#4-functional-requirements)
5. [Data Requirements](#5-data-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Business Rules](#7-business-rules)
8. [Reporting and Analytics](#8-reporting-and-analytics)
9. [Acceptance Criteria](#9-acceptance-criteria)
10. [Release Plan](#10-release-plan)
11. [Open Questions and Decisions Required](#11-open-questions-and-decisions-required)
12. [Appendices](#12-appendices)

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements for **Amar Gram** ("my village"), a single integrated e-commerce system for a business that sells **any kind of product** online and from its own outlets. The initial focus is **organic and village-sourced goods** (rice and grains, honey, spices, oils, dairy, fresh produce, natural care products), but the catalogue, ordering and fulfilment model is product-agnostic.

The platform supports:

1. An **e-commerce shop** with a configurable catalogue, cart, checkout, delivery, returns and subscriptions.
2. **Sourcing and inventory** tracked by supplier, country/region of origin, batch and expiry, so perishable and imported goods can be sold first-expired-first-out and recalled by batch.
3. **Outlets and a back office** (branches, staff, rosters, billing, notifications and reporting) for running physical stores and warehouses alongside the online shop.

The document is the reference for design, implementation, testing and acceptance. Every requirement carries a unique ID so it can be traced to design, code and test cases.

*Revision 3.0 retired the original product's service lines; see §0.*

### 1.2 Scope
The platform is a web application with a customer-facing storefront/portal and a staff-facing back office, plus a customer mobile app in a later phase.

**In scope**
- Customer accounts and self-service portal
- Product catalogue for any product category, with organic/origin information, cart, checkout, payments, delivery, returns and subscriptions
- Batch/expiry and country-of-origin tracking for sourced and imported goods
- Inventory, outlets (branches/warehouses), staff management, billing and reporting
- Notifications (email, SMS, push, in-app)

**Out of scope (v1)**
- Full accounting/general ledger (the system exports to accounting software)
- Payroll and HR administration
- Bookable services and service records (removed in v3.0)
- Third-party marketplace channel sync (Amazon, Daraz, eBay)
- **Online payment gateway integration** — card and mobile-wallet payment taken through a gateway, saved payment tokens, and automated online refunds. Deferred to a later phase by decision of the business owner (v1.1). Launch payment methods are listed at FR-ORD-8. This deferral is a sequencing decision, not a removal: §4.9 and §4.11 are written so gateway support can be added without reworking orders, invoices or refunds.

### 1.3 Definitions, Acronyms and Abbreviations

| Term | Meaning |
|---|---|
| **Customer** | The person who holds an account and places orders |
| **Outlet / Branch** | A physical store or warehouse that holds stock and fulfils orders |
| **Organic** | A product the catalogue marks as organically produced, with its certification or source recorded |
| **SKU** | Stock Keeping Unit — a sellable product variant |
| **Batch / Lot** | Stock sharing a production or harvest date, expiry date and consignment |
| **FEFO** | First-Expired-First-Out — allocation strategy for perishable goods |
| **COO** | Country (or region) of Origin |
| **MFS** | Mobile Financial Service (mobile wallet payment) |
| **COD** | Cash on Delivery |
| **RBAC** | Role-Based Access Control |
| **MoSCoW** | Prioritisation scheme: Must / Should / Could / Won't (this release) |

### 1.4 References
- `instructions/srs_instruction.md` — originating business brief
- IEEE Std 830-1998 — recommended practice for SRS (structural basis)
- Applicable national regulations for food import and labelling, consumer e-commerce and data protection *(specific statutes to be confirmed — see §11)*

### 1.5 Document Conventions
- Functional requirement IDs follow `FR-<MODULE>-<n>`; non-functional follow `NFR-<AREA>-<n>`.
- Priority uses MoSCoW: **M** = Must (launch blocker), **S** = Should, **C** = Could, **W** = Won't (deferred).
- "The system shall" denotes a binding requirement; "may" denotes a user option.

### 1.6 Intended Audience and Reading Order

| Reader | Suggested sections |
|---|---|
| Business owner / sponsor | §1, §2, §4 feature summaries, §9, §10, §11 |
| Product manager | Whole document |
| Developers / architects | §3, §4, §5, §6, §7 |
| QA engineers | §4, §7, §9 |
| Outlet and warehouse staff | §4.8, §4.9, §7 |

---

## 2. Overall Description

### 2.1 Product Perspective
Amar Gram is a new, self-contained product. It replaces paper registers, spreadsheets and messaging-app ordering. Architecturally it is one system with three functional domains over a shared core (identity, customers, inventory, payments, notifications).

```
                      +---------------------------------------+
   Customer Web/App   |          Amar Gram Platform           |   Staff Back Office
  ------------------> |                                       | <------------------
                      |  +---------+  +---------+  +--------+ |
                      |  |  Shop   |  |Sourcing |  |Outlets | |
                      |  | Catalog |  |Inventory|  |  POS   | |
                      |  +----+----+  +----+----+  +---+----+ |
                      |       |            |           |      |
                      |  +----v------------v-----------v----+ |
                      |  |  SHARED CORE                     | |
                      |  |  Customers | Orders | Inventory  | |
                      |  |  Payments | Notifications | RBAC | |
                      |  +----------------------------------+ |
                      +-------------------+-------------------+
                                          |
             +----------------+-----------+-----------+----------------+
             |                |                       |                |
        Payment GW       SMS / Email             Courier API      Accounting
                                                                    export
```

### 2.2 Product Functions (summary)

| # | Function | Module |
|---|---|---|
| 1 | Register customers; maintain their profiles, addresses and preferences | Core |
| 2 | Browse, search and filter the catalogue, including by country or region of origin | Shop |
| 3 | Purchase online with multiple payment methods, delivery or pickup | Shop |
| 4 | Manage subscriptions / auto-repeat orders for everyday goods | Shop |
| 5 | Track sourced and imported stock by batch, expiry, consignment and import documents | Inventory |
| 6 | Sell at the counter in outlets through a point of sale on the same stock | Outlets |
| 7 | Manage staff, rosters, roles and permissions | Admin |
| 8 | Produce invoices, receipts, refunds and an accounting export | Billing |
| 9 | Produce operational and financial reports and dashboards | Reporting |

### 2.3 User Classes and Characteristics

| Class | Description | Technical skill | Key needs |
|---|---|---|---|
| **Guest** | Unauthenticated visitor | Low | Browse products and prices, register |
| **Customer** | Registered shopper | Low–medium | Buy, track orders, manage subscriptions, get notifications |
| **Receptionist / Counter** | Walk-ins, phone orders, billing, counter sales | Medium | Fast search, POS, order lookup |
| **Inventory / Procurement Officer** | Purchasing, imports, stock, expiry | Medium | POs, goods receipt, batch entry, expiry alerts |
| **Shop Manager** | Catalogue, pricing, promotions, fulfilment | Medium | Product CRUD, order queue, discount rules |
| **Accountant** | Invoicing, reconciliation, refunds | Medium | Ledgers, exports, payment reconciliation |
| **Administrator / Owner** | Full access, configuration, reporting | Medium–high | Dashboards, user management, configuration |
| **Courier (external)** | Delivery partner | n/a | Receives dispatch data via API or manifest |

### 2.4 Operating Environment
- **Customer web:** responsive browser application; last two major versions of Chrome, Edge, Safari and Firefox; mobile-first layout (most traffic expected on Android phones).
- **Staff back office:** browser application optimised for 1366×768 and above; used on desktop and tablet.
- **Mobile app:** Android and iOS — Phase 2.
- **Server:** cloud-hosted Linux, containerised; relational primary database; object storage for images and documents; Redis-class cache and job queue.
- **Connectivity:** outlets may see intermittent internet; critical counter screens must degrade gracefully (NFR-AVL-3).
- **Peripherals:** thermal receipt printer, A4 printer (invoices, packing slips), barcode scanner, digital scale (manual entry in v1).

### 2.5 Design and Implementation Constraints

| ID | Constraint |
|---|---|
| **C-3** | Records the business must keep by law (financial records first) shall be retained for the statutory minimum (confirm) and never hard-deleted by application logic |
| **C-4** | Imported food shall display country of origin and expiry; expired batches shall never be sellable |
| **C-5** | Card data shall never be stored on platform servers. In v1.1 this is absolute: no card number, and no gateway token either, enters the system — an in-store card payment is recorded only as a method, amount and terminal slip reference. When a gateway is integrated (Phase 5), only its tokens are retained (PCI-DSS SAQ-A posture) |
| **C-6** | Money **arithmetic** is performed in integer minor units with an explicit currency code, and amounts are **stored in an exact decimal column** (`numeric(12,2)`); no floating-point type is used for money anywhere. Rounding happens once, where a computed figure becomes a stored one (ADR-317) |
| **C-7** | Timestamps are stored in UTC and rendered in the branch's configured local timezone |
| **C-8** | English at launch, with an i18n layer ready for a second language |
| **C-9** | Every state-changing staff action shall be attributable to a named user in the audit log |

*C-1 and C-2 were withdrawn in v3.1; their IDs are not reused.*

### 2.6 Assumptions and Dependencies

| ID | Assumption |
|---|---|
| **A-1** | A single physical location at launch; the data model supports multiple branches from day one |
| **A-2** | *(Deferred in v1.1.)* No payment gateway is integrated at launch. Money is collected as cash on delivery, cash in store, card in store through a standalone terminal whose reference is recorded manually, or bank transfer confirmed by staff. The order and invoice model treats a payment as a record of money received by any method, so adding a gateway later requires no change to orders, invoices or refunds |
| **A-3** | Delivery uses a third-party courier with an API or CSV manifest; local same-day delivery may be self-operated |
| **A-4** | Cash on delivery is offered and must be reconciled against courier settlements |
| **A-5** | The business holds the licences required to import and sell food and the other goods it stocks |

*A-6, A-7 and A-8 were withdrawn in v3.1; their IDs are not reused.*

---

## 3. External Interface Requirements

### 3.1 User Interfaces
- **UI-1** Responsive layouts at 360 / 768 / 1024 / 1440 px breakpoints.
- **UI-2** A persistent global search in the back office resolving customers, orders, invoices and products by name, phone or ID.
- **UI-3** Destructive actions require confirmation stating exactly what will be affected.
- **UI-4** Every list view supports filtering, sorting, pagination and CSV export.
- **UI-5** Counter, stock and order fulfilment screens auto-refresh at least every 30 seconds without losing unsaved input.
- **UI-6** Accessibility target WCAG 2.1 AA: keyboard operable, visible focus, 4.5:1 text contrast, labelled fields, announced errors.
- **UI-7** *(Withdrawn in v3.1; the ID is not reused.)*
- **UI-8** Weight, volume and quantity fields shall show their units at all times, never as bare numbers.

### 3.2 Hardware Interfaces
- **HW-1** Receipt printing over ESC/POS to a networked or USB thermal printer.
- **HW-2** Barcode/QR scanning as keyboard-wedge input on product, batch and location screens.
- **HW-3** *(Removed in v2.0.)* The ID is retained rather than reused, so that nothing already traced to HW-3 silently points at a different requirement.

### 3.3 Software Interfaces

| Interface | Direction | Purpose | Failure behaviour |
|---|---|---|---|
| ~~Payment gateway~~ | ~~Out + webhook in~~ | ~~Authorise, capture, refund~~ | **Deferred in v1.1 — not integrated at launch.** No external payment interface exists in the launch build; payments are recorded by staff or on delivery (FR-ORD-8). Retained here because the integration point is expected to return in a later phase |
| SMS gateway | Out | Password-reset tokens, reminders, order status | Queue with backoff retry; fall back to email |
| Transactional email | Out | Receipts, invoices, reminders | Queue and retry; failures listed in an admin log |
| Push notifications | Out | App alerts (Phase 2) | Silent fail; in-app inbox remains source of truth |
| Courier API | Out + in | Create shipment, fetch tracking | Fall back to CSV manifest export |
| Accounting export | Out | Journal/invoice export (CSV or API) | Scheduled and re-runnable for any date range |
| Object storage | Out + in | Product images, import documents, exports | Retry uploads; surface failure to the user |
| Staff SSO (optional) | In | OIDC staff login | Local password login remains available |

### 3.4 Communications Interfaces
- **COM-1** All traffic over HTTPS (TLS 1.2+), with HSTS enabled.
- **COM-2** Public and internal APIs are REST/JSON with versioned paths (`/api/v1/...`).
- **COM-3** Webhooks are signature-authenticated and processed idempotently by event ID.
- **COM-4** Real-time back-office updates use WebSocket where available, degrading to polling.

---

## 4. Functional Requirements

Modules: **ACC** accounts & identity · **SHP** shop & catalogue · **IMP** imports, batches & inventory · **ORD** orders & fulfilment · **SUB** subscriptions · **BIL** billing & payments · **NTF** notifications · **ADM** administration · **POR** customer portal · **RPT** reporting

### 4.1 Accounts and Identity (ACC)

| ID | Requirement | Priority |
|---|---|---|
| FR-ACC-1 | Guests shall register with a name, a mobile number and/or an email address (at least one is required), and a password, after passing the CAPTCHA in FR-ACC-13. Mobile number is the primary identifier when both are supplied. Mobile number and email address are each unique across customer accounts, since either may be used to log in (FR-ACC-3). No phone or email verification is performed — the account is usable as soon as it is created. *(Reworded in v2.2.)* | M |
| FR-ACC-2 | ~~The system shall verify the mobile number by OTP and the email by a signed link before enabling checkout or booking.~~ **Withdrawn in v2.1** — the business owner does not want phone or email verification. An account is usable as soon as it is created; abuse of registration is controlled by FR-ACC-13 and NFR-SEC-6 instead. The ID is retained rather than reused. | — |
| FR-ACC-3 | Customers and staff shall log in with their registered mobile number or email address and their password. There is no OTP login. Customer and staff sign-in are separate: a customer credential never grants a staff session, and a staff session carries the roles assigned under FR-ACC-6. A failed login shall show one generic message that does not reveal whether the identifier exists; failed attempts shall be rate-limited and progressively delayed. *(Reworded in v2.2; staff added in v2.3.)* | M |
| FR-ACC-4 | Customers and staff shall reset passwords through a time-limited, single-use token sent to the mobile number, or the email if one was supplied, registered on the account. A new staff account has no password until its holder sets one this way. *(Staff added in v2.3.)* *(Reworded in v2.1 — no channel is verified. Retained in v2.2: the reset token is account recovery, not verification, and is sent only when the customer asks for a reset.)* | M |
| FR-ACC-5 | A customer profile shall store name, phone(s), email, multiple delivery addresses, a default address and communication preferences per channel. | M |
| FR-ACC-6 | Staff accounts shall be created only by an Administrator and assigned one or more roles (RBAC). | M |
| FR-ACC-7 | Staff sessions shall expire after a configurable idle period (default 30 minutes) and require re-authentication. | M |
| FR-ACC-8 | ~~Staff with privileged access shall be required to use two-factor authentication.~~ **Withdrawn in v2.2** at the business owner's instruction — staff sign in with identifier and password, like customers; their accounts remain protected by FR-ACC-6 (administrator-created, RBAC), FR-ACC-7 (idle expiry), NFR-SEC-6 (rate limiting and lockout) and FR-ACC-12 (audit). The ID is retained rather than reused. | — |
| FR-ACC-9 | Receptionists shall create a customer record on behalf of a walk-in with only name and phone, marking it incomplete until the customer sets a password for online access. *(Reworded in v2.2 — no verification exists.)* | M |
| FR-ACC-10 | The system shall detect and offer to merge duplicate customer records matched on phone or email, preserving all orders, invoices and history under the surviving record. | S |
| FR-ACC-11 | Customers shall be able to request account deletion; the system shall anonymise personal data while retaining the financial records required by law (per C-3). | S |
| FR-ACC-12 | The system shall maintain an audit log of all authentication events and all staff data changes, recording actor, action, entity, before/after values and timestamp. | M |
| FR-ACC-13 | *(Added in v2.1.)* Self-service registration shall require a correctly solved CAPTCHA. The challenge shall be generated and checked by the platform itself (no third-party CAPTCHA service), be single-use and expire after a short period (default 2 minutes), and be checked before any account lookup or password hashing. A user who cannot solve it shall be able to request a new challenge and shall be told how to register in person at reception (FR-ACC-9). | M |

### 4.2 – 4.6 *(Withdrawn in v3.0)*
Five modules of the original product were removed permanently with the Amar Gram pivot (§0, v3.0). Their IDs are retained as withdrawn and are never reused.

### 4.7 Shop — Catalogue and Products (SHP)

| ID | Requirement | Priority |
|---|---|---|
| FR-SHP-1 | The system shall maintain a product catalogue in which every product belongs to exactly one category. Launch categories: **Rice & Grains**, **Honey & Gur**, **Oils & Ghee**, **Spices**, **Pulses**, **Tea & Drinks**, **Fresh Produce**, **Dates & Dry Fruit**, **Dairy & Eggs**, **Snacks & Sweets** (all food) and **Household & Care**. | M |
| FR-SHP-2 | A product shall carry: name, brand, description, images, category, tags, status (draft/active/archived) and SEO slug. | M |
| FR-SHP-3 | A product shall support variants (SKUs) by size/weight, flavour, colour and pack quantity, each with its own price, barcode, stock and images. | M |
| FR-SHP-4 | Food products shall additionally carry: **country or region of origin**, manufacturer or producer, ingredient list, nutrition information, certifications (e.g. certified organic, pesticide-free, traditional, halal), usage guide and storage instructions. | M |
| FR-SHP-5 | Customers shall filter the catalogue by **country of origin**, brand, category, certification, price range, availability and rating; and sort by price, popularity, newest and rating. | M |
| FR-SHP-6 | The storefront shall present a browsable **"Shop by Country"** view (e.g. Germany, Thailand, Turkey, USA, Korea) showing origin flag, sourcing notes and the products from each origin. | M |
| FR-SHP-7 | Product search shall match name, brand, ingredient and tag, tolerate misspellings, and return results within the performance budget in NFR-PRF-2. | M |
| FR-SHP-8 | The product page shall display live availability derived from sellable stock (FR-IMP-8), and the earliest expiry date of the batch that would be allocated when that date is within a configurable window. | M |
| FR-SHP-9 | The system shall support cross-sell and up-sell blocks ("frequently bought together", "customers also bought"). | S |
| FR-SHP-10 | The system shall support verified customer reviews and ratings, postable only by customers who purchased the SKU, subject to moderation. | S |
| FR-SHP-13 | The system shall support bundles/kits (e.g. "breakfast pantry kit") priced as a unit while deducting each component from stock. | S |
| FR-SHP-14 | The system shall record a wishlist and a back-in-stock notification request per SKU. | S |
| FR-SHP-15 | Product content shall support two languages when i18n is enabled (C-8), falling back to the default language where a translation is missing. | C |

*FR-SHP-11 and FR-SHP-12 were withdrawn in v3.1; their IDs are not reused.*

### 4.8 Imports, Batches and Inventory (IMP)

| ID | Requirement | Priority |
|---|---|---|
| FR-IMP-1 | The system shall maintain suppliers with country, contact details, currency, lead time and payment terms. | M |
| FR-IMP-2 | The system shall create purchase orders to a supplier for SKUs with quantity, unit cost, currency and expected delivery date. | M |
| FR-IMP-3 | The system shall maintain an **import consignment** record grouping one or more POs, holding: origin country, shipment reference, HS/tariff codes, import permit number, health/phytosanitary certificate, customs declaration, landed-cost components (freight, duty, clearing, insurance) and attached documents. | M |
| FR-IMP-4 | Goods receipt shall record, per SKU, one or more **batches**: batch/lot number, manufacture date, **expiry date**, quantity received, quantity rejected with reason, and the consignment it arrived on. | M |
| FR-IMP-5 | The system shall compute landed unit cost per batch by allocating consignment costs across received quantity, and use it for margin reporting. | S |
| FR-IMP-6 | Stock shall be tracked **per batch per location** (shop floor, warehouse, quarantine). | M |
| FR-IMP-7 | Order allocation shall use **FEFO** — the batch expiring soonest is allocated first — unless a staff member overrides with a recorded reason. | M |
| FR-IMP-8 | Sellable stock shall exclude expired batches, quarantined batches, damaged stock and quantities reserved by unpaid or in-flight orders. | M |
| FR-IMP-9 | The system shall block sale and any other use of a batch whose expiry date has passed, with no override. | M |
| FR-IMP-10 | The system shall raise expiry alerts at configurable thresholds (default 90 / 60 / 30 days) and provide a near-expiry report to support markdowns. | M |
| FR-IMP-11 | The system shall support a batch **recall**: marking a batch recalled shall quarantine remaining stock, list every order and customer that received it, and support notifying those customers. | M |
| FR-IMP-12 | The system shall raise low-stock alerts per SKU per location against a configurable reorder point, and suggest reorder quantities from consumption history and supplier lead time. | S |
| FR-IMP-13 | The system shall support stock transfers between locations and stock adjustments (damage, theft, sampling, internal use) with a mandatory reason and approval above a configurable value. | M |
| FR-IMP-14 | The system shall support cycle counts and full stock takes, producing a variance report before committing adjustments. | S |
| FR-IMP-15 | Every stock movement shall be an immutable ledger entry (receipt, sale, transfer, adjustment, return, wastage) recording SKU, batch, quantity delta, location, reference document and user. Current stock is derived from the ledger. | M |
| FR-IMP-16 | The system shall record temperature/storage requirements per product and flag storage-condition breaches reported by staff. | C |

### 4.9 Cart, Checkout, Orders and Fulfilment (ORD)

| ID | Requirement | Priority |
|---|---|---|
| FR-ORD-1 | Guests and customers shall add SKUs to a cart; a guest cart shall merge into the account cart on login. | M |
| FR-ORD-2 | The cart shall persist across sessions and devices for a logged-in customer. | M |
| FR-ORD-3 | The cart shall revalidate price and availability at checkout and clearly show any change before payment. | M |
| FR-ORD-4 | Checkout shall collect delivery address or pickup choice, delivery slot where applicable, and payment method. | M |
| FR-ORD-5 | The system shall compute order totals as: line subtotals − line discounts − order discounts + delivery charge + tax, showing each component. | M |
| FR-ORD-6 | The system shall support discount codes with rules: percentage or fixed, minimum spend, product/category scope, first-order-only, usage limits overall and per customer, and validity window. | S |
| FR-ORD-7 | The system shall support delivery charge rules by zone, order value, weight and express/standard service. | M |
| FR-ORD-8 | *(Reworded in v1.1 — gateway methods deferred.)* Payment methods at launch shall be: **cash on delivery**, **cash in store**, **card in store** through a standalone terminal with the terminal reference recorded manually, and **bank transfer** confirmed by staff. COD may be disabled per zone or above a value threshold. Online card and mobile-wallet payment are deferred (§1.2). | M |
| FR-ORD-9 | An order shall be confirmed, stock reserved by batch, confirmation sent and an invoice issued when payment is **recorded** — which at launch means a staff member confirms a bank transfer or in-store payment, or the order is accepted as COD. The system shall not assume payment confirmation arrives from an external gateway. | M |
| FR-ORD-10 | Order statuses shall be `pending_payment` → `confirmed` → `packing` → `dispatched` → `delivered`, with `cancelled`, `returned` and `refunded` as alternate terminal states; every transition shall be timestamped, attributed and validated. | M |
| FR-ORD-11 | Staff shall generate a pick list grouped by location and batch, and a packing slip per order. | M |
| FR-ORD-12 | Dispatch shall create a courier shipment (API or manifest) and record the tracking number, which is shown to the customer. | M |
| FR-ORD-13 | Customers shall track order status in the portal and receive status notifications on their preferred channel. | M |
| FR-ORD-14 | Customers shall cancel an order before it is packed; cancellation shall release reserved stock and trigger a refund where payment has already been received (FR-ORD-17). A COD order cancelled before dispatch involves no refund, as no money has changed hands. | M |
| FR-ORD-15 | The system shall support returns within a configurable window, with a reason, an approval step, and a policy that **opened food and used household or care items are non-returnable** unless a quality defect or recall is recorded. | M |
| FR-ORD-16 | Returned stock shall be received back into a quarantine location and require an explicit decision: restock (with original batch) or write off. | M |
| FR-ORD-17 | *(Reworded in v1.1.)* Refunds shall be issued as cash in store, by bank transfer, or as store credit, according to how the customer paid and what they choose. Every refund shall record method, amount, reference, the staff member issuing it, and the reason, and shall be linked to the original invoice as a credit note. Automated refund to a card or wallet returns when a gateway is integrated. | M |
| FR-ORD-18 | The system shall support in-store point-of-sale: staff scan items, take payment, print a receipt, and the sale shall use the same inventory ledger as online orders. | M |
| FR-ORD-19 | A customer's order charges and manual charges (e.g. a delivery surcharge agreed by phone) shall be combinable into one invoice. | S |
| FR-ORD-20 | The system shall detect and prevent duplicate order submission from double-clicks, repeated form posts, or (when a gateway is later integrated) repeated payment callbacks, via an idempotency key. | M |
| FR-ORD-21 | *(Added in v1.1.)* A COD order shall be confirmable without prepayment. The system shall record the cash amount collected on delivery, the collecting courier or staff member, and the collection date, and shall reconcile collections against courier remittances (FR-BIL-7). An undelivered or refused COD order shall return stock to inventory through the returns path (FR-ORD-16). | M |
| FR-ORD-22 | *(Added in v1.1.)* A bank-transfer order shall be held in `pending_payment` while the customer submits a transfer reference, and shall be confirmed only when a staff member verifies receipt against the bank record. Held orders shall reserve stock for a configurable window (default 48 hours) and shall automatically expire and release that stock if payment is not confirmed, notifying the customer. | M |

### 4.10 Subscriptions and Auto-Repeat (SUB)

| ID | Requirement | Priority |
|---|---|---|
| FR-SUB-1 | Customers shall subscribe to a recurring delivery of food or household essentials at a chosen interval (e.g. every 2, 4 or 8 weeks). | S |
| FR-SUB-2 | *(Reworded in v1.1.)* The system shall generate the next order automatically at the interval and reserve stock. Without a gateway there is no saved payment token, so the generated order is raised as COD or as a bank transfer awaiting confirmation (FR-ORD-21, FR-ORD-22). Automatic charging returns when a gateway is integrated — until then, subscriptions save the customer from re-ordering, not from paying each time. | S |
| FR-SUB-3 | Customers shall pause, skip one delivery, change the interval or quantity, or cancel at any time before the next generation cut-off. | S |
| FR-SUB-4 | The system shall notify the customer a configurable number of days before each subscription charge. | S |
| FR-SUB-5 | Subscriptions shall support a configurable discount relative to one-off purchase. | C |

*FR-SUB-6 was withdrawn in v3.1; its ID is not reused.*

### 4.11 Billing and Payments (BIL)

| ID | Requirement | Priority |
|---|---|---|
| FR-BIL-1 | The system shall generate a sequential, non-reusable invoice number per branch and financial year. | M |
| FR-BIL-2 | Invoices shall itemise products, delivery and other charges, showing tax per line where applicable. | M |
| FR-BIL-3 | The system shall support partial payments, deposits and outstanding balances per customer, with an ageing view. | M |
| FR-BIL-4 | The system shall support multiple tenders on one invoice (e.g. part card, part cash). | S |
| FR-BIL-5 | The system shall record refunds and credit notes against the original invoice, never by editing it. | M |
| FR-BIL-6 | Finalised invoices shall be immutable; corrections are made by credit note and re-issue. | M |
| FR-BIL-7 | *(Reworded in v1.1 — now Must.)* The system shall reconcile **COD remittances from couriers**, **bank transfers against the bank statement**, and **in-store cash against the till count** with recorded payments, and shall flag every mismatch for investigation. With no gateway settlement file to rely on, manual reconciliation is the only control over money received, so it is a launch requirement rather than a later refinement. | M |
| FR-BIL-8 | The system shall calculate tax per configurable tax classes per product and service. | M |
| FR-BIL-9 | The system shall support store credit and gift vouchers as tender. | C |
| FR-BIL-10 | The system shall export invoices, payments and credit notes to the accounting system for any date range, re-runnably. | S |
| FR-BIL-11 | The system shall support a loyalty scheme accruing points on spend and redeemable as discount. | C |
| FR-BIL-12 | *(Added in v1.1.)* Staff shall record a payment received outside the system with method, amount, currency, reference (transfer reference, terminal slip number or receipt number), date received and receiving staff member. Recording a payment shall be permission-controlled, fully audited, and shall require a second approval above a configurable value. | M |
| FR-BIL-13 | *(Added in v1.1.)* The system shall provide a daily cash-up view per branch listing cash, in-store card and transfer payments recorded that day, with expected versus counted totals and a recorded variance explanation. | S |

### 4.12 Notifications (NTF)

| ID | Requirement | Priority |
|---|---|---|
| FR-NTF-1 | The system shall send templated notifications over email, SMS, push and in-app inbox, selected by the customer's per-channel preference. | M |
| FR-NTF-2 | Notification templates shall be editable by an Administrator with variable placeholders and a preview. | S |
| FR-NTF-3 | The system shall send: order confirmation, dispatch and delivery; bank-transfer reminders and expiry; subscription pre-charge and cycle notices; back-in-stock; recall notices; and abandoned-cart reminders. | M |
| FR-NTF-4 | Transactional notifications (password reset, payment, order, recall) shall be exempt from marketing opt-out; marketing notifications shall honour opt-out and include an unsubscribe mechanism. | M |
| FR-NTF-5 | The system shall not send non-urgent notifications outside configured quiet hours, queueing them until the window opens. | S |
| FR-NTF-6 | The system shall log every notification with channel, template, recipient, status and provider response, and support manual resend. | M |

*FR-NTF-7 was withdrawn in v3.1; its ID is not reused.*

### 4.13 Administration and Configuration (ADM)

| ID | Requirement | Priority |
|---|---|---|
| FR-ADM-1 | Administrators shall manage branches, opening hours, holidays and per-branch configuration. | M |
| FR-ADM-2 | Administrators shall manage staff, roles and granular permissions; permissions shall be enforced server-side on every request, not only hidden in the UI. | M |
| FR-ADM-3 | Administrators shall manage staff rosters, leave and shift patterns per branch. | M |
| FR-ADM-4 | Administrators shall manage pricing, tax classes, delivery zones and charges. | M |
| FR-ADM-5 | Administrators shall configure business rules exposed as parameters: subscription cut-offs, bank-transfer hold window, expiry alert thresholds, reorder points, quiet hours, session timeout. | M |
| FR-ADM-6 | Administrators shall view the audit log filtered by user, entity, action and date range, and export it. | M |
| FR-ADM-7 | The system shall provide a content management capability for storefront pages, banners, FAQs and policy documents. | S |
| FR-ADM-8 | The system shall support a maintenance mode that keeps the back office available while the storefront shows a notice. | C |

### 4.14 Customer Portal (self-service view)

| ID | Requirement | Priority |
|---|---|---|
| FR-POR-1 | The portal shall show the customer's recent orders, subscriptions and outstanding balances on one dashboard. | M |
| FR-POR-5 | The portal shall allow re-ordering a previous order in one action. | S |
| FR-POR-6 | The portal shall allow the customer to update their profile, addresses and notification preferences. | M |

*FR-POR-2, FR-POR-3 and FR-POR-4 were withdrawn in v3.1; their IDs are not reused.*

---

## 5. Data Requirements

### 5.1 Core Entities

| Entity | Key attributes | Principal relationships |
|---|---|---|
| **Customer** | name, phones, emails, addresses, preferences, status | 1..* Orders, 1..* Invoices, 0..* Subscriptions |
| **Staff User** | name, roles, branch, status | performs counter sales, goods receipts and fulfilment |
| **Product** | name, brand, category, attributes, status | 1..* SKUs |
| **SKU** | size, flavour, barcode, price, COO | 1..* Batches |
| **Batch** | lot number, manufacture date, expiry date, consignment, landed cost | has Stock per Location |
| **Consignment** | origin country, shipment ref, HS code, permit, certificates, costs | 1..* Batches |
| **Supplier** | name, country, currency, lead time, terms | 1..* Purchase Orders |
| **Stock Ledger Entry** | SKU, batch, location, delta, reason, reference, user, timestamp | immutable |
| **Order** | customer, lines, totals, status, payment, shipment | 1..* Order Lines (each with SKU + batch allocation) |
| **Subscription** | SKU, quantity, interval, next run, intended payment method, status *(payment token deferred to Phase 5)* | generates Orders |
| **Invoice** | number, lines, tax, totals, status | 1..* Payments, Credit Notes |
| **Payment** | method, amount, currency, external reference (transfer ref, terminal slip, receipt no. — or a gateway ref in Phase 5), received date, recorded-by staff member, status | belongs to Invoice |
| **Notification** | channel, template, recipient, payload, status | audit record |
| **Audit Entry** | actor, action, entity, before, after, timestamp, IP | immutable |

### 5.2 Data Integrity Rules
- **D-1** *(Withdrawn in v3.1.)*
- **D-2** A batch's expiry date is mandatory for food categories.
- **D-3** Stock on hand is never stored as an editable number; it is derived from the immutable stock ledger (FR-IMP-15).
- **D-4** An order line records the specific batch allocated, so a recall can trace from batch to order to customer.
- **D-5** A finalised invoice and an audit entry are append-only.
- **D-6** Soft deletion is used for customer-facing records; financial records are never hard-deleted (C-3).
- **D-7** *(Withdrawn in v3.1.)*

### 5.3 Data Retention and Privacy
- **D-8** *(Withdrawn in v3.1.)*
- **D-9** Financial records retained per tax law (assumed 6 years).
- **D-10** *(Withdrawn in v3.1.)*
- **D-11** Personal data is exportable on request in a machine-readable format and erasable subject to D-9.
- **D-12** Payment card numbers are never stored (C-5).

---

## 6. Non-Functional Requirements

### 6.1 Performance (PRF)
- **NFR-PRF-1** Storefront pages shall reach Largest Contentful Paint ≤ 2.5 s on a 4G connection for the 75th-percentile user.
- **NFR-PRF-2** Catalogue search and filter results shall return in ≤ 500 ms at p95 for a catalogue of up to 20,000 SKUs.
- **NFR-PRF-3** Back-office list and detail screens shall load in ≤ 1.5 s at p95.
- **NFR-PRF-4** A customer's order history shall render in ≤ 2 s at p95 for a customer with 10 years of orders.
- **NFR-PRF-5** Checkout submission through to order placement shall complete in ≤ 3 s at p95. *(In v1.1 there is no gateway redirect to exclude; the budget covers the whole submission.)*
- **NFR-PRF-6** The system shall sustain 300 concurrent customer sessions and 40 concurrent staff sessions at launch, scaling horizontally to 5× without redesign.
- **NFR-PRF-7** Batch jobs (reminders, subscriptions, reports) shall not degrade interactive response times; they run on separate workers.

### 6.2 Availability and Reliability (AVL)
- **NFR-AVL-1** Target availability 99.5% monthly for the storefront and 99.9% during outlet opening hours for the back office.
- **NFR-AVL-2** Planned maintenance shall occur in a published low-traffic window with at least 48 hours' notice.
- **NFR-AVL-3** If connectivity to the server is lost, the back office shall continue to display the branch's offline snapshot of the day's working lists from local cache, in read-only mode, and shall clearly indicate it is offline.
- **NFR-AVL-4** Database backups shall run at least daily with point-in-time recovery; RPO ≤ 15 minutes, RTO ≤ 4 hours.
- **NFR-AVL-5** Backup restoration shall be tested at least quarterly and the test recorded.
- **NFR-AVL-6** External integration failures shall degrade gracefully per §3.3 and never lose a customer's submitted data.

### 6.3 Security (SEC)
- **NFR-SEC-1** Passwords shall be stored using a memory-hard hash (Argon2id or bcrypt cost ≥ 12); a minimum length of 10 characters is enforced and known-breached passwords are rejected.
- **NFR-SEC-2** Authorisation shall be enforced server-side on every request; no endpoint shall rely on client-side role checks.
- **NFR-SEC-3** All data shall be encrypted in transit (TLS 1.2+) and at rest (database and object storage).
- **NFR-SEC-4** The application shall defend against OWASP Top 10 classes: parameterised queries, output encoding, CSRF tokens, strict Content Security Policy, signed and short-lived session tokens, and server-side validation of every input.
- **NFR-SEC-5** File uploads shall be type- and size-validated, virus-scanned, stored outside the web root and served through signed, expiring URLs.
- **NFR-SEC-6** Rate limiting and lockout shall apply to login, password reset and checkout endpoints *(OTP removed in v2.2)*. Rate limiting per client address shall also apply to the registration and CAPTCHA-issue endpoints *(added in v2.1)*.
- **NFR-SEC-7** Secrets shall be held in a managed secret store, never in source control or configuration files in the repository.
- **NFR-SEC-8** Access to a customer's personal data shall be limited to the staff roles that need it and to the customer themself; every staff export of a customer's personal data shall be logged.
- **NFR-SEC-9** Dependencies shall be scanned for vulnerabilities on every build; critical findings block release.
- **NFR-SEC-10** A penetration test shall be completed before go-live and annually thereafter.

### 6.4 Usability (USA)
- **NFR-USA-1** A first-time customer shall be able to complete registration and place a first order in under 3 minutes without assistance.
- **NFR-USA-2** A receptionist shall be able to register a walk-in and start a counter sale in under 60 seconds.
- **NFR-USA-3** A warehouse staff member shall be able to record a completed pick in no more than two taps on a tablet.
- **NFR-USA-4** Error messages shall state what went wrong and what to do next, in plain language, never exposing stack traces or internal identifiers.
- **NFR-USA-5** Forms longer than one screen shall preserve entered data across validation errors and accidental navigation.
- **NFR-USA-6** The interface shall meet WCAG 2.1 AA (UI-6).

### 6.5 Compatibility and Portability (CMP)
- **NFR-CMP-1** Supported browsers per §2.4; the storefront shall remain functional (if visually reduced) two versions further back.
- **NFR-CMP-2** The storefront shall be fully usable on a 360 px-wide screen.
- **NFR-CMP-3** The system shall run in containers and shall not depend on any single cloud provider's proprietary service for core function.

### 6.6 Maintainability and Supportability (MNT)
- **NFR-MNT-1** Automated test coverage shall be at least 70% of business-logic modules, with end-to-end tests covering the flows in §9.
- **NFR-MNT-2** All environments (dev, staging, production) shall be provisioned from code.
- **NFR-MNT-3** Structured logs with a correlation ID shall span a request across services.
- **NFR-MNT-4** The system shall expose health and readiness endpoints, and emit metrics for request rate, error rate, latency and queue depth, with alerting on defined thresholds.
- **NFR-MNT-5** Database schema changes shall be applied by versioned, reversible migrations.
- **NFR-MNT-6** Public APIs shall be documented (OpenAPI) and versioned; breaking changes require a new version.

### 6.7 Compliance and Legal (CMP-L)
- **NFR-LEG-1** *(Withdrawn in v3.1.)*
- **NFR-LEG-2** Imported food records shall retain import permits and certificates for the statutory period and be retrievable per consignment for inspection.
- **NFR-LEG-3** Invoices and receipts shall carry the legally required business identifiers and tax details.
- **NFR-LEG-4** Consent shall be captured and stored for marketing communication.
- **NFR-LEG-5** Published terms, privacy policy, refund policy and subscription terms shall be versioned, with the version the customer accepted recorded against their acceptance.

### 6.8 Scalability (SCL)
- **NFR-SCL-1** The architecture shall support additional branches without code change: data is branch-scoped and staff are branch-assigned.
- **NFR-SCL-2** Read-heavy catalogue traffic shall be servable from cache/CDN so that a promotional spike does not affect back-office operations.
- **NFR-SCL-3** Media shall be served from a CDN with responsive image variants.

---

## 7. Business Rules

| ID | Rule | Enforced by |
|---|---|---|
| **BR-3** | Expired stock is never sellable or usable — no override exists. | FR-IMP-9 |
| **BR-4** | Stock is allocated FEFO by default; deviation requires a recorded reason. | FR-IMP-7 |
| **BR-10** | Opened food and used household or care items are non-returnable unless defective or recalled. | FR-ORD-15 |
| **BR-11** | Finalised invoices are immutable; corrections are credit notes. | FR-BIL-6 |
| **BR-14** | An order may not be dispatched while any line is unallocated or its batch is recalled. | FR-IMP-11, FR-ORD-10 |
| **BR-15** | COD is unavailable above a configurable order value or in configured zones. | FR-ORD-8 |
| **BR-16** | *(Added in v1.1.)* An order is never dispatched on unconfirmed payment: bank-transfer orders expire and release their stock after their configured window. | FR-ORD-22 |
| **BR-17** | *(Added in v1.1.)* Money recorded as received must be attributable to a named staff member and a reference, because no gateway record exists to corroborate it. | FR-BIL-12 |

*BR-1, BR-2, BR-5 to BR-9, BR-12 and BR-13 were withdrawn in v3.1; their IDs are not reused.*

---

## 8. Reporting and Analytics

### 8.1 Operational Reports
| Report | Contents | Primary user |
|---|---|---|
| Stock on hand | By SKU, batch, location, with valuation | Inventory |
| Near-expiry & expired | Batches by days to expiry, value at risk | Inventory |
| Low stock & reorder | SKUs below reorder point with suggested quantities | Procurement |
| Import consignment | Consignments, landed cost, documents, clearance status | Procurement |
| Order fulfilment | Orders by status, ageing, SLA breaches | Shop manager |

### 8.2 Financial Reports
| Report | Contents |
|---|---|
| Revenue by sales channel | Online orders vs counter sales, by period |
| Revenue by product category | Including margin where landed cost is known |
| Revenue by country of origin | Sales split across sourced origins |
| Payment reconciliation | COD remittance vs delivered COD orders; bank transfers vs bank statement; in-store cash vs till count; variances flagged. *(Gateway settlement returns in Phase 5.)* |
| Daily cash-up | Cash, in-store card and transfer payments recorded per branch per day, expected vs counted, with variance explanations |
| Outstanding receivables | Balances by customer with ageing buckets |
| Refunds and credit notes | By reason and period |
| Tax summary | Output tax by class and period |

### 8.3 Customer and Growth Reports
| Report | Contents |
|---|---|
| New vs returning customers | By period and acquisition source |
| Customer lifetime value | Spend across online and counter sales |
| Cohort retention | Repeat purchase rates |
| Subscription health | Active, paused, churned; churn reasons |
| Cart abandonment | Rate and recovered value |
| Cross-channel conversion | Counter customers who also buy online, and the reverse |

- **FR-RPT-1 (M)** Every report shall be filterable by date range and branch, viewable on screen, and exportable to CSV and PDF.
- **FR-RPT-2 (S)** Administrators shall schedule any report for recurring email delivery.
- **FR-RPT-3 (M)** A home dashboard per role shall show that role's key figures for today.

---

## 9. Acceptance Criteria

The release is accepted when each of the following end-to-end scenarios passes in the staging environment with production-like data.

| # | Scenario | Pass condition |
|---|---|---|
| **AC-1** | New customer registers and places a first order | Account created after passing the CAPTCHA, with no verification step *(amended in v2.1)*; order placed; confirmation received on the preferred channel |
| **AC-5** | Customer browses sourced goods by country | "Shop by Country" lists correct origins; filters and search return within NFR-PRF-2; product page shows origin, ingredients and availability |
| **AC-6** | Purchase with FEFO allocation | Order allocates the soonest-expiring non-expired batch; expired batch never allocated; stock ledger balances; invoice correct |
| **AC-8** | COD order delivered and reconciled | Order confirms without prepayment; flows through packing, dispatch with tracking, delivery; cash collected is recorded; COD remittance reconciles against the payment record and a deliberate shortfall is flagged |
| **AC-8b** | Bank-transfer order confirmed and expired | Order holds in `pending_payment` with stock reserved; staff confirmation moves it to `confirmed`; a second order left unconfirmed past its window expires automatically and releases its stock, notifying the customer |
| **AC-9** | Return and refund | Sealed product returned within window; received into quarantine; restock decision recorded; refund issued and audited; opened food rejected by policy |
| **AC-10** | Batch recall | Marking a batch recalled quarantines stock, lists every affected order and customer, and supports notifying them |
| **AC-16** | Combined invoice | One invoice correctly combines a customer's order charges and a manual charge, with tax per line |
| **AC-17** | Subscription cycle | Next order generates on schedule as COD or awaiting transfer, notifies in advance, and skipping works. *(Automatic token charging is out of scope in v1.1.)* |
| **AC-18** | Role enforcement | A receptionist is denied staff management and system configuration at the API level, not merely in the UI |
| **AC-19** | Offline degradation | With the network disconnected, the back office still shows the branch's offline snapshot read-only, with a clear offline indicator |
| **AC-20** | Audit and retention | Every state change in AC-5 through AC-10 appears in the audit log with actor, before and after values; no financial record can be hard-deleted through the application |
| **AC-21** | Performance | NFR-PRF-1 to NFR-PRF-5 met under a load test at NFR-PRF-6 concurrency |
| **AC-22** | Security | Penetration test completed with no open critical or high findings |

*AC-2 to AC-4, AC-7 and AC-11 to AC-15 were withdrawn in v3.1; their IDs are not reused.*

---

## 10. Release Plan

| Phase | Scope | Rationale |
|---|---|---|
| **Phase 1 — Core operations (MVP)** | ACC, BIL (core), NTF (core), ADM, basic RPT | Identity, billing and administration are the base every other module depends on |
| **Phase 2 — Commerce** | SHP, IMP, ORD, POS, remaining BIL | Selling sourced food safely needs batch/expiry tracking, so IMP ships with SHP, not after it |
| **Phase 4 — Growth** | SUB, loyalty, reviews, recommendations, mobile app, advanced RPT | Retention features once the operational base is stable |
| **Phase 5 — Online payments** *(added v1.1)* | Payment gateway integration: online card and wallet payment, saved tokens, automated refunds, gateway settlement reconciliation, subscription auto-charge | Deferred from launch by owner decision. Phases 1, 2 and 4 are built so this slots in behind the existing payment record model without reworking orders, invoices or refunds |

Each phase is independently shippable and independently useful. *(Phase 3 was withdrawn in v3.1.)*

**Consequence of deferring Phase 5:** until a gateway exists, every payment passes through a person — a courier collecting cash, a staff member confirming a transfer, a till at the counter. The controls that substitute for a gateway's automatic record are therefore launch requirements, not refinements: FR-BIL-7 (reconciliation), FR-BIL-12 (attributable manual payment entry), FR-ORD-22 (expiry of unconfirmed holds) and BR-16 / BR-17.

---

## 11. Open Questions and Decisions Required

| # | Question | Owner | Blocks |
|---|---|---|---|
| **Q-1** | Which country's regulations govern food import, labelling and record retention? Exact retention periods? | Owner / legal | C-3, D-9 |
| ~~**Q-2**~~ | ~~Which payment gateway(s), and which mobile wallets must be supported at launch?~~ **Parked in v1.1** — no gateway at launch. Revisit when Phase 5 is scheduled; it blocks nothing now. | Owner | — |
| **Q-3** | **Now high priority.** Is cash on delivery offered, and with what value ceiling and zone restrictions? With no gateway, COD is a primary payment method rather than a secondary one, so this decision now shapes the main revenue path. | Owner | FR-ORD-8, FR-ORD-21, BR-15 |
| **Q-3b** | *(Added v1.1.)* What is the bank-transfer confirmation window before an order expires and releases stock (default assumed 48 hours), and who is authorised to confirm receipt? | Owner | FR-ORD-22, FR-BIL-12 |
| **Q-3c** | *(Added v1.1.)* Is an in-store card terminal available at launch, and does its provider supply a settlement report that reconciliation can be checked against? | Owner | FR-ORD-8, FR-BIL-7 |
| **Q-4** | Which courier(s), and is an API available or is a CSV manifest the interface? | Owner | FR-ORD-12, A-3 |
| **Q-5** | Base currency, tax regime and tax rates per product class? | Accountant | FR-BIL-8, C-6 |
| **Q-8** | Which source countries at launch, and are there import-licence constraints per origin? | Procurement | FR-SHP-6, FR-IMP-3 |
| **Q-12** | Is a second language required at launch, and which? | Owner | C-8, FR-SHP-15 |
| **Q-13** | Which accounting system must the export target? | Accountant | FR-BIL-10 |
| **Q-14** | Is a customer mobile app contractually required, or is a responsive web app sufficient for Phase 2? | Owner | §2.4 |
| **Q-16** | *(Added v2.1, narrowed v2.2.)* How does a walk-in customer whose *incomplete* record holds only name and phone (FR-ACC-9) set a password? Proposed: a password reset to the recorded phone (FR-ACC-4), since registering online with the same number is refused as a duplicate (FR-ACC-1). Owner to confirm. | Owner | FR-ACC-9, US-ACC-10 |
| **Q-17** | *(Added v2.1.)* Is registration in person at reception an acceptable alternative for customers who cannot solve an image CAPTCHA (WCAG 2.1 SC 1.1.1), or is an audio challenge also required? | Owner / accessibility | FR-ACC-13, NFR-USA-6 |

*Q-6, Q-7, Q-9, Q-10, Q-11 and Q-15 were withdrawn in v3.1; their IDs are not reused.*

---

## 12. Appendices

### Appendix A — Traceability: business brief to requirements

| Brief item | Covered by |
|---|---|
| 1. Sell any kind of product, starting with organic goods | §4.7 SHP, §4.9 ORD, §4.10 SUB, §4.11 BIL |
| 2. Goods sourced from different regions and countries, with batch and expiry control | FR-SHP-4, FR-SHP-5, FR-SHP-6, §4.8 IMP (all), §8.2 revenue by origin |
| 3. Outlets and back office | FR-ORD-18, §4.12 NTF, §4.13 ADM, §8 |

### Appendix B — Primary workflows

*B.1 and B.2 were withdrawn in v3.1.*

**B.3 Online order of sourced goods**
```
Browse / filter by country → Product page (origin, ingredients, expiry window)
   → Add to cart → Checkout → Payment
   → FEFO batch allocation + reservation → Pick & pack → Dispatch (tracking)
   → Delivered → [Return window]
```

*B.4 was withdrawn in v3.1.*

**B.5 Import to shelf**
```
Purchase order → Consignment (permit, certificates, HS code)
   → Customs clearance → Goods receipt (batch, expiry, quantity, rejects)
   → Landed cost allocation → Stock ledger entry → Sellable
   → Expiry alerts (90/60/30 days) → [Markdown] or [Write-off]
```

### Appendix C — Default state machines

| Entity | States |
|---|---|
| Order | `pending_payment` → `confirmed` → `packing` → `dispatched` → `delivered`; `cancelled`, `returned`, `refunded` |
| Batch | `in_transit` → `received` → `available`; `quarantined`, `recalled`, `expired`, `written_off` |
| Invoice | `draft` → `issued` → `part_paid` → `paid`; `credited` |
| Subscription | `active` → `paused` → `active`; `suspended`, `cancelled` |

### Appendix D — Indicative role/permission matrix

Legend: **F** full · **W** create/edit · **R** read only · **—** no access

| Capability | Customer | Reception | Inventory | Shop Mgr | Accountant | Admin |
|---|---|---|---|---|---|---|
| Own profile and addresses | W | W | — | — | — | F |
| Customer records | — | W | — | R | R | F |
| Product catalogue | R | R | R | F | — | F |
| Stock & batches | — | R | F | R | — | F |
| Purchase orders / imports | — | — | F | R | R | F |
| Orders & fulfilment | R (own) | W | R | F | R | F |
| Counter sales (POS) | — | W | — | W | — | F |
| Subscriptions | W (own) | W | R | F | R | F |
| Invoices & payments | R (own) | W | — | W | F | F |
| Refunds & credit notes | — | — | — | W | F | F |
| Reports | — | R (ops) | R (stock) | R (sales) | F (financial) | F |
| Staff & permissions | — | — | — | — | — | F |
| System configuration | — | — | — | — | — | F |
| Audit log | — | — | — | — | R | F |

### Appendix E — *(Withdrawn in v3.0)*
The default preventive schedule was removed with the original product's service lines.

---

*End of document — Amar Gram SRS v3.1 (Draft).*
