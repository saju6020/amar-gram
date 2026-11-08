# TC-HO-P6-SUBSCRIPTIONS-S3 — Subscriptions frontend: back-office touch points (product flag, customer tab, dashboard rows, orders channel)

Handover: docs/handover/HO-P6-SUBSCRIPTIONS.md (S3 rows U35–U40 for S3's files, §16 E13–E15, §18 A15/A16/A17/A18, OQ-10/11/12/18, ADR-FE-197)
Commit under test: the S3 build commits on `feat/p6-s3-backoffice` (based on `feat/phase2-catalogue-theme` at 16a07b3, which holds S0, S1 and S2). See the slice report for the hashes.
Written: 2026-11-09 (by the implementer, with the build; the TEST gate re-runs everything and records its own results)

> Statuses record what the implementer saw inside the batch (§17.1): typecheck, lint, the Vitest files S3 touches (plus the subscription, staff-shop, overview, sales,
> orders and guard folders), S3's own Playwright specs and the E15 run-only set.

## Summary

| | Count |
|---|---|
| Rows | 39 (38 plus the open item) |
| PASS | 38 |
| FAIL / BLOCKED (§20.1: an unowned test file the handover's own rule breaks, section "Open item" below) | 1 |

## Environment

Worktree D:/my-repo/amar-gram/.claude/worktrees/p6-s3. `tsc --noEmit` exit 0; `npm run lint` (`--max-warnings 0`) exit 0.
Vitest 5.0.1 at `--maxWorkers=2`. Playwright against `next dev` on PORT=3130 (started by the config's `webServer`), `NEXT_PUBLIC_USE_MOCKS=true`,
`NEXT_PUBLIC_API_BASE_URL=http://localhost:5005`, `E2E_KEEP_ROUTES=1`, `--workers=2`, projects chromium and mobile-360. The worktree has no
`.env.local`, so the two `NEXT_PUBLIC_*` values are passed in the environment. No real API was used (S3 has no real-API spec; the handover does not ask for one).

## Component and unit cases (Vitest)

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| U35a | The checkbox "Can be subscribed to" reflects a non-subscribable product (unchecked) and a subscribable one (checked) | pass | PASS | `product-editor.test.tsx` |
| U35b | The help text is the checkbox's accessible description (OQ-18 wording, verbatim) and the label is `min-h-11` | pass | PASS | same |
| U35c | Ticking and saving sends `isSubscribable: true` with `expectedVersion` in the one details `PUT` (one request) | pass | PASS | same |
| U35d | Unticking sends `false`, never an omitted field | pass | PASS | same |
| U35e | Against the shop mock the saved flag sticks on the product object | pass | PASS | same |
| U35f | Superseded: the district save "sends exactly the shown isSubscribable value" (was "never sends isSubscribable") | pass | PASS | `tests/components/staff-shop/products-p5.test.tsx` U30 |
| U36a | Tab labels are Orders, "Subscriptions (n)", Billing, Notes; the panel lists every live subscription (Suspended included) as a link to `/staff/subscriptions/{id}`, 44 px, status as a word, and the counts line | pass | PASS | `customer-tab.test.tsx` |
| U36b | A customer with none: "Subscriptions (0)", "No current subscriptions.", "0 suspended · 0 cancelled" | pass | PASS | same |
| U36c | A 403 on the subscription read: no tab, no alert | pass | PASS | same |
| U36d | A failed read (500): no tab, no alert | pass | PASS | same |
| U36e | Superseded: the profile lists Orders, Subscriptions (1), Billing, Notes (2); "no Subscriber" still holds | pass | PASS | `tests/components/back-office-overview/overview-customers.test.tsx` |
| U37a | "Subscription orders due tomorrow": the server count, href `/staff/subscriptions?status=Active`, `min-h-11` | pass | PASS | `dashboard-rows.test.tsx` |
| U37b | "Subscriptions suspended": the server count, href `?status=Suspended`, after the due row | pass | PASS | same |
| U37c | Order of rows: the three alert rows, approvals, then the two subscription rows | pass | PASS | same |
| U37d | Both counts zero: no subscription row, "Nothing needs attention right now." | pass | PASS | same |
| U37e | A 403 on T3 drops both rows, keeps the others, shows no banner and no "couldn't check" line | pass | PASS | same |
| U37f | Two sources refused: the panel stays (the third has rows); all three refused: the panel is absent | pass | PASS | same |
| U37g | "Checking…" while pending; the failure line when T3 fails with a non-403 | pass | PASS | same |
| U37h | Against the subscriptions mock the seeded due-tomorrow and suspended rows appear | pass | PASS | same |
| U38a | The Channel select offers Any channel, Online, Counter, Subscription | pass | PASS | `orders-channel.test.tsx` |
| U38b | Choosing Subscription writes `channel=Subscription` and both the list and `status-counts` are requested with it | pass | PASS | same |
| U38c | With the filter the list shows only Subscription orders (each row names its channel) and the "All" pill counts them | pass | PASS | same |
| U38d | The existing row-label case still passes | pass | PASS | `tests/components/back-office-sales/orders-workbench.test.tsx` (run-only) |
| U39a | The mock's view roles equal the web's; for each of seven roles T3 and T9 answer 403 exactly outside Subscriptions.View | pass | PASS | `mock-refusals.test.ts` (8 cases) |
| U39b | T3 counts Active with `nextDeliveryOn` = tomorrow (`count` ≥ 1), `liveCount`, `suspendedCount`, zone `Asia/Dhaka` | pass | PASS | same |
| U39c | T9 lists every non-cancelled subscription soonest first (none last), Suspended included, with both counts; an unknown customer is 200 with an empty summary; a non-GUID id is 404 | pass | PASS | same |
| U39d | The staff detail always sends `isSubscribable`; omitted leaves it, a boolean sets it | pass | PASS | same |
| U39e | A non-boolean `isSubscribable` is a 400 before the command (even with a stale `expectedVersion`) and changes nothing | pass | PASS | same |
| U39f | C1's `subscribable` follows the flag at once (off, then on) | pass | PASS | same |
| U40a | No colour literal in any S3 component, hook, or edited file | pass | PASS | `no-literals.test.ts` (11 cases); the shared `no-hex-literals` and `no-colour-literals` tests also pass |
| U40b | 44 px: the checkbox label, the tab rows and the Channel select carry `min-h-11` | pass | PASS | same |
| U6 | The S0 source guard (no date-only `new Date`, no money arithmetic) over `components/back-office-subscriptions/**` and `lib/hooks/use*Subscription*.ts` | pass | PASS | `tests/unit/subscriptions` (S0's guard, run unchanged) |

## End-to-end cases (Playwright, chromium and mobile-360)

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| E13a | Product editor: tick "Can be subscribed to" on a non-subscribable product (Neem soap bar), save, reload (still ticked); the signed-in customer sees the offer on that product; untick, save, the offer is gone | pass | PASS | `subscriptions-backoffice.spec.ts`, both projects |
| E13b | Customer profile: the Subscriptions tab is second, labelled with the live count, lists those subscriptions, shows the suspended and cancelled counts, links to `/staff/subscriptions/{id}` | pass | PASS | same |
| E13c | Dashboard: "Subscription orders due tomorrow" carries the count the server sends (read through the same API), the suspended row its count; the row opens `/staff/subscriptions?status=Active` | pass | PASS | same |
| E13d | Orders: Channel "Subscription" lists only subscription orders (table at wide widths, cards below) and the "All" pill counts them (fewer than unfiltered); clearing it removes the filter | pass | PASS | same |
| E14 | Product editor checkbox, customer tab, dashboard attention panel, orders Channel select, each at 1280 and 360 px: no sideways scroll, controls S3 adds or changes at 44 px, axe: zero serious/critical | pass | PASS | `subscriptions-backoffice-360.spec.ts` (8 per project) |
| E15 | Run-only: `shop-staff`, `catalogue-stock-*`, `staff-customers`, `customers-admin-*`, `dashboard-home`, `ordering-staff`, `sales-gate-s2`, `packed-customer-after-staff` | pass | PASS | 118 cases, both projects, no failure and no baseline case appeared |

One run (workers 2, both projects, one `next dev`): 142 passed, 0 failed, 0 skipped (24 new, 118 run-only).

## Open item

| ID | Case | Status | Note |
|---|---|---|---|
| O1 | `tests/components/back-office-overview/overview-dashboard.test.tsx` "DashboardAttention — U13 > is absent when both areas are refused" | FAIL (reported, not edited) | The file is outside S3's block (§13). U37 says the panel is absent only when all three sources are refused, so a test that refuses two and leaves the third to the default mock now sees the subscription rows. The test's intent is kept by adding a third refusal (`http.get('*/api/staff/subscriptions/due-tomorrow', forbidden)`); the same three-way case is proved in `dashboard-rows.test.tsx` (U37f). §20.1: needs an integrator-authorised edit of that file. |
