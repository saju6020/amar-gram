GATE: ARCHITECTURE
HANDOVER: HO-P5-WIRING (slice S0)
COMMITS: b32012f 54950d6 99f5c30 a3416f9 238b1f7 00ea533 (base cda20c4, HEAD 00ea533, branch feat/p5-s0-contract)
DATE: 2026-10-31
STATUS: FAIL

FINDINGS
- [HIGH] web/tests/components/portal/account-sidebar.test.tsx:117 — Outside S0's scope. §13 does not list this existing test file in any block, and §13's ownership notes make unlisted test files run-only. Amended (a) waives only the three named component files, not their tests. 00ea533 adds one case ("a Packed order counts as on the way"). The change is additive and no existing assertion moved, but an out-of-scope file is an automatic FAIL under the gate's rule.
- [HIGH] web/tests/components/orders/order-status-badge-packed.test.tsx:1 — Outside S0's scope. This is a new file from 00ea533. S0's only test glob is `tests/unit/orders/**`. In `tests/components/orders/`, §13 assigns only `staff-orders.test.tsx`, to S2. Amended (a) does not cover this file.
- [MEDIUM] web/components/portal/dashboard/labels.ts:25 — A1 and ADR-FE-189 say `Packed` is understood everywhere, with the label "Packed" in lists and badges. This portal `ORDER` map has no `Packed` entry, so `lookup` returns "Status unavailable", and `OrdersTile.tsx:58` shows that to a customer whose order is Packed. No §13 block or Amended row owns this file, and the seeds cannot reveal it because the Packed order belongs to another customer. S0 was right not to touch it (§20.1). It needs a routing decision.
- [MEDIUM] web/mocks/handlers/shop/fixtures.ts:392 — §8.2 asks for "districts on most food products". Only 6 products have a district (lines 392, 454, 473, 494, 515, 571), out of at least 46 food products by a count of the source: 11 named, 27 from `seedGenerated`, and at least 8 in the `others` list. All the generated products have none. U4's narrower conditions (two sharing a district, at least one without) are met, so a test will not catch this.
- [LOW] web/components/portal/dashboard/LiveOrderCard.tsx:15 — `HEADLINES` has no `Packed`, so the card reads "Order … is open" while the tracker sits on Packing. It is a safe fallback, and Amended (a) limits this file to the status list, so S0 is correct. Recorded so the omission is known.
- [LOW] web/mocks/handlers/ordering/store.ts:192 — `DbOrder.packedOn` is optional, but Amended (c) names only `DbOrderLine`, `DbFulfilment` and the shipment fields. §8.2 gives `packedOn` no type, so this contradicts nothing, but the Amended row does not literally cover it.
- [LOW] web/docs/decisions.md:1998 — §9 records ADR-FE-186 as amending ADR-FE-090. The entry cites ADR-FE-090 under Why, but its Status does not say "Amends", unlike ADR-FE-185, -187 and -189.
- [LOW] web/tests/unit/orders/status-vocabulary.test.ts:67 — U4 requires pre-existing ids and amounts unchanged. The test checks the status of 7 of the 11 existing orders and the order count, and no amounts. Reading the diff confirms the seed changes are additive and no amount changed. For the TEST gate to weigh.
- [LOW] docs/handover/HO-P5-WIRING.md:76 — Handover wording. Amended (d) says "U15 Reports cases", which means the HO-P4 label on the moved describe block. HO-P5 §15's own U15 (line 550) is S1's rider-note case. Separately, §5 (line 150) still lists the OQ answers as open and names OQ-1 … OQ-14, while §1 Amended resolves OQ-1 … OQ-15.

SCOPE CHECK
- files in allowed scope: 16/18
- files outside allowed scope: web/tests/components/portal/account-sidebar.test.tsx, web/tests/components/orders/order-status-badge-packed.test.tsx
- §14 forbidden scope: no file touched without a waiver. The two files above are outside §13 but are not §14 rows. `OrderStatusBadge.tsx` is covered by the Amended (a) waiver.
- `overview-dashboard.test.tsx` and `overview-customers.test.tsx` sit in the S2 and S4 blocks but are marked "created by S0's split", and §8.2 and §11.1.4 assign the split to S0. Counted as in scope.
- `docs/handover/HO-P5-WIRING.md`: the only change is text appended to the §1 Amended row, which §14 allows.
- No backend, config, package, `.ai/` or `.claude/` file changed, and no new dependency.

DECISION NEEDED (owner, for the two scope findings)
- Either ratify the two test files in a new §1 Amended entry, or move the cases into `tests/unit/orders/**` and restore `account-sidebar.test.tsx`. Vitest's include pattern (`**/*.test.{ts,tsx}`) picks up both locations.
- Route `components/portal/dashboard/labels.ts` to a slice with an Amended entry. S1 is the natural owner, as Amended (b) already gives it the customer-side `Packed` work, but this is the owner's call.

VERIFIED
- Test split (U3), counted against `54950d6^`: the old file has 16 `it` cases. The new files have dashboard 6, customers 5 and signin 5, which is 16. There is no `.each`, `.skip`, `.only` or `.todo`. All 6 describe blocks are byte-identical to the old file (line endings normalised), and only unused imports were trimmed. The split files have not changed since 54950d6. The implementer's figure of 16 is correct.
- ADRs (§9): ADR-FE-185 … 192 are all present, appended at the end of `web/docs/decisions.md` in the first commit, b32012f, and their decisions match §9. The split is the second commit, as §17.1 requires.
- Contract (§8.2, §11.1): `Packed` sits between `Packing` and `Dispatched`; `riderNote?` is on `OrderFulfilmentView`; the labels for `Packed`, `MarkPacked` and `Subscription` exist; `STAGE_OF_STATUS.Packed = 'Packing'`. `staff-orders.ts` is untouched, as §8.2 requires.
- Seeds (§8.2): the ordering store has two active riders and one inactive, one Packed order with all lines picked, one Dispatched COD order with a rider, and one delivered order with a rider note. The ordering `PERSIST_KEY` is bumped; the shop key moves to S1 under Amended (b). The shop fixtures have two "Was" SKUs, each above its price, plus one expired and one valid certificate. New ids and sequence numbers do not collide (`nextOrderSeq` starts at 200).
- Citations: each new comment's file:line was checked against `src/`, including `OrderViewModels.cs:23`, `StaffOrderViewModels.cs:19, 27-30, 38`, `RiderViewModels.cs:3-4`, `CatalogueItem.cs`, `StaffProductDetailViewModel.cs:23-25, 27-33`, `OrderRules.cs:25` and `OrderTransitionRules.cs:21-22, 56`. `Packed` and `Subscription` exist in the server enumerations, and the server's rider dispatch sets a null courier id and the fixed carrier name, as the seed does.
- Forbidden shapes (§4.3): added lines have no money arithmetic, colour literals, `Number(`, `parseFloat`, `localStorage`, `isSubscribable` or `/subscriptions`. The Subscription label is display-only (OQ-11).
- Amended (a) edits: each of the three component files changes only to add `Packed` (the badge spec, plus the `Box` icon import, and the two status lists).
- Not reviewed: backend layering rules, as no `src/` file changed. `tsc --noEmit --incremental false` exited 0 and wrote nothing; this gate did not run Vitest or e2e. U1, U2, U4 and E1 remain for the TEST gate, including whether the two added orders move any existing spec.
