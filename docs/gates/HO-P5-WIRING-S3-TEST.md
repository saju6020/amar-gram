GATE: TEST
HANDOVER: HO-P5-WIRING (slice S3, catalogue and stock; BG-9, 10, 12, 13, 14, 16, 17, 18)
RUN: 1
COMMITS: feat/p5-s3-catalogue-stock at 1cc4abd (S3 range `git diff 542e7e0 HEAD`; CODE_REVIEW run 3 PASS at 8abd5f5, its four LOWs fixed in 1cc4abd)
DATE: 2026-11-03 to 2026-11-04
STATUS: PASS (integrator update, 2026-11-04, under Amended (ao)). Run 1's verdict was FAIL; that record is commit bb6ecae.

INTEGRATOR UPDATE (2026-11-04, under the owner's 2026-10-31 delegation; not the gate's own words)
- Amended (ao) adopts the gate's two files into S3 unchanged, so the slice's suite now holds M18's `min-h-11` case, G10 and G1-G9. M18 and R1 are covered, which by the gate's own reading makes the sheet 128 PASS, 0 FAIL, 1 BLOCKED (E12c, no real API running; carried to E18).
- Rechecked at the same product commit (1cc4abd): tsc exit 0; ESLint on the two files exit 0; `vitest run` of the gate Vitest file: 2 passed. The gate e2e spec passed 18/18 on both projects in run 1 and was not rerun.

The slice's code passes every row it owns:
- typecheck, lint, the full Vitest suite (one non-S3 timing flake that passes alone, Amended (i)), the build and the served-output check;
- every U-row (U28-U36, U46, U47a-j);
- E10, E11 and E12a/b on both projects, with every S3 case passing first time and the non-S3 flakes recorded below;
- the integrator's gate rows G1-G10, measured in a browser on both projects.

The gate fails on one mutation row and the regression row that rests on it. "Receive into", the select CODE_REVIEW run 1 M1 raised to 44 px, has no slice test: with its `min-h-11` removed, all 111 slice tests in the inventory folders still pass. The gate's own Vitest case fails under that mutation and passes on clean code, and G3 measured the select at 44 px or more in the browser. This is the same shape as S2 and S4 run 1, which Amended (ag) and (al) resolved by adopting the gate files.

SHEET: docs/test-cases/TC-HO-P5-WIRING-S3.md. 129 rows: 126 PASS, 2 FAIL, 1 BLOCKED, 0 NOT RUN. E17 is outside the counts under Amended (l).

EXPECTATIONS STATED BEFORE RUNNING (sheet, "What counts as a pass")
- Only S3's §16 rows (E10, E11, E12) and S3's U-rows block. A failure elsewhere that passes when rerun alone is an (i) note for E18.
- The first attempt counts. A failure that passes only on a warmed rerun is written down with both runs.
- A mutation that no slice test catches is a FAIL row (a test gap), even when a gate test catches it.
- E17 is not run as a gate row (Amended (l)).

FAILS (a test gap, not a product defect)
- M18, and R1 (CODE_REVIEW run 1 M1). I removed `className="min-h-11"` from the "Receive into" `SelectField` in `GoodsReceiptForm.tsx`. The slice's inventory and back-office-stock tests passed (111 of 111). Only the gate's `tests/components/inventory/test-gate-s3.test.tsx` "carries min-h-11" failed. The other run-1 M1 controls are each pinned by review-round or receipt-drafts.

BLOCKED
- E12c `inventory-real-api`: no API is running. Unblock: integration with a scratch API.
- A20 in the acceptance table: this is the ARCHITECTURE gate's check, and I did not rerun it.

RESULTS
- T1 `npm run typecheck`: exit 0. T2 `npm run lint`: exit 0. Both include the gate files.
- T4 `npx vitest run --maxWorkers=2` (742.5 s):
  - Files: 240 passed, 1 failed, 1 skipped (242). Tests: 2277 passed, 1 failed, 45 skipped (2323). Exit 1.
  - The one failure is `inventory/shared-pieces.test.tsx` U-A3, the ScanField burst timing case. S3 did not touch the file (last changed 380e387, 2026-10-24). It is the known load-sensitive case (HO-P3 TEST, HO-RPT-002 TEST, S0 TEST, S3 slice report Round 3), and it passed alone 17 of 17 three times.
  - PASS under Amended (i) only. The raw exit code is recorded.
  - Note: I had written the expectation as a flaky file "outside S3's folders". This file sits in an S3 folder, but S3 did not touch it.
