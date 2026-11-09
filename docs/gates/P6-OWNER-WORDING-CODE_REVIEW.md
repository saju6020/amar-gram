GATE: CODE_REVIEW
HANDOVER: P6-OWNER-WORDING (HO-P6-SUBSCRIPTIONS, Amended (ae))
COMMITS: c4076be
DATE: 2026-11-09
STATUS: PASS

FINDINGS
- [LOW] src/Read/AmarGram.Read/QueryHandlers/Order/StaffOrderQueryHandlers.cs:120,195 — the staff detail projection still loads the raw DiscountCodeText and masks it afterwards in the handler. This is correct today. It is a one-place mask, so any future reader that adds DiscountCodeText to a view (e.g. a CSV export) must route it through SubscriptionDiscountLabels.StaffDiscountCode. Optional only.

CHECKS
- Only one read path surfaces DiscountCodeText: GetStaffOrderDetailQueryHandler (now masked for Channel == Subscription). The customer order view, invoice and credit-note views and PDFs, the staff list and POS have no DiscountCodeText reader (grep over src). Invoices and the customer view name the discount through DiscountLabel, not the code.
- Nothing re-evaluates the stored text: CheckoutPricing reads it only from checkout input (the typed code). ReturnAndRefundCommandValidators:98 validates a typed counter-sale code. Return and refund flows do not read the aggregate's DiscountCodeText.
- A subscription order cannot carry a typed code. PlaceSubscriptionOrderCommandHandler:104 passes a null code and only SubscriptionMessages.DiscountLabel, and only when a discount applies. CheckoutInputsLoader:95 builds the synthetic rule from the label, never from user input. So masking by channel is exact.
- The domain, persistence and API contract are unchanged; the field stays nullable and the web already handles null (mock seedSubscriptionOrders).
- Tests: unit (subscription -> null; Online/Counter pass the code through, including null) and an integration assertion on the real staff detail JSON of a generated subscription order (discountCode is null while lineDiscountLabel stays "Subscription discount (10%)"). Adequate. I did not run them (the worktree is in use by another agent).
- No cat/pet/vet/clinic/PurrCare wording in the diff. No superseded-architecture constructs.

SCOPE CHECK
- files in allowed scope: 5/5
- files outside allowed scope: none
