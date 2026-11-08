GATE: CODE_REVIEW
HANDOVER: REAL-API-E2E
COMMITS: fd80b8f 06c1a29 b7505cb 4b31482 24952a8 a8dae49 3b86236 (branch fix/real-api-e2e, head 3b86236, vs feat/phase2-catalogue-theme)
DATE: 2026-11-07
STATUS: PASS

FINDINGS
- [MEDIUM] tests/AmarGram.IntegrationTests/Unit/QuestPdfLicenceTests.cs:14-18 — the test sets the process-global QuestPDF.Settings.License to null. xUnit runs test classes in parallel, so a PDF-rendering test in another class can hit the null window and fail with the licence exception (flaky, not wrong). Fix: put it in a non-parallel collection with the rendering tests, or restore the previous value in a finally. It also does not prove that the invoice renderer calls EnsureRegistered(), which was the actual bug.
- [LOW] web/scripts/seed-e2e-real-api.mjs:76-91 — the refusal guard is sound for its purpose. It runs before sign-in or any write. It is fail-closed: a missing endpoint, a network error or no database name all stop the run. The name compare is case-insensitive and also refuses ports 5005 and 3000. Limits: it is a denylist of two names, so any other database, such as a copy of dev data, passes; the endpoint exists only in Development (Program.cs:204), so a non-Development API is refused, which is the safe side; fetch has no timeout. Consider an allowlist (name must match /realapi|journey|scratch|e2e/) and an AbortSignal.timeout.
- [LOW] web/scripts/seed-e2e-real-api.mjs:~107 — standard.id throws a TypeError if the API has no tax classes (standard is undefined). Fail with a clear message instead.
- [LOW] web/scripts/seed-e2e-real-api.mjs:~255-275 — bil-seed.json and rpt-seed.json hold the staff password in plain text and go to the OS temp dir by default. No literal secret is committed. Write the files with mode 0o600 or default --out to a git-ignored path.
- [LOW] web/tests/e2e/journey-real-api.spec.ts:~196, ~323 and web/tests/e2e/real-api-verification.spec.ts:~46 — conditional "if expanded / if dialog present" branches and waitForLoadState('networkidle') tolerate state instead of asserting it. This is acceptable for real-API specs, but a missing policy dialog or a collapsed group is no longer a failure. The cart/checkout assertions still check the real strings, so I do not count this as weakened.
- [LOW] web/tests/components/shop/hydration-session.test.tsx — covers ShopAccountLinks, MobileTabBar and ProductCard, but not ProductPurchase or ProductReviews, which were also changed.

CHECKS WITH NO FINDING
- useHydrated fix is correct and consistent: false on server and first client render. ProductCard already imported the hook. The new test hydrates against a cached session (guest and customer), so it would fail without the fix.
- QuestPdfFonts.EnsureRegistered sets the community licence on every call, before the early return. The report renderer still sets it too (harmless duplicate).
- Mock title "Revenue by sales channel" matches ReportCatalogue.Financial.cs:28. The remaining "business line" strings are the report key, which is unchanged.
- E-D3 label is base-36, which removes the long digit run. Seed fixtures match the inventory spec (FOOD-1 is the barcode 9900000000011 SKU).
- Cat/pet/vet/clinic/PurrCare: no match in added lines. Committed secrets: none. Backend: no .ai/ rule is touched (no controller, handler or DI change).

SCOPE CHECK
- files in allowed scope: 18/18 (e2e specs, seeder, README, mocks aligned to the server title, the hydration fix, the QuestPDF licence fix with its test)
- files outside allowed scope: none
