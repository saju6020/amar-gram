# TC-P6-CLEAN-DB — Real-API checks re-run on a clean scratch database

Handover: none — ad hoc re-run of the blocked rows of `docs/test-cases/TC-P6-OWNER-FIXES.md` (B1, B2c, R2) plus the wording fix `c4076be` (Amended (ae)).
Commit(s) under test: `c4076be` on `fix/p6-owner-wording`, worktree `.claude/worktrees/clean-db`
Written: 2026-11-09 (all rows NOT RUN before execution)  ·  Executed: 2026-11-09

> Statuses record what was **observed**. IDs assigned by the tester from the task brief. Record: `docs/gates/P6-CLEAN-DB-VERIFICATION.md`.

## Summary

| | Count |
|---|---|
| Total | 28 |
| PASS | 24 |
| FAIL | 3 (E1 flaky test, E9 and E15 spec not built for 360) |
| BLOCKED | 1 (R2) |
| NOT RUN | 0 |

## Environment

Windows, Postgres 17 on localhost:5432. New databases `amargram_p6clean` (e2e) and `amargram_p6clean_it` (integration), created by this run; nothing dropped, `amargram_dev` untouched. API Release build of this worktree on 5131 (Subscriptions worker interval 900 s by default, restarted once with 20 s for W1), web `next dev` 3136 mocks off, Playwright `--workers=1`. Integration tests were run only after all e2e work. Scratch-DB edits made for fixtures: `product.is_subscribable` set on 5 products (Kalijira Rice, Hand-pounded Red Rice, Miniket Rice, Chira, Stone-ground Atta; only Ajwa Dates was subscribable); 12 subscriptions created for customer@amargram.test via the API; 2 set to Suspended/UnpaidCycles by SQL; one subscription's next_delivery_on set to 2026-11-07; setting `subscription.discountPercent` = 10; discount code WORDFIX10.

