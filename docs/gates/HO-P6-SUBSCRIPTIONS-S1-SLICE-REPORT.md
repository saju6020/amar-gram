# HO-P6 S1 (subscriptions: customer screens, store front and account) - slice report (§17.3)

Branch `feat/p6-s1-customer` from `feat/p6-s0-contract` at `2a61f70` (S0, all five gates passed, not yet merged). Worktree `D:\my-repo\amar-gram\.claude\worktrees\p6-s1`. Not pushed, not merged. Commits: `ba0a2a1` (customer mock), `43c997a` (screens, hook, routes, buy-box slot), `5655e75` (account menu, overview card, superseded assertions), `06d94c9` (e2e specs), `549747e` (component tests, guards, real-API spec, two fixes found by the tests), then the docs commit that holds this report and the TC sheet.

## 1. Files touched (paths under `web/` unless they start with `docs/`), all inside the §13 S1 block

- Hook: `lib/hooks/useSubscriptions.ts`.
- Routes: `app/(portal)/portal/subscriptions/page.tsx`, `.../new/[skuId]/page.tsx`, `.../[subscriptionId]/page.tsx`.
- Components, all new under `components/subscriptions/`: `SubscribeOffer`, `SubscribeForm`, `SubscribeFormBody`, `SubscribeSummary`, `TermsFields`, `FulfilmentFields`, `QuantityField`, `FirstDeliveryField`, `FieldError`, `termsDraft`, `MySubscriptionsList`, `SubscriptionCard`, `StateTabs`, `SubscriptionStatusBadge`, `ProductThumb`, `SubscriptionDetail`, `DetailPanels` (next delivery, suspension banner, pending changes, terms, estimate), `SubscriptionActions`, `CycleHistory`, `SkipLinkHandler`, `SubscriptionDialog`, `ChangeTermsDialog`, `SkipDialog`, `PauseDialog`, `ResumeDialog`, `CancelDialog`, `WithdrawDialog`, `dialogTypes`, `useResetOnOpen`, `subscriptionText`, `NextDeliveryCard`.
- Edits to existing files, each listed in §13: `components/product/BuyBox.tsx` (optional `subscribe` slot, absent = unchanged output), `app/(shop)/_components/ProductPurchase.tsx` (passes `<SubscribeOffer>` only for a signed-in customer and a SKU with a price), `components/portal/account-nav.ts` (link, pill order, `'repeat'`, doc comment), `components/portal/AccountSidebar.tsx` (`'repeat'` to lucide `Repeat`, nothing else), `components/portal/dashboard/PortalDashboard.tsx` (mounts `NextDeliveryCard`, doc comment); by Amended (j) `components/account/AddressForm.tsx` (`min-h-11` on its fields and Cancel/Save only).
- Mock: `mocks/handlers/subscriptions/customer.ts` (was S0's empty stub).
- Tests: `tests/components/subscriptions/{helpers.tsx, subscribe-offer, subscribe-form, list-and-detail, actions, customer-mock-refusals, no-literals}`, `tests/e2e/subscriptions-customer{,-360,-a11y,-real-api}.spec.ts`.
- Superseded (listed in §2): `tests/components/portal/{account-sidebar,account-p3,dashboard}.test.tsx`, `tests/e2e/portal-dashboard.spec.ts`.
- Docs: this report and `docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-S1.md`.

No `src/`, config, dependency or lockfile change. Nothing in `lib/subscriptions/**`, `lib/api/*subscriptions.ts`, the S0 store, schedule or controls, `accounts.ts`, `CustomerSessionGuard`, `nextPath` or `(auth)` was edited. S1 owns no ADR (S0 recorded ADR-FE-109 to 114 and 193 to 197). `AddressForm.tsx` is edited only as Amended (j) says (44 px on its fields and Cancel/Save), nothing else in it.

## 2. Superseded assertions, old to new

| File | Old | New |
|---|---|---|
| `tests/components/portal/account-sidebar.test.tsx:96-111` (one test) | the menu labels are Overview, My orders, Wishlist, My reviews, Billing, Profile & addresses; `queryByRole('link', { name: /subscriptions/i })` is absent | the label list has "Subscriptions" right after "My orders"; the link exists with `href="/portal/subscriptions"` and its index is the one after "My orders". The label list at `:96-103` is in the same test as `:106`; it must change with it |
| `tests/components/portal/account-p3.test.tsx:170` | `queryByText(/subscriptions/i)` is absent | the link "Subscriptions" exists with its href and is not `aria-current` on `/portal/orders/123`; the test name no longer says "no Subscriptions" |
| `tests/components/portal/dashboard.test.tsx` U-A11b (`:162-167`) | no heading matching /subscription/ and no `tile-subscriptions` | the payload has no `subscriptions` key and `tile-subscriptions` is absent; the `next-delivery` card is present with its heading, "Next delivery on …" and a "Manage" link to `/portal/subscriptions/{guid}`, and comes only from C3. One new case beside it: with none, or a 500 from C3, the card is absent and the orders tile, the address card and the absence of an alert are unchanged |
| `tests/e2e/portal-dashboard.spec.ts` E-A2 (`:29-36`) | `getByRole('heading', { name: /subscription/i })` count 0 | the `next-delivery` card has its level-2 "Next delivery" heading, "Next delivery on …" and a Manage link to the detail; every other assertion of E-A2 and every other case is unchanged. The test name and the file's doc comment say so |

## 3. OQ defaults built to (all take the recommended default under Amended (a))

OQ-1 the offer is signed-in only (no C1 request when signed out). OQ-2 "Subscribe & save {n}%" / "Subscribe" / "You already subscribe to this · Manage" under the actions row. OQ-3 no total on the form: unit price, the rate in words, the note. OQ-4 "Next delivery on {date}" with "The order is placed on this date." OQ-5 the six reasons, required, optional note ≤ 500. OQ-6 inline `AddressForm`, nothing stored. OQ-7 outlets from `GET /api/branches`, the server's refusal on the field. OQ-8 one "Next delivery" card with Manage only. OQ-9 the Home staples-box band and the multi-item layout are not built (BG-S7). OQ-14 every active outlet's name and phone on the unpaid banner. OQ-17 the mock's fixed settings and the 10.00 discount (S0). OQ-19 each tab's own `totalCount`. OQ-10, 11, 12, 13, 15, 16, 18 belong to S2 and S3.

## 4. Mock refusals added (`mocks/handlers/subscriptions/customer.ts`) with the server file:line mirrored

Paths: `C` = `src/Api/AmarGram.Api/Controllers/CustomerSubscriptionsController.cs`, `H` = `src/Application/AmarGram.Application/CommandHandlers/Subscription/SubscriptionCustomerCommandHandlers.cs`, `V` = `src/Application/AmarGram.Application/CommandHandlers/Validators/SubscriptionCommandValidators.cs`, `S` = `.../Subscription/SubscriptionHandlerSupport.cs`, `Q` = `src/Read/AmarGram.Read/QueryHandlers/Subscription/SubscriptionCustomerQueryHandlers.cs`, `P` = `src/Api/AmarGram.Api/Controllers/PagingHelper.cs`, `X` = `.../Controllers/SubscriptionHttp.cs`.

| Mock refusal | Mirrors |
|---|---|
| 401 without a customer session | `[RequireCustomerSession]`, `C:25` |
| C1 unknown SKU: 404, no body | `C:34`, `Q:83` |
| C2 `[]` with neither id; unknown SKU 404; quantity clamped 1 to 20; availability and reason text asked of Orders' pricing | `Q:114`, `Q:117`, `Q:126`, `Q:123-134` |
| C3 bad `status`: 400 `{ error: "status must be live or cancelled." }`, no `errors` | `C:56` |
| C3/C5 paging: `InvalidPageSize` (size ≤ 0) and `InvalidPageNumber` (> 1,000,000) as a `ValidationResponse`; size clamped to 100, default 20 | `P:31-47`, `Q:15-16` |
| C3 order: not cancelled first, then `nextDeliveryOn` (nulls last), newest start | `Q:30` |
| C4/C5 someone else's, an unknown or a malformed id: the same bodiless 404 | `C:71`, `X:34-40` (ADR-248) |
| C6/C7 bad `fulfilment` or `paymentMethod` (including blank): 400 `{ error }` | `C:180`, `C:186`, `C:173-191` |
| C6/C7 validator, every rule at once: `Quantity` 1 to 20, `IntervalWeeks` in the list ("is not an allowed interval."), `Fulfilment` ids agree, `SkuId` non-empty, `ExpectedVersion` ≥ 0 | `V:21-26`, `V:34-39` |
| C6 unknown SKU: 404 | `H:39-40`, `X:34-40` |
| C6 `SkuNotSubscribable` with the two texts | `H:42`, `H:43` |
| C6 `SubscriptionAlreadyExists` (one live per SKU); `SubscriptionLimitReached` (20 live) | `H:45-46`, `H:48-49` |
| C6/C7 `SubscriptionTerms.Create` refusals (S0's `createTerms`) | `H:54-59`, `H:107-115` |
| C6/C7 servability: `DeliveryAddressNotFound`, `AddressOutsideServedZones`, `PickupBranchUnavailable`, `PaymentMethodUnavailable` (Orders' text), `DeliveryTaxNotConfigured`, others on `Fulfilment`; first match in the server's order | `S:66-91`, `H:64-66`; C7 only when more than the interval changed `H:121-123` |
| C6 `InvalidFirstDeliveryDate` on `FirstDeliveryOn`; 201 with `Location` and the view without `cycles` | `H:71-77`, `C:105-106` |
| C7 stale `version`: 409 `StaleVersion` on `ExpectedVersion`; owner check first | `H:99-105` |
| C7 to C12 schedule refusals (`NoChangeRequested`, `InvalidSubscriptionTransition`, `CycleNoLongerSkippable` naming the next date, `SkipAlreadyScheduled`, `NoPendingChange`, `InvalidFirstDeliveryDate`) | S0's `schedule.ts` port of `SubscriptionSchedule.cs`; owner check `H:248-254` |
| C8/C10 a malformed date: ASP.NET's model-binding 400 (a `ProblemDetails`, `errors` an object) | model binding of `SkipSubscriptionRequest` and `ResumeSubscriptionRequest` |
| C10 a suspension: `SubscriptionSuspended` with the server sentence (the setting's 2); a paused subscription whose product cannot be bought: `SkuNotSubscribable` | `H:175-177`, `H:180-185` |
| C11 missing, blank or unknown `reason`: 400 `{ error }`; a staff-only reason: `Reason` ("is not a reason a customer can choose."); note > 500: `Note` | `C:141-142`, `V:66`, `V:63` |

## 5. Strings written by S1 (everything else is S0's `copy.ts`, `labels.ts` and `errors.ts`), for the owner to read

- Subscribe page: heading "Subscribe", "A repeat delivery of this product. Change, skip, pause or cancel whenever you like."; section headings "Per delivery", "How often", "Delivery or pickup", "How you'll pay for each order", "First delivery", "Price"; "Quantity per delivery", "Choose 1 to {max}.", "Each pack:", "Start subscription", "Starting your subscription…"; the error summary "We couldn't start your subscription"; "This product can't be subscribed to right now."; "Manage your subscription"; "Back to the shop"; "Loading outlets…"; "Choose a delivery address to see how you can pay." / "Choose an outlet to see how you can pay."; "Checking how you can pay…"; the client-side "Choose an outlet to collect from." and "Choose how you'll pay for each order."
- Offer: "Get this on repeat. Skip, pause or cancel any time."
- List: "No cancelled subscriptions.", "Subscriptions you cancel are kept here.", tab names "Current ({n})" and "Cancelled ({n})", "Suspended: see why", "Ended on {instant}", "Changes scheduled from {date}", "Waiting for your transfer: pay by {instant}".
- Detail: panel names "Next delivery", "Scheduled changes", "Your subscription", "Estimate for each delivery", "Deliveries so far" (columns Delivery, What happened, Order), "Contact the shop"; the pending sentences "New terms from the delivery on {date}: {terms}" and "The delivery on {date} is skipped"; "Choose another address"; "No orders yet. Your first one is placed on the delivery date."
- Dialogs: skip "We won't place an order for this delivery. Your other deliveries stay as they are."; pause/cancel/resume titles "Pause {product}?", "Cancel {product}?", "Resume {product}?", "Change {product}"; cancel unlocked "Your subscription ends now and no more orders are placed."; resume "Orders start again. Choose the date of the first delivery, or leave it empty for the earliest we can do."; withdraw "These changes will not happen, and your subscription carries on as it is now:"; "Choose a reason so we know how to improve."; button labels "Not now", "Keep it", "Keep it going", "Keep them", "Keep my subscription", "Save changes".

## 6. Where the code differs from the document, and findings (§20)

1. **§20.1 (resolved by Amended (j)):** the inline address form is `components/account/AddressForm.tsx` (fields 38 px, Cancel/Save 40 px, close X 24 px). The integrator authorised the change: its fields and Cancel/Save are now `min-h-11` (44 px), which also fixes checkout's address dialog. `components/ui/dialog.tsx` is unchanged; its 24 px X stays (WCAG 2.2 2.5.8 minimum) and a global dialog-close pass is a follow-up. `subscriptions-customer-360.spec.ts` now checks fields and buttons of that dialog for 44 px (not the X). No run-only spec asserts the old heights (searched `tests` for heights tied to the dialog). Also Amended (j)(3): the mock's undiscounted COD check is accepted.
2. **AddressForm only closes itself for a returned value.** The first version of `FulfilmentFields` left the dialog open after saving. The component test U13 found it and `FulfilmentFields` now closes it (checkout does the same). The e2e flows had not used that path.
3. **A chosen payment method that becomes unavailable.** After a quantity change C2 can stop offering the method the customer had. On the Subscribe form it is now replaced by the first available one (the form preselects as on arrival); in the change dialog it stays selected, disabled, with Orders' reason, and the server's refusal maps to the field.
4. **History layout switches on the container width** (`NARROW_CONTENT_PX`, 640 px, `useNarrowContainer`), not the viewport's 768 px, because the account sidebar takes 260 px at desktop widths. jsdom has no `ResizeObserver`, so the table is what tests see unless they stub it.
5. **Mock cannot see the discount in Orders' quote (§20.5).** The payment decision is Orders' own pricing (`computeQuote`) at the undiscounted price; the server quotes with the subscriber discount (`Q:130-132`, `S:60-62`). In the band between the discounted and the undiscounted total a cash-on-delivery order is refused by the mock and accepted by the server. Stricter, not looser; noted in `customer.ts`.
6. **The signed-in customer in the mock is always the accounts mock's Sam**, as in the ordering mock; another registered customer sees Sam's subscriptions. Fine for specs (they sign in as Sam); a spec that wants an empty customer edits the tab's `sessionStorage` copy of the store (`subscriptions-customer-360.spec.ts`).
7. **S0's `source-guard` flagged `totalCount / pageSize`** (the word "total" is a money name to the guard). The list pager reads `totalCount` into `rows` before dividing. Not an ignore comment, not a relaxed guard.
8. The e2e specs read the mock's seeded ids from `mocks/handlers/subscriptions/fixtures.ts` and the seeded dates from `seedDates()`; none computes a date.
9. Unknown wire values: none seen. Every C- row in the Contract inventory matched the mock and the client; no §20.2 difference was found.
10. Run-only specs: as a sanity check, `shop-product`, `portal-a11y-responsive`, `account-area` and `ordering-customer` ran once on both projects: 82 passed, 0 failed. A search of `tests/e2e` found no spec that counts the account menu's links (the one use of the "Main" navigation is `portal-dashboard.spec.ts:87`, by the Overview link's name). The other run-only chunks of E8 belong to the TEST gate; if one breaks on the menu it is §20.3 and goes to the integrator.

## 7. Verification (what was seen)

- `npx tsc --noEmit`: clean. `npm run lint` (`--max-warnings 0`): clean.
- Vitest at `--maxWorkers=2`, the files S1 touches or can reach: `tests/components/subscriptions`, `tests/components/portal`, `tests/components/product`, `tests/components/shop/no-hex-literals.test.ts`, `tests/components/back-office/no-colour-literals.test.ts`, `tests/unit/subscriptions`, `tests/guards`: 29 files / 596 tests passed. Not the full suite (TEST gate).
- Playwright (chromium and mobile-360, `--workers=1`, a fresh `next dev` on PORT=3128, `NEXT_PUBLIC_USE_MOCKS=true`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:5005`, `E2E_KEEP_ROUTES=1`): one run of the five specs on both projects, `--retries=0`: 84 passed, 4 skipped, 0 failed. `subscriptions-customer.spec.ts` 12 cases per project; `subscriptions-customer-360.spec.ts` 6 per project; `subscriptions-customer-a11y.spec.ts` 12 per project; `portal-dashboard.spec.ts` 12 per project; `subscriptions-customer-real-api.spec.ts` skipped (2 cases per project) because `E2E_REAL_API=1` is not set, so it was not run against a real API. Baseline cases: none of HO-P5's eleven is in these specs; none appeared.
- Not run here, by design: the full Vitest suite, the run-only chunks of E8, the two-zone run, the real API (`E2E_REAL_API`, `npm run test:contract`), `npm run build`, `sweep:a11y`.
- Cleanup: the dev server on 3128 and the Playwright processes were killed; `test-results` is ignored; no tracked screenshot changed.

## 8. For the human to double-check (cannot be seen without the rendered pages)

- The option cards for "How often" (five narrow cards) and for the payment methods, and the 4:3 balance between the product picture and the text on the cards.
- The status badge colours for Paused and Cancelled (both neutral) and Suspended (warning).
- The wording above in §5, especially the cancel dialog's "Choose a reason so we know how to improve." and the unlocked cancel sentence.
- Whether the "Subscribe & save 10%" button should sit full width under the add-to-basket row on phones (it does now).
- The overview card position: it sits beside "Default address" in the same grid.

## 9. After Amended (j)

AddressForm 44 px change; `tsc` and `lint` clean. Playwright at `--workers=1`, chromium and mobile-360, PORT=3128, mocks on: `subscriptions-customer`, `subscriptions-customer-360`, `account-area`, `ordering-customer`: 64 passed, 0 failed; `accounts-a11y-responsive -g ddress`: 10 passed. Vitest (`tests/components/account`, `checkout`, `subscriptions`): 16 files / 249 tests passed. Dev server on 3128 killed.

## 10. CODE_REVIEW, SECURITY and ARCHITECTURE fixes (phase 1)

- CR MEDIUM 1: `CycleHistory` "Show more" failure shows "Try again" for the failed page only; loaded pages stay, "Show more" is hidden until it loads. Test fails page 2, then page 3, and recovers.
- CR MEDIUM 2: `MySubscriptionsList` past the last page says "That page is past the end of your list." with "Go to the first page" (never "No subscriptions yet" when `totalCount` > 0). Tests: `?page=9`, and the Cancelled tab's page 2.
- CR LOWs: a polite status line announces a payment-method swap; dashboard U25 awaits the C3 answer; the test QueryClient has `retryDelay: 0` and the real sleeps and `{ timeout: 4000 }` waits are gone (`settle()` with simulated time); the tab is `?tab=cancelled` (with `?page=`); `StateTabs` sets `aria-controls` only on the selected tab; `SkipLinkHandler` waits for the re-read (`fresh`) before saying a date can no longer be skipped.
- SEC LOW: ids are `encodeURIComponent`-ed in the five hrefs and the router push.
- ARCH LOW 3: in the customer mock a non-GUID route id is a 404 before the session check, and the body is bound and validated before the ownership lookup (C7, C8, C10, C11); tests added. ARCH LOW 6: §1 reworded. Deferred by the integrator: the copy hoist, the `totalCount` alias, the Sam-only mock.
- Re-run: `tsc`, `lint` clean; Vitest (`components/subscriptions`, `portal`, `product`, `unit/subscriptions`, `guards`) 27 files / 386 tests; Playwright `--workers=1` chromium + mobile-360 on PORT=3128 (`subscriptions-customer`, `-360`, `-a11y`, `portal-dashboard`): 84 passed, 4 skipped (real-API). Dev server on 3128 killed.

## 11. Wording moved into `lib/subscriptions/copy.ts` (Amended (k))

Additions only to `copy.ts` (no existing export changed or reordered): the Subscribe page, offer, form, payment and outlet sentences; the My subscriptions empty and past-the-end texts; `nextDeliveryLine` and `warningLine` with `endedOnText`, `waitingForTransfer`, `changesScheduledFrom`; the history texts; the dialogs' headings (`pauseTitle`, `cancelTitle`, `resumeTitle`, `changeTitle`, `WITHDRAW_TITLE`) and descriptions; `placeText`, `termsSummaryText`, `paymentSwapNote`. Components, `termsDraft.ts` and the pages import them; `components/subscriptions/subscriptionText.ts` is deleted. One shared builder, `pendingChangeLines(view, 'customer' | 'staff')`, replaces S1's `pendingLines` and S2's private one in `components/staff-subscriptions/DetailPanels.tsx` (a one-function edit to an S2 file, wording unchanged); unit-tested in `tests/unit/subscriptions/pending-lines.test.ts`. Wording is unchanged; the only test edit is the `warningLine` import path in `list-and-detail.test.tsx`. Short button and field labels stay in their components.
Checks: `tsc` and `lint` clean; Vitest (`components/subscriptions`, `portal`, `product`, `staff-subscriptions`, `unit/subscriptions`, `guards`) 32 files / 466 tests; Playwright `--workers=1` chromium + mobile-360 PORT=3128 (`subscriptions-customer`, `-360`, `-a11y`): 60 passed. Dev server killed.
