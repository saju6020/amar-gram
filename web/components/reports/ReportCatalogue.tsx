'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SearchField } from '@/components/back-office/SearchField';
import { EmptyState } from '@/components/common/EmptyState';
import type { ReportCatalogueEntry } from '@/lib/api/reports';
import { CATEGORY_ORDER, categoryLabel } from '@/lib/format/report';
import { cn } from '@/lib/utils';

/** The categories present in `reports`, known ones in the plain-language order, unknown ones last. */
export function groupByCategory(
  reports: ReportCatalogueEntry[],
): Array<{ category: string; reports: ReportCatalogueEntry[] }> {
  const known = CATEGORY_ORDER.map((category) => ({
    category: category as string,
    reports: reports.filter((report) => report.category === category),
  }));
  const knownSet = new Set<string>(CATEGORY_ORDER);
  const unknownCategories = [
    ...new Set(reports.map((report) => report.category).filter((c) => !knownSet.has(c))),
  ];
  const unknown = unknownCategories.map((category) => ({
    category,
    reports: reports.filter((report) => report.category === category),
  }));
  return [...known, ...unknown].filter((group) => group.reports.length > 0);
}

/**
 * `components/reports/ReportCatalogue.tsx` — HO-RPT-002 §11.3, HO-P4 §11.2.6, US-RPT-01. The report
 * list, the left column of the Reports screen: a `<nav aria-label="Report list">` grouped by the
 * catalogue's own categories, the current report marked `aria-current="page"`. A report the payload
 * omits is simply absent (ADR-FE-137) — there is no "locked" row. Each row shows the title, the
 * description and "Covers up to N days"; the search box filters the small list on the client by
 * title and description.
 */
export function ReportCatalogue({
  reports,
  currentKey,
}: {
  reports: ReportCatalogueEntry[];
  /** The report open in the viewer, if any. */
  currentKey?: string;
}) {
  const [term, setTerm] = useState('');

  const visible = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return reports;
    return reports.filter(
      (report) =>
        report.title.toLowerCase().includes(needle) ||
        report.description.toLowerCase().includes(needle),
    );
  }, [reports, term]);

  const groups = groupByCategory(visible);

  return (
    <nav aria-label="Report list" className="flex flex-col gap-4">
      <SearchField
        id="report-search"
        label="Search reports"
        placeholder="Search reports"
        value={term}
        onChange={setTerm}
      />

      {groups.length === 0 ? (
        <EmptyState
          title={term ? `No report matches “${term.trim()}”` : 'No reports are available to you'}
          description={
            term
              ? 'Try a shorter word, or clear the search to see every report you can open.'
              : 'Ask an administrator if you expected to see reports here.'
          }
        />
      ) : (
        groups.map((group) => (
          <section key={group.category} aria-labelledby={`category-${group.category}`}>
            <h2
              id={`category-${group.category}`}
              className="mb-1.5 px-1 text-[13px] font-bold uppercase tracking-wide text-ink-muted"
            >
              {categoryLabel(group.category)}
            </h2>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {group.reports.map((report) => {
                const current = report.key === currentKey;
                return (
                  <li key={report.key} className="min-w-0">
                    <Link
                      href={`/staff/reports/${encodeURIComponent(report.key)}`}
                      aria-current={current ? 'page' : undefined}
                      className={cn(
                        'flex flex-col gap-0.5 rounded-[var(--radius-md)] border px-3 py-2.5 no-underline',
                        current
                          ? 'border-leaf bg-leaf-soft text-leaf-ink'
                          : 'border-transparent text-ink hover:bg-surface-sunken',
                      )}
                    >
                      <span className="text-sm font-bold">{report.title}</span>
                      <span className={cn('text-[13px]', current ? 'text-leaf-ink' : 'text-ink-muted')}>
                        {report.description}
                      </span>
                      <span className={cn('text-xs', current ? 'text-leaf-ink' : 'text-ink-muted')}>
                        Covers up to {report.maxRangeDays} days
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </nav>
  );
}
