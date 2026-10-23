# User Stories — Amar Gram
### Organic & General E-commerce Platform

| Field | Value |
|---|---|
| Document | Product Backlog — User Stories |
| Version | 3.0 |
| Date | 2026-10-23 |
| Derived from | [`docs/SRS.md`](SRS.md) v3.0 |
| Source brief | `instructions/followup_instruction.md` |
| Status | Draft — ready for backlog grooming |
| Change log | v1.0 initial derivation (180 stories). v1.1 payment gateway integration deferred per owner instruction: reworded US-ORD-07, US-ORD-08, US-ORD-15, US-ORD-18, US-BRD-06, US-SUB-01, US-SUB-06; raised US-BIL-06 to Must; added US-ORD-19, US-ORD-20, US-BIL-11, US-BIL-12; added §18.5 listing what was deferred. 184 stories. v2.0 microchip identification removed from the product per owner instruction (not in general use in Bangladesh): US-CAT-02 reworded to neuter status and weight history only, dropping the microchip AC, and re-estimated 5 → 3. Tracks `docs/SRS.md` v2.0. 184 stories. v2.1 per owner instruction (2026-09-22): US-ACC-01 no longer creates an *unverified* account — registration requires no phone or email verification and is protected by a CAPTCHA plus per-source rate limiting instead; ACs rewritten and re-estimated 3 → 5. **Not yet reconciled:** SRS FR-ACC-2 and NFR-SEC-6, and the dependent stories US-ACC-02, US-ACC-03, US-ACC-05 (reset to a *verified* channel) and US-ACC-10 AC2. 184 stories. v2.2 reconciles with `docs/SRS.md` v2.1, which withdraws FR-ACC-2 (verification) and adds FR-ACC-13 (CAPTCHA): US-ACC-01 now traces FR-ACC-1, FR-ACC-13 and NFR-SEC-6; **US-ACC-02 and US-ACC-03 withdrawn** (struck through, IDs retained); US-ACC-05 AC1 reworded to the *registered* channel; US-ACC-10 AC2 replaced pending SRS Q-16; §18 counts and §19 sprint 1 updated. 182 active stories (2 withdrawn). v2.3 tracks `docs/SRS.md` v2.2 — Accounts and Identity is identifier + password only, with no phone, email or OTP verification: US-ACC-01 accepts mobile and/or email and gains a duplicate-email AC; US-ACC-04 reworded to log in with mobile or email and password (OTP login removed); US-ACC-05 kept as recovery; **US-ACC-09 (staff 2FA) withdrawn**; US-ACC-10 AC2 reworded; OTP removed from US-NTF-04. 181 active stories (3 withdrawn). v2.4 tracks `docs/SRS.md` v2.3: **added US-ACC-14** (staff sign-in with mobile/email and password), which had no story once US-ACC-09 was withdrawn. The per-story Accounts handovers were consolidated into `docs/handover/HO-ACC-001.md` (backend) and `HO-ACC-002.md` (frontend). 182 active stories (3 withdrawn). v3.0 tracks `docs/SRS.md` v3.0, the **Amar Gram pivot** (owner, 2026-10-23): the platform is a general e-commerce shop with an organic focus, and the clinic business lines are gone. §2 Cat Profiles, §3 Appointments, §4 Consultation and Medical Records, §5 Surgery, §6 Pharmacy and §7 Boarding are **withdrawn in full** (US-CAT, US-CLN, US-SRG, US-PHM, US-BRD; 73 stories, IDs retained and never reused). Section numbers §8–§19 are unchanged so existing handover references still resolve. §18 and §19 updated. 109 active stories. |

---

## How to read this document

These are **implementation-ready user stories**, not epics. Each one is a vertical slice that delivers value to a named user and can be estimated, built and demonstrated on its own. Stories are grouped by functional area purely for navigation — the grouping headings are not work items and carry no estimate.

**Story format**

> **US-XXX-nn** — As a *&lt;role&gt;*, I want *&lt;capability&gt;*, so that *&lt;benefit&gt;*.
> `Priority` · `Points` · `Traces:` the SRS requirement IDs this story satisfies
> **AC:** acceptance criteria in Given / When / Then form

**Priority** uses the SRS MoSCoW scheme: **M** = Must (launch blocker), **S** = Should, **C** = Could.
**Points** are Fibonacci relative estimates (1, 2, 3, 5, 8, 13). Anything at 13 should be split during grooming.
**Traces** links every story back to the SRS so coverage can be audited in both directions — see §18.

### Definition of Ready
A story may enter a sprint when: the role, capability and benefit are unambiguous; acceptance criteria are testable; dependencies are identified and either done or stubbed; UI states (empty, loading, error, permission-denied) are specified; and the SRS requirements it traces to are not marked open in SRS §11.

### Definition of Done
A story is done when: acceptance criteria pass; unit and integration tests are written and green; server-side permission checks are enforced (not just UI hiding); audit entries are written for state changes; the change is covered by an end-to-end test where it appears in SRS §9; error and empty states are implemented; it works at 360 px width; and it meets WCAG 2.1 AA for the screens it touches.

---

## 1. Accounts and Identity

**US-ACC-01** — As a cat owner, I want to register with my mobile number or email and a password, so that I can book appointments and place orders.
`M` · `5` · Traces: FR-ACC-1, FR-ACC-13, NFR-SEC-6 · *Owner instruction 2026-09-22: no phone or email verification; a CAPTCHA protects registration instead*
**AC:**
- Given I am a guest, when I submit my name, a mobile number and/or an email, a password and a correctly solved CAPTCHA, then an account is created that is ready to use — there is no phone, email or OTP verification step.
- Given I supply neither a mobile number nor an email, when I submit, then I am told at least one is required.
- Given a missing, wrong, expired or already-used CAPTCHA answer, when I submit, then registration is refused before any account check is made, I am told to try the new code shown, and a fresh CAPTCHA is presented.
- Given repeated registration or CAPTCHA requests from the same source beyond the configured limit, when I submit again, then the request is refused with a "too many attempts" message stating when I may retry.
- Given a mobile number already registered, when I submit it, then I am told the number is in use and offered login or password reset — without revealing whether an email also exists.
- Given an email already registered, when I submit it, then I am told the email is in use and offered login or password reset — without revealing whether a mobile number also exists.
- Given a password under 10 characters or on the breached-password list, when I submit, then it is rejected with a specific reason.
- Given I cannot read the CAPTCHA, then I can request a new one, and I am told how to register at the clinic reception instead.

**US-ACC-02** — ~~As a cat owner, I want to verify my mobile by OTP, so that the clinic can reach me about my cat.~~
**Withdrawn in v2.2** — FR-ACC-2 withdrawn in SRS v2.1; the owner does not want phone verification. The ID is retained, not reused. OTP login was also removed in v2.3 (US-ACC-04 is password-only). *(Not built by the consolidated Accounts handovers `HO-ACC-001` / `HO-ACC-002`.)*
~~`M` · `3` · Traces: FR-ACC-2~~

