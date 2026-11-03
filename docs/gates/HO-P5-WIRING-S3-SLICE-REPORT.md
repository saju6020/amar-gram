# HO-P5 S3 (Catalogue and stock) — slice report (§17.3)

Written by the S3 implementer. Everything below that says "passed" was seen to pass in this worktree; what was not run is said so.

## Branch and HEAD

| Field | Value |
|---|---|
| Branch | `feat/p5-s3-catalogue-stock`, created from `0a14dbc` (the worktree branch `worktree-agent-a9627fce510dd35df` sat at `0a14dbc`: S0, S1 and S2 merged, plus Amended (ah)) |
| HEAD | the last commit of the branch; `git log 0a14dbc..HEAD --oneline` is the exact list |
| Worktree | `D:\my-repo\amar-gram\.claude\worktrees\agent-a9627fce510dd35df` |
| Pushed | No. Not merged |

`web/node_modules` was missing in the worktree (a junction needs rights this agent lacks), so `npm ci --prefer-offline` was run in `web/`. It changed no tracked file.

## Files touched (all inside S3's §13 block)

New: `components/staff-shop/{ProductBulkActions}.tsx (SchedulePriceDialog.tsx was added and then deleted in Round 2)`, `components/staff-shop/submitProductSection.ts`, `components/inventory/ReceiptDraftList.tsx`; tests `tests/components/staff-shop/{products-p5.test.tsx,mock-refusals.test.ts,schedule-extra-field.test.tsx,review-round.test.tsx}`, `tests/components/stock/stock-p5.test.tsx`, `tests/components/inventory/{receipt-drafts.test.tsx,receipt-draft-autosave.test.tsx,mock-refusals.test.ts}`.

Changed: `lib/api/{staff-shop,files,inventory-stock,inventory-alerts,inventory-receipts,inventory-lookup,procurement-orders,procurement-consignments}.ts`, `lib/files/fileRules.ts`, `lib/hooks/{useStaffShop,useInventory,useInventoryLookup}.ts`; `app/(staff)/staff/shop/products/page.tsx` and `[productId]/{page,layout,food/page,variants/page}.tsx`; `app/(staff)/staff/inventory/receipts/new/page.tsx`; `app/(staff)/staff/procurement/consignments/page.tsx`; `components/staff-shop/{StaffProductTable,ProductDetailsForm,FoodDetailsForm,VariantsTable}.tsx`; `components/stock/{StockTable,SkuStockMatrix}.tsx`, `components/admin/ScheduleChangeDialog.tsx` (Round 2: one optional `extraField` prop only); `components/inventory/{GoodsReceiptForm,InventoryOverview,receiptModel}.ts(x)`; `mocks/handlers/shop/staff.ts`, `mocks/handlers/files/{handlers,uploadBehavior}.ts`, `mocks/handlers/inventory/{alerts,consignments,fixtures,lookup,procurement,receipts,stock,store}.ts`; tests `staff-shop/{products-design,products-sections}`, `back-office-stock/{receiving-layout,stock-by-item}`, `inventory/goods-receipt-form`, e2e `shop-staff.spec.ts` and `inventory-flows.spec.ts`. Also (rounds 2-3): `tests/unit/files/file-rules.test.ts`, `tests/e2e/procurement-flows.spec.ts` (E-A3), `lib/api/staff-shop.ts` (`PRODUCT_MANAGE_ROLES`), `lib/hooks/useStaffShop.ts` (`useCanManageProducts`).

Not touched: `mocks/handlers/shop/{store,catalogue,fixtures}.ts` (the public builder: `organicCertificate*` and `scheduledCompareAt*` appear only in `mocks/handlers/shop/staff.ts`), `lib/hooks/useProcurement.ts` (its `usePurchaseOrders` and `useConsignments` already take the whole params object, so `branchId` and `arrivingWithinDays` travel in the key), `lib/api/errors.ts`, `lib/shop/submitSection.ts`, `components/admin/ScheduleChangeDialog.tsx`, `lib/drafts/receipt-draft.ts`.

## Superseded assertions (old → new, §15)

