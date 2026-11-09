'use client';

import Link from 'next/link';
import { cardClass } from '@/components/hearth/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { describeApiError } from '@/lib/api/errors';
import { useState } from 'react';
import type { PersonalDataExport } from '@/lib/api/account';

/**
 * `components/account/PersonalDataExportCard.tsx` — US-ACC-13. The export is never put into the
 * query cache (the page's own `useExportPersonalData` is a plain mutation) — it goes straight
 * from the response to a Blob URL, downloaded, and the URL is revoked immediately after (U-J1).
 *
 * ARCH gate HIGH 3 (first pass) — takes `onExport`/`isPending` as props; the page
 * (`app/(portal)/portal/account/data/page.tsx`) wires `useExportPersonalData()`.
 */
export interface PersonalDataExportCardProps {
  onExport: () => Promise<PersonalDataExport>;
  isPending: boolean;
}

export function PersonalDataExportCard({ onExport, isPending }: PersonalDataExportCardProps) {
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setError(null);
    try {
      const data = await onExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'amargram-my-data.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(describeApiError(err));
    }
  }

  return (
    <section aria-labelledby="pf-privacy" className={cn(cardClass, 'flex flex-col gap-3 sm:p-6')}>
      <div>
        <h2 id="pf-privacy" className="m-0 text-xl font-semibold text-ink">
          Your data
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Download a copy of your profile, addresses and notification preferences, as a JSON file.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          variant="pillSecondary"
          size="pillMd"
          onClick={handleDownload}
          disabled={isPending}
          aria-busy={isPending}
          className="min-h-12 border-ink text-ink"
        >
          {isPending ? 'Preparing…' : 'Download my data'}
        </Button>
        {/* UI-3 / D-5: deletion keeps its own password-confirmed page; there is no inline delete. */}
        <Link
          href="/portal/account/data/delete"
          className="inline-flex min-h-12 items-center px-5 font-semibold text-danger-ink underline"
        >
          Delete my account
        </Link>
      </div>
    </section>
  );
}
