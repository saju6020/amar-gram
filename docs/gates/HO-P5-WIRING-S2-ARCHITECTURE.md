GATE: ARCHITECTURE
HANDOVER: HO-P5-WIRING (slice S2, sales: dashboard, orders, counter sale)
RUN: 1
COMMITS: 625a0da adec50e 9eec889 d26e5d7 230ea43 971c8bd f8ffb4d 26fbb64 (merge) db084bb (base e7826aa, HEAD db084bb, branch feat/p5-s2-sales)
DATE: 2026-10-31
STATUS: PASS

No BLOCKER or HIGH finding. Two MEDIUM and eight LOW findings are open. This verdict covers the code as written. I ran `tsc` and the two money and card guard files; every other test result in the slice report remains the report's own claim.

FINDINGS
- [MEDIUM] web/components/pos/PosScreen.tsx:187-190,226 — §11.3.13 says "Walk-in (no customer)" is the default and "Add customer" opens `PosCustomerPanel`. No "Add customer" control or text exists anywhere in `components/pos`. The chip itself opens the panel, and its accessible name ("Walk-in (no customer)") does not say so. The function is built, but the difference is in neither the slice report's list nor an Amended entry, so it is a silent departure. Either add the wording or record an Amended row.
- [MEDIUM] web/tests/e2e/ordering-staff.spec.ts:102 — §7 UI-6 expects axe coverage, and `/staff/fulfilment/riders` is the one new S2 screen with none. `ordering-a11y-responsive.spec.ts:25` lists the pick list but not this route, and that spec is run-only (§14). `ordering-staff.spec.ts` has no axe call, and `riders-dispatch.test.tsx` has none. S2 can fix this in `ordering-staff.spec.ts`, which it owns. Whether the page is axe-clean is unknown: for TEST.
- [LOW] web/components/pos/PosScreen.tsx:92 — The change preview ignores payments already added. The quote takes one `tenderedCash` and evaluates it alone (`PosQueryHandlers.cs`: `TenderCalculator.Evaluate` with one cash tender), so with a card payment on the ticket "Still to pay" is measured against the full total. This meets §11.3.12 and ADR-FE-191, and the browser must not correct it (§20.4). The figure can still mislead on a split payment, so ACCEPTANCE or the owner should decide whether to hide the preview in that case or ask for a backend change.
- [LOW] web/lib/hooks/useSalesSeries.ts:20 — §11.3.2 gives the key `['dashboard', 'sales-series', days]`; the code adds `branchId`. The code is right: the endpoint is scoped to the active branch, and `useDashboard` is keyed the same way. The slice report (line 79) discloses it, but no Amended entry records it.
- [LOW] web/components/orders/StaffOrderSidePanel.tsx:120-121 — §8.4 says HO-P4's component-state ticks are removed. `justTicked` is a new component-state overlay. It lives only while the write is in flight, is cleared in `finally`, and is not the source of truth, so the server's `picked` still decides. While it is set, it also feeds the `allTicked` gate. The server does not gate on ticks, so this is harmless. The report (line 78) discloses it; no Amended entry records it.
- [LOW] web/components/orders/StaffOrderPanels.tsx:99 — §11.3.8 names both `StaffOrderSidePanel` and `StaffOrderPanels`, but "Packed {time}" and the writable ticks exist only in the side panel. The full order page shows read-only "Picked." and the time in its status history (:192). Below 1024 px, where the page is the only view, staff cannot tick a line. HO-P4's ticks had the same limit, so this is not a regression, but the report does not mention it.
- [LOW] web/lib/api/pos.ts:101 — `CounterQuoteInput.tenderedCash` has no file:line citation, as §4.3 and ADR-FE-185 require. The field is real (`Api/Contracts/Order/PosRequests.cs:24`).
- [LOW] web/mocks/handlers/ordering/pos.ts:188,191 — The mock quote omits `changeDue` and `cashShort` when they do not apply. The server sends them as explicit nulls (`PosViewModels.cs:12-17`; no `DefaultIgnoreCondition` found in `src/Api`). The client treats both forms alike. The contract run at integration may report the difference.
- [LOW] web/components/orders/DispatchDialog.tsx:90 — Every 404 is reported as "That courier/rider is not available", including an unknown order, which the same endpoint also answers with 404. For CODE_REVIEW.
- [LOW] web/components/orders/StaffOrderQueue.tsx:71 and docs/gates/HO-P5-WIRING-S2-SLICE-REPORT.md:10,14,18,74 — Two report and test gaps. The `Subscription` label has no runtime test: the report's "unit-tested through the type only" means no test renders it. For TEST. The report is also stale: lines 10 and 14 stop at 971c8bd and f8ffb4d while HEAD is db084bb, and line 18 omits `tab-count-label.test.tsx`, though its follow-ups section covers it.

