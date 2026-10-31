GATE: ACCEPTANCE
HANDOVER: HO-P5-WIRING (slice S0)
RUN: 2 (run 1, FAIL, is in git history at 8eda79a)
COMMITS: b32012f 54950d6 99f5c30 a3416f9 238b1f7 00ea533 707433a bb647e4 fabce37 41d5e08 c422d2a 0ae5cc9 818982f 8eda79a 7e863a5 (base cda20c4, HEAD 7e863a5, branch feat/p5-s0-contract)
DATE: 2026-10-31
STATUS: BLOCKED

Everything run 1 failed on now holds. One new question stops the PASS: §16 row E17 is assigned to slice "all", no S0 gate ran it, and the sheet has no row for it. The handover does not say whether "all" binds a slice's own gates, and Amended (i) now turns on exactly that word. This is a document defect and needs an owner decision (D4). No defect in S0's code was found.

WHAT RUN 1 FOUND AND WHAT CHANGED
- D1 (A21 Vitest): closed by a full green run, route (i) of run 1's D1. See Question 1.
- TEST not a plain PASS: the record now reads PASS. See Question 2.
- D2 (four e2e results outside the baseline): closed by Amended (i). See Question 3.
- D3 (§19 screenshots): closed by Amended (j). S1-S4 still owe them.
- Customer-side Packed headline with no owner: closed by Amended (k). No slice owes it on a real screen.
- Correction to run 1: its line "S0's e2e is E1 only" was wrong to state as fact, because it passed over E17. That is how this question reached run 2.

The handover diff since 0ae5cc9 is one line (line 76), and only appends (i)-(k); the earlier text is unchanged. `git diff 0ae5cc9 HEAD --stat -- web` is empty, and `git diff 0ae5cc9 8eda79a --name-only` lists docs files only. So the code under review is the code at 0ae5cc9.

PRIOR GATES (from docs/gates/ and docs/test-cases/, not from commit messages)
- ARCHITECTURE: run 1 FAIL (git, 707433a), run 2 PASS.
- SECURITY: PASS.
- CODE_REVIEW: PASS.
- TEST: the record reads PASS at 7e863a5. It covers everything it ran, but it is silent on E17 (D4), and the status was changed by the integrator, not the test-engineer (Question 2).
- 0ae5cc9 came after ARCHITECTURE, SECURITY and CODE_REVIEW. Run 1's Question 1 found no rerun needed: one static string and one test case. `git diff --stat 41d5e08 0ae5cc9 -- web` still shows only LiveOrderCard.tsx (+1) and order-status-badge-packed.test.tsx. I stand by that finding.

QUESTION 1: Does the Vitest log satisfy A21? Yes.
Checked against the log itself (vitest-s0-w2.txt in the session scratchpad; it is outside the repo and will not outlive the session):
- Summary lines: "Test Files 212 passed | 1 skipped (213)", "Tests 1881 passed | 45 skipped (1926)", duration 334.23 s. These match the claim.
- Progress line 125 of the log, counted by character: 1881 pass marks, 45 skip marks, no failure mark. It agrees with the summary independently.
- No failure, "Unhandled" or error-summary block. The only "failed" text is expected stderr from the load-error tests ("Storefront read failed", which those tests provoke on purpose).
- 213 files equals 213 tracked `*.test.ts(x)` files. 1926 tests equals run 1's total, so nothing dropped out.
- Run started 13:13:54, 7 s after 8eda79a (13:13:47). It wrote the log at 13:19:28, which fits the 334 s duration. Paths are the main checkout, not a worktree.
Why the lower worker count is acceptable:
- A21 says "Vitest ... pass". §17.2 says `npm test`, which is `vitest run`. Neither fixes concurrency, and `npm test -- --maxWorkers=2` is that command with a flag.
- `web/vitest.config.mts` sets no `retry`, so the green is first-attempt. The config and package.json are not in the S0 diff. No assertion was weakened and no `.skip` or `.only` was added.
- The worker flag takes away contention, not checks. The earlier failures were timeouts under load, in files S0 does not touch (`git diff cda20c4 HEAD` on those folders is empty).
Limits, stated plainly:
- The log shows neither the exit code nor the flag. "exit 0" and `--maxWorkers=2` are the integrator's statements. The first is supported by zero failures and no error block; the second does not change the result.
- One green run in three. Default-worker flakiness is real and not explained by a base comparison. It is not S0's defect, but it will recur at S1-S4 and integration (see carry-forwards).

