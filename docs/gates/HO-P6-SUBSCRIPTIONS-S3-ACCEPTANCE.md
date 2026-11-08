GATE: ACCEPTANCE
HANDOVER: HO-P6-SUBSCRIPTIONS (slice S3, back-office subscription touch points)
COMMITS: 5339543 34f6ea4 8cee347 b85ae6e 52404ee 3db1353 a15c85c e8bc8ff a13da25 bec6a91 a92b674 5cfdaf4 f352a6b (range 16a07b3..f352a6b, branch feat/p6-s3-backoffice)
DATE: 2026-11-09
STATUS: PASS

PRIOR GATES (read from docs/gates and docs/test-cases, not from commit messages)
- ARCHITECTURE: PASS (HO-P6-SUBSCRIPTIONS-S3-ARCHITECTURE.md, range 16a07b3..52404ee). It has 4 LOWs.
  - LOW 1 (T9 role check before the GUID check) became Amended (m)(2) and is fixed in bec6a91.
  - LOW 2 (the real 400 text for a non-boolean isSubscribable) is deferred to TEST T12 / E18.
  - LOW 3 (staff copy kept local) became Amended (m)(1) and is fixed in bec6a91.
  - LOW 4 records that the overview-customers SUMMARY_VIEW fixture is part of the authorised supersession.
- SECURITY: PASS (-SECURITY.md, range ..52404ee). No findings.
- CODE_REVIEW: run 1 PASS with 8 LOWs. Run 2 PASS (a15c85c..bec6a91); it verifies LOWs 1, 4, 5 and 7 and the (m) hoist as additions only. Its run-2 LOW 1 (the MSW listener cleanup) is fixed in 5cfdaf4, which changes only one test file. Its run-2 LOW 2 (import order) is cosmetic and left as is.
- TEST: PASS (-TEST.md at 5cfdaf4). The sheet TC-HO-P6-SUBSCRIPTIONS-S3.md has 41 builder rows, 4 rows added under Amended (m), O1, and T1-T12. 0 FAIL.
  - T9 is NOT RUN (real-API specs, integration E18).
  - T12 is BLOCKED: the real server's 400 text for a non-boolean `isSubscribable`. It needs a running API and is deferred to the integrator's real-API run (E18). The integrator accepts this deferral, as with S1's and S2's real-API rows. It is not counted as a pass here.
  - tsc and lint exit 0. Full Vitest: 271 files, 2710 tests, 0 failed. S3 specs: 24 passed on chromium and mobile-360. E15 run-only: 118 passed. S1/S2 regression: 136 passed.
- Slice report: HO-P6-SUBSCRIPTIONS-S3-SLICE-REPORT.md covers every §17.3 item, including §9 (the fixes after the gates).
- Process note (as in S2): the ARCHITECTURE and SECURITY records predate bec6a91. CODE_REVIEW run 2, TEST and my own scope check below cover that commit.

My own re-run at f352a6b: `npx vitest run tests/components/back-office-subscriptions tests/components/staff-shop/products-p5.test.tsx tests/components/back-office-overview --maxWorkers=2` gave 11 files and 92 tests passed.

