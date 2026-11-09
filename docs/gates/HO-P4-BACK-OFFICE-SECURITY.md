GATE: SECURITY
HANDOVER: HO-P4-BACK-OFFICE
COMMITS: 2f9006a (S0), c32a506 / 7cc5af5 (S2), de2a0de / 899ddad (S3), eaa9e52 / 9cc9f33 (S1), ed3028a / e65c852 (S4), bdcebe4 / 8baea3b (S5), a8bf606 (integration), 5d9ffbc (e2e/mock fix), bd13079 / d51a7d4 (docs only). Each is diffed against its own parent. The merges add no combined-diff content.
DATE: 2026-10-29
STATUS: PASS

Run 1. Scope: web/** front-end changes in the commits above. The HO-P4 backend gaps (BG-1..23) are out of scope. Owner-approved deviations are in §1 Amended (i)-(vii). The server source was read only to confirm that a UI-only control has a server-side counterpart.

FINDINGS
- none (no exploitable issue in scope)

VERIFIED (no finding)
- Staff sign-in and `?next=`. In eaa9e52, app/(auth)/staff/sign-in/page.tsx and forgot-password/page.tsx change only the frame: `AuthCard` becomes `StaffAuthFrame` (components/back-office-overview/StaffAuthFrame.tsx, static markup with the title and helper as React text). The success path is unchanged: `queryClient.clear()`, `restorePreservedBranch` for the same account, then `sanitizeNextPath(next, '/staff/', '/staff')` before `router.push`. No HO-P4 commit touches web/lib/** (validation, api client, CSRF helpers, session hooks), middleware or next.config. The staff-shell Sign out is the existing `SignOutButton audience="staff"`, and only its placement changed.
- Session, CSRF and browser storage. Added code has no `localStorage`, `sessionStorage` or `document.cookie` (the only hit is a test's `sessionStorage.clear()`). No `window.open`, `target="_blank"`, `eval` or `new Function`. The sidebar `ActiveBranchPicker variant="sidebar"` calls the same `setActiveBranch` as before and adds no storage.
- HTML rendering. No `dangerouslySetInnerHTML` or `innerHTML` in any non-test file changed by HO-P4. The two `innerHTML` hits are test assertions. No HO-P4 commit touches web/components/notifications/**, so template previews are unchanged. Product name, brand, customer names, bank references and report labels all render as React text.
- Role/permission gating. Every gate added or moved is presentation only, with a server control behind it:
  - AdminNav tabs and the "More administration" list are filtered by `roleIds`. U-A1 still proves a hidden page is refused by the server.
  - The Customers split view shows the Erase panel to Administrators only. `Customers.Erase` is decided by the server.
  - CustomerProfileView maps `ApiForbiddenError` to `PermissionDeniedState`. The customers lookup and approvals queue map a 403 to `PermissionDeniedState`/`AccessRefusedState`.
  - The orders side panel takes its next action and Cancel from `order.allowedActions` only (components/orders/StaffOrderSidePanel.tsx:118-122, :217).
  - New sidebar entries (Customers, Goods receiving) are links only. Their pages get their data through hooks that surface the server's 403.
- Self-recorded payment approval (Amended (i)). components/billing/ApprovalsQueue.tsx swaps Approve for the warning when `!r.canApprove` or `r.recordedBy === session.staffAccountId`, and keeps Reject. The server enforces separation of duties for both commands: src/Domain/AmarGram.Domain/Aggregates/Billing/PaymentAggregate.cs:166-167 (Approve) and :184-185 (Reject) throw `ApproverMustDiffer` when the approver is the recorder. So a forged request cannot self-approve. ApprovePaymentPanel (orders) is a restyle only.
- Product photo upload (S3, ADR-FE-035 correction). components/staff-shop/ImagesEditor.tsx mounts the existing, unchanged shared `FileUploader` with `purpose="ProductImage"` and `audience="staff"`. It only appends the returned `fileId`, with alt text still required. Type and size hints come from lib/files/fileRules.ts. The real checks (type, size, virus scan, purpose) are server-side in the File Storage module, which this change set does not touch. The client cap of 12 images matches the existing zod `max(12)`.
- URL state. `?order=` (StaffOrderQueue via `useUrlFilterState`) and `?customer=`/`?q=` (customers page via `useUrlParams`) feed only `useStaffOrder`/`useStaffCustomer`. Their API paths use `encodeURIComponent` (lib/api/staff-orders.ts:172, lib/api/staff-customers.ts:74, and billing-staff.ts `id = encodeURIComponent`), so a crafted id cannot add path segments or query parameters. The server applies the branch and permission scope ("This order may belong to another branch"). Ids in the URL are opaque GUIDs, not PII. The customer search term in `?q=` (mobile or email) was already the established pattern for staff list filters and is staff-only.
- Open redirects and dynamic links. Every new `router.push`/`href` is a fixed `/staff/...` path or a template on a server id. The exceptions:
  - "Preview in shop" `/shop/products/${product.slug}` (ProductEditorHeader) is same-origin and path-prefixed.
  - The product-section `<select>` pushes only values from its own fixed `sections` list.
  - `rosterHref` comes from the active branch id.
  - The export link is the existing `staffProductsExportUrl`.
- Mock credentials (5d9ffbc, a8bf606). The new `inventoryStaff` login (`inventory@purrcare.test` / `InventoryPass123!`) exists only in web/mocks and the e2e fixtures. MSW starts only when `NODE_ENV === 'development'` and `NEXT_PUBLIC_USE_MOCKS === 'true'` (app/providers.tsx:112). The credentials appear nowhere in src/ or deploy/.
- No new dependency. web/package*.json is unchanged.

NOTES (not security, for CODE_REVIEW / ACCEPTANCE)
- The rationale of Amended (i) does not match the server. It says that keeping Reject lets "a recorder withdraw their own pending payment and the day can close". But `PaymentAggregate.Reject` (PaymentAggregate.cs:184-185) refuses the recorder with `ApproverMustDiffer`, the same as Approve. So a self-recorder who presses Reject gets the error "A payment must be approved by a different staff member than the one who recorded it." (web/lib/api/errors.ts:378). This fails safe, so it is not a security issue. But the stated purpose of the deviation is not met, and the error wording is misleading for a rejection. The owner should either drop the premise or have the backend allow a recorder to withdraw (a backend change, outside this handover).

SCOPE CHECK
- files in allowed scope: per the ARCHITECTURE gate run 2 (docs/gates/HO-P4-BACK-OFFICE-ARCHITECTURE.md, 157/157 under §1 Amended (i)-(vii)); not re-litigated here
- files outside allowed scope: none found by this gate
