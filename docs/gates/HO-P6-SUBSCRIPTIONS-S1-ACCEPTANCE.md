GATE: ACCEPTANCE
HANDOVER: HO-P6-SUBSCRIPTIONS (slice S1, customer subscription screens)
COMMITS: ba0a2a1 43c997a 5655e75 06d94c9 549747e 8a45479 c1dc7a2 fa2369b 56bfa0e 9c03c6a b4cdd23 ffd4f13 eba262e 7739506 87e7949 (first-parent range f55ea58..87e7949, branch feat/p6-s1-customer). 3492513, c09ba07 and 47e4390 merge feat/phase2-catalogue-theme in (S0, S2, real-API e2e) and are not S1's work. S1's net change is `git diff e62d66b..87e7949`; e62d66b is the merged base head. That diff has 66 files.
DATE: 2026-11-09
STATUS: PASS (run 2 at eb74a82; run 1 below was FAIL)

The verdict rests on one scope item (A19, below). Every behavioural criterion is evidenced. The fix is mechanical.

PRIOR GATES (read from docs/gates and docs/test-cases, not from commit messages)
- ARCHITECTURE: PASS (HO-P6-SUBSCRIPTIONS-S1-ARCHITECTURE.md, range f55ea58..c1dc7a2).
  - One MEDIUM: the copy hoist. It became Amended (k), done in ffd4f13.
  - Five LOWs:
    - mock check order: fixed in b4cdd23
    - the totalCount alias: deferred by the integrator
    - mock is always Sam: deferred
    - CycleHistory container width: no change asked
    - report wording: fixed
- SECURITY: PASS (-SECURITY.md, same range). One LOW: encodeURIComponent on hrefs. Fixed in b4cdd23 and tested in 7739506.
- CODE_REVIEW: run 1 FAIL (two MEDIUMs: the history "Show more" dead end and `?page=` past the end, plus LOWs). Run 2 PASS (b4cdd23, ffd4f13). Every run-1 finding is verified fixed. The three run-2 LOWs are fixed in 7739506.
- TEST: PASS (-TEST.md at 7739506; 87e7949 is docs only).
  - Sheet: docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-S1.md, 55 rows: 52 PASS, 0 FAIL, 0 BLOCKED, 1 NOTE (R2, an accepted mock deviation, Amended (j)(3)).
  - 2 NOT RUN: E18 and T11, the real-API spec. That is an integration step (§16 E18).
  - tsc and lint exit 0.
  - Full Vitest 263 files and 2661 tests passed. One earlier unidentified failure was not reproduced.
  - S1 and S2 specs on chromium and mobile-360: 136 passed, 14 skipped (real API).
  - Run-only E8 set: 526 passed, 4 skipped, 0 failed at workers=1.
- Slice report: HO-P6-SUBSCRIPTIONS-S1-SLICE-REPORT.md exists and covers every §17.3 item.
- Note: the ARCHITECTURE and SECURITY records predate b4cdd23, ffd4f13 and 7739506. CODE_REVIEW run 2 covers b4cdd23 and ffd4f13. TEST covers all three. Nobody ruled on the new test file ffd4f13 put under S0's block (see A19).
- Sheet nit: T8's case names `ordering-customer-orders`, but its evidence does not list it. The E8 rows that bind S1 are covered by T5-T8 otherwise.

MY OWN RUNS (worktree p6-s1 at 87e7949)
- Full Vitest, `npx vitest run --maxWorkers=2 --reporter=default`, output kept in a scratch file. Result: 263 files passed (1 skipped), 2661 tests passed (62 skipped), 0 failed, 504 s. The unidentified failure the TEST gate saw once did **not** recur, so there is nothing to name. It is now two clean full runs against one unexplained failure.
- Hand greps over components/subscriptions, app/(portal)/portal/subscriptions and lib/hooks/useSubscriptions.ts:
  - no colour literal
  - no `new Date(`, `Date.now`, date-fns, addDays, local or session storage, or dangerouslySetInnerHTML
  - no cat, pet, vet, clinic or PurrCare word
- Screenshots: see below. scrollWidth was measured on every capture: 1280 at 1280 and 360 at 360, on all 27 screens each.

