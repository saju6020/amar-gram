GATE: ACCEPTANCE
HANDOVER: HO-P5-WIRING (slice S0)
RUN: 3 (run 1, FAIL, is in git history at 8eda79a; run 2, BLOCKED, at fec23e6)
COMMITS: b32012f 54950d6 99f5c30 a3416f9 238b1f7 00ea533 707433a bb647e4 fabce37 41d5e08 c422d2a 0ae5cc9 818982f 8eda79a 7e863a5 fec23e6 (base cda20c4, HEAD fec23e6, branch feat/p5-s0-contract)
DATE: 2026-10-31
STATUS: PASS

Amended (l) settles the one question that blocked run 2. Every §18 row that applies to S0 has evidence. A search of every "all" and non-slice row in §15, §16 and §18 found no other case like E17 that needs an owner decision. It found one record gap (U47 has no sheet row), which is LOW and does not block. This PASS covers S0's gates only. E17, E18, E19 and the four e2e results named below are still owed at integration, and no gate has shown them to be good.

HOW S0 GOT HERE
- Run 1 (FAIL):
  - A21 Vitest was not green.
  - TEST was not a plain PASS.
  - It raised D1 (Vitest), D2 (four e2e results outside the baseline), D3 (screenshots) and an unowned customer-side Packed headline.
  - It also wrote "S0's e2e is E1 only", passing over E17.
- Between runs 1 and 2: Amended (i), (j), (k), and a full Vitest run, green at `--maxWorkers=2`.
- Run 2 (BLOCKED): A21 and the other applicable rows held. It stopped only on D4: does §16 E17 ("all") bind a slice's own gates?
- Between runs 2 and 3:
  - Amended (l).
  - Integrator edits to the TEST record and the sheet.
  - `git diff 7e863a5 HEAD --stat`: 4 files, all under docs/ (this report, the TEST record, the handover, the sheet).
  - `git diff 0ae5cc9 HEAD --stat -- web/` is empty, and `HEAD:web` and `0ae5cc9:web` are the same tree (1eb2afce). The code under review is the code run 2 reviewed.

PRIOR GATES (from docs/gates/ and docs/test-cases/, not from commit messages)
- ARCHITECTURE: PASS (run 2). SECURITY: PASS. CODE_REVIEW: PASS.
- TEST: PASS, with the sheet present. The status and the T3 result were changed by the integrator, not `test-engineer`; the record now says so at line 7. I accept the change because T3 was checked against the raw log (run 2, summary lines re-read in this run).
- 0ae5cc9 came after ARCHITECTURE, SECURITY and CODE_REVIEW. Run 1 found no rerun was needed (one static string and one test case). Unchanged.

QUESTION 1: Does (l) settle D4 without conflict, and does A21's §17.2 evidence still require E17 at slice level?
It settles D4, and A21 no longer requires E17 at slice level.
- Text of (l), handover line 76: "§16 E17's 'all' is checked at E18 and does not block a slice's own gates, for S0 … S4. No slice runs E17 as a gate row, so a break in those specs from a slice's change surfaces at integration." Owner-ratified per its own heading. It names the row and the scope, and it states the cost.
- Handover diff: `git diff 7e863a5 HEAD` on the handover changes line 76 only, and only appends (l). The earlier text is unchanged, as §14 requires.
- Checked against the other wording:
  - §16 E17, Slice "all": (l) defines that word for this row. The row stays run-only and "Pass", now enforced at E18. No conflict.
  - (i) "only the e2e rows §16 assigns to that slice block": this now reads cleanly. (l) says E17 is not such a row for any slice.
  - §17.1 step 4 and §17.2 "the slice's run-only specs from §16": (l)'s "No slice runs E17 as a gate row" takes E17 out of "the slice's". For S0 that list is E1. S0 has no "may change" row.
  - §19 TEST "§15/§16 cases exist and pass": this is per slice, so it is limited by (i) and (l) the same way as §17.2.
  - §18 A21 "§17.2, E18": the per-slice half no longer includes E17. The full-e2e half is E18, whose §16 Slice is "integration".
  - §1 "Any other failure ... blocks": (i) already scopes this to E18.
  - The handover has no general sentence saying Amended rows override other sections. (a)-(k) already work that way, and §5 and the open-questions preamble route changed answers to §1 Amended. No conflict comes from this.
