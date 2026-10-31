# TC-HO-P5-WIRING-S1 — Store front (district, Organic, delivery promise, rider note)

Handover: docs/handover/HO-P5-WIRING.md (S1: §1 Amended (a)-(w), §8.3, §11.2, §15 U5-U15, U46, U47, §16 E2-E6, §17.2, §18 A2-A5 and A18-A20, §19, §20.8)
Commit(s) under test: feat/p5-s1-store-front, HEAD b058708, diff base da87b60
Written: 2026-10-31 (before any command ran)  ·  Executed: 2026-10-31

> Statuses record what was **observed**, not inferred. The Evidence column names what was actually
> seen. `BLOCKED` marks a case that could not be executed or whose result was reasoned about rather
> than watched. The handover's U-rows are prose rows; IDs keep the handover's U5-U15, U46, U47 and
> E2-E6, and add sub-letters (U7a...) and gate-added rows (T*, R*, M*, X*, P*, S*), which I assigned.
>
> **E17 is not a slice row.** Under §1 Amended (l), E17 ("every other spec") is checked at E18 and does
> not block S1. It is outside the counts below. Rows X1-X2 are not E17: they are two specs outside
> E2-E6 that I chose to run because S1 changed code they exercise (`MyOrderDetail`, the shop mock store).
>
> **Expected value for rows outside E2-E6 (X1, X2, and any other spec that fails in E2-E6 chunks but
> is not an E2-E6 spec):** "pass, baseline, or passes alone under (i)". Written before running.
>
> **U47 rule:** one row per new mock refusal. The new refusals are: (1) more than 20 `district` values,
> (2) a `district` value over 60 characters, (3) `riderNote` over 300 characters, (4) `riderNote`
> with a control character, (5) both rule failures at once reported as two violations, (6) NUL
> character (Amended (v): mock answers `PredicateValidator`; server differs, standing difference).
> Non-refusal mock behaviour (Pickup drops note, case-insensitive filter, delivery-promise shape) is
> in the behaviour rows, not U47.

## Summary

| | Count |
|---|---|
| Total | 99 (E17 is not a slice row and is outside the counts) |
| PASS | 89 |
| FAIL | 5 (E2a, E6a, E6b, E6c, E6i: each failed once in a 2-worker chunk and passed alone; none is a reproduced defect) |
| BLOCKED | 5 (U12c, E4c, E6h, R9, R11) |
| NOT RUN | 0 |

Row T3b (rerun at `--maxWorkers=1` if T3 is not green) was removed: T3 was green, so the condition never arose.

## Environment