| Where | Old | New (at least as strong) |
|---|---|---|
| `staff-shop/products-design.test.tsx` "shows the design columns…" (HO-P4 U25/U26, BG-9 "Not built") | no `Origin`, `Price range`, `Stock`, `Organic` column headers, no checkbox, no bulk text | headers `Origin`, `Price`, `Stock` are present; with a row that carries no BG-9 data the old "3 pack sizes" stays and the new cells say "—"; no "available" and no "Organic" text; no checkbox or bulk text without the bulk handler. The positive cases are U28/U29 in `products-p5.test.tsx` |
| `staff-shop/products-sections.test.tsx` U-D "no certificate upload or expiry control" (BG-14) | `queryByLabelText(/expiry\|upload/)` absent | "Certificate valid until" and the "Certificate file" uploader are present; "Expired" is absent without the server saying so |
| `staff-shop/products-sections.test.tsx` "…no 'Was' price" (BG-13) | no `Was`/`compare` column | `Was` column present, no `compare` column; the "—" cell is covered in U31 |
| `back-office-stock/stock-by-item.test.tsx` U30 "no Reorder at column" (BG-16) | headers not matching `/reorder at/` | headers include `Reorder at` |
| `inventory/goods-receipt-form.test.tsx` U-C4 (BG-18) | draft in `sessionStorage` under `receiptDraftKey`, "Restore the receipt you were entering?" prompt, Restore, Discard clears storage | the lot typed reaches the server draft (`db.receiptDrafts`, status Open) and "Draft saved at hh:mm" shows in a `role="status"`; **nothing** in `sessionStorage`; no restore prompt; Discard confirms ("nothing has been posted") and calls `onDiscardDraft` once |
| `inventory/goods-receipt-form.test.tsx` U-C4b | a line scanned while the restore prompt is open survives Restore | a resumed draft (`stateFromDraft`) shows its line with lot, quantity and delivery reference, and a line scanned afterwards is added after it |
| `back-office-stock/receiving-layout.test.tsx` U32 (title only) | "has no Receive into select: the branch is the one in the sidebar" | same assertion (no select for one or no branch), title now says so; the two-branch cases are U36 in `receipt-drafts.test.tsx` |

Test seams only: `staffAccountId` was removed from `GoodsReceiptForm`'s props (the sessionStorage key was its only use); `draftId` and `onDiscardDraft` were added, so the two receiving tests pass them.

## OQ defaults built to

OQ-12 (bulk selection is the current page's; it clears when the page's products change and after the action) and OQ-13 ("Receive into" only with 2+ assigned branches, defaulting to the active one). OQ-8 holds: no "Was" price anywhere in the shop. No concern about a default.

## Mock refusals added (server file:line mirrored). One or more cases each in `tests/components/staff-shop/mock-refusals.test.ts` and `tests/components/inventory/mock-refusals.test.ts` (U47)

