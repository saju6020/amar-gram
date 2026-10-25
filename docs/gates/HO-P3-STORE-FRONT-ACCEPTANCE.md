GATE: ACCEPTANCE
HANDOVER: HO-P3-STORE-FRONT
COMMITS: e29a0ae (S0), c908c35 (ADRs), c38bb9d / 860cd03 (S1), 5c5af0e / 2d0d351 (S2), 24ad5f7 / c7c660f (S3), b1b237c / bfb3c28 (S4), f7fe2af, 3c98022, 7cdfd78, 5bd5508, 4713d6a, 889d81f, ed1e892, 318a35f (HEAD); baseline 46929be
DATE: 2026-10-25
STATUS: BLOCKED

Run 2. Run 1 (same date, HEAD ed1e892) was BLOCKED on three owner decisions, D-A, D-B and D-C, plus a MEDIUM on S1's origin copy. Commit 318a35f carries the owner's answers and the copy change.

RESOLVED SINCE RUN 1 (the content)
- D-A. The (h) text ratifies the shop-product.spec.ts draft-slug change (200 + noindex) and the no-JS change (delivered HTML).
  - The unverified "a production build answers 404" comment is gone. web/tests/e2e/shop-product.spec.ts now cites "owner-ratified, HO-P3 Amended (h)".
  - So A17's weakening clause and E5's "draft 404" are covered by an owner ratification.
- D-B. The idle-lock axe case (accounts-a11y-responsive "E-X1 (idle lock open)") and shop-staff E-C1 pass to HO-P4.
  - This is recorded in docs/handover/HO-P4-BACK-OFFICE.md §1 Amended (line 42), which names both specs and test names.
- D-C. E16 is waived to the HO-P3 spec set (518 pass; the only 4 failures are the D-B tests).
  - HO-P4's Amended row takes the full `npm run test:e2e` at HO-P4 integration.
- Copy MEDIUM. All three places are softened:
  - web/components/shop/ShopHero.tsx: "origin named on our products".
  - web/components/shop/home/GrowersBand.tsx: "Our products name their origin." and "We name the country of origin on our foods…".
  - web/app/(shop)/shop/countries/page.tsx: likewise.
  - `git grep` at HEAD finds no remaining "every product" / "every food we sell" claims in web/.
  - This gate re-ran `npx vitest run tests/components/shop`: 13 files, 282/282 pass. eslint --max-warnings 0 is clean on the 5 changed web files.
  - The 318a35f web files are all in §13: S1 owns countries/page.tsx, ShopHero.tsx, home/** and home.test.tsx; S2 owns shop-product.spec.ts.

WHY STILL BLOCKED (one document defect, mechanical fix)
- [HIGH] docs/handover/HO-P3-STORE-FRONT.md:67. The "(h)" amendment text was inserted into the §3.1 table's header row, inside the "Stories" header cell. It is not in the §1 Amended row (line 42), which still ends at "(g) … (E4).|".
  - The handover says amendments live in §1 and the coordinator reports "§1 Amended (h)", but §1 contains no (h).
  - §3.1's scope table now has a paragraph of amendment prose as a column heading.
  - The decisions are written down, but not where the handover's own amendment mechanism puts them. The final gate cannot certify against a malformed governing document.
  - Fix: move the text "**2026-10-25 (owner-ratified, ACCEPTANCE gate run 1).** (h) D-A: … (a bundle has no single country)." from line 67 to the end of the line-42 Amended cell, before its closing `|`. Restore line 67 to `| Design screen | Route(s) today | Slice | Stories |`.
  - No code change is needed. Once that one doc edit is made, every criterion below is MET and ACCEPTANCE can PASS.

CRITERIA (evidence as in run 1; changes noted)
- A1 MET — U1–U3, U8 (shell-p3.test.tsx); E1 on both projects; screenshots home-360/cart-360.
- A2 MET — U4–U6 (product-card.test.tsx); E1, E3.
- A3 MET — U7 (portal-header.test.tsx); checkout-1280 screenshot; E9, E13.
- A4 MET — ADR-FE-174..179 at web/docs/decisions.md:1892-1934 and docs/handover/README.md:117; SP1–SP8 counts. E16 waived (D-C).
- A5 MET — U10–U14; E3; Home/HomePhone screenshots compared. Omissions are exactly G1, G2 and G5, plus §4.1. The copy is now softened (282/282).
- A6 MET — U12, countries-load-error.test.tsx, E6. The countries copy is softened.
- A7 MET — U15–U18, E4 (E-A4 per (g)), E6; Catalogue screenshot. Omissions: G1, G8.
- A8 MET — U19–U22, E5, E7; Product screenshot. Omissions: G1, G2, G5, G9. E5's draft-slug assertion is per the D-A ratification in the (h) text.
- A9 MET — U23, U24, E8; BasketPhone screenshot. No client totals (G5, §4.3).
- A10 MET — U25–U31, E8, E9; Checkout screenshot. The rider note is omitted (G4).
- A11 MET — U32, E10, E12; SignIn screenshot.
- A12 MET — U33, U34, E13, E14; portal screenshot. The staples box is omitted (G2).
- A13 MET — U35–U37, E9, E15; MyOrders screenshots. The G3, G6 and G10 interim versions are in place.
- A14 MET — U38, E11, E12; deletion goes through /portal/account/data/delete.
- A15 MET — §17.2 rg at HEAD returns 0 hits; no-hex-literals.test.ts is green.
- A16 MET — E1, E3, E6, E9, E12 (account routes), E14 pass. The staff idle-lock case is HO-P4's (D-B, recorded in HO-P4 §1). Screenshots show zero overflow at 360 and 1280.
- A17 MET, given (h) — typecheck, lint and Vitest pass (load timeouts pass alone, reported by name). The two beyond-copy weakenings are owner-ratified (D-A). E16 is waived (D-C).
- A18 Not met by design (G2, §4.1). No subscription UI was built.

FINDINGS
- [HIGH] docs/handover/HO-P3-STORE-FRONT.md:67 — amendment (h) is misplaced in the §3.1 table header, not in the §1 Amended row (line 42). See above.
- [LOW] web/tests/e2e/shop-product.spec.ts:145-163 — the hero-image LCP attribute checks run only when a photo URL exists, and the mock sends none. NFR-PRF-1's "first image is the LCP element" is therefore not exercised by any test. It is a layout replacement, so it was accepted in run 1. Suggested: a mock product with a photo URL.
- [LOW] 4713d6a and 889d81f were not seen by ARCHITECTURE, SECURITY or CODE_REVIEW. This gate checked both against §13 and Amended (f)/(g) in run 1: in scope and correct.
- [LOW] web/components/checkout — the "To place your order" hints overlap, and they name a payment method as unavailable before any method is chosen.
- [LOW] web/components/product/ProductHeading.tsx — plainExcerpt joins description lines without punctuation.
- [LOW] web/components/portal/dashboard/BuyAgain.tsx — the added state is an icon plus aria-label only; the design shows "✓ added" text.

Deliberate copy deviations (judged in run 1; none fails): S1 hero/growers (now softened); S1 fourth promise card (§11's delivery/pickup fact); S4 "Welcome back, {name}" / "Create an account" (frozen §14 specs); S2 Details tab name (passes 2.5.3); S2 price note (§11, U19).

SCOPE CHECK
- files in allowed scope: run 1's set, plus 318a35f's 5 web files (all §13 S1/S2) and its docs (handover §1 rows, this gate file).
- files outside allowed scope: none
- out-of-scope work (§4) found: none
