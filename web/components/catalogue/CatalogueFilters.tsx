'use client';

import { useId, useState } from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pillInputClass } from '@/components/hearth/fields';
import { countryFlag } from '@/lib/format/shop';
import { categoryLabel, certificationLabel, subcategoryLabel } from '@/lib/shop/labels';
import { toggleValue, type CatalogueParams } from '@/lib/shop/catalogueParams';
import type { CatalogueFilters as Facets, CategoryNode } from '@/lib/api/shop-catalogue';
import { CheckOption, FilterGroup, RadioOption } from './FilterGroup';
import { PriceFilter } from './PriceFilter';

export interface CatalogueFiltersProps {
  value: CatalogueParams;
  facets: Facets;
  categories: CategoryNode[];
  currencyCode: string;
  /** Hide the country group — the origin page owns that filter (US-SHP-05 AC2). */
  hideOrigin?: boolean;
  priceMode: 'button' | 'live';
  onChange: (patch: Partial<CatalogueParams>) => void;
  /** Drops every filter (keeps the search). Offered as the outline *Clear filters* pill when given. */
  onClear?: () => void;
}

const RATINGS = [4, 3, 2] as const;
/** The one certification with its own switch row; the others stay as checkboxes. */
const ORGANIC = 'CertifiedOrganic';
/** Producers shown before "Show all" — the facet list arrives most-products-first. */
const BRANDS_COLLAPSED = 8;

/**
 * HO-SHP-002 §11.2 `CatalogueFilters` — every group is a real `<fieldset>`/`<legend>` (UI-6), opening
 * and closing (2026-10-16). On arrival only Category is open (owner, 2026-10-17: no scrollbar on
 * landing); every other group starts closed unless it already holds a choice. The
 * facet options and counts come from `GET /api/shop/filters`; nothing here counts or filters
 * (ADR-FE-031). The producer search box (producers are the API's `brand`) narrows the OPTION LIST only, never the results.
 */