- T3, S3's files in that run, all green: products-p5 17/17, staff-shop mock-refusals 19/19, review-round 14/14, schedule-extra-field 4/4, products-design 9/9, products-sections 2/2, two-step-save 5/5, admin schedule-change-dialog 5/5, stock-p5 7/7, stock-by-item 4/4, receiving-layout 3/3, goods-receipt-form 7/7, receipt-drafts 24/24, receipt-draft-autosave 11/11, receipt-guard 5/5, inventory mock-refusals 14/14, unit/files file-rules 15/15, guards no-money-arithmetic 2/2, no-hex-literals 213/213, no-colour-literals 2/2, gate test-gate-s3 2/2.
- T5, money: no `Number(`, `parseFloat(`, `parseInt(`, `Math.`, `toFixed` or unary `+` in the added lines of S3's 33 non-mock, non-test files. A positive control was found. `compareAtAmount` goes through `wireMoney`.
- T6 / U46 back-up `rg` for colour literals: 0 matches in S3's 20 changed component and app files and in all of `components app`.
- T7 `rm -rf .next && npx next build`: compiled in 86 s, 123/123 static pages, exit 0.
- T8 served output: 0 files in `.next` (excluding `cache`) for each of 7 S3 mock terms: the other member's draft seed, its id, the v2 persist key, the upload-purpose seam, the mock upload message, `mockServiceWorker` and `setupWorker`. The positive controls found 6 S3 UI strings.
- Mutations: 21 rows (M1-M21), 20 PASS and 1 FAIL (M18).
  - Each mutation was one product line, run against the slice's folders plus the gate file, then restored with `git checkout --`. `git status` showed only the gate files after every row.
  - M21 was added after the full run showed that no test names the uploader's `purpose`. It is caught: products-p5's View/Remove case fails, because the mock refuses a non-certificate file.
  - M2 also failed receipt-guard "stays on while the post is in flight" once. That case passed in every other run, so I read it as timing, not as M2's doing.

E2E (MSW; fresh `next dev` on :3123 per chunk; routes warmed; `--retries=0`; chromium and mobile-360)
- E10, `shop-staff` (chunk A, w1): 18 passed, 0 failed (3.5 min), first attempt. All three E10 cases passed on both projects.
- E11, `inventory-flows`. All 10 S3 cases (5 per project) passed on both projects in both full runs.
  - Run B (w1): 29/32. E-F1 :204 failed on chromium (5 s for the recall console after `router.push`). E-C1 and E-C2 failed on mobile-360 after `next dev` logged "approaching the used memory threshold, restarting" (connection refused, then a cold goto). Under §20.8 a resource crash is not a test result, so I reran the chunk.
  - B2 and B3 (the three cases alone): mostly 30 s timeouts on a slow server (dev requests took 10-24 s), with another memory restart in B2.
  - A temporary probe spec (deleted) showed the stock detail and transfer pages working at both widths.
  - Run B4 (the full chunk again, 8 GB heap, no restart): **31/32**. E-C1 and E-C2 passed on both projects. E-F1 failed on mobile-360 the same 5 s way.
  - B5 (E-F1 alone): mobile-360 passed. Chromium timed out on its sign-in goto.
  - E-F1 has now passed on each project (chromium in B4; mobile-360 in B, B2 and B5). It is HO-IMP-002's recall case, and S3 changed none of its files.
- E12a, `procurement-flows` (chunk C, w1): 9/10.
  - E-A2, E-A3, E-B1 and E-B2 passed on both projects, first attempt. E-A3 is no longer a baseline failure (Amended (ak)).
  - E-A1 :22 failed on chromium as the first test of the run (`GRN-` heading not seen within 5 s). It failed again alone in C2, at the "Receive goods" navigation. It passed 3 of 3 alone on a server kept warm (C3). Each failure was a 5 s expect across a client navigation to a route compiled on demand. The slice report (Round 2) saw the same first-run failure.
  - E-A1 does cross S3's receiving page. Integration should watch it at E18.
- E12b, `inventory-a11y-responsive` (chunk E, w2): 458 passed, 2 failed (19.0 min).
  - Every route S3 changed passed axe and all four widths on both projects.
  - The 2 failures were `/staff/inventory/storage-breaches/b1000000-…0001` at 1024 and 1440 on chromium, each a 30 s `networkidle` timeout. S3 did not touch that route. Rerun alone: 8 passed (both projects, all four widths).