CRITERIA (§18 rows that bind S1: A3-A11, A14 for S1's part, and A17-A20 for the slice's part; A21 is a "not built" check)
- A3 MET. A signed-in customer subscribes from the product page and sees the next delivery, including after signing in mid-flow.
  - E2a (subscriptions-customer.spec.ts:49):
    - "Subscribe & save 10%" leads to /portal/subscriptions/new/{sku}.
    - The customer picks Every 4 weeks, the default Home address and Bank transfer, then Start.
    - The detail URL shows the status "Subscribed. Your first delivery is on {date}." and "Next delivery on {date}".
  - E2c (:107): signed out, the form goes to /sign-in?next= and comes back to the same SKU's form.
  - E2d (:118): pickup lists outlets and the pickup methods.
  - Component tests: U9 (subscribe-form.test.tsx:46, :70), U11 (:112, :131), U13 (:190), U14 (:212-:305).
  - TEST evidence: E2a-d PASS on both projects; I re-ran Vitest above.
- A4 MET. Not subscribable means explained, not offered; an existing subscription is linked; signed-out visitors are not misled.
  - U8: subscribe-offer.test.tsx:43 and :52. :78 checks that signed out gives no offer and **zero** C1 requests.
  - U10: subscribe-form.test.tsx:85, :94, :104.
  - E2b (:86) checks that signed out makes no `/subscriptions/options` request, and that a non-subscribable product shows no offer.
- A5 MET. History shows the payment state, including "Awaiting your transfer: pay by …", and links the order page.
  - U23: list-and-detail.test.tsx:297 checks every outcome, state and failure as text, the order link and pay-by in the zone.
  - E3e (:231) checks the "Awaiting your transfer: pay by" text and the ORD- link href to /portal/orders/{guid}.
- A6 MET. No card UI, the unavailable reason is shown as text, and the browser computes no estimate.
  - U11 (:131): the disabled radio's `aria-describedby` is tied to `unavailableReason`.
  - U12: subscribe-form.test.tsx:176 checks there is no subtotal, discount amount or total.
  - no-literals.test.ts checks for no card inputs, alongside U6 and no-card-ui (full Vitest green).
  - E2a asserts no card or CVV label.
  - I read EstimatePanel (DetailPanels.tsx:189-216): it renders the server's strings with "−" as text and does no arithmetic.
- A7 MET. Before the cut-off the customer can change, skip, pause, resume and cancel, and the actions follow allowedActions exactly.
  - U16: list-and-detail.test.tsx:147 and :162 (no Pause when the list omits it).
  - U18: actions.test.tsx:37.
  - U19: :107.
  - U21: :208, :219, :252.
  - E3a: quantity change, with the message naming the next delivery.
  - E3c: pause, then resume with a chosen date, giving "Next delivery on {that date}".
- A8 MET. After the cut-off the customer is told which delivery a change affects, sees it scheduled, and can withdraw it.
  - U17: :204 and :216. The locked wording appears *because* isLocked is set; the same dates with isLocked false give the unlocked wording.
  - U18: actions.test.tsx:59 (scheduled change in the pending panel).
  - E3b (:156): withdraw the seeded pending terms, schedule a skip and a cancel (the message names the following delivery, and the pending panel lists "is skipped" and "Ends after the delivery on"), then withdraw them together.
- A9 MET. The skip link confirms, never acts on its own, survives sign-in and explains a stale date.
  - U20: actions.test.tsx:152, :161, :171 (fresh gate), :189.
  - E4a (:250): no non-GET request before confirming, and the parameter is gone.
  - E4b (:269): stale and malformed links.
  - E4c (:284): sign-in round trip lands on the confirmation.
- A10 MET. A suspension explains why and what to do, and offers only what the server allows.
  - U22: list-and-detail.test.tsx:245 and :256.
  - E3d (:215): the UnpaidCycles banner shows outlet phones, the action group is exactly ["Cancel subscription"], and ProductUnavailable has no contact list.
  - Seen in detail-suspended-unpaid-1280.png.