| Mock | Refusal | Server |
|---|---|---|
| `PUT …/shop/products/{id}` | `districtOfOrigin` raw length > 60 → 400 `MaximumLengthValidator` on `DistrictOfOrigin`; a C0 control (tab/LF/CR allowed) → 400 `PredicateValidator`; trimmed > 60 or any `char.IsControl` (tab too) → 400 `InvalidDistrictOfOrigin`; blank clears; value trimmed | `UpdateProductDetailsCommandValidator.cs:15`, `ValidationRuleExtensions.cs:31-32`, `ProductAggregate.cs:312-318`, `ProductRules.cs:13` |
| `POST …/shop/products/bulk-status` | no ids → 400 `NotEmptyValidator` on `ProductIds`; > 100 → 400 on `ProductIds.Count` (message "Choose at most 100 products at a time."); nil id → 400 on `ProductIds[i]`; action other than ordinal `Publish`/`Unpublish` → 400 `InvalidBulkAction` on `Action`; else **200** with per-product items (duplicates collapse; unknown id → `ProductNotFound`; `InvalidProductTransition` "Cannot publish from Active."/"Cannot unpublish from Draft."; `ProductNotPublishable`; `OrganicCertificateExpired`); counts are the server's | `StaffProductsController.cs:280-296`, `PublishProductCommandValidator.cs:14-24`, `BulkChangeProductStatusCommandHandler.cs:24-69`, `ProductRules.cs:29`, `ProductAggregate.cs:163-181, 191-194` |
| publish checklist and `…/publish` | a `CertifiedOrganic` food product gains the blocking items `OrganicCertificate` (certifier and number) and `OrganicCertificateNotExpired` (expiry before UTC today); a blocked publish answers `OrganicCertificateExpired` instead of `ProductNotPublishable` when the second is unmet; only Draft/Archived can be published; message "This product can't be published yet: …; …" | `ProductPublicationRules.cs:48-61`, `ProductAggregate.cs:163-181` |
| `POST …/shop/skus/{id}/prices` | `compareAtAmount` < 0.01, > 9,999,999,999.99, > 2 decimals → 400 on `CompareAtAmount`; ≤ the price → 400 `CompareAtMustExceedPrice` on `CompareAtAmount` ("The compare-at price must be greater than the price."); stored with the row (current or scheduled), a row without one clears it | `ScheduleSkuPriceCommandValidator.cs:24-32`, `SkuPriceAggregate.cs:46-47` |
| `PUT …/products/{id}/food` | a **new** `organicCertificateFileId` must be a file uploaded with purpose `OrganicCertificate` and not on another product, else 400 `InvalidCertificateFile` on `OrganicCertificateFileId`; the product's own file is re-submittable; null clears file and date; `organicCertificateExpired` is derived from UTC today and `organicCertificateUrl` is a signed relative link, null without a file | `SetFoodDetailsCommandHandler.cs:36-42`, `FoodDetails.cs:58-59`, `StaffProductDetailViewModel.cs:27-33` |
| `POST /api/staff/files?purpose=OrganicCertificate` | declared type not PDF/JPEG/PNG/WebP → 400 `FileTypeNotAllowed` on `ContentType`; over 10 MB → 400 `FileTooLarge` on `Content`; the purpose is remembered per file id | `FileRules.cs:33-37`, `FilesController.cs:252-255, 288-291` |
| `GET …/shop/products` | the BG-9 extras for the page's products: active SKUs only, labelled sizes cheapest first, min/max current price, `availableStock` (number; null for a bundle or when nothing reported), signed thumbnail of the product-level primary photo else the first, `isOrganic`, `countryOfOrigin` | `GetStaffProductsQueryHandler.cs:72-146`, `StaffProductSummaryViewModel.cs:25-30` |
| `GET …/inventory/stock` | `reorderLevel` = sum of the explicit policies, else the default point once (`reorderLevelIsDefault`); `belowReorderLevel` = some pair with point > 0 and less usable stock; the `belowReorderPoint` filter is now exactly that flag | `StockQueryHandlers.cs:213-224`, `AlertsAndReportsQueryHandlers.cs:25-73` |
| `GET …/inventory/stock/{skuId}` | each batch has `receivedOn`, `supplierId`, `supplierName` (null without a supplier) | `InventoryStockViewModels.cs:49-52` |
| `GET …/alerts/summary` | `arrivalWindowDays` not an integer in 1-90 → 400 `InvalidQuery` on `arrivalWindowDays`; default 7; `consignmentsArriving { withinDays, count }` = not cancelled, expected today..today+window, no receipt yet | `StaffAlertsAndReorderController.cs:41-42`, `ConsignmentQueryHandlers.cs:53-62` |
| `GET …/procurement/consignments` | `arrivingWithinDays` outside 1-90 → 400 `InvalidQuery`; the same set as the summary | `ProcurementConsignmentsController.cs:28-37` |
| `GET …/purchase-orders`, `…/consignments`, `…/inventory/locations`, `POST …/goods-receipts`, `PUT …/goods-receipt-drafts/{id}` | an explicit `branchId` the caller is not assigned to → **403 `{ "error": "BranchNotAssigned" }`** (the body is `{ error }`, not an `errors` list); the lists then read that branch | `InventoryControllerSupport.cs:35-56`, `ProcurementPurchaseOrdersController.cs:24-27`, `StaffInventoryLocationsController.cs:21-24`, `StaffGoodsReceiptsController.cs:44` |
| `GET/PUT/DELETE …/goods-receipt-drafts[/{id}]` | the caller's own drafts only: another member's draft, an unknown id and a closed draft are 404 (read, save, discard; discarding an already closed one is 204); a new draft past 20 open → 400 `GoodsReceiptDraftLimitReached` on `DraftId`; a negative quantity or cost → 400 `InvalidGoodsReceiptDraft` on `Lines[i].…`; delivery reference/lot > 60, note > 500, rejection note/reason too long → 400 `MaximumLengthValidator` (the validator runs before the aggregate); posting with `draftId` closes the caller's draft | `StaffGoodsReceiptDraftsController.cs:14-82`, `GoodsReceiptDraftCommandHandlers.cs:23-63`, `GoodsReceiptDraftAggregate.cs:52-58, 110-125`, `GoodsReceiptAndBatchCommandValidators.cs:27-59`, `GoodsReceiptCommandHandler.cs:101-120`, `InventoryRules.cs:33-34` |