- Gate spec `catalogue-stock-gate-s3.spec.ts` (chunk D, w1): 18 passed, 0 failed (1.7 min), first attempt.
  - G1-G3: every S3 control measured at 44 px or more.
  - G4: a resumed draft keeps the same element and its text, and saves for its own branch, across a sidebar switch.
  - G5: a fresh draft keeps the form's branch.
  - G6: an edit after a refused post is autosaved and survives a reload.
  - G7: an edit after a refused discard is autosaved and survives a reload. The DELETE was answered with a 503 by `window.fetch`, so this ran in a browser.
  - G8: the first Back from the receipt lands on `receipts/new?draft=…` showing "That draft is no longer here". This is the residual the slice report names. The second Back leaves the flow.
  - G9: no sideways scroll on the eight S3 views.
- G10 (Vitest): with `GET /api/admin/branches` refused (403), the receiving page still draws "Receive into". Each option falls back to its branch id. A control run without the refusal shows the names.
- After every chunk, the dev server, the Playwright tree and the headless browsers were killed and :3123 checked free.

REGRESSION ROWS
- 26 rows, one for each finding from ARCHITECTURE, SECURITY and CODE_REVIEW runs 1-3, for (ak)/(an), and for the slice's own E11 find: 25 PASS, 1 FAIL (R1, above).
- R11: `lib/drafts/receipt-draft.ts` holds only its two types, and ADR-FE-043 reads "Superseded by ADR-FE-190".
- R19 (`addLine` timeout): receipt-drafts was green in the full run and in all 9 inventory mutation runs.
- R21 (the mock's certificate owner and 30-minute window) is recorded, not fixed. It affects test fidelity only.

ACCEPTANCE COVERAGE (S3 part)
- A10-A12: PASS.
- A13: PASS for behaviour, with M18's gap.
- A18: PASS.
- A19: PASS, with R21 noted.
- A21: PASS, with the recorded flakes.
- A20: BLOCKED (ARCHITECTURE's check).

PRODUCTION DEFECTS
- None found in S3's code.

WEAK TESTS NOTED
- The "Receive into" 44 px class is unpinned (M18).
- No component test names the certificate uploader's `purpose` directly. M21 is caught only through the mock's purpose check.
- E-F1, E-C1/E-C2 and E-A1 use 5 s expects across a client navigation to a route `next dev` may have dropped. They are pre-existing specs, and on this machine they fail when the dev server is slow or restarts.

GATE FILES (committed with this record; suggested for adoption as (ag)/(al) did)
- web/tests/components/inventory/test-gate-s3.test.tsx: M18 and G10; 2 tests. I rewrote the earlier draft's header, which claimed a 36 px measurement nobody had observed.
- web/tests/e2e/catalogue-stock-gate-s3.spec.ts: G1-G9; 9 tests per project.
- docs/test-cases/TC-HO-P5-WIRING-S3.md and this record.

CARRY-FORWARDS
For ACCEPTANCE:
- Adopt the two gate files, or add a slice test for the select's `min-h-11`. Either closes M18 and R1.
- Screenshots at 360 and 1280 are owed (§19).
- G8: Back from a posted receipt shows "That draft is no longer here". This is the known residual.
- G10: with the admin branches read refused, "Receive into" shows raw ids.
For E18:
- Recheck the recorded flakes: `inventory-flows` E-F1 (both projects) and E-C1/E-C2 (mobile-360, next to a memory restart); `procurement-flows` E-A1 (chromium); `inventory-a11y-responsive` storage-breaches detail at 1024/1440; Vitest `shared-pieces` U-A3.
- `next dev` restarted itself for memory at the default heap during `inventory-flows`, whose `beforeAll` warms all 47 inventory routes. 8 GB of heap avoided it.
- E12c and the contract test (`mock-vs-real`) are not run for S3's new mock routes.
- E17 and E19 belong to integration.

SCOPE AND CLEANUP
- I edited no product code and no existing spec. Every mutation was reverted, and the temporary probe spec was deleted.
- Nothing listens on :3123 and no `chrome-headless-shell` is running. The keep-awake helper is stopped.
- `web/.next` holds the last dev build (gitignored). `web/test-results` was removed.