**US-ACC-03** — ~~As a cat owner, I want to verify my email address, so that I can receive receipts and my cat's records.~~
**Withdrawn in v2.2** — FR-ACC-2 withdrawn in SRS v2.1; the owner does not want email verification. The ID is retained, not reused. *(Not built by the consolidated Accounts handovers `HO-ACC-001` / `HO-ACC-002`.)*
~~`M` · `2` · Traces: FR-ACC-2~~

**US-ACC-04** — As a cat owner, I want to log in with my mobile number or email and my password, so that I can reach my account and my cats' records.
`M` · `3` · Traces: FR-ACC-3, NFR-SEC-6
**AC:**
- Given my registered mobile number or email and the correct password, when I log in, then a session is created and my dashboard loads. There is no OTP option.
- Given an unknown identifier or a wrong password, when I log in, then I see the same generic message either way, which does not reveal whether the account exists, and I am offered password reset.
- Given repeated failed attempts, when I retry, then delays increase progressively and the attempts are logged.

**US-ACC-05** — As a cat owner, I want to reset my password, so that I can recover my account.
`M` · `2` · Traces: FR-ACC-4
**AC:**
- Given an account, when I request a reset, then a single-use, time-limited token is sent to the mobile number (or the email, if one was supplied) registered on it — without revealing whether the account exists.
- Given a used or expired token, when I submit it, then it is rejected and I can request another.
- Given a successful reset, then all other active sessions for that account are invalidated.

**US-ACC-06** — As a cat owner, I want to manage my profile, addresses and notification preferences, so that deliveries and messages reach me correctly.
`M` · `5` · Traces: FR-ACC-5, FR-POR-6
**AC:**
- Given I am logged in, when I add multiple addresses, then I can label them and set one default.
- Given I set per-channel preferences, when a marketing message is sent, then my opt-outs are honoured; transactional messages are still delivered.

**US-ACC-07** — As an administrator, I want to create staff accounts and assign roles, so that each person sees only what their job requires.
`M` · `5` · Traces: FR-ACC-6, FR-ADM-2
**AC:**
- Given I am an administrator, when I create a staff user, then I can assign one or more roles from the matrix in SRS Appendix D.
- Given a non-administrator, when they call the staff-creation endpoint directly, then it is refused server-side with 403 and the attempt is logged.

**US-ACC-08** — As a clinic owner, I want staff sessions to expire when idle, so that an unattended terminal cannot be misused.
`M` · `2` · Traces: FR-ACC-7
**AC:**
- Given a staff session idle beyond the configured period (default 30 min), when the next request is made, then re-authentication is required.
- Given unsaved form data at timeout, when I re-authenticate, then my entered data is preserved.

**US-ACC-09** — ~~As an administrator, I want clinical and financial staff to use two-factor authentication, so that sensitive records are protected.~~
**Withdrawn in v2.3** — FR-ACC-8 withdrawn in SRS v2.2; staff sign in with identifier and password. The ID is retained, not reused. *(Not built by the consolidated Accounts handovers `HO-ACC-001` / `HO-ACC-002`.)*
~~`S` · `5` · Traces: FR-ACC-8, NFR-SEC-1~~

**US-ACC-10** — As a receptionist, I want to create a customer record for a walk-in with just name and phone, so that I can start treatment without delay.
`M` · `3` · Traces: FR-ACC-9
**AC:**
- Given a walk-in, when I enter name and phone, then a record is created and marked *incomplete*.
- ~~Given an incomplete record, when an order or booking is attempted online, then verification is required first.~~ *Withdrawn in v2.2 with FR-ACC-2.*
- Given an incomplete record, when the customer sets a password, then the record is no longer incomplete and they can log in online. *How* they set it (proposed: password reset to the recorded phone) is **SRS Q-16** — this story cannot enter a sprint until it is answered.

**US-ACC-11** — As an administrator, I want to merge duplicate customer records, so that a cat's history is not split across two accounts.
`S` · `8` · Traces: FR-ACC-10
**AC:**
- Given two records sharing a phone or email, when I view the duplicates report, then both are listed with their cats, orders and balances.
- Given I confirm a merge, then all cats, visits, orders, invoices and credits move to the surviving record and the merge is audited.

**US-ACC-12** — As a compliance officer, I want every authentication event and staff data change logged, so that I can investigate any incident.
`M` · `5` · Traces: FR-ACC-12, NFR-SEC-8, C-9
**AC:**
- Given any state-changing staff action, when it completes, then an audit entry records actor, action, entity, before/after values, timestamp and IP.
- Given an audit entry exists, when anyone attempts to edit or delete it, then the operation is refused.

**US-ACC-13** — As a cat owner, I want to request deletion of my account, so that my personal data is not kept indefinitely.
`S` · `8` · Traces: FR-ACC-11, D-11, C-3
**AC:**
- Given I request deletion, then my personal data (name, contact details, addresses) is anonymised and I can no longer log in.
- Given clinical and financial records exist, then they are retained for their statutory periods with the owner shown as anonymised, and are never hard-deleted.
- Given I request my data before deletion, then it is exported in a machine-readable format.
- Given the request completes, then it is recorded in the audit log with who actioned it and when.

**US-ACC-14** — As a staff member, I want to sign in with my mobile number or email and my password, so that I can use the back-office screens my roles allow.
`M` · `3` · Traces: FR-ACC-3, FR-ACC-4, FR-ACC-6, FR-ACC-7, NFR-SEC-6 · *Added in v2.4 — staff sign-in had no story once US-ACC-09 was withdrawn*
**AC:**
- Given my staff account's mobile number or email and the correct password, when I sign in, then a staff session is created carrying my assigned roles and the back office loads.
- Given an unknown identifier or a wrong password, when I sign in, then I see one generic message; repeated failures are progressively delayed and every attempt is logged.
- Given a new staff account with no password yet, when I choose "set or reset password", then a single-use token is sent to my registered mobile or email and I can set my first password.
- Given a customer's credentials, when they are used on the staff sign-in, then sign-in fails with the same generic message — a customer account never grants a staff session.

---

## 2 – 7. *(Withdrawn in v3.0)*

Cat Profiles (US-CAT), Clinic Appointments and Consultation (US-CLN), Surgery (US-SRG), Pharmacy and Prescriptions (US-PHM) and Boarding (US-BRD) were removed with the Amar Gram pivot. Story IDs are retained as withdrawn and never reused. Stories in the remaining sections that still mention cats, prescriptions or boarding are superseded where they conflict with v3.0 scope and will be reworded with the Pass 2 code removal.

---

## 8. Shop — Catalogue and Products

**US-SHP-01** — As a shop manager, I want to create products with categories and images, so that customers can find what we sell.
`M` · `8` · Traces: FR-SHP-1, FR-SHP-2
**AC:**
- Given I create a product, then I set name, brand, description, images, category, tags, status and SEO slug.
- Given status is draft, then the product is invisible on the storefront.
- Given categories, then cat food, litter, litter pots and accessories, bags and carriers, health and grooming, and toys and furniture are all supported.