- Does "checked at E18" actually reach those specs? I compared the 55 files in web/tests/e2e with the four §17.2 integration globs.
  - Every spec named in E17 is matched: `staff-*`, `reports-*`, `notifications-*`, `xct-*`.
  - The only two files no glob matches are journey-real-api and real-api-verification. §17.2 handles those separately ("not run" without an environment).
  - So nothing falls between (l) and E18.

QUESTION 2: Are the edited records accurate, with no claim beyond the evidence?
Yes for the edits. Sheet and record findings below are LOW.
- Count: I parsed the three case tables again. 44 rows, 44 unique ids: 40 PASS (unit 23, integration 9, regression 8), 0 FAIL, 4 BLOCKED (X3, E18, E19, E-real), 0 NOT RUN. This matches the Summary and TEST line 7. E17 is not a counted row; it is only in "Cases I could not run".
- The edits at fec23e6:
  - TEST line 7, who edited: checked against `git diff 818982f 7e863a5` and `git diff 7e863a5 fec23e6`. It names the status, the Vitest result, T3, A21, the Amended (i) note, then X3 and E17. That is substantially complete. It omits only the COMMITS-line addition, the summary counts and one reworded Vitest line, all of which follow from the items it names. This closes run 2's two MEDIUM points.
  - X3: now says nothing is owed under (k), stays BLOCKED, and is not counted as a pass. The probe evidence is unchanged. This matches (k). It closes run 2's LOW.
  - E17, TEST line 39 and sheet line 107: "not run on S0". That is true: none of the E17 specs is in chunks 1-3. It matches (l).
  - Sheet line 72, "S0's per-slice list is E1": was a gap at run 2, now correct under (l).
- X1 PASS: this does not need correcting.
  - It means "non-blocking under (i)", not "these specs passed first time". Literally, X1's expected "pass or baseline" was met only after reruns.
  - Its evidence column states every failure, flaky result and rerun in full, so nobody is misled. It feeds no §18 row.
  - Rewriting Expected after execution would be worse than this note. R6 leans on it the same way.
  - This reading is now the record. Later slices' sheets should write that expectation up front (carry-forwards).
- Still beyond or short of the evidence, none feeding a §18 row for S0:
  - R6 and TEST line 35 answer "move no existing spec" / "no", but the evidence is 13 spec files. E17 was never run, so the honest scope is "none of the 13 run". TEST line 35 does carry that qualifier, and sheet line 117 discloses the gap.
  - Sheet line 117 says "16 spec files run". The sheet, the record and R6 all show 13 (3 + 5 + 5).
  - "exit 0" and the worker flag in T3 are the integrator's statements; the log shows neither (as run 2 said). Line 7 now attributes the Vitest result to the integrator.
  - X1's "all environmental" is a classification. What was observed is "passes alone", which is all (i) requires.
  - The sheet itself is silent on who edited it, still lists "Amended (a)-(h)" at line 3 and HEAD 0ae5cc9. TEST line 7 carries the disclosure for both documents.

QUESTION 3: Is any other "all" or unclear slice value in §15, §16 or §18 unaddressed for S0?
I enumerated every row in those tables whose Slice is not a single S1-S4 value. These are all of them.
- §15 U1-U4 (S0): sheet rows exist. Evidence: spot-run below.
- §15 U46 (all): sheet row exists, spot-run below.
- §15 U47 (all): NO sheet row and no note. This is the same shape as E17's omission.
  - It is empty for S0 by its own wording: "one case per new mocked refusal (§11.x Mocks rows)". §11.1 has no Mocks row.
  - `git diff cda20c4 HEAD -- web/mocks/` touches only store.ts and fixtures.ts. Its added lines contain no `http.`, `HttpResponse`, `status: 4xx`, `throw` or error code; the only new function is `seedRiders`.
  - Zero refusals means zero cases, so nothing is owed and no decision is needed. It is a record gap only (LOW). S1-S4 will have real refusals and must have the row.
