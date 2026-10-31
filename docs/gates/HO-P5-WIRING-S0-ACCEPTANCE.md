GATE: ACCEPTANCE
HANDOVER: HO-P5-WIRING (slice S0)
COMMITS: b32012f 54950d6 99f5c30 a3416f9 238b1f7 00ea533 707433a bb647e4 fabce37 41d5e08 c422d2a 0ae5cc9 818982f (base cda20c4, HEAD 818982f, branch feat/p5-s0-contract)
DATE: 2026-10-31
STATUS: FAIL

Run 1. One criterion is not met: A21, the Vitest part. No defect in S0's code was found. The fix is a green run or an owner amendment, not a code change (see OWNER DECISIONS).

PRIOR GATES (from docs/gates/ and docs/test-cases/, not from commit messages)
- ARCHITECTURE: run 1 FAIL (in git at 707433a), run 2 PASS. The record says HEAD bb647e4; fabce37 only commits the record (`git diff bb647e4 fabce37` is that one file).
- SECURITY: PASS, at fabce37.
- CODE_REVIEW: PASS, at 41d5e08.
- TEST: NOT a recorded PASS. The status reads "PASS for S0-introduced defects, with one caveat", and row T3 is FAIL. The record's qualifier is its own opinion and has no support in the handover. This alone forbids an ACCEPTANCE PASS.
- Sheet TC-HO-P5-WIRING-S0.md: recounted, 44 rows: 39 PASS, 1 FAIL, 4 BLOCKED, 0 NOT RUN. It matches its summary.

CRITERIA (S0 is the slice for A1; A18-A21 apply to "all"; A2-A17 are S1-S4; A22 is a recorded non-goal)
- A1 MET.
  - Tracker: web/lib/orders/tracker.ts:23 `Packed: 'Packing'`. tests/unit/orders/tracker-packed.test.ts asserts five nodes, done/done/current/future/future, on delivery and pickup. I read it and ran it alone: 4/4.
  - `ORDER_STATUSES`: web/lib/api/my-orders.ts:34, adjacency asserted in the same file.
  - Labels: web/lib/format/orders.ts (`Packed`, `MarkPacked`, `Subscription`), web/components/portal/dashboard/labels.ts:26, web/components/orders/OrderStatusBadge.tsx:29. status-vocabulary.test.ts ran alone 8/8; order-status-badge-packed.test.tsx ran alone 3/3.
  - Seeds: `seedOrders` and `seedRiders` in web/mocks/handlers/ordering/store.ts (`...112` Packed with all lines picked, `...113` Dispatched COD with rider and null courier, rider note on the delivered order, 2 active + 1 inactive riders); web/mocks/handlers/shop/fixtures.ts (districts, two Was prices, one expired and one valid certificate).
  - U4's "ids and amounts unchanged": the test does NOT assert amounts (status of 6 old orders plus a count). The evidence is the seed comparisons recorded by ARCHITECTURE and by TEST U4f, and my own reading of the diff. In store.ts the only removed lines are `PERSIST_KEY` and the `courierId` type. In fixtures.ts they are the `GENERATED_LINES` reformat, with names and tags unchanged, and the GUR-1KG sku line, with its price unchanged.
  - ADRs: web/docs/decisions.md:1990-2046, eight headings, confirmed by grep.
  - Split: 16 `it` in the old file at cda20c4; 6 + 5 + 5 in the new files, recounted. Suite totals agree: HO-P4 had 208 files and 1910 tests (1852 + 13 + 45). S0 run 1 has 213 files and 1926 tests, which is +16 from S0's own new cases (4 + 8 + 3 + 1).
  - E1: TEST chunk 1, 60 passed and 0 failed. That matches 30 `test(` calls (2 + 12 + 16) on two projects. Not rerun by me.
  - "Everywhere" is read with Amended (b). A grep of `'Packing'` across app, components, lib and mocks leaves only MyOrderDetail.tsx (S1), StaffOrderQueue.tsx (S2) and ordering/staff.ts (S2 §11.3.14). No site is unowned.