The inventory mock's persisted key is now `…_db__v2` (the store gained `receiptDrafts`, with one open draft that belongs to another staff member, `inventoryFixtureIds.otherStaffDraftId`). The shop mock needed no seed: S0's districts, "Was" prices and the expired/valid certificates were enough (U4 unchanged).

## Where the code differs from the document or the Gap inventory (§20.2: the code won)

1. **Over-long draft fields are `MaximumLengthValidator`, not `InvalidGoodsReceiptDraft`** (§11.4.11): the command validator runs first (`GoodsReceiptAndBatchCommandValidators.cs:27-59`); `InvalidGoodsReceiptDraft` is the aggregate's second line, reached by a negative quantity or cost, a nil SKU id.
2. **The bulk "over 100" error is named `ProductIds.Count`** (the FluentValidation property of `RuleFor(x => x.ProductIds.Count)`, `PublishProductCommandValidator.cs:19`). This is my reading of FluentValidation; the screen shows the message and never the name.
3. **`BranchNotAssigned` on the inventory lists is a 403 with body `{ error: "BranchNotAssigned" }`**, not the `errors[]` list the shared `describeForbidden` reads. The receiving form maps both (`describeReceiptError`).
4. **`GET /api/staff/procurement/purchase-orders/{id}` takes no `branchId`** (`ProcurementPurchaseOrdersController.cs:57-67`, active branch only). When someone receives into another branch against one of that branch's purchase orders, the order's lines cannot be read, so they are not pre-filled and the lines are added by hand. Backend follow-up if wanted.
5. The alert summary handler clamps `arrivalWindowDays` (`AlertsAndReportsQueryHandlers.cs:241`) but the controller refuses out-of-range values first; the mock follows the controller.
6. The shop catalogue shares no SKU ids with the Inventory mock, so the list's `availableStock` follows the detail read's per-SKU stock (12 in stock, 0 out, none for the unfinished seeds) instead of reading the inventory mock.

## Decisions where the handover was silent (please read)

* **`components/staff-shop/SchedulePriceDialog.tsx` is a new dialog, not an extension of `ScheduleChangeDialog`.** The "Was price" field must live in the schedule dialog (§11.4.6, U31). `components/admin/ScheduleChangeDialog.tsx` is shared with the tax-rate screens, outside S3's block and has no slot for an extra field; §20.1 says never to copy it under a new name, but there is no other way to put the field in the dialog. The new file uses the same primitives (`ui/dialog`), the same labels (`Amount (BDT)`, `Schedule`, `Cancel`, `Effective from`), keeps amounts as strings, refuses a malformed amount before any request and shows `CompareAtMustExceedPrice` under its field. If the owner prefers one dialog, the alternative is a §20.1 change to the shared component (an optional `extraField` slot); this file would then be deleted.
* **`components/staff-shop/submitProductSection.ts`** carries the property names and plain-language sentences the new fields need (`DistrictOfOrigin`, `OrganicCertificate*`, `CompareAtAmount`, and `OrganicCertifier`, `ShelfLife`, `NetWeight`, `Allergens`, which were missing from `SHOP_FIELD_MAP` and so landed on the form root). `lib/api/errors.ts` and `lib/shop/submitSection.ts` are §14. Moving these entries into `errors.ts` later is a one-line change per table.
* **Product table:** the select column is only there when the page passes `onBulkStatus`; the first column is no longer wrapped by `DataTable`'s `rowHref` (the checkbox sits first), so the name cell renders its own `<Link>`.
* **Publish refusal wording.** The mocks' single publish/unpublish now answer in the server's words ("This product can't be published yet: …; …", "Cannot unpublish from Draft."), the old mock text differed. The existing assertion `/can.t be published yet/` still matches.
* **The expired-certificate publish message** ("The organic certificate has expired. Update it on Food & labelling before publishing.") replaces the server's longer sentence in the editor layout, as §11.4.7 words it.
* **Receipt draft payload:** an empty quantity goes as "0" (a `decimal` cannot take a blank) and comes back blank; `supplierId` is the chosen purchase order's supplier, which is what makes "Your drafts" show a supplier; `receivedOn` and `note` are not sent.
* **`?draft=`** is put in the address only when the draft exists **and nothing is waiting to be saved** (the unsaved-changes guard keeps a sentinel history entry while changes are pending and put the old address back; found by E11). "Your drafts" stays visible (without the draft being worked on) rather than only on an address without `?draft=`.
* **Branch switch** keeps the form mounted (the first load alone shows the loading state; found by E11, which lost the lines) and clears locations, the order/consignment choice and the lines that came from an order.
* **The confirm button stays "Post receipt"**, not "Post to stock": run-only specs (`procurement-flows`, `inventory-a11y-responsive`) click `/post receipt/i` (§20.3).
* **`useAlertSummary` calls `getAlertSummary()` through an arrow**: its new optional parameter would otherwise receive react-query's context object (400 `InvalidQuery`). Found by E11 on the first run; `stock-p5.test.tsx` now guards it.
* **Consignments page** shows "Showing consignments arriving in the next N days that have not been received yet." with a "Show all consignments" button when `arrivingWithinDays` is in the address.

