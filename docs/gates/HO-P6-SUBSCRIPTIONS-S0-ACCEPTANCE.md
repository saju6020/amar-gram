GATE: ACCEPTANCE
HANDOVER: HO-P6-SUBSCRIPTIONS (slice S0, shared contract, labels, mock store and seeds)
COMMITS: 21b0ad1 3cbdeb3 6c63e0f 13111cc 1b0b7d8 6864a40 b3e47fd 43ed835 bdb9759 f572ae0 6efc4ef ca1fb2c 5d615c5 46f9a58 230c7d0 0c5fb48 c49d8df (range 86db19d..c49d8df, branch feat/p6-s0-contract; 86db19d is the handover itself)
DATE: 2026-11-07
STATUS: FAIL

Screenshots: not required. S0 is exempt (handover §19 ACCEPTANCE row: contract and seeds, as HO-P5 Amended (j)).

PRIOR GATES (read from docs/gates and docs/test-cases, not from commit messages)
- ARCHITECTURE: PASS (HO-P6-SUBSCRIPTIONS-S0-ARCHITECTURE.md, range 86db19d..13111cc; its MEDIUM and LOWs were taken as Amended (b)/(c))
- SECURITY: PASS (-SECURITY.md, range ..bdb9759, no findings)
- CODE_REVIEW: run 1 FAIL, run 2 PASS (-CODE_REVIEW.md, range ..ca1fb2c; two new LOWs, both closed by seeds.test.ts:239-287)
- TEST: run 1 FAIL, run 2 PASS (-TEST.md at 0c5fb48 + hardening.test.ts; sheet TC-HO-P6-SUBSCRIPTIONS-S0.md, 0 NOT RUN, 0 BLOCKED)
- All four records exist. The TEST record does not use the docs/gates/README.md header (no GATE/HANDOVER/COMMITS/STATUS lines); its verdicts are still unambiguous.

CRITERIA (§18 rows that bind S0: A1, A2, and the "all" rows A17-A20 as far as S0 reaches)
- A1 MET. Contract and mock parity.
  U1 tests/unit/subscriptions/api-clients.test.ts: method, path, query and body per C1-C12 and T1-T9. :83 C6 omits firstDeliveryOn when it isn't given, :154 C10 always sends an object body, :164 C11 always sends reason, plus the csv path with no paging.
  U2 labels.test.ts: :74 the six IsCustomerChoice reasons in server order; :84 failure and payment texts read from SubscriptionMessages.cs; :123 "Unknown" for unknown values.
  U3 dates.test.ts :15-53, with hardening.test.ts H1 switching the zone inside the test and asserting the offset.
  U4 schedule-parity.test.ts:85-102: a table of nine states. It covers every state §15 names, plus the clock edges at :69, each change function, the refusals at :147 and processCycle at :299.
  U5 seeds.test.ts: :35-139 cover the inventory, T3 >= 1, the subscribable products, the Generated-cycle orders and the 11 original orders. :239 every id is a GUID.
  U7 errors.test.ts: :79 no errorCode in any output; the { error } 400 maps without a throw.
  I re-ran these myself: `npx vitest run tests/unit/subscriptions tests/unit/orders/status-vocabulary.test.ts tests/guards/no-card-ui.test.ts tests/components/back-office-sales/mock-refusals.test.ts tests/components/back-office-sales/test-gate-s2.test.tsx tests/components/catalogue/catalogue-p5.test.tsx --maxWorkers=2` → 13 files, 201 tests passed at c49d8df.
  The ARCHITECTURE record also hand-checked every field, enum and role against src/.
