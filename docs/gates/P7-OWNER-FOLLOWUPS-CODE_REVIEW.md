# P7 owner follow-ups, CODE_REVIEW (batch 1)

VERDICT: PASS

Scope: e9f24d8..94288ed (8 files): fix/p7-invoice-mixed-it f947851 (I_D5c, I_D5d) and fix/p7-storefront-mock bebb61f, d4a0710, 80a92b6 (shop mock one card per size, cash-up lines always carry sourceKey). Read-only review; the suites were run by the implementers and by the P7 verification run.

## (a) Mixed-label invoice tests
- They exercise both branches of InvoiceQueryHandlers.cs 88-91 / 112 / 116-119 (draft estimate and issued invoice). I_D5c: one labelled line plus one unlabelled line. I_D5d: 10% and 5% cycles reach the Distinct().Count() != 1 branch. totals.discount > 0 is asserted, so the null label is not a vacuous pass.
- The ordering is deterministic: lines are sorted by description, orders by PlacedOn after a 28-day clock advance, and cycles by CycleOn.
- Settings cleanup: the setting is reset to 0 in a finally block, and the class is in AdministrationGlobalSettingsCollection.
- WARN 1: the charge discount amounts are arbitrary. A comment should say so.
- WARN 2: I_D5c uses Guid.NewGuid() for the ordinary order. It takes the same null branch, so this is optional.
- WARN 3: the finally block can mask the original failure. It is the same pattern as I_D5, so not a regression.

## (b) Shop mock and cash-up mock
- catalogueCards / getList match CatalogueSizeExpansion.cs and GetCatalogueQueryHandler.cs 61-63. That covers per-product paging, totalCount, totalItemCount, priced active SKUs, single-size behaviour, sort order with the SKU-code tie-break, per-size filters on multi-size products only, the per-size fields and photo, and the sizeLabelOf null rule.
- Cash-up lines: sourceKey null on the payment, reversal and carried-in lines matches CashUpRows.SourceOf.
- Suggestions:
  - (1) The tie-break compares ordinally, while the C# comparer is culture-sensitive. It only matters for mixed-case codes.
  - (2) A product with no priced size should send sizeLabel: null.
  - (3) Per-size photo url is null, the same as for product images.
  - (4) Coverage gaps: single size, tie-break, per-size inStock and minPrice, photo choice, and the sizeLabel null rule. There is also one redundant assertion.
- The updated tests are strengthened, not weakened.

## Batch 1 suggestions applied (follow-up commit)
- The invoice-test helper now says the discount amounts are arbitrary (WARN 1).
- A shop product with no priced size sends skuId and sizeLabel as null, as the server does (suggestion 2).
- mock-contract.test.ts adds two cases: the per-size minimum price filter, and that skuId and sizeLabel are always present. The redundant assertion is dropped. Shop Vitest 318/318, tsc and eslint are clean, and the IntegrationTests project builds.
- Not done, minor: WARN 2 (a real ordinary order in I_D5c), WARN 3 (the finally pattern, same as I_D5), suggestion 1 (culture-sensitive tie-break), suggestion 3 (photo url).

# CODE_REVIEW (batch 2): 94288ed..22e2ce1, items 1 and 6

VERDICT: PASS, no Critical or Warning findings.

- **Progress-bar probe:** it still proves the bar appears. NavigationProgress renders its node only while active, so an added-node record cannot be a false positive. The click retry still fails if the bar never shows. It tolerates only the listener-hydration race, which is recorded as a product observation.
- **Locators:** getByLabel on a ResponsiveTable caption works for both the table and the 360 list. withFilters uses the inline panel on desktop and the sheet at 360.
- **Shared acceptPendingPolicies:** it behaves the same as the subscriptions copy. The journey is now stricter than it was and cannot falsely pass. shop-helpers stays dependency-free, and no dead code is left.
- **Low suggestions:**
  - (1) Journey 5c `getByRole('main').getByText('Dhaka')` was too broad. Applied: it is now scoped to the 'Delivery zones' table or list. A temporary mock-mode check passed on chromium and mobile-360.
  - (2) `.first()` after getByLabel assumes ResponsiveTable does not render both copies. Low risk, not changed.
  - (3) The helper's non-array body gave a misleading message. Applied: it now asserts the body is an array.
