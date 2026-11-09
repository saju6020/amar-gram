GATE: ACCEPTANCE
HANDOVER: HO-P5-WIRING (slice S1, store front)
RUN: 1
COMMITS: 44a53c7 2074711 b3ab577 4451483 1916533 33b99fb b49afaf 460cd27 e6956c0 9169e55 f885f5c 17002b0 310c515 fa49272 and the merges from the integration branch (merge-base b05175d, HEAD fa49272, branch feat/p5-s1-store-front)
DATE: 2026-11-01
STATUS: PASS

Every §18 row that applies to S1 has evidence. This PASS covers S1's gates only. E17, E18, E19, the contract run and every real-API spec are still owed at integration, and no gate has shown them to be good. Three matters need the owner (OWNER DECISIONS below). None of them is a defect in S1's diff, and none blocks this gate.

PRIOR GATES (read from docs/gates/ and docs/test-cases/)
- ARCHITECTURE: PASS (run 2, at b058708). SECURITY: PASS (at 1916533). CODE_REVIEW: PASS (at 1916533). TEST: PASS (integrator update of run 5, at 2805a80 code).

THE TEST RECORD'S PASS
The evidence supports PASS. I did not take the integrator's word for it.
- Run 5 as reported was FAIL on E6e, portal-dashboard.spec.ts:66 on mobile-360. The record keeps that failure and says who changed the status.
- I reran it at HEAD fa49272 under Amended (ae): fresh `next dev` on :3121 after deleting .next, four portal routes warmed, `--project=chromium --project=mobile-360 --workers=1 --retries=0`: 24 passed, 0 failed, including :66 on both projects (2.1 s on mobile-360). That matches the integrator's reported result.
- `git diff 2805a80 HEAD -- web` is empty, so run 5's other results stand for HEAD.
- `maxInactiveAge: 60 * 1000` is in next/dist/server/config-shared.js:66, as (ae) says.
- The failure is not S1's: the test clicks through to /portal/billing, which S1 does not change, and the same test failed on S1's base in run 2's control at da87b60.
- (ae) changes no assertion and no timeout. It changes which chunk a spec runs in, after the spec failed. That is a legitimate call on this evidence, but it is a run-until-it-fits change and it belongs to the owner to know about: (ac), (ad) and (ae) are integrator decisions, not individually seen by the owner. I cannot verify the delegation beyond the handover's text.
- What this does not show: the 9.5 s compile remains unexplained, and the spec has failed in three long-chunk runs (2, 4, 5). E18 must run it alone, as (ae) says.
- Sheet counts recounted: 97 PASS, 3 BLOCKED, 100 rows. Line 193 disagrees, see FINDINGS.

GATES VERSUS LATER COMMITS
S1's own product changes since each gate:
- ARCHITECTURE (b058708): none. e6956c0 changed tests only.
- SECURITY and CODE_REVIEW (1916533): b49afaf only. I read its product diff. `CatalogueView.tsx` now shows a fixed message by code instead of the server's text, which narrows what is shown. `ShopTopStrip.tsx` gains a zero-threshold string test, with no arithmetic and no new input. `districts` becomes required. The lib and mock lines are citations and comments. ARCHITECTURE run 2 reviewed all of it and TEST ran it (R3, R8, M1, M3). No conclusion of either gate changes. One sentence is now out of date: CODE_REVIEW's "`promiseTakesStrip` is `!!promise?.freeOver`". Amended (w) replaced that, and U10 and R8 cover the replacement. I do not require a rerun.
Shared commits, outside S1's diff:
- 697a636 (Amended (ac)): test harness only. It adds a fetch hold in the e2e `page` fixture, with no app change. It removes a race that hid real overflows, so it made the specs stricter.
- 2a2963c (Amended (ad)): two class-name edits in `ResponsiveTable` and `TableFrame`. No data, no input, no colour literal. Neither component renders on an S1 screen I checked. It touches §14 paths, and (ad) records that. No gate conclusion changes. TEST run 5 ran with it.
- b05175d: handover text only.

