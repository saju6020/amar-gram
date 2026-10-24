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

  const certifications = detail.certifications ?? [];
  const organicCertifier = food?.organicCertifier ?? null;
  const certificateNumber = food?.organicCertificateNumber ?? null;
  const hasCertification = certifications.length > 0 || !!organicCertifier;
  if ((food && food.ingredientList) || hasCertification) {
    tabs.push({
      id: 'ingredients',
      label: 'Ingredients & certification',
      panel: (
        <div className="flex flex-col gap-4">
          {food?.ingredientList && (
            <div>
              <h3 className="mb-1 text-sm font-bold text-ink">Ingredients</h3>
              <p lang={lang_('ingredientList')} className="whitespace-pre-line text-ink">
                {food.ingredientList}
              </p>
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
  if (food?.storageInstructions || food?.shelfLife || food?.netWeight || food?.allergens) {
    tabs.push({
      id: 'storage',
      label: 'Storage & labelling',
      panel: (
        <div className="flex flex-col gap-3 text-ink">
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
      ),
    });
  }
  if (detail.countryOfOrigin) {
    tabs.push({
      id: 'origin',
      label: 'Origin',
      panel: (
        <div className="flex flex-col gap-3 text-ink">
          {detail.countryOfOrigin && (
            <p>
              <span className="font-semibold">Country of origin:</span>{' '}
              {detail.countryOfOrigin.name}
            </p>
          )}
          {originNotes && <LimitedMarkup body={originNotes} className="space-y-3 text-sm" />}
          {detail.countryOfOrigin && (
            <p>
              <Link
                href={`/shop/countries/${detail.countryOfOrigin.code}${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`}
                className="font-semibold text-accent-ink"
              >
                More from {detail.countryOfOrigin.name}
              </Link>
            </p>
          )}
        </div>
      ),
    });
  }
  return tabs;
}

/**
 * HO-SHP-002 §11.3 `ProductDetailsTabs` — an accessible tab list (arrows, Home, End). Every panel is
 * in the document (hidden when inactive) so the content is server-rendered. Free text — ingredient
 * list, storage instructions, shelf life, allergens — is rendered AS TEXT; only the description
 * goes through `LimitedMarkup` (HO-SHP-001 backlog SHP row 22). Each language-varying field carries
 * its own `lang` from `fieldLocales` (US-SHP-14 AC2).
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
    <section
      aria-label="Product details"
      className="flex min-w-0 flex-col gap-4 rounded-[24px] border border-border bg-surface p-5 sm:px-8 sm:py-7"
    >
      <div role="tablist" aria-label="Product information" className="flex flex-wrap gap-2">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[tab.id] = node;
            }}
            id={`${baseId}-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={active === tab.id}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-semibold',
              active === tab.id
                ? 'border-accent bg-accent text-white'
                : 'border-border bg-surface text-ink hover:border-accent',
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
          className="py-1 text-[15px] leading-relaxed"
        >
          {tab.panel}
        </div>
      ))}
    </section>
  );
}