- §16 E1 (S0): sheet rows exist.
- §16 E17 (all): closed by (l).
- §16 E18, E19 (integration): clear; BLOCKED rows are on the sheet.
- §18 A1 (S0): see CRITERIA.
- §18 A18 (all): "every a11y spec passes". Evidence is U46, E6 (S1), E12 (S3), E16 (S4), E19 (integration).
  - For S0, the only row assigned to it is U46, and (i) stops the others blocking.
  - One wrinkle for integration, not for S0: notifications-a11y-responsive and xct-offline-a11y are a11y specs in E17 only, and A18's evidence column does not cite E17 or E18. Under (l) they run at E18. Whoever closes A18 at integration should read those two from E18 (carry-forwards). This is not an owner decision, since A18's criterion text already covers "every a11y spec".
- §18 A19 (all): see U47. Its other evidence, "§17.3 reports", has nothing to report for S0. No S0 §17.3 report is in the repo or was given to me.
- §18 A20 (all): ARCHITECTURE PASS and SCOPE CHECK below.
- §18 A21 (all): see Question 1.
- §18 A22 ("—"): recorded non-goal, §4.1.
Result: no other row needs a decision.

CRITERIA
- A1 MET.
  - Spot-run now at HEAD: tracker-packed, status-vocabulary, order-status-badge-packed, account-sidebar, no-hex-literals, no-colour-literals: 6 files, 236 tests passed.
  - U3: split recount from run 2 (16 `it`, then 6 + 5 + 5), on the same tree.
  - U4 amounts: TEST U4f, a runtime comparison with its temporary files deleted. The test in the repo does not assert amounts.
  - E1: 60 passed, 0 failed, chunk 1 on the first server, TEST record. No raw log survives.
  - ADRs: X4 and run 2's regrep, same tree.
  - "Understood everywhere" is limited by Amended (b): MyOrderDetail and StaffOrderQueue are S1's and S2's (carry-forwards).
- A18 MET for S0's part: U46 spot-run above; `rg` back-up returned 0 hits, rerun now. The a11y rows belong to other slices and integration, see Question 3.
- A19 NOT APPLICABLE to S0: no new mocked input or refusal, see Question 3.
- A20 MET: see SCOPE CHECK. No subscription surface: `orderChannelLabel` is display only, OQ-11.
- A21 for S0's part MET.
  - Typecheck, lint, build: T1, T2, B1 at 0ae5cc9, same tree at HEAD; not rerun.
  - Vitest: T3 at `--maxWorkers=2`. Log re-read in this run: "Test Files 212 passed | 1 skipped (213)", "Tests 1881 passed | 45 skipped (1926)", 334.23 s. Run 2's fuller reading of the log stands.
  - Full e2e half: E18, integration. Not evidenced by any gate yet and not owed by S0.
- A22: the recorded non-goal holds.
- Amended (a)-(k): checked in runs 1 and 2, code unchanged. (l): applied above. Ratification of all of them rests on the §1 text and the commits; I cannot verify it further.

OWNER DECISIONS
None remain. D1, D2, D3 (run 1) and D4 (run 2) are closed.

SCOPE
- out-of-scope work found: none.
- files outside allowed scope: none.
- §20 conditions worked around: none found. Code unchanged since run 2.

UNDECLARED DEVIATIONS
- Implementation: none found. No §17.3 slice report was given to me; commit bodies are the only implementer statement I could compare, and they agree with the diff.
- TEST gate:
  - U47 has no row or note (LOW, empty for S0).
  - Sheet line 117 "16 spec files" against 13 (LOW).
- Run 2's undeclared items (E17 omission, integrator authorship, "T3 and A21 only") are now declared in the records.

