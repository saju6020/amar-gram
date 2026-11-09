# TC-HO-P5-WIRING-S0 — Shared contract and seeds (Packed, riders, district and certificate seeds)

Handover: docs/handover/HO-P5-WIRING.md (S0: §8.2, §11.1, §15 U1-U4 and U46, §16 E1, §17.2, §18 A1, §1 Amended (a)-(h))
Commit(s) under test: feat/p5-s0-contract, HEAD 0ae5cc9, diff base cda20c4
Written: 2026-10-31 (before any command ran)  ·  Executed: 2026-10-31

> Statuses record what was **observed**, not inferred. The Evidence column names what was actually
> seen. `BLOCKED` marks a case that could not be executed or whose result was reasoned about rather
> than watched. The handover's U-rows are prose rows; IDs keep the handover's U1-U4/U46/E1 and add
> sub-letters (U1a...) and gate-added rows (G*, B*, X*, T*), which I assigned.

## Summary

| | Count |
|---|---|
| Total | 44 |
| PASS | 40 |
| FAIL | 0 (T3 failed at the default worker count, passed at `--maxWorkers=2`; see its evidence) |
| BLOCKED | 4 |
| NOT RUN | 0 |

## Environment

- Windows 11, Node via npx, Vitest 5.0.1, Playwright. HEAD 0ae5cc9, tree clean apart from this sheet and `.claude/worktrees/`.
- Free virtual memory before e2e: about 12.9 GB (of 40 GB commit). No 0xC0000142 crash occurred.
- `next build` run first, `.next` deleted, then `next dev` on :3120 with NEXT_PUBLIC_USE_MOCKS=true and NEXT_PUBLIC_API_BASE_URL=http://localhost:5005. Dev server restarted once (between chunk 2 and 3). Routes warmed with curl before each start. Playwright `--workers=2` for chunks, `--workers=1 --retries=0` for reruns; `--max-failures=20`.
- Projects: chromium and mobile-360. No backend API reachable (real-API specs BLOCKED).
- Dev server and all Playwright/chrome processes I started were killed at the end; nothing listening on :3120.

## Unit cases

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| T1 | `tsc --noEmit` over web/ | exit 0 | PASS | exit 0, also with `--incremental false -p .` |
| T2 | `eslint . --max-warnings 0` | exit 0 | PASS | exit 0, no output |
| T3 | Full Vitest suite | no failure | PASS | At `--maxWorkers=2` on 8eda79a (docs only since 0ae5cc9): exit 0, 212 files passed, 1 skipped, 1881 tests passed, 45 skipped, 0 failed. Earlier at the default worker count, not green: Run 1: 3 failed / 1878 passed / 45 skipped (213 files; idle-lock, inventory/shared-pieces, back-office-stock/receiving-layout). Run 2: 5 failed / 1876 passed / 45 skipped (goods-receipt-form x4, shared-pieces x1). Different tests each time; every failing file passes alone (33/33 and 24/24). No failing file is touched by the S0 diff (`git diff cda20c4 HEAD` on those folders is empty). Timeouts and a `pointer-events: none` race under load: environmental, same pattern HO-P4 recorded. |
| U1a | Tracker for Packed, Delivery | 5 nodes, done,done,current,future,future; not null | PASS | `tracker-packed.test.ts` passed in the selected run |
| U1b | Tracker for Packed, Pickup | same | PASS | same file, passed |
| U1c | `ORDER_STATUSES` has Packed between Packing and Dispatched | adjacent | PASS | passed |
| U1d | Packing caption is the time the order entered Packing | matches pin | PASS | passed |
| U2a | Labels `Packed`, `MarkPacked`, channel `Subscription` | "Packed", "Mark packed", "Subscription" | PASS | `status-vocabulary.test.ts` U2 passed |
| U2b | Every pre-existing label unchanged | exact list | PASS | passed |
| U2c | Portal tile label for Packed | `{label:'Packed', tone:'success'}` | PASS | passed |
| U3 | Split keeps the case count | 16 `it` before and after | PASS | `git show cda20c4:...overview.test.tsx` has 16 `it(`; new files ran 6 + 5 + 5 = 16, all passed (27/27 across the selected run incl. other files) |
| U4a | One Packed order, all lines picked, packedOn set | pass | PASS | passed |
| U4b | Two active, one inactive rider at main branch | pass | PASS | passed |
| U4c | One dispatched COD order with a rider, courierId null | pass | PASS | passed |
| U4d | One order with a riderNote (the delivered one) | pass | PASS | passed |
| U4e | Shop fixtures: shared district, one without, 2 Was prices, 1 expired + 1 valid certificate, districts on > half of food | pass | PASS | passed |
| U4f | Pre-existing ids AND amounts unchanged (the existing test asserts no amounts) | identical to cda20c4 | PASS | Gate-run comparison, temp files since deleted: loaded `store.ts` and `fixtures.ts` from cda20c4 and HEAD side by side. 11 old orders compared as full objects (timestamps normalised, rider-related fields dropped): no difference; `moneyEqual=true` for status, subtotal, grand total, amount paid and each line's quantity, unit price and line total; orders old=11, new=13. 51 old products compared with the five new fields dropped: equal. The existing test itself asserts status for 6 of 11 old orders and `toHaveLength(13)`, no amounts: weak, see report. |
| U46 | Colour-literal guards and the `rg` back-up check | no hit | PASS | `no-colour-literals.test.ts` 2/2 and `no-hex-literals.test.ts` passed; `rg` over components and app printed nothing |
| G1 | `OrderStatusBadge` Packed: label and own icon | pass | PASS | `order-status-badge-packed.test.tsx` 3/3 |
| G2 | `newestOpenOrder` treats Packed as open | pass | PASS | same file |
| G3 | `AccountSidebar` counts a Packed order "on the way" | pass | PASS | `account-sidebar.test.tsx` 6/6 |
| G4 | LiveOrderCard headline "Order ORD-1 is packed" | pass | PASS | same badge file |
| G5 | Mutation: remove `HEADLINES.Packed`, G4 must fail | fails | PASS | Deleted the line; G4 failed ("Unable to find ... heading ... Order ORD-1 is packed"), 2 others passed; file restored with `git checkout`, tree clean |

