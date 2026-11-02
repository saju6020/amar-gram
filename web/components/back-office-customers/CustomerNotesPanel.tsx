'use client';

import { useState, type FormEvent } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import { ApiForbiddenError } from '@/lib/api/client';
import { describeApiError } from '@/lib/api/errors';
import { CUSTOMER_NOTE_MAX_LENGTH } from '@/lib/api/staff-customers';
import { formatInZone } from '@/lib/format/time';
import { useCustomerNotes } from '@/lib/hooks/useStaffCustomers';
import { useAddCustomerNote } from '@/lib/hooks/useStaffCustomerMutations';
import { PermissionDeniedState } from '@/components/admin/PermissionDeniedState';

/**
 * `components/back-office-customers/CustomerNotesPanel.tsx` — HO-P5 §11.5.4 (BG-19), US-ACC-10. The staff notes on a
 * customer, newest first, each with who wrote it and when (in the branch's zone, named — ADR-FE-015), and an "Add a note"
 * form for the roles that hold `Customers.AddNote` (a presentation hint: the server decides, and its refusal is shown).
 * A note is free text a colleague typed: it is rendered as text only, line breaks kept, never as markup.
 */
export function CustomerNotesPanel({
  customerId,
  canAdd,
  zone,
}: {
  customerId: string;
  canAdd: boolean;
  /** The IANA zone the times are shown in. */
  zone: string;
}) {
  const notes = useCustomerNotes(customerId);
  const add = useAddCustomerNote(customerId);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (text.trim() === '') return;
    setError(null);
    try {
      await add.mutateAsync(text);
      setText('');
    } catch (failure) {
      setError(describeApiError(failure));
    }
  }

  if (notes.error instanceof ApiForbiddenError) return <PermissionDeniedState />;

  return (
    <div className="flex flex-col gap-4">
      {notes.isLoading ? (
        <LoadingState variant="table" rows={2} label="Loading notes…" />
      ) : notes.isError ? (
        <ErrorState description="We couldn't load the notes just now." onRetry={() => void notes.refetch()} />
      ) : !notes.data || notes.data.length === 0 ? (
        <EmptyState title="No notes yet" description="Notes you add are visible to the team, not to the customer." />
      ) : (
        <ul aria-label="Notes" className="m-0 flex list-none flex-col gap-2 p-0">
          {notes.data.map((note) => (
            <li key={note.id} className="rounded-[var(--radius-md)] bg-surface-sunken p-3 text-sm text-ink">
              <p className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{note.text}</p>
              <p className="m-0 mt-1 text-xs text-ink-muted">
                {note.authorName ?? 'A former colleague'} · {formatInZone(note.createdOn, zone)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
          <label htmlFor="customer-note" className="text-sm font-semibold text-ink">
            Add a note
          </label>
          <textarea
            id="customer-note"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={CUSTOMER_NOTE_MAX_LENGTH}
            rows={3}
            aria-describedby="customer-note-count"
            placeholder="Add a note for the team"
            className="w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id="customer-note-count" className="text-xs text-ink-muted">
              {text.length} / {CUSTOMER_NOTE_MAX_LENGTH}
            </p>
            <Button type="submit" disabled={add.isPending || text.trim() === ''} aria-busy={add.isPending} className="min-h-11">
              {add.isPending ? 'Adding…' : 'Add note'}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm font-semibold text-danger-ink">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