SCOPE CHECK
- files in allowed scope: 43/43
- files outside allowed scope: none
- §13 S2 block, 41 files, all by exact path or glob.
- Amended (r), 1 file: docs/gates/HO-P5-WIRING-S2-SLICE-REPORT.md.
- Amended (z), 1 file: web/components/back-office/tab-parts.tsx.
- §14: `git diff --stat e7826aa...HEAD` is empty for src, tests (.NET), .ai, deploy, docs/handover, web/package.json, the lock file, globals.css, web/nav, web/tests/guards, web/tests/setup.ts, web/docs, ordering/store.ts, shop/fixtures.ts, lib/api/errors.ts, lib/shop and lib/format. No new dependency. e7826aa is the merge base.
- Handover §6 is complete; no omission to report.

REQUESTED CHECKS

(z), other tabs unchanged: CONFIRMED by reading.
- `renderCount` (tab-parts.tsx:197-207) returns the same `<span className>` as before when `countLabel` is absent, and `null` where the old `&&` gave `false`; both render nothing. A count of 0 still renders.
- `countLabel` is passed only by `StaffOrderQueue.tsx`. The billing matches in a loose search are `accountLabel`.
- `tabs-shared.ts` is unchanged, so `TabsProps.items` stays `TabItem[]`. The queue passes its extra field through a typed variable, and `tsc` accepts it.
- No exact-name tab lookup for these pills was found in the e2e specs.

`DbOrder.channel` staying `'Online' | 'Counter'`: NO CONFLICT with §8.2.
- §8.2's `store.ts` row does not list `channel`. The widening is on the `staff-orders.ts` row and applies to the API type only.
- `store.ts` is outside S2's block, and a seeded subscription order would sit against §4.1.
- The server channel is real (`OrderChannel.cs:8`). The mock's filter accepts `Subscription` as the server does (`StaffOrdersController` `EnumQueryParameter`) and finds nothing, which is a true answer for a store with no such orders.
- `StaffOrderDetail.channel` was widened too, which §8.2 does not name. It is correct under ADR-FE-185 and §20.2, because the detail's server field is the same `Channel` string.
- The one consequence is the untested label in the last LOW above.

New routes, nav and guard wiring: NONE MISSING. `/staff/fulfilment/riders` is the only new route.
- Session guard: it inherits `StaffSessionGuard`, `IdleLock` and `StaffShell` from `app/(staff)/layout.tsx`. There is no middleware and no route-to-role table in `web/`; the server's 403 decides, as for the pick list.
- Permission: `RidersPage` renders `AccessRefusedState`, which gives `PermissionDeniedState` (§11.3.10) or the branch banner for a branch refusal.
- Nav: none, by OQ-9 and §12. `/staff/fulfilment/*` matches no sidebar link (`staff-nav-groups.ts:126-136`), so no sidebar item is highlighted, the same as the pick list today.
- Tabs: `StaffOrdersTabs` shows on the page with no current tab, since the route is not one of its entries. The report discloses this. It is cosmetic, and adding a tab would stretch OQ-9.
- Links: from the dispatch dialog with no active riders, and from the pick list's action row, not strictly its header. Both only for `Riders.Manage` holders, as a hint.
- Guards: `tests/guards/ordering-scope.ts` already walks `app/(staff)/staff/fulfilment` and `components/fulfilment`. The mock handlers are in existing, registered arrays.
- Still owed elsewhere: axe coverage (MEDIUM above), and the new GETs in `mock-vs-real.contract.test.ts` at integration (§12).

