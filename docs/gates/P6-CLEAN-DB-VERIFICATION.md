# P6 real-API re-run on a clean database

Branch `fix/p6-owner-wording`, head `c4076be`. Sheet: `docs/test-cases/TC-P6-CLEAN-DB.md` (every row observed). Screenshots: `docs/gates/screenshots/P6-CLEAN-DB/` (4 PNG, 1280 and 360). Nothing pushed.

## Verdict

The failures of the polluted run are gone: inventory R-A2 and the 10 cases after it pass, journey 5e, 5f and both console cases pass, the contract policy row passes, real-api-verification register and reset pass. The wording fix is confirmed on the real API (W1 to W3). Remaining red rows are none in product code: contract owner item 13 (expected), two desktop-only specs run at 360 (billing E-A1, journey step 1), and one cold-start sign-in race (real-api-verification staff sign-in). Integration class 17 of 17. **No product defect found.** R2 stays BLOCKED.

## Results

- **Databases created:** `amargram_p6clean` (e2e), `amargram_p6clean_it` (integration). Nothing dropped; `amargram_dev` untouched.
- **Contract:** 71 passed, 1 failed (shop products skuId/sizeLabel, owner item 13). The policies row passes. Cash-ups `sourceKey` did not reproduce, but only because `lines[]` is empty on clean data (the field is not compared); the drift stays latent.
- **chromium and real-api projects (68 cases):** 59 passed, 7 skipped (5 staff-subscription cases had no SUBS_SEED in that first run, 2 xct offline by design), 2 failed. The staff-subscription cases then passed 5 of 5 once fixtures existed. Failures: xct E-C3/E-C4 (passes alone, flake); real-api-verification staff sign-in (fresh browser, first attempt fails with an empty identifier box, repeat attempts pass: hydration race, test or environment).
- **mobile-360:** 37 passed, 2 failed, 24 did not run. portal, xct, reports, inventory (12), subscriptions customer and staff pass. billing E-A1 and journey step 1 fail on desktop-only selectors (the "Invoice lines" table is a list at 360; the Producer filter is behind a Filters button), cutting off 13 and 11 serial cases. Test defects.
- **Wording fix:** subscription order ORD-2026-000004: API `discountCode` null, `lineDiscountLabel` "Subscription discount (10%)"; screen shows "Subscription discount (10%)" and a bare "Order discount", no "Discount code" row. Typed-code order ORD-2026-000003: "Order discount (WORDFIX10)", Discount code WORDFIX10, "Item discounts". 1280 and 360, no sideways scroll.
- **Integration:** `SubscriptionsGenerationEndpointTests` 17 of 17 on `amargram_p6clean_it` after migrating it with `dotnet ef database update`; the first run on the empty database failed 17 of 17 (`audit.audit_entry` missing; the test factory does not migrate).
- **Fixture notes:** the worker interval is 900 s by default, so the API was restarted once with `Subscriptions__Worker__IntervalSeconds=20` to raise the subscription order. Only Ajwa Dates was subscribable on a seeded DB; five more products were set subscribable by SQL for the staff fixtures. `seed-e2e-real-api.mjs` works unmodified on a fresh DB.