**US-SHP-02** — As a shop manager, I want product variants with their own price and stock, so that sizes and flavours are sold accurately.
`M` · `8` · Traces: FR-SHP-3
**AC:**
- Given a product, when I add variants by size/weight, flavour, colour or pack quantity, then each SKU carries its own price, barcode, stock and images.
- Given a variant is out of stock, then it is shown as unavailable while other variants remain purchasable.

**US-SHP-03** — As a shop manager, I want food products to carry origin and nutrition details, so that customers can buy with confidence and we meet labelling rules.
`M` · `8` · Traces: FR-SHP-4, NFR-LEG-2
**AC:**
- Given a food product, then country of origin, manufacturer, life stage, protein source, ingredient list, guaranteed analysis, feeding guide and storage instructions are recorded.
- Given the product requires veterinary authorisation, then it is flagged prescription-required.
- Given country of origin is missing, then the product cannot be published as active.

**US-SHP-04** — As a cat owner, I want to filter and sort the catalogue, so that I can narrow to what suits my cat.
`M` · `8` · Traces: FR-SHP-5, NFR-PRF-2
**AC:**
- Given the catalogue, then I can filter by country of origin, brand, category, life stage, protein source, price range, availability and rating.
- Given I sort by price, popularity, newest or rating, then results reorder correctly and filters persist.
- Given up to 20,000 SKUs, then results return within 500 ms at p95.

**US-SHP-05** — As a cat owner, I want to browse food by the country it comes from, so that I can choose brands I trust from specific origins.
`M` · `8` · Traces: FR-SHP-6
**AC:**
- Given the Shop by Country view, then each sourced origin is listed with its flag, sourcing notes and product count.
- Given I select an origin, then only products from that origin are shown, with filters still available.

**US-SHP-06** — As a cat owner, I want forgiving search, so that I find products even when I misspell a brand.
`M` · `8` · Traces: FR-SHP-7
**AC:**
- Given a misspelled brand or product name, then relevant results are still returned.
- Given a search by ingredient or tag, then matching products are returned.
- Given no results, then alternatives and popular products are suggested rather than an empty page.

**US-SHP-07** — As a cat owner, I want to see genuine availability and expiry on the product page, so that I am not sold something about to expire.
`M` · `5` · Traces: FR-SHP-8, FR-IMP-8
**AC:**
- Given a SKU, then displayed availability derives from sellable stock, excluding expired, quarantined, damaged and reserved quantities.
- Given the batch that would be allocated expires within the configured window, then its expiry date is displayed before purchase.

**US-SHP-08** — As a shop manager, I want cross-sell and up-sell blocks, so that basket value grows.
`S` · `5` · Traces: FR-SHP-9
**AC:**
- Given a product page, then "frequently bought together" and life-stage recommendations are shown, excluding out-of-stock and prescription-gated items the customer cannot buy.

**US-SHP-09** — As a cat owner, I want to read reviews from verified buyers, so that I can judge a product honestly.
`S` · `8` · Traces: FR-SHP-10
**AC:**
- Given I purchased the SKU, then I may post a rating and review.
- Given I did not purchase it, then posting is refused.
- Given a review is submitted, then it appears only after moderation approval.

**US-SHP-10** — As a cat owner, I want prescription diets gated to an authorisation for my cat, so that therapeutic food is used safely.
`M` · `8` · Traces: FR-SHP-11, FR-PHM-9, BR-2
**AC:**
- Given no valid authorisation, then the product is visible but not purchasable, with the reason and a link to book a consultation.
- Given a valid authorisation, when I add to cart, then I must select the cat it is for, and that cat is recorded on the order line.
- Given the authorisation expires between adding to cart and checkout, then checkout blocks the line and explains why.

**US-SHP-11** — As a cat owner, I want food recommendations based on my cat's profile, so that I choose something appropriate.
`C` · `8` · Traces: FR-SHP-12
**AC:**
- Given my cat's life stage, weight, neuter status and conditions, then suitable products are recommended with the reason shown.
- Given a recorded allergy matches an ingredient, then that product is excluded from recommendations.

**US-SHP-12** — As a shop manager, I want to sell bundles, so that I can offer starter kits.
`S` · `8` · Traces: FR-SHP-13
**AC:**
- Given a bundle, then it is priced as a unit while each component deducts from its own stock.
- Given any component is out of stock, then the bundle is unavailable.

**US-SHP-13** — As a cat owner, I want a wishlist and back-in-stock alerts, so that I can buy when my item returns.
`S` · `5` · Traces: FR-SHP-14
**AC:**
- Given an out-of-stock SKU, when I request an alert, then I am notified once sellable stock exists.

**US-SHP-14** — As a cat owner who reads another language, I want product information in my language, so that I can understand what I am feeding my cat.
`C` · `8` · Traces: FR-SHP-15, C-8
**AC:**
- Given i18n is enabled and I select a language, then product name, description, ingredients and feeding guide are shown in that language.
- Given a translation is missing for a field, then the default-language text is shown rather than an empty field.
- Given a shop manager edits a product, then they can enter content per enabled language.

---

## 9. Imports, Batches and Inventory

**US-IMP-01** — As a procurement officer, I want to maintain suppliers with country and terms, so that purchasing is organised.
`M` · `5` · Traces: FR-IMP-1
**AC:**
- Given I add a supplier, then name, country, contact, currency, lead time and payment terms are recorded.

**US-IMP-02** — As a procurement officer, I want to raise purchase orders, so that I can order stock formally.
`M` · `8` · Traces: FR-IMP-2
**AC:**
- Given a supplier, when I create a PO with SKUs, quantities, unit costs, currency and expected delivery, then it is issued and trackable.
- Given a PO is partially received, then the outstanding quantity remains visible.

**US-IMP-03** — As a procurement officer, I want import consignments with their documents, so that I can satisfy customs and inspection.
`M` · `13` · Traces: FR-IMP-3, NFR-LEG-2
**AC:**
- Given a consignment, then origin country, shipment reference, HS/tariff codes, import permit number, health/veterinary certificate, customs declaration and landed-cost components are recorded with attached documents.
- Given an inspection request, then all documents for a consignment are retrievable together.
- *Split candidate: document storage vs cost capture.*

**US-IMP-04** — As an inventory officer, I want goods receipt to capture batch and expiry, so that perishable stock is controlled.
`M` · `8` · Traces: FR-IMP-4, D-2
**AC:**
- Given a delivery, when I receive it, then I record per SKU the batch/lot number, manufacture date, expiry date, quantity received and quantity rejected with reason.
- Given a food or medicine SKU with no expiry entered, then receipt is refused.