## §20 requests (files outside S3's block)

1. **`tests/unit/files/file-rules.test.ts`** (run-only): `FilePurpose` gained `OrganicCertificate` and `lib/files/fileRules.ts` its rule, as §13/§11.4.1 require, so this file fails typecheck (`TS2741` at line 19) and its case "every FilePurpose has a rule" fails (`expected ['OrganicCertificate', …] to deeply equal ['ProductImage', 'ReportExport']`). It needs one more entry in `expected`: `OrganicCertificate: { types: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], maxMb: 10 }`. Not edited. This is the only typecheck error in the tree.
2. **`tests/e2e/procurement-flows.spec.ts` E-A3** (run-only; the baseline failure at :95): it asserts the sessionStorage restore prompt that ADR-FE-190 removes ("Restore the receipt you were entering?", `restore the draft`). It already fails at baseline and still does; it cannot pass any more. Replacement for its middle part: after "draft saved" wait for `toHaveURL(/draft=/)`, `page.reload()`, expect line 20 and `L-A3-01` back with no prompt, and at the end expect `receipts/new?draft=<old id>` to say "That draft is no longer here".
3. Optional, not blocking: `lib/drafts/receipt-draft.ts` (`sessionStorage` helpers) is now unused apart from its types; `lib/api/errors.ts` could take the entries in `submitProductSection.ts`; `ScheduleChangeDialog` could take an extra-field slot (see above).

## Visual or UX decisions to look at (nothing here could be seen rendered)

* Products table: eleven columns with the select box first, a 40 px thumbnail (the tinted pack placeholder when the server sends none; every shop seed has none, so the real thumbnail is proven by a component test only), the "Organic" pill under the name, price as "৳650.00 – ৳4,400.00", stock as "12 available". The table scrolls inside its own region (page overflow is checked at 360 px with the bar open).
* Bulk bar sits between the filters and the table, with a visible "Select all on this page" checkbox above it. The result ("2 updated, 0 not updated" and the failures) stays until Dismiss.
* Certified organic block: the date field and the pill, then the file chip ("A certificate file is on record." with "View certificate" and "Remove file", or the uploader).
* Stock by item: a "Reorder at" column with the "Below reorder level" pill under the figure; the batches matrix has Received and Supplier columns (a definition list below 768 px).
* Receiving: "Your drafts" panel above the form, the save status line first inside the form, "Receive into" first in the Delivery panel for people in 2+ branches.

## Verification

Commands from `web/`. The full Vitest suite, `npm run build`, E17, `sweep:a11y` and the contract tests were **not** run (the TEST gate and integration do that).