- A2 MET.
  U6 source-guard.test.ts:146 scans the subscription code; :153 asserts the S0 files are in the scan; :165 "fails on a planted violation".
  U3 as above.
  tests/guards/no-card-ui.test.ts passed in my run and in the TEST gate's full run.
  lib/subscriptions/dates.ts formats only; per the ARCHITECTURE and CODE_REVIEW records, date arithmetic exists only in mocks/**, which ADR-FE-193 allows.
- A17 MET as far as S0 reaches. S0 adds no screen or dialog. The colour-literal Vitest guards are part of the full run (TEST sheet X1: 248 files, 2398 tests passed at 46f9a58; only e2e specs, a helper, docs and hardening.test.ts changed after that).
- A18 MET IN SUBSTANCE, NOT EVIDENCED AS SPECIFIED. The three handler arrays are empty stubs (customer.ts, staff.ts, touchpoints.ts), so S0 adds no refusal. A18's evidence column also names the "§17.3 reports", and S0 has none (finding 3).
- A19 NOT MET. Three Vitest files outside S0's §13 block were edited without an Amended row (finding 1). Separately, the handover's §16 E1 row was edited in place (finding 2).
- A20 MET for the per-slice part. tsc exit 0, lint exit 0 and full Vitest at --maxWorkers=2 (TEST X1-X3, rechecked in run 2). Build, full e2e and the contract test are integration steps (§17.2, E16/E18).
- A21 not applicable to S0. No BG-S item was built.

FINDINGS
- [HIGH] web/tests/components/back-office-sales/mock-refusals.test.ts:205, web/tests/components/back-office-sales/test-gate-s2.test.tsx:44-48, web/tests/components/catalogue/catalogue-p5.test.tsx:203-213 — edited without authorisation. These are run-only test files: they are not in S0's §13 block, and §13 says "Test files not listed are run-only". No Amended row authorises the edits. (b)(2) authorises the shop key bump, not the test. (e) covers only the two e2e specs and ordering-helpers.ts. That is a §20.1/§20.3 condition worked around instead of raised. The edits are disclosed only in commit messages (b3e47fd, ca1fb2c). The SECURITY and CODE_REVIEW records counted them "in scope" without citing any authority.
  - mock-refusals and test-gate-s2: `total: 0` became an equality with subscriptionOrderSeeds().length. The new assertion is equal in strength and justified by the §11.1.5 seeds.
  - catalogue-p5: the "ignores a stale copy in sessionStorage" assertion was removed, and only a v3 write pin remains. That is a weakening, even though CODE_REVIEW run 1 asked for it because the planted key had become vacuous. hardening.test.ts H3 pins the key literal, which partly covers the loss.
  - Remedy: the integrator appends an Amended (f) row ("integrator decision, under the owner's 2026-10-31 delegation") that names the three files and lists each old → new pair. The row should either accept the catalogue-p5 reduction with H3 as its replacement, or restore a real stale-copy check (plant a payload under `__amargram_shop_mock_db__v2` and assert it is ignored).
- [MEDIUM] docs/handover/HO-P6-SUBSCRIPTIONS.md:586 (§16 E1) — edited in place. The row's Expected text "Pass. The seeds change nothing visible until S1–S3 build the screens" was replaced in 0c5fb48. This breaks the rule. §13 gives the integrator "§1 Amended rows only, append-only" on this file, and every Amended row says "never edit in place".
  - Why it matters: the original wording is the criterion the TEST gate ran against in run 1 and failed. Rewriting it after that failure makes the run-1 record and the TC sheet (whose AC-coverage row still quotes the old wording) disagree with the handover. The rule exists to prevent exactly that.
  - Mitigation: Amended (e) declares the change, and git keeps the original, so this is a declared deviation, not a hidden one.
  - Remedy: restore row E1's Expected cell verbatim to "Pass. The seeds change nothing visible until S1–S3 build the screens". In the same Amended (f), record that (e)'s last sentence ("The E1 row's … is corrected to match") is withdrawn, and that E1 is read together with (e). Do not edit (e) itself.
- [MEDIUM] docs/gates/HO-P6-SUBSCRIPTIONS-S0-SLICE-REPORT.md — missing. §17.3 requires it before the TEST gate: files touched, superseded assertions old → new, OQ defaults built to, Vitest totals. §10.3 also requires S0 to list the fallback sentences it wrote for SUBSCRIPTION_CODE_MESSAGES "in its report". A18 cites these reports as evidence. Every HO-P5 slice has one. Remedy: write it. Its old → new list is where the three files in the HIGH finding belong.
- [LOW] docs/test-cases/TC-HO-P6-SUBSCRIPTIONS-S0.md — the sheet is internally inconsistent. Its header still says "Commit(s) under test: 46f9a58". The Summary says 32 rows, but there are 29 run-1 rows plus 5 run-2 rows. The "Acceptance-criteria coverage" row for E1 still reads "FAIL for X5", and only the appended Run 2 section shows PASS. Remedy: the next TEST touch updates the header and the summary, and appends (does not rewrite) a run-2 note against the coverage row.
- [LOW] docs/gates/HO-P6-SUBSCRIPTIONS-S0-TEST.md — the record does not follow the docs/gates/README.md header format.

SCOPE
- Out-of-scope work (§4) found: none. No hook, component, route, nav entry or handler was built. The three handler files are one-line stubs, and nothing S1-S3 owns was touched.
- Files outside S0's §13 block, authorised by Amended rows:
  - web/mocks/handlers/areas/accounts.ts: (b)(1), (c), (d)(1)
  - web/mocks/handlers/shop/store.ts: (b)(2)
  - web/tests/e2e/account-area.spec.ts, web/tests/e2e/ordering-customer.spec.ts, web/tests/e2e/ordering-helpers.ts: (e). The TEST run-2 audit found no assertion removed or loosened.
  - docs/handover/HO-P6-SUBSCRIPTIONS.md: §1 rows (b)-(e) are allowed for the integrator (§13 integration block).
- Files outside S0's §13 block with no authority: web/tests/components/back-office-sales/mock-refusals.test.ts, web/tests/components/back-office-sales/test-gate-s2.test.tsx, web/tests/components/catalogue/catalogue-p5.test.tsx. The §16 edit in docs/handover/HO-P6-SUBSCRIPTIONS.md is also beyond what §13 allows on that file.
- No src/, .NET tests, config, package or lock change (git diff --stat c176fd8..c49d8df: 40 files, all web/** or docs/**).

AMENDED ROWS AND OMISSIONS
- Wording:
  - (b), (c), (d) and (e) each say "integrator decision, under the owner's 2026-10-31 delegation".
  - (a) says "as an integrator decision under the owner's 2026-10-31 delegation". Same meaning, different word order. Acceptable.
- Every integrator decision visible in the diff has a row, except the three Vitest edits (HIGH) and the E1 in-place edit (MEDIUM).
- Omissions are exactly the BG-S rows and the OQ defaults:
  - S0 built every §11.1 item: 11.1.1-11.1.7, control.ts with reset/lock/unlock/suspend/setDiscount, seedDates(), subscriptionFixtureIds, and the ADRs at web/docs/decisions.md:2056-2140, first commit 21b0ad1.
  - OQ-17 is built to its default: DISCOUNT_SEED "10.00" at mocks/handlers/subscriptions/store.ts:68.
  - OQ-5 is built to its default: the six reasons, U2.
  - No BG-S item is built.
  - Nothing was silently dropped.

FOR THE OWNER (not S0 work; listed so they are not lost)
- OQ-20: docs/USER_STORIES.md §11 and the SRS still say "cat owner", "food or litter" and "veterinarian" (US-SUB-05, FR-SUB-6). A backlog and SRS wording update is proposed. Amended (a) routes it to the owner; it is not edited here. The owner's no-cat-legacy direction applies.
- docs/handover/README.md ADR table (§9): after the merge, the integrator changes the "ADR-FE-109 … ADR-FE-118 | HO-SUB-002 (109–114 used)" row (README.md:110) to "109–114 recorded by HO-P6". It also adds a row "ADR-FE-193 … ADR-FE-202 | HO-P6-SUBSCRIPTIONS (193–197 used)" and moves the next-free note at README.md:124 past ADR-FE-197. Not done yet, which is correct: §14 forbids slices from doing it.
- Backend follow-ups, proposed and not decided (handover "Backend gaps"):
  - BG-S1: isSubscribable on the public product read
  - BG-S2: a Subscriber filter on staff customers browse
  - BG-S3: a pickup-branch list or flag on /api/branches
  - BG-S4: an estimate before creation
  - BG-S5: the reinstater's name
  - BG-S6: the staff restart-date range
  - BG-S7: multi-item subscriptions
  - BG-S8: a product slug on the subscription product view
  - BG-S9: the unpaid threshold on the customer view

UNDECLARED DEVIATIONS
- The three Vitest edits (HIGH): disclosed in commit messages, absent from the handover and from any slice report.
- The missing slice report (MEDIUM).
- The E1 in-place edit is declared (Amended (e), last sentence), so it is not counted here.

TO REACH PASS (doc-only; no code or test re-run needed, unless catalogue-p5 is changed back to a real stale-copy check, in which case run that one file)
1. Append Amended (f), covering the three Vitest files and withdrawing (e)'s last sentence.
2. Restore the E1 row verbatim.
3. Write HO-P6-SUBSCRIPTIONS-S0-SLICE-REPORT.md per §17.3 and §10.3.
4. Re-run ACCEPTANCE.

SCOPE CHECK
- files in allowed scope: 37/40, counting the Amended-authorised files as in scope
- files outside allowed scope: web/tests/components/back-office-sales/mock-refusals.test.ts, web/tests/components/back-office-sales/test-gate-s2.test.tsx, web/tests/components/catalogue/catalogue-p5.test.tsx; plus the §16 in-place edit within docs/handover/HO-P6-SUBSCRIPTIONS.md