**US-IMP-05** — As an accountant, I want landed cost allocated across a consignment, so that margins reflect true cost.
`S` · `8` · Traces: FR-IMP-5
**AC:**
- Given consignment costs (freight, duty, clearing, insurance), then they allocate across received quantity to give a landed unit cost per batch.
- Given landed cost exists, then margin reporting uses it rather than list purchase price.

**US-IMP-06** — As an inventory officer, I want stock tracked per batch per location, so that I know what is where.
`M` · `8` · Traces: FR-IMP-6
**AC:**
- Given locations (shop floor, warehouse, clinic dispensary, boarding store), then stock is reported per batch per location.

**US-IMP-07** — As a shop manager, I want FEFO allocation, so that stock is sold before it expires.
`M` · `8` · Traces: FR-IMP-7, BR-4
**AC:**
- Given several non-expired batches, when an order allocates, then the soonest-expiring batch is chosen first.
- Given staff override the allocation, then a reason is mandatory and the override is audited.

**US-IMP-08** — As a shop manager, I want sellable stock to exclude unsellable quantities, so that we never oversell.
`M` · `8` · Traces: FR-IMP-8
**AC:**
- Given expired, quarantined, damaged or reserved quantities exist, then none of them count toward displayed availability.
- Given two customers checkout concurrently for the last unit, then exactly one succeeds and the other is told it is unavailable.

**US-IMP-09** — As a clinic owner, I want expired batches blocked absolutely, so that no cat is ever given expired product.
`M` · `5` · Traces: FR-IMP-9, BR-3
**AC:**
- Given a batch past its expiry date, then sale, dispensing and boarding use are all refused with no override available anywhere in the system.

**US-IMP-10** — As an inventory officer, I want expiry alerts ahead of time, so that I can discount stock before losing it.
`M` · `5` · Traces: FR-IMP-10
**AC:**
- Given a batch reaches 90, 60 or 30 days to expiry, then an alert is raised at each threshold.
- Given the near-expiry report, then batches are listed with days remaining and value at risk.

**US-IMP-11** — As a clinic owner, I want to recall a batch and trace who received it, so that I can protect cats quickly.
`M` · `13` · Traces: FR-IMP-11, D-4, BR-14
**AC:**
- Given I mark a batch recalled, then all remaining stock of it is quarantined immediately across every location.
- Given the recall, then every order, customer and cat that received the batch is listed, including dispensing through the clinic and feeding during boarding.
- Given the affected list, then I can notify all of them in one action, and the notifications are logged.
- Given an order containing the batch is unshipped, then it cannot be dispatched.

**US-IMP-12** — As a procurement officer, I want low-stock alerts with reorder suggestions, so that we do not run out.
`S` · `8` · Traces: FR-IMP-12
**AC:**
- Given a SKU falls below its reorder point at a location, then an alert is raised.
- Given consumption history and supplier lead time, then a suggested reorder quantity is calculated.

**US-IMP-13** — As an inventory officer, I want transfers and adjustments with reasons, so that shrinkage is visible rather than hidden.
`M` · `8` · Traces: FR-IMP-13
**AC:**
- Given a transfer between locations, then stock moves with ledger entries at both ends.
- Given an adjustment for damage, theft, sampling or internal use, then a reason is mandatory and adjustments above the configured value require approval.

**US-IMP-14** — As an inventory officer, I want cycle counts and stock takes, so that book stock matches reality.
`S` · `8` · Traces: FR-IMP-14
**AC:**
- Given a count, then a variance report is produced before any adjustment is committed.
- Given I commit the count, then adjustment ledger entries are written with the count as their reference.

**US-IMP-15** — As an auditor, I want every stock movement as an immutable ledger entry, so that stock is fully explainable.
`M` · `8` · Traces: FR-IMP-15, D-3
**AC:**
- Given any receipt, sale, dispense, transfer, adjustment, return or wastage, then a ledger entry records SKU, batch, quantity delta, location, reference document and user.
- Given current stock is displayed, then it is derived from the ledger rather than stored as an editable figure.
- Given a ledger entry exists, then it cannot be edited or deleted.

**US-IMP-16** — As an inventory officer, I want storage requirements recorded and breaches flagged, so that food and medicine are not spoiled by bad handling.
`C` · `5` · Traces: FR-IMP-16
**AC:**
- Given a product, then its temperature and storage requirements are recorded and shown on the receiving and stock screens.
- Given staff report a storage-condition breach for a location, then the affected batches are flagged for inspection and can be quarantined pending a decision.

---

## 10. Cart, Checkout and Orders

**US-ORD-01** — As a cat owner, I want my cart to persist and merge when I log in, so that I do not lose my selections.
`M` · `5` · Traces: FR-ORD-1, FR-ORD-2
**AC:**
- Given a guest cart, when I log in, then it merges with my account cart without duplicating lines.
- Given I switch device, then my cart is present.

**US-ORD-02** — As a cat owner, I want to be told if a price or availability changed before I pay, so that there are no surprises.
`M` · `5` · Traces: FR-ORD-3
**AC:**
- Given a price or stock change since adding to cart, when I reach checkout, then the change is shown explicitly and I must acknowledge it before paying.

**US-ORD-03** — As a cat owner, I want to choose delivery or pickup at checkout, so that I get my order the way that suits me.
`M` · `8` · Traces: FR-ORD-4
**AC:**
- Given checkout, then I select a saved or new delivery address, or pickup, plus a delivery slot where applicable.
- Given a prescription-gated line, then I must select the cat before I can proceed.

**US-ORD-04** — As a cat owner, I want a clear breakdown of my order total, so that I know what I am paying for.
`M` · `5` · Traces: FR-ORD-5, C-6
**AC:**
- Given a cart, then line subtotals, line discounts, order discounts, delivery charge and tax are each shown separately before the total.
- Given any money calculation, then it is computed in integer minor units with no floating-point rounding error.

**US-ORD-05** — As a shop manager, I want discount codes with rules, so that I can run controlled promotions.
`S` · `8` · Traces: FR-ORD-6
**AC:**
- Given a code, then percentage or fixed value, minimum spend, product/category scope, first-order-only, usage limits overall and per customer, and a validity window can all be set.
- Given a code fails any rule, then it is rejected with the specific reason.

**US-ORD-06** — As a shop manager, I want delivery charge rules, so that shipping costs are covered correctly.
`M` · `8` · Traces: FR-ORD-7
**AC:**
- Given zone, order value, weight and service level, then the correct delivery charge is computed and shown before payment.
- Given an address outside all served zones, then checkout explains that delivery is unavailable and offers pickup.

**US-ORD-07** — As a cat owner, I want to pay by cash on delivery or bank transfer, so that I can buy without an online card payment.
`M` · `8` · Traces: FR-ORD-8, C-5, A-2
**AC:**
- Given checkout, then cash on delivery and bank transfer are offered subject to configuration; pickup orders may also be paid in store.
- Given COD is disabled for my zone or my order exceeds the value ceiling, then COD is hidden with the reason available.
- Given any payment, then no card number and no payment token is stored anywhere in the system.
- *Reworded in v1.1: online card and mobile-wallet payment deferred to Phase 5. Estimate reduced from 13 to 8 as the gateway integration is no longer in this story.*

