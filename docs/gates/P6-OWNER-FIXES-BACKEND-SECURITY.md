GATE: SECURITY
HANDOVER: P6-OWNER-FIXES-BACKEND
COMMITS: 5d76e6b 7c05d5e 19dc91f 451de8f 9116de7 (range d83ef5f..9116de7, branch fix/p6-owner-backend)
DATE: 2026-11-09
STATUS: PASS

FINDINGS
- none (no Critical, High, Medium or Low issue found in scope)

WHAT WAS CHECKED
- nextDeliveryOn input validation and injection:
  src/Api/AmarGram.Api/Controllers/StaffSubscriptionsController.cs:141-154 (TryDueDate) parses with
  DateOnly.TryParseExact("yyyy-MM-dd", InvariantCulture). Anything else gets a 400 with a fixed message
  that does not echo the input. Blank means no filter. Called before the query on both List (:33) and
  Export (:69). Only a typed DateOnly reaches
  src/Read/AmarGram.Read/QueryHandlers/Subscription/SubscriptionStaffQueryHandlers.cs:27, and that is an
  EF LINQ predicate, so it becomes a parameterised query with no string concatenation and no SQL
  injection path.
- CSV export: the column set at StaffSubscriptionsController.cs:76-78 is unchanged (NextDeliveryOn was
  already a column). The filter adds no new column and writes no user text into the file. Cells still go
  through InventoryCsv.Build and its existing formula-injection guard. The 413 row cap still applies after
  filtering.
- Authorisation: List keeps [RequireAction(Actions.Subscriptions.View)] (:27) and Export keeps
  [RequireAction(Actions.Subscriptions.Export)] (:64). No attribute, route or policy changed. Export still
  passes CustomerId = null, as before. The filter only narrows the result.
- Discount labels, data exposure and scoping:
  src/Read/AmarGram.Read/QueryHandlers/Subscription/SubscriptionDiscountLabels.cs:18-30 takes only the
  order ids it is given. On the customer and staff order detail (OrderQueryHandlers.cs:146,
  StaffOrderQueryHandlers.cs:172) that is the single order already loaded and access-checked by the
  existing handler. On the invoice detail and PDF (InvoiceQueryHandlers.cs:88, :237) it is the SourceIds
  of that invoice's own Order-kind lines. The cycle lookup matches on SubscriptionCycle.OrderId equal to
  that order's id. OrderId is unique where it is not null (SubscriptionCycleConfiguration.cs:42,
  ix_subscription_cycle_order), so the lookup resolves at most the order's own cycle. The label holds only
  the constant "Subscription discount" plus the cycle's DiscountPercent formatted as a decimal. It carries
  no id, no customer data and no data from another customer. A customer cannot forge the label: it is
  shown only when DiscountCodeId is null and DiscountCodeText is exactly "Subscription discount", and
  checkout writes DiscountCodeText only from an applied code (PlaceOrderCommandHandler.cs:108,
  CompleteCounterSaleCommandHandler.cs:156), which always has an id and is upper-cased. Even a forged
  label would be cosmetic, because amounts are not read from it.
- PDF text: QuestPdfBillingRenderers.cs:247 joins (DiscountLabel ?? "discount") with Money(...). The label
  comes from SubscriptionMessages.DiscountLabelWith (a constant plus a decimal formatted "0.##"), not from
  user input. QuestPDF Text() is not a markup interpreter, so there is no injection surface.
- Secrets and PII in logs: the range adds no logging statements and no secrets or configuration values.

SCOPE CHECK
- files in allowed scope: 20/20 (controller, domain comment, billing document and renderer, read
  queries, handlers and view models, shared constants, tests, docs and flow notes)
- files outside allowed scope: none
