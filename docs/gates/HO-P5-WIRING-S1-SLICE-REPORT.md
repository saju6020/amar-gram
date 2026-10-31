# HO-P5 S1 (store front) - slice report (§17.3)

Branch `feat/p5-s1-store-front` from `b4f7783`. Worktree `D:\my-repo\amar-gram\.claude\worktrees\agent-ae90eaf84a4b7e537`. Not pushed. HEAD is the commit that adds this file (see `git log`); the build is in `44a53c7`, `2074711` and `b3ab577`.

## 1. Files touched (all inside S1's §13 block; paths under `web/`)

Source: `lib/api/shop-catalogue.ts`, `lib/api/checkout.ts`, `lib/shop/catalogueParams.ts`, `app/(shop)/layout.tsx`, `app/(shop)/shop/products/[slug]/page.tsx`, `components/shop/ShopTopStrip.tsx`, `components/catalogue/{ProductCard,CatalogueFilters,ActiveFilterChips}.tsx`, `components/product/{ProductHeading,ProductDetailsTabs}.tsx`, `components/hearth/DeliveryPromise.tsx`, `components/checkout/{CheckoutScreen,PaymentSection}.tsx`, `components/orders/MyOrderDetail.tsx`, `mocks/handlers/shop/{store,catalogue}.ts`, `mocks/handlers/ordering/customer.ts`.

Tests: new `tests/components/catalogue/catalogue-p5.test.tsx`, `tests/components/product/product-p5.test.tsx`, `tests/components/shop/shell-p5.test.tsx`, `tests/components/checkout/rider-note.test.tsx`; appended `tests/components/catalogue/catalogue-params.test.ts`, `tests/components/catalogue/product-card.test.tsx`; e2e `tests/e2e/{shop-catalogue,shop-product,shop-shell,shop-home,ordering-customer}.spec.ts`.

Block files read and left unchanged (not needed): `lib/hooks/useCheckout.ts`, `FilterGroup.tsx`, `FiltersSheet.tsx` (it renders `CatalogueFilters`, so the District group and its count come with it), `BannerStrip.tsx`, `CatalogueControls.tsx`, `CatalogueView.tsx`, `ProductDetailsRow.tsx`, `app/(shop)/shop/products/page.tsx`, `OrderPanels.tsx`, `app/(portal)/portal/orders/[orderId]/page.tsx`.

Nothing outside the block was edited. No `src/`, config, dependency or subscription change.

## 2. §20 requests (what S1 could not do, with the exact change)