## Integration cases

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| B1 | `next build` completes | exit 0 | PASS | exit 0, 1m15s |
| B2 | No mock handlers or seed data in the production output | zero hits in `.next` output | PASS | grep over all `.next` js/json/html/rsc/map: 0 files for `__purrcare_ordering_mock_db__` and `__purrcare`, Rafiq Hasan, Jahid Alam, Kamal Mia, Mizanur Rahman, Shirin Akter, order id `...112`, the rider-note text, BOC-2026-0142, Bangladesh Organic Council, Sam Rahman, Nolen Gur Sandesh, Chapainawabganj, setupWorker, createWorker, "Our delivery rider", rider mobile. Only hits: "Kalijira Rice" and "msw/browser" in `.next/cache/webpack/*-production/0.pack` (the build cache, not served output; "Kalijira Rice" is in source at `components/catalogue/ProductCard.tsx`, not a seed). `mockServiceWorker` / `NEXT_PUBLIC_USE_MOCKS` appear in 2 layout chunks only as the guard call with `nodeEnv:"production"` inlined. |
| B3 | `public/mockServiceWorker.js` served, known LOW | present, no seeds | PASS | File present (msw 2.15.0), tracked, not git-ignored; 0 matches for Rafiq, the retired brand name, Kalijira. Confirms the SECURITY LOW as stated. |
| E1a | `ordering-customer-orders.spec.ts` | pass | PASS | chunk 1: 60 passed with E1b and E1c (both projects, 2 workers, no failure) |
| E1b | `portal-dashboard.spec.ts` | pass | PASS | same chunk |
| E1c | `ordering-staff.spec.ts` | pass | PASS | same chunk |
| X1 | Specs the seeds could move | pass or baseline | PASS | Chunk 2 (shop-catalogue, shop-product, shop-home, shop-shell, ordering-customer): 61 passed, 4 skipped, 2 failed + 1 flaky, all in ordering-customer (:166 chromium, :66 mobile-360, :146 mobile-360 flaky). Rerun alone, 1 worker, warm, no retries: all 3 tests on both projects 6/6 pass. Chunk 3 (ordering-pos, dashboard-home, account-area, portal-a11y-responsive, shop-staff): 71 passed, 1 failed (shop-staff :137 E-C3 mobile-360); rerun alone both projects 2/2 pass. None is on the baseline list; all environmental. |
| X2 | Seeded Packed order visible on a real screen under mocks | visible, labelled | PASS | Throw-away probe spec (deleted): staff `/staff/orders` at 1440 px shows `ORD-2026-000112 ... Mizanur Rahman Delivery Packed ... ৳3,310.00 ... Cash on delivery`; selecting it opens the panel headed "Order ORD-2026-000112 Packed" with history ending "Packed · Sat 31 Oct, 11:52". The panel offers no action button (staff mock returns no actions for Packed: S2 hand-off). `ORD-2026-000113` shows Dispatched. |
| X3 | LiveOrderCard Packed headline visible on a real screen under mocks | visible | BLOCKED | Probe as the e2e customer (Sam): `/portal` live card shows the Awaiting-payment order only; `/portal/orders/<...112>` says "We can't find that order" (owned by another customer). The portal overview comes from the separate portal fixtures, which hold no Packed order. So the headline is covered by the unit render (G4, G5) only, never on a real screen under mocks. Under §1 Amended (k) no slice owes this on a real screen, so it stays BLOCKED and is not counted as a pass. `/portal/orders` contains the word "Packed" (I did not isolate the element; likely the status filter built from `ORDER_STATUSES`). |
| X4 | ADR-FE-185 … 192 present in `web/docs/decisions.md` | all 8 | PASS | headings found at lines 1990, 1998, 2006, 2014, 2022, 2030, 2038, 2046 |
| E18 | Full e2e | handover assigns to integration step | BLOCKED | §16 E18 and §17.2 "integration"; S0's per-slice list is E1. Not started (over 3 h here). |
| E19 | `npm run sweep:a11y` | integration step | BLOCKED | §16 E19, integration only; not run. |
| E-real | `*-real-api`, `journey-real-api`, `real-api-verification` | need backend | BLOCKED | No API reachable. |