CARRY-FORWARDS
Before merging S0:
- Commit this report; it is uncommitted. Nothing else is required. The merge target check is under SCOPE CHECK.
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
All later slices:
- Use `npm test -- --maxWorkers=2` for full Vitest evidence and record the flag. Default-worker runs were not green here: red on 2 of 2, against green on 1 of 1 at 2 workers. This also applies to the integration `npm test`.
- Give U47 a row on each sheet (Question 3).
- Under (l), no slice runs E17 as a gate row, but each sheet should state that, as S0's now does.
- Where a gate-added row covers specs outside the slice's §16 rows, write the expectation as "pass, baseline, or passes alone under (i)" before running, so PASS means what it says (Question 2).
- Keep to §16's fresh `next dev` per chunk. S0's chunk 2 did not.
Integration:
- E18 full e2e, exactly the 12 baseline failures; E19 `sweep:a11y`; the A21 full set.
- Recheck at E18, by name: E17 (never run on S0; includes staff-shell-*, xct-offline and xct-offline-a11y, which open /staff/orders, where S0's new seed orders appear), and the four e2e results outside the baseline per Amended (i): ordering-customer :166, :66, :146; shop-staff :137.
- A18: read notifications-a11y-responsive and xct-offline-a11y from E18, because A18's evidence column cites neither E17 nor E18 (Question 3).
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
- Full Vitest, tsc, lint, build, Playwright: not rerun (instructed). This run ran 6 test files alone and the `rg` back-up.
- The E17 specs and the four non-baseline results at E18: not run by anyone. (l) accepts this for E17.
- The log's exit code and worker flag (not in the log). vitest-s0-w2.txt is in the session scratchpad, outside the repo, and will not outlive the session.
- E1 and the e2e rerun results have no surviving raw log; the evidence is the TEST record. The TEST seed comparison and the X2 and X3 probes used deleted temporary files.
- Owner ratification of (a)-(l) beyond its text. Any §17.3 slice report. Screenshots: not taken, exempt under (j).
- (d) still rests on the 54950d6 commit body and ARCHITECTURE; I did not open it.

FINDINGS
- [LOW] docs/test-cases/TC-HO-P5-WIRING-S0.md:3 — §15 U47 ("all") has no row or note. Empty for S0 because S0 adds no mocked refusal, so nothing is owed; the sheet just does not say so.
- [LOW] docs/test-cases/TC-HO-P5-WIRING-S0.md:117 — "the 16 spec files run"; the sheet and record show 13.
- [LOW] docs/test-cases/TC-HO-P5-WIRING-S0.md:68 and :85, docs/gates/HO-P5-WIRING-S0-TEST.md:35 — X1's PASS means non-blocking under (i), and R6 / "no" holds only for the 13 files run. The evidence is disclosed; no correction required.
- [LOW] docs/test-cases/TC-HO-P5-WIRING-S0.md:3-4 — the sheet's header does not mention (i)-(l) or that the integrator edited it; TEST line 7 carries that.
- [LOW] docs/handover/HO-P5-WIRING.md:674 — A18's evidence column omits E17 and E18, though two a11y specs now reach a verdict only at E18. For integration, not S0.
- [LOW] web/tests/unit/orders/status-vocabulary.test.ts:67 — case title claims "amounts kept" with no amount asserted. Carried from earlier gates.

SCOPE CHECK
- files in allowed scope: 19/19 implementation files in `git diff --name-only cda20c4 HEAD`: §13 S0 block 10 (including the deleted overview.test.tsx and overview-signin), split-created 2 (handover lines 417 and 492), Amended (a) (e) (f) (h) 6, handover 1 (only line 76 differs from base). Plus 6 gate and sheet artifacts, which §14's `docs/**` row does not carve out but the gate definitions require. 25 paths in all. No e2e spec, guard, config, package or lock file in the diff.
- files outside allowed scope: none
- merge target: feat/phase2-catalogue-theme is at cda20c4, the merge base, with 0 commits ahead of HEAD, so S0 would merge without conflict. cda20c4 is one docs commit (this handover) on top of §17.1's stated 67691e9.
- written by this gate: docs/gates/HO-P5-WIRING-S0-ACCEPTANCE.md only. Nothing committed; no dev server or browser started.
