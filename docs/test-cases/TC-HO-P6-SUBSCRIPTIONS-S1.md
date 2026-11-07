# TC-HO-P6-SUBSCRIPTIONS-S1 — Subscriptions frontend: customer screens (store front and account)

Handover: docs/handover/HO-P6-SUBSCRIPTIONS.md (S1 rows U8–U26, U40, §16 E2–E8, §18 A3–A11 and A14 (customer part), Amended (a)–(f))
Commit(s) under test: branch `feat/p6-s1-customer` from `feat/p6-s0-contract` at 2a61f70 (commits ba0a2a1, 43c997a, 5655e75, 06d94c9, 549747e and the closing commit that holds this sheet; see the slice report)
Written: 2026-11-07 by the implementer, after the in-batch runs of handover §17.1 step 2. Rows that belong to the TEST gate (the full Vitest suite, the run-only specs of E8, the two-zone run) are NOT RUN here and say so.

> Statuses record what was observed. IDs U8–U26, U40 and E2–E8 are the handover's; X* and R* are additions of this sheet.

## Summary

| | Count |
|---|---|
| Total | 43 |
| PASS | 39 |
| FAIL | 0 |
| BLOCKED | 0 (R1 resolved by Amended (j)) |
| NOT RUN | 3 (X1b the full Vitest suite, E8 the run-only chunks, E18 the real API; all the TEST gate's or the integrator's) |
| NOTE | 1 (R2, an accepted mock deviation) |

## Environment

