GATE: ARCHITECTURE
HANDOVER: HO-P3-STORE-FRONT
COMMITS: e29a0ae (S0), c908c35 (ADR-FE-174..179 only), c38bb9d / 860cd03 (S1), 5c5af0e / 2d0d351 (S2), 24ad5f7 / c7c660f (S3), b1b237c / bfb3c28 (S4), f7fe2af, 3c98022, 7cdfd78 (integrator), 1aa6e76 (backend G1/G4/G5/G8, layering only), 5bd5508 (amendments)
DATE: 2026-10-25
STATUS: PASS

Run 2. Run 1 (same date) was FAIL with two BLOCKERs. Owner-ratified commit 5bd5508 adds the HO-P3 §1 Amended row (items a–e) and the matching HO-P4 §1 row, and marks ADR-FE-175/179 Built. 5bd5508 touches only the two handovers' §1 rows and web/docs/decisions.md, and no code changed between the runs.

Method (unchanged): each slice commit has one parent and is diffed against it. The four HO-P3 merges have no combined-diff content, and each slice's files are identical at the merge and at the slice tip. HO-P4 commits are excluded.

RESOLVED SINCE RUN 1
- Run-1 BLOCKER, web/tests/e2e/journey-real-api.spec.ts (3c98022, §14): covered by HO-P3 Amended (a).
- Run-1 BLOCKER, web/components/hearth/HearthLogo.tsx (7cdfd78, §14): covered by HO-P3 Amended (c), which notes it is reviewed under HO-P4, and by the HO-P4 §1 row (staff-shell.tsx plus the HearthLogo waiver for this one prop).
- Run-1 MEDIUM, post-merge edits to S3/S4-owned specs (3c98022): covered by Amended (b).
- Run-1 MEDIUM, shop-catalogue.spec.ts "Search the shop" outside the literal cart-to-basket exception: covered by Amended (e), which names the label (§8.3, U2) and the file.
- Run-1 MEDIUM, missing S0 report of §17.1 exception edits: Amended (e) now serves as that report. Checked against e29a0ae's file list: it names every split target and every wording edit. The remaining S0 test files (no-hex-literals, shell-p3, shop-shell) are S0's own new files.
- Run-1 LOW, ADR-FE-175/179 status: both now Built. ADR-FE-175's status also records that lib/hooks/useCheckout.ts still parses `step` and that CheckoutScreen never reads it.
- Amended (d) records f7fe2af (portal-header.tsx is an S0 file and was already in scope).

FINDINGS
- [MEDIUM] src/Read/AmarGram.Read/QueryHandlers/Product/GetCatalogueQueryHandler.cs:109 (1aa6e76). The new G1 district filter (`lower(district_of_origin)` IN ...) has no index. `.ai/read-side-pattern.md` §4 rule 6 is "Index what you filter on", and the sibling country and brand filters are indexed (ProductConfiguration.cs:49-50). It needs an expression index if the filter stays case-insensitive.
- [LOW] docs/handover/HO-P3-STORE-FRONT.md:221. §8.4 still says "`step` is removed from the parsed state", which contradicts §12/§14 (lib/** frozen). The code is correct and ADR-FE-175 now documents the actual behaviour. Only the handover wording is left.
- [LOW] web/docs/decisions.md. ADR-FE-174..179 landed in c908c35 after S0's code commit, not as S0's first commit (§9, §17.1). This had no practical effect because S1–S4 branched from 55fac68, which contains them. Kept for the record.
- [LOW] Process (§17.1). S1–S4 branched from 55fac68 on feat/phase2-catalogue-theme, interleaved with HO-P4, not from an S0 merge on feat/phase3-store-front. The per-slice diffs are clean.
- [LOW] src/Read/AmarGram.Read/Queries/Order/GetDeliveryPromiseQuery.cs:375. `DeliveryPromiseViewModel` is declared in `Read.Queries.Order`, not flat `Read.ViewModels`. This matches at least nine existing Query files. Fully qualified type names at src/Api/AmarGram.Api/Modules/ShopModule.cs:234 and Controllers/ShopCatalogueController.cs:119 are cosmetic.

Verified compliant (unchanged from run 1):
- No HO-P3 commit touches web/lib/**, web/mocks/**, web/nav/**, globals.css, the root layout or providers, package.json or configs. No new dependency. No §14 component touched other than as amended.
- NFR-PRF-1: every shop route page is still a Server Component. The only new `'use client'` is MobileTabBar, and S2 turned ProductDetailsRow from client into server.
- Layering: no fetch, useQuery or useMutation in any changed app/ or components/ file. Data comes only through existing lib hooks and API clients.
- §8.3 contracts: every S0 export is retained (additions only). CartBadge and QuantityStepper props are compatible. MobileTabBar, the PortalHeader checkout variant and the portal guard, policy prompt and frame match the contract. The DeliveryPromiseCard, FlagOrGlobe, initialsOf, ACCOUNT_LANDING and safeHttpUrl exports are kept. Nothing still imports a removed export or a deleted file.
- 1aa6e76: one dispatch per action via IInMemoryDispatcher with ValidateCommand = true. The district invariant is in the aggregate, and RiderNote is in the value object and redacted. The new query handler uses AsNoTracking + Select and is registered explicitly as Scoped. Money carries currency, and Application does not reference Read. No superseded-architecture residue.

For TEST (runtime, not observable here): typecheck and lint, Vitest/Playwright counts after the §17.1 splits, E16 on both projects.
For CODE_REVIEW: in GetDeliveryPromiseQueryHandler, the inner `.First()` does not filter `s.IsActive`, although the outer zone filter requires an active Standard service.

SCOPE CHECK
- S0 e29a0ae: 46/46 (§17.1 exception edits listed in Amended (e))
- S0 ADRs c908c35: 1/1
- S1 c38bb9d: 12/12
- S2 5c5af0e: 36/36
- S3 24ad5f7: 21/21
- S4 b1b237c: 35/35
- integrator f7fe2af: 1/1 (Amended (d))
- integrator 3c98022: 4/4 (Amended (a), (b))
- integrator 7cdfd78: 1/1 (HearthLogo.tsx per Amended (c); staff-shell.tsx is HO-P4 S0's, under the HO-P4 row and gates)
- amendments 5bd5508: handover §1 rows and decisions.md status lines (owner-ratified amendment mechanism, §20.2)
- backend 1aa6e76: owner-approved separate change (OQ-4), layering only, not counted against §13
- files in allowed scope: 157/157
- files outside allowed scope: none