Report differences (x), checked against src/: ALL HOLD.
- Pick list: `StaffOrderQueryHandlers.cs:215-216` lists Confirmed and Packing only, and the mock matches (`staff.ts:1027`).
- Rider name: `RiderCommandHandlers.cs:18,45` compare with `==`, and `OrderingConfigurationConfigurations.cs:88` is a plain unique index. There is no citext or collation in the configuration or in `src/` outside migrations, and no citext or collation on the rider lines I grepped in the migration. I did not read the name column's own line in the migration, so case-sensitivity rests on these.
- `CourierNotFound`: in `NotFoundCodes` (`OrderingResults.cs:15-21`), so a 404.
- Orders.View: all five roles (`ActionRoles.Orders.cs:13`). The panel's absent state (`DashboardPipeline.tsx`) comes only from a 403 or a failed read. A branch refusal is also a 403.
- Report item 5 (tile order) is display order in a mock; the tile's name, roles and figure labels match `DashboardTiles.cs:20` and `DashboardTileSources.cs:217-246`.

§11.3 item by item:
- 11.3.1, 11.3.2: built. Citations I sampled are correct to the line: `StaffOrderViewModels.cs:12-13,19,27-30,38,40-45,68-70`, `RiderViewModels.cs:4`, `PosViewModels.cs:12-17`, `SalesSeriesViewModels.cs`, `OrderQueryHandlers.cs:20`, `ActionRoles.Orders.cs:26`, `OrderChannel.cs:8`. Key difference: LOW above.
- 11.3.3: built. Bars, readout, server `total`, table, absent on 403 or failure.
- 11.3.4: built. Four statuses, links, server `total`.
- 11.3.5: built by mock only, as specified.
- 11.3.6, 11.3.7: built.
- 11.3.8: built, with the full-page gap above.
- 11.3.9: built. Riders disabled also when the read fails, an addition the report discloses.
- 11.3.10: built, `ResponsiveTable` by (y).
- 11.3.11, 11.3.12: built.
- 11.3.13: built without "Add customer" (MEDIUM above).
- 11.3.14: built, with code-over-document points under (x).
- No element was dropped for want of data. G4b (no note on the packing slip) stays in the residual gaps, and the packing slip page is unchanged.

§4.3 forbidden shapes: NONE FOUND.
- Money arithmetic: none in added `app`, `components` or `lib` lines. The change preview is `quote.changeDue` / `quote.cashShort` (PosScreen.tsx:92, PosTenderPanel), shown only while the quote on screen is for the cash typed. `cashForQuote` tests the typed text by regex and does no maths. Mocks are the server by rule (`ordering-scope.ts`).
- Colour literals, storage, fetch: an added-line sweep found no hex, `rgb(`, `hsl(`, `localStorage`, `sessionStorage` or `fetch(`. Hooks stay in `lib/hooks`. Classes are tokens; `accent-[var(--accent)]` reads a token and has 25 existing uses.
- Dependencies and `globals.css`: unchanged.
- Subscription surface: only the type widening, the display label through `orderChannelLabel` (StaffOrderQueue.tsx:71, StaffOrderDetail description) and the mock filter name. The channel select still offers only Online and Counter. No `/subscriptions` call and no `isSubscribable`. OQ-11 holds.
- Mock role check: `lacksRole` passes a request with no staff session, as the other mocks do.

