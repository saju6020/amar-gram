# HO-P3 — Store front screens rebuilt to the approved design (frontend, 5 slices)

Owner decisions (2026-10-24, as given to this handover):
- Rebuild the customer-facing screens in `web/` to match the approved design in [`docs/design/store/`](../design/store/README.md): Home, HomePhone, Catalogue, Product, BasketPhone, Checkout, SignIn, Account, Profile, MyOrders, MySubscriptions.
- This is a **layout and screen rebuild only**. HO-P2 already delivered the tokens, fonts, logo, labels and the catalogue model. Use only the APIs that exist today.
- **No backend changes.** If a screen needs data the API lacks, list it in §21 "Backend gaps". Do not design it here, and do not fake it in the UI or the mocks.
- Process: lightweight, as in [HO-P1](HO-P1-RETIRE-CLINIC.md) and [HO-P2](HO-P2-CATALOGUE-AND-THEME.md). Each slice goes through implementation, then build/test/lint, then the five gates in §19.
- The work is split into **five slices**. S0 is small and lands first. S1 to S4 are then built **in parallel** by separate implementers. **No file is owned by two slices** (§13).

Decisions this handover proposes. The owner should confirm them before S0 starts. Until then each one applies as written, and each is recorded as an ADR-FE in §9:

| # | Decision (default) | Why |
|---|---|---|
| D-1 | Visible copy says **"basket"**, as the design does: "Basket · 3", "Add to basket", "Your basket". The route stays `/cart`, and code identifiers, hooks, API clients and file names keep `cart`. | The approved design uses "basket" on every screen. The user stories use "cart". Renaming code would touch files outside this phase. |
| D-2 | **Checkout becomes one page** with three numbered sections (Deliver to · Delivery time · Payment) beside an order-summary aside, as in `Checkout.dc.html`. The customer's choices stay in the URL and **the quote stays the single source of truth**. The `?step=` parameter is retired, and a stale one is ignored. | Matches the design. Keeps ADR-FE-090's data rules and drops only its "stepper" half. |
| D-3 | **Placing an order still lands on `/portal/orders/{id}?placed=1`** (owner, 2026-10-19). That page shows the design's confirmation block ("Thank you! Your order is in."). | The existing owner decision stands, and the design's confirmation content moves to the page we land on. |
| D-4 | **Design content with no API behind it is left out, never faked**: districts, subscriptions, batch numbers, rider notes, free-delivery amounts and grower names. Each omission is a §21 gap. A section appears when its gap closes. | The existing "nothing invented" rule (`tests/components/product/hearth-shop.test.tsx`, ADR-FE-105). |
| D-5 | **The account keeps its routes.** `/portal/orders` (list) and `/portal/orders/{id}` (detail) are not merged into the design's split view. `/portal/orders/{id}/return` stays its own page. The profile keeps its four tab routes (Profile · Addresses · Notifications · Your data), restyled as the design's cards. | Deep links, the `UnsavedChangesGuard` behaviour and the password-confirmed deletion page all depend on separate routes. The owner may ask for the single-page profile later. |
| D-6 | **The account menu keeps Wishlist, My reviews, Billing and Messages**, which the design does not show. Labels follow the design: "My orders" and "Profile & addresses". **Subscriptions is not added** until G2 closes. | No working feature is removed by a restyle. |
| D-7 | **Once a size is in the basket, a product card swaps its Add button for a leaf quantity stepper** (− n +), on every width, as in `HomePhone.dc.html`. | One behaviour that is consistent across widths. It uses the existing cart-line update and remove calls. |

**Owner answers (2026-10-25):**
- D-1 ("basket") and D-2 (single-page checkout) are **confirmed**. D-3 … D-7 apply as written.
- **OQ-3 footer contact:** add the Contact column with the placeholders **+880 1711-000100** and **hello@amargram.example**, which the owner will replace later.
- **OQ-4 backend gaps:** **G1** (district of origin), **G4** (rider note), **G5** (public free-delivery threshold and lead time) and **G8** (certifications on catalogue items) are being built now in `src/` by a separate backend change. The slices build without them, as D-4 says. A follow-up wiring pass adds them through `lib/**` and `mocks/**` once the API lands. The other gaps stay open.

---

## 1. Identity

| Field | Value |
|---|---|
| Handover ID | `HO-P3-STORE-FRONT` |
| Title | Store front screens rebuilt to the approved design |
| Date | 2026-10-24 |
| Author | Technical lead (handover-writer agent) for shahjahan |
| Backlog | [`docs/USER_STORIES.md`](../USER_STORIES.md): US-SHP-02 … 06, US-ORD-01 … 07, US-ORD-12, US-ORD-13, US-ORD-19, US-POR-01, US-POR-02, US-ACC-01, US-ACC-04 … 06. US-SUB-01/02 are **deferred** (G2) |
| SRS | [`docs/SRS.md`](../SRS.md): UI-1, UI-3, UI-4, UI-6, NFR-CMP-2, NFR-PRF-1, NFR-USA-4, NFR-USA-5 |
| Pairs with | HO-P4 (back-office screens, not yet written). The screens restyled here were built by [HO-SHP-002](HO-SHP-002.md), [HO-ORD-002](HO-ORD-002.md), [HO-ACC-002](HO-ACC-002.md) and [HO-POR-002](HO-POR-002.md) |
| Approved design | [`docs/design/store/`](../design/store/README.md): `README.md`, `index.css`, `index.html` and the eleven `*.dc.html` screens (owner, 2026-10-24). No separate `architect` design exists. This handover turns the owner's visual design into build instructions and records the decisions it needs (D-1 … D-7) |
| Baseline commit | `46929be` on `feat/phase2-catalogue-theme` (HO-P1 and HO-P2 done) |
| Amended | **2026-10-25 (owner-ratified, ARCHITECTURE gate run 1).** (a) `tests/e2e/journey-real-api.spec.ts` (§14) updated for D-2 and the S2 copy: h1 "Checkout", no stepper list or "Continue" clicks, "Add to basket", "Items in your basket" (`3c98022`). (b) Post-merge edits to slice-owned specs for the same coupling: S3's `ordering-customer.spec.ts`, `ordering-a11y-responsive.spec.ts` and S4's `ordering-customer-orders.spec.ts` (E-C2 on the single page; "Added 1 × 2 kg to your basket.") (`3c98022`). (c) `components/hearth/HearthLogo.tsx` (§14, import-only) gains an optional `accentClassName` (default `text-leaf`, so every HO-P3 caller is unchanged), for the HO-P4 staff-sidebar contrast fix (`7cdfd78`); reviewed under HO-P4. (d) `components/common/portal-header.tsx` (S0) fits 360 px: the logo drops to `text-xl` and hides its tag below `sm` (`f7fe2af`). (e) S0 §17.1 exception edits, as S0's report: splits into `tests/components/{catalogue/results-states,checkout/hearth-steps,portal/portal-header,product/add-to-cart-button,shop/countries-load-error,shop/home-hero,shop/load-error,shop/origin-grid}`; cart→basket and "Search the shop" (§8.3, U2) wording in `tests/components/{cart/cart,catalogue/product-card,hearth/hearth,portal/account-sidebar,product/hearth-shop,shop/shell}` and `tests/e2e/{journey-real-api,ordering-customer-orders,ordering-customer,shop-catalogue}` (`e29a0ae`).  **2026-10-25 (owner-ratified, TEST gate run 1).** (f) `mocks/**` (§12/§14) is opened for two pre-existing mock gaps the §16 cases need: the ordering mock's re-order handler returns nothing for an order it does not own, and the portal's fixture re-order handler is registered after it as a fallback (`mocks/handlers/ordering/customer.ts`, `mocks/handlers/portal/index.ts`; E13, E14). (g) `shop-catalogue.spec.ts` E-A4 searches the current fixture's ingredient "sap" instead of the pre-HO-P2 "sunflower" (E4).|

---

## 2. Objective

Amar Gram's customer website already works end to end: browse, filter, buy, check out, track, return and manage the account. HO-P2 gave it the ripe mango and banana leaf theme at the token level. The screen layouts are still the pre-pivot "Hearth" ones. This phase rebuilds the layouts so each customer screen matches the owner-approved design in `docs/design/store/`: the leaf-green strip and bands, papaya buttons, mango highlights, Fraunces headings, pill controls, the phone tab bar and the single-page checkout.

The rebuild is cosmetic and structural. It does not change behaviour. Every existing guarantee stays in place:
- server-owned prices, totals and availability
- idempotent order placement
- the guest-cart merge
- the `?next=` allow-list
- WCAG 2.1 AA and the 360 px floor
- maintenance mode
- the "nothing invented" rule

Where the design shows data the API does not have, the screen leaves it out and §21 records the gap for a later backend handover.

---

## 3. In scope

### 3.1 Design screen → existing route → slice