QUESTION 2: Is TEST a genuine plain PASS, and does the sheet add up?
- Count: recounted by parsing the three case tables. 44 rows: 40 PASS, 0 FAIL, 4 BLOCKED, 0 NOT RUN. It adds up and matches the summary and the record.
- Edits: `git diff 8eda79a 7e863a5` touches the T3 row, the summary, the A21 coverage row and the record. T3's new evidence matches the log. U4f, X1, X2 and X3 rows are as the test-engineer wrote them.
- The four BLOCKED rows stay acceptable, and none is counted as a pass:
  - X3: Amended (k) says no slice owes it.
  - E18, E19: §16 assigns them to "integration".
  - E-real: §17.2 says to record "not run" without an environment.
- The status is plain, and the evidence behind T3 is real. Four things stop me calling the record clean:
  - E17 has no row, not even BLOCKED (D4). §19 asks TEST for "§15/§16 cases exist and pass".
  - The record does not say the integrator changed it, and neither does the 7e863a5 commit body. §19 names `test-engineer` for this gate. I accept the change because I checked the log myself, but the record should say who changed it.
  - TEST record line 7 says it was updated "for T3 and A21 only", but line 28 (the Amended (i) reasoning) was also added.
  - X1's expected result is "pass or baseline", yet its evidence shows four non-baseline results that passed only on rerun. Its PASS means "does not block under (i)", not "these specs passed". R6 leans on it the same way. Neither row feeds a §18 criterion for S0.

QUESTION 3: Do the four e2e results stop blocking under Amended (i)? Yes. E1 is clean. E17 is the open point.
- The four: ordering-customer :166, :66, :146 (flaky) and shop-staff :137.
- Not in S0's rows: ordering-customer.spec.ts is S1's E5 and shop-staff.spec.ts is S3's E10 (§16). They are not ordering-customer-orders.spec.ts, which is a separate file in E1.
- Each condition in (i) is met on the record: all four are named in the TEST record, and each passed when rerun alone (X1: 1 worker, no retries, 6/6 and 2/2). The rerun text predates the integrator's edit and is the test-engineer's. I did not rerun them (no browser, as instructed).
- Still owed: the recheck at E18, where "any other failure blocks" applies in full. (i) requires a rerun alone, not run 1's suggested chunk rerun on a fresh server, so the §16 "fresh `next dev`" breach on chunk 2 no longer affects S0.
- E1: 60 passed, 0 failed, both projects, 2 workers, no retries mentioned. 60 matches 30 `test(` calls (2 + 12 + 16, recounted) on two projects. Chunk 1 ran first, on the first server, so the breach does not reach it. The spec files are not in the S0 diff. No raw log survives for this; the evidence is TEST's record.
- E17, not settled by (i). See D4.

QUESTION 4: Criteria that apply to S0
- A1 MET.
  - Tracker: tracker.ts:23. ORDER_STATUSES: my-orders.ts:34. Labels: format/orders.ts:12, :38, :192; labels.ts:26; OrderStatusBadge.tsx:29. All re-read.
  - U1, U2, U4 and the Packed cases: I ran tracker-packed, status-vocabulary, order-status-badge-packed and account-sidebar alone at HEAD: 4 files, 21 tests passed.
  - ADRs: decisions.md:1990-2046, eight headings, regrepped.
  - Split: 16 `it` at cda20c4, 6 + 5 + 5 now, recounted.
  - Seeds and "amounts unchanged": TEST U4f and run 1's diff reading. store.ts diff regrepped; PERSIST_KEY is now `...v2`.
  - E1: as Question 3.
- A18 MET for S0's part. The `rg` back-up returned 0 hits, rerun now. The guards passed within the green run. The a11y rows it names belong to other slices and integration.
- A19 NOT APPLICABLE to S0. S0 changes only two seed files under mocks/ and adds no refusal, so U47 has nothing to cover.
- A20 MET. See SCOPE.
- A21 for S0's part: typecheck, lint and build MET (T1, T2, B1 at 0ae5cc9; web/ identical at HEAD; not rerun). Vitest MET (Question 1). The full-e2e half is integration by its evidence column (E18).
  - OPEN: A21's evidence also cites §17.2, whose per-slice list includes "the slice's run-only specs from §16". Whether that includes E17 is D4.
- A22: the recorded non-goal holds.

AMENDED (a)-(k)
- (a)-(h): checked in run 1; code unchanged. Lines re-read for (a), (f) and (h). (d) still rests on the 54950d6 commit body and ARCHITECTURE; I did not open it.
- (i), (j), (k): applied above. Each is recorded as owner-ratified. I cannot verify ratification beyond the text in §1 and in commit 8eda79a.