- A11 MET. The account menu has Subscriptions, and the overview shows the next delivery.
  - U24: account-sidebar.test.tsx and account-p3.test.tsx (superseded lines, stronger positives; see slice report §2).
  - U25: dashboard.test.tsx; CODE_REVIEW run 2 confirmed the timing fix.
  - E7: portal-dashboard.spec.ts E-A2 (:29-48) checks the next-delivery card heading, "Next delivery on" and the Manage href to a subscription GUID.
  - Seen in overview-card-*.png.
- A14 MET for the mock part (S1); real API pending.
  - The offer shows "Subscribe & save 10%" (U8, E2a).
  - The form shows the rate "Subscription discount: 10% off every delivery" (U12, E2a).
  - E2a checks the server estimate's "−10%", "−৳245.00" and "৳2,205.00".
  - The settings screen and the invoice line are E18 (real API): **real-API pending**, as the row allows.
- A17 MET (S1 part).
  - E5 subscriptions-customer-360.spec.ts (6 cases × 2 projects) covers every screen and all six dialogs plus the inline address form. The 44 px check covers fields and buttons, not the 24 px X, per Amended (j)(2).
  - E6 subscriptions-customer-a11y.spec.ts runs axe at 1280 and 360 on every screen, the error summary and the dialogs.
  - U40 / T10 found no colour literal. I measured no overflow on any screen.
- A18 MET (S1 part).
  - U26 customer-mock-refusals.test.ts: 20 cases, plus 2 for the check order added in b4cdd23.
  - Slice report §4 cites the server file:line for each refusal.
  - ARCHITECTURE checked the mock against src/.
  - Accepted deviations: the stricter COD band (Amended (j)(3)), and a mock that is always Sam (deferred by the integrator, ARCH LOW, slice report §6.6).
- A19 **NOT MET**. One changed file lies outside S1's §13 block and outside every Amended row:
  - `web/tests/unit/subscriptions/pending-lines.test.ts` (new, ffd4f13).
  - `tests/unit/subscriptions/**` is S0's block (§13: "A path appears in exactly one block").
  - Amended (k) authorises additions to `lib/subscriptions/copy.ts` and the swap in `components/staff-subscriptions/DetailPanels.tsx`. It names no test file.
  - S1's own `tests/components/subscriptions/**` would have held the test.
  - The file is declared (slice report §11), and its content is sound: it pins both voices string for string.
  - No earlier gate ruled on it: ARCHITECTURE and SECURITY predate it, and CODE_REVIEW run 2's scope line says only "tests".
  - Everything else is in scope (see SCOPE).
- A20 MET (per-slice part).
  - tsc 0 and lint 0 (TEST T1/T2).
  - Full Vitest at --maxWorkers=2 is green (TEST T3 and my run).
  - Build, full e2e, sweep:a11y and the contract test are integration steps (§17.2, E16-E18).
- A21 not breached. Checked:
  - no offer when signed out (U8, E2b)
  - no total before subscribing (U12)
  - no staples box: the overview is a single card (NextDeliveryCard, OQ-8)
  - no Subscriber filter (S3/BG-S2, untouched)

SCREENSHOTS (§19), 54 PNGs in docs/gates/screenshots/HO-P6-S1/, each screen at -1280 and -360
- Screens captured:
  - product-offer, product-offer-existing
  - subscribe-delivery, subscribe-add-address, subscribe-pickup, subscribe-method-unavailable, subscribe-existing
  - list-current, list-cancelled, list-empty
  - detail-unlocked, -locked, -paused, -suspended-unpaid, -suspended-product, -cancelled, -address-missing, -awaiting-payment
  - dialog-change, -skip, -pause, -cancel, -resume, -withdraw, -cancel-locked
  - skip-link-stale
  - overview-card
- How they were taken, as S2's gate did:
  - `next dev` on PORT=3128 with NEXT_PUBLIC_USE_MOCKS=true, API base http://localhost:5005 and E2E_KEEP_ROUTES=1, signed in as the seeded customer, mock reset first.
  - The capture spec and config lived in the scratchpad only.
  - The server was killed afterwards: no listener on 3128, and no leftover node or chrome process.
