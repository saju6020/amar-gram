# HO-P4 — Back office rebuilt to the approved design (frontend, 6 parallel slices)

Owner decisions (2026-10-24):
- The approved back-office design is [`docs/design/back-office/`](../design/back-office/README.md) (12 screens, the Amar Gram theme).
- Process: lightweight, as in [HO-P1](HO-P1-RETIRE-CLINIC.md) and [HO-P2](HO-P2-CATALOGUE-AND-THEME.md). Build, verify (typecheck, lint, Vitest, Playwright), then the five gates.
- Prerequisites: HO-P1 and HO-P2 are done. HO-P2 delivered the tokens, fonts, logo, banana-leaf sidebar colours, labels and catalogue model. **HO-P4 only rebuilds layouts and screens, using the APIs that already exist.**
- HO-P3 (the store front) is being built **in parallel by another agent**. HO-P4 stays out of `web/app/(shop)`, `web/app/(portal)`, the customer screens and every component they render. §14 lists those files.

## 1. Identity

| Field | Value |
|---|---|
| Handover ID | HO-P4-BACK-OFFICE |
| Title | Back office rebuilt to the approved design |
| Date | 2026-10-24 |
| Author | Tech lead (handover agent), for shahjahan |
| Backlog | [`docs/USER_STORIES.md`](../USER_STORIES.md). The design re-skins already-built staff stories: US-RPT-05, US-RPT-01…04 and US-RPT-06 (entry point only); US-ORD-09, US-ORD-10, US-ORD-16, US-ORD-19 (staff side); US-SHP-01, US-SHP-02, US-SHP-03, US-SHP-14 (staff side); US-IMP-04, US-IMP-06, US-IMP-10, US-IMP-12, US-IMP-13; US-ACC-07, US-ACC-10, US-ACC-11, US-ACC-14; US-BIL-01, US-BIL-03, US-BIL-05, US-BIL-06, US-BIL-12; US-ADM-01, US-ADM-03, US-ADM-05, US-ADM-08 |
| SRS | UI-1, UI-3, UI-4, UI-5, UI-6, NFR-USA-4, NFR-USA-5, NFR-USA-6, NFR-CMP-2 ([`docs/SRS.md`](../SRS.md) §3.1, §6.4, §6.5) |
| Pairs with | [HO-P2](HO-P2-CATALOGUE-AND-THEME.md) (the tokens and model this rebuild consumes). HO-P3 (store front) runs in parallel and shares no files with this handover |
| Approved design | [`docs/design/back-office/`](../design/back-office/README.md): `StaffSignIn`, `Dashboard`, `Orders`, `CounterSale`, `Products`, `ProductEditor`, `Inventory`, `Receiving`, `Customers`, `Billing`, `Reports`, `Administration` (`*.dc.html`), plus `index.css` |
| Area handovers whose behaviour stays binding | [HO-ACC-002](HO-ACC-002.md), [HO-ADM-002](HO-ADM-002.md), [HO-SHP-002](HO-SHP-002.md), [HO-IMP-002](HO-IMP-002.md), [HO-BIL-002](HO-BIL-002.md), [HO-ORD-002](HO-ORD-002.md), [HO-RPT-002](HO-RPT-002.md), [HO-XCT-002](HO-XCT-002.md) |
| Baseline commit | `46929be` (branch `feat/phase2-catalogue-theme`) |
| Amended | **2026-10-25 (owner-ratified).** The staff sidebar wordmark failed WCAG 1.4.3 ("Gram" leaf on leaf-ink, 1.42:1). `components/common/staff-shell.tsx` (S0) passes `accentClassName="text-leaf-soft"` to `HearthLogo`, which gains that optional prop (default `text-leaf`); `HearthLogo.tsx` is in no §13 block and is waived for this one prop (also recorded on HO-P3) (`7cdfd78`). Reviewed by HO-P4's gates. **2026-10-25 (owner, from HO-P3 ACCEPTANCE D-B).** Two staff-area e2e failures that predate HO-P3 are HO-P4's to fix: `web/tests/e2e/accounts-a11y-responsive.spec.ts` "E-X1 (idle lock open)" (axe on the staff idle-lock dialog) and `web/tests/e2e/shop-staff.spec.ts` E-C1 (create, price and publish a food product). HO-P4's integration also runs the full `npm run test:e2e` (HO-P3 E16 waiver). |

## 2. Objective

The staff back office works, but it looks like the scaffold, not the approved design. The design gives each daily job one recognisable screen: a dashboard, an orders workbench with list and detail side by side, a tap-first counter sale, a products table, a product editor, inventory with batches you can expand, goods receiving, customers, billing and cash-up, reports and administration. All of them sit in a deep banana-leaf sidebar grouped by job.