OWNER DECISIONS
D1, D2 and D3 from run 1 are closed. One is new.
- D4: does §16 E17 ("all", run-only, must pass) bind S0 at its gates, or only the integration run?
  - Why it binds, on the text:
    - (i) says "only the e2e rows §16 assigns to that slice block", and E17's Slice column reads "all".
    - §16 uses "integration" as a separate value for E18 and E19, so "all" does not obviously mean integration.
    - In §15, the "all" rows U46 and U47 are per slice, and TEST ran U46 at S0.
    - §17.1 step 4 and §17.2 have each slice run "the slice's run-only specs from §16" before its gates.
  - Why it might not:
    - §17.2 says "the slice's" specs, and E17 belongs to no one slice.
    - E18 contains every E17 spec.
    - HO-P3's "all" E16 was explicitly the integration branch.
    - HO-P4's gates ran once for the whole handover, so it is no precedent.
    - (i) was ratified after run 1 wrote "S0's e2e is E1 only". That hints at the intent but does not state it.
  - Is it empty for S0? No. E17 includes staff-shell-*, xct-offline and xct-offline-a11y, which open /staff/orders, the screen where S0's new seed orders now appear. I have no evidence that S0 breaks them, and none that it does not. None of the E17 specs was run.
  - Route A: a §1 Amended row, suggested wording for the owner to accept or change: "E17's 'all' is checked at E18; it does not block a slice's own gates." This also settles it for S1-S4.
  - Route B: run the E17 specs under §16 (chromium + mobile-360, 2 workers, fresh `next dev`, 12 baseline failures excepted, real-API specs recorded as not run), and have TEST add the row. Any other failure would block S0.
  - My recommendation is A, because E18 already covers these specs before anything ships. The cost of A is that a seed-driven break in these specs is found later, at integration, not now. The choice is the owner's.
Either way, ACCEPTANCE then runs again. Under A it should need only this one check. No code change or other gate rerun follows from D4 under A; under B, TEST updates its record.

SCOPE
- out-of-scope work found: none. `orderChannelLabel` is display only (OQ-11). Added lines mentioning subscriptions are that label, its test, a comment and a moved absence assertion. No §20 condition was worked around in the code.
- files outside allowed scope: none. See SCOPE CHECK.

UNDECLARED DEVIATIONS
- Implementation: none found. I was given no §17.3 slice report, so I could not compare against one.
- TEST gate:
  - E17 omitted without being recorded (D4).
  - Integrator authorship of the TEST update is not in the record or commit body (declared to this gate in its brief only).
  - "T3 and A21 only" understates the edit (Question 2).
  - The §16 fresh-server breach on chunk 2 is now disclosed in the record (line 28).

