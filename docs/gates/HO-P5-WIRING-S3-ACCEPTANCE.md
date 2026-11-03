GATE: ACCEPTANCE
HANDOVER: HO-P5-WIRING (slice S3: catalogue and stock; BG-9, 10, 12, 13, 14, 16, 17, 18)
RUN: 1
COMMITS: e328940 9b70822 8e9efc2 a29c1ff ecbf825 881a512 29f395e 183c129 ffde896 6def566(merge) 2694e3d 9d1b80b 0b696b8 5415e2a c231bfe 2cb97fd 03d9c10(merge) d81ba2a 3ecad89 8abd5f5 1cc4abd bb6ecae d87817f. HEAD d87817f, branch feat/p5-s3-catalogue-stock. Range `git diff 542e7e0 HEAD` (542e7e0, the integration branch head with S4 merged, is an ancestor of HEAD).
DATE: 2026-11-04
STATUS: PASS

Every §18 row that applies to S3 (A10-A13, plus S3's part of A18-A21) has evidence. This PASS covers S3's own gates. E17, E18, E19, E12c (`inventory-real-api`), the contract run and every real-API spec are still owed at integration; no gate has shown any of them to be good.

The screenshots show one S3-introduced layout defect at 360 px that no spec catches: after a certificate file is uploaded on Food & labelling, and until Save, the page scrolls sideways by 155 px (F1, MEDIUM). G9 checked the food page only before an upload. It does not contradict A11's wording (the field works and Save is reachable), so under the reading S2's and S4's ACCEPTANCE applied (Amended (ah), (am)), it does not block this gate. A strict reading of §7 UI-1 would make it blocking. That call is recorded openly as OWNER DECISIONS D1, and I recommend the one-class fix before S3 merges.

PRIOR GATES (read from docs/gates/ and docs/test-cases/)
- ARCHITECTURE: PASS (run 1, at pre-rewrite 1443941). 1 MEDIUM (dead sessionStorage helpers in `lib/drafts/receipt-draft.ts`, ADR-FE-043 not superseded), 6 LOW.
- SECURITY: PASS (run 1, at 1443941). 3 LOW plus 1 carried.
- CODE_REVIEW: PASS (run 3, at 3ecad89; record 8abd5f5). Run 1 FAIL (3 MEDIUM), run 2 FAIL (2 MEDIUM). Run 3 left 4 LOW, fixed in 1cc4abd.
- TEST: PASS. This is the integrator's update under Amended (ao), in d87817f. The gate's own run-1 verdict (bb6ecae, on product commit 1cc4abd) was FAIL on one test gap only (M18 and R1, which rests on it).
- Slice report (`HO-P5-WIRING-S3-SLICE-REPORT.md`) and sheet (`TC-HO-P5-WIRING-S3.md`) are present.

THE TEST RECORD'S PASS (checked, not taken on trust)
- Run 1 failed only on M18 (the `min-h-11` on the "Receive into" select could be removed with all 111 inventory slice tests still green) and R1. The record names no product defect.
- (ao) adopts `tests/components/inventory/test-gate-s3.test.tsx` and `tests/e2e/catalogue-stock-gate-s3.spec.ts` unchanged. `git diff 1cc4abd HEAD` touches only those two files, the TEST record, the TC sheet and the handover (the (ao) append, plus (ak)'s E-A3 baseline wording on line 9 and §16 E12). No product file changed after 1cc4abd, the commit TEST ran.
- I reran at HEAD with `--maxWorkers=1`: `test-gate-s3`, `products-p5`, `stock-p5` (3 files, 26 passed) and `receipt-drafts`, `receipt-guard`, `receipt-draft-autosave` (3 files, 40 passed). `test-gate-s3` "carries min-h-11" is now a slice test, so M18 is caught by the slice's own suite. The sheet's recount, 128 PASS, 0 FAIL, 1 BLOCKED (E12c), is right. E12c is not counted as a pass.

GATES VERSUS LATER COMMITS
- 0b696b8 (Amended (an): helpers deleted, ADR-FE-043 superseded) closes ARCHITECTURE's MEDIUM. CODE_REVIEW run 2 reviewed it; TEST R11 confirms the file holds only two types.
- 5415e2a, d81ba2a, 3ecad89: reviewed by CODE_REVIEW runs 2 and 3. 5415e2a closes SECURITY LOW 1 (role gate) and LOW 3 (1-90 echo), verified in CODE_REVIEW run 2 and TEST R20/R22.
- 1cc4abd (CODE_REVIEW run 3's four LOWs): no review gate ran after it. TEST ran it (R16-R19, M3, M4, M20) and each fix's test fails under its mutation. I read the diff: `router.replace` after a post, one hook test, the new `receipt-guard.test.tsx`, an 8 s `addLine` timeout. It is exactly run 3's proposed remedies. Covered.

CRITERIA
- A10 MET. Products list shows origin, sizes, price range, stock, thumbnail and organic, and supports bulk publish/hide.
  - Tests: U28a-c, U29a-d passed in T3; M6 and M19 show they can fail (browser counting, selection not cleared). G1 measured every new control at 44 px or more.
  - E10a passed on both projects, first attempt (with axe and no sideways scroll, bar open).
  - Seen (products-list-*, products-bulk-*): columns Select, Product (40 px pack placeholder, the "Organic" pill under the name), Category, Producer, Origin, Pack sizes ("500 g, 2 kg", "Standard"), Price ("৳670.00 – ৳2,480.00", one price when min = max, "—" when null), Stock ("24 available", "—" for the unfinished and kit products). Two rows ticked: "2 selected", Publish, Hide from shop, Clear. Confirm "Hide 2 products from the shop?" names the count and the consequence. Result "2 updated, 0 not updated"; with a Draft: "0 updated, 1 not updated" and "Bel Sharbat Syrup: Cannot unpublish from Draft." with Dismiss. The selection cleared after the action.
  - The real thumbnail is proven by a component test only (no seeded product has a photo; slice report "Left undone").
- A11 MET. Product editor: district, "Was" price, organic certificate expiry and file.
  - Tests: U30a-c, U31a-e, U32a-e passed; M14 (Expired from a local date), M15 (`isSubscribable` sent), M21 (upload purpose) and M7/M8 (mock compare-at, district) can fail them.
  - E10b and E10c passed on both projects, first attempt.
  - Seen: "District of origin" holds "Dinajpur" under Country of origin (editor-details-district-*; "Sirajganj" on Pure Mustard Oil). Pack sizes & prices has a "Was" column: "—", and "৳2,800.00 then ৳3,000.00" for OAT-2KG (editor-variants-was-1280). The shared schedule dialog shows "Was price (optional)" with its hint; 700 against 700 shows "The compare-at price must be greater than the price." under that field with the red border (editor-schedule-was-error-*); 800 saves and the row shows ৳800.00. Food & labelling: "Certificate valid until" with the "Expired" pill only on Pure Mustard Oil, whose server flag is set (editor-food-certificate-expired-1280); "A certificate file is on record." with "View certificate" and "Remove file" on the oats; Remove file shows the uploader ("PDF, JPEG, PNG or WebP, up to 10 MB."); a PDF uploaded through the mock shows its chip, and Save stores it. Publishing Pure Mustard Oil is refused with "The organic certificate has expired. Update it on Food & labelling before publishing." and the checklist's "Blocking" line (editor-publish-refused-expired-*).
  - 360 defect F1 below.
- A12 MET. Inventory: reorder level, batch received/supplier, arriving consignments.
  - Tests: U33a-c, U34a-d passed; M13 can fail them. U47i/j cover the mock.
  - E11a passed on both projects, first attempt.
  - Seen (stock-reorder-at-expanded-1280): "Reorder at" reads "10 pouches", "10 ml (branch default)", "20 bags (branch default)", with "Below reorder level" pills where the server flags them. The expanded batches show "Received 5 Oct 2026" and "Supplier Meridian Pet Supplies Ltd". The stock detail page shows the same two in each batch card at 360 (stock-detail-batches-360). The overview shows "0 consignments arriving in the next 7 days" linking to `/staff/procurement/consignments?arrivingWithinDays=7`, which says "Showing consignments arriving in the next 7 days that have not been received yet." with "Show all consignments" (consignments-arriving-*).
  - The mock's one consignment is due in 14 days (`mocks/handlers/inventory/store.ts:459`), so in a browser the row always reads 0. A non-zero count is proven by stock-p5 U34a/b only (LOW F4).
- A13 MET. Receiving autosaves to a server draft, resumes, and can receive into another assigned branch.
  - Tests: U35a-i, U36a-d passed; M1-M5, M10, M12, M18 (now through the adopted gate test) and M20 can fail them. G4-G8 and G10 cover the branch switch, refused post and discard, Back after a post and a refused branch read.
  - E11b-e passed on both projects, first attempt. E12a (`procurement-flows`, including the rewritten E-A3) passed apart from E-A1's cold-compile flake (chromium), which passed 3 of 3 warm.
  - Seen: "Draft saved at 00:11 (Asia/Dhaka)" under the heading (receiving-draft-saved-1280). A new receipt lists "Your drafts" ("No supplier chosen · 1 line · Dhanmondi outlet · Last saved …", Continue, Discard), with Discard confirming. "Receive into" (Dhanmondi outlet) with "Orders, consignments and locations below are this branch's." Changing it with a line present asks "Receive into London outlet?" and names what is cleared; afterwards the line's location list is London's. `?draft=` resumes the lot "L-ACC-1"; Review and post → "Post receipt" → GRN-2026-000102; the draft's address then says "That draft is no longer here" with "Start a new receipt".
  - "Post to stock" in §11.4.10 stays "Post receipt" (Amended (ak), §20.3). Receiving into another branch cannot pre-fill that branch's PO lines (backend gap, (ak)).
- A18 (S3's part) MET.
  - U46: both colour guards and the T6 back-up `rg` found 0 matches.
  - Axe: E10a, E11e, and E12b (`inventory-a11y-responsive`, 458 passed; the 2 failures are a non-S3 route that passed alone). E19 is integration.
  - F1 is not an axe failure.
- A19 (S3's part) MET. U47a-j passed; M7-M12 show the mock refusals can fail. Carried: the mock does not model the certificate's caller-owns-upload and 30-minute attach window (SECURITY LOW 2, R21, test fidelity only).
- A20 MET. See SCOPE. Nothing subscription-shaped: the only `isSubscribable` in added lines is the comment saying it is not sent, and M15 shows the test fails if it is.
- A21 (S3's part) MET. At 1cc4abd: T1 typecheck and T2 lint exit 0; T4 full Vitest at `--maxWorkers=2` 2277 passed, 1 failed (`shared-pieces` U-A3, not an S3 change, passes alone 17/17 three times, Amended (i)); T7 `next build` exit 0; T8 served output clean. The integrator's recheck covered tsc and ESLint on the two adopted files. The full e2e half is E18.
- A1-A9, A14-A17: not S3's. A22: a recorded non-goal.

AMENDED (ak), (an), (ao): JUDGEMENT
- The out-of-block edits are each named: `ScheduleChangeDialog.tsx` (optional `extraField`; `schedule-change-dialog.test.tsx` unchanged and passing), `tests/unit/files/file-rules.test.ts` (one rule), `tests/e2e/procurement-flows.spec.ts` (E-A3 rewritten and now passing), `lib/drafts/receipt-draft.ts` and `web/docs/decisions.md` (an), the two gate files (ao). ACCEPTED.
- The silent calls (an) records ("Your drafts" beside an open draft, a blank quantity saved as "0", Status-named mock refusals, the shared dialog not pre-checking the main amount) were seen or are harmless; ACCEPTED. "Your drafts" beside an open draft is visible in receiving-receive-into-confirm-360, and reads correctly.
- `submitProductSection.ts` copies `lib/shop/submitSection.ts`'s flow with a wider field map, the one place §20.1's "never copy" bends. (ak) records it. ACCEPTED, with the clean end state (fold into `lib/api/errors.ts`) carried.

SCOPE
- Out-of-scope work found: none. No subscription surface, no store-side "Was" price (OQ-8), no backend, nav, config, dependency or `globals.css` change (`git diff 542e7e0 HEAD -- web/package.json web/package-lock.json web/eslint.config.mjs web/app/globals.css src` is empty). No `sessionStorage`/`localStorage` write in added product lines.
- Files outside allowed scope: none. `git diff --name-only 542e7e0 HEAD` lists 72 files:
  - §13 S3 block: 59 files.
  - Amended (ak): `components/admin/ScheduleChangeDialog.tsx`, `tests/unit/files/file-rules.test.ts`, `tests/e2e/procurement-flows.spec.ts`.
  - Amended (an): `web/lib/drafts/receipt-draft.ts`, `web/docs/decisions.md`.
  - Amended (ao): `tests/e2e/catalogue-stock-gate-s3.spec.ts` (its Vitest twin is under `tests/components/inventory/**`, in the block).
  - Amended (r): the 5 gate records, the slice report and the TC sheet.
  - The handover: the §1 Amended cell (pure append of (ak), (an), (ao)), the Known-baseline row and §16 E12, both changed as (ak) directs. A word diff shows no other deletion.
- §20 conditions worked around: none. Each out-of-block need was raised in the slice report (§20 requests 1-3) and ruled by (ak) before use.

UNDECLARED DEVIATIONS
- Implementation: none found. Each §11.4 departure is declared in the slice report and recorded in (ak)/(an).
- Records:
  - The TEST record's STATUS line and INTEGRATOR UPDATE are the integrator's words, and say so.
  - The slice report's "Not touched" line (line 22) still lists `components/admin/ScheduleChangeDialog.tsx` and `lib/drafts/receipt-draft.ts`, which the range changes (ARCHITECTURE LOW; Round 3 says the lists were updated, but this line was not). LOW.
  - The handover's §1 "Known e2e baseline" still opens "The 12 failures", and E18/A21 say "only the 12 baseline failures", although (ak) dropped E-A3 (11 remain). LOW, for whoever runs E18.

SCREENSHOTS (Amended (j)), at docs/gates/screenshots/HO-P5-WIRING-S3/, 64 images (32 screens × 360 and 1280)
Setup and review:
- A fresh `next dev -p 3123` with MSW (`NEXT_PUBLIC_USE_MOCKS=true`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:5005`, `NODE_OPTIONS=--max-old-space-size=8192`), 7 routes warmed with curl (all 200), signed in as the seeded Administrator (`signInAsStaff`), `fixtures.ts`'s MSW hold.
- A temporary spec (deleted afterwards), projects `chromium` (1280×720) and `mobile-360` (360×780), 2 workers, `--retries=0`, a fresh context per test, full-page captures: 10 browser tests passed. Two were rerun after I fixed my own selectors (the uploader is a button named "Certificate file"; the batch disclosure is "Batches of …"). The dev log has 0 error or warn lines.
- For each capture I measured page `scrollWidth`, listed every visible control under 44 px, and listed every 3+ letter word whose text range spans two lines (a mid-word break). I looked at every image.
- Full-page captures freeze the sticky staff rail and dialog overlays at the scroll position, so the rail appears part-way down some pages. That is a capture artifact.
- No back-office `.dc.html` was rendered for comparison; HO-P4 interpreted those designs and HO-P5 adds none (NOT CHECKED).

Products list: products-list-*, products-bulk-bar-*, products-bulk-confirm-*, products-bulk-result-*, products-bulk-result-failure-*.
- 1280: correct as under A10. The table sits in its scrolling frame; with the four new columns plus Select, "Status" is cut at the right edge ("Sta") and needs a sideways scroll (LOW F2, S3).
- 360: no page overflow. Only Select and Product show until the frame is scrolled, and the Product column is about 60 px, so names wrap a word a line ("Black / Forest / Mill / Classic / Sugarcane / Gur"); no mid-word break. The list page is 3,694 px tall (LOW F2, S3: it is the HO-P4 frame with more columns).
- Bulk bar controls, select-all and the row checkbox areas measure 44 px or more.

Product editor: editor-details-district-*, editor-variants-was-*, editor-variants-prices-scheduled-*, editor-schedule-was-dialog-*, editor-schedule-was-error-*, editor-variants-was-saved-*, editor-food-certificate-{on-record,uploader,uploaded,saved,expired}-*, editor-publish-refused-expired-*.
- 1280: correct as under A11.
- 360: the district input, schedule dialog (bottom sheet) with the Was field and its error, the certificate block, View certificate and Remove file all fit and measure 44 px or more. In the variants table the Was column is off-screen until the frame is scrolled (HO-P4 frame).
- WRONG at 360 (F1, S3): editor-food-certificate-uploaded-360. After a file is uploaded, the "Certified organic" block widens to about 410 px and the page scrolls sideways by 155 px (measured). The filename chip (`truncate`, `white-space: nowrap`) sets the min-content width, and the `<fieldset>` at `FoodDetailsForm.tsx:154` keeps the browser default `min-inline-size: min-content`, so it cannot shrink. Saved, the chip is replaced by "on record" and the overflow is gone (editor-food-certificate-saved-360: 0). 1280 is unaffected.
- The checklist shows "Done: The organic certificate has expired. Record the renewed certificate's expiry date (and file) before publishing." on a valid certificate. That is the server's item text (`ProductPublicationRules.cs`, `OrganicCertificateNotExpired`), mirrored by the mock and shown by HO-P4's checklist as "Done: {text}". Not S3 code; the wording reads wrong when met (LOW F5, backend).
- Pre-existing primitives under 44 px seen here: "Prices for …" and "Schedule a new price" (32 px), "Discontinue" (32 px), "Unpublish"/"Archive"/"Save"/"Schedule" (40 px), the HO-P4 selects and text inputs (36-38 px), the certification checkboxes (20 px), and FileUploadField's "Remove {file}" (32 px, `components/files`, §14). None is an S3 control.

Stock and procurement: inventory-overview-arrivals-*, stock-reorder-at-*, stock-reorder-at-expanded-*, stock-detail-batches-*, consignments-arriving-*.
- 1280: correct as under A12.
- 360: no page overflow. The stock list frame (min width 900) shows only Item until scrolled, so "Reorder at" and the pill are off-screen; the same holds for Received and Supplier in the expanded batch table. This is HO-P4's §7 UI-1 frame. The stock detail page draws batch cards, where Received and Supplier read cleanly. The arrivals row and the consignments sentence wrap cleanly.
- The batch disclosure buttons are 32 px (HO-P4 `StockTable`, unchanged by S3).

Receiving: receiving-new-empty-*, receiving-draft-saved-*, receiving-your-drafts-*, receiving-discard-confirm-*, receiving-receive-into-confirm-*, receiving-receive-into-changed-*, receiving-resumed-*, receiving-review-post-*, receiving-posted-receipt-*, receiving-draft-closed-*.
- Correct at both widths: the status line, Your drafts card (Continue and Discard 44 px), Receive into (44 px), the change-branch confirm, the review dialog and the closed-draft state.
- Pre-existing at 360, not S3: the posted receipt's line card value column is about 50 px, so "L-ACC-1" and "৳450.0000" break ("৳450.0 / 000"; the four decimals are the receipt page's existing unit-cost format). ConfirmDialog's "Change branch"/"Discard draft" and the form's "Review and post" are 40 px; the line's "Remove" is 32 px; the location select is 36 px. All HO-P4 primitives.

OWNER DECISIONS
- D1. Whether F1 blocks. I followed S2's and S4's precedent: a §7 UI-1 layout defect that does not contradict a §18 criterion's wording is a MEDIUM, fixed by the integrator (as (ah) and (am)). If the owner reads UI-1 as binding at ACCEPTANCE, this verdict becomes FAIL on A11 until it is fixed. Recommended default: fix before S3 merges, with `min-w-0` on the `<fieldset>` at `web/components/staff-shop/FoodDetailsForm.tsx:154` (S3's own file), and add the uploaded state to G9's 360 check or a short spec that fails at the old layout.
- D2. Backend wording (F5): the `OrganicCertificateNotExpired` checklist item's text is phrased as the failure, so a met item reads "Done: The organic certificate has expired…". Recommended default: ask backend for a neutral item text (for example "The organic certificate has not expired."); no web change.
- D3 (carried from (ak)). `GET …/purchase-orders/{id}` takes no `branchId`, so receiving into another branch cannot pre-fill that branch's PO lines. Recommended default: backend follow-up if wanted; the UI stays as built.
Carried, still without a decision: S1's SECURITY MEDIUMs (rider note in the audit table, the shared `Catalogue` rate-limit bucket), S2's D1-D3, S4's D1-D4.

CARRY-FORWARDS
Before merging S3:
- Commit this record and the 64 screenshots (done in this gate's commit).
- Fix F1, or have the owner rule under D1.
- Optionally correct the slice report's "Not touched" line (line 22).

Integration (E17/E18/E19):
- E17 (Amended (l)) and E18 in §17.2 chunks, a fresh `next dev` each, 8 GB heap (`next dev` restarted itself for memory at 6 GB during `inventory-flows`). The baseline is now 11 failures, not 12: `procurement-flows` :95 E-A3 must pass.
- Recheck by name under (i): `inventory-flows` E-F1 (both projects) and E-C1/E-C2 (mobile-360, next to a memory restart); `procurement-flows` E-A1 (chromium, cold compile; it crosses S3's receiving page); `inventory-a11y-responsive` storage-breaches detail at 1024/1440; Vitest `shared-pieces` U-A3.
- E19 `sweep:a11y` against 67691e9, and A21's full set at the merge.
- E12c `inventory-real-api` and every real-API spec: not run by anyone for S3.
- Contract run: add S3's new GETs to `tests/contract/mock-vs-real.contract.test.ts` and run `test:contract` if a scratch API exists: the staff product list extras, staff product detail (district, compare-at, certificate fields), stock summary (reorder level) and matrix (received, supplier), alert summary (`consignmentsArriving`), consignments `arrivingWithinDays`, goods-receipt drafts list/detail, and the `branchId` list parameters.
- Mock certificate attach rule (SECURITY LOW 2, R21): record uploader and upload time in `uploadBehavior.ts`, refuse another user's or an older-than-30-minute file, one U47 case.
- Fold `submitProductSection.ts`'s field map and sentences into `lib/api/errors.ts` when that file is next opened.
- G8 residual: Back from a posted receipt lands once on the closed draft's address ("That draft is no longer here"); a second Back leaves the flow.
- G10: with the admin branches read refused, "Receive into" options show raw branch ids (usability only).
- A18 at integration: read `notifications-a11y-responsive` and `xct-offline-a11y` from E18 (S0 carry-forward).

FINDINGS
- [MEDIUM] F1 web/components/staff-shop/FoodDetailsForm.tsx:154 (S3). At 360 px, between uploading a certificate file and saving, the page scrolls sideways by 155 px: the fieldset keeps `min-inline-size: min-content` and the shared file chip's nowrap filename sets it. Seen in editor-food-certificate-uploaded-360; no spec covers the uploaded state (G9 checks the food page before an upload).
- [LOW] F2 web/components/staff-shop/StaffProductTable.tsx (S3's added columns). At 1280 the Status column is cut at the frame's edge; at 360 only Select and a ~60 px Product column show until scrolled, names wrap a word a line and the page is about 3,700 px tall. No mid-word break, no page overflow.
- [LOW] F3 Pre-existing primitives under 44 px on S3's screens (ConfirmDialog 40 px buttons, `FileUploadField` 32 px Remove, HO-P4 selects 36 px, StockTable disclosure 32 px, VariantsTable row buttons 32 px). None is S3's; all are outside or predate S3's change.
- [LOW] F4 mocks/handlers/inventory/store.ts:459. The only seeded consignment arrives in 14 days, so in any mock run the overview reads "0 consignments arriving in the next 7 days". A non-zero count is evidenced by component tests only. A seed within 7 days would show it in a browser.
- [LOW] F5 Server checklist text for `OrganicCertificateNotExpired` reads as a failure when met (D2). Backend.
- [LOW] Pre-existing, not S3: the posted receipt page's line card at 360 breaks "L-ACC-1" and "৳450.0000" mid-word (HO-P4 receipt page).
- [LOW] docs/gates/HO-P5-WIRING-S3-SLICE-REPORT.md:22 lists two changed files as "Not touched".
- [LOW] docs/handover/HO-P5-WIRING.md §1 baseline row, §16 E18 and §18 A21 still say "12 baseline failures" after (ak) dropped one.
- [LOW] No review gate ran after 1cc4abd. I read it: CODE_REVIEW run 3's own remedies, and TEST measured each by mutation. Recorded for completeness.

NOT CHECKED
- Not rerun by me: full Vitest, typecheck, lint, build, served-output, E10-E12, the gate spec and the mutations. Those rest on TEST run 1 (at 1cc4abd) and the integrator's recheck.
- What I ran: 6 Vitest files (66 tests passed) and the 10-test screenshot spec with page-width, control-size and mid-word measurements.
- No comparison against the back-office `.dc.html` files (§19); the screens keep HO-P4's interpretation.
- A real thumbnail (no seeded photo), a 403 on any S3 screen in a browser, a one-branch user in a browser, and anything against a real API or database. Owner ratification of (m)-(ao) beyond their text.

WRITTEN BY THIS GATE
- This record, and 64 PNGs under docs/gates/screenshots/HO-P5-WIRING-S3/. No source, test, config or handover file touched.
- The temporary spec `web/tests/e2e/zz-acceptance-s3-shots.spec.ts` was deleted, with `web/test-results`; the measurement log stayed in the session scratchpad.
- The `next dev` on :3123 that I started is stopped and :3123 is free. No chrome-headless-shell is left running.