HO-P4 rebuilds the layout of those twelve screens in `web/` to match the design. Every rebuilt screen keeps its current data sources, server-side permission checks, URL state, idempotency, money rules and accessibility behaviour. Where the design shows data the API does not provide, the screen leaves that element out and it goes on the [Backend gaps](#backend-gaps-not-built-in-ho-p4) list. HO-P4 never invents data, never adds a mock field and never computes the missing value in the browser.

Separate implementers build the work as **six slices in parallel**. S0 is a small shared slice, listed first, and the other five only import from it. **No file is owned by two slices** (§3.2, §13).

## 3. In scope

### 3.1 Screens: route → design screen → slice

The table maps each existing route under `web/app/(staff)` (plus the staff sign-in under `(auth)`) to a design screen.

| Design screen | Route(s) rebuilt | Today rendered by | Slice |
|---|---|---|---|
| Staff shell (sidebar in every `*.dc.html`) | `(staff)/layout.tsx`, every `/staff/**` | `components/common/staff-shell.tsx`, `staff-nav-groups.ts` | **S0** |
| StaffSignIn | `/staff/sign-in`, `/staff/forgot-password` (frame only) | `(auth)/staff/sign-in/page.tsx`, `(auth)/staff/forgot-password/page.tsx` → `AuthCard` + `SignInForm`/`ForgotPasswordForm` | S1 |
| Dashboard | `/staff` | `components/dashboard/DashboardView.tsx` | S1 |
| Reports | `/staff/reports`, `/staff/reports/[reportKey]` | `components/reports/ReportCatalogue.tsx`, `ReportViewer.tsx` | S1 |
| Customers | **new** `/staff/customers` (search plus profile); `/staff/customers/[customerId]`; `/staff/customers/new`; `/staff/customers/duplicates`, `/duplicates/review` | `components/customer/*` | S1 |
| Orders | `/staff/orders` (list and selected-order panel), `/staff/orders/[orderId]`, `/staff/orders/awaiting-payment`, `/staff/orders/reconciliation`, `/staff/fulfilment/pick-list` | `components/orders/StaffOrder*`, `components/fulfilment/*` | S2 |
| CounterSale | `/staff/pos` | `components/pos/PosScreen.tsx` and its children | S2 |
| Products | `/staff/shop/products`, `/staff/shop` section layout | `components/staff-shop/StaffProductTable.tsx` | S3 |
| ProductEditor | `/staff/shop/products/new`, `/staff/shop/products/[productId]/**` (Details, Food & labelling, Variants & prices, Images, Kit, Related, Translations) | `components/staff-shop/*` | S3 |
| Inventory | `/staff/inventory` (overview and stock by item), `/staff/inventory/stock`, `/staff/inventory/stock/[skuId]`, `/staff/inventory/adjustments/new`, inventory section layout | `components/inventory/InventoryOverview.tsx`, `components/stock/*` | S4 |
| Receiving | `/staff/inventory/receipts/new`, `/staff/inventory/receipts`, `/staff/inventory/receipts/[receiptId]` | `components/inventory/GoodsReceiptForm.tsx`, `ReceiptDetail.tsx` | S4 |
| Billing | `/staff/billing` section layout, `/staff/billing` (overview), `/staff/billing/approvals`, `/staff/billing/cash-up`, `/staff/billing/invoices` | `components/billing/{BillingNav,BillingHome,ApprovalsQueue,CashUpScreen,InvoiceListScreen}.tsx` | S5 |
| Administration | `/staff/admin` section layout (tabs), `/staff/admin/branches` (Outlets), `/staff/admin/staff-accounts` (Staff & roles), `/staff/admin/branches/[branchId]/roster` (Roster), `/staff/admin/settings` (Settings hub) | `components/admin/AdminNav.tsx`, `components/branches/BranchTable.tsx`, `components/admin/StaffAccountTable.tsx`, `components/roster/*`, `components/settings/SettingsForm.tsx` | S5 |

Every other `/staff/**` route has no design screen. It is **not rebuilt** and gets the new shell and the restyled `DataTable` for free (§4.2).

### 3.2 The six slices

| Slice | Name | Builds | Starts |
|---|---|---|---|
| **S0** | Shared shell and primitives | Banana-leaf sidebar regrouped as the design shows; outlet picker and signed-in person in the sidebar; the `components/back-office/` primitives; `DataTable` restyle | First. Its §11.1 prop contracts are fixed **by this handover**, so S1–S5 can code against them before S0 merges |
| **S1** | Overview | Staff sign-in frame, Dashboard, Reports, Customers | In parallel, after the S0 contract |
| **S2** | Sales | Orders workbench, pick list, awaiting payment, Counter sale | In parallel |
| **S3** | Catalogue | Products list, Product editor | In parallel |
| **S4** | Stock | Inventory and batches, adjust stock, Goods receiving | In parallel |
| **S5** | Money and admin | Billing and cash-up, Administration (outlets, staff, roster, settings) | In parallel |

§13 has the exact owned paths per slice. A path not listed there for your slice is not yours.

### 3.3 Decisions already taken

| Decision | Source |
|---|---|
| Tokens, fonts (Fraunces/Work Sans), logo, sidebar colours (`bg-leaf-ink`, active `bg-leaf-soft text-leaf-ink`), labels and category icons are done. Consume them; do not redefine them | HO-P2 §2 |
| Components never use hex literals. The same rule now also bans `rgb(`/`rgba(`/`hsl(` literals and Tailwind arbitrary colour values (`bg-[#…]`) in `web/app/(staff)/**`, `web/app/(auth)/staff/**` and `web/components/**` | HO-P2 §2, `web/README.md` "Design tokens" |
| Clinic features are retired. The design shows none, and none may be reintroduced | HO-P1 |
| Only `lib/hooks/` calls `useQuery`/`useMutation`. Components under `components/{account,admin,auth,customer}/**` import no hooks: pages wire hooks and pass props | `web/eslint.config.mjs` |
| Ordering files do no money arithmetic and have no card-input identifiers. The guard scans `components/{orders,fulfilment,pos,…}` and `app/(staff)/staff/{orders,fulfilment,pos,…}` | `tests/guards/*`, HO-ORD-002 §12.3, ADR-FE-092 |
| Billing files never convert money with `Number(`/`parseFloat(`/unary `+` | `web/eslint.config.mjs`, HO-BIL-002 ADR-FE-080 |
| Hidden nav links are presentation only. The server's `403` is the authority and renders `PermissionDeniedState`/`AccessRefusedState` | HO-ADM-002 ADR-043/044, HO-ACC-002 ADR-FE-009 |
| Figures labelled "Sample data" in the design are mock-ups. The real screens never show that label and never show invented figures | Design README |

## 4. Out of scope

### 4.1 Deferred elsewhere

| Item | Where it goes |
|---|---|
| Store front, cart, checkout, portal, customer sign-in/register/reset, customer order and billing screens | HO-P3 (in parallel) |
| Every item in [Backend gaps](#backend-gaps-not-built-in-ho-p4) | A future backend handover per area (owner to schedule). The UI element is **left out**, not stubbed |
| Sidebar count badges (Orders 12, Inventory 3, Billing 2) | OQ-2: needs an owner decision on three polled shell queries |
| A staff-layer `--warm` (mango) token for count pills and the sidebar wordmark accent | OQ-1: needs a `globals.css` edit coordinated with HO-P3 |

### 4.2 Not rebuilt in HO-P4

These routes inherit the new shell and nothing else: `/staff/returns/**`, `/staff/refunds`, `/staff/orders/[orderId]/packing-slip`, `/staff/pos/sales/[orderId]/receipt`, `/staff/notifications/**`, `/staff/leave`, `/staff/procurement/**`, every `/staff/inventory/*` route not named in §3.1, every `/staff/billing/*` route not named in §3.1, every `/staff/admin/*` route not named in §3.1 (the S5 section tabs still reach them), and `(offline)/staff/offline/**`.

Where an owning slice's `**` glob in §13 covers one of these routes (S4: inventory and procurement; S5: billing), the slice owns it only to keep it compiling and linking correctly. It makes no layout change to it, except the receipt-to-consignment links §11.5.6 names.

### 4.3 Forbidden shapes

- No new API endpoint, no change under `src/` or `tests/` (backend), and no new field in a `lib/api/*.ts` type.
- No edit to any MSW handler under `web/mocks/**`. Where a component test needs a particular response, it uses `server.use(...)` locally in that test file.
- No client-side computation of a figure the API does not send: totals, change due, lifetime spend, counts by status, variance and so on.
- No "Sample data" label and no placeholder figures on a real screen.
- No new npm dependency (charts use the existing `recharts` or plain CSS bars).
- No `data-theme="customer"` on a staff layout or a back-office component.

## 5. Prerequisites

| Required | State |
|---|---|
| HO-P1 merged (clinic retired, `AmarGram` rename) | ✅ `6bbc290`, `2b3de1e` |
| HO-P2 merged (catalogue model, theme tokens, fonts, logo, leaf sidebar colours) | ✅ `601fc30`, `46929be` |
| `web/` green at baseline: `npm run typecheck`, `npm run lint`, `npm test` (known timing-flaky files excepted, per HO-P2 §4) | ✅ (per HO-P2 acceptance) |
| Approved design present in `docs/design/back-office/` | ✅ |
| Every API the rebuilt screens call already has a web client in `web/lib/api/*.ts` | ✅ (verified per screen in §7 and §11). Gaps are listed, not built |
| HO-P3 file boundary agreed (§14) | ✅ by this handover. If HO-P3 has changed a §14 file in a way that breaks a back-office screen, see §20.4 |

## 6. Governing architecture documents

HO-P4 is frontend only and changes no backend code. The backend documents still bind it: they define the read/write split and the contracts the screens consume, and the ARCHITECTURE gate checks that no slice works around them in the browser.

| Document | What you need from it |
|---|---|
| [`.ai/architecture.md`](../../.ai/architecture.md) | The layering the API enforces. The UI sends commands and reads view models, and never stands in for a server rule (permissions, money, stock) |
| [`.ai/cqrs.md`](../../.ai/cqrs.md) | Screens read query endpoints and write through command endpoints. A rebuilt screen may combine several reads on one page (Dashboard, Customers). It never derives write-side state from reads |
| [`.ai/read-side-pattern.md`](../../.ai/read-side-pattern.md) | View models are fixed shapes. A missing field is a [Backend gap](#backend-gaps-not-built-in-ho-p4), not something to fetch N times and join in the browser |
| [`.ai/bounded-contexts.md`](../../.ai/bounded-contexts.md) | Which context owns which data (Orders, Inventory, Billing, Shop, Accounts, Administration, Reporting). A screen that shows data from several contexts calls each context's own endpoint |
| [`.ai/namespace-conventions.md`](../../.ai/namespace-conventions.md) | Not applicable to `web/` naming. Cited because the ARCHITECTURE gate checks that no backend file is touched |
| [`.ai/decisions/adr.md`](../../.ai/decisions/adr.md) | ADR-317 (money as server strings, never arithmetic in the browser), ADR-341 (per-area partial registries, which is why nav, mocks and hooks are per-area files) |
| [`web/README.md`](../../web/README.md) | Folder layout, the "Adding a functional area" do/don't list, shared components, design-token rule, the parallel-worktree rule |
| [`web/docs/decisions.md`](../../web/docs/decisions.md) | Frontend ADRs: FE-004/010 (session guard, idle lock), FE-016 (active branch picker), FE-034 (route-based product editor), FE-039/045 (inventory section and alert badge), FE-079 (billing section), FE-080 (billing money strings), FE-092 (no card UI, no money arithmetic), FE-130/135/137 (dashboard, refresh, tiles), FE-142..145 (offline banner and sync), FE-173 (Hearth customer layer, which must not leak into staff) |
| [`docs/design/back-office/README.md`](../design/back-office/README.md), `*.dc.html`, `index.css` | The layouts to match. §8.3 maps their hex values to tokens |
| [HO-P2](HO-P2-CATALOGUE-AND-THEME.md) §2 | The token table and the leaf sidebar spec |

## 7. SRS UI requirements as build rules

| Req | Rule | Where enforced |
|---|---|---|
| UI-1, NFR-CMP-2 | Every rebuilt screen works at 360 px. The design's `min-width` tables (560–900 px) sit in a keyboard-focusable scroll region (`TableFrame`) or become cards below 768 px (`ResponsiveTable` already does this). The two-column designs (Orders, Customers, Counter sale, Reports, Product editor) stack below 1024 px. The sidebar keeps the scaffold rule: always the `w-16` rail below `sm`, full nav in the Radix sheet | `mobile-360` Playwright project; S0 U-tests on the shell |
| UI-3 | Destructive actions (cancel order, reject transfer, record theft or loss, close the day, archive product) keep their `ConfirmDialog`/reason dialog, and its `consequence` text names what is affected | Existing dialogs. Rebuilds re-mount them, never bypass them |
| UI-4 | Every rebuilt list keeps filtering, sorting, pagination and CSV export where it has them today, with filters in the URL | Existing `useUrlFilterState`/`DataTable`/`ResponsiveTable` behaviour, e2e specs |
| UI-5 | The order list keeps its 30 s refetch. The selected-order panel, the pick-list ticks and any typed search survive a refetch (the selection lives in the URL `?order=`, ticks in component state keyed by order id) | S2 U-tests, `ordering-staff.spec.ts` |
| UI-6, NFR-USA-6 | WCAG 2.1 AA. Visible focus (the global `:focus-visible` ring; on the leaf sidebar use `focus-visible:outline-leaf-soft`). 4.5:1 text contrast: no opacity modifiers that drop below it, and nothing on `--warm`. Labelled fields. In-page state switchers are `role="tablist"`/`role="tab"` with `aria-selected`; route-based section navs are `<nav>` + links with `aria-current="page"`, **never** `role="tab"`. Status pills always carry text and colour is never the only signal. Charts get a table alternative ("Show as table") and an `aria-live="polite"` readout, as the design shows | axe in every `*-a11y-responsive.spec.ts` and `tests/a11y/app-sweep.spec.ts`; component tests |
| NFR-USA-4 | Errors stay plain-language (`describeApiError` and friends). No raw server text | Existing mappers |
| NFR-USA-5 | Long forms (product editor, goods receipt, counter sale) keep their `UnsavedChangesGuard` and react-hook-form state through layout changes and the idle lock | Existing guards, `two-step-save.test.tsx`, `goods-receipt-form.test.tsx`, `pos.test.tsx` |
| C-5 / ADR-FE-092 | The counter sale's card tender records a **terminal slip reference** only. No card-number input, no `autocomplete="cc-*"`. Name the field "Terminal slip number", never "card number" or "expiry date" | `tests/guards/no-card-ui.test.ts` |
| C-6 / ADR-317 | Totals, change due, variance and price ranges come from the server, formatted by `formatMoney`/`AmountCell`. No `+ - * /` on a money-named value in ordering files; no `Number(`/`parseFloat(` in billing files | `tests/guards/no-money-arithmetic.test.ts`, ESLint billing block |

## 8. Frontend architecture

### 8.1 Route map and layering (unchanged)

The route groups do not change: `(staff)/layout.tsx` → `StaffLockProvider` → `ConnectivityProvider` → `StaffSessionGuard` → `IdleLock` → `StaffShell`. Pages call `lib/hooks/*` and pass data to components as props. Components never fetch. The only new route is `/staff/customers` (S1).

### 8.2 The shell (S0)

The sidebar matches `Dashboard.dc.html` lines 15–52:

1. The logo badge (the existing `HearthLogo variant="portal"`), with the "Back office" tag under it.
2. **The outlet picker in the sidebar.** `ActiveBranchPicker` gains a `variant="sidebar"` and moves from the top of `<main>` into the aside. It stays mounted on every `/staff/**` navigation (the active-branch seed effect must always run, FE-016) and stays hidden with zero or one branch. In the collapsed rail it is not shown. The sheet shows it at the top.
3. Groups in this order. Labels can be overridden in `staff-nav-groups.ts` (new optional `label` on `StaffNavEntry`), so no area file needs renaming.

| Group | Entries (href → label shown) |
|---|---|
| Overview | `/staff` → "Dashboard" |
| Sales | `/staff/orders` → "Orders"; `/staff/pos` → "Counter sale"; `/staff/customers` → "Customers" (**new registry item**, `nav/areas/accounts.ts`); `/staff/returns` → "Returns"; `/staff/notifications` → "Messages"; `/staff/customers/new` → "Register walk-in"; `/staff/customers/duplicates` → "Duplicate customers" |
| Catalogue & stock | `/staff/shop/products` → "Products" (match `/staff/shop`); `/staff/inventory` → "Inventory & batches"; `/staff/inventory/receipts` → "Goods receiving" (**new registry item**, `nav/areas/inventory.ts`); `/staff/procurement/suppliers` → "Procurement" (match `/staff/procurement`) |
| Money | `/staff/billing` → "Billing & cash-up" |
| Insight & admin | `/staff/reports` → "Reports"; `/staff/admin/branches` → "Administration" (match `/staff/admin`); `/staff/admin/staff-accounts` → "Staff accounts"; `/staff/leave` → "My leave" |

   Unlisted items still fall into "More". The longest-prefix active rule stays, so `/staff/inventory/receipts/new` marks "Goods receiving", not "Inventory & batches".
4. **The signed-in person in the sidebar footer:** initials avatar, full name, role list and the existing `SignOutButton audience="staff"`. The top header is removed at `sm` and wider. Below `sm` a slim top bar keeps the page title and the `SignOutButton`, because the 64 px rail has no room. "Sign out" must stay reachable at 360 px with the same accessible name.
5. Group collapse/expand behaviour (owner, 2026-10-16) stays as it is.
6. The skip link, `#main-content` and `<main>` padding stay. `<main>` padding becomes `px-7 py-6` to match the design.

### 8.3 Design-to-token map (binding for every slice)

| Design value | Use |
|---|---|
| `#F7F4EC` page, `#FBF8F1` tab strips | `bg-surface-page` |
| `#FFFFFF` cards | `bg-surface` |
| `#F0E9DA` row dividers, KPI wells, "Sample data" chips | `border-surface-sunken` / `bg-surface-sunken` |
| `#E5DCC8` borders | `border-border` |
| `#2A1F12` text, outline buttons | `text-ink`, `border-ink` |
| `#69553C`, `#53432D` secondary text | `text-ink-muted` |
| `#8C7B61`, `#B8A98C` (disabled) | `text-ink-faint`, disabled button `bg-border-strong` |
| `#B4531A` primary buttons, links | `bg-accent text-surface`, `text-accent` |
| `#8A3D11` | `text-accent-ink` |
| `#2F5114` sidebar, selected pill tab, bulk bar | `bg-leaf-ink text-leaf-soft` |
| `#3F6A1E`, `#557A1F` checkbox accent, chart bars, focus border on scan fields | `accent-leaf` (the utility generated from `--color-leaf`), `bg-leaf`, `border-leaf`. In `recharts`, pass `var(--leaf)` / `var(--accent)` as the fill, never a hex |
| `#E3EDC6`, `#F4F8E8`, `#CBD8AE` success pills, selected rows, active sidebar item | `bg-leaf-soft text-leaf-ink` |
| `#C9DBAE`, `#A9C48A` sidebar secondary text | `text-leaf-soft` (no opacity modifier: contrast) |
| `#FCEBC7` / `#6E4700` | `bg-warning-bg text-warning-ink` |
| `#FBE3DA` / `#8A2814`, `#A3301B` | `bg-danger-bg text-danger-ink`, `border-danger-ink` |
| `#EDA73A` mango count pills, `#F7D87A` wordmark accent | **No staff token.** Use `bg-warning-bg text-warning-ink` for pills. The wordmark stays as HO-P2 drew it. See OQ-1 |
| `#FFFAF0` text on accent buttons | `text-surface` |
| Radii 10/12/14/16 px | `rounded-[var(--radius-md)]` (10 px) for controls; cards `rounded-2xl` (16 px) is a Tailwind scale value, not a colour, so it is allowed |

### 8.4 State conventions

- A selected row in list+detail screens lives in the URL (`?order=<id>`, `?customer=<id>`), so a refetch, back/forward or reload keeps it. Below 1024 px the row links to the full detail route instead.
- In-page tabs switch views on one route; Customers' Orders/Billing panel tabs are an example. They use `UnderlineTabs`/`PillTabs` in `mode="state"`. Route section navs, such as the Product editor's sections (they are **routes**, not in-page tabs), use the same components in `mode="link"`.
- No new `localStorage`/`sessionStorage` use (the POS basket rule, HO-ORD-002, applies everywhere).

## 9. ADRs to record during this build

Record these in `web/docs/decisions.md`. **Only S0 edits that file**, appending a block for each ADR. Other slices send S0 their ADR text through the S0 PR, or record it in their PR description for the integrator to append. The numbers are taken from **ADR-FE-180 … ADR-FE-184**, a range picked to stay clear of HO-P3 (FE-173 is Hearth; FE-174…179 are left to HO-P3).

| ADR | Decision | Slice |
|---|---|---|
| ADR-FE-180 | Back-office primitives live in `components/back-office/` (S0-owned). Area components restyle by composing them, not by editing `components/billing/{PageHeader,ResponsiveTable,Fields,Amount}`, which customer screens also render | S0 |
| ADR-FE-181 | The staff sidebar's labels and grouping come from `staff-nav-groups.ts` (label overrides), not from renaming area nav files, so a presentation change never touches a file another area owns | S0 |
| ADR-FE-182 | The active-branch picker renders in the sidebar (`variant="sidebar"`) and is still mounted on every staff navigation | S0 |
| ADR-FE-183 | List+detail screens keep the selected record in the URL query and fall back to the detail route below 1024 px | S2 (record via S0) |
| ADR-FE-184 | Design elements whose data the API lacks are left out, never stubbed, and listed in the handover's Backend gaps | all (record via S0) |

**Proposed, not decided (owner):** a staff-layer `--warm` token (OQ-1); sidebar count badges (OQ-2).

## 10. Dependencies

| Dependency | Status |
|---|---|
| npm packages | **None added.** `recharts` (already pinned) or CSS bars for charts; `lucide-react` for icons |
| Fonts | Fraunces and Work Sans via `next/font` (HO-P2). Do not add Hind Siliguri: Bangla fields use the system font stack with `lang="bn"` |
| APIs | Existing `web/lib/api/*` clients only (§11 names them per screen) |

## 11. Components and screens

Each item names its story. "Keep" means the existing behaviour and tests carry over unchanged.

### 11.1 S0 — Shared shell and primitives

**Prop contracts (fixed here, so S1–S5 can build in parallel).** All are in `web/components/back-office/`, client-safe, token-only, and carry no data fetching.

| File | Export and props | Notes |
|---|---|---|
| `PageHeader.tsx` | `PageHeader({ title, eyebrow?, description?, actions?: ReactNode, headingLevel?: 1 \| 2, headingRef? })` | `h1` in Fraunces 30–32 px; `actions` wrap on narrow screens. Accepts `headingRef` for pages that focus their heading on navigation |
| `Panel.tsx` | `Panel({ title?, titleId?, headingLevel?: 2 \| 3, actions?, padded?: boolean, as?: 'section' \| 'aside' \| 'div', 'aria-label'?, children })` | White card, 1 px border, 16 px radius |
| `PillTabs.tsx` | `PillTabs({ label, items: { key, label, count?, href? }[], value?, onChange?, mode: 'state' \| 'link' })` | `state` → `role=tablist`/`tab`/`aria-selected`; `link` → `<nav aria-label>` + `Link`s with `aria-current`. Selected = `bg-leaf-ink text-leaf-soft`. `count` renders only when the caller passes a server number |
| `UnderlineTabs.tsx` | Same props as `PillTabs` | Underline style (Product editor, Administration, Customers) |
| `StatusPill.tsx` | `StatusPill({ tone: 'neutral' \| 'success' \| 'warning' \| 'danger', icon?, children })` | Text always present |
| `KpiTile.tsx` | `KpiTile({ label, value: ReactNode, note?, tone?, href? })` | Value in Fraunces. `value` is pre-formatted by the caller (money via `AmountCell`/`formatMoney`) |
| `AttentionRow.tsx` | `AttentionRow({ tone, icon: ReactNode, text, count?: ReactNode, href })` | The dashboard and inventory alert rows. The icon is `aria-hidden` and the text carries the meaning |
| `SearchField.tsx` | `SearchField({ id, label, placeholder?, value, onChange, onBlur?, emphasis?: 'scan' })` | Visually-hidden label, magnifier icon; `scan` = 2 px `border-leaf` and a barcode icon (POS, Receiving) |
| `TableFrame.tsx` | `TableFrame({ label, minWidth?, children })` | `role="region"`, `tabIndex=0`, `aria-label`, `overflow-x-auto`, for one-off tables (the same pattern `DataTable` uses) |
| `SplitView.tsx` | `SplitView({ list: ReactNode, detail: ReactNode \| null, listLabel, detailLabel, ratio?: '3:2' \| '2:3' })` | Flex-wrap with stacking below 1024 px. `detail=null` hides the detail column |
| `ActionLink.tsx` | `ActionLink({ href, variant: 'primary' \| 'outline' \| 'danger-outline', children })` | Button-styled `Link`, `min-h-11` |

| # | Change | Story |
|---|---|---|
| 11.1.1 | `staff-shell.tsx`: sidebar per §8.2 (sidebar outlet picker, footer identity and sign-out, header removed at `sm` and wider, slim top bar below `sm`). Keep every documented behaviour in its header comment (rail below `sm`, Radix sheet, focus return, close on pathname change, scroll active into view) | US-ACC-14, US-ADM-01 |
| 11.1.2 | `staff-nav-groups.ts`: §8.2 groups, optional `label` override per entry, `NAV_ICONS` additions as needed (`shopping-basket`, `package-check`, `user-search`) | — |
| 11.1.3 | `nav/areas/accounts.ts`: add `{ label: 'Customers', href: '/staff/customers', icon: 'users', audience: 'staff' }`. Do not touch the portal entry | US-ACC-10 |
| 11.1.4 | `nav/areas/inventory.ts`: add `{ label: 'Goods receiving', href: '/staff/inventory/receipts', icon: 'package-check' }` | US-IMP-04 |
| 11.1.5 | `ActiveBranchPicker.tsx`: `variant?: 'page' \| 'sidebar'` (default `page`, unchanged); sidebar styling on leaf | US-ADM-01 |
| 11.1.6 | `(staff)/layout.tsx`: stop rendering `ActiveBranchPicker` above `children` (the shell renders it). Keep `OfflineBanner` and `OverdueRestoreBanner` first in `<main>` | — |
| 11.1.7 | `common/DataTable.tsx`: restyle only (header `text-ink-muted` 13 px semibold, rows divided by `border-surface-sunken`, 16 px card radius). **Props, URL behaviour and states unchanged** | UI-4 |
| 11.1.8 | `(staff)/loading.tsx`: skeleton matches the new page header plus a card | — |
| 11.1.9 | The `components/back-office/*` files above, with tests, plus the colour-literal scan test (U41) | — |

### 11.2 S1 — Overview: Dashboard, Reports, Customers, Staff sign-in

| # | Screen | Change | Data (existing) | Story |
|---|---|---|---|---|
| 11.2.1 | StaffSignIn | New `components/back-office-overview/StaffAuthFrame.tsx`: a full-bleed `bg-leaf-ink` page and a white 440 px card with the leaf-badge logo, "Back office" tag, the page `h1` ("Staff sign in" / "Set or reset password") and, on sign-in, the helper line "Use your staff mobile number or email. Staff and customer accounts are separate." Use it in `(auth)/staff/sign-in/page.tsx` and `(auth)/staff/forgot-password/page.tsx` **in place of** `AuthCard`. `SignInForm` and `ForgotPasswordForm` are reused unchanged (the sign-in form already shows the lock-out alert) | `useSignInStaff`, `useRequestStaffPasswordReset` | US-ACC-14 |
| 11.2.2 | Dashboard | `/staff` page: `PageHeader` with the **existing** `h1` text pattern `Today — {branchName} · {date}` (the spec depends on it) and the eyebrow "Good morning, {first name}" from `useStaffSession`. Actions are "New counter sale" → `/staff/pos` and "Receive goods" → `/staff/inventory/receipts/new` (presentation only; the server still decides). Tiles: the server's `DashboardTile`s rendered as `KpiTile`s in a responsive grid, exactly the tiles sent (FE-137). Keep polling, the refresh announcer and keep-last-good on error (FE-135) | `useDashboard` | US-RPT-05 |
| 11.2.3 | Dashboard | "Needs attention" panel: `AttentionRow`s from the inventory alert summary (expiring batches, below reorder) and the billing approvals count. Each row is only rendered when its query succeeds; a `403` drops the row. Links go to `/staff/inventory/alerts` and `/staff/billing/approvals` | `useAlertSummary`, existing approvals hook | US-RPT-05, US-IMP-10, US-IMP-12 |
| 11.2.4 | Dashboard | "Latest orders" panel: the 5 newest rows of the staff order list (`pageSize: 5`) with Order, Customer, Channel, Status (`OrderStatusBadge`), Total (`AmountCell`), plus an "All orders" link. Dropped on `403` | `useStaffOrderQueue` | US-ORD-09 |
| 11.2.5 | Dashboard | **Not built:** 14-day sales chart (BG-1), "Orders in progress" pipeline (BG-2), "Cash on delivery out with riders" tile (BG-5) and "Subscription orders due" (BG-15), unless the server's tiles already carry them | — | — |
| 11.2.6 | Reports | New `app/(staff)/staff/reports/layout.tsx`: left `<nav aria-label="Report list">` grouped by the catalogue's own categories (from the existing catalogue query), current report `aria-current="page"`, and the viewer on the right. `/staff/reports` shows the list plus a "Choose a report" empty panel at 1024 px and up, and the list alone below that | the existing catalogue hook in `useReports.ts` | US-RPT-01…04 |
| 11.2.7 | Reports | `ReportViewer` restyle: the panel header (h2) with export buttons (whatever formats the report offers today) and "Email me this" (the existing `ScheduleThisReport`, Administrator-only as now); the filter bar as a single row; KPI wells from the report's summary figures if the payload has them; the chart as horizontal bars with hover/focus readout (`aria-live`) and the existing table. Keep every parameter control and validation | `useReports.ts` hooks | US-RPT-01…04, US-RPT-06 |
| 11.2.8 | Customers | **New `/staff/customers/page.tsx`:** `SplitView`. Left: `SearchField` "Mobile number or email" (a value containing `@` is sent as `email`, otherwise as `mobile`; **no name search**, BG-19), the results list as buttons with initials, name, mobile, and `CustomerStatusBadge`/"Incomplete" pill; selection in `?customer=`. Right: the selected customer's profile (11.2.9). The header action "+ Register walk-in customer" goes to `/staff/customers/new`. Empty state before a search: "Search by mobile number or email." | `findCustomers` via the existing lookup hook | US-ACC-10 |
| 11.2.9 | Customers | Profile panel and `[customerId]` page share one layout: name (Fraunces), mobile · email, record status. Actions: "New order" → `/staff/pos?customerId=…` (existing preset). The KPI row shows only what `BillingSummaryPanel` returns (balance owed); "Lifetime spend", "Orders" count and "Customer since" are not built (BG-19). Tabs (`UnderlineTabs mode="state"`): **Orders** (`CustomerOrdersPanel`) and **Billing** (`BillingSummaryPanel`). Messages link, and the erase panel for Administrators, stay as now. Footer: "Duplicate record? Review duplicates" → `/staff/customers/duplicates`. **Not built:** Subscriptions tab, Notes tab, "Send password reset" (BG-15, BG-19) | `useStaffCustomer` and the panels already on the page | US-ACC-10, US-ACC-11, US-BIL-03 |
| 11.2.10 | Customers | `/staff/customers/new`, `/duplicates`, `/duplicates/review`: `PageHeader` and `Panel` restyle only, with the same forms and dialogs | existing | US-ACC-10, US-ACC-11 |

### 11.3 S2 — Sales: Orders and Counter sale

New files go **inside the folders the ordering guards scan**: `components/orders/Staff*.tsx`, `components/pos/*`, `components/fulfilment/*`. **No new folder.**

| # | Screen | Change | Data (existing) | Story |
|---|---|---|---|---|
| 11.3.1 | Orders | `/staff/orders` becomes a workbench: `PageHeader` "Orders" with a `SearchField` "Order no., customer or mobile" (the existing URL `search`); `StaffOrdersTabs` kept (route tabs); **status `PillTabs mode="state"`** over the existing `status` URL filter, labelled with `orderStatusLabel()` for `PendingPayment`, `Confirmed`, `Packing`, `Dispatched` and "All", **no counts** (BG-2); the other filters (fulfilment, payment, channel, dates) go into a "More filters" `<details>` that keeps its URL values; `ManifestDownload` kept | `useStaffOrderQueue` | US-ORD-09 |
| 11.3.2 | Orders | `SplitView` at 1024 px and up: the list (`ResponsiveTable`, columns Order + age, Customer, Fulfilment, Status, Total + payment method) on the left; selecting a row sets `?order=<id>` and the right panel renders new `components/orders/StaffOrderSidePanel.tsx`. Below 1024 px a row links to `/staff/orders/[orderId]` as now. The 30 s refetch must not clear `?order=` | `useStaffOrderQueue`, the existing single-order hook | US-ORD-09, UI-5 |
| 11.3.3 | Orders | `StaffOrderSidePanel`: order number (Fraunces) and status pill; customer, address and slot from `fulfilment`; **pick list** from each line's `allocations` (batch, expiry, location), in the order the server sends it, with a checkbox per line (local state keyed by order id; the ticks only gate the local "Start packing" button and are not persisted, BG-4); total (`AmountCell`); the **next action button from `allowedActions` only** (StartPacking → "Start packing", Dispatch → opens `DispatchDialog` with couriers (BG-5: no riders), RecordDelivery → `RecordDeliveryDialog`, ConfirmPayment → the existing confirm/approve flow); "Print packing slip" → the existing packing-slip route; "Cancel order" → `OrderReasonDialog` (only when `Cancel` is allowed); status history list. All dialogs are the existing ones | existing order hooks and mutations | US-ORD-09, US-ORD-10, US-ORD-19 |
| 11.3.4 | Orders | `/staff/orders/[orderId]` (`StaffOrderDetail`): restyle with `PageHeader`/`Panel`. **No behaviour change** | existing | US-ORD-09 |
| 11.3.5 | Orders | `/staff/orders/awaiting-payment`, `/staff/orders/reconciliation`, `/staff/fulfilment/pick-list`: `PageHeader`/`Panel` restyle, same tables and dialogs | existing | US-ORD-10, US-ORD-19, US-ORD-20 |
| 11.3.6 | CounterSale | `/staff/pos`: two columns at 1024 px and up (products + ticket), stacked below. Left: `h1` "Counter sale" plus the existing `PosScanField` restyled as `SearchField emphasis="scan"` ("Scan barcode or type a name"); results of the existing text search shown as **tap tiles** (name, variant, `formatMoney(unitPrice)`); **no category tabs and no browse-all grid** (BG-6). Right ("Ticket" `Panel`): `PosBasket` lines with ± steppers (existing), customer chip ("Walk-in · add customer" opens the existing `PosCustomerPanel`; name and mobile are still required, BG-8), discount code (existing), the server quote total (Fraunces 30 px), tender radiogroup "Cash" / "Card (terminal)" (existing `PosTenderPanel` methods `Cash`/`InStoreCard`), cash quick buttons ("Exact" = the quote's total string, plus fixed amounts) that fill the amount field (**no change shown before completion**, BG-7), the card field "Terminal slip number", "Complete sale" → the existing review dialog → `PosSaleComplete` (shows the server's `changeDue`, "Print receipt", "New sale"). Keep F2, Enter-to-review, idempotency and the unsaved guard | `usePos` hooks | US-ORD-16 |

### 11.4 S3 — Catalogue: Products and Product editor

| # | Screen | Change | Data (existing) | Story |
|---|---|---|---|---|
| 11.4.1 | Products | `/staff/shop` layout: the section nav (Products, Origins, Reviews) becomes `PillTabs mode="link"` | — | US-SHP-01 |
| 11.4.2 | Products | `/staff/shop/products`: `PageHeader` "Products" with actions "Banners" → `/staff/admin/content?kind=Banner` (an existing content kind) and "+ New product" → `/staff/shop/products/new`. **No "Categories" button** (categories are a fixed enumeration). Filter row: `SearchField` "Name, SKU or barcode" (existing `q`/`barcode`), Category select (existing), status `PillTabs mode="state"` over the existing `status` filter with **API statuses and their existing labels** (`Draft`, `Active`, `Archived` via `lib/shop/labels`), "All" first. Keep CSV export | `useStaffShop` list hook | US-SHP-01, UI-4 |
| 11.4.3 | Products | `StaffProductTable` restyle on `DataTable`: Product (name), Category (label), Producer (`brand`), Pack sizes (`skuCount` as "{n} pack sizes"), Listed in shop (yes/no), Status (`StatusPill`), Updated. **Not built:** select checkboxes and the bulk publish/hide bar (BG-10), and the Origin, Price range, Stock, thumbnail and "Organic" columns (BG-9) | `StaffProductSummary` | US-SHP-01 |
| 11.4.4 | ProductEditor | `[productId]/layout.tsx`: breadcrumb "Products / {name}"; header with `h1` name, a "Preview in shop" outline link to `/shop/products/{slug}` (only when the product is listed and active), and the existing transition actions; section nav as `UnderlineTabs mode="link"` keeping the **routes**, labelled Details, Food & labelling, Pack sizes & prices (= `variants`), Photos (= `images`), Kit components, Related, Translations, with conditions unchanged. Below `md` it stays a select | `useStaffProduct`, `useProductTransition` | US-SHP-01, US-SHP-02 |
| 11.4.5 | ProductEditor | Details page: two columns at 1024 px and up. Main card: name, producer (`brand`, labelled "Brand / producer"), web address (slug, existing change flow), description. Right aside: **Status** card (status text, publish checklist, and the existing Publish/Unpublish/Archive buttons; **not** a radio saved with the form, because transitions are commands), **Organise** card (category, subcategory, tax class, country of origin, certifications multi-select, "Listed in shop", "Track batches and expiry"). Same single `PUT` and version handling (`two-step-save.test.tsx` stays green). **Not built:** "Can be subscribed to" (BG-15), district or region (BG-12) | `updateProductDetails` | US-SHP-01, US-SHP-03 |
| 11.4.6 | ProductEditor | Food & labelling: restyle; organic certifier and certificate number shown in a `bg-leaf-soft` "Certified organic" block when `CertifiedOrganic` is among the product's certifications. **Not built:** certificate upload and expiry (BG-14) | `setFoodDetails` | US-SHP-03 |
| 11.4.7 | ProductEditor | Pack sizes & prices: `VariantsTable` restyled as the design table (Pack = `sizeOrWeight`, SKU code, Price = current price plus scheduled, Barcode, Shipping weight), "+ Add pack size" opens the existing `AddSkuDialog`. **Not built:** "Was" price column (BG-13), per-row reorder level (it lives in Inventory → Reorder policies; show a link) | existing SKU flows | US-SHP-02 |
| 11.4.8 | ProductEditor | Photos: `ImagesEditor` restyled as a square grid with an "+ Upload photo" tile (the existing `FileUploader`, which scans for viruses) and an alt-text field. Translations: restyle; when the extra locale is `bn`, the tab label stays "Translations" and fields get `lang="bn"` | existing | US-SHP-01, US-SHP-14 |
| 11.4.9 | ProductEditor | `/staff/shop/products/new`: `NewProductForm` in a `Panel` with the same fields | existing | US-SHP-01 |

### 11.5 S4 — Stock: Inventory and Receiving

| # | Screen | Change | Data (existing) | Story |
|---|---|---|---|---|
| 11.5.1 | Inventory | `inventory/layout.tsx`: the `SectionNav` tab row restyled as `PillTabs mode="link"`, keeping the "Alerts {n} open" text badge | `useAlertSummary` | US-IMP-10 |
| 11.5.2 | Inventory | `/staff/inventory`: `PageHeader` "Inventory & batches" with actions "Stock count" → `/staff/inventory/counts/new`, "Start a recall" (danger outline) → `/staff/inventory/recalls`, "Receive goods" → `/staff/inventory/receipts/new`. Alert tiles (`AttentionRow`/tone cards): batches expiring (near-expiry count), items below reorder level (alert summary). **Not built:** "consignment arriving this week" (BG-17) | `useAlertSummary`, `useNearExpiryReport` | US-IMP-10, US-IMP-12 |
| 11.5.3 | Inventory | "Stock by item" on the overview (and `/staff/inventory/stock`, same component): the stock summary list with Item (name + SKU code), On hand, Reserved, Available (`sellable`), Next expiry (`ExpiryBadge`), and an "Adjust" action. Each row has a disclosure button (`aria-expanded`) that loads that SKU's batch matrix **on expand** (lot, expiry, status, quantity by location). Keep search, `belowReorderPoint` filter, paging and export. **Not built:** "Reorder at" column, batch "Received" and "Supplier" columns (BG-16) | `getStockSummary`, `getSkuStockMatrix` | US-IMP-06 |
| 11.5.4 | Inventory | "Adjust" opens the existing `AdjustmentForm` in a dialog, preselected to that SKU. The reason chips render the API's reasons as `aria-pressed` buttons. The approval notice shows only when the server says the reason needs approval. `/staff/inventory/adjustments/new` keeps working as a page | existing adjustment hooks | US-IMP-13 |
| 11.5.5 | Inventory | `/staff/inventory/stock/[skuId]`: restyle `SkuStockMatrix`/`StockFigures`/`FefoPreviewPanel` into `Panel`s | existing | US-IMP-06, US-IMP-07 |
| 11.5.6 | Receiving | `/staff/inventory/receipts/new`: `PageHeader` "Receive goods" with action "All receipts" → `/staff/inventory/receipts`. Header card (grid): Supplier, Purchase order (when chosen, expected quantities come from its lines), Delivery reference (= the design's "Supplier reference"), Received on. The branch is the active branch shown in the sidebar, so there is **no "Receive into" select**. If the receipt is for a consignment, a `bg-leaf-soft` dashed strip links to that consignment's Documents and Costs tabs (landed cost and documents belong to the consignment, US-IMP-03/05). Then a `SearchField emphasis="scan"` "Scan an item barcode to add a line" (existing SKU lookup), then a lines table: Item, Expected, Accepted, Rejected (stepper) with reason select when > 0, Lot/batch no., Expiry (required-for-food error inline, as the server reports `Lines[i].ExpiresOn`), Location (`LocationSelect`). Footer: `aria-live` result message and "Post to stock". One command; every line error is mapped back as today. **No autosave** (BG-18) | `GoodsReceiptForm` hooks | US-IMP-04 |
| 11.5.7 | Receiving | `/staff/inventory/receipts` and `[receiptId]`: `PageHeader`/`DataTable`/`Panel` restyle | existing | US-IMP-04 |

### 11.6 S5 — Money and admin: Billing and Administration

| # | Screen | Change | Data (existing) | Story |
|---|---|---|---|---|
| 11.6.1 | Billing | `billing/layout.tsx` + `BillingNav`: `PageHeader` "Billing & cash-up" with "Export for accounts" → `/staff/billing/exports` (shown to Administrator/Accountant, presentation only), and the section nav as `PillTabs mode="link"` ordered **Approvals, Cash-up, Invoices** first, then Overview, Payments, Receivables, COD, Bank, Export. Role filtering unchanged | — | US-BIL-06 |
| 11.6.2 | Billing | `ApprovalsQueue` as cards: amount · order, customer · bank ref · recorded by (`recordedByName`); "Approve" (leaf) / "Reject" (danger outline, reason dialog). When `PendingApproval.recordedBy` equals the session's `staffAccountId`, show the warning text "You recorded this one. Another staff member must approve it." **instead of** the buttons (the server still refuses; this is presentation). The decided state shows in a `role="status"` pill | approvals hooks; `useStaffSession` | US-ORD-19, US-BIL-06 |
| 11.6.3 | Billing | `CashUpScreen`: `Panel` "End-of-day cash-up · {branch} · {date}"; table of the server's expected lines by source (`lines[]`: label, collector, amount); one "Counted cash" input (existing `recordCashCount`), the server's variance as `StatusPill` (Balanced / Over / Short from the sign the server's variance carries; **no browser arithmetic**); "Explain any difference" and "Close the day" (existing confirm). **Not built:** a counted amount per source (BG-20) | `billing-cashup.ts` | US-BIL-12 |
| 11.6.4 | Billing | `InvoiceListScreen`: restyle on the design table (Invoice, Customer, Date, Method, Status pill, Amount); filters and export unchanged | existing | US-BIL-01, US-BIL-05 |
| 11.6.5 | Billing | `BillingHome` (`/staff/billing`): restyle into `KpiTile`s and `Panel`s, same content | existing | US-BIL-03 |
| 11.6.6 | Administration | `admin/layout.tsx` + `AdminNav`: the section heading "Administration" and `UnderlineTabs mode="link"` with four primary tabs **Outlets** (`/staff/admin/branches`), **Staff & roles** (`/staff/admin/staff-accounts`), **Roster** (see OQ-7), **Settings** (`/staff/admin/settings`). Every other `adminNavItems` entry goes into a "More" disclosure list under the tabs, with the same role filtering. Page-level `h1`s that admin specs rely on stay where they are (§20.3) | `adminNavItems` | US-ADM-01…08 |
| 11.6.7 | Administration | `/staff/admin/branches` (Outlets): `BranchTable` replaced by outlet **cards** (name, code, active status pill, time zone) with links Edit, Hours, Holidays & closures, Calendar, Roster. Header action "+ Add outlet" → `/staff/admin/branches/new`. **Not built:** address, type, hours summary, delivery areas, staff count on the card (BG-21) | `useAdminBranches` | US-ADM-01 |
| 11.6.8 | Administration | `/staff/admin/staff-accounts` (Staff & roles): `StaffAccountTable` restyle (Name, Sign-in IDs = mobile + email, Roles, Status = "Active" when `hasPassword`, otherwise "Not set up", Edit); "+ Add staff member"; footer line listing the **real** role ids from the role catalogue (`useStaffRoles`), not the design's Manager/Cashier/Packer/Stock keeper/Rider. **Not built:** Outlet column (BG-22) | `useStaffAdmin`, `useStaffRoles` | US-ACC-07, US-ADM-02 |
| 11.6.9 | Administration | `/staff/admin/branches/[branchId]/roster` (+ branch layout): `RosterWeekView` restyled as the design grid (staff rows × 7 day columns, shift cells as pills with text). Editing stays the existing pattern editor and exception form. **The design's click-to-cycle Morning/Evening/Off is not built** (BG-23) | `useAdminRosters` | US-ADM-03 |
| 11.6.10 | Administration | `/staff/admin/settings` becomes a **settings hub**: a card grid where each card summarises and links to where the setting already lives. Delivery → Delivery zones (`/staff/admin/delivery-zones`); Payments → Payment settings (`/staff/admin/payment-settings`); Message templates → `/staff/admin/notification-templates`; Shop → maintenance status with a link to `/staff/admin/system` (where `MaintenanceSwitch` lives, US-ADM-08). The existing `SettingsForm` stays on the same page, below the hub, in its own `Panel` "Business rules", with an unchanged save flow | `useAdminSettings`, existing system hook | US-ADM-05, US-ADM-08 |

## 12. Scaffold, config and mocks

| Item | Change |
|---|---|
| `web/app/globals.css`, `app/layout.tsx`, `app/providers.tsx`, `(auth)/layout.tsx`, `(portal)`, `(shop)` layouts | **None** |
| `web/mocks/**` | **None.** Tests that need a specific response use `server.use(...)` in the test file |
| `web/lib/api/**`, `web/lib/format/**`, `web/lib/shop/**`, `web/lib/money/**`, `web/lib/validation/**` | **None** |
| `web/lib/hooks/**` | No edit to an existing file. A slice may add **one** new file `web/lib/hooks/useBo<Slice>.ts` (`useBoOverview.ts`, `useBoSales.ts`, `useBoCatalogue.ts`, `useBoStock.ts`, `useBoMoneyAdmin.ts`) only to compose existing `lib/api` functions into a query the existing hooks lack, for example the SKU batch matrix fetched on row expand. Query keys are namespaced `['bo-<slice>', …]`. `useBoSales.ts` is added to no guard list, so it must contain no money-named arithmetic (the CODE_REVIEW gate checks by hand) |
| `web/nav/areas/accounts.ts`, `web/nav/areas/inventory.ts` | S0 only, per 11.1.3–11.1.4 |
| `web/docs/decisions.md` | S0 only, appending ADR-FE-180…184 |
| `web/package.json`, `eslint.config.mjs`, `vitest.config.mts`, `playwright.config.ts`, `tsconfig.json` | **None** |

## 13. Allowed scope

Each slice touches **only** its own block. Paths are relative to the repo root. A `**` glob owns everything under it, including new files.

```text
# ---------- S0 — Shared shell and primitives ----------
web/components/common/staff-shell.tsx
web/components/common/staff-nav-groups.ts
web/components/common/DataTable.tsx
web/components/branches/ActiveBranchPicker.tsx
web/components/back-office/**
web/app/(staff)/layout.tsx
web/app/(staff)/loading.tsx
web/nav/areas/accounts.ts            # staff items only (11.1.3)
web/nav/areas/inventory.ts
web/docs/decisions.md                # append ADR-FE-180..184 only
web/tests/unit/staff-shell.test.tsx
web/tests/unit/staff-nav-groups.test.ts
web/tests/unit/nav-registry.test.ts
web/tests/unit/nav-roles.test.tsx
web/tests/unit/data-table.test.tsx
web/tests/components/branches/active-branch-picker.test.tsx
web/tests/components/back-office/**
web/tests/e2e/staff-shell-*.spec.ts
web/tests/e2e/staff-shell-sheet-helpers.ts

# ---------- S1 — Overview: Dashboard, Reports, Customers, Staff sign-in ----------
web/app/(staff)/staff/page.tsx
web/app/(staff)/staff/reports/**
web/app/(staff)/staff/customers/**
web/app/(auth)/staff/sign-in/page.tsx
web/app/(auth)/staff/forgot-password/page.tsx
web/components/dashboard/**
web/components/reports/**
web/components/customer/**
web/components/back-office-overview/**
web/lib/hooks/useBoOverview.ts
web/tests/components/dashboard/**
web/tests/components/reports/**
web/tests/components/customer/**
web/tests/components/back-office-overview/**
web/tests/e2e/dashboard-home.spec.ts
web/tests/e2e/reports-viewer.spec.ts
web/tests/e2e/reports-real-api.spec.ts
web/tests/e2e/reports-helpers.ts       # append-only (reports-schedules.spec imports it)
web/tests/e2e/staff-customers.spec.ts
web/tests/e2e/staff-auth.spec.ts

# ---------- S2 — Sales: Orders and Counter sale ----------
web/app/(staff)/staff/orders/page.tsx
web/app/(staff)/staff/orders/[orderId]/page.tsx
web/app/(staff)/staff/orders/awaiting-payment/page.tsx
web/app/(staff)/staff/orders/reconciliation/page.tsx
web/app/(staff)/staff/fulfilment/**
web/app/(staff)/staff/pos/page.tsx
web/components/orders/Staff*.tsx      # StaffOrderQueue, StaffOrderDetail, StaffOrderPanels, StaffOrdersTabs, new StaffOrderSidePanel …
web/components/orders/AwaitingPaymentList.tsx
web/components/orders/ApprovePaymentPanel.tsx
web/components/orders/ConfirmTransferDialog.tsx
web/components/orders/DispatchDialog.tsx
web/components/orders/RecordDeliveryDialog.tsx
web/components/orders/DeliveryFailureDialog.tsx
web/components/orders/ReallocateLineDialog.tsx
web/components/orders/OrderReasonDialog.tsx
web/components/orders/OrderDialog.tsx
web/components/orders/ReconciliationIssuesList.tsx
web/components/orders/CustomerOrdersPanel.tsx
web/components/pos/**
web/components/fulfilment/**
web/lib/hooks/useBoSales.ts
web/tests/components/orders/staff-orders.test.tsx
web/tests/components/pos/**
web/tests/components/fulfilment/**
web/tests/components/back-office-sales/**
web/tests/e2e/ordering-staff.spec.ts
web/tests/e2e/ordering-pos.spec.ts

# ---------- S3 — Catalogue: Products and Product editor ----------
web/app/(staff)/staff/shop/**
web/components/staff-shop/**
web/components/back-office-catalogue/**
web/lib/hooks/useBoCatalogue.ts
web/tests/components/staff-shop/**
web/tests/components/back-office-catalogue/**
web/tests/e2e/shop-staff.spec.ts

# ---------- S4 — Stock: Inventory and Receiving ----------
web/app/(staff)/staff/inventory/**
web/app/(staff)/staff/procurement/**   # owned; links/headers only (§4.2)
web/components/inventory/**
web/components/stock/**
web/components/recall/**
web/components/procurement/**
web/components/back-office-stock/**
web/lib/hooks/useBoStock.ts
web/tests/components/inventory/**
web/tests/components/stock/**
web/tests/components/recall/**
web/tests/components/procurement/**
web/tests/components/back-office-stock/**
web/tests/e2e/inventory-flows.spec.ts
web/tests/e2e/inventory-a11y-responsive.spec.ts
web/tests/e2e/inventory-real-api.spec.ts
web/tests/e2e/inventory-helpers.ts
web/tests/e2e/inventory-routes.ts
web/tests/e2e/procurement-flows.spec.ts

# ---------- S5 — Money and admin: Billing and Administration ----------
web/app/(staff)/staff/billing/**
web/app/(staff)/staff/admin/layout.tsx
web/app/(staff)/staff/admin/branches/page.tsx
web/app/(staff)/staff/admin/branches/[branchId]/layout.tsx
web/app/(staff)/staff/admin/branches/[branchId]/roster/page.tsx
web/app/(staff)/staff/admin/staff-accounts/page.tsx
web/app/(staff)/staff/admin/settings/page.tsx
web/components/billing/BillingNav.tsx
web/components/billing/BillingHome.tsx
web/components/billing/ApprovalsQueue.tsx
web/components/billing/CashUpScreen.tsx
web/components/billing/InvoiceListScreen.tsx
web/components/admin/AdminNav.tsx
web/components/admin/adminNavItems.ts
web/components/admin/StaffAccountTable.tsx
web/components/branches/BranchTable.tsx
web/components/roster/**
web/components/settings/**
web/components/back-office-admin/**
web/lib/hooks/useBoMoneyAdmin.ts
web/tests/components/billing/payment-flows.test.tsx
web/tests/components/billing/documents-ops.test.tsx
web/tests/components/billing/downloads.test.tsx
web/tests/components/admin/admin-nav.test.tsx
web/tests/components/roster/**
web/tests/components/settings/**
web/tests/components/back-office-admin/**
web/tests/e2e/billing-functional.spec.ts
web/tests/e2e/billing-a11y-responsive.spec.ts
web/tests/e2e/billing-real-api.spec.ts
web/tests/e2e/admin-functional.spec.ts
web/tests/e2e/admin-a11y-responsive.spec.ts
web/tests/e2e/admin-filters.spec.ts
web/tests/e2e/admin-branch-calendar.spec.ts
web/tests/e2e/staff-admin.spec.ts
```

**Ownership check:** no path above appears in two blocks. Notes on the boundaries: `components/orders/` is split by file (S2 owns only the staff files listed, and the customer files are forbidden); `components/billing/` is split by file (S5 owns five files and the rest are frozen); `components/branches/` (S0 owns `ActiveBranchPicker.tsx`, S5 owns `BranchTable.tsx`, and the rest are frozen); `components/admin/` (S5 owns three files and the rest are frozen). Test files not listed (for example `tests/components/billing/refund-dialog.test.tsx`, `tests/components/admin/staff-account-*.test.tsx`, `tests/components/settings/…` are listed; `maintenance-switch.test.tsx` is not) are **run-only**. When ownership is unclear, the file is not yours (§20.1).

## 14. Forbidden scope

| Path | Why |
|---|---|
| `web/app/(shop)/**`, `web/app/(portal)/**`, `web/app/(auth)/**` except the two staff pages in S1 | HO-P3 store front and customer auth (parallel agent) |
| `web/components/{shop,catalogue,product,cart,checkout,portal,account,wishlist,reviews,recommendations,inbox,hearth}/**` | Customer surfaces (HO-P3) and HO-P2 brand marks |
| `web/components/orders/{MyOrdersList,MyOrderDetail,OrderTrackerCard,BankTransferInstructions,ReturnRequestForm,CancelOrderDialog,OrderLines,OrderSummary,OrderStatusBadge,OrderPanels,CopyButton,TransferCountdown}.tsx` | Rendered by customer screens (HO-P3). Staff screens **import** them unchanged |
| `web/components/billing/**` except S5's five files | Shared primitives (`Amount`, `Fields`, `PageHeader`, `ResponsiveTable`, `QueryBoundary`, `schemas`, …) render inside cart, checkout and portal; `My*` are customer screens |
| `web/components/auth/**` (incl. `AuthCard`, `SignInForm`, `ForgotPasswordForm`, `SignOutButton`) | Shared with customer auth (HO-P3) |
| `web/components/admin/{PermissionDeniedState,AccessRefusedState}.tsx` and every other `components/admin/*` not in S5 | Used by every area's 403 path |
| `web/components/common/*` except S0's three files; `web/components/ui/**` | Shared scaffold primitives (`web/README.md` "Don't") |
| `web/components/{returns,refunds,print,notifications,templates,content,audit,retention,operations,leave,ordering-admin,report-schedules,files,offline,observability,staff}/**` | Not rebuilt (§4.2), or session and offline infrastructure |
| `web/components/branches/**` except `ActiveBranchPicker.tsx` (S0) and `BranchTable.tsx` (S5) | Calendar, hours, closures: not rebuilt |
| `web/app/(staff)/staff/{returns,refunds,notifications,leave}/**`, `orders/[orderId]/packing-slip/**`, `pos/sales/**`, `admin/**` except S5's six files, `web/app/(offline)/**` | Not rebuilt (§4.2) |
| `web/app/globals.css`, `web/app/layout.tsx`, `web/app/providers.tsx`, `web/app/page.tsx`, `web/app/icon.svg` | Tokens and root shell (HO-P2). See OQ-1 for the one token question |
| `web/lib/**` except a slice's own new `lib/hooks/useBo<Slice>.ts` | Existing contracts and hooks |
| `web/mocks/**`, `web/nav/index.ts`, `web/nav/types.ts`, every `web/nav/areas/*.ts` except S0's two | Mock server is the contract; per-area nav files |
| `web/tests/guards/**`, `web/tests/a11y/**`, `web/tests/perf/**`, `web/tests/setup.ts`, `web/tests/e2e/{fixtures,global-setup,ordering-helpers,shop-helpers,portal-helpers}.ts` | Shared test infrastructure |
| Mixed or other-area e2e specs: `accounts-a11y-responsive`, `account-area`, `ordering-customer`, `ordering-a11y-responsive`, `shop-*` (except `shop-staff`), `portal-*`, `home`, `notifications-*`, `xct-*`, `journey-real-api`, `real-api-verification`, `reports-schedules` | **Run-only.** They must pass. A slice keeps the accessible names and roles they rely on (§20.3) |
| `src/**`, `tests/**` (backend), `deploy/**`, `docs/**` except this handover (append-only, §1) | Frontend layout handover |
| `web/package.json`, `web/package-lock.json`, lint/test/build config | No dependency or config change |

## 15. Component test cases (Vitest)

Every slice keeps its existing tests green **without weakening an assertion** (HO-P2 §1.6 rule). Where a test asserted the old visual structure (for example a header breadcrumb that no longer exists), the owning slice rewrites it to assert the new structure **with at least the same strength** and lists the change in its PR.

| ID | Slice | Case | Expected |
|---|---|---|---|
| U1 | S0 | Sidebar renders the §8.2 groups for a role that sees everything | Group labels in order: Overview, Sales, Catalogue & stock, Money, Insight & admin; every registered staff link exactly once |
| U2 | S0 | Label overrides | `/staff` shows "Dashboard", `/staff/pos` shows "Counter sale", `/staff/billing` shows "Billing & cash-up" |
| U3 | S0 | Active link on `/staff/inventory/receipts/new` | "Goods receiving" has `aria-current="page"`; "Inventory & batches" does not |
| U4 | S0 | Sidebar footer | Shows the session's full name and roles and a "Sign out" button; below `sm` (matchMedia mocked) "Sign out" is still in the document and focusable |
| U5 | S0 | `ActiveBranchPicker variant="sidebar"` with 2 branches / 1 branch | Renders a labelled "Outlet" select / renders nothing; the seed effect runs in both cases |
| U6 | S0 | Existing shell behaviours | Rail below `sm`, sheet open/close, Escape returns focus, closes on pathname change: all existing `staff-shell.test.tsx` cases pass |
| U7 | S0 | `PillTabs mode="state"` | `role=tablist`, `aria-selected` on the current item, every tab reachable by keyboard; `count` hidden when undefined |
| U8 | S0 | `PillTabs mode="link"` / `UnderlineTabs mode="link"` | `<nav aria-label>`, links, `aria-current="page"` on the current one, **no** `role="tab"` |
| U9 | S0 | `StatusPill`, `KpiTile`, `AttentionRow` | Text always rendered; icon `aria-hidden`; no inline `style` colour |
| U10 | S0 | `TableFrame` and restyled `DataTable` | Region is focusable with an accessible name; `data-table.test.tsx` passes with unchanged assertions |
| U11 | S1 | `StaffAuthFrame` on the staff sign-in page | `h1` "Staff sign in", helper text, `SignInForm` rendered; no `data-theme` attribute anywhere in the tree |
| U12 | S1 | Dashboard renders server tiles only | Tile count equals the payload's; no "Sample data" text; `h1` matches `/^Today — .* · \S/` |
| U13 | S1 | Dashboard "Needs attention" with alert summary OK and approvals `403` | The inventory rows show; the approvals row is absent; no error banner |
| U14 | S1 | Dashboard "Latest orders" | 5 rows from the queue response, totals rendered through `AmountCell`, the link goes to `/staff/orders` |
| U15 | S1 | Reports layout | The report list is a `<nav aria-label="Report list">`; the current report has `aria-current="page"`; the viewer chart has a table alternative and an `aria-live` readout |
| U16 | S1 | Customers search | Typing `a@b.com` calls lookup with `email`; `01711…` calls it with `mobile`; selecting a result sets `?customer=` and renders the profile panel |
| U17 | S1 | Customer profile panel | Shows the Orders and Billing tabs only (no Subscriptions/Notes); "New order" links to `/staff/pos?customerId=…`; the erase panel only for Administrator |
| U18 | S2 | Order workbench status pills | Clicking the `Packing` pill writes `status=Packing` to the URL; "All" clears it; no counts rendered |
| U19 | S2 | Selected order survives refetch | With `?order=X` set, a refetch of the list keeps the side panel on X and keeps pick-list ticks |
| U20 | S2 | Side panel actions come from `allowedActions` | With `['StartPacking','Cancel']` it shows "Start packing" and "Cancel order" only; with `[]` it shows no action button |
| U21 | S2 | Pick list | Each line lists its allocations' batch, expiry and location in server order; "Start packing" is disabled until every line is ticked |
| U22 | S2 | POS tiles and ticket | A search result tile adds a basket line; the ticket total is the quote's grand total string; tender radiogroup has "Cash" and "Card (terminal)" |
| U23 | S2 | POS money rules | "Exact" fills the amount with the quote's total string unchanged; no change-due text before completion; after completion `PosSaleComplete` shows the server `changeDue` |
| U24 | S2 | Guards | `tests/guards/no-card-ui.test.ts` and `no-money-arithmetic.test.ts` pass and still scan `components/pos/*` and `components/orders/Staff*` |
| U25 | S3 | Products status pills | Pills are All, Draft, Active, Archived (labels from `lib/shop/labels`); clicking writes `status=` to the URL |
| U26 | S3 | Products header | "Banners" links to `/staff/admin/content?kind=Banner`; there is no "Categories" control; CSV export link keeps the filters |
| U27 | S3 | Product editor section nav | `UnderlineTabs mode="link"` labels Details, Pack sizes & prices, Photos (+ conditional sections); routes unchanged; select below `md` |
| U28 | S3 | Details Status card | Publish/Unpublish/Archive buttons call the transition with `expectedVersion`; no status radio exists |
| U29 | S3 | Two-step save and conflict | `two-step-save.test.tsx`, `sku-shipping-weight.test.tsx`, `route-id-not-found.test.tsx`, `staff-shop.test.tsx` pass |
| U30 | S4 | Stock row expand | The disclosure button toggles `aria-expanded`; the batch matrix query fires only on the first expand |
| U31 | S4 | Adjust from a row | Opens the adjustment dialog preselected to that SKU; the approval note appears only when the server's reason metadata says so |
| U32 | S4 | Goods receipt | No "Receive into" select; line errors `Lines[1].ExpiresOn` show inline on line 2 with `aria-invalid`; the `aria-live` message reports the server result; `goods-receipt-form.test.tsx` passes |
| U33 | S4 | Inventory section nav | Link tabs with "Alerts {n} open" text; no `role="tab"` |
| U34 | S5 | Billing nav | Order Approvals, Cash-up, Invoices first; Approvals hidden for a non-accounts role (presentation) |
| U35 | S5 | Approvals self-recorded | When `recordedBy` equals the session `staffAccountId`, the warning text shows and Approve/Reject are absent |
| U36 | S5 | Cash-up | Expected lines render from `lines[]`; the variance pill reads the server variance (Balanced/Over/Short); "Close the day" opens the confirm dialog |
| U37 | S5 | Admin tabs | Outlets, Staff & roles, Roster, Settings as link tabs; other `adminNavItems` in "More", role-filtered |
| U38 | S5 | Outlet cards | One card per branch with Edit/Hours/Holidays & closures/Calendar/Roster links; no address or staff-count text |
| U39 | S5 | Staff & roles footer | Lists role ids from the role catalogue response, not hard-coded design roles |
| U40 | S5 | Settings hub | Cards link to delivery zones, payment settings, message templates and system; `settings-form.test.tsx` passes |
| U41 | S0 (covers all) | No hex or colour literals | New `tests/components/back-office/no-colour-literals.test.ts` scans `components/**`, `app/(staff)/**` and `app/(auth)/staff/**` for `#[0-9a-fA-F]{3,8}\b`, `rgba?\(`, `hsla?\(` and `-\[#` and finds none (`app/globals.css` and `app/icon.svg` are outside the scan) |

## 16. End-to-end test cases (Playwright, `chromium` + `mobile-360`)

Run with `npm run test:e2e` (MSW). Every listed existing spec must pass; the slice that owns it may update **selectors** for structure the design changed, keeping the same assertions.

| ID | Slice | Spec / case | Expected |
|---|---|---|---|
| E1 | S0 | `staff-shell-*.spec.ts` (7 specs) | Pass: toggle, sheet focus trap and return, back-navigation closes the sheet, no overflow at 360 px, toast not inert |
| E2 | S0 | New case in `staff-shell-toggle.spec.ts`: at 360 px on `/staff/orders` | No horizontal page scroll; "Sign out" visible; "Expand menu" opens the sheet with the outlet picker on top (when 2+ branches) |
| E3 | S1 | `dashboard-home.spec.ts` | Pass (h1 pattern, tile headings, "Updated hh:mm (Asia/Dhaka)") |
| E4 | S1 | `reports-viewer.spec.ts`; `reports-real-api.spec.ts` (real-API run only when enabled) | Pass |
| E5 | S1 | `staff-customers.spec.ts` + new case: `/staff/customers` search by mobile → select → profile → "New order" lands on `/staff/pos?customerId=` | Pass |
| E6 | S1 | `staff-auth.spec.ts` | Pass; the sign-in page has the leaf full-bleed background and `h1` "Staff sign in" |
| E7 | S2 | `ordering-staff.spec.ts` + new case: on desktop select an order in the list → the side panel shows the pick list → "Start packing" enabled after ticking all | Pass |
| E8 | S2 | `ordering-pos.spec.ts` | Pass (scan, quote, tender, review, complete, receipt) |
| E9 | S3 | `shop-staff.spec.ts` | Pass (create product, sections, reviews, origins) |
| E10 | S4 | `inventory-flows.spec.ts`, `inventory-a11y-responsive.spec.ts`, `procurement-flows.spec.ts` + new case: expand a stock row → batches visible → "Adjust" opens the dialog | Pass |
| E11 | S4 | `inventory-real-api.spec.ts` (real-API run only) | Pass |
| E12 | S5 | `billing-functional.spec.ts`, `billing-a11y-responsive.spec.ts`; `billing-real-api.spec.ts` (real-API run only) | Pass |
| E13 | S5 | `admin-functional.spec.ts`, `admin-a11y-responsive.spec.ts`, `admin-filters.spec.ts`, `admin-branch-calendar.spec.ts`, `staff-admin.spec.ts` | Pass |
| E14 | all | Run-only specs: `accounts-a11y-responsive`, `ordering-a11y-responsive`, `reports-schedules`, `notifications-*`, `xct-*` | Pass unchanged |
| E15 | all | `npm run sweep:a11y` (`tests/a11y/app-sweep.spec.ts`) over the staff routes | No new axe violations against baseline `46929be` |

## 17. Implementation order and verification

1. **S0 publishes its §11.1 contract on day one**: the `components/back-office/*` files with the exact props above (a minimal implementation is fine), merged first.
2. **S1–S5 start in parallel** in separate worktrees (one `PORT` each, which `playwright.config.ts` honours), each rebased on S0's first merge. They import from `@/components/back-office/*` only.
3. S0 finishes the sidebar, `DataTable` restyle, ADR-FE-180…184, U41 and its tests. Nav entries `/staff/customers` and `/staff/inventory/receipts` link to routes owned by S1 and S4. `/staff/inventory/receipts` already exists; `/staff/customers` 404s until S1 merges, which is acceptable on a feature branch.
4. Each slice, in its own worktree, before opening its PR:

```bash
cd web
npm run typecheck
npm run lint
npm test
npx playwright test --project=chromium --project=mobile-360 <the slice's owned specs from §13>
```

5. **Integration (after all six merge, on `feat/phase2-catalogue-theme` or its successor):**

```bash
cd web
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run sweep:a11y
npm run build
# colour-literal check (also enforced by U41)
rg -n "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|-\[#" "app/(staff)" "app/(auth)/staff" components
```

6. Each slice's PR description lists: files touched (all inside its §13 block), any test whose structure-assertions were rewritten (old → new), and any Backend-gap element it left out.

## 18. Acceptance criteria

| A# | Story | Criterion | Evidence |
|---|---|---|---|
| A1 | US-ACC-14, US-ADM-01 | The staff shell matches the design sidebar (groups, labels, outlet picker, footer identity) and still meets UI-1 at 360 px | U1–U6, E1, E2 |
| A2 | — | Shared primitives exist with the §11.1 contracts, and are accessible | U7–U10 |
| A3 | US-ACC-14 | Staff sign-in uses the leaf frame without touching shared auth components | U11, E6 |
| A4 | US-RPT-05 | Dashboard shows server tiles, needs-attention and latest orders, with no invented figures | U12–U14, E3 |
| A5 | US-RPT-01…04, US-RPT-06 | Reports list and viewer match the design layout with an accessible chart | U15, E4 |
| A6 | US-ACC-10, US-ACC-11, US-BIL-03 | Customers screen: search, profile, orders and billing tabs, walk-in and duplicates reachable | U16, U17, E5 |
| A7 | US-ORD-09, US-ORD-10, US-ORD-19 | Orders workbench with status pills, side panel, pick list and server-allowed actions; selection survives the 30 s refresh | U18–U21, E7 |
| A8 | US-ORD-16 | Counter sale matches the design using server quote and change; no card UI; no money arithmetic | U22–U24, E8 |
| A9 | US-SHP-01, US-SHP-02 | Products list restyled with server statuses and filters | U25, U26, E9 |
| A10 | US-SHP-01…03, US-SHP-14 | Product editor matches the design layout, keeps route sections, version handling and transitions | U27–U29, E9 |
| A11 | US-IMP-06, US-IMP-10, US-IMP-12, US-IMP-13 | Inventory: alert tiles, stock by item with expandable batches, adjust from a row | U30, U31, U33, E10 |
| A12 | US-IMP-04 | Goods receiving matches the design, one-command post, inline line errors | U32, E10, E11 |
| A13 | US-BIL-06, US-BIL-12, US-BIL-01, US-BIL-05 | Billing: approvals (maker-checker presentation), cash-up with server variance, invoices | U34–U36, E12 |
| A14 | US-ADM-01, US-ADM-03, US-ADM-05, US-ADM-08, US-ACC-07 | Administration: tabs, outlet cards, staff and roles, roster grid, settings hub | U37–U40, E13 |
| A15 | UI-6, NFR-USA-6 | No new axe violations; all a11y specs pass | E1, E10, E12, E13, E14, E15 |
| A16 | HO-P2 §2 | No hex or colour literals in components or staff pages | U41, §17 step 5 |
| A17 | — | No file outside the slice's §13 block changed; no backend, mocks, lib (except `useBo*.ts`), config or customer file changed | ARCHITECTURE gate diff review against §13/§14 |
| A18 | — | `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build` pass, apart from the known timing-flaky files recorded at baseline | §17 step 5 |

## 19. Required gates

| Gate | Agent |
|---|---|
| ARCHITECTURE | `architecture-reviewer` |
| SECURITY | `security-reviewer` |
| CODE_REVIEW | `code-reviewer` |
| TEST | `test-engineer` |
| ACCEPTANCE | `acceptance-reviewer` |

## 20. BLOCKED conditions

### 20.1 **A file you need is not in your §13 block**
Stop and say which file and why. If it is another slice's file, ask that slice (via the integrator) to make the change. If it is frozen (§14), record it as a finding. **Never** edit it "just a little", and never copy it into your folder under a new name to dodge ownership: duplicating a shared primitive is a finding too.

### 20.2 **The design shows data the API does not return**
Leave the element out, add it to your PR's "Backend gaps left out" list (with its BG number below, or a new one), and carry on. **Never** add a mock field, never fetch N records to compute it, and never show a placeholder or "Sample data".

### 20.3 **A spec you do not own breaks because a label or role changed**
Run-only specs (§14) rely on accessible names and roles such as "Sign out", "Staff sign in", "Expand menu", the dashboard `h1` pattern, page `h1`s and form labels. Restore the name or role the spec expects (the visual layout may still change). If the design genuinely requires a different accessible name, raise BLOCKED with the spec and line. **Never** edit a spec outside your block, and never weaken an assertion in one you own.

### 20.4 **HO-P3 changed a frozen shared file that a back-office screen renders** (e.g. `AuthCard`, `components/billing/Amount`, `OrderStatusBadge`, `components/ui/button.tsx`)
Rebase and re-run your slice's tests. If a staff screen now renders wrongly, record it as a cross-handover finding for the integrator. **Never** fix it in that file from an HO-P4 slice.

### 20.5 **A guard or lint rule fails on your new code** (no money arithmetic, no card identifiers, billing `Number(`, hooks in `components/{account,admin,auth,customer}`)
Fix your code: move the value to the server's string, rename the field "Terminal slip number", move the hook call into the page. **Never** relax the guard, add an ignore comment, or move the file out of the scanned folder to escape it.

### 20.6 **The S0 contract (§11.1) is not enough for your screen**
Ask S0 for an **additive** prop (the integrator records it as a §1 Amended row on this handover). Until it lands, compose with token-based Tailwind classes in your own folder. **Never** change an S0 prop's meaning in a way that breaks another slice.

### 20.7 **A colour the design needs has no token** (mango, the yellow wordmark accent)
Use the §8.3 mapping. **Never** add a hex literal, an arbitrary value or a new CSS variable; `globals.css` is forbidden (OQ-1).

---

## Backend gaps (not built in HO-P4)

The design shows each of these, and the existing web API clients (`web/lib/api/*.ts`, checked against the controllers in `src/Api/AmarGram.Api/Controllers`) do not provide it. The screen leaves the element out. Each needs a backend handover (plus a `lib/api` and mock change) before it can be added.

| BG | Screen | Missing | Today's nearest data |
|---|---|---|---|
| BG-1 | Dashboard | A per-day sales series (14 days) for the chart | Server-defined dashboard tiles; report catalogue (no guaranteed daily-revenue report key) |
| BG-2 | Dashboard, Orders | Order counts by status (pipeline bars, tab counts) | `GET /api/staff/orders` gives `totalCount` for one filter at a time |
| BG-3 | Orders | Delivery area and delivery slot on the order **list** row | Only on order detail (`fulfilment`) |
| BG-4 | Orders | A "Packed, waiting for rider" state distinct from `Packing`; persisted pick-list ticks | Statuses `Confirmed → Packing → Dispatched → Delivered` |
| BG-5 | Orders, Dashboard | In-house riders (dispatch to a rider; "COD out with N riders") | Couriers only (`listDispatchCouriers`); COD remittance under Billing |
| BG-6 | Counter sale | Browse SKUs by category / a favourites grid | Text search `GET /api/staff/pos/skus?q=` and barcode lookup only |
| BG-7 | Counter sale | Change due **before** completing (for a tendered cash amount) | `changeDue` only on the completed sale response |
| BG-8 | Counter sale | Anonymous walk-in sale | API requires customer name and mobile |
| BG-9 | Products | Origin, pack-size list, price range, stock, primary image thumbnail and an organic flag on the list row | `StaffProductSummary` (name, brand, category, status, kind, skuCount, listed, updated) |
| BG-10 | Products | Bulk publish/hide | Per-product transition needing `expectedVersion`; the list row has no version |
| BG-11 | Products | A "Categories" management screen | Categories are a fixed enumeration (HO-P2 §1.1). The design button is dropped (not a defect) |
| BG-12 | Product editor | District/region of origin | `countryOfOriginCode` only |
| BG-13 | Product editor | Compare-at ("Was") price per SKU | `currentPrice`, `scheduledPrice` |
| BG-14 | Product editor | Organic certificate expiry date and certificate file upload | `organicCertifier`, `organicCertificateNumber` |
| BG-15 | Product editor, Customers, Dashboard, Orders | **Subscriptions as a whole**: "Can be subscribed to", Subscriptions tab, "Subscriber" filter, "Subscription orders due tomorrow", the Subscription channel | No subscription controller in `src/Api` and no web client (`nav/areas/subscriptions.ts` is empty) |
| BG-16 | Inventory | Reorder level on the stock row; batch received date and supplier in the SKU batch matrix | Reorder policies are a separate list; `StockMatrixBatch` has lot, expiry, status, locations |
| BG-17 | Inventory | "Consignments arriving this week" count | Consignment list exists without an arrival-window count |
| BG-18 | Receiving | Server-side receipt drafts (autosave), and receiving into a branch other than the active one | A receipt is posted in one command at the active branch (`X-Branch-Id`) |
| BG-19 | Customers | A browsable, paged customer list; name search; lifetime spend, order count, customer since and area on the profile; customer notes; staff-initiated password reset for a customer; tags | `GET /api/staff/customers?mobile=|email=` lookup; detail; duplicates; merge. The balance comes from Billing |
| BG-20 | Billing | Counted amount **per source** (till, each rider) | One `countedCash` per business date |
| BG-21 | Administration | Outlet card details on the list: address, type (outlet/warehouse), hours summary, delivery areas, staff count | `BranchSummary` (id, code, name, timeZoneId, isActive); detail has address and hours |
| BG-22 | Administration | Branch assignment and status on the staff-account list; the design's role set (Manager, Cashier, Packer, Stock keeper, Rider) | `StaffAccountSummary` (name, mobile, email, roleIds, hasPassword); roles are Administrator, Reception, Inventory, ShopManager, Accountant |
| BG-23 | Administration | Click-to-cycle shift cells (Morning / Evening / Off) on the roster grid | Rosters are edited through patterns and exceptions |

## Open questions (flagged, not resolved)

| OQ | Question | Default in this handover |
|---|---|---|
| OQ-1 | The design uses mango (`#EDA73A`) count pills and a yellow wordmark accent (`#F7D87A`) in the staff sidebar. `--warm` is customer-layer only. Add staff tokens? | No. Use warning tokens for pills and keep the HO-P2 wordmark. A token change needs a `globals.css` edit coordinated with HO-P3 |
| OQ-2 | Sidebar count badges (orders to pack, inventory alerts, approvals) need three role-gated, polled queries in the shell | Deferred. The inventory badge stays in its section tabs |
| OQ-3 | The design's dashboard heading "Good morning, [name]" conflicts with the spec-pinned `h1` "Today — {branch} · {date}" | Keep the `h1`; the greeting becomes the eyebrow line |
| OQ-4 | Product statuses: the design says Published/Draft/Hidden; the API has Draft/Active/Archived plus `listedOnStorefront` | Keep the API's statuses and existing labels. Relabelling is an owner call (it would change `lib/shop/labels`, which HO-P3 shares) |
| OQ-5 | ADR-FE numbering: the README says the next is FE-173, but FE-173 is already used by Hearth | HO-P4 takes FE-180…184; FE-174…179 left for HO-P3. The integrator should update the README ADR table |
| OQ-6 | The design's single "Origin & certification" tab spans two writes (details `PUT` + food `PUT`) | Not merged. Country and certifications stay on Details; certifier and number on Food & labelling |
| OQ-7 | The Roster "tab" has no single route (rosters are per branch) | The tab opens the active branch's roster, or the outlet cards when there is no active branch |
| OQ-8 | The design's Settings page edits delivery fees, payment toggles and maintenance in one form; today they are separate resources with separate saves | Settings becomes a hub of linked cards; editing stays where it lives |
