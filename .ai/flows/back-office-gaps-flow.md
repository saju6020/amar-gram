# Back-office backend gaps (HO-P4 BG-9, 10, 13, 14, 16, 17, 18)

## Status: Complete (backend); web wiring is separate

## What it does
Closes the backend gaps the HO-P4 back-office redesign listed (appendix "Backend gaps"), approved by the owner on 2026-10-25:
richer staff product-list rows, bulk publish/hide, a compare-at ("Was") price, organic-certificate expiry and file, reorder level
and batch provenance on the stock reads, an arriving-consignments count, and server-side goods-receipt drafts with receiving into
another branch. Fresh baseline: `InitialAmarGram` was regenerated (no production data).

## Key aggregates / components
- `SkuPriceAggregate.CompareAtAmount` (BG-13) -- on the price row, so it is effective-dated with the price it compares to.
- `FoodDetails.OrganicCertificateExpiresOn` / `OrganicCertificateFileId` (BG-14), `FilePurpose.OrganicCertificate` (id 8).
- `BulkChangeProductStatusCommand` (BG-10) -- orchestrates the single-product publish/unpublish handlers.
- `GoodsReceiptDraftAggregate` + `IGoodsReceiptDraftCounter` (BG-18), `IActiveBranchAccessor.ResolveBranch(branchId)`.

## Key files
- Product: `Domain/.../Aggregates/Product/SkuPriceAggregate.cs`, `ValueObjects/FoodDetails.cs`, `DomainServices/ProductPublicationRules.cs`,
  `Application/.../Commands/Product/BulkChangeProductStatusCommand.cs`, `CommandHandlers/Product/BulkChangeProductStatusCommandHandler.cs`,
  `SetFoodDetailsCommandHandler.cs`, `Read/.../QueryHandlers/Product/GetStaffProductsQueryHandler.cs`, `CatalogueSizeExpansion.cs`
- Inventory: `Domain/.../Aggregates/Inventory/GoodsReceiptDraftAggregate.cs`, `Application/.../CommandHandlers/Inventory/GoodsReceiptDraftCommandHandlers.cs`,
  `Read/.../QueryHandlers/Inventory/StockQueryHandlers.cs`, `ConsignmentQueryHandlers.cs` (`ConsignmentReads.ArrivingWithin`),
  `Api/.../Controllers/StaffGoodsReceiptDraftsController.cs`, `Api/.../Branches/HttpContextActiveBranchAccessor.cs`
- Tests: `ProductBackOfficeGapsDomainTests`, `GoodsReceiptDraftTests`, `ProductBackOfficeGapsApplicationTests`, `GoodsReceiptDraftHandlerTests`,
  `ProductBackOfficeGapsEndpointTests`, `InventoryBackOfficeGapsEndpointTests`

## Decisions made (2026-10-25)
- BG-10 "hide" = **Unpublish** (Active to Draft), not the `ListedOnStorefront` flag (a details-form field with no command of its own). The request carries
  **no versions**: each product is its own transaction at its current version; the transition is state-guarded (publish needs a complete checklist), so a stale
  list row cannot cause a wrong write. The response is 200 with a per-product result whatever the mix; 400 only for a malformed request.
- BG-13 compare-at is optional per price row, same currency, must exceed the price (`CompareAtMustExceedPrice`). Shown from the price in force now; a scheduled
  row keeps its own (`scheduledCompareAtPrice`). The storefront view SQL is unchanged (cards read it per size in `CatalogueSizeExpansion`).
- BG-14 expiry is judged on the **UTC date**, inclusive (valid through its expiry date), identically by the publish command and the staff checklist
  (`PublicationFacts.Today`; null skips the check). Only a CertifiedOrganic claim is checked. An already-active product is not unpublished when its
  certificate lapses -- the gate is on publishing. Expiry, file and URL are staff-only; the public product read is unchanged.
- BG-16 `reorderLevel` = sum of the SKU's explicit per-location policies in the branch, else the branch default once (the reorder point is per SKU and location).
- BG-17 "arriving" = branch-local today through today + N days (default 7), not cancelled, with no goods receipt against it yet (a cleared one still counts).
- BG-18 drafts are the owner's workspace: no domain events, no audit; the platform repository cannot delete, so a closed draft keeps an empty tombstone and can
  never be saved again. Receiving elsewhere = `branchId` in the body/query, authorised by the same rule as `X-Branch-Id` (`ResolveBranch`).

## Remaining work
- Web wiring (`web/`) for all seven gaps (owned by the HO-P4 web work).
- Tombstone drafts are never purged (a retention pass could delete old closed ones).
- The final merge regenerates `InitialAmarGram` once more.
