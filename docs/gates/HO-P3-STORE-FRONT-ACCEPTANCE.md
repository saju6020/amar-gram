GATE: ACCEPTANCE
HANDOVER: HO-P3-STORE-FRONT
COMMITS: e29a0ae (S0), c908c35 (ADRs), c38bb9d / 860cd03 (S1), 5c5af0e / 2d0d351 (S2), 24ad5f7 / c7c660f (S3), b1b237c / bfb3c28 (S4), f7fe2af, 3c98022, 7cdfd78, 5bd5508, 4713d6a, 889d81f, ed1e892 (HEAD); baseline 46929be
DATE: 2026-10-25
STATUS: BLOCKED

Run 1. Prior gate records are all present and say PASS: ARCHITECTURE (run 2), SECURITY, CODE_REVIEW, TEST (run 2). The TEST sheet is docs/test-cases/TC-HO-P3-STORE-FRONT.md: 75 rows, 73 PASS, 2 BLOCKED (E16, E-J).

Why BLOCKED and not PASS: three things need an owner decision that no document records. The only source for them is the TEST gate's statement "owner decision". The owner-ratified amendments in §1 are (a) to (g), and none of these three is among them. Without the decisions, A17 is NOT MET as written, and A8 and A16 rest on narrowed evidence. Each one is fixed by a §1 Amended row (h) or by the work named below. Every other criterion has evidence.

OWNER DECISIONS NEEDED
- D-A (A17, A8/E5). web/tests/e2e/shop-product.spec.ts:176-190 and :195-205. The draft-slug case no longer requires HTTP 404: it accepts 200 plus noindex. The no-JS case now checks the delivered HTML instead of a visible h1. Neither change is a copy or layout replacement, which is the only kind of weakening A17 allows, and §16 E5 names "draft 404" explicitly.
  - Commit 5c5af0e's message does not declare the change. This is an undeclared S2 deviation that the TEST gate found.
  - It is pre-existing, not a regression: app/(shop)/loading.tsx is at baseline 46929be, and TEST run 1 sampled the strict forms failing at baseline.
  - The test comment says "a production build answers 404". That is unverified, and probably false. In Next 15, notFound() thrown after a loading boundary has started streaming answers 200 with noindex in production too.
  - Options: (1) ratify as an Amended row, or (2) restore the strict assertions and run the case against `next build` + `next start`.
  - Lines :145-163 (the hero-image attributes, checked only when a photo URL exists) do follow S2's layout change: with no photo it now shows pack art instead of the placeholder img. I accept that as a layout replacement, but it means NFR-PRF-1 "first image is the LCP element" is no longer exercised by any test.
- D-B (A16/E12). accounts-a11y-responsive "E-X1 (idle lock open)" fails on both projects, and so does shop-staff E-C1.
  - Both are staff-area tests, and both failed at baseline (TEST run 1, sampled). §13 also forbids S4 from changing the staff assertions. So HO-P3 cannot fix them in scope.
  - A16 reads "every a11y spec passes". The handoff to HO-P4 that TEST cites appears in no handover, including HO-P4-BACK-OFFICE.md.
  - I treat A16 as MET on E12's own wording ("on the account routes"). The owner should record the handoff in HO-P4 so this is not lost.
- D-C (A17/A4 evidence, E16). The whole `npm run test:e2e` suite was not run. The TC row is BLOCKED, and a BLOCKED row is not a pass. A4 and A17 both cite E16.
  - A4's text is met by SP1–SP8 and the ADRs. A17's typecheck/lint/Vitest clause is met by TEST's recorded results.
  - The §16 E16 requirement itself (whole suite green on the integration branch) has no evidence.
  - Options: run it (the integrator), or have the owner waive it to the HO-P3 spec set that did run (530 runs: 518 pass, 4 fail, all four are D-B).

CRITERIA
- A1 MET. U1–U3 and U8 pass in shell-p3.test.tsx (TC rows U1–U3, U8). E1 shop-shell passes on both projects.
  - Screenshots home-360 and cart-360: tab bar on /shop and absent on /cart; the footer's Contact column (OQ-3 placeholders) is visible and not covered.
  - No leaf strip appears because the mocks have no Shop banner. That is the §8.3 rule for a missing banner, and the design's free-delivery strip is G5.
