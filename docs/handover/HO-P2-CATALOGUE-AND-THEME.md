# HO-P2 — General product catalogue + the ripe mango & banana leaf theme

Owner decisions (2026-10-24):
- Theme: option "Haat · Ripe mango & banana leaf". The approved design is `docs/design/` (start at `store/` and `back-office/`).
- Process: lightweight, as in HO-P1.
- Prerequisite: HO-P1 done. The code-review MEDIUM finding (pet-store categories drive `IsFood`) is resolved here.

## 1. Catalogue (backend: `src/`, `tests/`)

The database is a fresh baseline with no production data, so these enumerations are redefined outright. Regenerate the baseline migration if the model changes. Do not stack a new migration on `InitialAmarGram` unless the change is pure data.

### 1.1 `ProductCategory` (top level)

| Value | Name | Display | IsFood |
|---|---|---|---|
| 1 | RiceAndGrains | Rice & grains | yes |
| 2 | HoneyAndGur | Honey & gur | yes |
| 3 | OilsAndGhee | Oils & ghee | yes |
| 4 | Spices | Spices | yes |
| 5 | Pulses | Pulses | yes |
| 6 | TeaAndDrinks | Tea & drinks | yes |
| 7 | FreshProduce | Fresh produce | yes |
| 8 | DatesAndDryFruit | Dates & dry fruit | yes |
| 9 | DairyAndEggs | Dairy & eggs | yes |
| 10 | SnacksAndSweets | Snacks & sweets | yes |
| 11 | HouseholdAndCare | Household & natural care | no |

`IsFood` must no longer be keyed to one value. Add an explicit rule on the enumeration, e.g. a property or a set. Everything that used `IsFood` keeps its meaning: expiry tracking, country-of-origin and labelling publish checks, return class, `StockClass.Food`, and the origins query.

### 1.2 `ProductSubcategory`

Two to four per category, for example:
- RiceAndGrains: Aromatic rice, Everyday rice, Flattened & puffed rice, Flour
- HoneyAndGur: Honey, Date molasses (gur), Sugarcane gur
- OilsAndGhee: Mustard oil, Ghee, Other oils
- HouseholdAndCare: Jute & bags, Natural care

Keep the existing rule that a subcategory belongs to exactly one category.

### 1.3 Replace pet-food fields with generic food fields

- **`HealthFocus`** (Hairball, Urinary, …) becomes **`Certification`** with values: `CertifiedOrganic`, `PesticideFree`, `Traditional`, `Halal`. Multi-select, like `HealthFocus` today.
- **`ProteinSource`** goes, together with its filter and index. If an "analysis" table only makes sense for pet food, remove it.
- **Food details keep:** ingredients, storage instructions, shelf life, net weight, allergens (free text), and the organic certifier and certificate number. Both fields are optional; publishing requires them only when `CertifiedOrganic` is set.

### 1.4 Catalogue filters and facets

Filters are: category, subcategory, origin, producer (was "brand"; the column name may stay `brand`), certification and price.

### 1.5 Web seed data

`web/scripts/data/amarpet-cat-catalogue.json` and `dry-food-catalogue.json` are replaced by `web/scripts/data/amargram-catalogue.json`:
- about 40 organic and everyday products across all 11 categories
- sizes and SKUs, prices in ৳, districts of origin, producers
- certifications on about half the products

Update `web/scripts/seed-dev*.mjs` to use it, and remove every cat product or brand. `tests/e2e/journey-real-api.spec.ts`'s `SEEDED_BRANDS` follows the new producers.

### 1.6 Tests

Update the domain, application, infrastructure and integration tests to the new enumerations. No test may be skipped or have its assertions weakened, except where it asserted a removed pet-food concept.

## 2. Theme (web: `web/`)

Tokens are in `web/app/globals.css`. Components must never use hex literals (existing rule).

| Token | Staff / base | Customer layer `[data-theme='customer']` |
|---|---|---|
| `--surface-page` | `#F7F4EC` | `#FBF3E2` |
| `--surface` | `#FFFFFF` | `#FFFAF0` (cards) |
| `--surface-sunken` | `#F0E9DA` | (same) |
| `--ink` / `--ink-muted` / `--ink-faint` | `#2A1F12` / `#69553C` / `#8C7B61` | (same) |
| `--border` / `--border-strong` | `#E5DCC8` / `#CDBB99` | (same) |
| `--accent` / `--accent-ink` / `--accent-soft` | papaya `#B4531A` / `#8A3D11` / `rgba(180,83,26,.08)` | (same) |
| `--warm` / `--warm-ink` / `--warm-soft` | — | mango `#EDA73A` / `#7A3B10` / `#FBF1DC` |
| `--accent-tint` | — | light banana leaf `#E3EDC6` |
| new `--leaf` / `--leaf-ink` / `--leaf-soft` | `#3F6A1E` / `#2F5114` / `#E3EDC6` | (same) |
| `--danger-bg` / `--danger-ink` | `#FBE3DA` / `#8A2814` | |
| `--warning-bg` / `--warning-ink` | `#FCEBC7` / `#6E4700` | |

Expose `--leaf*` through `@theme inline`, giving `bg-leaf`, `text-leaf-ink`, `bg-leaf-soft`.

### 2.1 Fonts

Fraunces (display: headings, prices, wordmark) and Work Sans (body), both via `next/font`. Replace the Inter-only setup.

### 2.2 Brand marks and illustrations

- **Logo** (`components/hearth/HearthLogo.tsx`): the sprout mark on a **banana-leaf** badge (`bg-leaf`, mark in `--leaf-soft`), plus the wordmark "Amar" in ink and "Gram" in `--leaf` text. The "Shop" tag stays.
- **Favicon:** `app/icon.svg` uses `#3F6A1E`.
- **`EmptyWarmIllustration`** still draws a cat: draw the harvest basket (`LineArtBasket`) instead.
- **Staff shell:** the fallback icon `PawPrint` becomes `Sprout` or `Leaf` from lucide.
- **Staff sidebar:** deep banana leaf (`--leaf-ink` background, `--leaf-soft` active item), as in `docs/design/back-office/*`.

### 2.3 Labels

`lib/shop/labels.ts` and `CATEGORY_ICONS` follow §1.1, with lucide icons (Wheat, Droplet, Flame, Leaf, Bean, CupSoda, Carrot, Nut, Egg, Cookie, Home). Pack-size and certification labels follow §1.3.

## 3. Out of scope

Rebuilding screens to match the design layouts is HO-P3 (store front) and HO-P4 (back office). HO-P2 only changes tokens, fonts, logo, illustrations, labels and the catalogue model.

## 4. Acceptance

1. `dotnet build AmarGram.sln` passes with 0 errors. The unit tests stay at their current counts or better: Domain 1538/1539 with the 1 pre-existing failure, Application 412/412, Infrastructure 173/173.
2. A fresh `amargram_dev` builds from the (regenerated) baseline. `has-pending-model-changes` reports none.
3. The integration tests pass at least as well as in HO-P1: 1211 passed, with the known parallel-only failures.
4. In `web/`, typecheck, lint and Vitest pass, apart from the known timing-flaky files.
5. A grep over `src tests web` (excluding `node_modules`, `.next`, `web/docs/decisions.md`) for `CatFood|Litter|Hairball|Urinary|Kitten|PawPrint|LineArtCat|amarpet` returns nothing.
6. `#2f6b3a` and `#d4932b`, the Pass-1 tokens, are gone from `web/`.