- A18 MET for S0's part. The back-up `rg` over components and app returned 0 hits (run by me). no-colour-literals and no-hex-literals passed (TEST U46). The a11y rows it names (E6, E12, E16, E19) belong to other slices and to integration.
- A19 NOT APPLICABLE to S0, and vacuously held. S0 changes no handler file and adds no mocked input. A grep shows no handler, lib or component reads the new seed fields, apart from the type-only `riderNote?` at my-orders.ts:89.
- A20 MET. See SCOPE. Nothing subscription-shaped (the one `Subscriptions` hit in added lines is a moved absence assertion); no src, config, package or lock file in the diff.
- A21 NOT MET (S0 part).
  - typecheck T1, lint T2 and build B1: met, as recorded by TEST at 0ae5cc9.
  - Vitest: not met. No full run passed: run 1 had 3 failed, run 2 had 5 failed (T3). See Question 2.
  - The "full e2e" half is integration (evidence column names E18; §17.1 step 5), so it is not evaluated here.
- A22: the recorded non-goal holds. No subscription work.

AMENDED (a)-(h), checked against the diff
- (a) MET: only `Packed` added in OrderStatusBadge.tsx:29 (plus the `Box` import), AccountSidebar.tsx:30 and LiveOrderCard.tsx:13.
- (b) MET: MyOrderDetail.tsx, StaffOrderQueue.tsx and shop/store.ts are untouched, as S1 and S2 own them.
- (c) MET: the new fields are optional in store.ts. `packedOn` is also optional, which (c) does not name (ARCHITECTURE LOW; no conflict).
- (d) Not independently opened. I relied on the 54950d6 commit body and ARCHITECTURE's line-by-line check.
- (e) MET: both test files are in the diff and cover only `Packed`.
- (f) MET: labels.ts:26 is one line.
- (g) MET: the status-vocabulary case asserts more than half of food products have a district; ARCHITECTURE counted 30 of 45.
- (h) MET: LiveOrderCard.tsx:19, and the one case in order-status-badge-packed.test.tsx:34-37.

QUESTION 1: 0ae5cc9 (Packed headline). In scope. No earlier gate needs rerunning.
- Amended (h) landed at c422d2a, before the code at 0ae5cc9. It names this exact line, this wording and this test file. I can confirm it is recorded as owner-ratified; I cannot verify the ratification beyond that record.
- The diff (`git diff c422d2a..0ae5cc9`) is one static string, one test case, a `vi.mock` of `useMyOrder` and two import changes the case needs. No other test in that file renders the mocked hook.
- ARCHITECTURE: both files were already in scope; nothing structural changed. Its LOW on this line is now resolved.
- SECURITY: a literal constant rendered as React text at LiveOrderCard.tsx:52. No data, storage or authorisation surface.
- CODE_REVIEW: this gate specified the fix and the wording, as its own MEDIUM.
- TEST ran at 0ae5cc9 (G4), with a mutation check (G5). 818982f adds only the TEST record and the sheet (`git diff --name-only 0ae5cc9 HEAD`).
- No handover text requires a rerun for a change this small; this is my judgement against each gate's §19 focus, stated so it can be challenged.