export function CatalogueFilters({
  value,
  facets,
  categories,
  currencyCode,
  hideOrigin,
  priceMode,
  onChange,
  onClear,
}: CatalogueFiltersProps) {
  const uid = useId();
  const [brandSearch, setBrandSearch] = useState('');
  const [showAllBrands, setShowAllBrands] = useState(false);
  const brandQuery = brandSearch.toLowerCase().trim();
  const matchingBrands = facets.brands.filter((b) => b.name.toLowerCase().includes(brandQuery));
  // Collapsed, the list keeps the top producers plus anything already ticked, so a choice never hides.
  const collapsible = !brandQuery && !showAllBrands && matchingBrands.length > BRANDS_COLLAPSED;
  const brands = collapsible
    ? matchingBrands.filter((b, i) => i < BRANDS_COLLAPSED || value.brand.includes(b.name))
    : matchingBrands;
  const districts = facets.districts ?? [];
  const selectedCategory = categories.find((c) => c.value === value.category);
  const organicOffered =
    facets.certifications.some((c) => c.value === ORGANIC) || value.certification.includes(ORGANIC);
  const otherCertifications = facets.certifications.filter((c) => c.value !== ORGANIC);

  return (
    <div className="flex flex-col gap-3">
      <FilterGroup legend="Category" active={!!value.category}>
        <RadioOption
          id={`${uid}-category-all`}
          name={`${uid}-category`}
          label="All categories"
          checked={!value.category}
          onSelect={() => onChange({ category: '', subcategory: '' })}
        />
        {categories.map((category) => (
          <div key={category.value} className="flex flex-col gap-1.5">
            <RadioOption
              id={`${uid}-category-${category.value}`}
              name={`${uid}-category`}
              label={categoryLabel(category.value)}
              count={category.productCount}
              checked={value.category === category.value && !value.subcategory}
              onSelect={() => onChange({ category: category.value, subcategory: '' })}
            />
            {selectedCategory?.value === category.value && category.subcategories.length > 0 && (
              <div className="ml-5 flex flex-col gap-1.5">
                {category.subcategories.map((sub) => (
                  <RadioOption
                    key={sub.value}
                    id={`${uid}-sub-${sub.value}`}
                    name={`${uid}-category`}
                    label={subcategoryLabel(sub.value)}
                    count={sub.productCount}
                    checked={value.subcategory === sub.value}
                    onSelect={() => onChange({ category: category.value, subcategory: sub.value })}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </FilterGroup>

      {!hideOrigin && facets.origins.length > 0 && (
        <FilterGroup legend="Origin" defaultOpen={false} active={value.origin.length > 0}>
          {facets.origins.map((origin) => {
            const flag = countryFlag(origin.code);
            return (
              <CheckOption
                key={origin.code}
                id={`${uid}-origin-${origin.code}`}
                label={origin.name}
                count={origin.count}
                checked={value.origin.includes(origin.code)}
                onChange={() => onChange({ origin: toggleValue(value.origin, origin.code) })}
                icon={
                  flag ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ADR-FE-035: in-repo SVG
                    <img src={flag} alt="" width={18} height={12} className="h-3 w-[18px]" />
                  ) : (
                    <Globe size={14} aria-hidden="true" className="text-ink-muted" />
                  )
                }
              />
            );
          })}
        </FilterGroup>
      )}

      {/* HO-P5 G1: districts of origin, in the order and with the counts the API sends. */}
      {districts.length > 0 && (
        <FilterGroup legend="District" defaultOpen={false} active={value.district.length > 0}>
          {districts.map((district) => (
            <CheckOption
              key={district.value}
              id={`${uid}-district-${district.value}`}
              label={district.value}
              count={district.count}
              checked={value.district.includes(district.value)}
              onChange={() => onChange({ district: toggleValue(value.district, district.value) })}
            />
          ))}
        </FilterGroup>
      )}

      {facets.brands.length > 0 && (
        <FilterGroup legend="Producer" defaultOpen={false} active={value.brand.length > 0}>
          {facets.brands.length > 8 && (
            <div>
              <label htmlFor={`${uid}-brand-search`} className="sr-only">
                Search producers
              </label>
              <input
                id={`${uid}-brand-search`}
                type="search"
                placeholder="Search producers"
                value={brandSearch}
                onChange={(event) => setBrandSearch(event.target.value)}
                className={pillInputClass}
              />
            </div>
          )}
          {brands.map((brand) => (
            <CheckOption
              key={brand.name}
              id={`${uid}-brand-${brand.name}`}
              label={brand.name}
              count={brand.count}
              checked={value.brand.includes(brand.name)}
              onChange={() => onChange({ brand: toggleValue(value.brand, brand.name) })}
            />
          ))}
          {brands.length === 0 && <p className="text-xs text-ink-muted">No producers match.</p>}
          {!brandQuery && matchingBrands.length > BRANDS_COLLAPSED && (
            <button
              type="button"
              aria-expanded={showAllBrands}
              onClick={() => setShowAllBrands((shown) => !shown)}
              className="self-start text-sm font-medium text-accent-ink underline-offset-2 hover:underline"
            >
              {showAllBrands
                ? 'Show fewer producers'
                : `Show all ${matchingBrands.length} producers`}
            </button>
          )}
        </FilterGroup>
      )}

      {otherCertifications.length > 0 && (
        <FilterGroup
          legend="Certification"
          defaultOpen={false}
          active={value.certification.some((c) => c !== ORGANIC)}
        >
          {otherCertifications.map((certification) => (
            <CheckOption
              key={certification.value}
              id={`${uid}-certification-${certification.value}`}
              label={certificationLabel(certification.value)}
              count={certification.count}
              checked={value.certification.includes(certification.value)}
              onChange={() =>
                onChange({
                  certification: toggleValue(value.certification, certification.value),
                })
              }
            />
          ))}
        </FilterGroup>
      )}

      <PriceFilter
        minPrice={value.minPrice}
        maxPrice={value.maxPrice}
        currencyCode={currencyCode}
        mode={priceMode}
        onApply={onChange}
      />

      <FilterGroup legend="Availability" defaultOpen={false} active={value.inStock}>
        <CheckOption
          id={`${uid}-instock`}
          label="In stock only"
          checked={value.inStock}
          onChange={(checked) => onChange({ inStock: checked })}
        />
      </FilterGroup>

      <FilterGroup legend="Rating" defaultOpen={false} active={value.minRating !== null}>
        <RadioOption
          id={`${uid}-rating-any`}
          name={`${uid}-rating`}
          label="Any rating"
          checked={value.minRating === null}
          onSelect={() => onChange({ minRating: null })}
        />
        {RATINGS.map((rating) => (
          <RadioOption
            key={rating}
            id={`${uid}-rating-${rating}`}
            name={`${uid}-rating`}
            label={`${rating} and up`}
            checked={value.minRating === rating}
            onSelect={() => onChange({ minRating: rating })}
          />
        ))}
      </FilterGroup>

      {organicOffered && (
        <label
          htmlFor={`${uid}-organic`}
          className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl bg-leaf-soft px-3.5 text-leaf-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
        >
          <span className="font-semibold">Certified organic only</span>
          <input
            id={`${uid}-organic`}
            type="checkbox"
            checked={value.certification.includes(ORGANIC)}
            onChange={() => onChange({ certification: toggleValue(value.certification, ORGANIC) })}
            className="size-[22px] flex-none accent-leaf"
          />
        </label>
      )}

      {onClear && (
        <Button variant="secondary" size="pillMd" className="border-ink" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