**US-ORD-19** — As a cat owner paying by bank transfer, I want my order held while I transfer the money, so that my items are not sold to someone else.
`M` · `8` · Traces: FR-ORD-22, BR-16
**AC:**
- Given I choose bank transfer, then the order holds in `pending_payment` with stock reserved and the bank details and reference shown to me.
- Given a staff member verifies receipt against the bank record, then the order moves to `confirmed` and I am notified.
- Given the configured window passes (default 48 hours) without confirmation, then the order expires, reserved stock is released and I am notified with an option to re-order.

**US-ORD-20** — As a courier coordinator, I want cash collected on delivery recorded against the order, so that we know what money is owed to us.
`M` · `8` · Traces: FR-ORD-21, FR-BIL-7
**AC:**
- Given a COD order is confirmed, then it proceeds to fulfilment with no prepayment taken.
- Given delivery, then the cash amount collected, the collecting courier or staff member and the date are recorded against the order.
- Given the parcel is refused or undelivered, then the order routes through the returns path and stock is received back into quarantine.

**US-ORD-08** — As a cat owner, I want my order confirmed and stock reserved on payment, so that what I bought is actually held for me.
`M` · `8` · Traces: FR-ORD-9
**AC:**
- Given payment is recorded — a staff member confirms a transfer or in-store payment, or the order is accepted as COD — then an order is created, stock reserved by batch, confirmation sent and an invoice issued, all atomically.
- Given any step fails after payment was recorded, then the failure is surfaced for manual reconciliation and the payment is not silently lost.

**US-ORD-09** — As a shop manager, I want validated order status transitions, so that fulfilment cannot skip steps.
`M` · `5` · Traces: FR-ORD-10
**AC:**
- Given an order, then transitions follow `pending_payment` → `confirmed` → `packing` → `dispatched` → `delivered`, with `cancelled`, `returned` and `refunded` as alternates.
- Given an invalid transition, then it is refused; every valid transition is timestamped and attributed.

**US-ORD-10** — As a warehouse packer, I want pick lists and packing slips, so that I pack the right batch.
`M` · `5` · Traces: FR-ORD-11
**AC:**
- Given confirmed orders, then a pick list is generated grouped by location and batch.
- Given an order, then a packing slip prints with contents and the customer's details.

**US-ORD-11** — As a shop manager, I want dispatch to create a courier shipment with tracking, so that customers can follow their parcel.
`M` · `8` · Traces: FR-ORD-12, FR-ORD-13
**AC:**
- Given dispatch, then a shipment is created via courier API and the tracking number is stored and shown to the customer.
- Given the courier API is unavailable, then a CSV manifest can be exported and tracking entered manually.

**US-ORD-12** — As a cat owner, I want to cancel before my order is packed, so that I can change my mind.
`M` · `5` · Traces: FR-ORD-14
**AC:**
- Given status is `confirmed` and not yet `packing`, when I cancel, then reserved stock is released and any captured payment is refunded.
- Given packing has begun, then self-service cancellation is unavailable and I am directed to contact the shop.

**US-ORD-13** — As a cat owner, I want to return an eligible item, so that I am not stuck with the wrong product.
`M` · `8` · Traces: FR-ORD-15, BR-10
**AC:**
- Given a sealed item within the return window, when I request a return with a reason, then it goes to staff approval.
- Given opened food or used litter, then the return is refused unless a quality defect or an active recall is recorded against the batch.

**US-ORD-14** — As an inventory officer, I want returned stock quarantined pending a decision, so that unsellable goods never go back on the shelf.
`M` · `5` · Traces: FR-ORD-16
**AC:**
- Given a returned item is received, then it enters a quarantine location.
- Given a decision, then it is either restocked against its original batch or written off, with the decision, reason and user recorded.

**US-ORD-15** — As an accountant, I want refunds issued correctly and audited, so that money out is controlled.
`M` · `5` · Traces: FR-ORD-17, FR-BIL-5
**AC:**
- Given a refund is due, then it is issued as cash in store, by bank transfer or as store credit, according to how the customer paid and what they choose.
- Given any refund, then method, amount, reference, issuing staff member and reason are recorded, it is linked to the original invoice as a credit note, and it is fully audited.
- *Reworded in v1.1: automated refund to card or wallet deferred to Phase 5.*

**US-ORD-16** — As a receptionist, I want an in-store point of sale, so that walk-in purchases use the same stock and books.
`M` · `13` · Traces: FR-ORD-18
**AC:**
- Given a counter sale, when I scan items and take payment, then a receipt prints and stock deducts through the same ledger as online orders.
- Given a barcode scan, then the correct SKU and its FEFO batch are selected automatically.
- *Split candidate: scanning, tender handling, receipt printing.*

**US-ORD-17** — As a cat owner, I want one invoice combining the consultation, the food I bought and my cat's boarding, so that paying is simple.
`S` · `8` · Traces: FR-ORD-19, FR-BIL-2
**AC:**
- Given charges from clinic, shop and boarding for the same customer, then they can be combined into one invoice with tax shown per line and each line attributed to its business line for reporting.

**US-ORD-18** — As a shop manager, I want duplicate submissions prevented, so that customers are never charged twice.
`M` · `5` · Traces: FR-ORD-20, COM-3
**AC:**
- Given a double-clicked submit or a repeated form post carrying the same idempotency key, then only one order is created.
- Given any webhook is redelivered (couriers now, payment gateways in Phase 5), then it is processed once by event ID.

---

## 11. Subscriptions

**US-SUB-01** — As a cat owner, I want to subscribe to recurring food deliveries, so that I never run out.
`S` · `8` · Traces: FR-SUB-1, FR-SUB-2
**AC:**
- Given a SKU, when I subscribe with an interval (e.g. 2, 4 or 8 weeks), then the next delivery date is set and shown.
- Given the interval elapses, then an order generates automatically, reserves stock, and is raised as COD or as a bank transfer awaiting confirmation.
- *Reworded in v1.1: without a gateway there is no saved token, so a subscription saves the customer from re-ordering, not from paying each time. Auto-charge returns in Phase 5.*

**US-SUB-02** — As a cat owner, I want to pause, skip, change or cancel my subscription, so that I stay in control.
`S` · `5` · Traces: FR-SUB-3
**AC:**
- Given a subscription before the generation cut-off, then I can pause, skip one delivery, change interval or quantity, or cancel.
- Given a change after the cut-off, then it applies to the following cycle and I am told which one.

**US-SUB-03** — As a cat owner, I want notice before each subscription charge, so that I am not surprised.
`S` · `3` · Traces: FR-SUB-4
**AC:**
- Given an upcoming charge, then a notification is sent the configured number of days before, with a link to skip or change.

**US-SUB-04** — As a shop manager, I want a subscription discount, so that customers are rewarded for committing.
`C` · `3` · Traces: FR-SUB-5
**AC:**
- Given a configured discount, then it applies to every subscription order and is shown on the invoice.

