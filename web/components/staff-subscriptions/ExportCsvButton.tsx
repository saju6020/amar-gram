'use client';

import { useEffect } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import type { StaffSubscriptionFilters } from '@/lib/api/staff-subscriptions';
import { useExportSubscriptions } from '@/lib/hooks/useStaffSubscriptions';
import { EXPORT_TOO_MANY_ROWS } from '@/lib/subscriptions/copy';
import { describeSubscriptionError } from '@/lib/subscriptions/errors';

/** 413 is the one status the shared download path leaves as a plain `ApiError` (billing-staff.ts `xhrRequest`). */
const TOO_MANY_ROWS_STATUS = 413;

function exportMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === TOO_MANY_ROWS_STATUS) return EXPORT_TOO_MANY_ROWS;
  return describeSubscriptionError(error);
}

/**
 * HO-P6 S2 (§11.3.3, ADR-FE-114). "Export CSV" with the list's current filters and no paging. The server builds the
 * file and the browser saves it; nothing is previewed in the page. A refusal is shown beside the button in words.
 */
export function ExportCsvButton({ filters }: { filters: StaffSubscriptionFilters }) {
  const exporter = useExportSubscriptions();
  const { reset } = exporter;
  // A refusal belongs to the filters it was raised for: new filters start clean.
  useEffect(() => reset(), [filters, reset]);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        variant="secondary"
        className="min-h-11"
        onClick={() => exporter.mutate(filters)}
        disabled={exporter.isPending}
        aria-busy={exporter.isPending}
      >
        <Download size={16} aria-hidden="true" />
        {exporter.isPending ? 'Preparing…' : 'Export CSV'}
      </Button>
      {exporter.isError && (
        <span role="alert" className="max-w-xs text-xs font-semibold text-danger-ink">
          {exportMessage(exporter.error)}
        </span>
      )}
    </span>
  );
}
