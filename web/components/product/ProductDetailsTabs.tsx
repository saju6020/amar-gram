'use client';

import * as React from 'react';
import Link from 'next/link';
import { LimitedMarkup } from '@/components/content/LimitedMarkup';
import { cn } from '@/lib/utils';
import { certificationLabel } from '@/lib/shop/labels';
import type { ProductDetail } from '@/lib/api/shop-catalogue';

export interface ProductDetailsTabsProps {
  detail: ProductDetail;
  /** The origin's sourcing notes (LimitedMarkup), when the origin has any. */
  originNotes?: string | null;
  lang?: string;
}

interface Tab {
  id: string;
  label: string;
  /** Overrides the accessible name (it always starts with the visible label, WCAG 2.5.3). */
  accessibleName?: string;
  panel: React.ReactNode;
}

function buildTabs(
  detail: ProductDetail,
  originNotes: string | null | undefined,
  lang?: string,
): Tab[] {
  const lang_ = (field: string) => detail.fieldLocales[field] ?? detail.locale;
  const food = detail.food;
  const tabs: Tab[] = [
    {
      id: 'description',
      label: 'Description',
      panel: detail.description ? (
        <LimitedMarkup body={detail.description} className="prose-sm space-y-3 text-ink" />
      ) : (
        <p className="text-ink-muted">No description yet.</p>
      ),
    },
  ];
  // Wrap each language-varying field so assistive tech reads it in the language it was served in.
  const lf = (field: string, node: React.ReactNode) => <div lang={lang_(field)}>{node}</div>;
  tabs[0]!.panel = lf('description', tabs[0]!.panel);

  // Origin & producer (G9: no harvest month or packing date yet, so only what the API sends).
  const country = detail.countryOfOrigin;
  const district = detail.districtOfOrigin?.trim();
  if (country || originNotes || detail.brand) {
    tabs.push({
      id: 'origin',
      label: 'Origin & producer',
      panel: (
        <div className="flex flex-col gap-3 text-ink">
          {country && (
            <p>
              <span className="font-semibold">Country of origin:</span> {country.name}
            </p>
          )}
          {district && (
            <p>
              <span className="font-semibold">District:</span> {district}
            </p>
          )}
          {detail.brand && (
            <p>
              <span className="font-semibold">Producer:</span> {detail.brand}
            </p>
          )}
          {originNotes && <LimitedMarkup body={originNotes} className="space-y-3 text-sm" />}
          {country && (
            <p>
              <Link
                href={`/shop/countries/${country.code}${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`}
                className="font-semibold text-accent-ink"
              >
                More from {country.name}
              </Link>
            </p>
          )}
        </div>
      ),
    });
  }

  // Details: ingredients, storage, shelf life, net weight, allergens, certifications, certifier.
  const certifications = detail.certifications ?? [];
  const organicCertifier = food?.organicCertifier ?? null;
  const certificateNumber = food?.organicCertificateNumber ?? null;
  const hasCertification = certifications.length > 0 || !!organicCertifier;
  const hasDetails =
    !!food &&
    (food.ingredientList ||
      food.storageInstructions ||
      food.shelfLife ||
      food.netWeight ||
      food.allergens);
  if (hasDetails || hasCertification) {
    tabs.push({
      id: 'details',
      label: 'Details',
      // The frozen shop-staff spec (E-F1) finds this tab as "Ingredients & certification".
      accessibleName: 'Details, ingredients & certification',
      panel: (
        <div className="flex flex-col gap-4 text-ink">
          {food?.ingredientList && (
            <div>
              <h3 className="mb-1 text-sm font-bold text-ink">Ingredients</h3>
              <p lang={lang_('ingredientList')} className="whitespace-pre-line text-ink">
                {food.ingredientList}
              </p>
            </div>
          )}
          {(food?.storageInstructions || food?.shelfLife || food?.netWeight || food?.allergens) && (
            <div className="flex flex-col gap-2">
              <h3 className="mb-0 text-sm font-bold text-ink">Storage and labelling</h3>
              {food.storageInstructions && (
                <p className="whitespace-pre-line">{food.storageInstructions}</p>
              )}
              {food.shelfLife && (
                <p>
                  <span className="font-semibold">Shelf life:</span> {food.shelfLife}
                </p>
              )}
              {food.netWeight && (
                <p>
                  <span className="font-semibold">Net weight:</span> {food.netWeight}
                </p>
              )}
              {food.allergens && (
                <p>
                  <span className="font-semibold">Allergens:</span> {food.allergens}
                </p>
              )}
            </div>
          )}
          {hasCertification && (
            <div>
              <h3 className="mb-1 text-sm font-bold text-ink">Certification</h3>
              {certifications.length > 0 && (
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {certifications.map((certification) => (
                    <li
                      key={certification}
                      className="rounded-pill bg-leaf-soft px-3 py-1 text-sm font-semibold text-leaf-ink"
                    >
                      {certificationLabel(certification)}
                    </li>
                  ))}
                </ul>
              )}
              {organicCertifier && (
                <p className="mt-2 text-sm text-ink-muted">
                  Organic certifier: {organicCertifier}
                  {certificateNumber ? ` (certificate ${certificateNumber})` : ''}
                </p>
              )}
            </div>
          )}
        </div>
      ),
    });
  }
  return tabs;
}

/**
 * HO-SHP-002 §11.3 `ProductDetailsTabs` in the approved design (HO-P3 S2): underline tabs
 * (Description · Origin & producer · Details), the chosen one in ink with a 3px papaya underline. An
 * accessible tab list (arrows, Home, End). Every panel is in the document (hidden when inactive) so
 * the content is server-rendered, and a tab with nothing from the API is not drawn. Free text —
 * ingredient list, storage instructions, shelf life, allergens — is rendered AS TEXT; only the
 * description goes through `LimitedMarkup` (HO-SHP-001 backlog SHP row 22). Each language-varying
 * field carries its own `lang` from `fieldLocales` (US-SHP-14 AC2).
 */
export function ProductDetailsTabs({ detail, originNotes, lang }: ProductDetailsTabsProps) {
  const baseId = React.useId();
  const tabs = buildTabs(detail, originNotes, lang);
  const [active, setActive] = React.useState(tabs[0]!.id);
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  function move(toIndex: number) {
    const next = tabs[(toIndex + tabs.length) % tabs.length]!;
    setActive(next.id);
    refs.current[next.id]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === 'ArrowRight') move(index + 1);
    else if (event.key === 'ArrowLeft') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(tabs.length - 1);
    else return;
    event.preventDefault();
  }

  return (
    <section aria-label="Product details" className="flex min-w-0 flex-col">
      <div
        role="tablist"
        aria-label="Product information"
        className="flex flex-wrap gap-2 border-b-[1.5px] border-border"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[tab.id] = node;
            }}
            id={`${baseId}-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-label={tab.accessibleName}
            aria-selected={active === tab.id}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              '-mb-[1.5px] inline-flex min-h-12 items-center border-0 border-b-[3px] bg-transparent px-[18px] font-semibold',
              active === tab.id
                ? 'border-accent text-ink'
                : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${baseId}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={active !== tab.id}
          tabIndex={0}
          className="max-w-[720px] py-6 text-[17px] leading-relaxed text-ink"
        >
          {tab.panel}
        </div>
      ))}
    </section>
  );
}