- A2 MET. U4–U6 in product-card.test.tsx: one POST {skuId, quantity:1}; PUT quantity 3; "−" at 1 removes; fromPrice kept; no Organic badge (G8). E1 and E3 pass on both projects.
- A3 MET. U7 x2 in portal-header.test.tsx. checkout-1280 screenshot: logo plus "Secure checkout", with no search or menu. E9 and E13 pass. ARCHITECTURE confirms the guard, policy prompt and frame are still mounted.
- A4 MET. ADR-FE-174..179 are at web/docs/decisions.md:1892-1934, and the range is in docs/handover/README.md:117. SP1–SP8 counts are equal, or higher only by listed additions (TC §17.1 table). E16 is part of D-C.
- A5 MET.
  - U10–U14 (home-hero.test.tsx, home.test.tsx). E3 passes on both projects.
  - Screenshots home-1280 vs Home.dc.html, and home-360 vs HomePhone.dc.html. Same hero band, "Shop the pantry" tiles, "Fresh from the haat", growers band, promises and footer.
  - Omissions, each matching §21/D-4: the strip (G5); district eyebrows (G1); grower photos (no invented content); "Village on every pack" (G1); the staples box and the footer "Staples box" link (G2); the phone "Delivering to…" line (§4.1).
  - The phone seasonal card is absent because the mocks have no Home banner (§11 says "if any").
- A6 MET. U12; countries-load-error.test.tsx (SP5); E6 passes. The countries-360/1280 screenshots render with no overflow.
- A7 MET.
  - U15–U18 (catalogue-p3, catalogue-view-503, results-states). E4 passes, with E-A4 under Amended (g). E6 covers the 2/3/4 grid.
  - catalogue-1280 vs Catalogue.dc.html: band with count, filter card, "Certified organic only" switch, segmented sort, circle pagination.
  - Omissions: the District group (G1) and card Organic badges (G8).
- A8 MET, subject to D-A for E5's draft-404 case.
  - U19–U22 (product-p3, product-page). E5, E7 pass.
  - product-1280 vs Product.dc.html: badge, eyebrow, Pack size cards with server prices, "400 g pack" note, stepper, Add to basket, tabs, "Goes well with". Wishlist and reviews are kept.
  - Omissions: "Grown in Birganj" becomes producer · country (G1); "Repeat monthly" (G2); "[DAYS]" (G5); "Origin & batch" becomes "Origin & producer" (G9).
- A9 MET. U23 and U24 in cart.test.tsx; E8 passes.
  - cart-360 vs BasketPhone.dc.html: "Your basket", Step 1 of 2, line card with stepper, server subtotal, "Delivery and total are worked out at checkout", sticky footer.
  - Omitted: Delivery, Total and the free-delivery hint (§4.3, G5).
- A10 MET.
  - U25–U31 in checkout.test.tsx. E8 and E9 pass. U30's network-error retry is proved at hook level (TC LOW).
  - checkout-1280 vs Checkout.dc.html: three numbered sections plus the "Your basket" aside, server reasons on disabled payment cards.
  - Omitted: the rider note (G4).
- A11 MET. U32 in account-p3.test.tsx; E10, E12 pass.
  - signin-1280 vs SignIn.dc.html: leaf panel, "Welcome home.", three reasons, staff link, Sign in / Create link switch.
  - Omitted: the prototype skip link (§4.2) and the subscription reason (G2).
- A12 MET. U33 and U34 in account-p3.test.tsx; E13, E14 pass.
  - portal-1280: sidebar labels per D-6, live order card, default address, tiles kept. No Subscriptions link and no staples box (G2).
  - The mock serves no order detail for the dashboard's fixture orders, so the tracker and Buy again do not render in the screenshot. U34 asserts both.
- A13 MET. U35–U37; E9 and E15 pass.
  - orders-1280 and order-placed-1280 vs MyOrders.dc.html within D-5: order cards with status pills, single-status select (G6), "Thank you! Your order is in.", tracker, Order again, "Invoice INV-…" link (G10), Return an item.
  - Omitted: batch numbers (G3).