QUESTION 2: Vitest. The handover's wording requires it to pass. It does not accept this result.
- A21: "typecheck, lint, Vitest and build pass; full e2e shows only the 12 baseline failures". Its slice is "all". Its evidence names §17.2, and §17.2 "Per slice" lists `npm test`; §17.1 step 4 has each slice run that list before its gates.
- §15: "Existing tests stay green without weakening an assertion". §5: "The `web/` baseline green apart from the 12 known e2e failures (§1)".
- HO-P5 contains no Vitest exception. A grep for "flaky", "load timeout" and "pass alone" finds none. HO-P4's A18 read "pass, apart from the known timing-flaky files recorded at baseline", and HO-P2 had the same carve-out. HO-P5's A21 dropped those words. The HO-P3 and HO-P4 acceptances are therefore no precedent for this wording.
- The earlier record is not complete cover either:
  - goods-receipt-form, shared-pieces: recorded as load timeouts in HO-P3 and HO-P4.
  - receiving-layout: recorded in HO-P4, where ACCEPTANCE noted it could not be on a baseline list.
  - tests/components/staff/idle-lock.test.tsx: no record as a Vitest load timeout in HO-P3 or HO-P4.
  - The "pointer-events race" TEST describes is not a timeout, and TEST did not say which test showed it.
  - HO-XCT-002-TEST.md records goods-receipt-form U-C6 failing once when run alone. "Passes alone" is therefore not always true of that file.
- In S0's favour, as facts rather than as a waiver:
  - I ran each file alone at HEAD: idle-lock 13/13, shared-pieces 17/17, receiving-layout 3/3, goods-receipt-form 7/7. That reproduces TEST's 33/33 and 24/24.
  - `git diff cda20c4 HEAD` touches no inventory or back-office-stock path.
  - I found no route from S0's change to these failures, but no comparison run at base exists.

QUESTION 3: The four e2e results. The wording does not allow them, and it does not settle whether they count against S0. Owner decision.
- §1: "Any other failure, or any of these failing in a new way, blocks". There is no qualifier for load, rerun or slice.
- §20.8 does not help. It covers crashes ("worker exit 0xC0000142, `next dev` heap errors at low memory, a stuck port") and asks to "rerun the chunk at `--workers=1`". These were test failures, not crashes, and TEST reran the tests rather than the chunks.
- These four are not in any S0 row. S0's e2e is E1 only (§16, 60 passed, 0 failed). ordering-customer.spec.ts is S1's E5 and shop-staff.spec.ts is S3's E10, both "may change". The run was the TEST gate's added row X1, and A21's full e2e is integration. So no S0 §18 criterion is unmet by them.
- Evidence they are unrelated to S0, which is a reason and not a waiver: :66/:146/:166 are basket and checkout flows; shop-staff :137 is review moderation; no handler reads a new seed field; they passed alone (recorded by TEST, not rerun by me). HO-P4 TEST lists shop-staff E-C1 and ordering-customer E-B1/E-B5 as similar load failures, though not these exact cases.
- Deviation in the run: §16 requires "a fresh `next dev` per chunk". The sheet says the server restarted once, between chunks 2 and 3, so chunk 2 (three of the four results) ran on chunk 1's server. Chunk 3 was on a fresh server and shop-staff :137 still failed.

QUESTION 4: No S0 criterion requires the customer-side Packed headline on a real screen.
- A1's evidence column is "U1-U4, E1". E1's expected result is "Pass (the tracker and status vocabulary change breaks nothing)", which does not involve a Packed order. Amended (h) asks for "one case" in a component test. G4 asserts the heading and G5 shows it fails when the entry is removed.
- X3 stays BLOCKED and is not counted as a pass. It does not affect the verdict.
- Correction to the sheet: X3 and the TEST record give "S1's seeds" as the unblock. §13 does not support that. ordering/store.ts is S0's ("A slice that needs another seed field raises §20.1; it does not edit the store"), and mocks/handlers/portal/** is in no §13 block, so §14 forbids it. No §16 row asks for this either. So nobody will prove it on a screen unless the owner assigns it. See CARRY-FORWARDS.

