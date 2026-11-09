GATE: CODE_REVIEW
HANDOVER: P6-OWNER-FIXES-BACKEND
COMMITS: d83ef5f..9116de7
DATE: 2026-11-09
STATUS: PASS

FINDINGS
- [LOW] src/Read/AmarGram.Read/QueryHandlers/Subscription/SubscriptionDiscountLabels.cs:20 — detection is `DiscountCodeId == null && DiscountCodeText == "Subscription discount"`. It is not collidable in practice: PlaceOrder and CompleteCounterSale always write the code id together with the code text (`appliedDiscount?.DiscountCodeId, appliedDiscount?.Code`), so a staff or customer code never has a null id. It is still a string convention. The sounder key is `Order.Channel == OrderChannel.Subscription` (already persisted) plus `LineDiscountTotal > 0`. Optional hardening, not blocking.
- [LOW] src/Read/AmarGram.Read/QueryHandlers/Billing/InvoiceQueryHandlers.cs:90-92 — `totalsLabel` is set only when every discounted line carries the same label, so a mixed-percent or mixed (subscription plus ordinary) invoice gets a null totals label. That is the safe behaviour. A test for the mixed case would be a nice addition; the PDF/invoice label path has only the happy-path assertion in I_D5.
- [LOW] tests (I_D5 extension) — the PDF line label (`QuestPdfBillingRenderers.cs:247`) has no assertion; only the JSON `discountLabel` fields are checked.

VERIFIED
- Decision 1: every read of `IsSubscribable` is create-only (`SubscriptionCustomerCommandHandlers.cs:43`), the catalogue facts, and the read-side "can subscribe" view (`SubscriptionCustomerQueryHandlers.cs:86`). Resume (customer :184 and staff reinstate :164) check `IsPurchasable` only. The cycle path and the pre-charge notice query use no flag. The claim holds, and the comment/docs corrections are accurate.
- Percentage comes from the cycle's snapshotted `DiscountPercent` (SubscriptionCycleAggregate), not the live setting; missing cycle falls back to the plain text.
- Nullability and placement: all new members are trailing optional (`= null`) record parameters (OrderLineViewModel, OrderTotalsViewModel, InvoiceLineViewModel, InvoiceTotalsViewModel, DocumentLine); labels are null for orders without the code, zero line discount, and non-Order invoice sources. I_D5b asserts null for both order fields.
- nextDeliveryOn: `Status == Active && NextDeliveryOn == date`, identical to the due-tomorrow handler (line 215). The date is a commerce-zone local date parsed with exact `yyyy-MM-dd`, invariant culture; bad values give 400 on list and export. The list test compares the filtered totalCount to the tile count.
- Tests assert what they claim (I_D5 label on customer, staff and invoice; I_D8 order raised, cycle Generated, subscription Active, next date +28 days; I_D8b refusal code; filter test with list, export, other date and bad dates). Domain label tests pass locally (24/24). Integration tests not run (need the database).
- Docs: .ai flow gets an appended section and edits one "Remaining work" line that the change made false; USER_STORIES US-SUB-04 is a deliberate owner-decision edit; HO-SUB-001 additions are blockquotes; Amended (t) in HO-P6 is a new appended row, P2 untouched.
- Integration failures: this branch is read-side and presentation only; it writes no data and changes no aggregate. XI_9 scans stored billing/audit/notification columns, and the label is computed on read and never stored, and "(10%)" is not a 13-19 digit run, so it cannot be affected. The Reporting delivery-pass limit, notification log search, file cleanup, catalogue P95, inventory schema and global-settings audits touch nothing in the diff; the filter is on the staff subscription list only. The branch cannot be the cause of any of them. A baseline run on d83ef5f would settle it.

SCOPE CHECK
- files in allowed scope: 20/20
- files outside allowed scope: none