- A14 MET. U38; E11, E12 pass. data-1280: pill tabs; "Delete my account" is a link (U38 asserts the /portal/account/data/delete href). SECURITY confirms the delete page is the only caller of useDeleteAccount.
- A15 MET. The §17.2 rg run by this gate at HEAD has 0 hits. no-hex-literals.test.ts is green (it was extended in 4713d6a).
- A16 MET on E12's wording (see D-B). E1, E3, E6, E9, E12 (account routes), E14 pass on both projects. Every screenshot above has scrollWidth − clientWidth = 0 at 360 and at 1280.
- A17 NOT MET as written. typecheck, lint and Vitest pass, with 7 load timeouts that pass when run alone (reported by name). But W2 records two weakenings beyond copy or layout (D-A). E16 is not run (D-C). S1–S4 have no slice report listing their test edits; TEST W2's audit is the only listing.
- A18 Not met by design: deferred (G2, §4.1). No subscription UI was found.

FINDINGS
- [MEDIUM] web/tests/e2e/shop-product.spec.ts:176-205 — weakened beyond copy or layout and undeclared in 5c5af0e (D-A).
- [MEDIUM] web/components/shop/home/GrowersBand.tsx and web/components/shop/ShopHero.tsx — S1's replacement copy ("the origin named on every product" / "We name the country of origin on every food we sell") overclaims slightly.
  - The Breakfast Starter Kit card shows only "AMAR GRAM", with no country.
  - ADR-FE-177 requires that static copy "states nothing the system does not do".
  - The deviation is otherwise sound. Owner to accept, or soften to "on our products".
- [LOW] 4713d6a and 889d81f landed after ARCHITECTURE, SECURITY and CODE_REVIEW ran. Their records do not list them, and only TEST run 2 executed them.
  - This gate checked them against §13 and the Amended rows. The web files belong to S0/S3/S4. src/** is the SECURITY LOW remediation on the OQ-4 backend change. The mocks are under (f), shop-catalogue under (g).
  - The diff is small and correct: dl grouping, the Remove name, the text-warm fixes, the settling guard and prune in CheckoutScreen, and ZoneName dropped.
- [LOW] web/components/checkout — with no address and no payment chosen, the "To place your order" list shows overlapping items ("Choose a delivery address." and "Choose or add a delivery address.") and "That payment method isn't available" before any method is chosen (checkout-1280).
- [LOW] web/components/product/ProductHeading.tsx — plainExcerpt joins description lines without punctuation ("…rich in fibre No artificial additives Read…").
- [LOW] web/components/portal/dashboard/BuyAgain.tsx — the added state is an icon plus aria-label only. The design shows "✓ added" text, and U34 says it "turns into 'added'".

Deliberate copy deviations judged (none fails):
- S1 hero/growers: acceptable, with the MEDIUM above.
- S1 fourth promise card: it is §11's own "existing delivery/pickup fact".
- S4 "Welcome back, {name}" and "Create an account": required by the frozen §14 specs portal-real-api.spec.ts and journey-real-api.spec.ts.
- S2 Details tab name "Details, ingredients & certification": it starts with the visible label, so it passes WCAG 2.5.3.
- S2 price note "400 g pack" / "3 × 2 kg": exactly §11 and U19. The CODE_REVIEW concern that it may read as a total is a design question for the owner.
- G1/G4/G5/G8 UI wiring was correctly not done (no riderNote or district reads in web/; OQ-4 follow-up).

Screenshots (scratch, not committed): C:\Users\SHAHJA~1\AppData\Local\Temp\claude\d--my-repo-amar-gram\69818e0e-bfd2-4e52-9fe9-0a7c1dc949c0\scratchpad\shots (18 routes x 360/1280), and the design renders in ...\scratchpad\design.

SCOPE CHECK
- files in allowed scope: 157/157 per ARCHITECTURE run 2, plus 4713d6a (10 web files, all §13; 2 src + 1 test under the OQ-4 backend change) and 889d81f (mocks under Amended (f), shop-catalogue.spec under (g)). Since 46929be, no HO-P3 commit touches web/lib, nav, globals.css or package.json.
- files outside allowed scope: none
- out-of-scope work (§4) found: none. No subscriptions, district, rider note, free-delivery figure, card UI or client money arithmetic.