| Design screen | Route(s) today | Slice | Stories **2026-10-25 (owner-ratified, ACCEPTANCE gate run 1).** (h) D-A: `shop-product.spec.ts`'s draft-slug case accepts 200 + `noindex` (streaming behind `loading.tsx` commits 200 before the not-found boundary) and the no-JS case checks the delivered HTML; the unverified "production answers 404" comment is removed. D-B: the two staff-area failures (`accounts-a11y-responsive` "E-X1 (idle lock open)", `shop-staff` E-C1; both failed at baseline) pass to HO-P4 (recorded there). D-C: E16 is waived to the HO-P3 spec set (518 pass; 4 failures = D-B); the full `npm run test:e2e` runs at HO-P4 integration. Copy: the S1 home and countries pages say the origin is named "on our products" / "on our foods" (a bundle has no single country). |
|---|---|---|---|
| Shell: leaf top strip, header, category pills, footer, phone tab bar, account header | `app/(shop)/layout.tsx`, `app/(portal)/layout.tsx` | **S0** | (all) |
| `Home.dc.html` + `HomePhone.dc.html` | `/shop` (`app/(shop)/shop/page.tsx`); also `/shop/countries`, `/shop/countries/[countryCode]` (the footer's "Shop by region") | **S1** | US-SHP-05, US-ORD-01 (quick add) |
| `Catalogue.dc.html` | `/shop/products` | **S2** | US-SHP-04, US-SHP-06 |
| `Product.dc.html` | `/shop/products/[slug]` | **S2** | US-SHP-02, US-SHP-03, US-ORD-01 |
| `BasketPhone.dc.html` (basket half) | `/cart` | **S3** | US-ORD-01, US-ORD-02 |
| `Checkout.dc.html` + `BasketPhone.dc.html` (checkout half) | `/checkout` (`/checkout/complete/[orderId]` stays a redirect) | **S3** | US-ORD-02 … 07, US-ORD-19 |
| `SignIn.dc.html` | `/sign-in`, `/register` (and `/forgot-password`, which shares the shell) | **S4** | US-ACC-01, US-ACC-04, US-ACC-05 |
| `Account.dc.html` | `/portal` (overview) + the account frame | **S4** | US-POR-01, US-POR-02 |
| `MyOrders.dc.html` | `/portal/orders`, `/portal/orders/[orderId]`, `/portal/orders/[orderId]/return`; the `Checkout.dc.html` confirmation block appears at `?placed=1` | **S4** | US-ORD-12, US-ORD-13, US-ORD-19, US-POR-02 |
| `Profile.dc.html` | `/portal/account/{profile,addresses,notifications,data}` (+ `data/delete`) | **S4** | US-ACC-06 |
| `MySubscriptions.dc.html` | **none: no API** | — | US-SUB-01/02 **deferred** (§4.1, G2) |

### 3.2 The slices

| Slice | Name | Size | Starts | One-line purpose |
|---|---|---|---|---|
| **S0** | Shared shell and product card | Small | First, alone | Layout shells, header, footer, phone tab bar, the basket badge, `ProductCard`/`ProductGrid`, shared Hearth class helpers, the ADR-FE entries, the one-time test-file splits (§17.1) |
| **S1** | Shop home | Medium | After S0 merges | `/shop` desktop and phone, the countries pages, hero, category tiles, growers band, promises |
| **S2** | Catalogue and product | Medium | After S0 merges | `/shop/products` and `/shop/products/[slug]` |
| **S3** | Basket and checkout | Large | After S0 merges | `/cart` and the single-page `/checkout` (D-2) |
| **S4** | Sign-in and account | Large | After S0 merges | `/sign-in`, `/register`, the account frame, overview, my orders, order detail and confirmation, return, profile tabs |

---

## 4. Out of scope

### 4.1 Deferred elsewhere

| What | Why | Who will meet it |
|---|---|---|
| `MySubscriptions.dc.html`; the overview's "Next staples box"; the Home "monthly staples box" band; the product page's "Repeat monthly and skip any time" note; a Subscriptions entry in the account menu | No customer subscriptions API exists in `src/` (G2) | A backend subscriptions handover (HO-SUB-001 is written but not built), then a frontend follow-up to this handover |
| District of origin: card eyebrows "DINAJPUR", the District filter with counts, the product's "Grown in Birganj, Dinajpur", and "Village on every pack" | G1 | Catalogue backend follow-up |
| "Organic" badge on catalogue cards | G8 | Catalogue backend follow-up |
| Batch numbers on order lines | G3 | Orders backend follow-up |
| "Note for the rider" at checkout | G4 | Orders backend follow-up |
| Free-delivery amount in the top strip, and the basket's "Add ৳X more for free delivery" for a guest or before an address is chosen | G5 | Orders backend follow-up |
| My orders "All / Active / Past" filter | G6. The existing single-status filter stays | Orders backend follow-up |
| "Buy again" with current price and a frequently-bought list | G7. An interim version is built (§11 S4) | Orders backend follow-up |
| "Download invoice" from an order | G10. An interim link to `/portal/billing` is built | Billing backend follow-up |
| Phone header "Delivering to Dhanmondi, Dhaka · change" | Not built in this phase. Guests have no address; signed-in customers would need an extra read in the shared header | Later follow-up |
| Back-office screens | HO-P4 | HO-P4 |

### 4.2 Excluded and not changing

- `/portal/billing/**`, `/portal/inbox`, `/portal/wishlist/**`, `/portal/reviews/**`, `/forgot-password`'s form, `/reset-password`, `/account-deleted`, `/unsubscribe`, `/faqs`, `/pages/[slug]`, `/policies/[key]` and every staff route. They inherit the restyled shell and nothing else.
- `app/page.tsx` (the root redirect).
- The design's prototype-only bits: `[BRACKET]` placeholders, the "(Prototype: skip to my account)" link, the palette switcher, and hard-coded sample products and prices.

### 4.3 Forbidden shapes

- **Any price, total, delivery charge, discount, tax or free-delivery figure computed in the browser.** This includes the design's "৳180 × 2 = ৳360" on the product page and the basket footer's "Total". Show only the numbers the server sends (ADR-FE-090, ADR-FE-105).
- **Any hex, `rgb()` or `hsl()` colour literal in a component**, including Tailwind arbitrary values such as `bg-[#3F6A1E]`. Use the token utilities (§7.2).
- A new token in `app/globals.css`, a new dependency, or a new API client, hook or mock handler.
- A mock field or fixture that the real API does not send (§20.3).
- Card, wallet or "pay online" UI (SRS §1.2, C-5).

---

## 5. Prerequisites

| Required | State |
|---|---|
| HO-P1 (clinic removed, AmarGram rename, fresh baseline) committed | ✅ `6bbc290`, `2b3de1e` |
| HO-P2 (catalogue model, tokens, fonts, logo, labels, seed) committed | ✅ `601fc30`, `46929be` |
| Approved design in `docs/design/store/` | ✅ |
| Existing customer APIs: `/api/shop/*`, `/api/cart*`, `/api/customers/me/checkout/quote`, `/api/customers/me/orders*`, `/api/customers/me` (profile, addresses, notification preferences, export, deletion), `/api/portal/dashboard`, `/api/auth/*` | ✅ verified in `src/Api/AmarGram.Api/Controllers` |
| `web/` builds, lints, typechecks and passes Vitest at the baseline (known timing-flaky files excepted) | ✅ per HO-P2 §4 |
| **S0 merged before S1–S4 branch** | ❌ (this phase's first step) |

---

## 6. Governing architecture documents

| Document | What you need from it |
|---|---|
| [`docs/design/store/README.md`](../design/store/README.md), `index.css`, `*.dc.html` | The approved layout, spacing, shapes and copy for each screen. Read the `.dc.html` markup and its `renderVals()` for each state (empty, added, selected, error, confirming) |
| [`HO-P2-CATALOGUE-AND-THEME.md`](HO-P2-CATALOGUE-AND-THEME.md) §2 | The token table, fonts, logo and labels. These are fixed inputs, not to be changed here |
| `web/app/globals.css` | The only colours you may use (§7.2). Read it; do not edit it |
| `web/docs/decisions.md` ADR-FE-029 … 038 (HO-SHP-002), ADR-FE-089 … 098 (HO-ORD-002), ADR-FE-001 … 012 (HO-ACC-002), ADR-FE-119 … 126 (HO-POR-002), ADR-FE-173 (Hearth layer) | The binding frontend decisions: server components for the shop (030), URL state for catalogue and checkout (031, 090), cart as server state (089), the quote as truth (090), sign-in landing (098), the customer theme layer only on customer layouts (173). The new ADR-FE-174 … 179 (§9) amend 090 and 173 |
| [`HO-SHP-002`](HO-SHP-002.md), [`HO-ORD-002`](HO-ORD-002.md), [`HO-ACC-002`](HO-ACC-002.md), [`HO-POR-002`](HO-POR-002.md) | What each screen must keep doing. Their §15/§16 cases are still in the suites this phase must keep green |
| `web/README.md` | Layering: `fetch` only in `lib/api/client.ts`, `useQuery`/`useMutation` only in `lib/hooks`, no hex literals |
| [`docs/SRS.md`](../SRS.md) §3.1 (UI-1 … 6), §6 (NFR-PRF-1, NFR-USA-4/5, NFR-CMP-2) | §7.1 below |
| `.claude/agents/frontend-developer.md` | Component size, tokens, and "flag, don't introduce" for libraries |
| `.ai/architecture.md`, `.ai/cqrs.md`, `.ai/bounded-contexts.md`, `.ai/namespace-conventions.md`, `.ai/decisions/adr.md` | **These describe the .NET backend only and do not govern this diff** (same position as HO-ORD-002 §6). They matter here only for §21: a gap is a backend decision for a later handover, not for this one |

---

## 7. SRS UI requirements as build rules

### 7.1 Rules

| Req | Rule | Where enforced |
|---|---|---|
| **UI-1 / NFR-CMP-2** | Every rebuilt screen works at 360, 768, 1024 and 1440 px with no horizontal scroll. The phone layouts follow `HomePhone`/`BasketPhone`. The catalogue grid stays **2 / 3 / 4 columns at 360 / 768 / ≥1024** (asserted in `shop-a11y-responsive.spec.ts`) | Every slice. E2, E3, E6, E9, E12, E14 |
| **UI-3** | Destructive actions still confirm, stating what is affected: remove a basket line (Undo), cancel an order, delete the account (its own password-confirmed page). The design's inline "Delete your account?" box **does not replace** the existing deletion page | S3, S4 |
| **UI-4** | The catalogue keeps filters, sort and pagination. My orders keeps its status filter and paging | S2, S4 |
| **UI-6** | WCAG 2.1 AA: text contrast ≥ 4.5:1 (≥ 3:1 only for text ≥ 24 px, or ≥ 18.66 px bold); visible focus (the global ring is not overridden); every stepper button has an accessible name that includes the product ("One more Chinigura rice"); toggles use `aria-pressed` or radio semantics; tabs use `tablist`/`tab`/`tabpanel` with arrow keys; status uses text and an icon, never colour alone; the phone tab bar uses `aria-current="page"`; no control is smaller than 44 × 44 px | Every slice. axe in E3, E6, E9, E12, E14 |
| **NFR-PRF-1** | `/shop`, `/shop/products` and `/shop/products/[slug]` stay **Server Components** with client islands. No new client-side data fetch blocks the first paint. The product page's first image is still the LCP element | S1, S2 |
| **NFR-USA-4** | Error text stays plain and actionable, from `describeOrderingError` and the existing helpers | S3, S4 |
| **NFR-USA-5** | The forms keep `UnsavedChangesGuard`: profile, return request and the address form | S4 |
| **Label in name (WCAG 2.5.3)** | An accessible name contains its visible text. "Basket · 3" is named, for example, "Basket, 3 items" | S0 and every slice |

### 7.2 Design colours → tokens (no new tokens)

The design uses a few values that have no token of their own. Map them like this. **`app/globals.css` is not edited in this phase.**

| Design value | Used for | Use |
|---|---|---|
| `#FBF3E2` / `#FFFAF0` | page / cards | `bg-surface-page` / `bg-surface` |
| `#3F6A1E` | strip, logo badge, growers band, selected states, chips | `bg-leaf`, `text-leaf`, `border-leaf` |
| `#2F5114` | leaf text on light backgrounds | `text-leaf-ink` |
| `#557A1F` | origin eyebrows, "Gram" in the wordmark | `text-leaf` (higher contrast than the design value) |
| `#E3EDC6` / `#E6EFC9` | hero and catalogue bands, selected options, success messages | `bg-leaf-soft` (or `bg-accent-tint` inside the customer layer) |
| `#F4F8E8` / `#DCE8C3` | text on leaf | `text-leaf-soft` (≈ 5:1 on `bg-leaf`) |
| `#55823A` | tiles on the leaf band | `bg-leaf-ink` |
| `#F7D87A` | "Gram" on a leaf background, links on the leaf band | `text-warm`, **only for the wordmark at ≥ 24 px bold** (≈ 3:1). Links on leaf use `text-leaf-soft underline` |
| `#B4531A` / `#8A3D11` | primary buttons, links | `bg-accent` / `text-accent` / `text-accent-ink` |
| `#EDA73A` | Add buttons, count badges | `bg-warm` with `text-ink` (mango is a fill, never text, per `globals.css`) |
| `#2A1F12` / `#69553C` / `#53432D` | ink / muted / body | `text-ink` / `text-ink-muted` / `text-ink-muted` |
| `#E6D3AE` / `#EFCB86` (dashed) | borders / dashed placeholders and dividers | `border-border` / `border-border-strong border-dashed` |
| `#FCEBC7`/`#6E4700`, `#FBE3DA`/`#8A2814`, `#A3301B` | warning, danger, the danger button | `bg-warning-bg text-warning-ink`, `bg-danger-bg text-danger-ink`, `bg-danger-ink text-white` |
| Product photo tints | placeholders | the existing `ProductPackArt` / `PACK_BG` tones (unchanged) |

---

## 8. Frontend architecture

### 8.1 Route groups (unchanged)

`(shop)` is public, Server Components and `data-theme="customer"`. `(portal)` is customer-guarded and includes `/checkout`. `(auth)` is the public minimal shell. This phase adds no route group and no route, and deletes no route.

### 8.2 Layering (unchanged and binding)

- Pages and components may import from `lib/**`. Nothing in `lib/**` changes (§14).
- Data comes only from existing hooks: `useCart`, `useAddCartLine`, `useUpdateCartLine`, `useRemoveCartLine`, `useCheckoutQuote` and the related hooks, `useMyOrders`, `useMyOrder`, `useReorder`, `useDeliveryAddresses`, `useCustomerProfile`, `usePortalDashboard`, `useWishlist` and so on. Server reads use the existing `…Server` functions in `lib/api/shop-catalogue.ts`.
- Shared visual helpers live in `components/hearth/*` (class strings in `card.ts`, `buttons.ts`, `fields.ts`). A slice that needs a new helper of its own puts it in **its own** folder (for example `components/shop/home/`) and does not add it to `hearth/`.

### 8.3 Shared pieces built by S0, which other slices only import

| Piece | Contract other slices rely on |
|---|---|
| `ShopHeader` (+ `ShopTopStrip`, `SearchBox`, `CategoryChips`) | Desktop: a leaf strip showing the **first `Shop` banner's title** (a link when it has `linkUrl`; the strip is not rendered when there is no banner); then logo, a pill search labelled "Search the shop", Sign in or the account name, the `CartBadge` pill; then the category pill row. Phone (< 768 px): the same content on a leaf background, with the search under the logo row. Sticky, as today |
| `MobileTabBar` (new, in `(shop)/layout.tsx`) | Below `md` only: four links, Home `/shop`, Shop `/shop/products`, Basket `/cart`, Account (`/portal` when signed in, `/sign-in` otherwise). `nav aria-label="Shop sections"`, `aria-current="page"` on the current link. **Not rendered on `/cart`**, which has its own sticky footer. Reserves bottom padding so it never covers the last content |
| `CartBadge` | `appearance="pill"` (default): the dark "Basket · N" pill named "Basket, N items". `appearance="icon"`: a round leaf button with a mango count, as on phones and in the portal. The props stay compatible with today's callers |
| `QuantityStepper` | `− n +` with 44 px buttons. Takes `label` (the product) for the accessible names "One less {label}" / "One more {label}". `tone="leaf"` (filled) or `tone="outline"`. Min/max come from the caller (the server's `maxQuantityPerLine`) |
| `ProductCard` / `ProductGrid` | The design's card: a tinted or photo square, the producer/country eyebrow (G1: no district), the name as the heading link, the size, a Fraunces price (`fromPrice`, as sent), and a mango **Add** pill. When this size is in the basket, a leaf `QuantityStepper` replaces Add (D-7). "Alert me" stays for out-of-stock items, and the wishlist heart is kept. `ProductGrid` keeps the 2/3/4-column rule and its `wide` and `headingLevel` props |
| `PortalHeader` | On `/checkout…`: logo plus "Secure checkout" (lock icon), with no search, badges or menu. Everywhere else: today's header restyled (logo, search, Shop link, basket and inbox icons, account menu) |
| `ShopFooter` | Ink background. Columns: brand line; **Shop** (All products → `/shop/products`, Shop by country → `/shop/countries`); **Help** (FAQs → `/faqs`, Terms → `/policies/terms`). There is no Contact column until the owner supplies a phone and email (OQ-3) |
| `hearth/card.ts`, `buttons.ts`, `fields.ts`, `HearthBand`, `IconTile`, `HearthEmpty`, `GreetingHeader` | Restyled to the design's radii (cards 24 px, bands 32 px, pills full), the 1.5 px border and the leaf selection colour. **Exported names stay the same**, so callers compile unchanged |

### 8.4 State

There is no new state. Catalogue state stays in the URL (ADR-FE-031). Checkout choices stay in the URL (ADR-FE-090); `step` is removed from the parsed state (D-2). The cart is server state (ADR-FE-089).

---

## 9. ADRs to record during this build

**S0 appends all six to `web/docs/decisions.md` in its first commit**, so every parallel slice builds against recorded decisions. Range: **ADR-FE-174 … ADR-FE-180** belongs to HO-P3 (180 is spare). The integrator must also add the range to the ADR table in `docs/handover/README.md`. This handover does not edit that file.

| ADR | Decision | Supersedes / amends |
|---|---|---|
| ADR-FE-174 | Customer-facing copy says "basket". Routes, identifiers and API names keep `cart` (D-1) | — |
| ADR-FE-175 | Checkout is one page with three numbered sections and a summary aside. Choices stay in URL search params and the quote is the single source of truth; `step` is retired and ignored when present (D-2) | Amends ADR-FE-090 ("one route with a stepper"). Its data rules stand |
| ADR-FE-176 | Store-front shell: the leaf top strip carries the first `Shop` banner; a phone tab bar on `(shop)` pages below `md` (not on `/cart`); a "Secure checkout" header variant on `/checkout` | Amends ADR-FE-173 (header) |
| ADR-FE-177 | Design content without API data is omitted, not faked. Static copy is limited to the design's own headings and promises, and states nothing the system does not do (D-4) | Restates the existing "nothing invented" rule for this phase |
| ADR-FE-178 | A product card in the basket shows a quantity stepper in place of Add (D-7) | — |
| ADR-FE-179 | The account keeps separate routes for the order list, order detail, return, and the four profile tabs. The overview, sidebar and pages take the design's look (D-5, D-6) | — |

**Proposed backend ADRs:** none in this phase. Each gap in §21 is an open question for the backend handover that takes it on.

---

## 10. Dependencies

| Kind | Rule |
|---|---|
| npm packages | **None added.** `lucide-react` icons, `next/font`, React Query and the existing UI primitives are enough. If a slice thinks it needs a package, see §20.5 |
| APIs | Only those in §5. Gaps are in §21 |
| Between slices | S1–S4 depend on S0's contracts (§8.3) and on nothing from each other. A slice that needs a change to another slice's file stops (§20.2) |

---

## 11. Components and screens, per slice

### S0: Shared shell and product card

| Item | Change | Serves |
|---|---|---|
| `app/(shop)/layout.tsx` | Mount `ShopTopStrip` (first `Shop` banner) above `ShopHeader`. `BannerStrip` shows the **remaining** `Shop` banners. Mount `MobileTabBar`. Restyled `ShopFooter` | all |
| `components/shop/ShopTopStrip.tsx` (new), `ShopHeader.tsx`, `SearchBox.tsx`, `CategoryChips.tsx`, `LanguageSwitcher.tsx`, `BannerStrip.tsx`, `MaintenanceNotice.tsx`, `ShopLoadError.tsx`, `ShopFooter.tsx` | Design header, strip, pills (selected pill = `bg-leaf text-leaf-soft`), footer | all |
| `components/shop/MobileTabBar.tsx` (new) | §8.3 | HomePhone |
| `app/(shop)/_components/ShopAccountLinks.tsx`, `MaintenanceGate.tsx`; `app/(shop)/{error,loading,not-found}.tsx` | Restyle only | all |
| `components/cart/CartBadge.tsx`, `components/cart/QuantityStepper.tsx` | §8.3 | US-ORD-01 |
| `components/catalogue/ProductCard.tsx`, `ProductGrid.tsx`; `components/product/StatusText.tsx` | §8.3, D-7. "Add {name · size} to basket". The stepper calls `useUpdateCartLine`. At quantity 1, "−" calls `useRemoveCartLine` and announces "Removed … from your basket" | US-ORD-01, US-SHP-04 |
| `app/(portal)/layout.tsx`, `app/(portal)/loading.tsx`, `components/common/portal-header.tsx` | §8.3 checkout variant and restyle. `CustomerSessionGuard`, `PolicyAcceptancePrompt` and `AccountFrame` stay mounted exactly as today | all portal |
| `components/hearth/{card.ts,buttons.ts,fields.ts,HearthBand.tsx,IconTile.tsx,HearthEmpty.tsx,GreetingHeader.tsx}` | Design radii, borders, leaf selection. Exports unchanged | all |
| `web/docs/decisions.md` | Append ADR-FE-174 … 179 | — |
| Test-file splits (§17.1) and the "basket" wording in specs and helpers | One-time, mechanical | — |

### S1: Shop home (`Home.dc.html`, `HomePhone.dc.html`)

| Item | Change | Serves |
|---|---|---|
| `app/(shop)/shop/page.tsx` | Section order: hero band → "Shop the pantry" category tiles → "Fresh from the haat" (newest 8, `ProductGrid`, "See all products") → growers band → promises. **No staples-box band** (G2) | US-SHP-05 |
| `components/shop/ShopHero.tsx` | `bg-leaf-soft rounded-band` two-column band. Content comes from the first `Home` banner (title, body, link), as today. **With no banner**, the design's copy: the h1 "Honest food, *grown the slow way.*" (italic part `text-leaf`), the intro sentence, "Shop the harvest" → `/shop/products`, "Meet the growers" → `#growers`. The arched picture area uses the existing illustration or pack art, never a fake photo. The "This week's harvest" card links to the newest product (name, then producer · country) | — |
| `components/shop/home/CategoryTiles.tsx` (new) | One tile per API category: a tinted circle with the HO-P2 `categoryIcon`, the label, and "N products". Links to `/shop/products?category=…` (+ `lang`) | US-SHP-04 |
| `components/shop/home/GrowersBand.tsx` (new) | `id="growers"`, `bg-leaf text-leaf-soft rounded-band`. The design's heading and paragraph, then up to two **featured origins** from `GET /api/shop/origins` (name, product count, link `/shop/countries/{code}`). The "Read our sourcing story" link goes to `/shop/countries`. **No invented grower names or photos.** With no featured origins it shows the text only | US-SHP-05 |
| `components/hearth/DeliveryPromise.tsx` (`PromiseStrip`, `DeliveryPromiseCard`) | Dashed cards with a leaf tick. Titles, **true facts only**: "Organic where we say so — certified items are marked"; "Cash on delivery — pay when it reaches you"; "Returns on eligible items"; plus the existing delivery/pickup fact. **Not** "Village on every pack" (G1) and **no** free-delivery amount (G5). `DeliveryPromiseCard`'s export and props stay unchanged (S2 imports it) | — |
| Phone layout (< 768 px), same route | A seasonal card (the first `Home` banner, `bg-leaf-soft`, if any) → a horizontally scrolling category circle row (`nav aria-label="Categories"`; it scrolls inside itself and never scrolls the page) → "Fresh from the haat" + "See all" → a 2-column grid. The shell (S0) supplies the leaf header and the tab bar | — |
| `components/shop/OriginGrid.tsx`, `app/(shop)/shop/countries/page.tsx`, `app/(shop)/shop/countries/[countryCode]/page.tsx` | Restyle to the design's cards and band (`bg-leaf-soft rounded-band` heading). Behaviour unchanged. `FlagOrGlobe` export unchanged | US-SHP-05 |

### S2: Catalogue and product (`Catalogue.dc.html`, `Product.dc.html`)

| Item | Change | Serves |
|---|---|---|
| `app/(shop)/shop/products/page.tsx` | Breadcrumb (Home / category) → `bg-leaf-soft rounded-band` heading band: h1 (as today), "Results for “q”." when there is a search, and the result count on the right (`ResultSummary`, still a polite live region) | US-SHP-04/06 |
| `app/(shop)/_components/CatalogueControls.tsx`, `CatalogueView.tsx` | Design layout: left filter card (`rounded-card`, 1.5 px border) and products on the right. Chips row and sort on one line | US-SHP-04 |
| `components/catalogue/{CatalogueFilters,FilterGroup,FiltersSheet,PriceFilter,ActiveFilterChips,SortSelect,ResultSummary,Pagination,NoResults}.tsx` | Filter groups: Category/subcategory, **Origin** (country), **Producer**, Certification, Price (the existing min/max control). Add a **"Certified organic only"** switch row (`bg-leaf-soft`, a labelled checkbox) that sets `certification=CertifiedOrganic`. The other certifications stay as checkboxes. "Clear filters" is an outline pill. Chips are `bg-leaf text-leaf-soft` with "Remove filter {x}" names. Sort: a segmented `role="radiogroup"` of the API's sorts at ≥ `md`, and the existing native select below `md`. Empty state: dashed box with "Nothing matches those filters" + "Clear filters" (suggestions kept for searches). Pagination: 44 px circles, `aria-current="page"`, Next. **No District group** (G1). Phone keeps `FiltersSheet` | US-SHP-04/06 |
| `app/(shop)/shop/products/[slug]/page.tsx` | Breadcrumb Home / category / product. Two columns: gallery \| buy column. Then the details tabs, the reviews (kept, below the tabs), and "Goes well with" | US-SHP-02/03 |
| `components/product/ProductGallery.tsx`, `ProductImage.tsx` | 32 px rounded main image. A "Certified organic" badge (`bg-leaf text-leaf-soft`) **only when `detail.certifications` includes `CertifiedOrganic`**. Thumbnails are buttons with `aria-pressed`, "Show photo N" | US-SHP-01/03 |
| `components/product/ProductHeading.tsx` | Eyebrow "{producer} · {country}" in `text-leaf` uppercase (G1: no district/village). Fraunces h1. A short plain excerpt of `description` (`plainExcerpt`) | US-SHP-03 |
| `app/(shop)/_components/ProductPurchase.tsx`, `components/product/{VariantSelector,PurchaseRow,BuyBox}.tsx`, `components/cart/{AddToCartButton,AddToCartFeedback}.tsx` | "Pack size" fieldset: size cards (label + server price) in **one radio group** (as today). The big Fraunces price is **the selected SKU's price as sent**, never multiplied by the quantity. The note beside it reads "1 kg pack" or "2 × 1 kg". A 52 px quantity stepper plus an "Add to basket" papaya pill. On success, a `bg-leaf-soft` status "Added 2 × 1 kg to your basket." with a "View basket" link. Wishlist and stock alert are kept. The delivery notes use `DeliveryPromiseCard` (imported from S1's file, unchanged), with **no** "Repeat monthly" line (G2) | US-SHP-02, US-ORD-01 |
| `components/product/ProductDetailsTabs.tsx`, `app/(shop)/_components/ProductDetailsRow.tsx` | Underline tabs (`text-ink` with a 3 px `border-accent` when selected). Tabs: **Description** (`description`); **Origin & producer** (country, producer, origin `sourcingNotes`); **Details** (ingredients, storage, shelf life, net weight, allergens, certifications, certifier and certificate number), each shown only when the API sends it. Keyboard behaviour as today | US-SHP-03 |
| `components/product/BundleContents.tsx` | Restyle only | US-SHP-02 |
| `app/(shop)/_components/ProductRecommendations.tsx`, `components/recommendations/**` | "Goes well with" = `frequentlyBoughtTogether` as the design's compact tiles (photo/pack, name, "price · size", Add). Nothing is rendered when the list is empty | US-SHP-08 (existing) |
| `app/(shop)/_components/ProductReviews.tsx` | Restyle only | existing |

### S3: Basket and checkout (`BasketPhone.dc.html`, `Checkout.dc.html`)

| Item | Change | Serves |
|---|---|---|
| `app/(shop)/cart/page.tsx`, `components/cart/{CartScreen,CartLineRow,CartMergeNotice}.tsx` | h1 "Your basket" (phone: "Step 1 of 2" beside it). Line cards on `bg-surface rounded-card`: pack/photo tile, name, "variantLabel", `QuantityStepper` (S0), and the server `lineSubtotal` in Fraunces. Remove + Undo, plus the changed, limited and unavailable texts, **as today**. Summary: **Subtotal (server)** and "Delivery and total are worked out at checkout". **No free-delivery hint** (G5). "Go to checkout" (signed out → `/sign-in?next=/checkout`, as today). Phone: sticky summary footer (`data-sticky-bar`). Desktop: lines plus a summary aside | US-ORD-01/02 |
| `app/(portal)/checkout/page.tsx`, `components/checkout/CheckoutScreen.tsx` (+ every file in `components/checkout/`) | **One page (D-2).** h1 "Checkout". **1 Deliver to**: Delivery / Pickup choice (kept, E-B3), saved addresses as a `role="radiogroup"` of cards (label, lines, phone; selected `border-leaf bg-leaf-soft`), and "+ Add a new address" (the existing inline `AddressForm`). Pickup lists branches. **2 Delivery time**: service levels and slot cards from the quote. With no slots, the section says why and payment stays reachable. **3 Payment**: option cards from `paymentOptions` (disabled with the server's reason). Bank transfer shows the option's server `message` in `bg-warning-bg text-warning-ink`. **No rider note** (G4). **Aside "Your basket"**: compact quote lines, `DiscountCodeField`, `OrderSummary` (server totals), `ChangesPanel` (must be acknowledged before placing, as today), `PendingPoliciesPanel`, "Place order" (papaya, 56 px), and the terms line linking `/policies/terms`. Phone: the sections stack, with a sticky footer showing the server `grandTotal` and "Place order · ৳{grandTotal}". Placement, idempotency, retry-with-the-same-key and the redirect to `/portal/orders/{id}?placed=1` are **unchanged** | US-ORD-02 … 07, US-ORD-19 |
| `components/hearth/{OptionCard,PillSteps,FreeDeliveryProgress}.tsx`, `components/checkout/CheckoutFreeDelivery.tsx` | `OptionCard` takes the design's selected look. `PillSteps` is used only for the phone "Step 2 of 2" label, or retired if unused (keep the file if anything still imports it). `CheckoutFreeDelivery` renders **only** when the quote sends `amountToFreeDelivery` | US-ORD-06 |

### S4: Sign-in and account (`SignIn`, `Account`, `MyOrders`, `Profile`, the checkout confirmation)

| Item | Change | Serves |
|---|---|---|
| `app/(auth)/sign-in/page.tsx`, `app/(auth)/register/page.tsx`, `app/(auth)/forgot-password/page.tsx`, `components/hearth/HearthAuthShell.tsx` | Left panel `bg-leaf text-leaf-soft`: a light logo badge, the wordmark ("Gram" in `text-warm`, ≥ 24 px bold), "Welcome *home.*", three reasons with leaf-ink tick circles, and at the bottom "Staff member? **Sign in to the back office**" → `/staff/sign-in`. Right: a two-link switch, **Sign in \| Create account** (`nav aria-label="Account"`, `aria-current`; they are links, not tabs, because they are routes), each keeping `?next=`. The forms are **unchanged components** (`SignInForm`, `RegisterForm`, CAPTCHA and the call-us alternative as today) | US-ACC-01/04/05 |
| `components/portal/{AccountSidebar.tsx,account-nav.ts}` | Sidebar card (`rounded-card`): avatar `bg-leaf-soft text-leaf-ink` with initials, name, "Member since YYYY". Links: Overview · My orders · Wishlist · My reviews · Billing · Profile & addresses (D-6). Current = `bg-leaf text-leaf-soft`. Sign out in `text-danger-ink`. Phone pills: the current pill is `bg-leaf`. **Keep the `initialsOf` and `ACCOUNT_LANDING` exports** (the S0 header imports them) | US-POR-01 |
| `app/(portal)/portal/page.tsx`, `components/portal/dashboard/**` | The overview from `Account.dc.html`: `GreetingHeader` ("Hello, {first name}"); a **live order card** for the newest open order in the dashboard's `orders` (`OrderTrackerCard` from `useMyOrder`) with "View order"; a **Default address** card (`useDeliveryAddresses`: default address, "N saved addresses", "Manage addresses" → `/portal/account/addresses`); **Buy again** (interim for G7: the lines of the newest *Delivered* order, up to 4, each with a 44 px "+" that adds that `skuId` × 1 through `useAddCartLine`, then turns into "✓ added". **No price is shown**: the basket prices it today); the orders and balances tiles **kept** (E-A2). **No staples box** (G2) | US-POR-01/02 |
| `app/(portal)/portal/orders/page.tsx`, `components/orders/MyOrdersList.tsx` | h1 "My orders". Order cards: "Order {no}", a status pill (`OrderStatusBadge`, import-only), "date · N items · total". The existing status filter, restyled as a pill select, and paging (G6) | US-ORD-12 |
| `app/(portal)/portal/orders/[orderId]/page.tsx`, `components/orders/{MyOrderDetail,OrderPanels,OrderTrackerCard,BankTransferInstructions,TransferCountdown,CancelOrderDialog,CopyButton}.tsx`, `components/hearth/StatusHero.tsx`, `components/portal/reorder/**` | The detail card: Fraunces "Order {no}", "Placed {date} · {payment}", the four-step tracker, lines (`OrderLines`, import-only; **no batch numbers**, G3), delivery address, total, then actions: **Order again** (`ReorderButton`), **Invoice {number}** linking `/portal/billing` (G10), **Return an item** → `/portal/orders/{id}/return` (only when `canRequestReturn`), cancel (as today). **`?placed=1`** shows the `Checkout.dc.html` confirmation above the detail: leaf tick circle, "Thank you! Your order is in.", the order number, the slot and address from the order, the payment line, "Track this order" (to `#order-detail` on this page) and "Keep shopping". Bank transfer instructions and countdown stay. **Keep the `safeHttpUrl` export of `OrderPanels.tsx` unchanged** (staff imports it) | US-ORD-12/13/19, US-POR-02 |
| `app/(portal)/portal/orders/[orderId]/return/page.tsx`, `components/orders/ReturnRequestForm.tsx` | The design's form card (`bg-leaf-soft rounded-card`): a line checklist, then reason **and condition** (the API needs both), "Send return request", and a success status. `UnsavedChangesGuard` is kept | US-ORD-13 |
| `app/(portal)/portal/account/**`, `components/account/{AccountShell,AddressCard,AddressList,ProfileForm,ProfileForm.schema.ts,NotificationPreferenceMatrix,PreferredChannelField,AdditionalPhoneNumbersField,PersonalDataExportCard,DeleteAccountForm}.tsx` | h1 "Profile & addresses". `AccountShell` tabs become a pill row (current = `bg-leaf`). Each page is the matching `Profile.dc.html` card: **Your details** (read-only view + Edit/Save; "Change password" as today); **Delivery addresses** (cards with a "Default" leaf pill and "Make default"); **Messages we send you** (the SMS/Email matrix; transactional SMS locked, with the design's explanation line); **Your data** ("Download my data" plus "Delete my account", which **links to the existing `/portal/account/data/delete` page**; there is no inline delete) | US-ACC-06 |

---

## 12. Scaffold, config and mocks

| Item | Rule |
|---|---|
| `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss`/Tailwind config, `app/layout.tsx` (fonts), `app/globals.css` | **No change** |
| `mocks/**` | **No change.** The mocks already serve every field used here. A test that needs data the mocks lack is §20.3 |
| `lib/**` | **No change** (API clients, hooks, routing allow-list, format, catalogue params, labels). `lib/shop/catalogueParams.ts` already parses `certification` |
| `nav/**` | No change |

---

## 13. Allowed scope (per slice; no path appears in two slices)

All paths are under `web/`. **"(new)" files may be created only by the slice that lists them.**

```
# ── S0 · Shared shell and product card ───────────────────────────────────────────────
app/(shop)/layout.tsx
app/(shop)/error.tsx
app/(shop)/loading.tsx
app/(shop)/not-found.tsx
app/(shop)/_components/MaintenanceGate.tsx
app/(shop)/_components/ShopAccountLinks.tsx
app/(portal)/layout.tsx
app/(portal)/loading.tsx
components/common/portal-header.tsx
components/shop/ShopHeader.tsx
components/shop/ShopTopStrip.tsx                    (new)
components/shop/MobileTabBar.tsx                    (new)
components/shop/SearchBox.tsx
components/shop/CategoryChips.tsx
components/shop/LanguageSwitcher.tsx
components/shop/BannerStrip.tsx
components/shop/MaintenanceNotice.tsx
components/shop/ShopLoadError.tsx
components/shop/ShopFooter.tsx
components/cart/CartBadge.tsx
components/cart/QuantityStepper.tsx
components/catalogue/ProductCard.tsx
components/catalogue/ProductGrid.tsx
components/product/StatusText.tsx
components/hearth/card.ts
components/hearth/buttons.ts
components/hearth/fields.ts
components/hearth/HearthBand.tsx
components/hearth/IconTile.tsx
components/hearth/HearthEmpty.tsx
components/hearth/GreetingHeader.tsx
docs/decisions.md                                   (append ADR-FE-174…179 only)
tests/components/shop/shell.test.tsx
tests/components/shop/shell-p3.test.tsx             (new)
tests/components/shop/no-hex-literals.test.ts       (new)
tests/components/catalogue/product-card.test.tsx
tests/components/portal/portal-header.test.tsx      (new, split from account-sidebar.test.tsx)
tests/components/hearth/hearth.test.tsx
tests/e2e/shop-shell.spec.ts                        (new)
tests/e2e/home.spec.ts
tests/e2e/shop-helpers.ts
tests/e2e/ordering-helpers.ts
tests/e2e/portal-helpers.ts
tests/e2e/fixtures.ts
# One-time exception (§17.1): the eight test-file splits, and the "cart"→"basket" wording fixes
# in any spec or component test that S0's own copy change breaks. Listed in S0's report.
# These files pass to their §13 owners when S0 merges.

# ── S1 · Shop home ────────────────────────────────────────────────────────────────────
app/(shop)/shop/page.tsx
app/(shop)/shop/countries/page.tsx
app/(shop)/shop/countries/[countryCode]/page.tsx
components/shop/ShopHero.tsx
components/shop/OriginGrid.tsx
components/shop/home/**                             (new folder)
components/hearth/DeliveryPromise.tsx
tests/components/shop/home-hero.test.tsx            (created by S0's split; S1 owns it afterwards)
tests/components/shop/origin-grid.test.tsx          (created by S0's split; S1 owns it afterwards)
tests/components/shop/countries-load-error.test.tsx (created by S0's split; S1 owns it afterwards)
tests/components/shop/home.test.tsx                 (new)
tests/e2e/shop-home.spec.ts                         (new)

# ── S2 · Catalogue and product ───────────────────────────────────────────────────────
app/(shop)/shop/products/page.tsx
app/(shop)/shop/products/[slug]/page.tsx
app/(shop)/_components/CatalogueControls.tsx
app/(shop)/_components/CatalogueView.tsx
app/(shop)/_components/ProductDetailsRow.tsx
app/(shop)/_components/ProductPurchase.tsx
app/(shop)/_components/ProductRecommendations.tsx
app/(shop)/_components/ProductReviews.tsx
components/catalogue/ActiveFilterChips.tsx
components/catalogue/CatalogueFilters.tsx
components/catalogue/FilterGroup.tsx
components/catalogue/FiltersSheet.tsx
components/catalogue/NoResults.tsx
components/catalogue/Pagination.tsx
components/catalogue/PriceFilter.tsx
components/catalogue/ResultSummary.tsx
components/catalogue/SortSelect.tsx
components/product/BundleContents.tsx
components/product/BuyBox.tsx
components/product/ProductDetailsTabs.tsx
components/product/ProductGallery.tsx
components/product/ProductHeading.tsx
components/product/ProductImage.tsx
components/product/PurchaseRow.tsx
components/product/VariantSelector.tsx
components/recommendations/**
components/cart/AddToCartButton.tsx
components/cart/AddToCartFeedback.tsx
tests/components/catalogue/catalogue-controls.test.tsx
tests/components/catalogue/brand-filter-collapse.test.tsx
tests/components/catalogue/results-states.test.tsx  (created by S0's split)
tests/components/catalogue/catalogue-p3.test.tsx    (new)
tests/components/product/product-page.test.tsx
tests/components/product/hearth-shop.test.tsx       (after S0's split)
tests/components/product/add-to-cart-button.test.tsx (created by S0's split)
tests/components/product/product-p3.test.tsx        (new)
tests/components/shop/catalogue-view-503.test.tsx
tests/components/shop/load-error.test.tsx           (after S0's split)
tests/e2e/shop-catalogue.spec.ts
tests/e2e/shop-product.spec.ts
tests/e2e/shop-a11y-responsive.spec.ts
tests/e2e/shop-portal.spec.ts

# ── S3 · Basket and checkout ─────────────────────────────────────────────────────────
app/(shop)/cart/page.tsx
app/(portal)/checkout/**
components/cart/CartScreen.tsx
components/cart/CartLineRow.tsx
components/cart/CartMergeNotice.tsx
components/checkout/**
components/hearth/OptionCard.tsx
components/hearth/PillSteps.tsx
components/hearth/FreeDeliveryProgress.tsx
tests/components/cart/**                            (after S0's split)
tests/components/checkout/**                        (incl. hearth-steps.test.tsx from S0's split)
tests/e2e/ordering-customer.spec.ts                 (after S0's split)
tests/e2e/ordering-a11y-responsive.spec.ts

# ── S4 · Sign-in and account ─────────────────────────────────────────────────────────
app/(auth)/sign-in/page.tsx
app/(auth)/register/page.tsx
app/(auth)/forgot-password/page.tsx
components/hearth/HearthAuthShell.tsx
components/hearth/StatusHero.tsx
app/(portal)/portal/page.tsx
app/(portal)/portal/orders/**
app/(portal)/portal/account/**
components/portal/AccountSidebar.tsx
components/portal/account-nav.ts
components/portal/dashboard/**
components/portal/reorder/**
components/orders/MyOrdersList.tsx
components/orders/MyOrderDetail.tsx
components/orders/OrderPanels.tsx                   (keep the safeHttpUrl export unchanged)
components/orders/OrderTrackerCard.tsx
components/orders/BankTransferInstructions.tsx
components/orders/TransferCountdown.tsx
components/orders/CancelOrderDialog.tsx
components/orders/CopyButton.tsx
components/orders/ReturnRequestForm.tsx
components/account/AccountShell.tsx
components/account/AddressCard.tsx
components/account/AddressList.tsx
components/account/ProfileForm.tsx
components/account/ProfileForm.schema.ts
components/account/NotificationPreferenceMatrix.tsx
components/account/PreferredChannelField.tsx
components/account/AdditionalPhoneNumbersField.tsx
components/account/PersonalDataExportCard.tsx
components/account/DeleteAccountForm.tsx
tests/components/auth/**
tests/components/account/**
tests/components/portal/account-sidebar.test.tsx    (after S0's split)
tests/components/portal/dashboard.test.tsx
tests/components/portal/reorder.test.tsx
tests/components/portal/links-and-guards.test.tsx
tests/components/portal/account-p3.test.tsx         (new)
tests/components/orders/my-orders.test.tsx
tests/components/orders/order-tracker.test.tsx
tests/components/issues-4-5-6.test.tsx
tests/e2e/accounts-auth.spec.ts
tests/e2e/account-area.spec.ts
tests/e2e/accounts-a11y-responsive.spec.ts          (do not change its staff assertions)
tests/e2e/portal-dashboard.spec.ts
tests/e2e/portal-a11y-responsive.spec.ts
tests/e2e/ordering-customer-orders.spec.ts          (created by S0's split)
```

**Import-only rule.** A slice may **import** any file in the codebase. It may **modify** only its own block above. A failing spec or test that another slice owns is fixed by changing **your own code** so the behaviour the spec checks still holds. You do not edit the spec. If you believe the spec itself must change, that is §20.2.

---

## 14. Forbidden scope (all slices)

| Path | Why |
|---|---|
| `src/**`, `tests/**` (.NET), `deploy/**` | No backend change in this phase (owner). Gaps go to §21 |
| `docs/**` (except `web/docs/decisions.md` for S0), `.ai/**`, `.claude/**` | Inputs and agents |
| `web/lib/**`, `web/mocks/**`, `web/nav/**` | §12. No new API client, hook, mock field or nav entry |
| `web/app/globals.css`, `web/app/layout.tsx`, `web/app/page.tsx`, `web/app/providers.tsx`, `package.json`, configs | Tokens, fonts and the root redirect are HO-P2's and the scaffold's (§7.2, §12) |
| `components/hearth/{HearthLogo,LineArtBasket,ProductPackArt,packTone,OrderTracker}.*` | Used by staff screens (`staff-shell`, `EmptyState`, `OrderLines`) or by `lib/orders/tracker.ts`. Import only |
| `components/auth/**` (`SignInForm`, `RegisterForm`, `AuthCard`, `PasswordField`, `SignOutButton`, `CaptchaField`, …) | Shared with staff sign-in, the idle lock and security-reviewed flows. Pages restyle around them |
| `components/account/{UnsavedChangesGuard,AddressForm}.tsx` | `UnsavedChangesGuard` is used by about 30 staff forms. `AddressForm` is shared by checkout (S3) and addresses (S4); freezing it avoids a two-owner file |
| `components/portal/CustomerSessionGuard.tsx`, `components/content/**`, `components/inbox/**`, `components/wishlist/**`, `components/reviews/**` | Guard and security; other areas. Import only |
| `components/orders/{OrderLines,OrderSummary,OrderStatusBadge,OrderDialog,…Staff*,…Dialog}.tsx` and every staff component | Shared with staff orders and POS |
| `components/shop/categoryIcons.ts`, `lib/shop/labels.ts` | HO-P2 §2.3 labels and icons |
| `app/(staff)/**`, `app/(offline)/**`, `app/(auth)/{staff,reset-password,account-deleted,unsubscribe,faqs,pages,policies}/**`, `app/(portal)/portal/{billing,inbox,wishlist,reviews}/**` | Not in this design. They inherit the shell only |
| `tests/e2e/{journey-real-api,portal-real-api,real-api-verification,shop-staff,cross-cutting…}.spec.ts`, `tests/components/cross-cutting.test.tsx`, `tests/components/orders/{staff-orders,order-lines-photos}.test.tsx`, `tests/components/shop/{mock-contract,get-public,repository-scan,format-shop}.test.ts`, `tests/components/catalogue/catalogue-params.test.ts`, `tests/unit/**` | Owned by other areas or by the real-API runs. They must stay green; nobody in this phase edits them (S0's one-time wording exception aside) |

---

## 15. Component test cases (Vitest)

Write each case in the slice's own new file (§13), unless an existing test file already covers it and only needs its copy updated.

| ID | Slice | Case | Expected |
|---|---|---|---|
| U1 | S0 | `ShopTopStrip` with two `Shop` banners, one with `linkUrl` | The first banner's title is rendered (a link when it has `linkUrl`); with no banners the strip is absent; `BannerStrip` gets the rest |
| U2 | S0 | `ShopHeader` | Logo link to `/shop`; search labelled "Search the shop"; Sign in (signed out); a basket pill whose accessible name contains "Basket" and the count; category pills with `aria-current` on the active category |
| U3 | S0 | `MobileTabBar` on `/shop`, `/shop/products`, `/cart`; signed in and signed out | Four links, `aria-current="page"` on the current one; Account → `/sign-in` or `/portal`; **not rendered on `/cart`** |
| U4 | S0 | `ProductCard`, single-size item not in the basket → press Add | One `POST /api/cart/lines {skuId, quantity:1}`; the name is "Add {name · size} to basket" |
| U5 | S0 | `ProductCard` whose size is in the basket (qty 2) | A stepper named "One less/One more {name · size}" with 2 shown; "+" sends `PUT …/lines/{lineId} {quantity:3}`; at 1, "−" removes the line and announces it; the card's price is `fromPrice` as sent |
| U6 | S0 | `ProductCard` out of stock; a multi-size item | "Alert me" link; Add goes to the product page ("choose options"). No "Organic" badge (G8) |
| U7 | S0 | `PortalHeader` on `/checkout` and on `/portal/orders` | Checkout: logo + "Secure checkout", no search, badges or account menu. Orders: search, basket and inbox icons, account menu |
| U8 | S0 | `ShopFooter` | Links only to `/shop/products`, `/shop/countries`, `/faqs`, `/policies/terms`; no `[PHONE]`/`[EMAIL]` text |
| U9 | S0 | `no-hex-literals.test.ts` scans every `.ts`/`.tsx` path in §13 (comments stripped) | No `#rgb`/`#rrggbb`/`#rrggbbaa` colour literal, `rgb(`/`hsl(` colour, or `[#…]` arbitrary value. An anchor whose name is all hex letters (for example `#add`) must be renamed, not allow-listed |
| U10 | S1 | `ShopHero` with a `Home` banner / without one | Uses the banner's title, body and link and draws no eyebrow / shows "Honest food, grown the slow way." with "Shop the harvest" → `/shop/products` and "Meet the growers" → `#growers`; the harvest card links to the newest product |
| U11 | S1 | `CategoryTiles` with 11 categories / a failed read | 11 links `/shop/products?category=X` with the HO-P2 label and count / the section is absent |
| U12 | S1 | `GrowersBand` with 3 featured origins / none | Heading + paragraph; at most 2 origin tiles linking `/shop/countries/{code}` / text only; no grower names |
| U13 | S1 | `PromiseStrip` | Contains the cash-on-delivery, certified-organic and returns facts; contains **no** "Village on every pack" and no free-delivery amount |
| U14 | S1 | Home page composition | No staples-box section; the phone category row is a `nav` labelled "Categories" |
| U15 | S2 | Catalogue heading band | h1 per params; "Results for “q”." with a search; the count lives in a polite live region |
| U16 | S2 | "Certified organic only" switch on / off | The URL gains / loses `certification=CertifiedOrganic`; the chip "Remove filter Certified organic" clears it; "Clear filters" keeps page-fixed values (origin page) |
| U17 | S2 | Sort control at ≥ md | Radio group of the API sorts; changing it keeps the filters and the search (US-SHP-04 AC2) |
| U18 | S2 | No results | "Nothing matches those filters" + "Clear filters"; for a search, the suggestions are still offered |
| U19 | S2 | Buy column: choose size 2, quantity 3, Add | The size cards form one radio group with label and server price; the big price equals the selected SKU's price string (not × 3); the note reads "3 × {size}"; `POST {skuId, quantity:3}`; status "Added 3 × {size} to your basket." with "View basket" |
| U20 | S2 | Gallery with / without `CertifiedOrganic` | Badge present / absent; thumbnails are buttons with `aria-pressed` |
| U21 | S2 | Details tabs | `tablist`/`tab`/`tabpanel`, arrow keys move; a tab with no API data is not rendered |
| U22 | S2 | "Goes well with" empty / 4 items | Nothing / 4 tiles, each with an Add that follows the card rules |
| U23 | S3 | Basket with a changed price, a limited line, an unavailable line | Each stated in text; the unavailable line offers removal; remove → Undo; heading "Your basket" |
| U24 | S3 | Basket summary | Shows the server subtotal and "Delivery and total are worked out at checkout"; **no** total, delivery charge or free-delivery hint is rendered |
| U25 | S3 | Checkout renders | Three labelled regions numbered 1–3 are visible together, plus the "Your basket" aside; addresses form a radio group; the Delivery/Pickup choice is present |
| U26 | S3 | Quote with `delivery.available=false` | Pickup preselected with the server's explanation (US-ORD-06 AC2) |
| U27 | S3 | Slots and service levels; then none | Charges, lead times and slot labels from the quote / "Delivery time" explains that none are needed and Payment stays usable |
| U28 | S3 | Payment options with COD unavailable (ceiling); bank transfer chosen | The COD card is disabled with the server reason; bank transfer shows the server `message` in warning style |
| U29 | S3 | Quote with `changes` | Place order is disabled until the changes are acknowledged; then it is enabled |
| U30 | S3 | Place order double-click; then a network failure and retry | One placement; the retry reuses the same `Idempotency-Key`; success → `/portal/orders/{id}?placed=1` |
| U31 | S3 | `/checkout?step=review&fulfilment=Delivery…` | `step` ignored; the page renders all sections with the URL's other choices applied |
| U32 | S4 | Sign-in page, `?next=/checkout` | Leaf panel with reasons; "Sign in to the back office" → `/staff/sign-in`; the "Create account" link keeps `?next=/checkout`; `SignInForm` unchanged |
| U33 | S4 | Account sidebar on `/portal/orders/123` | "My orders" current (`aria-current`, leaf); labels "My orders", "Profile & addresses"; no Subscriptions link; Sign out present; `initialsOf`/`ACCOUNT_LANDING` still exported |
| U34 | S4 | Overview with an open order, 2 addresses (one default), a delivered order with 5 lines | Tracker card for the open order with "View order"; default address with "2 saved addresses" and a link; Buy again lists 4 lines without prices; "+" adds that `skuId` × 1 and turns into "added"; the orders and balances tiles are present; no staples box |
| U35 | S4 | My orders list | Cards with "Order {no}", a status text pill, "date · N items · total"; the status filter and paging still work; the empty states are kept |
| U36 | S4 | Order detail, delivered, `canRequestReturn`, with `invoiceNumber` | Tracker; lines without batch; total; "Order again"; "Return an item" → `/portal/orders/{id}/return`; the invoice number links to `/portal/billing` |
| U37 | S4 | Order detail `?placed=1`, bank transfer | "Thank you! Your order is in." with the order number; "Track this order" / "Keep shopping"; transfer instructions and countdown still shown |
| U38 | S4 | Profile pages | Pill tabs with the current one in leaf; "Delete my account" is a link to `/portal/account/data/delete`; every existing `tests/components/account/**` case still passes |

---

## 16. End-to-end test cases (Playwright, projects `chromium` **and** `mobile-360`)

| ID | Slice | Spec | Case | Expected |
|---|---|---|---|---|
| E1 | S0 | `shop-shell.spec.ts` (new) | At 360: tab bar visible on `/shop` and `/shop/products`, absent on `/cart`; scroll to the bottom → the footer's last link is visible and not covered. At 1280: no tab bar. Add an item → the basket count goes up by 1 | As stated |
| E2 | S0 | `home.spec.ts` | Unchanged root redirect and axe cases | Pass |
| E3 | S1 | `shop-home.spec.ts` (new) | axe on `/shop` (zero serious or critical); no horizontal scroll at 360/768/1024/1440; at 360 the category row scrolls inside its nav and the products are 2 columns; Add on a card → a stepper appears and the header count changes; "See all products" → `/shop/products` | As stated |
| E4 | S2 | `shop-catalogue.spec.ts` | Every existing case, with copy updated to the design | Pass |
| E5 | S2 | `shop-product.spec.ts` | Every existing case (variants, kit, stock alert, draft 404) | Pass |
| E6 | S2 | `shop-a11y-responsive.spec.ts` | axe on every listed route; no horizontal scroll; grid 2/3/4 at 360/768/≥1024; filter sheet on phone | Pass |
| E7 | S2 | `shop-portal.spec.ts` | Wishlist and review flows from the product page | Pass |
| E8 | S3 | `ordering-customer.spec.ts` | E-A1 (guest merge), the remove/Undo and sign-in redirect, E-B1/B8 (COD placed once on a double click), E-B2 (acknowledge changes), E-B3 (pickup fallback), E-B4/C1 (COD ceiling, transfer instructions), E-B5 (discount reasons), **rewritten for the single page with the same intent** | Pass |
| E9 | S3 | `ordering-a11y-responsive.spec.ts` | axe and responsive on `/cart`, `/checkout` (with a price change the changes panel is on screen at every width), `/portal/orders/{id}?placed=1`, and the staff routes it already lists | Pass |
| E10 | S4 | `accounts-auth.spec.ts` | Register, sign in, profile, forgot and reset | Pass |
| E11 | S4 | `account-area.spec.ts` | E-E1 addresses, E-E2 preferences, the four unsaved-changes cases | Pass |
| E12 | S4 | `accounts-a11y-responsive.spec.ts` | axe and no horizontal scroll on the account routes (staff assertions untouched) | Pass |
| E13 | S4 | `portal-dashboard.spec.ts` | E-A1 … A5, E-B1 … B4, sign-in landing on My orders | Pass |
| E14 | S4 | `portal-a11y-responsive.spec.ts` | axe and responsive on `/portal` and its dialogs | Pass |
| E15 | S4 | `ordering-customer-orders.spec.ts` (from S0's split) | E-C2 (expired transfer, Order again fills the basket), E-D1 (cancel confirm; a packed order shows the contact card) | Pass |
| E16 | all | `npm run test:e2e` (chromium + mobile-360), on the integration branch after all five merge | The whole suite | Green. Known flaky tests are reported by name, never skipped |

---

## 17. Implementation order and verification

### 17.1 Order

1. **S0 alone, on `feat/p3-s0-shell` from `46929be`.** First commit: append ADR-FE-174 … 179 to `web/docs/decisions.md`. Second commit: the **eight mechanical test-file splits**. Move whole `describe`/`it` blocks with their imports and setup, **changing no assertion**, and confirm the Vitest and Playwright test counts are unchanged:
   1. `tests/components/product/hearth-shop.test.tsx`: move the `DeliveryPromise`/`PromiseStrip` and `ShopHero` blocks to `tests/components/shop/home-hero.test.tsx` (S1). The rest stays (S2).
   2. `tests/components/catalogue/product-card.test.tsx`: move the `NoResults` and `Pagination` blocks to `tests/components/catalogue/results-states.test.tsx` (S2). The `ProductCard` blocks stay (S0).
   3. `tests/components/portal/account-sidebar.test.tsx`: move the `PortalHeader` cases to `tests/components/portal/portal-header.test.tsx` (S0). The rest stays (S4).
   4. `tests/components/shop/shell.test.tsx`: move the `OriginGrid` cases to `tests/components/shop/origin-grid.test.tsx` (S1). The rest stays (S0).
   5. `tests/components/shop/load-error.test.tsx`: move the `CountriesPage` cases to `tests/components/shop/countries-load-error.test.tsx` (S1). The rest stays (S2).
   6. `tests/components/cart/cart.test.tsx`: move the `AddToCartButton` cases to `tests/components/product/add-to-cart-button.test.tsx` (S2). The rest stays (S3).
   7. `tests/components/hearth/hearth.test.tsx`: move the `PillSteps` and `FreeDeliveryProgress` cases to `tests/components/checkout/hearth-steps.test.tsx` (S3). The rest stays (S0).
   8. `tests/e2e/ordering-customer.spec.ts`: move `describe('bank transfer expiry and cancel …')` (E-C2, E-D1) to `tests/e2e/ordering-customer-orders.spec.ts` (S4).

   Then build S0 (§11). Update the "cart"→"basket" wording that S0's own copy changes break, in any spec, helper or component test (the one-time exception in §13), and list every such edit in S0's report. Run S0's gates. Merge to `feat/phase3-store-front`.
2. **S1, S2, S3 and S4 in parallel**, each on its own branch from the S0 merge (`feat/p3-s1-home`, `feat/p3-s2-catalogue-product`, `feat/p3-s3-basket-checkout`, `feat/p3-s4-account`). Each builds its §11 block, adds its §15/§16 cases, runs §17.2, passes its gates, and merges in any order. Because the §13 ownership sets do not overlap, no textual merge conflicts are expected. A conflict means someone left their lane (§20.2).
3. **Integration:** on `feat/phase3-store-front` after all four merge, run §17.2 in full plus E16. Optionally, run `npm run test:e2e:journey` against a real API and record the result separately.

### 17.2 Commands (from `web/`)

```
npm run typecheck
npm run lint
npm test                                                   # Vitest, whole suite
npx playwright test --project=chromium --project=mobile-360 <the slice's specs from §16>
npm run test:e2e                                           # integration only (E16)
npx vitest run tests/components/shop/no-hex-literals.test.ts
```

A manual grep backs up U9 (from the repo root, PowerShell or bash):

```
rg -n --glob "*.{ts,tsx}" "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\[#" web/components/shop web/components/catalogue web/components/product web/components/cart web/components/checkout web/components/hearth web/components/portal web/components/orders web/components/account web/components/recommendations web/components/common/portal-header.tsx "web/app/(shop)" "web/app/(portal)" "web/app/(auth)/sign-in" "web/app/(auth)/register" "web/app/(auth)/forgot-password"
```

Every hit is either removed or justified in the slice's report. The pre-existing `shadow-[…rgba(…)]` values in files a slice does not touch are tolerated. A slice that touches such a file replaces the value with the existing `shadow-modal` token or with a border.

---

## 18. Acceptance criteria

| A# | Slice | Story | Criterion | Evidence |
|---|---|---|---|---|
| A1 | S0 | all | The shop shell matches the design (leaf strip from a real banner, header, pills, footer) and the phone tab bar works and never covers content | U1–U3, U8, E1 |
| A2 | S0 | US-ORD-01 | The product card adds once, and once in the basket shows a stepper that updates and removes through the existing cart calls; no price is computed | U4–U6, E1, E3 |
| A3 | S0 | — | Checkout shows the "Secure checkout" header; the account pages keep the guard, policy prompt and account frame | U7, E9, E13 |
| A4 | S0 | — | ADR-FE-174 … 179 are recorded; the eight test splits land with unchanged counts | S0 report, `npm test` count, E16 |
| A5 | S1 | US-SHP-05 | `/shop` matches `Home.dc.html` and, at 360 px, `HomePhone.dc.html`, using only API data and the design's own headings | U10–U14, E3 |
| A6 | S1 | US-SHP-05 | The countries pages keep working, restyled | U12, `countries-load-error.test.tsx`, E6 |
| A7 | S2 | US-SHP-04/06 | The catalogue matches `Catalogue.dc.html`: the band, filters including "Certified organic only", chips, sort, empty state and pagination; URL state preserved; 2/3/4 grid | U15–U18, E4, E6 |
| A8 | S2 | US-SHP-02/03, US-ORD-01 | The product page matches `Product.dc.html`: the gallery with a truthful badge, sizes with server prices, stepper, Add to basket with confirmation, tabs and "Goes well with"; wishlist, stock alert and reviews kept | U19–U22, E5, E7 |
| A9 | S3 | US-ORD-01/02 | The basket matches `BasketPhone.dc.html` (basket half); no client totals | U23, U24, E8 |
| A10 | S3 | US-ORD-02 … 07, US-ORD-19 | Checkout is one page matching `Checkout.dc.html`: delivery or pickup, slots, payment with server reasons, the summary with discount, changes and policies; placed once and idempotently; lands on the order | U25–U31, E8, E9 |
| A11 | S4 | US-ACC-01/04/05 | Sign-in and register match `SignIn.dc.html` with unchanged form behaviour and `?next=` | U32, E10, E12 |
| A12 | S4 | US-POR-01/02 | The overview matches `Account.dc.html` minus the staples box (G2): live order, default address, Buy again (interim, G7), tiles kept | U33, U34, E13, E14 |
| A13 | S4 | US-ORD-12/13/19 | My orders and the order detail match `MyOrders.dc.html` within D-5; the confirmation block at `?placed=1`; return, cancel and reorder unchanged | U35–U37, E9, E15 |
| A14 | S4 | US-ACC-06 | The profile pages take the `Profile.dc.html` cards within D-5; deletion still goes through its confirmed page | U38, E11, E12 |
| A15 | all | — | No hex, `rgb` or `hsl` colour literals in the paths each slice owns | U9, the §17.2 grep |
| A16 | all | UI-6 | Every a11y spec passes on chromium and mobile-360: `shop-a11y-responsive`, `ordering-a11y-responsive`, `accounts-a11y-responsive`, `portal-a11y-responsive`, plus `shop-home` and `shop-shell` | E3, E6, E9, E12, E14, E1 |
| A17 | all | — | typecheck, lint and Vitest pass (known timing-flaky files reported, not skipped). No test is skipped or weakened except to replace copy or layout this phase changed, and each such edit is listed in the slice's report | §17.2, E16 |
| A18 | — | US-SUB-01/02 | **Not met in this phase**: deferred to the subscriptions backend handover plus a frontend follow-up (G2, §4.1) | §21 |

---

## 19. Required gates (per slice, in this order)

| # | Gate | Agent | Focus for this phase |
|---|---|---|---|
| 1 | ARCHITECTURE | `architecture-reviewer` | The diff stays inside the slice's §13 block and nothing in §14 is touched; no `lib/**`, `mocks/**` or `globals.css` change; Server Components on the shop routes; no new dependency; S0's exports keep the contracts in §8.3 |
| 2 | SECURITY | `security-reviewer` | `?next=` handling unchanged; deletion still goes through its confirmed page; no card or gateway UI; server messages rendered as text; idempotency keys untouched; the guest-cart cookie is never read |
| 3 | CODE_REVIEW | `code-reviewer` | No hex literals (U9); token mapping as in §7.2; no money arithmetic in the browser; component size; accessible names include visible text |
| 4 | TEST | `test-engineer` | The slice's §15/§16 cases exist and pass on both projects; split files counted; no skipped or weakened tests beyond listed copy changes |
| 5 | ACCEPTANCE | `acceptance-reviewer` | Every §18 row for the slice is evidenced; screenshots at 360 and 1280 compared with the matching `.dc.html`; the omissions are exactly the §21 gaps, not silent drops |

---

## 20. BLOCKED conditions — stop and report

### 20.1 A screen seems to need data the API does not send

Check §21 first. If the gap is there, leave the element out as described. If it is not there, stop and report the screen, the element and the field it would need, so it can be added to §21. **Never** compute it in the browser, take it from another field that only looks similar, or hard-code sample data from the `.dc.html`.

### 20.2 You need to change a file another slice owns, or a file in §14

Stop. Do not edit it "just a little". Report the file, the change and why. The integrator either moves the change to its owner or amends §13 with a §1 Amended row. This also covers a spec owned by another slice that you believe is wrong.

### 20.3 A test needs mock data the mocks do not have

Do not add or alter a mock field or fixture (§12). Report it. If the real API sends the data, the mock fix is a separate, reviewed change. If the real API does not send it, it is a §21 gap.

### 20.4 The design and accessibility disagree

Examples: contrast below 4.5:1, a control under 44 px, colour as the only signal, a link styled as a tab. **Accessibility wins.** Use the nearest token from §7.2 and note the deviation in your report. Never ship the failing variant.

### 20.5 A new package, token or font seems necessary

Do not add it. Report what it is for. The §7.2 tokens and the existing primitives cover this design.

### 20.6 A design element contradicts an existing owner decision

Examples: confirmation inside checkout instead of on the order page (D-3), the inline delete confirmation, removing Wishlist, Billing or Messages from the account menu. The existing decision and this handover's D-1 … D-7 stand. Build to them and note the difference. Never remove a working feature to match a picture.

### 20.7 A total, delivery charge, discount or "free delivery" figure would have to be computed in the browser

Stop. The server owes that number (ADR-FE-090, ADR-FE-105). Show only what the quote or the cart sends.

---

## 21. Backend gaps (not designed here; for a later backend handover)

Each gap is listed with what the design shows, what the API has today, and what this phase does in the meantime. **None of them is built or mocked in HO-P3.**

| # | Design shows | API today | Interim in HO-P3 | Screens |
|---|---|---|---|---|
| **G1** | **District of origin.** Card eyebrow "DINAJPUR"; a Catalogue "District" filter with counts; product "Grown in Birganj, Dinajpur"; the Home promise "Village on every pack" | `countryOfOrigin` (ISO country) only. The HO-P2 seed folds `district` into the description and tags (`web/scripts/seed-dev.mjs`) | Eyebrow shows producer · country. No District filter (the Origin country filter stays). That promise is left out | Home, HomePhone, Catalogue, Product, basket line "size · origin" |
| **G2** | **Customer subscriptions.** List; items with quantity steppers; frequency (2 weeks / month / 2 months); next date; skip / undo skip; pause / resume; cancel with confirmation; subscriber price; "start a new one"; the overview's "Next staples box"; Home "Build my box"; product "Repeat monthly" | **No subscriptions controller exists in `src/`** (HO-SUB-001 is written but not built). `GET /api/portal/dashboard` explicitly has no `subscriptions` key (HO-POR-002 ADR-FE-126) | Every subscription element is left out; no Subscriptions menu link | MySubscriptions (whole screen), Account, Home, Product |
| **G3** | **Batch/lot number per order line** ("batch B-0921") | `OrderLine` has no batch; batches live in Inventory's ledger | Left out | MyOrders |
| **G4** | **"Note for the rider (optional)"** at checkout | `PlaceOrderRequest` has no per-order note; only the address's `deliveryInstructions` | Left out; customers keep editing the address's delivery instructions in the profile | Checkout |
| **G5** | **A public free-delivery threshold and delivery promise.** Top strip "Free delivery over [AMOUNT] in Dhaka"; basket "Add ৳X more for free delivery" for guests or before an address is chosen; product "Delivered in Dhaka within [DAYS]" | `freeOver`/`amountToFreeDelivery`/`leadTimeDays` only inside the signed-in checkout quote, per zone and address | The strip shows a `Shop` banner instead; no basket hint; the product delivery note keeps today's true wording | Home, BasketPhone, Product |
| **G6** | **My orders "All / Active / Past"** | `GET /api/customers/me/orders?status=` takes one status | The existing single-status filter, restyled | MyOrders |
| **G7** | **"Buy again"** with current price and a frequently-bought ranking | No endpoint; only the full-order `POST …/reorder` | The lines of the newest delivered order (`GET …/orders/{id}`), up to 4, with quick add and no price | Account |
| **G8** | **"Organic" badge on catalogue cards** | `CatalogueItem` has no `certifications` (only `ProductDetail` has them); the filter `certification=` exists | No badge on cards; the product page badge uses the detail | Catalogue, Home |
| **G9** | **Harvest month / packing date** in the product's "Origin & batch" tab | Not in `ProductDetail` (only batch expiry notices per SKU) | The tab is "Origin & producer" with the existing fields | Product |
| **G10** | **"Download invoice" from an order** | Order detail has `invoiceNumber` but no `invoiceId`; the PDF is `GET /api/customers/me/invoices/{id}.pdf` | The invoice number links to `/portal/billing` | MyOrders |

---

## Open questions

The defaults above apply until the owner answers.

| # | Question | Default |
|---|---|---|
| OQ-1 | Confirm "basket" in customer copy while the stories say "cart" (D-1) | Basket |
| OQ-2 | Confirm single-page checkout (D-2) and keeping the separate account routes (D-5) | As written |
| OQ-3 | The shop's contact phone and email for the footer's Contact column | No Contact column |
| OQ-4 | Which of the §21 gaps to schedule first. G2 (subscriptions) removes a whole designed screen; G1 (district) affects four screens | Not scheduled by this handover |
| OQ-5 | Should the top strip permanently carry an admin-editable `Shop` banner (as built), or a fixed delivery promise once G5 lands? | Banner |