OWNER DECISIONS
- D1 (Vitest; closes A21 for S0). Either route clears it:
  - (i) A full `npm test` at S0 HEAD with zero failures, recorded by TEST with any flags used. A21 does not fix concurrency, so in my reading a lower worker count (for example `npm test -- --maxWorkers=2`) still counts. No config change is allowed (§12).
  - (ii) A §1 Amended row. Suggested wording, for the owner to accept or change: "A21's Vitest requirement and §17.2's `npm test` accept, for S0, a full run whose only failures are in `tests/components/staff/idle-lock.test.tsx`, `tests/components/inventory/shared-pieces.test.tsx`, `tests/components/inventory/goods-receipt-form.test.tsx` and `tests/components/back-office-stock/receiving-layout.test.tsx`, each passing when rerun alone and each reported by name." The owner should also say whether this carries to S1-S4 and integration; otherwise the same question returns at every slice.
- D2 (e2e; §1 "Any other failure ... blocks"). Does this reach a failure in a spec outside the slice's §16 rows that passes when rerun alone? Suggested wording if the answer is no: "A failure under load in a spec outside a slice's §16 rows does not block that slice if it passes when its chunk is rerun on a fresh `next dev` at `--workers=1`. E18 at integration stays exact." If the answer is yes, chunks 2 and 3 must be rerun under §16 and come back clean.
- D3 (§19 screenshots). §19 asks ACCEPTANCE for "screenshots at 360 and 1280 against the matching `.dc.html`". This run was told not to start a browser, so none were taken, and TEST took none either. S0 changes no layout, and the only Packed surface reachable under mocks is the staff order list and panel (X2, observed as text). The owner should say whether S0 is exempt; otherwise this gate must take them on its rerun.

After D1 and D2, TEST must update its record to a plain PASS and ACCEPTANCE must run again. No code change or other gate rerun is needed for this.

SCOPE
- out-of-scope work found: none. `orderChannelLabel` is display only (OQ-11). Nothing from §4.1 is implemented. No §20 condition was worked around in the code.
- files outside allowed scope: none. See SCOPE CHECK.

UNDECLARED DEVIATIONS
- Implementation: none found. Commit messages declare the split and the key bump; every waiver is an Amended row. I was given no §17.3 slice report, so I could not compare against one.
- TEST gate run: the §16 "fresh `next dev` per chunk" breach (Question 3). The sheet states the restart but does not flag it as a deviation.

CARRY-FORWARDS
S0, before it can pass:
- D1, D2, D3 above. S1-S4 cannot branch until S0 merges (§5, §17.1).
S1:
- MyOrderDetail.tsx: `Packed` at :68, :105, :112, :161, :194 (Amended (b)). Until then a Packed order gets no hero there (:104).
- Bump `PERSIST_KEY` in mocks/handlers/shop/store.ts (Amended (b), §11.1.2).
- Keep `organicCertificateExpiresOn`, `organicCertificateFileId` and `scheduledCompareAtCents` out of the public builder (SECURITY).
- Turn `compareAtCents` into `{ amount, currencyCode }` by string formatting, without arithmetic (CODE_REVIEW LOW).
- Check the rider note renders as text and stays out of URLs and storage (§19 SECURITY, not testable at S0).
- The Packing caption shows when Packing began, not when the order was packed; pinned by tracker-packed.test.ts. Raise it if design wants the packed time.
S2:
- StaffOrderQueue.tsx:49-50 (Amended (b)).
- ordering/staff.ts: `allowedActionsOf` :96-105 returns nothing for Packed; the cancel, dispatch and ready-for-collection handlers at :532, :563, :595 and the pick list at :726, :751 do not accept Packed; `MarkPacked` exists nowhere yet. Under mocks, the seeded Packed order currently has no actions (X2).
- Rider responses must return only `{ id, name, mobileNumber, isActive }`, never `branchId` (SECURITY). Rider mobile numbers stay behind `Orders.Fulfil` and `Riders.Manage`.
- `picked`, `pickedOn` and `pickedBy` stay out of `orderLineView` in customer.ts, which pos.ts also imports (SECURITY).
- `orderChannelLabel` has no caller until S2 uses it. Widen `StaffOrderRow.channel` (§8.2). ADR-FE-188 limits number conversion to bar length.
S3:
- The same staff-only field rule for fixtures' certificate and scheduled-price fields.
S1 and S2 together:
- A further seed goes through §20.1, not a direct edit. status-vocabulary.test.ts has `toHaveLength(13)`, `toHaveLength(1)` for Packed and riderNote, and `toHaveLength(2)` for compareAt, so added seeds will break it. That file is in S0's block; the integrator must route the change.
- Strengthen U4's "amounts kept" case (TEST and CODE_REVIEW suggestion), because its title claims more than it asserts.
- Customer-side Packed on a real screen has no owner (Question 4). If wanted, it needs an Amended row naming the portal fixtures and an ordering-store seed.
Integration:
- E18 full e2e, exactly the 12 baseline failures; E19 `sweep:a11y`; the A21 full set.
- Add the new GETs to tests/contract/mock-vs-real.contract.test.ts and run `test:contract` if a scratch API exists (§12, §17.1).
- Add the ADR row to docs/handover/README.md (§9).
- Real-API specs, not run by anyone so far.
- Decide on hardening for web/public/mockServiceWorker.js (SECURITY LOW, still served).
Small items left open by earlier gates, no owner assigned:
- Dead exports `certificateValidSlug` and `certificateExpiredSlug`; the certificate file id equals a stock alert id (CODE_REVIEW LOW).
- New seed orders carry Sam's `customerMobile` (CODE_REVIEW LOW).
- ADR-FE-186 lacks "Amends"; ADR-FE-190 and -191 say "Supersedes" (ARCHITECTURE LOW).
- Handover wording: §5 still lists OQ answers as open; §14 has no carve-out for docs/gates and docs/test-cases; Amended (d)'s "U15" label (ARCHITECTURE LOW).