**20.1-A. The product page lead time (11.2.6, U12 wiring, E3's "delivery card states the lead time") is not wired end to end.** `DeliveryPromiseCard` is rendered by `components/product/BuyBox.tsx:75` (`<DeliveryPromiseCard />`), which `app/(shop)/_components/ProductPurchase.tsx` renders. Neither file is in any §13 block, so S1 cannot pass `leadTimeDays` down. Built: `DeliveryPromiseCard({ className, leadTimeDays? })` and its text (U12 passes). Not built: the page does not read the promise, because there is nowhere to pass it. Needed, for whichever owner the integrator picks:
1. `ProductPurchase.tsx`: add prop `leadTimeDays?: number | null` and pass it to `<BuyBox leadTimeDays={leadTimeDays} … />`.
2. `BuyBox.tsx`: add prop `leadTimeDays?: number | null`; change line 75 to `<DeliveryPromiseCard leadTimeDays={leadTimeDays} />`.
3. `app/(shop)/shop/products/[slug]/page.tsx` (S1): `settle(getDeliveryPromiseServer())` in the existing `Promise.all`, and `leadTimeDays={promise.ok ? promise.value.leadTimeDays : null}` on `<ProductPurchase>`. `getDeliveryPromiseServer` already exists. A failed read must render no lead time and no error.
S1 did not use a React context or any other route round the missing props.

**20.1-B. `tests/components/checkout/checkout.test.tsx:562` now fails (run-only file, not in S1's block).** It asserts `expect(screen.queryByText(/note for the rider/i)).not.toBeInTheDocument();` for the default Delivery checkout (test "U25: three numbered regions…"). That is the HO-P3 G4 absence this pass supersedes (§15 header). Needed change: replace that line with `expect(screen.getByLabelText('Note for the rider (optional)')).toBeInTheDocument();` and the comment "No stepper, no Continue buttons." Everything else in the file passes. S1 did not edit the file. Until it is routed, this one test is red, and the TEST gate's full Vitest run will show it.

## 3. Superseded assertions (old to new)

| Old | New |
|---|---|
| HO-P3 U6, `product-card.test.tsx` "U6: no Organic badge on a card (catalogue items carry no certifications yet)" | "U6: the Organic pill shows only when the item is CertifiedOrganic, with the text Certified organic". Keeps the old "no pill and no hidden text" check for an item with no certifications, and adds the same for an item with other certifications only. Adds the positive: pill `bg-leaf text-leaf-soft`, hidden "Certified organic" `sr-only`, card link name unchanged. |
| HO-P3 e2e `shop-catalogue.spec.ts` "S2: the heading band carries the h1 and the count; there is no District filter" (`getByText('District')` count 0) | Same test, renamed "…; the District filter is offered": same band and count assertions, and the District group toggle is visible (phone sheet and desktop). Plus two new district tests. |
| HO-P3 U13's "no free-delivery amount" (strip only) | `shell-p5.test.tsx` U10 asserts the strip text. The HO-P3 U1 cases (banner as plain text, link, nothing without a banner, unsafe link) are unchanged and still pass. |
| HO-P3 `catalogue-p3.test.tsx` "has no District filter (G1)" | Not edited (file not in S1's block). It still passes because its fixture has no `districts`, which is the "no group when empty" case. The positive case is in `catalogue-p5.test.tsx`. |
| `checkout.test.tsx:562` "no rider note" | Needs the change in 20.1-B. |

## 4. OQ defaults built to

- OQ-1 / ADR-FE-187: the promise takes the strip when `freeOver` is non-null; then every `Shop` banner goes to `BannerStrip`. Otherwise the HO-P3 behaviour. A failed promise read counts as "no promise" (U11).
- OQ-2: no place name in the strip. Text is exactly "Free delivery over ৳5,000.00 · Cash on delivery across Bangladesh", the amount through `formatMoney`.
- OQ-3: lead time worded "Standard delivery usually takes {n} day(s)…" in `DeliveryPromiseCard`. See the judgement call in 6.1 and the missing wiring in 20.1-A. The file's header comment records the owner rule it now overrides for these two figures.
- OQ-4 (G5b): no basket "Add ৳X more" hint.
- OQ-5: card eyebrow is the district when present, else producer and country. Product page: "Grown in {district}" above the existing producer · country line.
- OQ-6: "Village on every pack" not built; `PromiseStrip` unchanged.
- OQ-7: the rider note shown to the customer as plain text, "Note for the rider" (label) and the note (value). The delivery panel is in `MyOrderDetail.tsx` (the "Delivering to" card), not in `OrderPanels.tsx` as 11.2.9 says; the element is where the panel actually is.
- OQ-8: `compareAtPrice` is not added to the `lib/api` types or shown. The mock sends it (the server does), but nothing reads it.
- OQ-10: customer `Packed` hero, headline "Your order is packed", tracker stays on the Packing node (S0).
- ADR-FE-186: the rider note is `CheckoutScreen` state only. Not in the URL and not in storage (`rider-note.test.tsx` and E5 assert both). Sent only for Delivery, trimmed, `maxLength` 300, live count "{n} of 300", kept across a retry with the same `Idempotency-Key` (the key is derived from the request signature, which includes the note).

## 5. Carry-forwards from the S0 ACCEPTANCE sheet

- `MyOrderDetail.tsx`: `Packed` added to the hero set, the cancel hint (`cancelBlocked`, with its own sentence "It's already packed…"), the return hint and the `heroSentence` / `headline` cases. Tested against the seeded Packed order (handed to the signed-in customer inside the test, since the seed belongs to another customer).
- `PERSIST_KEY` in `mocks/handlers/shop/store.ts` bumped to `__purrcare_shop_mock_db__v2`.
- The public builders (`catalogueItem`, `detailView`) send `districtOfOrigin`, `certifications`, `compareAtPrice` only. `organicCertificateExpiresOn`, `organicCertificateFileId` and `scheduledCompareAtCents` are not sent; `catalogue-p5.test.tsx` asserts the list and detail JSON contain none of them.
- `compareAtCents` becomes `{ amount, currencyCode }` by string handling (`String(cents).padStart(3,'0')` then slice), no division or float.
- The rider note renders as text (React escape; tested with markup, and e2e with `<b>`), and stays out of URLs and storage.
- §4.3: no subscription endpoint or field; nothing computed in the browser; no colour literals (the hex-literal and guard tests pass).
- U4's "amounts kept" strengthening and `status-vocabulary.test.ts` seed counts: not touched (S0 file, and S1 added no seed).

## 6. Mock refusals added, with the server file:line mirrored

| Mock | Refusal / behaviour | Server |
|---|---|---|
| `GET /api/shop/products` (`mocks/handlers/shop/catalogue.ts`) | more than 20 `district` values: 400 `InvalidCatalogueFilter`, `propertyName: "district"`, "district cannot have more than 20 values." | `src/Api/AmarGram.Api/Controllers/ShopCatalogueController.cs:37-38`; limit `src/Shared/AmarGram.Shared/Common/Constants/ShopSearchRules.cs:9` |
| same | a value over 60 characters: 400 `InvalidCatalogueFilter` on `district`, "district cannot exceed 60 characters." Blank values are dropped and values trimmed first. | `ShopCatalogueController.cs:36,39`; `ProductRules.cs:13` |
| same | `district` filter is case-insensitive on the stored name; `appliedFilters.district` echoes the values | `src/Read/AmarGram.Read/QueryHandlers/Product/GetCatalogueQueryHandler.cs:106-109, 236` |
| `GET /api/shop/filters` | `districts[{ value, count }]`, merged case-insensitively | `GetCatalogueFiltersQueryHandler.cs:50-56` (see 6.1 on the order) |
| `GET /api/shop/delivery-promise` | primary zone = storefront branch's active zone, lowest priority then name, with an active Standard service; `{ currencyCode, freeOver, leadTimeDays }`, all null without one; `freeOver` null when the Standard level has no threshold | `ShopCatalogueController.cs:113-121`; `Read/QueryHandlers/Order/OrderConfigurationQueryHandlers.cs:138-162` |
| `POST /api/customers/me/orders` (`mocks/handlers/ordering/customer.ts`) | `riderNote` over 300 characters: 400 `RiderNote` / `MaximumLengthValidator` | `src/Application/AmarGram.Application/CommandHandlers/Validators/PlaceOrderCommandValidator.cs:24`; `OrderRules.cs:16` |
| same | a C0 control character other than tab, LF, CR: 400 `RiderNote` / `PredicateValidator`; both rules failing give two violations; the check runs before the quote and idempotency-conflict checks, as the validator does | `PlaceOrderCommandValidator.cs:24`; `src/Shared/AmarGram.Shared/Common/Helpers/ControlCharacters.cs:17-27` |
| same | note kept for Delivery, silently dropped (null) for Pickup, read back as `fulfilment.riderNote` | `src/Application/AmarGram.Application/CommandHandlers/Order/OrderPlacement.cs:21-33`; `CustomerOrdersController.cs:68` |

`rider-note.test.tsx`, `catalogue-p5.test.tsx` and `shell-p5.test.tsx` carry the U47 case for each row.

### 6.1 Where the code differs from the document, or a default looked wrong (§20.2 / §20.6)

1. **District facet order.** The inventory and the handler comment say "most products first, then A-Z". The code (`GetCatalogueFiltersQueryHandler.cs:55-56`) orders by name only, case-insensitively. The mock and the UI follow the code (UI shows the order sent). The integrator may want a §1 Amended row.
2. **`DeliveryPromiseViewModel.CurrencyCode` is nullable** (`string?`, `GetDeliveryPromiseQuery.cs:14`); the document types it as a string. The type is `string | null`.
3. **`CatalogueFilters.districts` is optional in the type.** The server always sends it, but `tests/components/catalogue/catalogue-fixtures.ts` (not in S1's block) builds a `CatalogueFilters` without it and would not type-check otherwise. The component treats a missing field as empty.
4. **A lead time of 0 days** keeps today's text instead of "usually takes 0 days". Not in the document; the owner may want a different sentence for same-day delivery (OQ-3 follow-up).
5. **`MyOrderDetail` Packed wording is S1's own** ("Your order is packed"; "It's packed and we'll tell you when it's on its way / ready to collect"). The handover gives no wording. Please check.
6. **The District tab in "Origin & producer"** lists District only when the tab already exists (country, producer or notes). A district alone does not create the tab; `product-p3.test.tsx` "a tab with no API data is not rendered" requires that, and a product always has a producer.
7. **Maintenance mode in the delivery-promise mock.** 11.2.10 says to honour it "as the other storefront mocks do"; none of the shop mocks return a 503, so the promise mock does not either.
8. **Cards are per product in the shop mock**, not per size as on the real API. The mock sends `compareAtPrice` on a card only when the product has exactly one active size.

## 7. Verification (what was seen)

Machine note: `Get-CimInstance Win32_OperatingSystem` is refused by this sandbox for a worktree agent, so FreeVirtualMemory was not read. Node's `os.freemem()` showed 14.4 GB free of 31.5 GB before the e2e runs. No 0xC0000142 occurred. One `next dev` on port 3121 (started by this agent, killed between chunks and at the end); S2's 3122 was not touched.

**typecheck** (`npm run typecheck`): clean, after the last change.
**lint** (`npm run lint`, `--max-warnings 0`): clean, after the last change.

**Vitest** (`--maxWorkers=1`; the full suite was not run, per Amended (n)):

| File | Result |
|---|---|
| `tests/components/catalogue/catalogue-p5.test.tsx` (new) | 11 passed |
| `tests/components/product/product-p5.test.tsx` (new) | 4 passed |
| `tests/components/shop/shell-p5.test.tsx` (new, node environment) | 10 passed |
| `tests/components/checkout/rider-note.test.tsx` (new) | 12 passed |
| `tests/components/catalogue/catalogue-params.test.ts`, `product-card.test.tsx` (appended) | passed |
| Run together with all of `tests/components/shop`, `tests/components/orders`, `tests/components/product/product-p3.test.tsx`, `tests/components/checkout/checkout.test.tsx` | 25 files passed, 1 failed: `checkout.test.tsx` "U25" at line 562, the 20.1-B assertion. 461 of 462 tests passed. |
| `tests/components/shop/no-hex-literals.test.ts` (U46) and `tests/guards` | 3 files, 218 tests passed |

Earlier, before the `ProductDetailsTabs` fix in 6.1(6), `product-p3.test.tsx` "a tab with no API data is not rendered" failed; it passes now with an unchanged assertion.

**Playwright** (`--workers=1 --max-failures=20`, `--project=chromium --project=mobile-360`, PORT 3121, warmed routes, server restarted between chunks). E6 was not run.

| Spec (§16) | Result |
|---|---|
| E2 `shop-catalogue.spec.ts` | 26 passed (13 per project), includes the 3 new district / Organic tests per project |
| E3 `shop-product.spec.ts` | 18 passed, includes 2 new per project. The lead-time assertion is **not** present (20.1-A) |
| E4 `shop-shell.spec.ts`, `shop-home.spec.ts` | with E3 in one run: 36 passed, 4 skipped (the specs' own phone-only or desktop-only skips). New: strip text on `/shop` and `/shop/products`, axe clean (serious / critical) on `/shop/products`; strip above the header on the home page. "Banners still render below" is covered by `shell-p5.test.tsx` only: no `Shop` banner is seeded, and a banner created in the browser is not visible to the server-rendered layout. |
| E5 `ordering-customer.spec.ts` | 16 passed (8 per project), includes the new rider-note test: note typed, field hidden on Pickup and back, delivery COD placed, note shown on the order as text, URL clean |

No known baseline failure appeared in these five specs. No load timeout or crash occurred, so none was rerun.

## 8. Left undone

- The product page lead time wiring (20.1-A).
- `checkout.test.tsx:562` (20.1-B).
- The basket "Add ৳X more" hint (G5b), the packing-slip note (G4b), the place name in the strip (G5c) and the village (G1 residual): residual gaps by design.
- Screenshots at 360 and 1280 for ACCEPTANCE: this agent cannot see the rendered result. Please check by eye: the leaf strip text wrapping at 360 px; the "Organic" pill beside "In basket" (same colours, both `bg-leaf`); the District group closed by default in the filter card; the rider note field spacing under the payment options.
- E6 and E17 are not run here (E17 per Amended (l)); the TEST gate and integration run them.