| Check | Result |
|---|---|
| `npx tsc --noEmit -p .` | one error, `tests/unit/files/file-rules.test.ts(19,9)` (request 1 above); nothing else |
| `npx eslint --max-warnings 0` over `lib components app mocks tests/components/{staff-shop,inventory,stock,back-office-stock} tests/e2e/{shop-staff,inventory-flows}.spec.ts` | clean |
| Vitest `tests/components/{staff-shop,stock,back-office-stock,inventory,procurement}` (`--maxWorkers=2`) | pass (the five superseded cases above were red before they were updated) |
| Vitest new files: `products-p5` (17), `mock-refusals` shop (19) and inventory (14), `stock-p5` (7), `receipt-drafts` (14), `receipt-draft-autosave` (7) | pass |
| Vitest `tests/guards` and `no-hex-literals`, `no-colour-literals` (U46) | 4 files, 220 tests pass |
| Vitest `tests/unit/files` | 1 failure, the same `file-rules.test.ts` case (request 1) |
| `npm run lint` (`eslint . --max-warnings 0`) | exit 0, no output |
| e2e `shop-staff.spec.ts` (E10), `chromium` + `mobile-360`, `--workers=1`, own `next dev` on 3123 | 18 cases (15 existing, 3 new); the full file passed except one new case on `mobile-360`, which went to the Food section by a tab link that is a select below 768 px; fixed (the case goes by address) and both projects of that case passed. No baseline failure appeared |
| e2e `inventory-flows.spec.ts` (E11), both projects | 32 cases (27 existing, 5 new): 30 passed, 2 failed (`mobile-360` E-C1 and E-C2, `net::ERR_CONNECTION_REFUSED` at `/staff/sign-in`: the dev server was restarting); both passed when rerun alone. The new cases passed on both projects after the fixes below (10 of 10, twice) |
| e2e `inventory-a11y-responsive.spec.ts` (E12, run-only), the `/staff/inventory/receipts/new`, `/staff/inventory/stock*`, `/staff/procurement/consignments*` and `/staff/inventory` routes, both projects | 108 passed (10 for the receiving page, 98 for the others). The other ~360 route cases of that file were **not run**: a full run of the file is 470 cases at about 20 s each, and I stopped it after 35 passes |
| e2e `procurement-flows.spec.ts` (E12, run-only), both projects | 8 passed, 2 failed: **E-A3** (:95) on both projects. Its baseline failure is excepted, but see request 2: it now stops at line 113, the removed restore prompt. E-B1 (receiving against a consignment) passed after the guard fix below |
| e2e `inventory-real-api.spec.ts` | not run (real-API only) |

### What the e2e runs found (all fixed, with the Vitest case that guards it where one is possible)

