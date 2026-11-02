'use client';

import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CustomerTagsDialog } from './CustomerTagsDialog';

/**
 * `components/back-office-customers/CustomerTagsControl.tsx` — HO-P5 §11.5.4 (BG-19). A customer's staff tags as chips
 * (text only: they are free text a colleague typed) and, for the roles that hold `Customers.SetTags` (a presentation
 * hint), an "Edit tags" button. After a save the chips show the set the server stored — trimmed and de-duplicated, which
 * can differ from what was typed — until the profile read catches up.
 */
export function CustomerTagsControl({
  customerId,
  tags,
  canEdit,
}: {
  customerId: string;
  tags: string[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [stored, setStored] = useState<string[] | null>(null);
  // A fresh profile read is the truth again.
  useEffect(() => setStored(null), [tags]);
  const shown = stored ?? tags;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="text-sm font-semibold text-ink">Tags</h3>
      {shown.length === 0 ? (
        <span className="text-sm text-ink-muted">No tags</span>
      ) : (
        <ul aria-label="Tags" className="m-0 flex list-none flex-wrap gap-1 p-0">
          {shown.map((tag) => (
            <li key={tag} className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-semibold text-ink [overflow-wrap:anywhere]">
              {tag}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <>
          <Button variant="secondary" size="sm" className="min-h-11" onClick={() => setOpen(true)}>
            <Pencil size={14} aria-hidden="true" />
            Edit tags
          </Button>
          <CustomerTagsDialog
            open={open}
            onOpenChange={setOpen}
            customerId={customerId}
            tags={shown}
            onSaved={(next) => setStored(next)}
          />
        </>
      )}
    </div>
  );
}
