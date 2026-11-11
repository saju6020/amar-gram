# P8 e2e flakes: record (2026-11-11)

Branch `fix/p8-e2e-flakes`, from `feat/phase2-catalogue-theme` 21bba59. Follow-ups listed in
`P7-OWNER-FOLLOWUPS-VERIFICATION.md` (Findings; follow-ups table) and `P7-OWNER-FOLLOWUPS-CODE_REVIEW.md` line 35.

## Root causes and fixes

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| 1 | A very fast click on a freshly loaded storefront page navigates with no top progress bar | `NavigationProgress` attached its capture-phase `click`/`submit` listeners in a `useEffect`. The component sits in a `Suspense` boundary (it calls `useSearchParams`), which hydrates after the page's own links already work, so a click in that gap was never seen | `web/components/common/NavigationProgress.tsx`: the listeners are attached when the module loads (before hydration). A start seen before the component mounts is remembered and the bar shows as soon as it mounts. Hot reload removes the previous module's listeners first. Behaviour after mount is unchanged (same filters, same safety timeout, `startNavigationProgress()` still works). `journey-real-api` step 1: the retry-with-growing-wait loop and `networkidle` are gone; one click right after the app has mounted, and the bar must have appeared |
| 2 | reports-real-api E-C at 360: `Margin` not found, page showed "No results" | A spec defect, not a race in the product. The revenue report's default period is the previous month and a fresh database has no invoices, so the page only ever shows "No results". The text `Margin` then exists only in the loading skeleton (the column headings), so E-C passed when the assertion happened to land on the skeleton and failed when the result came back first. Reproduced at will: with zero invoices E-C passed or failed at random on both projects (chromium failed alone, then passed on re-run) | `reports-real-api.spec.ts` E-C issues one invoice dated today through the API (customer, charge, invoice, issue as the administrator), opens the report with `from=to=today`, and reloads until the result (table at desktop, list at 360, both labelled `Revenue by sales channel · ...`) shows `Margin`. The test no longer depends on data from other specs or on the skeleton |
| 3 | xct-real-api E-C3/E-C4: `never deleted by a run` not found in 5 s after a long run | A spec defect, not compile time alone. The runs list page heading is "Retention runs"; the assertion `getByRole('heading', { name: 'Retention run' })` is a substring match, so it was satisfied by the list page while the detail route was still compiling or loading. The next assertion (default 5 s) then waited for text that only the detail page has. It passes alone because the route was already compiled | `xct-real-api.spec.ts`: heading with `exact: true`, and the text assertion given the same 30 s as the heading |

Also fixed, found while verifying (both were failing on the base commit on a fresh database, so they are independent of the three items):

- `journey-real-api` step 4 opened `/cart` and called `acceptPendingPolicies`. The "Updated policies" dialog is mounted by the portal layout only, so a customer with a policy still to accept (any fresh database) never gets the dialog on `/cart`. Step 4 now accepts on `/portal/orders` and returns to `/cart`.
- `acceptPendingPolicies` (`shop-helpers.ts`) now waits for `__apiBaseUrl` first; straight after a navigation the pending-policies fetch otherwise went to the web server and returned 404.

## Run results

Scratch database `amargram_p8_realapi` (seeded per web/README.md, real API on :5127, `next dev` on :3138, mocks off).

| Run | Result |
|---|---|
| Vitest `issues-4-5-6.test.tsx` (NavigationProgress) | 7 passed |
| Full web Vitest, once | 2725 passed, 12 failed (6 files): inventory goods-receipt and receipt-drafts/guard, POS, a customer-tags test; timing and timeouts under load from the concurrent .NET suite. The failing set changed between runs (12, then 2 of the same files on re-run). The same files also failed on the unchanged base `NavigationProgress` (4 failed there), so unrelated |
| `tsc --noEmit`, eslint on touched files | clean |
| journey + reports + xct real-API, chromium, `--workers=1`, three runs | 28 passed, 2 skipped (offline cases that need a production build), 0 failed, each time |
| same, mobile-360, three runs | 28 passed, 2 skipped, 0 failed, each time |
| reports E-C and xct E-C3/E-C4 specifically | green in all 6 runs (they are in the 28) |

Before the last two fixes the same set failed journey step 4 and reports E-X in every run on a reused database; E-X could not be reproduced afterwards (it passed alone, in the whole file and in the final six runs) and also failed on the base code, so it was left as is. One earlier attempt ran both projects at once with two workers against the same database; the serial files share accounts and a customer, so that run produced sign-in `409` and policy conflicts. Run one project at a time.

No mock e2e spec references the progress bar (`data-testid="navigation-progress"` appears only in the Vitest file and `journey-real-api`), so no mock e2e run was needed for item 1.

Cleanup: next dev and API stopped, ports 3138 and 5127 free; `amargram_p8_realapi` dropped.

## Left

- reports E-X "page scrolls sideways" (2 px on document and body) failed in the first two full runs and in four combined runs, and passed in all later ones. Not reproduced in isolation, not caused by these changes. Worth a look if it returns (the helper reports only totals, not which element overflows).
- The 12 Vitest failures above are load-sensitive timeouts in inventory and POS tests.