ADRs:
- ADR-FE-185: met apart from the citation LOW. Mocks gained the refusals I sampled (dispatch, riders, picked, packed, sales series, quote).
- ADR-FE-188: MET. The only conversion is `toChartNumber(day.net)` (DashboardSalesChart.tsx:35), the same function `ReportChart.tsx:56` uses, and its result goes only to `barShares` and the bar's height. Every shown figure is `formatMoney` or `AmountCell` on the server's value. Nothing is summed; heading total is `series.total`. The pipeline's `count / peak` is on counts, not money.
- ADR-FE-189: met. Staff pill and bar; label through `orderStatusLabel`.
- ADR-FE-191: met, with the split-payment LOW above.
- ADR-FE-186, 187, 190, 192: other slices.
- ADR-317, ADR-341 and `.ai/read-side-pattern.md`: each screen calls its owner (series from Reporting, counts and riders from Orders, browse from the POS). No client join. The dashboard mock reads the ordering store for the live tile, the one cross-area mock read of that store; the server's tile reads the same orders.

§8.4 state rules: MET.
- Counts: `useStaffOrderStatusCounts` takes the queue's filters without `status` and shares `POLL`. Its key sits under `['staff', 'orders']`, so order writes refresh it. UI-5 holds.
- Ticks: server state, with optimistic update and rollback in `useSetLinePicked`, the message on `InvalidOrderTransition`, and HO-P4's state removed; the overlay is the LOW above.
- POS: category in component state, tender in component state and debounced 400 ms (usePos.ts). The loaded pages sit in the in-memory query cache rather than component state, with nothing in the URL or storage and no query persister in the app. I do not count this as a departure.
- NFR-USA-4: `DispatchTargetInvalid` and `RiderNameAlreadyExists` are not in `lib/api/errors.ts` (S2 may not edit it), so the server's own plain messages show (errors.ts:759; `OrderMessages.cs:21-22`). `InvalidOrderTransition` and the 404s have specific text. No change needed.

CHECKS RUN
- `tsc --noEmit --incremental false` from web/: exit 0.
- `vitest run tests/guards/no-money-arithmetic.test.ts tests/guards/no-card-ui.test.ts --maxWorkers=1`: 2 files, 5 tests passed. These guards do not scan `components/dashboard` or `DashboardPipeline.tsx`, which I checked by hand (§7).

NOT CHECKED (for TEST and later gates)
- Not run: the rest of Vitest, ESLint, Playwright, build, the contract test. No server was started. Screenshots and the 360 px chart trade-off (report line 75) are ACCEPTANCE's.
- Runtime behaviour read but not observed: pill names after load, tick rollback under concurrent clicks (`onError` restores a snapshot that may undo another in-flight tick until the refetch), and `cashTyped` after a voided basket with an amount left in the field.
- Mock-to-server parity was sampled, not exhaustive. Read in `src/`: controllers, view models, the dispatch validator, the rider handlers and aggregate rule, the tile source, the quote handler's change rule. Not opened: `PagingHelper`, `MobileNumber`, `OrderAggregate`, `OrderTransitionRules`, `CompleteCounterSaleCommandHandler`, `EnumerationParsing`, `StaffOrderFilter.Apply`. Those report citations are unverified.
- Test files other than the tab-count and riders greps were not read in full, so the "at least as strong" table in the report is for TEST.
- Architecture docs: I read the openings of `.ai/architecture.md`, `cqrs.md`, `read-side-pattern.md`, `bounded-contexts.md`, `namespace-conventions.md` and `di-registration-guide.md`, the heads of ADR-317 and ADR-341, not the full texts. For ADR-FE-185 to 192 I relied on handover §9 and confirmed they exist in `web/docs/decisions.md`. No `src/` file changed, so the backend layering, aggregate and host rules do not apply to this diff.
- An untracked docs/gates/HO-P5-WIRING-S2-SECURITY.md appeared in the worktree during this run. It is another gate's file; I did not read or touch it.
