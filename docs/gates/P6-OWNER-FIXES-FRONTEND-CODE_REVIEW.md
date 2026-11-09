GATE: CODE_REVIEW
HANDOVER: P6-OWNER-FIXES-FRONTEND (HO-P6-SUBSCRIPTIONS Amended (t)-(ac))
COMMITS: c448c68, a4eb39d, 1db12e2, 75e09ed, a09c1b2, 94b30b2 (range d83ef5f..94b30b2, web/ and docs only)
DATE: 2026-11-09
STATUS: PASS

FINDINGS
- [LOW] docs/handover/HO-P6-SUBSCRIPTIONS.md (row ac) — says the 44 px close X was "added by (x)"; it was added by (y). Rows are append-only, so correct it in a later row, not in place.
- [LOW] web/mocks/handlers/subscriptions/staff.ts (readFilters, nextDeliveryOn) — the mock trims the value before validating; the backend's TryDueDate (StaffSubscriptionsController.cs:141-148) only treats blank as no filter and runs TryParseExact on the untrimmed text, so " 2026-11-10" is 400 on the server and accepted by the mock. The web never sends padded values (it drops non-dates), so this is harmless today; drop the .trim() for exact parity.
- [LOW] web/components/ui/dialog.tsx:126 — design call 1 (invisible 44 px close-X area): accepted. The X reaches 50 px in from the edge and 50 px down; the panel pads 24 px, so a 26 x 26 px corner of the content box can sit under it. DialogHeader now has pr-8 (clears it for all 31 titled dialogs, unit-tested), and the X is rendered after the children so it wins the click. A dialog whose first row is a control, not a DialogHeader, would have that control's corner covered; none was found in the diff. Optional: a note in dialog.tsx that content in the top-right corner must be inside DialogHeader.
- [LOW] web/components/back-office/UnderlineTabs.tsx:19 — design call 2 (wrapped tabs): accepted. Each tab keeps its own border-b-2 / -mb-px, so on the second row the selected underline and the bar's rule coincide, and on the first row the underline sits mid-bar above the second row. It is unambiguous (the underline is under the selected label) and opt-in for CustomerProfile only. Optional: add gap-y if the owner finds the rows crowded.

CHECKS
- Field names and nullability match the backend view models: OrderViewModels.cs:16 lines[].DiscountLabel (string?), :20 totals.LineDiscountLabel (string?), BillingViewModels.cs:40 line DiscountLabel (string?), :51 totals DiscountLabel (string?); web types are optional + nullable. Staff order lines carry no label, as the server sends none.
- Null/absent label keeps old text exactly: OrderSummary, InvoiceDocumentView and InvoicePreview use `label || old text`; the OrderLines extra row renders only when both label and amount are present. Covered by "null" tests in discount-label.test.tsx.
- Mock 400 body `{ error: "nextDeliveryOn must be yyyy-MM-dd." }` equals the backend string (StaffSubscriptionsController.cs:148); it is raised after status/reason/method, as in the controller. Export path carries the filter (subscriptionsCsvPath spreads filters). The dashboard link uses T3's own dueOn, url-encoded.
- Tests not weakened: subscriptions-customer-360 close-X exclusion removed (stricter); orders 44 px check widened from the Channel select to the whole "Order filters" form (stricter); terms-wording assertion in list-and-detail.test.tsx replaced by stricter ones (dt "Deliver to", "Home: House 7", no "Deliver to me", exactly one "Deliver to"); product-editor/e2e help-text assertions updated to the owner's new text only; dashboard-rows href updated to the new link. No test deleted or skipped.
- Targeted Vitest (--maxWorkers=2): discount-label, owner-fixes-p6, staff-subscriptions, subscriptions, back-office-subscriptions, unit/subscriptions: 28 files, 432 tests, all passed. Playwright not run (per instruction).
- Project rules: no colour literals, no `new Date(`/date-fns/storage in the added lines (isCalendarDate reuses dateParts); no cat/pet/vet/clinic/PurrCare wording; components/customer/** change is one prop (`wrap`), hook-free; new controls are min-h-11 / size-11. Chip Button defaults to type="button", so it does not submit the filter form.
- Amended rows (t)-(ac) are appended; no existing row edited. HO-SUB-001 additions are appended blockquotes ("the text above is unchanged"). README ADR table: 109-118 row annotated, 193-202 row added, next free ADR-FE-203, consistent.
- Mock seed change (subscription orders now carry the discount as a line discount, not order discount) is consistent with the server labelling from LineDiscount and is covered by the new tests.

SCOPE CHECK
- files in allowed scope: all web/ and docs/ files in the range
- files outside allowed scope: none (src/ and tests/AmarGram.* excluded by brief)
