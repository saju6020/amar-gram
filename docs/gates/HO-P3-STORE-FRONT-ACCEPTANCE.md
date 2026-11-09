GATE: ACCEPTANCE
HANDOVER: HO-P3-STORE-FRONT
COMMITS: e29a0ae (S0), c908c35 (ADRs), c38bb9d / 860cd03 (S1), 5c5af0e / 2d0d351 (S2), 24ad5f7 / c7c660f (S3), b1b237c / bfb3c28 (S4), f7fe2af, 3c98022, 7cdfd78, 5bd5508, 4713d6a, 889d81f, ed1e892, 318a35f, f426255 (HEAD); baseline 46929be
DATE: 2026-10-25
STATUS: PASS

Run 3. Earlier runs, both on 2026-10-25:
- Run 1 (HEAD ed1e892): BLOCKED. Owner decisions D-A, D-B and D-C were not recorded, and S1's origin copy carried a MEDIUM.
- Run 2 (HEAD 318a35f): BLOCKED. The content was resolved, but amendment (h) sat in the §3.1 table header instead of the §1 Amended row.

Run 3 checks only the move made in f426255.

RESOLVED SINCE RUN 2
- [HIGH, run 2] docs/handover/HO-P3-STORE-FRONT.md:67. Fixed in f426255:
  - Line 42 (§1 Amended) now runs straight on from "(g) … (E4)." into "**2026-10-25 (owner-ratified, ACCEPTANCE gate run 1).** (h) D-A: … (a bundle has no single country). |".
  - Line 67 is back to `| Design screen | Route(s) today | Slice | Stories |`.
  - A string comparison against 318a35f shows the 729-character (h) text moved verbatim. "(h) D-A" appears exactly once in the file.
  - f426255 touches only the handover's two lines and this gate file. There is no web/ or src/ change.

CRITERIA (evidence as recorded in runs 1 and 2)
- A1 MET — U1–U3 and U8 in shell-p3.test.tsx; E1 passes on both projects; screenshots home-360 and cart-360 (tab bar present, absent on /cart, footer not covered).
- A2 MET — U4–U6 in product-card.test.tsx; E1 and E3 pass.
- A3 MET — U7 in portal-header.test.tsx; checkout-1280 shows "Secure checkout"; E9 and E13 pass.
- A4 MET — ADR-FE-174..179 at web/docs/decisions.md:1892-1934 and in docs/handover/README.md:117; split counts SP1–SP8 are recorded in the test-case sheet. E16 is waived by (h) D-C.
- A5 MET — U10–U14 and E3 pass; screenshots compared with Home.dc.html and HomePhone.dc.html.
  - The only omissions are G1, G2 and G5 (§21) and the §4.1 phone delivery line.
  - The origin copy is softened (318a35f). The shop Vitest run is 282/282.
- A6 MET — U12, countries-load-error.test.tsx and E6 pass.
- A7 MET — U15–U18, E4 and E6 pass; the screenshot matches Catalogue.dc.html. Omissions: G1, G8.
- A8 MET — U19–U22, E5 and E7 pass; the screenshot matches Product.dc.html. Omissions: G1, G2, G5, G9. E5's draft-slug assertion is ratified by (h) D-A.
- A9 MET — U23, U24 and E8 pass; the screenshot matches BasketPhone.dc.html. No client totals (§4.3, G5).
- A10 MET — U25–U31, E8 and E9 pass; the screenshot matches Checkout.dc.html. The rider note is left out (G4).
- A11 MET — U32, E10 and E12 pass; the screenshot matches SignIn.dc.html.
- A12 MET — U33, U34, E13 and E14 pass; portal screenshot. The staples box is left out (G2).
- A13 MET — U35–U37, E9 and E15 pass; MyOrders screenshots. Interim versions for G3, G6 and G10.
- A14 MET — U38, E11 and E12 pass. Account deletion still goes through /portal/account/data/delete.
- A15 MET — the §17.2 rg at HEAD returns 0 hits, and no-hex-literals.test.ts is green.
- A16 MET — E1, E3, E6, E9, E12 (account routes) and E14 pass. The staff idle-lock and E-C1 failures belong to HO-P4 (recorded in HO-P4 §1). No screenshot overflows at 360 or 1280.
- A17 MET — typecheck, lint and Vitest pass; load timeouts pass alone and are reported by name. The weakenings beyond copy are ratified by (h) D-A, and E16 is waived by (h) D-C.
- A18 Not met by design: deferred (G2, §4.1). No subscription UI was built.

FINDINGS (none blocking; carried for owners)
- [LOW] web/tests/e2e/shop-product.spec.ts:145-163 — the hero-image LCP checks run only when a photo URL exists, and the mock sends none, so NFR-PRF-1's LCP rule is not exercised. Suggested fix: a mock product with a photo URL.
- [LOW] 4713d6a and 889d81f were not seen by ARCHITECTURE, SECURITY or CODE_REVIEW. This gate checked them in run 1: in scope and correct.
- [LOW] web/components/checkout — the "To place your order" hints overlap, and a payment method is named as unavailable before any method is chosen.
- [LOW] web/components/product/ProductHeading.tsx — plainExcerpt joins description lines without punctuation.
- [LOW] web/components/portal/dashboard/BuyAgain.tsx — the added state is shown by an icon and aria-label only, where the design shows the text "✓ added".

SCOPE CHECK
- files in allowed scope: all. The run 1 and run 2 sets, plus f426255: the handover §1 and §3.1 lines (the owner-ratified amendment mechanism) and this gate file.
- files outside allowed scope: none
- out-of-scope work (§4) found: none