BLOCKED ROWS
All three are legitimately non-blocking for this slice. None counts as a pass.
- E4c: non-blocking under Amended (t). I checked its premise: no seed in mocks/handlers/admin/content.ts has placement `Shop` (null, null, Home). Its substitute is real: shell-p5 renders the layout with two banners and asserts both titles below the header and neither in the strip. The clause has never been seen in a browser, and that is accepted by (t).
- E6h: non-blocking under §17.2 ("run only when their environment is configured; record not run"). Consequence: no S1 behaviour has run against a real API. Mock parity rests on reading the code. The check owed is §12's contract run at integration.
- R11: non-blocking. It carries two SECURITY MEDIUMs in `src/`, which §4.3 forbids S1 to touch. The rider-note one still needs a decision, see OWNER DECISIONS.

CRITERIA
- A2 MET. U5, U7a-f, U8, U9a-c read and spot-run (10 files, 339 passed at HEAD). E2b asserts every filtered card carries the district, and E3b passed on both projects in run 5 chunk 1 (80 passed, 0 failed). Seen: district group with server counts, chip, `?district=Satkhira`, 2 cards each with the eyebrow, at both widths; "Grown in Dinajpur" above the producer line at both widths.
- A3 MET as §11.2.3 and U6 define it: the pill shows only when `certifications` includes `CertifiedOrganic`. `Certification.cs:8` confirms the server's display name is that exact string. E2c passed. Seen at both widths. See OWNER DECISIONS D2 on the word "truthful".
- A4 MET. U10a-e, U11, U12a-d, R8 passed. Strip amount is `formatMoney` of the server string, with no arithmetic in the diff (swept). E3c, E4a, E4b passed. E4a asserts axe clean of serious and critical. Seen: strip on home and catalogue at both widths, lead-time sentence at both widths.
- A5 MET. U13a-f, U14, U15a-b, P1, P2 passed; U13c and U13f read and they assert what they claim (no URL or storage, same Idempotency-Key, same note, field keeps its text). E5a passed. Mutations M2 and M2b show each Delivery guard is tested. Seen: placed through the real checkout at both widths, note read back in "Delivering to". Wording is the dt/dd of Amended (u).
- A18 (S1's part) MET. U46 spot-run passed. T6 clean, and my sweep of added lines under app, components, lib found no colour literal. E6 rows all pass under (ae), E6d includes baseline :133 passing. E19 is integration.
- A19 MET. U47-1 to U47-6 passed. I checked the source: ShopCatalogueController.cs:37-39 and PlaceOrderCommandValidator.cs:24 match the mock's order and limits. The NUL difference is ruled by (v).
- A20 MET. See SCOPE CHECK. No `isSubscribable` or `/subscriptions` in added lines.
- A21 (S1's part) MET. At HEAD I reran `npm run typecheck` (exit 0) and `npm run lint` (exit 0). Full Vitest (1941 passed, 45 skipped, 0 failed) and `next build` plus the served-output check are from run 5, at identical web code. I did not rerun them and no raw log survives. The full e2e half is E18.
- A22: recorded non-goal.
- A1, A6-A17: not S1's.

SCREENSHOTS (Amended (j)), at docs/gates/screenshots/HO-P5-WIRING-S1/
I viewed all 24 and compared them with the design files, rendered from docs/design/store/ for the purpose (those renders are not kept).
- Catalogue, Catalogue.dc.html. catalogue-default-1280, catalogue-organic-pill-360: Organic pill top-left of the image and district eyebrow, as drawn. catalogue-district-open-1280, catalogue-district-sheet-360, -ticked-360, catalogue-district-filtered-1280 and -360. Differences: the design draws District first and open. §11.2.4 places it after Origin, which stands. It starts closed, which no document states (D3). A-Z order follows (p).
- catalogue-organic-in-basket-1280: the pills stack without overlap. At 360 the card text had both words but my image scrolled past them, so I deleted it: the pair is UNPROVEN by image at 360.
- catalogue-expired-certificate-organic-1280: D2.
- Delivery strip, Home.dc.html:20, Catalogue.dc.html:19. strip-home-1280 and -360. Same band and text except "in Dhaka", per OQ-2. Wraps to two lines at 360 with no overflow (scrollWidth 360). On phones the strip runs into the leaf header, which S1 did not change.
- Checkout, Checkout.dc.html:68-70. checkout-rider-note-typed-1280 and -360, -empty-360, -settled-360. Same label, placeholder and position, last in section 3. Differences: the input is the site's pill shape, not the design's 12 px corners; the counter is §11.2.8's. "Place order" looked disabled in my first images: sampled, it enables about 1.3 s after the choice as the quote returns, and typing does not affect it (true before and after typing, both widths).
- Order detail, MyOrders.dc.html. The design draws no rider note (OQ-7) and has its own Packed step, which ADR-FE-189 maps to the Packing node. order-confirmed-note-card-1280 and -360: a state the mock reached by itself. order-packed-full-1280 and -360, order-packed-top-360: "Your order is packed", Packing current, disabled Cancel and Return with their hints, Packed in the history, note shown.
- HOW PACKED WAS REACHED, AND WHAT IS UNPROVEN: no route on this branch moves a customer's order to Packed (staff.ts has no Packed transition until S2; the seeded Packed order belongs to another customer). My script placed the order through the real checkout, then edited the browser's persisted mock database to move it to Packed. Page, handlers and components are the real ones. The status change is not. The history times in those images are artifacts of that edit (Being packed reads earlier than Confirmed). UNPROVEN: a Packed order reached by a real staff transition and seen by its customer. It is owed at integration, after S2 merges. The Packed + rider-note state on the seeded data does not exist.
- Product, Product.dc.html:48, :83. product-grown-in-1280 and -360, product-lead-time-1280 and -360. "Grown in Dinajpur" without the village (OQ-6); "usually takes 1 day". "Delivery across Dhaka" is the existing fact title.

OWNER DECISIONS
- D1. Rider note in the audit table (SECURITY finding 1, TEST R11). The note is copied as free text into the immutable audit table and survives erasure. S1 makes this reachable. Nothing in the handover records a decision. It should be decided before the rider note reaches production, and it does not hold up S1. Without a backlog entry it is recorded only in gate files. The rate-limit MEDIUM (SECURITY finding 2) needs the same routing, and depends on deployment.
- D2. "Organic" after a certificate lapses. SECURITY handed this to ACCEPTANCE. `GetCatalogueQueryHandler.cs:268` sends certifications with no expiry check, and expiry only blocks publishing, so a product whose certificate lapses after publishing keeps "Certified organic" on its card. catalogue-expired-certificate-organic-1280 shows it under mocks: Pure Mustard Oil, certificate expired 2025-12-31. The browser cannot fix this, because expiry is not public and §4.3 forbids S1 from `src/`. I read A3's "truthful" as §11.2.3 and U6 define it, so A3 is met. If the owner means more by it, the fix is on the server, and this is a customer-facing certification claim, so it deserves an answer.
- D3. District closed by default. The design draws it open. Slice report §8 raised it as something to check, and no Amended row rules on it. Low stakes: Origin and Producer are closed too.

SCOPE
- out-of-scope work found: none. `compareAtPrice` is in the mock only (§11.2.10); no lib type or screen reads it (OQ-8).
- files outside allowed scope: none.
- §20 conditions worked around: none. (o) and (s) went through §20.1 and were recorded before the edits stood.

UNDECLARED DEVIATIONS
- Implementation: none beyond D3, which is declared as a question rather than as a deviation.
- TEST records: the sheet's line 193, below.

CARRY-FORWARDS
Before merging S1:
- Commit this record and the screenshots. They are uncommitted, and docs/gates/screenshots/ is untracked.
- Correct TC sheet line 193 (one line).
Integration:
- E17, E18, E19, A18 from E18, `test:contract` with the S1 GETs (§12), real-API specs.
- portal-dashboard in its own chunk (ae). X1 (ordering-customer-orders:35, flaky in runs 2 to 5) rechecked under (i).
- See a Packed order through a real staff transition on the customer's page, once S2 merges.
- See "banners render below" in a browser if a `Shop` banner is ever seeded (t).
- Before a real-API run: `fixtures.ts` holds fetches unless `NEXT_PUBLIC_USE_MOCKS` is exactly `false`, and a search of scripts/run-real-api-e2e.mjs found no such setting. If the environment does not set it, each `/api/` fetch waits 30 s.
- S2: isolate the rider note on the staff panel (SECURITY carry-forward).

NOT CHECKED
- Not rerun by me: full Vitest, `next build`, served-output check, E2-E5, the rest of E6, X1-X3, mutations. Those rest on TEST run 5, whose raw logs were temp files. I ran: E6e's portal-dashboard, 10 S1 Vitest files, typecheck, lint.
- portal-a11y-responsive, the other half of E6e, rests on run 5 chunk 2a.
- Anything against a real API or real database.
- Tracker at 360 on baseline 67691e9: not rendered. "Pre-existing" rests on the file being unchanged, on its labels being the same five, and on S1's diff not touching it.
- Design at every breakpoint: only 360 and 1280. HomePhone.dc.html and Product.dc.html were read as source for the strip and product lines, not rendered.
- Owner ratification of any Amended row, beyond its text.
- My e2e rerun's log is in the session scratchpad and will not outlive the session; its result is recorded here.

FINDINGS
- [MEDIUM] web/components/orders/OrderTrackerCard.tsx — Outside S1, and not tied to an S1 criterion. At 360 the five tracker labels run together and overlap ("PlacedConfirmedPacking", "Dispatched" under its neighbours; order-packed-top-360). The page does not overflow, so no spec catches it. The file is unchanged since HO-P3 (b1b237c) and §14 forbids S1 from editing it. It affects every customer order at phone width. Needs an owner: a follow-up, not this slice.
- [MEDIUM] docs/test-cases/TC-HO-P5-WIRING-S1.md:193 — The A18 coverage row still reads FAIL, citing portal-dashboard:66, while the Summary and E6e read PASS. fa49272 updated the other two and missed this. The TEST record's disclosure does not mention it. A reader of the sheet sees a failed acceptance row under a passed gate. My A18 evidence replaces it.
- [LOW] docs/test-cases/TC-HO-P5-WIRING-S1.md:3-5,40 — Header stops at Amended (w) and run 4, "Executed" at run 2, Environment at b058708. Row T7's diff base is da87b60; I redid the check at HEAD.
- [LOW] docs/gates/HO-P5-WIRING-S1-CODE_REVIEW.md:39 — States `promiseTakesStrip` as it was before (w). Historic, but a reader would be misled.
- [LOW] web/docs/decisions.md:2008, web/components/shop/ShopTopStrip.tsx:7 — ADR-FE-187 and the doc comment say "when `freeOver` is set"; (w) narrows it. Carried from ARCHITECTURE.
- [LOW] docs/gates/HO-P5-WIRING-S1-SLICE-REPORT.md — Report line 5's "all inside S1's §13 block" was corrected, but ARCHITECTURE's other stale-line notes were not rechecked by me line by line. Its §6 mirrors agree with the source I checked.

SCOPE CHECK
- files in allowed scope: 41/41 in `git diff --name-only feat/phase2-catalogue-theme...HEAD`, checked by hand: §13 S1 block 30 web files, Amended (o) 3 (ProductPurchase.tsx, BuyBox.tsx, checkout.test.tsx), Amended (s) 2 (catalogue-fixtures.ts, catalogue-p3.test.tsx), Amended (r) 6 (five gate records and the TC sheet). PERSIST_KEY by (b).
- files outside allowed scope: none
- merge target: feat/phase2-catalogue-theme is at b05175d, the merge base, with 0 commits ahead of HEAD.
- written by this gate: this record and 24 images under docs/gates/screenshots/HO-P5-WIRING-S1/. Nothing committed. No source, test or handover touched. The scripts stayed in the session scratchpad. The dev server on :3121 (PID 13252) was started and stopped by this gate; :3121 is free and :3122 was not touched.