**US-SUB-05** — As a veterinarian, I want prescription-diet subscriptions suspended when authorisation expires, so that therapeutic food is not shipped unsupervised.
`S` · `5` · Traces: FR-SUB-6, BR-2
**AC:**
- Given an authorisation expires, then the subscription suspends before the next generation and both customer and clinic are notified.
- Given a renewed authorisation, then the subscription resumes without needing to be recreated.

**US-SUB-06** — As an accountant, I want unpaid subscription orders chased and handled, so that revenue is not silently lost.
`S` · `5` · Traces: FR-SUB-2, FR-ORD-22, FR-BIL-7
**AC:**
- Given a generated subscription order goes unpaid past its confirmation window, then the customer is reminded and the order expires per FR-ORD-22.
- Given repeated unpaid cycles, then the subscription suspends and staff see it in an unpaid-subscriptions list.
- *Reworded in v1.1: gateway charge retries replaced by confirmation-window chasing until Phase 5.*

---

## 12. Billing and Payments

**US-BIL-01** — As an accountant, I want sequential invoice numbering, so that our books satisfy audit.
`M` · `5` · Traces: FR-BIL-1
**AC:**
- Given an invoice is issued, then it receives the next sequential number for its branch and financial year, with no gaps and no reuse.
- Given concurrent issuance, then no two invoices receive the same number.

**US-BIL-02** — As a cat owner, I want an itemised invoice, so that I can see exactly what I am paying for.
`M` · `5` · Traces: FR-BIL-2
**AC:**
- Given an invoice, then services, products, medicines and boarding nights are itemised with tax shown per line where applicable.

**US-BIL-03** — As a receptionist, I want to take partial payments and track balances, so that customers can pay in stages.
`M` · `8` · Traces: FR-BIL-3
**AC:**
- Given an invoice, then partial payments and deposits are recorded and the outstanding balance is visible on the customer profile.
- Given outstanding balances, then an ageing view groups them by how overdue they are.

**US-BIL-04** — As a receptionist, I want to split one invoice across multiple tenders, so that customers can pay part card, part cash.
`S` · `5` · Traces: FR-BIL-4
**AC:**
- Given an invoice, then multiple payments of different methods can be applied until the balance clears.

**US-BIL-05** — As an accountant, I want finalised invoices immutable and corrections by credit note, so that the audit trail holds.
`M` · `5` · Traces: FR-BIL-5, FR-BIL-6, BR-11
**AC:**
- Given an issued invoice, then it cannot be edited.
- Given a correction, then a credit note is raised against it and a corrected invoice re-issued, both linked.

**US-BIL-06** — As an accountant, I want COD, transfer and till reconciliation, so that I can prove every payment landed.
`M` · `13` · Traces: FR-BIL-7
**AC:**
- Given COD remittances from the courier, then they reconcile against delivered COD orders and shortfalls are listed.
- Given the bank statement, then recorded transfers are matched against it and unmatched entries are flagged both ways.
- Given the daily till count, then it reconciles against in-store cash payments recorded that day.
- *Raised from Should to Must in v1.1: with no gateway settlement file, manual reconciliation is the only control over money received.*

**US-BIL-11** — As a receptionist, I want to record a payment received outside the system, so that the invoice reflects what the customer actually paid.
`M` · `5` · Traces: FR-BIL-12, BR-17
**AC:**
- Given a payment by cash, in-store card or transfer, then I record method, amount, currency, reference, date received and my identity.
- Given the amount exceeds the configured threshold, then a second staff approval is required before it is accepted.
- Given a payment is recorded, then it is fully audited and cannot be edited — corrections are made by reversal and re-entry.

**US-BIL-12** — As a branch manager, I want a daily cash-up, so that I can close the day knowing the money balances.
`S` · `8` · Traces: FR-BIL-13
**AC:**
- Given a branch and a date, then cash, in-store card and transfer payments recorded that day are listed with expected totals.
- Given I enter the counted cash, then the variance is calculated and an explanation is required before the day can be closed.

**US-BIL-07** — As an accountant, I want tax calculated per tax class, so that returns are correct.
`M` · `8` · Traces: FR-BIL-8, NFR-LEG-3
**AC:**
- Given products and services with assigned tax classes, then tax is computed per line at the configured rate.
- Given a rate changes, then invoices issued before the change retain their original rate.

**US-BIL-08** — As a cat owner, I want to use store credit or a gift voucher, so that I can spend what I am owed.
`C` · `8` · Traces: FR-BIL-9
**AC:**
- Given available store credit, then it can be applied as tender, partially or fully, and the remaining balance is shown.

**US-BIL-09** — As an accountant, I want a re-runnable accounting export, so that I do not re-key anything.
`S` · `8` · Traces: FR-BIL-10
**AC:**
- Given a date range, then invoices, payments and credit notes export in the agreed format.
- Given the same range is exported twice, then the output is identical and duplicates are identifiable downstream.

**US-BIL-10** — As a cat owner, I want to earn and redeem loyalty points, so that I am rewarded for staying with the clinic.
`C` · `8` · Traces: FR-BIL-11
**AC:**
- Given qualifying spend, then points accrue at the configured rate across clinic, shop and boarding.
- Given sufficient points, then they redeem as a discount and the redemption is shown on the invoice.

---

## 13. Notifications

**US-NTF-01** — As a cat owner, I want messages on my preferred channel, so that I actually see them.
`M` · `8` · Traces: FR-NTF-1
**AC:**
- Given per-channel preferences, then each notification is sent on the preferred channel with in-app inbox as the always-on fallback.
- Given a channel fails permanently, then the fallback channel is used and the failure is logged.

**US-NTF-02** — As an administrator, I want editable notification templates, so that our wording stays ours.
`S` · `8` · Traces: FR-NTF-2
**AC:**
- Given a template, then I can edit it with variable placeholders and preview it with sample data before saving.
- Given an invalid placeholder, then saving is refused with the offending variable named.

**US-NTF-03** — As a cat owner, I want timely reminders for my cat's care, so that nothing lapses.
`M` · `8` · Traces: FR-NTF-3, FR-CAT-7
**AC:**
- Given due vaccinations, deworming or prescription refills, then reminders are sent ahead of the due date with a direct booking or reorder link.
- Given the cat is deceased or the record inactive, then no reminder is sent.

**US-NTF-04** — As a compliance officer, I want marketing opt-out honoured but transactional messages always delivered, so that we obey the rules without failing customers.
`M` · `5` · Traces: FR-NTF-4
**AC:**
- Given a marketing opt-out, then no marketing message is sent and every marketing message carries an unsubscribe mechanism.
- Given password-reset, payment, medical or incident messages, then they are delivered regardless of marketing preferences.