Worktree D:/my-repo/amar-gram/.claude/worktrees/p6-s1, branch `feat/p6-s1-customer`. `npx tsc --noEmit` and `npm run lint` (`--max-warnings 0`) exit 0.
Vitest 5.0.1 at `--maxWorkers=2`, only the files S1 touches or can reach (see X1). Playwright against `next dev` on PORT=3128 with
`NEXT_PUBLIC_USE_MOCKS=true`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:5005`, `E2E_KEEP_ROUTES=1`, `--workers=1`, projects chromium and mobile-360.
No real API, database or broker was used (the machine's 5005, 3127 and 3129 belong to others and were not touched). The dev server and the Playwright tree were killed afterwards; no tracked screenshot was overwritten.

## Unit cases (Vitest, `tests/components/subscriptions/**` unless a path is given)

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| U8 | `subscribe-offer.test.tsx`: signed in + subscribable + 10.00 gives "Subscribe & save 10%" to `/portal/subscriptions/new/{skuId}`; "0.00" gives "Subscribe"; not subscribable gives nothing; `existingSubscriptionId` gives "You already subscribe to this" + Manage; signed out gives nothing and **no C1 request**; a variant change reads C1 for the new SKU; `BuyBox` without the slot is unchanged | pass | PASS | 9 tests |
| U9 | `subscribe-form.test.tsx`: quantity 1…`maxQuantity` with "Choose 1 to 20."; intervals and the maximum follow the payload; date `min`/`max`, default the earliest, range and reminder lead in words | pass | PASS | 2 tests |
| U10 | same: `subscribable: false` shows the server's reason and a link back; existing links to it; C1 404 "We couldn't find that product." | pass | PASS | 3 tests |
| U11 | same: no C2 request until an address or outlet is chosen; delivery asks with `deliveryAddressId`, pickup with `pickupBranchId`; an unavailable method is a disabled radio with `unavailableReason` tied by `aria-describedby`; a quantity change re-requests (debounced) | pass | PASS | 2 tests |
| U12 | same + `list-and-detail.test.tsx`: the form shows unit price, "Subscription discount: 10% off every delivery" and the note and **no** subtotal or total; the detail's `EstimatePanel` shows the server's six strings as sent | pass | PASS | 2 tests |
| U13 | same: "Add a new address" saves through Accounts, selects the new address, keeps the other choices; nothing in `localStorage`, nothing in `sessionStorage` but the mock's own keys | pass | PASS | 1 test (found the dialog not closing: fixed, see slice report §6) |
| U14 | same: 201 goes to the detail with `?subscribed=1`; 400 maps to fields with a summary and keeps values; `{ error }` 400 reads as the generic sentence; `SubscriptionAlreadyExists` links to the existing one; `PaymentMethodUnavailable` re-reads C2; the button is busy and announced | pass | PASS | 5 tests |
| U15 | `list-and-detail.test.tsx`: tabs Current (7) / Cancelled (1) from each query's `totalCount`; card content; the one warning line in the design's order for each of the five cases and the priority between them; empty state; Try again; `?page=` request | pass | PASS | 6 tests |
| U16 | same: next delivery, help text, cut-off sentence with the zone; buttons exactly equal to `allowedActions`; a list without Pause shows no Pause; terms; a missing estimate hides the panel; a removed address warning opens the change dialog; 404 | pass | PASS | 4 tests |
| U17 | same: locked sentence with `followingDeliveryOn`; Skip names `skippableCycleOn`; pause and cancel use the locked wording because `isLocked`, and the unlocked wording for the same dates with `isLocked: false` | pass | PASS | 2 tests |
| U18 | `actions.test.tsx`: `PUT` with `version`, 200 closes and shows `message`; a scheduled result shows the pending panel; 409 keeps the dialog open with the values, the stale sentence and a re-read; NoChangeRequested sentence | pass | PASS | 4 tests |
| U19 | same: the confirmation names the date; nothing is sent before it; the body is `{ cycleOn }`; CycleNoLongerSkippable shows the server sentence | pass | PASS | 2 tests |
| U20 | same: `?skip=` equal to `skippableCycleOn` opens the confirmation, no request before confirming, the parameter removed; another date explained with "Skip the delivery on … instead"; `skippableCycleOn: null` explained without an offer; malformed ignored and removed | pass | PASS | 3 tests |
| U21 | same: pause (unlocked wording), resume (date `min`/`max` from C1, sent only when chosen, refusal on the field, SubscriptionSuspended sentence), cancel (no request without a reason, six reasons, note ≤ 500 with a counter, rendered as text), withdraw sends `DELETE` | pass | PASS | 5 tests |
| U22 | `list-and-detail.test.tsx`: UnpaidCycles banner with every outlet's name and phone from P4 (none when P4 fails); ProductUnavailable banner without contacts; only Cancel offered | pass | PASS | 2 tests |
| U23 | same: every outcome, order state and failure reason as text, no raw code; the order number links `/portal/orders/{orderId}`; pay-by in the zone; "Show more" requests page 2; table when there is room, cards when there is not; the subscribed announcement | pass | PASS | 4 tests |
| U24 | `tests/components/portal/account-sidebar.test.tsx`, `account-p3.test.tsx`: "Subscriptions" after "My orders" with its href; present in the phone pills order | pass | PASS | superseded assertions, see the slice report §2 |
| U25 | `tests/components/portal/dashboard.test.tsx`: the payload has no `subscriptions` key and the card comes only from C3 (product, "Next delivery on", Manage → detail); with none or a failed read it is absent and nothing else changes | pass | PASS | U-A11b rewritten, plus one new case |
| U26 | `customer-mock-refusals.test.ts`: one case per §11.2.10 refusal, with the status, code, property and body shape (both 400 shapes, the bodiless 404 for someone else's, 409) | pass | PASS | 20 tests |
| U40 | `no-literals.test.ts` (new) plus `tests/components/shop/no-hex-literals.test.ts` and `tests/components/back-office/no-colour-literals.test.ts`: no colour literal in any touched file; no card input names; `source-guard.test.ts` (U6) passes over the new folders | pass | PASS | inside X1 |
| X1 | Vitest in-batch set at `--maxWorkers=2`: `tests/components/subscriptions`, `tests/components/portal`, `tests/components/product`, the two literal tests, `tests/unit/subscriptions`, `tests/guards` | green | PASS | 29 files / 596 tests passed |
| X1b | Full Vitest suite | green | NOT RUN | TEST gate (§17.1) |
| X2 | `npx tsc --noEmit` | clean | PASS | exit 0 |
| X3 | `npm run lint` | clean | PASS | exit 0 |

## End-to-end cases (Playwright, chromium + mobile-360, `--workers=1`, MSW)

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| E2a | `subscriptions-customer.spec.ts`: product page offer, the form (delivery, every 4 weeks), start, the detail with the server estimate, the offer now says "You already subscribe" | pass | PASS | both projects |
| E2b | same: a product that is not offered shows no offer; signed out shows none and makes **no** options request | pass | PASS | both projects |
| E2c | same: signed out, the Subscribe page goes to sign-in and comes back on the form for that product | pass | PASS | both projects |
| E2d | same: cash on delivery over the limit stays listed disabled with Orders' reason; pickup lists the outlets and the pickup methods | pass | PASS | both projects |
| E3a | same: unlocked, change quantity: the message names the next delivery | pass | PASS | both projects |
| E3b | same: locked, withdraw the seeded pending terms, schedule a skip and a cancel (each names the following delivery, the pending panel lists them), withdraw them together | pass | PASS | both projects |
| E3c | same: pause, then resume with a chosen date: "Next delivery on {that date}" | pass | PASS | both projects |
| E3d | same: suspended: banner with the outlet phone, only Cancel offered; the other reason has no phone | pass | PASS | both projects |
| E3e | same: the list warnings; history says "Awaiting your transfer: pay by …" and links to the order page | pass | PASS | both projects |
| E4a | same: `?skip=` matching: confirm, nothing sent before confirming, the parameter gone, then skipped | pass | PASS | both projects |
| E4b | same: stale `?skip=` explained with "Skip the delivery on … instead"; a malformed value ignored and removed | pass | PASS | both projects |
| E4c | same: signed out with `?skip=`: sign in, land on the confirmation, no automatic skip | pass | PASS | both projects |
| E5 | `subscriptions-customer-360.spec.ts`: the offer, the Subscribe form (delivery, inline address form, pickup, already subscribed, not found), My subscriptions (both tabs, empty state), the detail in six states and not found, each of the six dialogs, the overview card: no sideways scroll and no control under 44 px | pass | PASS | 6 tests, both projects; **except** the AddressForm dialog's height, see R1 |
| E6 | `subscriptions-customer-a11y.spec.ts`: axe zero serious/critical on every screen and dialog of E5 at 1280 and at 360, including the error summary on the form and the cancel dialog's reason error | pass | PASS | 12 tests, both projects |
| E7 | `portal-dashboard.spec.ts` E-A2 superseded (orders and balances still on one screen, and the "Next delivery" card with its Manage link); every other case unchanged | pass | PASS | the whole file, 12 tests per project |
| E8 | Run-only: `shop-*`, `home`, `portal-*` (except E7), `account-area`, `accounts-*`, `ordering-customer*`, `ordering-a11y-responsive` | pass | NOT RUN | TEST gate, one slice at a time (§17.1). As a sanity check only, `shop-product`, `portal-a11y-responsive`, `account-area` and `ordering-customer` were run once on both projects at `--workers=2`: 82 passed, 0 failed (the new menu link and the offer on the product page changed none of them) |
| E18 | `subscriptions-customer-real-api.spec.ts` against the real API | pass or skipped | NOT RUN | needs `E2E_REAL_API=1`, `NEXT_PUBLIC_USE_MOCKS=false` and a scratch API; the spec was shown to skip without them |

## Open rows

| ID | Row | Status | Note |
|---|---|---|---|
| R1 | E5/E6 "44 px controls" for the inline address form | PASS | Amended (j): `AddressForm` fields and Cancel/Save are 44 px; the 360 spec checks them (not the 24 px X). Re-run: 64 passed on both projects with `account-area` and `ordering-customer`; `accounts-a11y-responsive -g ddress` 10 passed; Vitest 16 files / 249 tests |
| R2 | Mock: cash on delivery in the band between the discounted and the undiscounted total | accepted deviation | the quote the mock asks Orders' pricing for is not discounted, so the mock refuses in a narrow band the server accepts (§20.5, noted in `customer.ts`) |