## Cases

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| S1 | Create DB `amargram_p6clean`, migrate, seed (seed-dev-db.mjs), API on 5131 | DB seeded, API names it | PASS | "created database amargram_p6clean", migrations applied, "seed-dev: all 16 checks passed"; GET /api/dev/database returned `{"database":"amargram_p6clean"}` |
| S2 | `seed-e2e-real-api.mjs` on the fresh DB | completes, seed files written | PASS | "done", bil-seed.json and rpt-seed.json written (no search-param workaround needed on a clean DB) |
| C1 | `test:contract` with CONTRACT_API_BASE_URL | only shop products skuId/sizeLabel (owner item 13) red | PASS | 71 passed, 1 failed: GET /api/shop/products `$.items[].skuId` and `sizeLabel` missing in mock. Expected failure, observed |
| C2 | contract GET /api/policies/{key} | passes on clean data | PASS | passed (the 404s were test policies) |
| C3 | contract GET /api/staff/billing/cash-ups/{date} lines[].sourceKey | classify | PASS | passed on clean data because `lines[]` is empty ("real array was empty"), so the field is not compared. The suspected mock drift is neither confirmed nor ruled out; it is latent and appears only once a cash-up has lines |
| E1 | real-api-verification (real-api project) | 3 pass | FAIL | register and reset cases pass. "staff sign in and sign out" failed in the full run and again alone; with `--repeat-each=3` run 1 failed (16 s, identifier box empty with "Enter your mobile number or email" while the password was filled), runs 2 and 3 passed (2.2 s). API sign-in by curl returned 200. Fresh browser process, first hit: fill-before-hydration race. Test/environment (cold next dev), not a product defect |
| E2 | portal-real-api chromium | pass | PASS | 2 of 2 in the full run |
| E3 | portal-real-api mobile-360 | pass | PASS | 2 of 2 |
| E4 | xct-real-api chromium | pass (2 offline cases skip by design) | PASS | 8 passed, 2 skipped (:107, :361 by design); E-C3/E-C4 (:228) failed once in the full run (`never deleted by a run` not found in 5 s) and passed alone (3.7 s) and on mobile-360: flake |
| E5 | xct-real-api mobile-360 | pass | PASS | passed, same 2 skipped |
| E6 | reports-real-api chromium | pass | PASS | passed (incl. E-A4 1.1 m, E-X axe) |
| E7 | reports-real-api mobile-360 | pass | PASS | 7 of 7 |
| E8 | billing-real-api chromium | pass | PASS | 14 of 14 |
| E9 | billing-real-api mobile-360 | pass or not supported | FAIL | E-A1 failed: `getByRole('table', {name:'Invoice lines'})` not found; at 360 the page renders a list "Invoice lines" (error-context). The 13 following serial cases did not run. Spec is desktop-only (README runs it in chromium); test defect, not product |
| E10 | inventory-real-api R-A2 and the 10 after it, chromium | all run and pass | PASS | 12 of 12 (R-A1 to R-X3); R-A2 no longer crashes |
| E11 | inventory-real-api mobile-360 | pass | PASS | 12 of 12 |
| E12 | journey-real-api steps 1 to 5d, chromium | pass | PASS | passed |
| E13 | journey 5e | pass | PASS | passed (10.0 s) |
| E14 | journey 5f and two console-error cases | run and pass | PASS | passed |
| E15 | journey-real-api mobile-360 | pass or not supported | FAIL | step 1 failed: `getByRole('group',{name:'Producer'})` not found; at 360 filters sit behind a "Filters (0)" button; 11 later cases did not run. Spec is desktop-only; test defect |
| E16 | subscriptions-customer-real-api both projects | pass | PASS | 2 of 2 chromium, 2 of 2 mobile-360 |
| E17 | subscriptions-staff-real-api both projects | pass | PASS | 5 of 5 chromium (alone), 5 of 5 mobile-360, with fixtures made for this run (SUBS_SEED) |
| W1 | Subscription order, API: no code, line label | `discountCode` null, `lineDiscountLabel` "Subscription discount (10%)" | PASS | GET /api/staff/orders/{ORD-2026-000004}: `discountCode: null`, `totals.lineDiscountLabel: "Subscription discount (10%)"`, lineDiscountTotal 75.00, orderDiscount 0.00 |
| W2 | Same, /staff/orders/{id} screen, 1280 and 360 | no "Discount code" row; bare "Order discount"; "Subscription discount (10%)" row | PASS | page text lines: "Subscription discount (10%)", "Order discount"; no "Discount code" row, no "(Subscription discount)" suffix; no sideways scroll; screenshots `w-subscription-order-1280.png`, `-360.png` |
| W3 | Ordinary order with typed code | "Discount code: WORDFIX10", "Order discount (WORDFIX10)" | PASS | ORD-2026-000003: API `discountCode: "WORDFIX10"`, lineDiscountLabel null; screen shows "Item discounts", "Order discount (WORDFIX10)", Discount code WORDFIX10 at 1280 and 360; screenshots `w-typed-code-order-*.png` |
| R2 | Mixed-label invoice has null totals label | observed or BLOCKED | BLOCKED | needs a second line-discount source on one invoice; subscription orders cannot take a code and normal orders have no line discount |
| I1 | SubscriptionsGenerationEndpointTests on fresh `amargram_p6clean_it` | pass | PASS | 17 of 17 passed (33 s) after the empty DB was migrated with `dotnet ef database update`. First attempt on the unmigrated DB: 17 of 17 failed (`relation "audit.audit_entry" does not exist`), environment: the factory does not migrate |
| X1 | Cleanup | processes stopped, ports free | PASS | API, next dev and wrappers stopped; 5131, 3136, 5099 not listening; no chrome or AmarGram.Api process; pid 19840 untouched |

## Cases I could not run

| ID | Why | What would unblock it |
|---|---|---|
| R2 | no source of a second line discount | a backend integration test |

## Gaps left deliberately

| Gap | Why not covered | Suggested owner |
|---|---|---|
| mobile-360 for billing and journey | specs are desktop-only; not changed (gate) | owner decision |
| contract cash-up `sourceKey` mock drift | invisible on data with no cash-up lines | mocks owner |