**US-NTF-05** — As a cat owner, I want quiet hours respected, so that I am not woken by a promotion.
`S` · `3` · Traces: FR-NTF-5
**AC:**
- Given a non-urgent notification generated inside quiet hours, then it queues and sends when the window opens.
- Given an urgent notification (incident, emergency), then quiet hours do not apply.

**US-NTF-06** — As a support agent, I want a notification log with resend, so that I can help when a customer says nothing arrived.
`M` · `5` · Traces: FR-NTF-6
**AC:**
- Given a notification, then channel, template, recipient, status and provider response are logged and searchable.
- Given a failed or missed message, then I can resend it manually and the resend is logged.

---

## 14. Administration and Configuration

**US-ADM-01** — As an administrator, I want to manage branches, hours and holidays, so that booking reflects when we are actually open.
`M` · `8` · Traces: FR-ADM-1, NFR-SCL-1
**AC:**
- Given opening hours and holidays, then appointment and boarding availability respect them.
- Given a second branch is added, then data is branch-scoped and staff are branch-assigned without code change.

**US-ADM-02** — As an administrator, I want granular permissions enforced server-side, so that hiding a button is not our only protection.
`M` · `8` · Traces: FR-ADM-2, NFR-SEC-2
**AC:**
- Given any role, then permissions match SRS Appendix D.
- Given a user calls an endpoint their role disallows, then it returns 403 regardless of what the UI shows, and the attempt is logged.

**US-ADM-03** — As an administrator, I want to manage rosters and leave, so that only genuinely available staff are bookable.
`M` · `8` · Traces: FR-ADM-3
**AC:**
- Given a roster or leave entry, then appointment availability and boarding task assignment update accordingly.
- Given leave is approved for a vet with existing appointments, then those appointments are flagged for rescheduling rather than silently orphaned.

**US-ADM-04** — As an administrator, I want to manage services, pricing, rate cards, tax classes and delivery zones, so that the business can change without a release.
`M` · `8` · Traces: FR-ADM-4
**AC:**
- Given a price change, then it applies to new transactions only; issued invoices and confirmed bookings keep their agreed price.

**US-ADM-05** — As an administrator, I want business rules exposed as settings, so that we can tune operations ourselves.
`M` · `8` · Traces: FR-ADM-5
**AC:**
- Given the settings screen, then booking cut-offs, deposit percentage, expiry alert thresholds, reorder points, vaccination validity windows, quiet hours and session timeout are all editable.
- Given a setting changes, then the change is audited with the previous and new value.

**US-ADM-06** — As a compliance officer, I want to search and export the audit log, so that I can answer questions from an inspector.
`M` · `5` · Traces: FR-ADM-6, FR-ACC-12
**AC:**
- Given filters for user, entity, action and date range, then matching audit entries are listed and exportable.

**US-ADM-07** — As a marketing manager, I want to edit storefront pages and banners, so that content does not need a developer.
`S` · `8` · Traces: FR-ADM-7, NFR-LEG-5
**AC:**
- Given a page, banner, FAQ or policy document, then I can edit and publish it.
- Given a policy document changes, then the version each customer accepted is retained against their acceptance.

**US-ADM-08** — As an administrator, I want maintenance mode, so that I can take the shop down without blocking the clinic.
`C` · `3` · Traces: FR-ADM-8
**AC:**
- Given maintenance mode is on, then the storefront shows a notice while the back office remains fully usable.

---

## 15. Customer Portal

**US-POR-01** — As a cat owner, I want one dashboard showing everything, so that I do not have to hunt for my information.
`M` · `8` · Traces: FR-POR-1
**AC:**
- Given I log in, then my cats, upcoming appointments, boarding stays, recent orders and outstanding balances are all visible on one screen.
- Given I have no cats yet, then an empty state invites me to add one.

**US-POR-02** — As a cat owner, I want to re-order a previous order in one action, so that repeat buying is effortless.
`S` · `5` · Traces: FR-POR-5
**AC:**
- Given a past order, when I re-order, then available items are added to my cart and unavailable or newly prescription-gated items are listed with the reason.

**US-POR-03** — As a cat owner, I want to view my cat's stay diary, so that I can look back on how the stay went.
`S` · `3` · Traces: FR-POR-4, FR-BRD-13
**AC:**
- Given a current or past stay within retention, then daily logs and photos are viewable in date order.

---

## 16. Reporting

**US-RPT-01** — As a clinic manager, I want daily operational reports, so that I can run the clinic day to day.
`M` · `8` · Traces: §8.1, FR-RPT-1
**AC:**
- Given a date and branch, then the daily schedule, surgery register, vaccination due list and queue state are available.
- Given any report, then it is filterable by date range and branch and exportable to CSV and PDF.

**US-RPT-02** — As an inventory officer, I want stock and expiry reports, so that I can protect margin.
`M` · `5` · Traces: §8.1
**AC:**
- Given the stock reports, then stock on hand by SKU/batch/location with valuation, near-expiry with value at risk, and low-stock with reorder suggestions are each available.

**US-RPT-03** — As the business owner, I want revenue split by business line, so that I know which part of the business pays.
`M` · `8` · Traces: §8.2
**AC:**
- Given a period, then revenue is broken down by clinic, shop and boarding, and within the shop by category and by country of origin.
- Given landed cost is known, then margin is shown alongside revenue.

**US-RPT-04** — As the business owner, I want customer and growth reports, so that I can see whether the lines feed each other.
`S` · `8` · Traces: §8.3
**AC:**
- Given a period, then new vs returning customers, lifetime value across all three lines, cohort retention, subscription health and cross-line conversion are available.

**US-RPT-05** — As a staff member, I want a role-specific dashboard, so that I see today's numbers for my job.
`M` · `8` · Traces: FR-RPT-3
**AC:**
- Given my role, then the home dashboard shows that role's key figures for today and nothing I am not permitted to see.

**US-RPT-06** — As the business owner, I want scheduled report emails, so that I get the numbers without logging in.
`S` · `5` · Traces: FR-RPT-2
**AC:**
- Given a report and a schedule, then it is delivered by email on that schedule with the export attached.

---

## 17. Cross-cutting and Technical Stories

These deliver user-visible behaviour required by the non-functional requirements. They are stories, not infrastructure tasks — each is demonstrable.

**US-XCT-01** — As a receptionist, I want the front desk to keep working when the internet drops, so that I can still see today's patients.
`M` · `13` · Traces: NFR-AVL-3, AC-19
**AC:**
- Given connectivity is lost, then today's appointment list and boarding task list remain visible from local cache in read-only mode.
- Given the offline state, then a clear indicator is shown and write actions are disabled rather than failing silently.
- Given connectivity returns, then the view refreshes automatically.

**US-XCT-02** — As a cat owner on a phone, I want the storefront to be fast and usable, so that I can shop on the move.
`M` · `8` · Traces: NFR-PRF-1, NFR-CMP-2, UI-1
**AC:**
- Given a 4G connection, then LCP is within 2.5 s for the 75th-percentile user.
- Given a 360 px screen, then all flows are completable with no horizontal scrolling.

