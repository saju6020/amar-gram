GATE: SECURITY
HANDOVER: HO-P3-STORE-FRONT
COMMITS: e29a0ae (S0), c38bb9d (S1), 5c5af0e (S2), 24ad5f7 (S3), b1b237c (S4), f7fe2af, 3c98022 (integrator), 1aa6e76 (backend gaps G1/G4/G5/G8) -- each diffed against its own parent
DATE: 2026-10-25
STATUS: PASS

FINDINGS
- [LOW] src/Read/AmarGram.Read/QueryHandlers/Order/OrderConfigurationQueryHandlers.cs:433 (also src/Api/AmarGram.Api/Controllers/ShopCatalogueController.cs:115) — the anonymous `GET /api/shop/delivery-promise` returns `zoneName` and `currencyCode` as well as the threshold and lead time. The currency is public anyway. The zone name is a label staff write, and it is now readable without signing in. No customer, address or pricing data leaks, and the endpoint keeps the controller's `[PublicEndpoint]`/`[StorefrontEndpoint]` and the `Catalogue` rate limit. Remediation, if zone names are internal: drop `ZoneName` from `DeliveryPromiseViewModel`. The web does not read it yet.

VERIFIED (no finding)
- `?next=`: sign-in still goes through `sanitizeNextPath(next, CUSTOMER_RETURN_PREFIXES, DEFAULT_CUSTOMER_LANDING)` before `router.push` (app/(auth)/sign-in/page.tsx). S4's `AuthModeSwitch` links on sign-in and register are both built with `withCustomerNext`, which runs the same allow-list (lib/routing/portal-links.ts:24). The basket's "Go to checkout" is a fixed `/sign-in?next=%2Fcheckout` (components/cart/CartScreen.tsx:102). `lib/validation/nextPath.ts` is not changed.
- Account deletion: the only caller of `useDeleteAccount` is still app/(portal)/portal/account/data/delete/page.tsx. The password field and "I understand" checkbox in `DeleteAccountForm` are unchanged (style only). `PersonalDataExportCard` only links to that page.
- No card or gateway UI: PaymentSection shows server payment options and their `message` as text. No card fields.
- No `dangerouslySetInnerHTML` or `innerHTML` in any non-test web file. Banner `linkUrl` goes through `isSafeLink` (relative paths, but not `//` or `/\`; https only; tab, CR and LF rejected) in ShopTopStrip, SeasonalCard, ShopHero and BannerStrip. Descriptions are rendered through `plainExcerpt` as text or through `LimitedMarkup`. Shipment tracking links use `safeHttpUrl`.
- Checkout idempotency: `useIdempotencyKey` and `useCheckout` are unchanged. The key is `keyFor(JSON.stringify(request))`, and the request includes `quoteFingerprint` and every choice. So a different order body always gets a new key, and only an identical body retries with the same key. `renew()` runs after success, and `settleFailure` runs on definitive refusals. A `submitting` ref guards double clicks, and Place order is disabled while `placing`/`urlSettling`/the quote is fetching (components/checkout/CheckoutScreen.tsx:169, 299-327). `useMergedUrlUpdate` (CheckoutScreen.tsx:48-97) only merges URL patches. It never touches the key or calls place, so it cannot cause a double place or reuse a key across orders.
- Guest-cart cookie: no browser code reads it. The only `document.cookie` reads are the existing CSRF-token helpers, none of them in the changed files.
- "Buy again" (components/portal/dashboard/BuyAgain.tsx) adds `{ skuId, quantity: 1 }` through the existing `useAddCartLine` hook. No price is computed on the client.
- District (G1): query filter is trimmed, at most `MaxFilterValues` values and at most 60 characters each (ShopCatalogueController.cs:57-59). The domain normalises it and refuses control characters (ProductAggregate NormaliseDistrict), and the staff validator caps length and refuses control characters. The filter is a LINQ `Contains`/`ToLower` translated by EF, so it is parameterised. There is no raw SQL.
- Rider note (G4): validator allows at most 300 characters and no control characters (PlaceOrderCommandValidator.cs:24), and the column is capped at 300. It is not stored for pickup. `FulfilmentDetails.Redacted()` now redacts `RiderNote`, and `OrderAggregate.Redact()` is the only anonymisation path, so no bulk-SQL bypass exists. It is exposed only through the existing order-detail queries, which already enforce the customer's ownership and staff permissions.
- G8: certification display names are added to catalogue items. These are public data.

NOTES (not security, for later gates)
- The web checkout does not send `riderNote` yet: no `riderNote` reference anywhere under web/. G4 exists only on the backend.

SCOPE CHECK
- files in allowed scope: per the ARCHITECTURE gate (docs/gates/HO-P3-STORE-FRONT-ARCHITECTURE.md) and the HO-P3 §1 Amended row; not re-litigated here
- files outside allowed scope: none found by this gate