- Compared with docs/design/subscriptions/{Subscribe,SubscribePickup,SubscribeMobile,SubscribeUnavailable,MySubscriptions,MySubscriptionsEmpty,SubscriptionDetail,SubscriptionDetailLocked,SubscriptionDetailMobile,SuspensionBanners,ChangeTermsDialog,SkipDialogs,PauseDialog,CancelDialog,ResumeAndWithdraw}.dc.html.
- Today's customer-layer tokens are used throughout:
  - the warm page surface
  - Fraunces headings
  - the accent pill buttons
  - the warning band for suspension and lock
- Status is a word plus an icon. The Subscribe form is one column and the detail panels stack at 360.
- Deviations from the design, all set by the handover:
  - "Next delivery" replaces the design's "Next order" (OQ-4).
  - The form has no estimate total (OQ-3, BG-S4).
  - The offer is signed-in only (OQ-1).
  - The overview card is single, not a staples box (OQ-8, BG-S7).
  - History cards switch on the content width (ARCH LOW, slice report §6.4).
- Observations (visual, no criterion attached):
  - (a) In the history table at 1280, the order-number cell sits about one line lower than the date and state in its row (detail-locked-1280.png, detail-suspended-unpaid-1280.png).
  - (b) The terms panel labels the address row "Deliver to me" and its value starts "Deliver to Home: …", so it reads twice.
  - (c) At 360 the dialogs are bottom sheets. In a full-page capture the last button sits under the fold. The 360 spec checks it is reachable and 44 px.

FINDINGS
- [MEDIUM] web/tests/unit/subscriptions/pending-lines.test.ts (new in ffd4f13). This file is in S0's §13 block (`tests/unit/subscriptions/**`), and no Amended row authorises S1 to add it. Amended (k) names copy.ts and staff DetailPanels.tsx only. This breaks A19 and the acceptance rule "no changed file outside §13". Fix either way:
  - (1) `git mv` it to `web/tests/components/subscriptions/pending-lines.test.ts`, inside S1's block, with no content change. Then re-run that file and `tests/unit/subscriptions`.
  - (2) The integrator appends an Amended (l) row authorising the test file under (k).
  - Either needs only an ACCEPTANCE re-run.
- [LOW] Visual: the history table row alignment and the "Deliver to me" label, (a) and (b) above. These are for the owner; no criterion requires a change.
- [LOW] Process: the slice report's §1 still says nothing in `lib/subscriptions/**` was edited. §11 corrects it, but §1 is stale. TEST sheet T8 names `ordering-customer-orders` without evidence for it.

SCOPE
- Out-of-scope work (§4) found: none.
  - no signed-out offer
  - no pre-subscription total
  - no staples box
  - no payment capture
  - no client schedule or money arithmetic (ARCHITECTURE, CODE_REVIEW, my greps)
  - no edit to CustomerSessionGuard, nextPath, (auth), client.ts or errors.ts