**US-XCT-03** — As a customer using assistive technology, I want the site to be accessible, so that I can use it independently.
`M` · `8` · Traces: UI-6, NFR-USA-6
**AC:**
- Given any customer-facing flow, then it is fully keyboard operable with visible focus, meets 4.5:1 text contrast, labels every field and announces errors.

**US-XCT-04** — As a customer, I want clear errors that tell me what to do, so that I am not stuck.
`M` · `5` · Traces: NFR-USA-4, NFR-USA-5
**AC:**
- Given any error, then the message states what went wrong and the next step in plain language, exposing no stack trace or internal identifier.
- Given a validation error on a long form, then my entered data is preserved.

**US-XCT-05** — As the business owner, I want data backed up and restorable, so that we survive a failure.
`M` · `8` · Traces: NFR-AVL-4, NFR-AVL-5
**AC:**
- Given daily backups with point-in-time recovery, then RPO is within 15 minutes and RTO within 4 hours.
- Given a quarterly restore test, then it is performed and its result recorded.

**US-XCT-06** — As a compliance officer, I want clinical and financial records retained and never hard-deleted, so that we meet our legal obligations.
`M` · `5` · Traces: C-3, D-6, D-8, D-9
**AC:**
- Given a deletion request, then personal data is anonymised while clinical and financial records are retained for their statutory periods.
- Given any application path, then no clinical record can be hard-deleted.

**US-XCT-07** — As a security officer, I want uploads validated and served safely, so that files cannot be used as an attack vector.
`M` · `5` · Traces: NFR-SEC-5
**AC:**
- Given an upload, then type and size are validated and the file is virus-scanned before storage.
- Given a stored file, then it is served from outside the web root through a signed, expiring URL.

---

## 18. Traceability and Coverage

### 18.1 Story counts by area

| Area | Stories | Must | Should | Could |
|---|---|---|---|---|
| Accounts and Identity | 11 | 9 | 2 | 0 |
| Shop & Catalogue | 14 | 8 | 4 | 2 |
| Imports & Inventory | 16 | 12 | 3 | 1 |
| Cart, Checkout & Orders | 20 | 18 | 2 | 0 |
| Subscriptions | 6 | 0 | 5 | 1 |
| Billing & Payments | 12 | 7 | 3 | 2 |
| Notifications | 6 | 4 | 2 | 0 |
| Administration | 8 | 6 | 1 | 1 |
| Customer Portal | 3 | 1 | 2 | 0 |
| Reporting | 6 | 4 | 2 | 0 |
| Cross-cutting | 7 | 7 | 0 | 0 |
| **Total** | **109** | **76** | **26** | **7** |

*v2.2: US-ACC-02 and US-ACC-03 are withdrawn and excluded from these counts. v2.3: US-ACC-09 likewise. v3.0: the six clinic areas (73 stories) are withdrawn.*

### 18.2 Coverage of the business brief (v3.0)

| Brief item | Stories |
|---|---|
| 1. Sell any kind of product, starting with organic goods | US-SHP-01 … US-SHP-14, US-ORD-01 … US-ORD-20, US-SUB-01 … US-SUB-06, US-BIL-01 … US-BIL-12 |
| 2. Goods sourced from different regions and countries, with batch and expiry control | US-SHP-03, US-SHP-05, US-IMP-01 … US-IMP-16, US-RPT-03 |
| 3. Outlets and back office | US-ADM-01 … US-ADM-08, US-NTF-01 … US-NTF-06, US-RPT-01 … US-RPT-06, US-POR-01 … US-POR-03 |

*The original brief's clinic and care-centre items were withdrawn in v3.0.*

### 18.3 Stories flagged for splitting during grooming
Any story estimated at 13 points should be split before entering a sprint:
US-IMP-03 (consignment documents vs landed cost), US-IMP-11 (recall quarantine vs tracing vs notification), US-ORD-16 (scanning, tender, receipt printing), US-BIL-06 (COD vs bank vs till reconciliation), US-XCT-01 (offline mode; its appointment and boarding halves were withdrawn in v3.0).
*US-ORD-07 left this list in v1.1 — dropping the gateway reduced it from 13 to 8.*

### 18.4 Stories blocked by open questions
These cannot enter a sprint until the corresponding SRS §11 question is answered:

| Story | Blocked by |
|---|---|
| US-ORD-07, US-ORD-20, US-BIL-06 | **Q-3 COD policy** — now the critical path, since COD is a primary payment method rather than a secondary one |
| US-ORD-19 | Q-3b bank-transfer confirmation window and who may confirm |
| US-ORD-16, US-BIL-11 | Q-3c in-store card terminal and its settlement report |
| US-ORD-11 | Q-4 courier integration |
| US-BIL-07, US-ORD-04 | Q-5 currency and tax regime |
| US-SHP-05, US-IMP-03 | Q-8 source countries and licences |
| US-BIL-09 | Q-13 accounting system |
| US-XCT-06 | Q-1 regulatory jurisdiction and retention periods |
| US-ACC-10 | Q-16 how a walk-in customer sets a password for their incomplete record |
| US-ACC-01 *(go-live only, not the build)* | Q-17 acceptability of the non-visual CAPTCHA alternative |

*Q-2 (which payment gateway) no longer blocks anything — it is parked with Phase 5.*

### 18.5 Stories deferred with payment gateway integration (SRS Phase 5)
Not in the current backlog. Listed so the deferral is visible rather than forgotten:
online card and mobile-wallet payment at checkout · saved payment tokens · automated refund to the original card or wallet · gateway settlement reconciliation · subscription auto-charge and failed-charge retry · payment webhook handling.

---

## 19. Suggested Delivery Sequence

Aligned to the SRS §10 release plan. Each sprint ends in something demonstrable.

| Sprint | Focus | Representative stories |
|---|---|---|
| 1 | Identity and administration | US-ACC-01, US-ACC-04, US-ACC-05, US-ACC-07, US-ACC-14, US-ADM-01…03 |
| 2 | Billing core | US-BIL-01…03, US-BIL-05, US-BIL-07 |
| 3 | Catalogue and stock foundation | US-SHP-01…04, US-IMP-04, US-IMP-06, US-IMP-15 |
| 4 | Sourcing and expiry control | US-IMP-01…03, US-IMP-07…10, US-SHP-07 |
| 5 | Checkout and orders | US-ORD-01…04, US-ORD-07…09, US-ORD-18…20, US-BIL-11 |
| 6 | Fulfilment, returns, POS, reconciliation | US-ORD-10…16, US-IMP-11, US-BIL-06, US-BIL-12 |
| 7 | Portal and notifications | US-POR-01…03, US-NTF-01…06 |
| 8 | Reporting and hardening | US-RPT-01…05, US-XCT-01…07 |
| 9+ | Growth | US-SUB-01…06, US-BIL-10, US-SHP-09, US-SHP-11 |

---

*End of document — Amar Gram User Stories v3.0.*