CRITERIA (§18 rows that bind S3: A15, A16, and S3's parts of A14 and A17-A21)
- A15 MET. Staff can switch "Can be subscribed to", and the store front follows it.
  - product-editor.test.tsx (U35) covers:
    - the checkbox shows unchecked for a non-subscribable product and checked for a subscribable one
    - the OQ-18 help text is its accessible description
    - the label is `min-h-11`
    - ticking sends `isSubscribable: true` and `expectedVersion` in exactly one PUT
    - unticking sends `false`, never an omitted field
    - the saved flag sticks on the shop mock's product
  - products-p5.test.tsx U30 is superseded at no less strength: `not.toHaveProperty('isSubscribable')` became `toBeChecked()` plus `toHaveProperty('isSubscribable', true)`. The district and `expectedVersion` assertions are unchanged.
  - mock-refusals.test.ts (U39d-f): omitted leaves the flag, a boolean sets it, a non-boolean gets a 400 before the version check, and C1's `subscribable` follows the flag at once.
  - E13a, subscriptions-backoffice.spec.ts on both projects (TEST T5): tick the box on Neem soap bar, save, reload and it is still ticked. The signed-in customer then sees `subscribe-offer` with a `/portal/subscriptions/new/{guid}` link. Untick and save, and after the C1 response the offer count is 0.
  - Source: ProductDetailsForm.tsx (schema, default `product.isSubscribable === true`, checkbox) and products/[productId]/page.tsx:57 (`isSubscribable: values.isSubscribable` in the same PUT).
- A16 MET. The profile has a Subscriptions tab, the dashboard has both rows, and orders filter by channel.
  - Profile:
    - customer-tab.test.tsx (U36a-d): the tab order is exactly Orders, Subscriptions (n), Billing, Notes; one link per live subscription to `/staff/subscriptions/{id}`, each `min-h-11`; the "{s} suspended · {c} cancelled" text; Suspended rows listed; the empty state ("No current subscriptions.", "0 suspended · 0 cancelled"); a 403 or 500 gives no tab and no alert.
    - profile-tab-fallback.test.tsx (U36f).
    - overview-customers.test.tsx: exact tab list, and "no Subscriber" kept.
    - E13b clicks through to the staff detail.
  - Dashboard:
    - dashboard-rows.test.tsx (U37a-h): server counts 4 and 3, hrefs `?status=Active` and `?status=Suspended`, rows after the existing four in unchanged order, absent at zero, a 403 drops both rows without a banner, absent only when all three sources are refused, "Checking…" and the failure line.
    - E13c compares the row with the count fetched from T3 and lands on the list with Status = Active.
  - Orders:
    - orders-channel.test.tsx (U38a-c): the options are exactly Any channel, Online, Counter, Subscription; `channel=Subscription` is in the URL and in both the list and status-counts requests; only Subscription orders are listed; the All pill counts them.
    - E13d: filtered rows all say Subscription, and the filtered All count is below the unfiltered one.
- A14 (S3 part) NOT APPLICABLE / real-API pending. S3 builds no discount surface. The row's server-rendered evidence belongs to E18, as recorded for S1.
- A17 MET (S3 part).
  - E14, subscriptions-backoffice-360.spec.ts (4 screens at 1280 and 360, both projects, TEST T5) checks no sideways scroll, 44 px on the controls S3 adds or changes, and zero serious or critical axe findings.
  - U40 no-literals.test.ts plus the shared no-hex and no-colour tests (TEST T4, T10).
  - My own measurements while capturing:
    - scrollWidth equals the viewport on all 12 captures.
    - "Can be subscribed to" label 44 px at both widths.
    - Channel select 44 px at both widths.
    - "Subscription orders due tomorrow" row 44 px (1280) and 76 px (360).
    - Panel cards 126 / 154 px.
    - Tabs 44 px.
  - The 44 px claim for orders covers the Channel select only. The other More-filters controls stay 36-38 px under Amended (l)(3), which records a follow-up.
- A18 MET (S3 part), with one real-API-pending item.
  - U39 mock-refusals.test.ts covers:
    - the role arrays pinned equal to ActionRoles.Subscriptions.cs:12-14
    - 403 per role for T3 and T9
    - a non-GUID id is a 404 for every role (U39g)
    - an unknown customer is 200 and empty
    - T3 counts
    - the omitted / boolean / non-boolean flag
  - Slice report §5 cites the server file:line for each rule, and ARCHITECTURE checked them against src/.
  - The non-boolean 400 matches the server's shape class (object-shaped `errors`, 400, nothing changed). Its exact System.Text.Json text is unconfirmed (T12 BLOCKED, deferred to E18 and accepted by the integrator). The UI never sends a non-boolean.
- A19 MET. `git diff --name-only 16a07b3..f352a6b` lists 31 files, all under web/** or docs/**. There is no src/, .NET test, config, package or lock change. See SCOPE.
- A20 MET (per-slice part).
  - TEST T1 (tsc exit 0), T2 (lint exit 0) and T4 (full Vitest at --maxWorkers=2, 0 failed), all at 5cfdaf4. f352a6b changes docs only.
  - Build, full e2e and the contract test (§12 row, T3/T9 GETs) are integration steps (§17.2, E16, E18).
- A21 not breached. The "Subscriber" filter is not built (BG-S2, OQ-10):
  - overview-customers asserts no "Subscriber" text
  - CustomerProfile's doc comment records it as not built
  - grep finds no filter
  - S3 builds no other BG-S item.

SCREENSHOTS (§19): 12 PNGs in docs/gates/screenshots/HO-P6-S3/, each screen at -1280 and -360
- Screens:
  - product-editor-unticked (Neem soap bar)
  - product-editor-ticked (Organic Rolled Oats)
  - customer-tab (Sam Rahman, 7 live: 4 Active, 1 Paused, 2 Suspended; "2 suspended · 1 cancelled")
  - customer-tab-empty (a seeded customer for whom T9 answers an empty list; "No current subscriptions.", "0 suspended · 0 cancelled")
  - dashboard-attention (six rows; the two subscription rows last)
  - orders-channel (`?channel=Subscription`, More filters open, Subscription selected)
- How they were taken:
  - `next dev` on PORT=3130 with NEXT_PUBLIC_USE_MOCKS=true, NEXT_PUBLIC_API_BASE_URL=http://localhost:5005 and E2E_KEEP_ROUTES=1.
  - Playwright at 1 worker, signed in as Administrator through the repo's `openReportsAs`, full-page captures.
  - The capture spec and config lived in the scratchpad only. The server was stopped afterwards, and 3130 is free.
  - At 360 the full-page capture draws the fixed staff rail partway down the image. That is an effect of the capture method, not of the layout.
- Today's tokens throughout: the staff shell, Fraunces headings, token surfaces and borders, S2's status pill (word plus icon), and the warning and neutral AttentionRow tones.
- Against the designs:
  - Product editor (back-office/ProductEditor.dc.html:150):
    - Same label, place (Organise card, after "Listed in shop") and checkbox look. The design's row is 40 px; the build is 44 px (UI-1).
    - The help text under it is the OQ-18 wording §11.4.2 requires; the design has none.
  - Customer tab (subscriptions/CustomerSubscriptionsPanel.dc.html; back-office/Customers.dc.html:104, :137): the build uses cards, not the design's table with Product / Status / Next order / Open (slice report §7.8, a visual call). Each card has:
    - product · variant
    - the status pill
    - "{qty} × every {n} weeks"
    - next delivery or the reason there is none ("None while paused / suspended", as in the design)
    - payment method (§11.4.3)
  - Differences in the customer tab:
    - The design breaks the suspended count down by reason ("1 for unpaid orders, 1 for a withdrawn product"). The build writes "{s} suspended · {c} cancelled" exactly as §11.4.3 specifies, because T9 sends only `suspendedCount`. This is an omission for lack of data (ADR-FE-177).
    - The design's "All of {name}'s subscriptions →" link is not built. §11.4.3 does not ask for it, and S2's list has no customer filter in the URL, so the link could not keep its promise. It is an omission, not a silent drop of a specified item.
    - Tab order is Orders, Subscriptions, Billing, Notes. Billing is the pre-existing HO-BIL tab, which the design predates (slice report §7.7).
  - Dashboard (back-office/Dashboard.dc.html:163):
    - "Subscription orders due tomorrow" with the ↻ icon and its count.
    - The build's tone is neutral (§11.4.4), where the design's is a green tint. It links `/staff/subscriptions?status=Active` (§11.4.4), not the design's Orders page.
    - "Subscriptions suspended" is added under OQ-12.
  - Orders: Orders.dc.html has no Channel select to compare against. The options and the "Any channel" blank follow OQ-11.

FINDINGS (none blocks a criterion)
- [LOW] web/components/customer/CustomerProfile.tsx (tab list; the scroller is components/back-office/UnderlineTabs, outside S3's scope) — the 360 tab bar hides two tabs behind an inner horizontal scroll.
  - At 360 the "Customer details" tablist's container is 240 px wide with `overflow-x: auto` and 407 px of content.
  - With the new "Subscriptions (7)" tab, Billing (left edge 328 px) and Notes (left edge 407 px) are hidden behind that scroll (customer-tab-360.png).
  - The page itself does not scroll sideways, so UI-1 and E14 hold, and the tabs stay keyboard-reachable.
  - Before S3, Orders + Billing + Notes (about 253 px) already overflowed slightly, so the pattern is pre-existing; S3 makes it more visible.
  - A visual call for the owner or integrator: wrap the tabs, or shorten the labels below 640 px.
- [LOW] Erase-personal-data panel at 360 (not S3's file): the two "Choose…" selects run past the card's right edge (customer-tab-360.png, customer-tab-empty-360.png). This is pre-existing (HO-P5 BG-19 area), is not caused by S3, and is recorded for the owner only.
- [LOW] Process — the ARCHITECTURE and SECURITY records predate bec6a91. CODE_REVIEW run 2, TEST and this gate cover it.

SCOPE
- Out-of-scope work (§4) found: none.
  - No Subscriber filter, signed-out offer, estimate or staples box.
  - No client schedule, date or money arithmetic. The panel uses `nextDeliveryLabel` and S0's sentences, chosen from the server's `status`.
  - No payment capture.
  - `app/(staff)/staff/page.tsx` is untouched, as §11.4.4 requires.
- Files in S3's §13 block (25):
  - lib/hooks/useSubscriptionSummaries.ts
  - lib/api/staff-shop.ts (two fields and the comment)
  - products/[productId]/page.tsx (one line)
  - ProductDetailsForm.tsx
  - CustomerProfile.tsx
  - CustomerProfileView.tsx
  - DashboardAttention.tsx
  - StaffOrderQueue.tsx
  - components/back-office-subscriptions/CustomerSubscriptionsPanel.tsx
  - mocks/handlers/subscriptions/touchpoints.ts
  - mocks/handlers/shop/staff.ts
  - tests/components/back-office-subscriptions/** (7 files, including profile-tab-fallback.test.tsx)
  - products-p5.test.tsx (:243-262 only)
  - overview-customers.test.tsx (the Subscriptions supersession; the file-scope SUMMARY_VIEW fixture serves only that case and is part of the authorised supersession, per ARCHITECTURE LOW 4)
  - tests/e2e/subscriptions-backoffice{,-360}.spec.ts
  - S3's TC sheet and its gate records and slice report
- Outside the block, authorised by an Amended row:
  - tests/components/back-office-overview/overview-dashboard.test.tsx, under (l)(1). The diff is one added T3 refusal and the rename, nothing else.
  - StaffOrderQueue.tsx `className="min-h-11"`, under (l)(3).
  - The optional `isSubscribable?`, under (l)(2).
  - `subscriptionsCount`, under (l)(5).
  - S2's pill imported, not copied, under (l)(4).
  - web/lib/subscriptions/copy.ts, under (m)(1). The diff is 13 lines appended at the end with exactly the five listed exports (SUBSCRIBABLE_HELP, NO_CURRENT_SUBSCRIPTIONS, customerSubscriptionCounts, DASHBOARD_DUE_TOMORROW_TEXT, DASHBOARD_SUSPENDED_TEXT). No existing export changed.
  - docs/handover/HO-P6-SUBSCRIPTIONS.md: integrator §1 rows only. The diff has no removed lines, and two rows were added, (l) and (m), after (k).
- Files outside allowed scope: none.

UNDECLARED DEVIATIONS
- none. Every design difference above is declared in the slice report (§7.3, §7.7, §7.8), set by the handover's §11.4 text or an OQ default, or is an omission for lack of data. The 360 tab-bar observation is a layout effect of a shared primitive, not a deviation from a rule.

FOR THE OWNER
- T12 / E18: confirm the real API's 400 body for a non-boolean `isSubscribable`, and copy its text into the shop mock if it differs. The UI never sends one.
- The version bump on a save that flips the flag: the server moves the version by 2, the mock by 1 (CODE_REVIEW run 1 LOW 2). Check in the E18 real-API run.
- The due-tomorrow row opens every Active subscription, not only those due tomorrow (CODE_REVIEW run 1 LOW 3). A `dueOn` filter on the staff list would be a backend follow-up.
- The global 44 px pass for the other orders More-filters controls (Amended (l)(3)).
- The 360 customer tab bar (LOW above). `app/(staff)/staff/page.tsx`'s "Not built: subscriptions due" comment is now stale (§11.4.4 leaves it to the integrator).
- The contract test's T3/T9 GETs and the shop detail's `isSubscribable` drift closing are integration steps (§12).

SCOPE CHECK
- files in allowed scope: 31/31 changed files (16a07b3..f352a6b), counting the Amended-authorised ones, plus this record and the 12 screenshots
- files outside allowed scope: none