NOT CHECKED
- Full Vitest, tsc, lint, build, Playwright: not rerun (instructed). Those results are TEST's record. I reran 3 S0 test files and the 5 named flaky files, each alone.
- account-sidebar.test.tsx and overview-*.test.tsx: read or counted, not rerun.
- The TEST seed comparison and the X2 and X3 probes used temporary files that were deleted, so they cannot be re-executed from the repo. I checked the diff instead.
- Screenshots (D3). The owner ratification of each Amended row beyond its text in §1 and in commit messages. Any §17.3 slice report.

FINDINGS
- [HIGH] docs/handover/HO-P5-WIRING.md:677 — A21 requires Vitest to pass, with no exception; T3 shows no green run in two attempts. Not an S0 code defect on the evidence available. See D1.
- [HIGH] docs/gates/HO-P5-WIRING-S0-TEST.md:5 — the status is not a plain PASS, which §19 and this gate's rules require. See D1, D2.
- [MEDIUM] docs/handover/HO-P5-WIRING.md:75 — "Any other failure ... blocks" has four results outside the baseline and no rule for reruns or for specs outside the slice. See D2.
- [MEDIUM] docs/test-cases/TC-HO-P5-WIRING-S0.md:26 — chunks 1 and 2 shared a dev server against §16's "fresh `next dev` per chunk".
- [LOW] docs/test-cases/TC-HO-P5-WIRING-S0.md:70 and :106 — X3's unblock names "S1's seeds", which §13 and §14 do not allow.
- [LOW] web/tests/unit/orders/status-vocabulary.test.ts:67 — case title claims "amounts kept" with no amount asserted. Carried from earlier gates.

SCOPE CHECK
- files in allowed scope: 19/19 implementation files in `git diff --name-only cda20c4 HEAD` (§13 S0 block 10, split-created 2 at handover lines 417 and 492, Amended (a) (e) (f) (h) 6, handover 1: only line 76 differs from base). Plus 5 gate and sheet artifacts, which §14's `docs/**` row does not carve out but the gate definitions require (same reading as ARCHITECTURE).
- files outside allowed scope: none
- written by this gate: docs/gates/HO-P5-WIRING-S0-ACCEPTANCE.md only. Nothing committed; no dev server or browser started.