- Worktree `D:\my-repomar-gram\.claude\worktreesgent-ae90eaf84a4b7e537`, branch feat/p5-s1-store-front, HEAD b058708, Windows 11, Node via npx.
- Free memory by `os.freemem()` before the e2e chunks: 10.1, 12.2, 12.4, 12.2 GB (6.5 GB was seen once mid-run while the other agent's Playwright ran). No 0xC0000142 occurred.
- `next dev` on PORT=3121 with NEXT_PUBLIC_USE_MOCKS=true and NEXT_PUBLIC_API_BASE_URL=http://localhost:5005, a fresh server per chunk (PIDs 37384, 23224, 15436, 14956, 32536, found by port and killed with `taskkill /T`; none left listening). Routes warmed with curl first. Port 3122 and the other agent's processes (worktree agent-a974eb1973a852f4a) were not touched; the chrome-headless-shell processes still alive at the end belong to that run.
- Chunks: 1 = E2-E5 (5 specs); 2a = E6 minus ordering-a11y-responsive; 2b = ordering-a11y-responsive; 3 = X1 and X2. All `--project=chromium --project=mobile-360 --workers=2 --max-failures=20 --reporter=list`; reruns `--workers=1 --retries=0`.
- E6's first attempt (all nine specs in one run) stopped after 141 passes with exit 1, no failure and no summary line. I treated it as a crashed run per 20.8 (not a result) and redid E6 in 2a and 2b. Cause not established (possibly my own background-command timeout; not proven).
- No backend on :5005, so real-API specs are BLOCKED.
- Working tree during the run: `docs/gates/HO-P5-WIRING-S1-ARCHITECTURE.md` showed as modified by a process other than this gate. I did not touch it.

## Command rows

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| T1 | `npm run typecheck` | exit 0 | PASS | `npm run typecheck` exit 0; also `npx tsc --noEmit --incremental false -p .` exit 0 |
| T2 | `npm run lint` (`--max-warnings 0`) | exit 0 | PASS | `npm run lint` exit 0, no output |
| T3 | `npm test -- --maxWorkers=2` (full Vitest) | exit 0; 0 failed | PASS | `npm test -- --maxWorkers=2` exit 0: 216 files passed, 1 skipped; 1927 tests passed, 45 skipped, 0 failed (333.76 s). S0 was 212 files / 1881 passed; difference is S1's new files and cases. No rerun at 1 worker was needed, so no flake comparison arose. |
| T4 | `next build` after e2e, `next dev` stopped | exit 0 | PASS | `next build` after e2e with the dev server stopped and `.next` deleted: exit 0, 58 s |
| T5 | Served-output inspection of `.next` for mock data (mock db key, rider names, seed text, `setupWorker`) as S0's record did | zero hits outside build cache | PASS | grep of `.next` (excluding `cache`): 0 files for `__purrcare_ordering_mock_db__`, `__purrcare_shop_mock_db__`, rider names, Mizanur Rahman, Shirin Akter, BOC-2026-0142, Bangladesh Organic Council, Sam Rahman, setupWorker, createWorker, "Kalijira Rice", "Organic Rolled Oats", Dinajpur, Rajshahi, "Stock take until", "Call before you come", msw/browser. `InvalidCatalogueFilter` (3 files), `districtOfOrigin` (4) and `delivery-promise` (1) appear as production code (message map, types, client path), not handlers. |
| T6 | U46 back-up: `rg` colour literals over `components app` (§17.2) restricted to S1-touched files | no match | PASS | pattern `#hex|rgba?(|hsla?(|-[#` searched (Grep tool; `rg` is not on the Git Bash PATH) over every S1-touched file in components/ and over app/(shop): no match. Vitest guards in U46 also pass. |
| T7 | Scope: `git diff --name-only da87b60 HEAD` lies inside §13 S1 block plus Amended (o), (r), (s); no `src/`, config, dependency or subscription change | no stray file | PASS | `git diff --name-only da87b60 HEAD`: every web/ file is in the §13 S1 block or Amended (o)/(s); the only non-web files are the four `docs/gates/HO-P5-WIRING-S1-*` records (Amended (r)); no src/, config or dependency file |

## Unit cases

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| U5a | `ProductCard` with `districtOfOrigin` | eyebrow text is the district | PASS | product-card.test.tsx "U5: the eyebrow is the district when present, otherwise the producer and country" passed |
| U5b | `ProductCard` without district | eyebrow is producer · country | PASS | same test (both halves in one case) passed |
| U6a | `ProductCard` certifications include `CertifiedOrganic` | "Organic" pill (`bg-leaf text-leaf-soft`) with sr-only "Certified organic"; card link name unchanged | PASS | product-card.test.tsx "U6: the Organic pill shows only when the item is CertifiedOrganic, with the text Certified organic" passed (asserts pill classes, sr-only text, link name) |
| U6b | certifications empty / other certification only | no pill and no hidden text | PASS | same test covers no certifications and other certifications only; passed |
| U7a | District group with 3 districts | 3 checkboxes with counts, in the order sent | PASS | catalogue-p5 "lists the districts the API sent, in that order, with their counts" passed |
| U7b | Tick one | URL gains repeatable `district=X` | PASS | catalogue-p5 "ticking one writes a repeatable district param to the URL" passed |
| U7c | Chip | "Remove filter X" removes only that district | PASS | catalogue-p5 "an active district has the chip Remove filter X, which removes only it" passed |
| U7d | Clear filters | removes district, keeps search | PASS | catalogue-p5 "Clear filters removes the district and keeps the search" passed |
| U7e | Phone sheet button | count includes the district | PASS | catalogue-p5 "is counted in the phone sheet button" passed |
| U7f | Empty `districts` | no District group | PASS | catalogue-p5 "has no District group when the API sends no districts" passed |
| U8 | `catalogueParams` district | parsed as list, serialised to API, counted, kept/cleared like `origin` | PASS | catalogue-params "U8: district is parsed as a list, sent to the API, counted, and cleared like origin" passed |
| U9a | `ProductHeading` with district | "Grown in {district}" above the producer eyebrow | PASS | product-p5 "shows Grown in {district} above the producer eyebrow only when there is a district" passed (covers a and b) |
| U9b | `ProductHeading` without district | no "Grown in"; eyebrow unchanged | PASS | same test; passed |
| U9c | Origin & producer tab | lists District when present, not otherwise; a district alone does not create the tab | PASS | product-p5 "lists the District when the product has one, and not otherwise" passed; the "tab with no API data" case in product-p3 passed in the full suite |
| U10a | `ShopTopStrip` with `freeOver` + 2 banners | "Free delivery over ৳5,000.00 · Cash on delivery across Bangladesh", plain text, `formatMoney` of server string | PASS | shell-p5 "states the free-delivery threshold as plain text, from the server string" passed |
| U10b | `freeOver: null` + banner | first banner as HO-P3 U1 | PASS | shell-p5 "falls back to the first banner when the promise has no threshold, and renders nothing with neither" passed |
| U10c | neither | no strip | PASS | same test; passed |
| U10d | Layout with threshold: every `Shop` banner goes to `BannerStrip` (the "banners render below" clause, unit-only per Amended (t)) | all banners below header | PASS | shell-p5 "with a threshold, the strip is the promise and every Shop banner shows below the header" passed |
| U10e | Layout without threshold: first banner is the strip, rest below | HO-P3 behaviour | PASS | shell-p5 "without a threshold the first banner is the strip and the rest show below" and "with neither a promise nor a banner there is no strip" passed |
| U11 | Layout promise read 500 | page renders; strip falls back to banner; no error banner | PASS | shell-p5 "U11: a failed promise read (500) renders the page and falls back to the banner, with no error banner" passed |
| U12a | `DeliveryPromiseCard` `leadTimeDays: 1` | "usually takes 1 day" text | PASS | product-p5 "states the server lead time when it sends one" passed |
| U12b | `null` / absent | today's text; export and other facts unchanged | PASS | product-p5 "keeps today’s text without a lead time, and keeps its other facts and export" passed |
| U12c | `leadTimeDays: 0` | today's text (Amended (q)) | BLOCKED | component code (`leadTimeDays > 0`) was read, but no test passes 0 (none found in product-p5 or shell-p5); not watched. Gap: Amended (q) call is unpinned |
| U12d | Product page: promise ok → lead time; promise 500 → no lead time, no error | as stated | PASS | shell-p5 "states the server lead time" and "a failed promise read shows no lead time and no error" passed |
| U13a | Rider note field for Delivery | labelled "Note for the rider (optional)", section 3, `maxLength` 300, live count "{n} of 300" | PASS | rider-note "is a labelled field in section 3 for Delivery, with maxLength 300 and a live count" passed |
| U13b | Pickup | field absent | PASS | rider-note "is absent for Pickup" passed |
| U13c | Delivery send | body carries trimmed note; never in URL or storage | PASS | rider-note "sends the trimmed note for Delivery, and never writes it to the URL or to storage" passed |
| U13d | Whitespace-only | sends no note | PASS | rider-note "a whitespace-only note sends nothing" passed |
| U13e | Typed under Delivery, switched to Pickup | body carries no note | PASS | rider-note "sends no note at all for Pickup, even after one was typed for Delivery" passed; fails under mutation M2 (both guards removed) |
| U13f | Retry after network failure | same `Idempotency-Key`, same note, field keeps text | PASS | rider-note "a retry after a network failure reuses the same Idempotency-Key and the same note" passed |
| U14 | Server 400 naming `RiderNote` | error under the field; Place order stays available | PASS | rider-note "shows the problem under the field and leaves Place order available" passed |
| U15a | Customer detail with `fulfilment.riderNote` | rendered as text, markup literal; dt/dd per Amended (u) (wording differs from handover's "Note for the rider: …" text) | PASS | rider-note "renders the note as plain text, markup shown literally" passed. Wording is a dt/dd pair per Amended (u), not "Note for the rider: {note}" |
| U15b | Seeded note shown; none → nothing | as stated | PASS | rider-note "shows the seeded note on a delivery order and nothing when there is none" passed |
| P1 | `MyOrderDetail` Packed Delivery: hero "Your order is packed", cancel hint, return hint, Packing node `current` | as stated, Amended (b), (q) | PASS | rider-note "a Packed order gets its hero and a cancel hint, and the Packing node stays current" passed (asserts hero, cancel hint, one aria-current Packing node, at least 2 done, disabled Return with its hint) |
| P2 | `MyOrderDetail` Packed Pickup: pickup hero sentence | as stated | PASS | rider-note "a Packed pickup order gets the pickup hero sentence" passed |
| P3 | `PERSIST_KEY` is `__purrcare_shop_mock_db__v2` | bumped, Amended (b) | PASS | read mocks/handlers/shop/store.ts:25: PERSIST_KEY = __purrcare_shop_mock_db__v2. By inspection only: no test pins the key (gap) |
| P4 | `checkout.test.tsx` U25 asserts the field present (Amended (o)) | `getByLabelText('Note for the rider (optional)')` | PASS | checkout.test.tsx:562 getByLabelText for the rider note; the file passed in the full suite and in the 47-test mutation runs when unmutated |
| B1 | Behaviour: `district` filter case-insensitive; facets merged case-insensitively, A-Z | as stated | PASS | catalogue-p5 "filters case-insensitively, and the facets list the districts A-Z with counts" passed |
| B2 | Behaviour: delivery-promise mock shape (primary zone Standard), all-null without zone, no `freeOver` without threshold | as stated | PASS | shell-p5 three delivery-promise mock cases (primary zone, all null, no freeOver) passed |
| B3 | Behaviour: place-order mock keeps note for Delivery, drops (null) for Pickup, reads back `fulfilment.riderNote` | as stated | PASS | rider-note "keeps the note for Delivery and drops it for Pickup, reading back as fulfilment.riderNote" passed |
| U46 | `no-hex-literals.test.ts` and `no-colour-literals.test.ts` over touched files | pass | PASS | no-hex-literals.test.ts and no-colour-literals.test.ts passed in the verbose run and in the full suite; T6 found no literal |

## U47 mock refusals (one row per new refusal)

| ID | Refusal | Expected | Status | Evidence |
|---|---|---|---|---|
| U47-1 | 21 `district` values | 400 `InvalidCatalogueFilter`, `propertyName: "district"` | PASS | catalogue-p5 "more than 20 district values -> InvalidCatalogueFilter naming district" passed |
| U47-1b | 20 real values plus blanks / exactly 20 | accepted (negative case) | PASS | catalogue-p5 "blanks are dropped ... 20 real values plus blanks is accepted" and "exactly 20 values is accepted" passed |
| U47-2 | `district` value of 61 characters | 400 `InvalidCatalogueFilter`, `district` | PASS | catalogue-p5 "a value over 60 characters -> InvalidCatalogueFilter naming district" passed |
| U47-3 | `riderNote` of 301 characters | 400, `RiderNote`, `MaximumLengthValidator` | PASS | rider-note "a note over 300 characters is a 400 on RiderNote" passed (one violation, MaximumLengthValidator) |
| U47-4 | `riderNote` with a C0 control character | 400, `RiderNote`, `PredicateValidator`; tab, LF, CR allowed | PASS | rider-note "a control character is a 400 on RiderNote, and tab, LF and CR are allowed" passed (BEL gives PredicateValidator; LF, tab, CR and exactly 300 characters reach the 409 quote check) |
| U47-5 | both failures at once | two violations, both on `RiderNote`; check runs before the quote/idempotency checks | PASS | same test: 300 characters plus NUL gives two violations (MaximumLengthValidator, PredicateValidator). The "both" case uses NUL, so it is also the only NUL case. Refused notes get 400 and allowed ones reach 409, so validation does run before the quote check |
| U47-6 | NUL character | mock answers `RiderNote`/`PredicateValidator` (Amended (v) standing difference from `NulByteRejectionFilter`); I check it is as (v) states, not that it matches the server | PASS | NUL answered RiderNote/PredicateValidator in the same test, as Amended (v) states; the server's different answer (NulByteRejectionFilter) cannot be tested here |

## Integration cases (Playwright, `chromium` + `mobile-360`, mocks, `next dev` :3121)

| ID | Case | Expected | Status | Evidence |
|---|---|---|---|---|
| E2a | `shop-catalogue.spec.ts` existing tests (both projects) | pass | FAIL | Chunk 1 (fresh dev server, 2 workers, both projects, 5 specs): 78 passed, 4 skipped, 1 failed, 1 flaky. shop-catalogue.spec.ts:217 "E-E1: maintenance replaces the storefront" FAILED on mobile-360: `getByText("Stock take until 6pm.")` not found in 20 s. Rerun alone, 1 worker, warm: chromium and mobile-360 both pass. Rerun at 2 workers, --retries=0, --repeat-each=3: 6/6 pass. Not reproduced; cause unexplained (candidate: the test flips a server-global maintenance flag and the other project's copy of the same test ran at the same time; not proven). All other shop-catalogue tests in the chunk passed. |
| E2b | new: filter by district → every card's eyebrow is that district | pass | PASS | shop-catalogue.spec.ts "filtering by a district shows only cards with that district as their eyebrow" passed on chromium and mobile-360 in chunk 1 |
| E2c | new: certified card shows "Organic", uncertified does not | pass | PASS | shop-catalogue.spec.ts "a certified-organic card shows the Organic pill; one that is not certified does not" passed on both projects in chunk 1 |
| E2d | retitled S2 test: "the District filter is offered" | pass | PASS | shop-catalogue.spec.ts "S2: the heading band ... the District filter is offered" passed on both projects in chunk 1 |
| E3a | `shop-product.spec.ts` existing tests | pass | PASS | shop-product.spec.ts existing tests: 20 passed in chunk 1 across both projects with the new ones (10 per project) |
| E3b | new: "Grown in …" above producer line and under Origin | pass | PASS | shop-product.spec.ts "a product with a district says Grown in ... above its producer line, and lists it under Origin" passed on both projects |
| E3c | new: delivery card states lead time | pass | PASS | shop-product.spec.ts "the delivery card states the server lead time" passed on both projects |
| E3d | new: producer abroad has no "Grown in" | pass | PASS | shop-product.spec.ts "a product from a producer abroad has no Grown in line" passed on both projects |
| E4a | `shop-shell.spec.ts`: strip states threshold on `/shop`, `/shop/products`, axe clean | pass | PASS | shop-shell.spec.ts "the top strip shows the delivery promise on the home page and the catalogue, axe clean" passed on both projects (4 skipped across shop-shell/shop-home are the specs' own phone-only/desktop-only skips) |
| E4b | `shop-home.spec.ts`: strip above header on home, axe clean | pass | PASS | shop-home.spec.ts strip test passed on both projects in chunk 1 |
| E4c | "banners still render below" in a browser | unit-only per Amended (t); not an e2e row | BLOCKED | Amended (t): no `Shop` banner seeded; proven by U10d |
| E5a | `ordering-customer.spec.ts` new rider-note test: note typed, hidden on Pickup and back, COD placed, shown on order as text, URL clean | pass | PASS | ordering-customer.spec.ts:167 "G4: a delivery COD order with a rider note shows it on the order; Pickup hides the field and keeps the note out of the URL" passed on both projects in chunk 1 |
| E5b | `ordering-customer.spec.ts:166` COD disabled above the ceiling (S0 flaked under load) | pass, or passes alone | PASS | The COD-ceiling test is now at :200 (S1 added a test at :167, so the S0 line :166 moved). "E-B4/E-C1: COD is disabled above the ceiling" passed on chromium and mobile-360 in chunk 1 |
| E5c | `ordering-customer.spec.ts:66` basket Undo (mobile-360; S0 flaked) | pass, or passes alone | PASS | ordering-customer.spec.ts:66 passed on both projects in chunk 1 and again alone (4/4 in the reruns) |
| E5d | `ordering-customer.spec.ts:146` E-B3 (mobile-360; S0 flaked) | pass, or passes alone | PASS | ordering-customer.spec.ts:146 E-B3: chromium FAILED its first attempt in chunk 1 (24.8 s; `Collect from a branch` radio not found at line 156), passed on the spec's own configured retry (`retries: 1` at line 5), reported flaky. mobile-360 passed first time. Alone, 1 worker, --retries=0, --repeat-each=4: 8/8 pass (both projects). Same test flaked under load in S0. PASS with the flake noted; on a strict reading a first-attempt failure on an S1 row is a caveat |
| E5e | rest of `ordering-customer.spec.ts` | pass | PASS | the other ordering-customer tests passed on both projects in chunk 1 |
| E6a | `shop-a11y-responsive.spec.ts` | pass | FAIL | Chunk 2a (fresh server, 2 workers; shop-a11y-responsive, shop-portal, home, portal-a11y-responsive, portal-dashboard, account-area, accounts-a11y-responsive, accounts-auth): 370 passed, 4 failed. shop-a11y-responsive.spec.ts:118 "review form with validation errors" FAILED on mobile-360 (90 s timeout clicking `Send review`). Alone, 1 worker, --retries=0: passes on chromium and mobile-360. Everything else in the spec passed. Unexplained under load. E6 first attempt (2 workers, all E6 specs in one run) stopped after 141 passes with exit 1, no failure listing and no summary line; per 20.8 it is not recorded as a result and the chunk was redone in two parts on fresh servers.  |
| E6b | `shop-portal.spec.ts` | pass | FAIL | Chunk 2a: shop-portal.spec.ts:11 "E-D1: save to the wishlist; request alerts" FAILED on chromium (90 s timeout waiting for `Tell me when it's back`). Alone, 1 worker, --retries=0: passes on both projects. Unexplained under load; the product page is an S1 file, but the same page passes alone and elsewhere in the chunk |
| E6c | `home.spec.ts` | pass | FAIL | Chunk 2a: home.spec.ts:41 "signed in as a customer lands on My orders" FAILED on mobile-360 (expected /portal/orders, received /shop). Alone: passes on both projects. Unexplained under load (sign-in session state) |
| E6d | `ordering-a11y-responsive.spec.ts` except baseline :133 | pass; :133 fails as recorded or passes | PASS | Chunk 2b (fresh server, 2 workers): ordering-a11y-responsive.spec.ts 68 passed, exit 0. The baseline :133 test passed on both projects here |
| E6e | `portal-a11y-responsive.spec.ts`, `portal-dashboard.spec.ts` | pass | PASS | Chunk 2a: portal-a11y-responsive.spec.ts and portal-dashboard.spec.ts all passed |
| E6f | `account-area.spec.ts` | pass | PASS | Chunk 2a: account-area.spec.ts all passed |
| E6g | `accounts-a11y-responsive.spec.ts` | pass | PASS | Chunk 2a: accounts-a11y-responsive.spec.ts all passed |
| E6i | `accounts-auth.spec.ts` | pass | FAIL | Chunk 2a: accounts-auth.spec.ts:102 "E-C2: reload the portal after sign-in" FAILED on mobile-360 (`getByLabel("Full name")` not found in 5 s). Alone: passes on both projects. Unexplained under load |
| E6h | `portal-real-api.spec.ts` | real-API | BLOCKED | no backend on :5005 |
| X1 | `ordering-customer-orders.spec.ts` (S0 E1; `MyOrderDetail` changed). Not E2-E6 | pass, baseline, or passes alone under (i) | PASS | Chunk 3 (fresh server, 2 workers; with shop-staff): 15 passed, 1 flaky, exit 0. ordering-customer-orders.spec.ts:69 "E-D1: cancel before packing..." chromium first attempt timed out finding the ORD-2026-000104 link, passed on retry; alone, --retries=0, --repeat-each=3: 6/6 pass on both projects. Passes alone, so within "pass, baseline, or passes alone under (i)" |
| X2 | `shop-staff.spec.ts` (S3's E10; shop mock store changed and `PERSIST_KEY` bumped). Not E2-E6 | pass, baseline, or passes alone under (i) | PASS | Chunk 3: shop-staff.spec.ts all passed on both projects (no failure, no flake) |
| E17 | Not a slice row (Amended (l)); checked at E18; outside the counts | — | BLOCKED | not counted |

## Regression cases from earlier gates

| ID | Gate | Finding | Case | Status | Evidence |
|---|---|---|---|---|---|
| R1 | ARCHITECTURE | BLOCKER: slice report under `docs/**` | Amended (r) covers it; `git diff --name-only` shows docs additions only at the (r) paths | PASS | T7: the only docs files in the diff are the four docs/gates/HO-P5-WIRING-S1-* records, which Amended (r) covers. Note: git status during this run showed docs/gates/HO-P5-WIRING-S1-ARCHITECTURE.md modified (76 lines) by a process that is not this gate |
| R2 | ARCHITECTURE | `CatalogueFilters.districts` optional | required per (s); typecheck passes with fixtures carrying `districts: []`; p3 case retitled | PASS | typecheck exit 0 with districts required; catalogue-fixtures.ts adds `districts: []`; catalogue-p3 case renamed to "shows no District group when the API sends no districts" (git diff) |
| R3 | ARCHITECTURE | `InvalidCatalogueFilter` shows raw server message | catalogue renders `SHOP_CODE_MESSAGES` plain text (shell-p5) | PASS | shell-p5 plain-text case passed; mutation M1 makes it fail |
| R4 | ARCHITECTURE | NUL difference | U47-6 | PASS | U47-6 passed (NUL answered as Amended (v) states) |
| R5 | CODE_REVIEW | Packed paths unasserted | P1, P2 | PASS | P1 and P2 passed; the case now asserts the Packing node, done nodes, disabled Return and its hint |
| R6 | CODE_REVIEW | retry test did not assert field | U13f | PASS | rider-note retry case now asserts `noteField()).toHaveValue("Call before you come up")` between attempts and the same key and note; passed |
| R7 | CODE_REVIEW | blanks/trim not tested | U47-1b | PASS | U47-1b passed |
| R8 | CODE_REVIEW | zero threshold (fix) | strip falls back for `0.00`, `0`, `0.0`; shows for `0.50`, `5000.00` (shell-p5) | PASS | shell-p5 zero-threshold case passed; M3 makes it fail; probe shows 0, 0.0, 0.00 fall back and 0.50, 0.01 show the strip. The shipped test covers only 0.00 |
| R9 | CODE_REVIEW | `centsText` edges untested | gap: see Gaps | BLOCKED | `centsText` not exported; no fixture with edge value; adding either is outside this gate |
| R10 | SECURITY | note rendered as text, not URL/storage | U13c, U15a, E5a | PASS | U13c (URL and storage empty), U15a (markup literal) and E5a (URL clean, note shown as text) passed |
| R11 | SECURITY | rider note in audit table; catalogue rate limit shared bucket | backend, pre-existing | BLOCKED | no backend change in S1; owner is backend |
| R12 | SECURITY | public builders must not carry staff-only certificate/scheduled fields | list and detail JSON contain none | PASS | catalogue-p5 staff-only fields case passed; M4 makes it fail for both the card and the detail builder |

## Mutation checks (remove code, confirm a test fails, restore with git, confirm clean tree)

| ID | Mutation | Expected | Status | Evidence |
|---|---|---|---|---|
| M1 | `CatalogueView.tsx`: revert plain-text mapping to raw `errorMessage` | a test fails | PASS | CatalogueView plain-text mapping replaced by raw errorMessage: shell-p5 "an over-limit district list reads the existing plain sentence" FAILED (expected the plain sentence). Restored with git checkout; tree clean |
| M2 | Delivery-only note: send note regardless of fulfilment (CheckoutScreen:341 and checkout.ts:215 both; then each alone to see if the double guard hides it) | a test fails (both); report each alone | PASS | removing both Delivery guards (CheckoutScreen:341 and checkout.ts:215): rider-note "sends no note at all for Pickup, even after one was typed for Delivery" FAILED (1 failed, 46 passed). Removing CheckoutScreen:341 alone: 47/47 passed. Removing checkout.ts:215 alone: 47/47 passed. The guards are redundant and each is individually unproven; only the pair is. Restored; clean |
| M2b | `PaymentSection`: show note field for Pickup too | a test fails | PASS | PaymentSection showNote without the Delivery check: "is absent for Pickup" and "sends no note at all for Pickup..." FAILED (2 failed). Restored; clean |
| M3 | `promiseTakesStrip`: remove the zero-amount check | a test fails | PASS | promiseTakesStrip zero-amount test removed (return !!amount): shell-p5 "does not take the strip: Free delivery over 0.00 would be a misleading claim" FAILED. Restored; clean. Probe (temporary test, deleted): 0, 0.00, 0.0 give false; 0.50, 0.01, 10.00, 5000.00, 100 give true; null freeOver and null promise give false (9/9 passed). The shipped test only uses 0.00 |
| M4 | `catalogueItem`: add `organicCertificateExpiresOn` to the public card; and `detailView` likewise | a test fails | PASS | added organicCertificateExpiresOn to the public catalogueItem: catalogue-p5 "the public card and detail never carry the staff-only certificate or scheduled Was fields" FAILED. Added organicCertificateFileId to detailView: same test FAILED. Restored both; clean |

## Acceptance-criteria coverage

| Criterion | Covered by | Status |
|---|---|---|
| A2 district on cards, product page, filter with server counts and URL state | U5, U7, U8, U9, E2b, E3b | PASS (U5, U7-U9, E2b, E3b all passed) |
| A3 truthful Organic badge | U6, E2c | PASS (U6, E2c passed) |
| A4 strip threshold, lead time, no arithmetic, safe fallback | U10-U12, R8, E3c, E4a, E4b | PASS (U10-U12 passed except U12c, which has no test; E3c, E4a, E4b passed) |
| A5 rider note placed once, validated as server, shown back | U13-U15, U47-3..6, E5a | PASS (U13-U15, U47-3..6, E5a passed; a rider-note mutation of only one of two guards goes undetected, see M2) |
| A18 (S1 share) no colour literals; a11y specs pass | U46, T6, E4, E6 | FAIL (U46, T6 pass; E4 passes; E6 had 4 specs fail under 2-worker load, all pass alone) |
| A19 every new mocked input refused as the server does | U47-1..6 | PASS (U47-1..6 passed) |
| A20 scope | T7 | PASS (T7) |
| A21 typecheck, lint, Vitest, build | T1-T4 | PASS (T1-T4 green; the S1 slice does not own the full e2e, E18) |

## Cases I could not run

| ID | Why | What would unblock it |
|---|---|---|
| U12c (lead time 0 keeps today's text) | no test passes 0; only the code was read | a one-line case in product-p5 |
| E6h and any `*-real-api` spec | no backend | a scratch API on :5005 |
| E4c | unit-only per Amended (t) | a seeded `Shop` banner (outside S1's block, §20.1) |
| R9 | `centsText` private | export plus table test, or a fixture with an edge price |
| R11 | backend | backend owner |

## Gaps left deliberately

| Gap | Why not covered | Suggested owner |
|---|---|---|
| ACCEPTANCE screenshots at 360 / 1280 | not a TEST gate item (§19) | acceptance-reviewer |
| No test pins `PERSIST_KEY` v2 (P3 is by reading) | would need a test file beyond the S1 list | integrator |
| Zero-threshold test covers only `0.00` (probe confirms `0`, `0.0`) | not changed: existing specs are not edited by this gate | slice owner |
| Delivery-only rider note: each of the two guards alone is unproven (M2) | defence in depth; removing both is caught | slice owner, optional |
| Cause of the five 2-worker failures unexplained | none reproduced alone | integrator at E18 |
| E17 | Amended (l) | integration E18 |