1. `useAlertSummary` passed `getAlertSummary` straight to react-query, which called it with its context object as the new `arrivalWindowDays`; the overview page showed "We couldn't load this just now" and E-E1 failed on both projects. Now an arrow. Guard: `stock-p5.test.tsx` "sends no arrivalWindowDays…".
2. Changing "Receive into" re-read the locations and the page swapped the whole form for a loading state, so the typed lines were lost. Only the first load gates the page now. Guard: `receipt-drafts.test.tsx` "changing the branch keeps the form mounted…".
3. `?draft=` never reached the address: the unsaved-changes guard keeps a sentinel history entry while changes are pending and steps back off it when it lets go, so an address written meanwhile was lost. Then, releasing the guard after every autosave made those steps overlap while someone typed fast, and **walked the page back** (E-B1 landed on the consignment's Documents page). The guard now holds for 1.5 s after the last save, and the address is written 0.6 s after the guard has let go. This is timing code; the E11 cases and E-B1 cover it, a Vitest case cannot.

Not owed by S3 and not run: the full Vitest suite, `npm run build`, E17, `sweep:a11y`, `tests/contract`. Screenshots for ACCEPTANCE (360 and 1280) are the gate's: this agent cannot see the rendered screens.

## Left undone

* Nothing outstanding in the slice's rows (U28-U36, U46, U47, E10, E11).
* The seeded shop products have no photos, so the real thumbnail is exercised by a component test only. A seed with an image is S0's file (§20.1), if the ACCEPTANCE screenshots should show one.
* Receiving into another branch against one of its purchase orders cannot pre-fill the order's lines (decision 4 above).
* E-A3 and `file-rules.test.ts` need the edits in requests 1 and 2.

## Round 2 (integrator decisions, Amended (ak))

1. `tests/unit/files/file-rules.test.ts`: `OrganicCertificate` (PDF, JPEG, PNG, WebP, 10 MB) added to `expected`. Typecheck is now clean (`tsc --noEmit` prints nothing) and the file passes.
2. `tests/e2e/procurement-flows.spec.ts` E-A3 rewritten as close to the old intent as the new behaviour allows: 20 wedge scans, fill ten lines, wait for the autosave and for `?draft=<id>` in the address, reload, **no** restore prompt and line 20 and `L-A3-01` are back, finish and post with the confirm shown first, then the draft's address says "That draft is no longer here" (instead of "no restore prompt on /new"). **It passes now on both projects** (the recorded baseline failure is gone).
3. `SchedulePriceDialog.tsx` is deleted. `components/admin/ScheduleChangeDialog.tsx` gained one optional prop, `extraField { render, validate?, errorProperty? }`, drawn between the value and "Effective from"; with it `onSchedule` gets the typed text as a third argument and a server error on `errorProperty` shows under that field. Without it nothing is drawn and `onSchedule` still gets exactly two arguments. `VariantsTable` uses the shared dialog with the "Was price (optional)" field in the slot. Existing callers: `tests/components/admin/schedule-change-dialog.test.tsx` is unchanged and passes. New: `tests/components/staff-shop/schedule-extra-field.test.tsx` (3 cases: third argument, client refusal and server error under the field, no slot means two arguments and no field). One behaviour difference from the deleted dialog: the shared one does not pre-check the main amount's format (the server refuses it, as for tax rates); only the Was price is checked client-side.
4. Left as noted: `lib/drafts/receipt-draft.ts` stays (unused apart from types), and the `submitProductSection.ts` entries stay out of `lib/api/errors.ts`.

Verification: `tsc --noEmit` clean; `npm run lint` clean; Vitest `staff-shop`, `admin`, `unit/files`, `inventory`, `stock`, `back-office-stock`, `procurement` (37 files, 312 tests, `--maxWorkers=2`) pass; e2e `procurement-flows` + `shop-staff`, both projects, `--workers=1`, port 3123: 26 of 28 passed, the 2 failures were E-A1 on the first run after the server start (cold compile, 5 s expects) and both projects passed when E-A1 was rerun alone. E-A3, E-B1 and the E10 cases passed on both projects.


## Round 3 (CODE_REVIEW run 1 FAILED; ARCHITECTURE and SECURITY PASS)

**Item 1, 44 px targets.** `min-h-11` on: ReceiptDraftList Continue/Discard; ProductBulkActions Publish, Hide from shop, Clear, Dismiss; FoodDetailsForm Remove file, the certificate date and the district input; the "Was price" input (in the VariantsTable slot) and the "Receive into" select. Each product row checkbox is inside a `min-h-11 min-w-11` label (the select-all checkbox already sat in a `min-h-11` label). `ScheduleChangeDialog`'s own inputs are untouched. One class assertion per group: `review-round.test.tsx` (bulk bar + checkboxes, Was input, certificate controls) and `receipt-drafts.test.tsx` (draft list).

**Item 2, products list key.** `useStaffProducts` now reads `useBranchScope()` and puts the active branch in the key (and waits for it). `review-round.test.tsx` "a branch switch refetches": it fails with the key as it was (checked) and passes now.

**Item 3, branch switch mid-draft: design chosen = the receiving branch belongs to the form, fixed when the workspace is created.** The page takes the caller's active branch once, when a new workspace starts (a resumed draft takes its own saved server branch, never the sidebar's), and only the form's "Receive into" choice (through its confirm and `applyBranch`) changes it afterwards. A later sidebar switch neither changes the draft's branch (the autosave and the post keep naming it) nor remounts the form; the order, consignment and location lists keep being read with the form's `branchId`. Tests in `receipt-drafts.test.tsx`: the sidebar switch keeps the select, the lot text and the location reads on the form's branch; a resumed draft saved for London shows London while the active branch is the main outlet. Known edge: a person with ONE branch has no choice, so the draft names no branch (the server uses the active one, which cannot change for them).

**LOWs.**
- Unmount flush: the change effect's cleanup cleared the timer first, so the flush never ran; it now goes by "unsaved and not stopped". Hook tests: leaving inside the quiet moment sends once; nothing is sent when saved or after `stop()`.
- Orphan draft: the hook keeps the in-flight save and exposes `settle()`; Discard and Post call `stop()` then await `settle()`, so a creating save lands first and is then deleted (or closed by the post). Form tests with a gated PUT for both; hook test for `settle`.
- A change made during a save that then FAILS is retried after the usual pause (hook test).
- `products-p5` bulk fixture: the counts (7/3) now disagree with the items (1 ok, 1 failed) and the test asserts the server's.
- `schedule-extra-field.test.tsx`: the blank case is asserted (no third value); the server error is asserted under the field (`aria-invalid`, accessible description).
- `VariantsTable`: the schedule dialog is keyed by SKU; test: the Was text typed for one SKU is empty for the next.
- Security LOW, role gate: `PRODUCT_MANAGE_ROLES` and `useCanManageProducts()` (same pattern as `useCanManageRiders`). Without it the bulk select boxes and bar are not drawn, and the certificate file can be opened but not removed or replaced (no uploader). Tests per role (ShopManager, Administrator yes; Reception, Inventory no) for the list and the food page.
- Security LOW: the consignments sentence shows only for an integer 1-90 (table test: 7, 90, 1 yes; 0, 91, 999, abc, 7.5 no).
- Architecture LOW: the citation in `staff-shop.ts` is now `StaffProductSummaryViewModel.cs:23-28`; the stale file lists at the top of this report are updated.