## Regression cases from earlier gates

| ID | Gate | Finding | Case | Status | Evidence |
|---|---|---|---|---|---|
| R1 | ARCH run 1 HIGH | sidebar and badge tests out of scope | G1-G3 | PASS | all passed |
| R2 | ARCH run 1 MEDIUM | portal map lacked Packed ("Status unavailable") | U2c | PASS | passed |
| R3 | ARCH run 1 MEDIUM | too few food districts | U4e | PASS | passed (> half of food) |
| R4 | CODE_REVIEW MEDIUM | LiveOrderCard "is open" for Packed | G4, G5 | PASS | G4 passed; G5 mutation made it fail |
| R5 | CODE_REVIEW/ARCH LOW | U4 asserts no amounts | U4f | PASS | runtime comparison above shows amounts unchanged; the test itself is still weak |
| R6 | CODE_REVIEW | added seed orders and districts move no existing spec | X1, E1a-c | PASS | 3 E1 spec files directly, 10 more spec files in X1; only load-related failures, each passing alone |
| R7 | SECURITY LOW | mockServiceWorker.js served | B3 | PASS | observed as stated (still LOW, unchanged) |
| R8 | SECURITY NOT CHECKED | mock code absent from production bundle | B2 | PASS | build output inspected |

## Acceptance-criteria coverage

| Criterion | Covered by | Status |
|---|---|---|
| A1: tracker shows Packed on the Packing node | U1a-d, E1a | PASS |
| A1: labels exist | U2a-c | PASS |
| A1: mock seeds it | U4a-f, X2 | PASS |
| A1: ADRs 185-192 recorded | X4 | PASS |
| A1: test split with unchanged count | U3 | PASS |
| A21 (S0 part): typecheck, lint, Vitest, build pass | T1, T2, T3 (`--maxWorkers=2`), B1 | PASS |
| §16 E1: three run-only specs pass | E1a-c | PASS |
| Amended (h) Packed headline | G4, G5 | PASS (unit only, X3 BLOCKED) |

## Cases I could not run

| ID | Why | What would unblock it |
|---|---|---|
| X3 | No Packed order is reachable by the e2e customer under mocks | Nothing owed: §1 Amended (k) keeps this to the component test |
| E17 | Not a slice gate row under §1 Amended (l); not run on S0 and not counted in the Summary | E18 on the merged branch |
| E18 | Integration step, over 3 hours | Integration run on the merged branch |
| E19 | Integration step | Integration run |
| E-real | No backend | Start the API, `npm run test:e2e:real-api` / `test:e2e:journey` |

## Gaps left deliberately

| Gap | Why not covered | Suggested owner |
|---|---|---|
| `status-vocabulary.test.ts` U4 amount assertion | Test files are the implementer's; gate does not edit tests it did not own. Suggest snapshotting `grandTotalCents` and status for all 11 old ids, and replacing `toHaveLength(13)` / `(1)` / `(2)` with lookups by id | S0 implementer or S2 |
| Specs that read orders/products beyond the 16 spec files run | Full e2e is the integration step | Integration |
| Persisted `PERSIST_KEY` for the shop mock not bumped in S0 | By Amended (b), S1 | S1 |
