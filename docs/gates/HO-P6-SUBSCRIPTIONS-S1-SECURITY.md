GATE: SECURITY
HANDOVER: HO-P6-SUBSCRIPTIONS (slice S1, customer screens and mock handlers C1-C12)
COMMITS: ba0a2a1, 43c997a, 5655e75, 06d94c9, 549747e, 8a45479, c1dc7a2 (base f55ea58; 3492513 is a merge of the base branch and was not re-reviewed)
DATE: 2026-11-07
STATUS: PASS

FINDINGS
- [LOW] web/components/subscriptions/SubscribeOffer.tsx:29, :43; SubscribeForm.tsx:51; SubscriptionCard.tsx:20;
  NextDeliveryCard.tsx:37; CycleHistory.tsx:22 — path ids in `href` template literals (`existingSubscriptionId`,
  `skuId`, `subscription.id`, `cycle.orderId`) are interpolated without `encodeURIComponent`. Every value comes from
  the server (GUIDs), and each link has a fixed same-origin prefix (`/portal/...`), so the worst a bad value could do is
  point at another same-origin path. It cannot redirect off-site, and nothing is fetched or mutated on navigation. This
  matches the existing convention (components/orders/MyOrdersList.tsx:111, MyOrderDetail.tsx:357). Suggested fix (not
  blocking): wrap each id in `encodeURIComponent(...)`, as the API client already does
  (web/lib/api/subscriptions.ts:287).

Checked:
- Object-level authorization (mock): every id-bearing handler (C4, C5, C7, C8-C12 via `ownedChange`,
  customer.ts:373-386) checks for a session (401 without one), then the GUID shape, then
  `findOwnSubscription(CUSTOMER_ID, id)` (store.ts:249-251, which matches on id and customerId). An id that is someone
  else's, missing or malformed gets the same bodiless `new HttpResponse(null, { status: 404 })` (customer.ts:90). C3
  filters on `customerId === CUSTOMER_ID` (:439). C1's `existingSubscriptionId` is scoped to the caller
  (`findLiveFor(customerId, skuId)`, store.ts:592). In C7, shape validation runs before the ownership lookup, as the
  server's validator does. The 400s depend only on the body, so an attacker learns nothing about ownership from them.
  The delivery address is resolved against the caller's own address book (`/api/customers/me/addresses`,
  customer.ts:197-207). An address that is not in the book refuses with `DeliveryAddressNotFound`.
- UI ownership: the detail page trusts nothing client-side. It renders only the server's view, offers only
  `allowedActions`, and shows a 404 as "We couldn't find that subscription." with a link back
  (SubscriptionDetail.tsx:91-102).
- Skip link (SkipLinkHandler.tsx:35-44): the value is read once, only after the detail has loaded. It must match
  `^\d{4}-\d{2}-\d{2}$` and equal the server's `skippableCycleOn`, and even then it only opens the confirmation dialog
  (`openSkip` sets state). The mutation runs only from the dialog's confirm button (SkipDialog.tsx:30, :49). A stale
  date shows a banner that needs a click. A malformed date is ignored. In every case `router.replace(pathname)` strips
  the parameter. A crafted link cannot skip a delivery. `?subscribed=1` is read once and only shows a message.
- Sign-in round trip (§20.7): CustomerSessionGuard.tsx and lib/validation/nextPath.ts are not changed in this range.
  The guard sends `pathname + search` to `?next=`, and `sanitizeNextPath` (same-origin resolve, no `//`, no backslash or
  control characters, prefix at a `/` boundary) still decides what is honoured. The SKU is a path segment
  (`/portal/subscriptions/new/[skuId]`) and `?skip=` rides in the query, so both survive the round trip without a new
  return parameter. No new `returnTo`/`next` handling was added anywhere.
- Route params: `skuId` and the detail id reach the API only through lib/api/subscriptions.ts, which uses
  `encodeURIComponent` for path segments (:287) and `URLSearchParams` for `?skuId=`. There is no client-side `isGuid`
  pre-check. The handover does not require one: the server and the mock answer a non-GUID with 404 (detail) or a
  binding 400 (options), and the UI maps both to fixed sentences.
- Inline address form: FulfilmentFields reuses `AddressForm`. TermsFields.tsx:61, :139 saves the address through
  Accounts' existing `useAddDeliveryAddress` (apiFetch with the customer's session). There is no new auth path. The
  AddressForm diff (c1dc7a2) changes only CSS classes.
- No payment capture (§20.8): payment is a choice among CashOnDelivery, BankTransfer and PayAtPickup. There are no card,
  wallet, "save for next time" or auto-charge controls. tests/components/subscriptions/no-literals.test.ts:41 guards
  against cc-autocomplete, card number, CVV/CVC, expiry, "save card" and auto-charge.
- Rendering and storage: no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `new Function`. Server sentences
  (`errorMessage`, `message`, `notSubscribableReason`, `unavailableReason`) are rendered as React text. No new
  localStorage or sessionStorage use, and no `console.*` in app, component or lib code, so no PII is logged or stored. The
  product image goes through the existing `resolveFileUrl` into `<img src>`, which is not a script sink.
- Mocks dev-only: no app, components or lib file imports `@/mocks` except the unchanged lib/dev/mock-worker.ts gate
  (NODE_ENV=development and NEXT_PUBLIC_USE_MOCKS=true). The mock's address-book fetch is built from the request's own
  origin.
- No new dependencies: web/package.json and the lockfile are unchanged. No secrets. The real-API e2e spec uses
  env-gated runs and a throwaway password for a freshly registered test user. The mock spec uses the existing fixture
  password.
- The product page shows `SubscribeOffer` only when `signedIn` and the SKU has a price (ProductPurchase.tsx:159-161).
  The server's 401 has the last word.

SCOPE CHECK
- files in allowed scope: 60/60 (§13 S1 block; AddressForm.tsx per Amended (j)(1); handover §1 Amended row (j);
  S1 test-case sheet and slice report)
- files outside allowed scope: none