- In S1's block (62 files, counting the 4 S1 gate and sheet docs): lib/hooks/useSubscriptions.ts, plus:
  - app/(portal)/portal/subscriptions/** (3)
  - ProductPurchase.tsx (passes the offer only)
  - BuyBox.tsx (slot only; diff read)
  - components/subscriptions/** (30)
  - account-nav.ts, AccountSidebar.tsx (icon mapping only), PortalDashboard.tsx (mount and doc comment only)
  - mocks/handlers/subscriptions/customer.ts
  - tests/components/subscriptions/** (7)
  - the three superseded portal tests
  - tests/e2e/subscriptions-customer{,-360,-a11y,-real-api}.spec.ts and portal-dashboard.spec.ts (E-A2 and doc comment)
  - the S1 sheet, gate records and slice report
- Authorised by Amended rows:
  - web/components/account/AddressForm.tsx (j)(1): the diff is `min-h-11` on the input and on Cancel and Save, nothing else.
  - web/lib/subscriptions/copy.ts (k): the only removed lines are the two import lines, widened. Everything else is appended.
  - web/components/staff-subscriptions/DetailPanels.tsx (k): the private pendingLines is replaced by `pendingChangeLines(subscription, 'staff')`, plus imports.
  - docs/handover/HO-P6-SUBSCRIPTIONS.md (integrator §1 rows): the diff adds only rows (j) and (k) and removes nothing.
- Files outside allowed scope: web/tests/unit/subscriptions/pending-lines.test.ts.
- No src/, .NET test, config, package or lockfile change.

UNDECLARED DEVIATIONS
- none. The out-of-scope test file is declared in slice report §11. It is out of scope, not hidden.

FOR THE OWNER
- Real-API proof (E18/T11, A14): the discount on the invoice and the settings screen are still owed, together with the customer real-API spec and the contract-test additions (§12) at integration.
- The mock's signed-in customer is always Sam (ARCH LOW, deferred). Only the real-API run proves ownership.
- The 24 px dialog close X stays (Amended (j)(2)). A global 44 px close pass is a follow-up.
- The guard-shaped `totalCount` → `rows` alias in MySubscriptionsList (ARCH LOW). S0's guard should learn that `*Count` names are counts.
- The visual LOWs above.
- The TEST gate's unidentified Vitest failure did not recur in my full run (0 failed). It is now two clean runs against one unexplained failure; nothing to name.

SCOPE CHECK
- files in allowed scope: 65/66 changed files (e62d66b..87e7949), counting the Amended-authorised ones, plus this record and the 54 screenshots
- files outside allowed scope: web/tests/unit/subscriptions/pending-lines.test.ts

---

## Run 2

GATE: ACCEPTANCE
HANDOVER: HO-P6-SUBSCRIPTIONS (slice S1, customer subscription screens)
COMMITS: eb74a82 (on top of 92ca03a, the run-1 record). The run-1 range is unchanged.
DATE: 2026-11-09
STATUS: PASS

WHAT CHANGED (eb74a82, read in full with `git diff -M eb74a82~1 eb74a82`)
- `web/tests/unit/subscriptions/pending-lines.test.ts` was renamed to `web/tests/components/subscriptions/pending-lines.test.ts`.
  - Git reports the rename at 100% similarity, so the content is unchanged. The imports are `@/` aliases only.
- docs/gates/HO-P6-SUBSCRIPTIONS-S1-SLICE-REPORT.md changed in two lines:
  - §1 now says `copy.ts` was edited (additions only, under Amended (k)).
  - §11 gives the new test path.
- Nothing else was touched: no product code, no other test, and no handover change.

CRITERIA
- A19 MET (was NOT MET).
  - `git diff --name-only e62d66b..eb74a82`, filtered against S1's §13 block, leaves exactly four files. All four are authorised by Amended rows, as listed in run 1's SCOPE:
    - `docs/handover/HO-P6-SUBSCRIPTIONS.md` (the (j) and (k) rows, append-only)
    - `web/components/account/AddressForm.tsx` (j)
    - `web/components/staff-subscriptions/DetailPanels.tsx` (k)
    - `web/lib/subscriptions/copy.ts` (k)
  - `tests/unit/subscriptions/` no longer has a file from S1.
  - The test now sits in S1's own `tests/components/subscriptions/**`.
- Every other criterion stands as in run 1: A3-A11 met, A14 met for the mock part with the real API pending (E18), A17/A18/A20 met for S1's part, and A21 not breached. eb74a82 touches no code those criteria rest on.

MY RUNS AT eb74a82
- `npx vitest run tests/components/subscriptions/pending-lines.test.ts tests/unit/subscriptions --maxWorkers=2`: 9 files and 133 tests passed. This matches the integrator's figure.
- The moved file on its own, verbose: 5 of 5 pendingChangeLines cases passed under its new path. The default include globs pick it up.
- No new screenshots: no rendered code changed. Run 1's 54 PNGs stand.

FINDINGS
- The run-1 MEDIUM is resolved: the file is moved into S1's block.
- Run 1's process LOW about slice report §1 is resolved.
- Still open, for the owner and not blocking: the visual LOWs (the history order-cell alignment and the "Deliver to me" label echo), and the TEST sheet T8 wording nit.

FOR THE OWNER
- Unchanged from run 1: real-API proof (E18/T11, A14 and the contract test) is still owed at integration. The other run-1 items also still stand: the mock always treats the customer as Sam, the 24 px close X, and the `totalCount` alias.

SCOPE CHECK
- files in allowed scope: 66/66 changed files (e62d66b..eb74a82), counting the four Amended-authorised ones, plus the gate records and screenshots
- files outside allowed scope: none

UNDECLARED DEVIATIONS
- none