CARRY-FORWARDS (run 1's list, updated)
S0, before it can pass:
- D4 above. S1-S4 cannot branch until S0 merges (§5, §17.1).
- Run 1's D1, D2, D3: closed.
S1:
- MyOrderDetail.tsx: `Packed` at :68, :105, :112, :161, :194 (Amended (b)). Until then a Packed order gets no hero there (:104).
- Bump `PERSIST_KEY` in mocks/handlers/shop/store.ts (Amended (b), §11.1.2).
- Keep `organicCertificateExpiresOn`, `organicCertificateFileId` and `scheduledCompareAtCents` out of the public builder (SECURITY).
- Turn `compareAtCents` into `{ amount, currencyCode }` by string formatting, without arithmetic (CODE_REVIEW LOW).
- Check the rider note renders as text and stays out of URLs and storage (§19 SECURITY, not testable at S0).
- The Packing caption shows when Packing began, not when the order was packed; pinned by tracker-packed.test.ts. Raise it if design wants the packed time.
S2:
- StaffOrderQueue.tsx:49-50 (Amended (b)).
- ordering/staff.ts: `allowedActionsOf` :96-105 returns nothing for Packed; the cancel, dispatch and ready-for-collection handlers at :532, :563, :595 and the pick list at :726, :751 do not accept Packed; `MarkPacked` exists nowhere yet. Under mocks, the seeded Packed order currently has no actions (X2).
- Rider responses must return only `{ id, name, mobileNumber, isActive }`, never `branchId` (SECURITY). Rider mobile numbers stay behind `Orders.Fulfil` and `Riders.Manage`.
- `picked`, `pickedOn` and `pickedBy` stay out of `orderLineView` in customer.ts, which pos.ts also imports (SECURITY).
- `orderChannelLabel` has no caller until S2 uses it. Widen `StaffOrderRow.channel` (§8.2). ADR-FE-188 limits number conversion to bar length.
S3:
- The same staff-only field rule for fixtures' certificate and scheduled-price fields.
S1 and S2 together:
- A further seed goes through §20.1, not a direct edit. status-vocabulary.test.ts has `toHaveLength(13)`, `toHaveLength(1)` for Packed and riderNote, and `toHaveLength(2)` for compareAt, so added seeds will break it. That file is in S0's block; the integrator must route the change.
- Strengthen U4's "amounts kept" case (TEST and CODE_REVIEW suggestion), because its title claims more than it asserts.
- Customer-side Packed on a real screen: settled by Amended (k), no slice owes it.
All later slices (new):
- Full Vitest at the default worker count was red on 2 of 2 runs here, and green at `--maxWorkers=2` on 1 of 1. Each slice should run `npm test -- --maxWorkers=2` and record the flag; run 1's and this run's reading is that it satisfies A21.
Integration:
- E18 full e2e, exactly the 12 baseline failures; E19 `sweep:a11y`; the A21 full set.
- Recheck by name, per Amended (i): ordering-customer :166, :66, :146; shop-staff :137.
- Add the new GETs to tests/contract/mock-vs-real.contract.test.ts and run `test:contract` if a scratch API exists (§12, §17.1).
- Add the ADR row to docs/handover/README.md (§9).
- Real-API specs, not run by anyone so far.
- Decide on hardening for web/public/mockServiceWorker.js (SECURITY LOW, still served).
Small items left open by earlier gates, no owner assigned:
- Dead exports `certificateValidSlug` and `certificateExpiredSlug`; the certificate file id equals a stock alert id (CODE_REVIEW LOW).
- New seed orders carry Sam's `customerMobile` (CODE_REVIEW LOW).
- ADR-FE-186 lacks "Amends"; ADR-FE-190 and -191 say "Supersedes" (ARCHITECTURE LOW).
- Handover wording: §5 still lists OQ answers as open; §14 has no carve-out for docs/gates and docs/test-cases; Amended (d)'s "U15" label (ARCHITECTURE LOW).

NOT CHECKED
- Full Vitest, tsc, lint, build, Playwright: not rerun (instructed). I ran 4 S0 test files alone and the `rg` back-up.
- The log's exit code and worker flag (not in the log). Whether the tree had uncommitted edits during that run (clean now).
- E1 and the rerun results have no surviving raw log; the evidence is the TEST record.
- The TEST seed comparison and the X2 and X3 probes used deleted temporary files.
- Owner ratification beyond its text. Any §17.3 slice report. Screenshots: not taken, exempt under (j).
- The E17 specs: never run on S0 by anyone.

FINDINGS
- [HIGH] docs/handover/HO-P5-WIRING.md:608 — E17 is assigned to "all", and Amended (i) makes "rows §16 assigns to that slice" the test for what blocks. No S0 gate ran it, and the handover does not say whether it binds. See D4.
- [MEDIUM] docs/test-cases/TC-HO-P5-WIRING-S0.md:72 — "S0's per-slice list is E1" is stated with no row or note for E17.
- [MEDIUM] docs/gates/HO-P5-WIRING-S0-TEST.md:7 — the update does not say the integrator made it, and "T3 and A21 only" omits line 28.
- [LOW] docs/test-cases/TC-HO-P5-WIRING-S0.md:68 — X1 is PASS though its expected "pass or baseline" was met only after reruns. Read it as "non-blocking under (i)".
- [LOW] docs/test-cases/TC-HO-P5-WIRING-S0.md:70, :106 and docs/gates/HO-P5-WIRING-S0-TEST.md:38 — X3's unblock still says "S1's seeds". Amended (k) replaced that; §13 and §14 never allowed it.
- [LOW] web/tests/unit/orders/status-vocabulary.test.ts:67 — case title claims "amounts kept" with no amount asserted. Carried from earlier gates.

SCOPE CHECK
- files in allowed scope: 19/19 implementation files in `git diff --name-only cda20c4 HEAD`: §13 S0 block 10 (including the deleted overview.test.tsx and overview-signin), split-created 2 (handover lines 417 and 492), Amended (a) (e) (f) (h) 6, handover 1 (only line 76 differs from base). Plus 6 gate and sheet artifacts, which §14's `docs/**` row does not carve out but the gate definitions require. 25 paths in all. No e2e spec, guard, config, package or lock file in the diff.
- files outside allowed scope: none
- merge target: feat/phase2-catalogue-theme is at cda20c4, the merge base, with 0 commits ahead of it, so S0 would merge without conflict.
- written by this gate: docs/gates/HO-P5-WIRING-S0-ACCEPTANCE.md only. Nothing committed; no dev server or browser started.