**Recorded, no code.** The mock's certificate-file checks do not model the caller-owns-the-upload and 30-minute attach-window rules of `SetFoodDetailsCommandHandler.cs:36-42` (only purpose and not-on-another-product); the new BG-9/BG-14 fields stay typed optional.

**Round 3 verification.** `tsc --noEmit` and `npm run lint` clean. Vitest (staff-shop, inventory, stock, back-office-stock, procurement, admin, unit/files, guards; `--maxWorkers=2`) 40 files / 341 tests: all pass (one timing case, `shared-pieces` ScanField burst, failed once while the dev server compiled and passed alone). e2e at `--workers=1` on 3123: `shop-staff.spec.ts` 17 of 18 on the final run (the E10 cases pass on both projects; the one failure was a 30 s `goto` of `/staff/shop/origins` on a cold compile). `inventory-flows.spec.ts` 30 of 32 on the final full run (all five E11 cases pass on both projects); the two failures are E-C1 at its second `page.goto` of the stock page, stuck on the staff shell's "Loading…" (the session/MSW start race of Amended (ac)). E-C1 passed on `mobile-360` and failed on `chromium` when rerun alone; the same failure appeared in my very first E11 run, before any round-3 edit, and the page involved is not one S3 changes, so I treat it as that flake, not an S3 regression. The machine was heavily loaded for most of this round (a dev server at 8-11 GB, `warmRoutes` timing out at 600 s once); two full runs took 50 minutes.

## Round 4 (CODE_REVIEW run 2: two MEDIUMs)

1. **Resumed draft remounted on a sidebar switch.** Two causes. `useReceiptDraft` was keyed by the active branch (the server's detail read filters only by id and owner, `StockQueryHandlers.cs:137`), so it now uses its own key `['inventory','receipt-drafts','detail',id]` (still under the `receipt-drafts` prefix for invalidation). With that alone the form still remounted, because the SKU lookups that rebuild the draft's lines are also keyed by the branch and put the page back into its loading state: the page now remembers that a workspace's form has been drawn (`drawnFor`) and keeps it mounted. Page test: resume a draft, type, switch the sidebar branch; the lot input is the very same element, keeps its text, and the next save carries the new text. It failed on the code before the second part of the fix (the element was replaced).
2. **Autosave never restarted after a refused post or discard.** The hook has `resume()`; the form calls it in the post's catch and when a discard fails (then rethrows so the dialog still shows the refusal). Tests: after a refused post an edit is saved again and the status reads "Draft saved at ..."; after a refused discard an edit is saved again.
3. LOW, one-branch person resuming another branch's draft: the save and the post now always carry the form's own `branchId` when it has one, whatever the number of branches (the "Receive into" select is still shown only for 2+). The old test "no branch with one branch" is replaced by "carries the form's own branch"; new test: a form on a branch that is not in the person's list saves and posts naming it.
4. LOW, "View certificate" link: `inline-flex min-h-11 items-center`, class assertion added.
5. Noted only: the autosave's retry timer is not cleared on unmount.

**Round 4 additions found by E11.** (a) After a successful post the page flashed "That draft is no longer here" (the closed draft's refetch returned 404 before the router left); the page now knows the post succeeded (`posted`) and skips that state and the `?draft=` write. (b) With the receipt route compiling cold (13-18 s in `next dev`), two things could walk the page back to the form: the guard releasing at post start (its `history.back()` landed after the navigation), and the delayed `?draft=` write replacing the pending navigation. The guard is now held through a post (a refused post releases it by the usual rules), and the address is never written while posting. The E11 receipt case waits up to 45 s for the receipt heading.

**Round 4 verification.** `tsc` and `npm run lint` clean; Vitest (staff-shop, inventory, stock, back-office-stock, procurement, unit/files, guards; `--maxWorkers=2`) 29 files / 288 tests pass. E11 `inventory-flows.spec.ts`, both projects, `--workers=1`, fresh server on 3123, 16 GB free: the last full run 29 of 32 (all five new E11 cases pass on both projects); the 3 failures are E-C1 on both projects and E-C2 on chromium, the first tests of the run, at the cold-start "Loading…"/beforeAll stage seen before; E-C1 passed in the earlier full run of this round and E-C2 passes alone. E-E2 (chromium) failed once in an earlier full run and passed on rerun.
