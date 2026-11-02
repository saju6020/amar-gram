'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/back-office/Panel';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatInZone } from '@/lib/format/time';
import type { GoodsReceiptDraftSummary } from '@/lib/api/inventory-receipts';

/**
 * `components/inventory/ReceiptDraftList.tsx` -- HO-P5 BG-18 (HO-P4 §11.5.6, ADR-FE-190). "Your drafts": the
 * receipts the signed-in staff member started and left, newest first, each with its supplier, how many lines it
 * holds, when it was last saved and which branch it is for. **Continue** opens it; **Discard** confirms and deletes
 * it. The server returns the caller's own drafts only, so no ownership is worked out here. Text from the draft
 * (supplier, branch) is rendered as text.
 */
export function ReceiptDraftList({
  drafts,
  timeZoneLabel,
  onContinue,
  onDiscard,
}: {
  drafts: GoodsReceiptDraftSummary[];
  timeZoneLabel: string;
  onContinue: (draftId: string) => void;
  /** Deletes the draft; rejects with the API error so the dialog can show it. */
  onDiscard: (draftId: string) => Promise<unknown>;
}) {
  const [discarding, setDiscarding] = React.useState<GoodsReceiptDraftSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  if (drafts.length === 0) return null;

  return (
    <Panel title="Your drafts">
      <p className="mb-3 text-sm text-ink-muted">
        Receipts you started and have not posted. They are saved for you as you type, so you can carry on from any device.
      </p>
      {error && (
        <p role="alert" className="mb-3 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
      <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Your drafts">
        {drafts.map((draft) => (
          <li
            key={draft.draftId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3"
          >
            <div className="flex min-w-0 flex-col gap-0.5 text-sm">
              <span className="font-semibold text-ink [overflow-wrap:anywhere]">
                {draft.supplierName ?? 'No supplier chosen'}
              </span>
              <span className="text-ink-muted">
                {draft.lineCount} {draft.lineCount === 1 ? 'line' : 'lines'}
                {draft.branchName ? ` · ${draft.branchName}` : ''}
              </span>
              <span className="text-ink-muted">
                Last saved {formatInZone(draft.updatedOn, timeZoneLabel)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Continue the draft${draft.supplierName ? ` for ${draft.supplierName}` : ''}, saved ${formatInZone(draft.updatedOn, timeZoneLabel)}`}
                onClick={() => onContinue(draft.draftId)}
              >
                Continue
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Discard the draft${draft.supplierName ? ` for ${draft.supplierName}` : ''}, saved ${formatInZone(draft.updatedOn, timeZoneLabel)}`}
                onClick={() => {
                  setError(null);
                  setDiscarding(draft);
                }}
              >
                Discard
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={discarding !== null}
        onOpenChange={(open) => !open && setDiscarding(null)}
        title="Discard this draft?"
        consequence={
          discarding
            ? `The draft with ${discarding.lineCount} ${discarding.lineCount === 1 ? 'line' : 'lines'} is deleted. Nothing has been posted.`
            : ''
        }
        confirmLabel="Discard draft"
        variant="destructive"
        onConfirm={async () => {
          const target = discarding;
          setDiscarding(null);
          if (!target) return;
          try {
            await onDiscard(target.draftId);
          } catch {
            setError('That draft could not be discarded. Try again.');
          }
        }}
      />
    </Panel>
  );
}
