# TC-HO-P5-WIRING-S3 — Catalogue and stock (BG-9, 10, 12, 13, 14, 16, 17, 18)

Handover: docs/handover/HO-P5-WIRING.md (S3: §1 Amended (i), (l), (n), (ac), (ak), (an); §11.4; §13 S3 block; §15 U28-U36, U46, U47; §16 E10-E12; §17; §18 A10-A13, A18-A21; §19)
Commit(s) under test: feat/p5-s3-catalogue-stock at HEAD 1cc4abd (S3 commits since feat/phase2-catalogue-theme; gates passed at 8abd5f5, then 1cc4abd fixed CODE_REVIEW run 3's four LOWs)
Written: 2026-11-03 (before any test command ran; reviewed against the handover and amended before execution: T7, T8, G10, R26, the (i)/(l) statements, and M21 added after the full Vitest run but before its mutation ran)  ·  Executed: 2026-11-03 to 2026-11-04

> Statuses record what was **observed**, not inferred. The Evidence column names what was actually
> seen. `BLOCKED` marks a case that could not be executed or whose result was reasoned about rather
> than watched. The handover's U-rows are prose rows; IDs keep the handover's U28-U36, U46, U47 and
> E10-E12 and add sub-letters and gate-added rows (T*, M*, R*, G*), which I assigned.

## What counts as a pass (stated before running)

- **S3's rows block:** T1-T6, U28-U36, U46, U47, E10, E11, E12 (every test in the named specs, both `chromium` and `mobile-360`), the
  regression rows R*, the mutation rows M*, and the gate rows G* (the integrator's required points).
- **Baseline exceptions:** none of the 12 baseline failures sits in an S3 spec now. `procurement-flows` :95 E-A3 was dropped from the
  baseline by Amended (ak) and must pass.
- **First attempt counts** (`--retries=0`). A failure that passes when rerun warm is recorded as a cold-compile flake, with both runs, as
  the integrator instructed; it is not hidden and not silently turned into a PASS.
- **Mutations:** edit one line of product code, run the named Vitest files, record which tests failed, `git checkout -- <file>`, confirm
  `git status` shows only gate files. PASS = at least one slice test failed. A mutation no slice test catches is a FAIL row (a test gap,
  not a product defect), even if a gate test catches it.
- **E2E environment:** a **fresh** `next dev` per chunk on PORT=3123, NEXT_PUBLIC_USE_MOCKS=true,
  NEXT_PUBLIC_API_BASE_URL=http://localhost:5005 (no API listening), routes warmed with curl, `--retries=0 --max-failures=20`, both
  projects, `--workers=1` for the flow specs and `--workers=2` for `inventory-a11y-responsive` (470 tests). After each chunk the server,
  the Playwright tree and any `chrome-headless-shell` are killed and :3123 is checked free. Mutations never run while an e2e chunk runs
  (the dev server would serve the mutated code).
- **Amended (i), stated up front (S0 ACCEPTANCE carry-forward):** only S3's own §16 rows (E10, E11, E12) and S3's U-rows block. A
  failure in a file or spec outside S3's rows that passes when rerun alone is recorded with both runs as an (i) note and rechecked at
  E18; it does not block here. Known timing-flaky Vitest files (Amended (i)) fall under this. A failure in an S3 file or an S3 spec is
  rerun once to record what it does, but the first attempt is what counts; if it passes on a warmed server only after a cold-compile
  timeout, that is written down as such, with both runs.
- **E17 is not a gate row here** (Amended (l)): no spec outside E10-E12 is run as a gate row; E17 and E18 are integration's.
- **Build:** `next build` on a clean `.next`, then the served output is searched for S3 mock-only data (seed names, mock seams, the
  inventory mock's persist key, MSW strings); 0 hits outside `.next/cache` is the pass, with positive controls for S3 UI strings.
- "Single Back" (integrator point) is defined here, before running: after a successful post the browser shows the receipt; **one** Back
  leaves the receipt for the receiving address (it may say "That draft is no longer here", the residual the slice report names in Round 5
  item 1); **a second** Back leaves the receiving flow for the page before it. No duplicate receiving entry.
- Me: no product code and no existing spec edited. Gate tests go in new files only.

## Summary

| | Count |
|---|---|
| Total | 129 |
| PASS | 126 |
| FAIL | 2 (M18, R1: one test gap, no product defect) |
| BLOCKED | 1 (E12c, real-API run) |
| NOT RUN | 0 |

The acceptance-criteria rows below are coverage, not cases, and are not counted. E17 is not a row (Amended (l)).

## Environment

- Worktree `agent-a9627fce510dd35df`, branch `feat/p5-s3-catalogue-stock` at 1cc4abd, plus the three untracked gate files. Windows 11, Node, Next `next dev` (MSW), Vitest 5.0.1, Playwright.
- typecheck, lint, the full Vitest suite (`--maxWorkers=2`) and `next build` were run. No backend: nothing listens on :5005, so the real-API specs and the contract test are not run.
- E2E: a fresh `next dev` on :3123 per chunk (`NEXT_PUBLIC_USE_MOCKS=true`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:5005`), routes warmed with curl, `--retries=0`. Chunks: A `shop-staff` (w1); B, B2, B3, B4, B5 `inventory-flows` (w1; B4 is the §20.8 rerun of the chunk); C, C2, C3 `procurement-flows` (w1); D the gate spec (w1); E, E2 `inventory-a11y-responsive` (w2, then w1 for the rerun); DBG one temporary probe spec (deleted). `NODE_OPTIONS=--max-old-space-size=6144` for A and B, 8192 from B3 on, after `next dev` restarted itself for memory in B and B2.
- After every chunk the server, the Playwright tree and any `chrome-headless-shell` were killed and :3123 checked free (logged "port 3123 free").

## Command rows

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| T1 | `npm run typecheck` | exit 0 | PASS | `npm run typecheck` (tsc --noEmit) exit 0, no output, at 1cc4abd + the untracked gate files |
| T2 | `npm run lint` | exit 0, no warnings | PASS | `npm run lint` (eslint . --max-warnings 0) exit 0, no output; includes the two gate test files |
| T3 | Vitest, the slice's folders at `--maxWorkers=2`: `tests/components/{staff-shop,inventory,stock,back-office-stock,procurement,admin}`, `tests/unit/files`, `tests/guards`, `tests/components/shop/no-hex-literals.test.ts`, `tests/components/back-office/no-colour-literals.test.ts` | every file passes | PASS | Taken from the T4 run's JSON (`--maxWorkers=2`): 44 files / 568 tests in `components/{staff-shop,inventory,stock,back-office-stock,procurement,admin}`, `unit/files`, `guards`, `no-hex-literals`, `no-colour-literals`; 567 passed, 1 failed: `inventory/shared-pieces.test.tsx` U-A3 "a fast burst ending in Enter fires one lookup" (0 calls). That file is not S3's (last changed 380e387, 2026-10-24, before S3; not in S3's diff), is the known load-sensitive ScanField timing case (HO-P3 TEST, HO-RPT-002 TEST, S0 TEST, S3 slice report Round 3), and passed alone 17/17 three times in a row. Recorded under Amended (i). Every S3-written or S3-changed file passed in the full run (listed per file in the report) |
| T4 | Full Vitest `npm test -- --maxWorkers=2` | exit 0 (a flaky file outside S3's folders that passes alone is an (i) note) | PASS | `npx vitest run --maxWorkers=2` (2026-11-03, 742.5 s): Test Files 1 failed, 240 passed, 1 skipped (242); Tests 1 failed, 2277 passed, 45 skipped (2323); exit 1. The one failure is `inventory/shared-pieces.test.tsx` U-A3 (see T3): not an S3 file, a known timing flake, passes alone 3 of 3. PASS under Amended (i) only; the raw exit was 1 and is recorded here. The expectation written up front named a flaky file "outside S3's folders"; this one sits in an S3 folder, but S3 did not touch it |
| T5 | No money arithmetic in S3's browser code: no `Number(`, `parseFloat(`, `parseInt(`, unary `+`, `Math.*` or `toFixed` on an amount in the non-mock, non-test files S3 changed; every amount S3 sends goes through `wireMoney`; positive control: the scan finds a planted `parseFloat(price)` | 0 hits; control found | PASS | Added lines of the 33 non-mock, non-test `.ts/.tsx` files S3 changed under `components app lib` (`git diff -U0 542e7e0 HEAD`): 0 hits for `Number(`, `parseFloat(`, `parseInt(`, `Math.`, `toFixed`, unary `+`. Control: the same grep finds a planted `+const x = parseFloat(price);` and `+const y = +price;`. Amounts sent: `scheduleSkuPrice` sends `compareAtAmount` through `wireMoney` (`staff-shop.ts:448-457`); the draft and post keep `unitCostAmount` as the typed string (`receiptModel.ts:165,263`), unchanged from HO-P4's post contract. The ESLint money rules also pass (T2) |
| T6 | U46 back-up: `rg` for colour literals over the files S3 changed in `components app` | 0 matches | PASS | `rg "#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|-\[#"` over the 20 `.ts/.tsx` files S3 changed under `web/components web/app`: 0 matches (exit 1); and over all of `components app`: 0 lines |
| T7 | `rm -rf .next && npx next build` | exit 0 | PASS | `rm -rf ./.next && npx next build`: "Compiled successfully in 86s", static pages 123/123, exit 0, no warning or error line in the log |
| T8 | Served output has no S3 mock data: search `.next` (excluding `cache`) for S3 mock-only terms; positive controls for S3 UI strings | 0 hits for each mock term; controls found | PASS | `grep -rlF --exclude-dir=cache` over `.next` after T7: 0 files for each of `NADIA-DRAFT` (the other member's draft seed), `__purrcare_inventory_mock_db__v2` (inventory mock persist key), `dd000000-0000-4000-8000-000000000001` (draft seed id), `uploadedFilePurpose` (mock seam), `is not an allowed type for purpose` (mock upload message), `mockServiceWorker`, `setupWorker`. Positive controls, 2 files each: `Draft saved at`, `Receive into`, `Was price (optional)`, `Below reorder level`, `Certificate valid until`, `consignments arriving in the next` |

## Unit cases (§15, mapped to the slice's tests; run inside T3 with the verbose reporter)

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| U28a | Products table BG-9: thumbnail with server alt, origin, sizes, price range, stock, Organic pill | as §15 U28 | PASS | products-p5 "shows the thumbnail with the server alt text, origin, sizes, price range, stock and the Organic pill" passed (full run) |
| U28b | One price when min = max; "—" for unknown stock/origin; placeholder for no image; no pill | as §15 | PASS | products-p5 "shows one price when min equals max, — for unknown stock and origin, the placeholder for no image, no pill" passed |
| U28c | Superseded "Not built" assertions in `products-design.test.tsx` replaced at least as strong | positive headers present; "—" cells | PASS | products-design "shows the design columns (HO-P5 BG-9 adds Origin, Price and Stock); without the bulk handler there are no select boxes" passed; read: positive headers plus "—" cells and no checkbox without the handler, at least as strong as the old absence check |
| U29a | Bulk: tick rows, confirm names the count, ONE `bulk-status` call with the ids, server counts and failures shown, selection clears | as §15 U29 | PASS | products-p5 "ticks rows, confirms naming the count, makes ONE call with the ids, reports the server counts and failures, then clears" passed (fixture counts 7/3 against items 1/1, so browser counting would fail; see M6) |
| U29b | Publish confirms too; a single row can be cleared | | PASS | products-p5 "Publish confirms too, and a single selected row can be cleared" passed |
| U29c | Selection clears on page change (OQ-12) | | PASS | products-p5 "clears the selection when the page shows different products (page change, OQ-12)" passed |
| U29d | A 400 is plain language; nothing reported as updated | | PASS | products-p5 "a malformed-request 400 is shown in plain language and nothing is reported as updated" passed |
| U30a | District saved in the same PUT with `expectedVersion`; `isSubscribable` never sent | | PASS | products-p5 "saves the district in the same PUT as everything else, with expectedVersion, and never sends isSubscribable" passed |
| U30b | Clearing sends null; server refusal under the field | | PASS | products-p5 "clearing the field sends null; the server refusal lands under the field" passed |
| U30c | `two-step-save.test.tsx` passes | | PASS | `staff-shop/two-step-save.test.tsx` 5/5 passed (unchanged by S3) |
| U31a | Was column: `compareAtPrice`, "then …" beside a scheduled one, "—" without | | PASS | products-p5 "renders the compare-at price and then … beside a scheduled one; — without one" passed; products-sections "…the Was price column…" passed |
| U31b | Schedule dialog sends `compareAtAmount`; `CompareAtMustExceedPrice` under the field | | PASS | products-p5 "the schedule dialog sends the optional Was price, and CompareAtMustExceedPrice shows under that field" passed |
| U31c | No Was sends none; malformed Was refused before any request | | PASS | products-p5 "the schedule dialog without a Was price sends none; a malformed Was price is refused before any request" passed |
| U31d | Request body: `compareAtAmount` beside the amount, none when unset | | PASS | products-p5 "the request body carries compareAtAmount as a JSON number next to the amount, and none when unset" passed |
| U31e | `schedule-extra-field.test.tsx` (slot) and the unchanged `schedule-change-dialog.test.tsx` pass | | PASS | schedule-extra-field 4/4 passed; `admin/schedule-change-dialog.test.tsx` 5/5 passed and is unchanged in S3's diff |
| U32a | Expiry date shown; Expired pill only from the server flag | | PASS | products-p5 "shows the expiry date, and the Expired pill ONLY when the server says so (never from the date)" passed |
| U32b | View certificate: signed URL, new tab, `noopener`; Remove file saves null | | PASS | products-p5 "View certificate opens the signed URL in a new tab with noopener; Remove file saves null" passed |
| U32c | `InvalidCertificateFile` inline | | PASS | products-p5 "InvalidCertificateFile shows under the file field in plain language" passed |
| U32d | Food PUT carries the certificate fields | | PASS | products-p5 "the page saves the certificate fields in the food PUT (expiry kept, file cleared with null)" passed |
| U32e | Upload uses `purpose="OrganicCertificate"`; file rule PDF/JPEG/PNG/WebP 10 MB (`file-rules.test.ts`) | | PASS | `unit/files/file-rules.test.ts` 15/15 passed (OrganicCertificate: PDF, JPEG, PNG, WebP, 10 MB); staff-shop mock-refusals "upload purpose OrganicCertificate: a text file is a 400 FileTypeNotAllowed …; over 10 MB … FileTooLarge" passed. The uploader's own `purpose="OrganicCertificate"` prop has no component assertion: see M21 |
| U33a | Reorder at: "(branch default)", "Off" for "0", explicit level; pill only when the server flags | | PASS | stock-p5 "says (branch default) for a default level, Off for 0, the plain level for an explicit one, and flags only what the server flags" passed; stock-by-item "…and the Reorder at column (HO-P5 BG-16)" passed |
| U33b | "Below" never computed from figures | | PASS | stock-p5 "does not decide below from the figures …" passed |
| U33c | Batch matrix Received and Supplier, "—" without | | PASS | stock-p5 "has Received and Supplier columns: the branch-local date, the supplier name, — without either" passed |
| U34a | Arrivals row text and link with `arrivingWithinDays` | | PASS | stock-p5 "shows {count} consignments arriving in the next {withinDays} days linking with arrivingWithinDays" passed |
| U34b | Singular, wider window as sent | | PASS | stock-p5 "uses the singular for one consignment and a wider window as the server sent it" passed |
| U34c | Absent without `consignmentsArriving` | | PASS | stock-p5 "leaves the row out when the server sent no consignmentsArriving" passed |
| U34d | Overview sends no `arrivalWindowDays` (react-query context bug guard) | | PASS | stock-p5 "sends no arrivalWindowDays (the query context object must not become the parameter) …" passed |
| U35a | Autosave: one PUT 1.5 s after the last change; keystroke restarts the wait | | PASS | receipt-draft-autosave "saves ONE whole-form PUT 1.5 s after the last change, not before" and "a keystroke inside the quiet moment restarts it" passed |
| U35b | Never two in flight; newest form sent after | | PASS | receipt-draft-autosave "never has two requests in flight: … only the NEWEST form is sent after" passed |
| U35c | "Draft saved at hh:mm" in `role="status"` | | PASS | goods-receipt-form U-C4 ("Draft saved at hh:mm" in a role=status) passed |
| U35d | Reload with `?draft=` restores the form | | PASS | receipt-drafts page "reloading with ?draft= restores the saved form (lines, lot, delivery reference)" passed |
| U35e | Post sends `draftId` | | PASS | receipt-drafts "posting sends the draft id … and the own branch of the form even with one branch" passed |
| U35f | Discard confirms then deletes | | PASS | receipt-drafts "Continue opens that draft; Discard confirms, then deletes it" and goods-receipt-form U-C4 passed |
| U35g | 404 on save stops autosave with a message | | PASS | receipt-drafts "a 404 on save stops autosaving and says so in the status line"; autosave "a 404 means the draft was closed elsewhere …" passed |
| U35h | `GoodsReceiptDraftLimitReached` plain text | | PASS | receipt-drafts "GoodsReceiptDraftLimitReached is plain text under the heading …"; autosave "… shown as plain text, the code is never shown …" passed |
| U35i | `goods-receipt-form.test.tsx` passes (superseded U-C4/U-C4b at least as strong) | | PASS | goods-receipt-form 7/7 passed; U-C4/U-C4b read: server draft in `db.receiptDrafts`, nothing in sessionStorage, no restore prompt, Discard confirms; at least as strong as the old storage assertions |
| U36a | No select with one branch | | PASS | receipt-drafts U36 "is not shown with one branch, and with none given" and receiving-layout U32 passed |
| U36b | Two branches: labelled "Receive into" defaulting to the active branch | | PASS | receipt-drafts U36 "with two branches is a labelled select defaulting to the active branch …" passed |
| U36c | Changing it refetches POs, consignments, locations with `branchId`; asks before clearing line locations | | PASS | receipt-drafts U36 "asks before clearing line locations …" and page "choosing another branch reads the orders, consignments and locations for THAT branch" passed |
| U36d | Post carries `branchId`; `BranchNotAssigned` mapped | | PASS | receipt-drafts U36 "the post carries branchId and draftId; BranchNotAssigned is mapped to plain language" passed |
| U46 | `no-hex-literals` and `no-colour-literals` pass over the touched files | | PASS | `shop/no-hex-literals.test.ts` 213/213 and `back-office/no-colour-literals.test.ts` 2/2 passed in the full run; back-up rg T6 0 matches |
| U47a | Mock: district > 60 / control char / tab → server's codes and property | | PASS | staff-shop mock-refusals, district: > 60 MaximumLengthValidator, control char PredicateValidator, tab InvalidDistrictOfOrigin, a refused save changes nothing; 4 passed |
| U47b | Mock: bulk-status empty, > 100, nil id, bad action; 200 per-item outcomes | | PASS | staff-shop mock-refusals, bulk: no ids NotEmptyValidator, > 100, empty id and bad action InvalidBulkAction, 200 per item, Unpublish; 5 passed |
| U47c | Mock: expired certificate blocks publish (single and bulk) with `OrganicCertificateExpired` | | PASS | staff-shop mock-refusals "an expired organic certificate blocks publishing with its own code (single and bulk)" passed |
| U47d | Mock: compare-at ≤ price (equal included) → `CompareAtMustExceedPrice`; shape rules | | PASS | staff-shop mock-refusals, compare-at: CompareAtMustExceedPrice (equal included), shape rules, stored and cleared; 3 passed |
| U47e | Mock: certificate file id unknown / wrong purpose / on another product → `InvalidCertificateFile`; upload type and size | | PASS | staff-shop mock-refusals, certificate: unknown id, wrong purpose, on another product, upload type and size; 5 passed. Owner and 30-minute window not modelled (R21) |
| U47f | Mock: list extras computed as the server does | | PASS | staff-shop mock-refusals "the staff list extras …" passed |
| U47g | Mock: drafts owner-only 404, limit 20, closed 404, negative 400, over-long `MaximumLengthValidator` | | PASS | inventory mock-refusals, drafts: owner-only 404, 21st draft GoodsReceiptDraftLimitReached, closed 404, negative InvalidGoodsReceiptDraft, MaximumLengthValidator first, post closes the draft; 7 passed |
| U47h | Mock: `BranchNotAssigned` 403 `{ error }` on lists, post and draft PUT | | PASS | inventory mock-refusals "a branch the caller is not assigned to is a 403 { error: BranchNotAssigned } …" and "the order, consignment and location lists and the post refuse …" passed |
| U47i | Mock: `arrivalWindowDays` / `arrivingWithinDays` outside 1-90 → 400 `InvalidQuery` | | PASS | inventory mock-refusals arrivalWindowDays and arrivingWithinDays outside 1-90 → 400 InvalidQuery; 2 passed |
| U47j | Mock: reorder level / below flag / batch received and supplier | | PASS | inventory mock-refusals reorder level / below flag and batch received / supplier; 2 passed |

## Mutation rows (do the slice's tests catch a broken line?)

| ID | Mutation (one line, product code) | Tests run | Status | Evidence |
|---|---|---|---|---|
| M1 | `GoodsReceiptForm` post catch: drop `autosave.resume()` | inventory | PASS | 1 slice test(s) failed: receipt-drafts.test.tsx "after a refused post, an edit is saved again and the status updates". Restored with `git checkout --`; `git status` after: gate files only |
| M2 | `GoodsReceiptForm` discard catch: drop `autosave.resume()` | inventory | PASS | 2 slice test(s) failed: receipt-drafts.test.tsx "after a refused discard, an edit is saved again"; receipt-guard.test.tsx "stays on while the post is in flight, even with nothing unsaved (releasing it walks the page back)". Restored with `git checkout --`; `git status` after: gate files only |
| M3 | receipts/new `onPost`: `router.replace` → `router.push` | inventory | PASS | 1 slice test(s) failed: receipt-guard.test.tsx "replaces the address with the receipt (no extra history entry) and never says the draft is gone". Restored with `git checkout --`; `git status` after: gate files only |
| M4 | `useReceiptDraft` key: back to the active-branch key | inventory | PASS | 1 slice test(s) failed: receipt-drafts.test.tsx "a branch switch does not refetch it (the server filters by id and owner only)". Restored with `git checkout --`; `git status` after: gate files only |
| M5 | receipts/new `draftReady`: drop `drawnFor` | inventory | PASS | 1 slice test(s) failed: receipt-drafts.test.tsx "a resumed draft stays mounted, with its typed text, when the branch is switched in the sidebar". Restored with `git checkout --`; `git status` after: gate files only |
| M6 | `ProductBulkActions`: count `items` in the browser instead of the server's `succeededCount` | staff-shop | PASS | 1 slice test(s) failed: products-p5.test.tsx "ticks rows, confirms naming the count, makes ONE call with the ids, reports the server counts and failures, th". Restored with `git checkout --`; `git status` after: gate files only |
| M7 | Shop mock compare-at: `<=` → `<` (equal accepted) | staff-shop | PASS | 1 slice test(s) failed: mock-refusals.test.ts "a compare-at that does not exceed the price is a 400 CompareAtMustExceedPrice on CompareAtAmount (equal includ". Restored with `git checkout --`; `git status` after: gate files only |
| M8 | Shop mock district length 60 → 61 | staff-shop | PASS | 2 slice test(s) failed: mock-refusals.test.ts "more than 60 characters is a 400 MaximumLengthValidator on DistrictOfOrigin"; mock-refusals.test.ts "a refused save changes nothing and a trimmed district is stored; blank clears it". Restored with `git checkout --`; `git status` after: gate files only |
| M9 | Shop mock bulk cap 100 → 101 | staff-shop | PASS | 1 slice test(s) failed: mock-refusals.test.ts "more than 100 ids is a 400 with the server message". Restored with `git checkout --`; `git status` after: gate files only |
| M10 | Inventory mock open-draft limit 20 → 21 | inventory | PASS | 1 slice test(s) failed: mock-refusals.test.ts "a 21st open draft is a 400 GoodsReceiptDraftLimitReached on DraftId; saving an existing one still works (handl". Restored with `git checkout --`; `git status` after: gate files only |
| M11 | Inventory mock arrival window upper bound 90 → 91 | inventory | PASS | 1 slice test(s) failed: mock-refusals.test.ts "arrivalWindowDays outside 1-90 is a 400 InvalidQuery on arrivalWindowDays; the default is 7". Restored with `git checkout --`; `git status` after: gate files only |
| M12 | Inventory mock: a list stops checking `BranchNotAssigned` | inventory | PASS | 2 slice test(s) failed: mock-refusals.test.ts "the order, consignment and location lists and the post refuse a branch the caller is not assigned to with 403"; mock-refusals.test.ts "an assigned branch is read for that branch, not the active one". Restored with `git checkout --`; `git status` after: gate files only |
| M13 | `StockTable`: "Off" for "0" dropped | stock, back-office-stock | PASS | 2 slice test(s) failed: stock-p5.test.tsx "says "(branch default)" for a default level, "Off" for 0, the plain level for an explicit one, and flags only"; stock-p5.test.tsx "does not decide "below" from the figures: usable above the level with the server flag set still shows the pill". Restored with `git checkout --`; `git status` after: gate files only |
| M14 | `FoodDetailsForm`: Expired pill from a local date compare instead of the server flag | staff-shop | PASS | 1 slice test(s) failed: products-p5.test.tsx "shows the expiry date, and the Expired pill ONLY when the server says so (never from the date)". Restored with `git checkout --`; `git status` after: gate files only |
| M15 | `ProductDetailsForm` / details PUT: `isSubscribable` sent | staff-shop | PASS | 1 slice test(s) failed: products-p5.test.tsx "saves the district in the same PUT as everything else, with expectedVersion, and never sends isSubscribable". Restored with `git checkout --`; `git status` after: gate files only |
| M16 | Consignments page: the 1-90 integer check dropped | staff-shop (review-round), procurement | PASS | 5 slice test(s) failed: review-round.test.tsx "arrivingWithinDays=0 -> false"; review-round.test.tsx "arrivingWithinDays=91 -> false"; review-round.test.tsx "arrivingWithinDays=999 -> false"; review-round.test.tsx "arrivingWithinDays=abc -> false"; review-round.test.tsx "arrivingWithinDays=7.5 -> false". Restored with `git checkout --`; `git status` after: gate files only |
| M17 | `useStaffProducts`: active branch dropped from the key | staff-shop | PASS | 1 slice test(s) failed: review-round.test.tsx "a branch switch refetches the list instead of reusing the other branch's rows". Restored with `git checkout --`; `git status` after: gate files only |
| M18 | `GoodsReceiptForm` "Receive into" select: `min-h-11` dropped | inventory | FAIL | 0 slice tests failed (111 passed); only the gate test failed: inventory/test-gate-s3.test.tsx :: carries min-h-11. Restored with `git checkout --`; `git status` after: gate files only |
| M19 | `ProductBulkActions`: selection not cleared after the action | staff-shop | PASS | 1 slice test(s) failed: products-p5.test.tsx "ticks rows, confirms naming the count, makes ONE call with the ids, reports the server counts and failures, th". Restored with `git checkout --`; `git status` after: gate files only |
| M20 | `UnsavedChangesGuard when`: `|| submitting` dropped | inventory | PASS | 1 slice test(s) failed: receipt-guard.test.tsx "stays on while the post is in flight, even with nothing unsaved (releasing it walks the page back)". Restored with `git checkout --`; `git status` after: gate files only |
| M21 | `FoodDetailsForm`: the certificate uploader's `purpose="OrganicCertificate"` → `"ProductImage"` (added after the full run showed no component assertion on it, before running the mutation) | staff-shop | PASS | 1 slice test(s) failed: products-p5.test.tsx ""View certificate" opens the signed URL in a new tab with noopener; "Remove file" saves null". Restored with `git checkout --`; `git status` after: gate files only |

## Integration cases (Playwright, MSW)

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| E10a | `shop-staff` S3: select two products → Hide from shop → result line; a Draft is "not updated" | pass, both projects | PASS | Chunk A (fresh `next dev` :3123, routes warmed all 200, `--workers=1 --retries=0`): `shop-staff.spec.ts:218` "select two products, Hide from shop, read the server result line; a Draft in the batch is listed as not updated" ok on chromium and mobile-360, first attempt |
| E10b | `shop-staff` S3: district and Was price; Was not higher refused under its field | pass, both | PASS | Chunk A: `shop-staff.spec.ts:268` "set a district and a Was price; a Was price that is not higher is refused under its field" ok on both projects (11.1 s / 9.8 s) |
| E10c | `shop-staff` S3: expired certificate blocks publish with the message; renewing lets it through | pass, both | PASS | Chunk A: `shop-staff.spec.ts:304` "an expired organic certificate blocks publishing with the message; renewing it lets it through" ok on both projects (9.3 s / 8.6 s) |
| E10d | `shop-staff` existing cases (E-C1, E-C2, E-C3 ×2, E-F1, origins) | pass, both | PASS | Chunk A: E-C1 :16, E-C2 :111, E-C3 :138, E-C3 :156, E-F1 :171, origins :197 ok on both projects. Whole chunk: 18 passed (3.5 min), exit 0, first attempt, no cold-compile timeout this time |
| E11a | `inventory-flows` S3: Reorder at; arrivals row links to the filtered consignments | pass, both | PASS | Chunk B (fresh `next dev` :3123, warmed, `--workers=1 --retries=0`): `inventory-flows.spec.ts:316` "Stock by item shows Reorder at; the overview counts consignments arriving and links to them" ok on chromium (#12) and mobile-360 (#28), first attempt |
| E11b | type a receipt, reload with `?draft=`, lines back, post; posted draft gone | pass, both | PASS | Chunk B: `:332` "type a new receipt, reload with ?draft=, the lines are back, post it; the posted draft is gone" ok on both projects (#13, #29), first attempt |
| E11c | Your drafts: Continue resumes; Discard confirms and deletes | pass, both | PASS | Chunk B: `:366` "Your drafts lists a saved draft; Continue resumes it; Discard confirms and deletes it" ok on both (#14, #30), first attempt |
| E11d | Receive into for two branches; asks first when lines exist | pass, both | PASS | Chunk B: `:393` "Receive into appears for a person in two branches; changing it asks first when lines exist" ok on both (#15, #31), first attempt |
| E11e | receiving axe-clean, no sideways scroll | pass, both | PASS | Chunk B: `:411` "the receiving screen has no axe violation and does not scroll sideways" ok on both (#16, #32), first attempt |
| E11f | `inventory-flows` existing cases (E-C1 … E-X3, E10) | pass, both | PASS | PASS with a recorded flake, not hidden. Runs of `inventory-flows.spec.ts` (all `--workers=1 --retries=0`, fresh server each): **B** (full, 6 GB heap): 29/32; E-F1 :204 chromium failed (5 s for "declaring a recall messages no one" after `router.push` to the recall console; the snapshot is still the batch page), E-C1 :28 and E-C2 :57 mobile-360 failed after `next dev` logged "approaching the used memory threshold, restarting" (ERR_CONNECTION_REFUSED, then a 30 s cold goto). Under §20.8 a resource crash is not a test result, so the chunk was rerun. **B2** (E-C1, E-C2, E-F1 alone, both projects): 1/6, every failure a 30 s timeout on a goto or the staff shell's "Loading…", with dev requests taking 10-24 s and another memory restart; E-F1 mobile passed. **B3** (one test per invocation, 8 GB heap): E-F1 chromium, E-C1 and E-C2 mobile all failed again by timeout. **Probe** (temporary spec, deleted): the stock detail and transfer pages work at both widths (Quantity field at 4.7 s, Shop floor option selected at 2.6 s). **B4** (full chunk rerun, 8 GB heap, no memory restart): **31/32**; E-C1 and E-C2 passed on both projects, E-F1 passed on chromium and failed on mobile-360 the same way. **B5** (E-F1 alone): mobile-360 passed (15.1 s); chromium timed out on the sign-in goto (server slow). E-F1 is HO-IMP-002's recall case: S3 changed none of its files (batches page, recall console, recall mocks); it has now passed on each project. Recorded under Amended (i)/(ae) for E18; see the report |
| E12a | `procurement-flows` (E-A1, E-A2, E-A3, E-B1, E-B2) incl. E-A3 (no longer baseline) | pass, both | PASS | PASS with a recorded cold-compile flake. Chunk C (fresh `next dev`, warmed, `--workers=1 --retries=0`): 9/10. E-A2, **E-A3** (no longer a baseline, Amended (ak)), E-B1 and E-B2 ok on both projects first attempt; E-A1 :22 ok on mobile-360 and failed on chromium, the first test of the run (`heading /^GRN-/` not visible in 5 s after Post receipt). Rerun C2 (E-A1 alone, fresh server, warmed incl. a receipt detail URL): chromium failed again at :51 (Receive goods click had not left the PO page in 5 s), mobile-360 ok. Rerun C3 (E-A1 chromium alone three times on one server, receiving and PO routes kept warm by curl every 15 s): **ok 3 of 3** (2.7 min, 1.5 min, 19.8 s). Both failures are 5 s expects across a client navigation to a route `next dev` compiles on demand; the slice report (Round 2) saw the same E-A1 first-run failure. Recorded as a cold-compile flake under Amended (i)/(ae) |
| E12b | `inventory-a11y-responsive`, the whole spec, which includes the routes S3 changed (`/staff/inventory`, `/staff/inventory/stock*`, `/staff/inventory/receipts/new`, `/staff/procurement/consignments*`) | pass, both | PASS | PASS with a recorded flake. Chunk E: the whole `inventory-a11y-responsive.spec.ts` (47 routes: axe, plus overflow at 360/768/1024/1440), fresh `next dev`, `--workers=2 --retries=0`, both projects: **458 passed, 2 failed** (19.0 min). Every route S3 changed passed axe and every width on both projects (`/staff/inventory`, `/staff/inventory/stock`, `/staff/inventory/stock/[skuId]`, `/staff/inventory/receipts/new`, `/staff/procurement/consignments` …). The 2 failures: E-X2 `/staff/inventory/storage-breaches/b1000000-…0001` at 1024 px and 1440 px on chromium, each a 30 s timeout in `waitForLoadState('networkidle')`, adjacent tests under 2-worker load; S3 changed nothing under storage-breaches. Rerun alone (E2, fresh server, `--workers=1`, all four widths, both projects): **8 passed** (2.1-2.2 s each). Recorded under Amended (i) for E18 |
| E12c | `inventory-real-api` | real-API run only | BLOCKED | Not run: a real-API run needs an API on its own database (`E2E_REAL_API=1`, `NEXT_PUBLIC_USE_MOCKS=false`); nothing listens on :5005 and no backend was started. Unblock: the integration run with a scratch API (§17.2 note) |

## Gate rows (integrator-required points; gate spec `tests/e2e/catalogue-stock-gate-s3.spec.ts`)

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| G1 | 44 px, products list: row checkbox hit area, select-all, Publish, Hide from shop, Clear, Dismiss (measured in the browser) | every box ≥ 44 px tall (and checkbox areas ≥ 44 wide), both projects | PASS | Chunk D (fresh `next dev`, warmed, `--workers=1 --retries=0`), gate spec `catalogue-stock-gate-s3.spec.ts:62`: ok on chromium and mobile-360, first attempt. Measured with `boundingBox()`: the row checkbox's label (height and width), the select-all label, Publish, Hide from shop, Clear and Dismiss are each at least 44 px; the Publish of an Active product reads "0 updated, 1 not updated" |
| G2 | 44 px, product editor: district input; Was price input (schedule dialog); certificate date, Remove file, View certificate | ≥ 44 px, both | PASS | Chunk D, gate spec :84, ok on both projects: District of origin, the schedule dialog's "Was price (optional)", Certificate valid until, View certificate and Remove file each measured at least 44 px tall |
| G3 | 44 px, receiving: Receive into select; Your drafts Continue and Discard | ≥ 44 px, both | PASS | Chunk D, gate spec :102, ok on both projects: "Receive into" and Your drafts' Continue and Discard each measured at least 44 px tall on clean code. (No slice test pins the select's class: M18) |
| G4 | Resumed draft, sidebar Outlet switch: the typed lot stays in the same field; the next autosave PUT names the draft's own branch; reload shows the text | as stated | PASS | Chunk D, gate spec :114, ok on both projects: after a sidebar Outlet switch (London), the resumed draft's lot field is the same DOM element (an expando set before the switch is still there), keeps "L-G4-X"; the next autosave PUT has `branchId` = main branch; a reload shows "L-G4-Y" |
| G5 | Fresh draft, sidebar Outlet switch: "Receive into" keeps the form's branch; the next PUT names the start branch | as stated | PASS | Chunk D, gate spec :139, ok on both projects: "Receive into" keeps the main branch after the sidebar switch and the next PUT names the main branch |
| G6 | Refused post (server-only refusal: past expiry date): the refusal shows; an edit afterwards is autosaved again (a new PUT, status "Draft saved at"); reload shows the edit | as stated | PASS | Chunk D, gate spec :152, ok on both projects: a post with a past expiry is refused by the mock ("Expired goods cannot be accepted"), the page stays on receipts/new, an edit after it sends a new PUT carrying "L-G6-AFTER", the status reads "Draft saved at", and a reload shows the edit |
| G7 | Refused discard, then an edit is autosaved | a refused discard cannot be produced against the mock in a browser; covered by Vitest + M2 | PASS | Chunk D, gate spec :174, ok on both projects. The mock never refuses an owner's discard, so the page's `window.fetch` answers the one DELETE with a 503: the form stays with its lot, an edit afterwards sends a PUT with "L-G7-AFTER", and a reload shows it. (The expected column said a browser could not produce this; the fetch override did, so the row was executed rather than left to Vitest) |
| G8 | Post → receipt → Back once → the receiving address, one entry; Back again → the page before | as defined above | PASS | Chunk D, gate spec :212, ok on both projects: post -> receipt (`GRN-` heading); `history.length` at the receipt 5; the first Back lands on `receipts/new?draft=<id>` and shows "That draft is no longer here" (the residual the slice report names in Round 5 item 1, allowed by the definition above); the second Back lands on `/staff/inventory`. No duplicate receiving entry |
| G10 | ARCHITECTURE "for TEST": the admin branches read is refused (403) for a receiving role with two assigned branches | the page still draws the form; "Receive into" is present and each option falls back to its branch id (no blank option, no error page) | PASS | gate Vitest `test-gate-s3.test.tsx` "still draws the form…": with `GET */api/admin/branches` answering 403, "Receive into" is drawn with exactly the two assigned ids as options, each option text = its id, value = main branch, no load error. Control (same test, refusal pointed at an unused URL): fails with `Expected "b0000000-…a001" Received "Dhanmondi outlet"`, so the 403 is what the test sees. Readable only as raw GUIDs: a usability note for ACCEPTANCE, not a defect (ARCHITECTURE accepted the fallback) |
| G9 | 360 px: no sideways page scroll on products (bulk bar open), product food page, variants (dialog open), stock, receiving, filtered consignments | overflow ≤ 1 px at mobile-360 | PASS | Chunk D, gate spec :240, ok on both projects (`expectNoHorizontalScroll`): products with the bulk bar open, food page, variants with the schedule dialog open, stock list, stock detail, inventory overview, receiving with a draft, consignments `?arrivingWithinDays=7`. At 360 px this is the mobile-360 run |

## Regression cases from earlier gates

| ID | Gate | Finding | Case | Status | Evidence |
|---|---|---|---|---|---|
| R1 | CR run 1 M1 | 32 px buttons, 20 px checkboxes | review-round 44 px cases + G1-G3 | FAIL | Test gap, not a product defect. review-round "the bulk bar buttons, the row checkbox hit area and the select-all label" and "the Was price input, the certificate controls and the district input" and receipt-drafts "Continue and Discard are 44 px targets" passed, and G1-G3 measured every control at 44 px or more on clean code. But the run-1 M1 list also raised the "Receive into" select, and no slice test pins it: M18 (its `min-h-11` removed) left all 111 slice tests green. Gate Vitest `test-gate-s3.test.tsx` "carries min-h-11" fails under M18 and passes on clean code |
| R2 | CR run 1 M2 | products list key had no branch | review-round "a branch switch refetches" + M17 | PASS | review-round "a branch switch refetches the list instead of reusing the other branch's rows" passed; M17 caught by it |
| R3 | CR run 1 M3 | sidebar switch moved a fresh draft's branch | receipt-drafts "a branch switch in the sidebar mid-draft…" + G5 | PASS | receipt-drafts "a branch switch in the sidebar mid-draft changes neither the branch of the form nor the form" passed; G5 ok on both projects |
| R4 | CR run 1 LOW | unmount flush dead | autosave "unmount flush" cases | PASS | receipt-draft-autosave "a change not yet saved goes out when the screen is left (the unmount flush)" and "nothing is sent on leaving when everything was saved, or after stop()" passed |
| R5 | CR run 1 LOW | orphan draft (stop did not wait) | "Discard/Post does not go until the save in flight has landed", "settle()" | PASS | receipt-drafts "Discard does not delete until the creating save has landed", "Post does not go until the save in flight has landed"; autosave "settle() waits for the save in flight …" passed |
| R6 | CR run 1 LOW | change during a failing save not retried | autosave "retried when that save FAILS" | PASS | receipt-draft-autosave "a change made while a save is in flight is retried when that save FAILS" passed |
| R7 | CR run 1 LOW | products-p5 counts fixture could not catch browser counting | U29a + M6 | PASS | U29a passed; M6 caught by it |
| R8 | CR run 1 LOW | schedule-extra-field blank/error placement | schedule-extra-field cases | PASS | schedule-extra-field 4/4 passed (blank sends no third value; server error under the field) |
| R9 | CR run 1 LOW | VariantsTable dialog state carried over | review-round "keyed by SKU" | PASS | review-round "the Was text typed for one SKU does not carry to the next" passed |
| R10 | CR run 1 LOW | Was/schedule inputs ~38 px | review-round + G2 | PASS | review-round "the Was price input, the certificate controls and the district input" passed; G2 measured the Was input at 44 px or more on both projects |
| R11 | CR run 1 LOW / Amended (an) | dead sessionStorage helpers in `lib/drafts/receipt-draft.ts`; ADR-FE-043 superseded | file holds only the two types; no `sessionStorage` in receiving; decisions.md says superseded | PASS | `lib/drafts/receipt-draft.ts` exports only `ReceiptDraftLine` and `ReceiptDraft` (no functions; "sessionStorage" only in its header comment); no `sessionStorage` in `components/inventory`, the inventory pages, `useInventory.ts` or `inventory-receipts.ts` (only a comment at `GoodsReceiptForm.tsx:63`); `web/docs/decisions.md:1292` ADR-FE-043 "Superseded by ADR-FE-190" |
| R12 | CR run 2 M1 | resumed draft remounted on a sidebar switch | "a resumed draft stays mounted…" + M5 + G4 | PASS | receipt-drafts "a resumed draft stays mounted, with its typed text, when the branch is switched in the sidebar" passed; M5 caught by it; G4 ok on both projects |
| R13 | CR run 2 M2 | autosave dead after refused post/discard | receipt-drafts cases + M1, M2 + G6 | PASS | receipt-drafts "after a refused post …" and "after a refused discard …" passed; M1 and M2 caught; G6 and G7 ok on both projects |
| R14 | CR run 2 LOW | one-branch person, other branch's draft | "keeps the own branch of that draft…" | PASS | receipt-drafts "keeps the own branch of that draft in the save and in the post" passed |
| R15 | CR run 2 LOW | View certificate link 44 px | review-round + G2 | PASS | review-round certificate controls case passed; G2 measured View certificate at 44 px or more on both projects |
| R16 | CR run 3 LOW 1 | Back after a post landed on a duplicate entry | receipt-guard "replaces the address…" + M3 + G8 | PASS | receipt-guard "replaces the address with the receipt (no extra history entry) …" passed; M3 caught by it; G8 ok on both projects (one Back to the form address, a second Back out of the flow) |
| R17 | CR run 3 LOW 2 | draft key had no test of its own | "the draft detail read does not depend on the active branch" + M4 | PASS | receipt-drafts "a branch switch does not refetch it (the server filters by id and owner only)" passed; M4 caught by it |
| R18 | CR run 3 LOW 3 | 3ecad89 no Vitest coverage | receipt-guard file + M20 | PASS | receipt-guard 5/5 passed; M20 and M3 each caught by it |
| R19 | CR run 3 LOW 4 | `addLine` default timeout flaky | `receipt-drafts.test.tsx` passes in T3 and in the mutation runs (no timeout) | PASS | receipt-drafts 24/24 in the full run and in all 9 inventory mutation runs (M1-M5, M10-M12, M18, M20), no timeout; its only failures were the intended ones |
| R20 | SECURITY LOW 1 | bulk bar / uploader shown to every role | review-round role cases | PASS | review-round "the bulk bar and its select boxes are there for ShopManager and Administrator, not for Reception or Inventory" and "the certificate file can be removed or replaced by a manager; a viewer can only open it" passed |
| R21 | SECURITY LOW 2 | mock certificate file: owner and 30-min window not modelled | recorded, not fixed (test fidelity only) | PASS | Recorded, as expected: slice report Round 3 "Recorded, no code" names the owner and 30-minute window gap; mock `staff.ts:612` checks only purpose and not-in-use. Test fidelity only; a carry-forward, not fixed |
| R22 | SECURITY LOW 3 | `arrivingWithinDays` echoed | review-round 1-90 table + M16 | PASS | review-round 1-90 table (7, 90, 1 shown; 0, 91, 999, abc, 7.5 not) passed; M16 caught by 5 of its cases |
| R23 | ARCHITECTURE LOW | citation in `staff-shop.ts` | `StaffProductSummaryViewModel.cs:23-28` cited | PASS | `lib/api/staff-shop.ts:33` cites `Read/ViewModels/StaffProductSummaryViewModel.cs:23-28` |
| R24 | Amended (ak) | file-rules, E-A3 rewrite, `extraField` slot leaves callers unchanged | U32e, E12a, U31e | PASS | U32e (file-rules 15/15), U31e (`schedule-change-dialog.test.tsx` unchanged, 5/5; schedule-extra-field 4/4) and E12a (E-A3 ok on both projects in chunk C, first attempt) |
| R25 | Slice report E11 finding 1 | `useAlertSummary` passed the query context | U34d | PASS | U34d passed |
| R26 | ARCHITECTURE LOW (for TEST) | `mocks/handlers/shop/staff.ts` reads `uploadedFilePurpose` (a module `Map`); the Vitest fake XHR sends no purpose | noted: a component test of a fresh certificate upload must seed the map; recorded, not a defect | PASS | Confirmed: `staff.ts:11,612` reads `uploadedFilePurpose`; `uploadBehavior.ts:30-38` records a purpose only when an upload names one. The slice's tests that need a certificate file pass the purpose explicitly (`mock-refusals.test.ts:224-252`). Not a defect |

## Acceptance-criteria coverage

| Criterion | Covered by | Status |
|---|---|---|
| A10 | U28, U29, E10a, G1 | PASS |
| A11 | U30-U32, E10b, E10c, G2 | PASS |
| A12 | U33, U34, E11a | PASS |
| A13 | U35, U36, E11b-e, G3-G8, G10 | PASS for behaviour; the "Receive into" select's 44 px is measured by G3 but pinned by no slice test (M18) |
| A18 (S3 part) | U46, T6, E11e, E12b, G9 | PASS (E12b's two non-S3 timeouts pass alone) |
| A19 (S3 part) | U47a-j, M7-M12 | PASS (mock owner and 30-minute certificate window not modelled: R21) |
| A20 | ARCHITECTURE gate | BLOCKED here: the ARCHITECTURE gate's check, not rerun |
| A21 (S3 part) | T1-T4, T7, E10-E12 | PASS, with T4's one non-S3 Vitest flake and E11f/E12a/E12b's recorded e2e flakes |

## Cases I could not run

| ID | Why | What would unblock it |
|---|---|---|
| E12c | `inventory-real-api` needs a real API on its own database; none is running | Integration with a scratch API |
| E17 | Not a gate row for a slice (Amended (l)) | E18 at integration |
| A20 | ARCHITECTURE's scope check | The ARCHITECTURE record (run 1 PASS) |

## Gaps left deliberately

| Gap | Why not covered | Suggested owner |
|---|---|---|
| The "Receive into" select's `min-h-11` has no slice test (M18) | A gate test covers it (`test-gate-s3.test.tsx` "carries min-h-11"); adopting it is the integrator's call, as (ag)/(al) did | Integrator |
| Mock certificate file: caller-owns-upload and 30-minute attach window (R21) | Test fidelity only; recorded by SECURITY and the slice | S3 or integration, one U47 case |
| `inventory-flows` E-F1 and E-C1/E-C2, `procurement-flows` E-A1 chromium: 5 s expects across a cold route compile | Not S3 code (E-A1 crosses S3's receiving page); timing on this machine's `next dev` | E18 rerun; a harness or timeout decision is the owner's (Amended (ae)) |
| With the admin branches read refused, "Receive into" shows raw branch ids (G10) | Accepted by ARCHITECTURE; a usability note | ACCEPTANCE |
