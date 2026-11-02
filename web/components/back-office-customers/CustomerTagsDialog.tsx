'use client';

import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialogReturnFocus,
} from '@/components/ui/dialog';
import { describeApiError } from '@/lib/api/errors';
import { CUSTOMER_MAX_TAGS, CUSTOMER_TAG_MAX_LENGTH } from '@/lib/api/staff-customers';
import { useSetCustomerTags } from '@/lib/hooks/useStaffCustomerMutations';

/**
 * `components/back-office-customers/CustomerTagsDialog.tsx` — HO-P5 §11.5.4 (BG-19). Edit a customer's staff tags: the
 * chips with a remove button each, and an input that adds a tag on Enter (or the Add button). At most 10 tags of at most
 * 30 characters (Shared/Constants/CustomerStaffRecordRules.cs:8-9), counted on screen. The limits are enforced here so the
 * person is told before the request, and again by the server (`InvalidCustomerTag`, `CustomerTagLimitExceeded`), whose
 * message is shown if it refuses. Save sends the whole set; the caller shows the set the server stored.
 */
export function CustomerTagsDialog({
  open,
  onOpenChange,
  customerId,
  tags,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  tags: string[];
  onSaved: (stored: string[]) => void;
}) {
  const save = useSetCustomerTags(customerId);
  const returnFocusRef = useDialogReturnFocus(open);
  const [draft, setDraft] = useState<string[]>(tags);
  const [input, setInput] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(tags);
      setInput('');
      setProblem(null);
    }
    // Reset only when the dialog opens: an edit in progress must not be replaced by a background refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function add() {
    const tag = input.trim();
    if (tag === '') return;
    if (tag.length > CUSTOMER_TAG_MAX_LENGTH || /[\u0000-\u001f\u007f-\u009f]/.test(tag)) {
      setProblem(`A tag can be up to ${CUSTOMER_TAG_MAX_LENGTH} characters.`);
      return;
    }
    if (draft.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      setProblem(`“${tag}” is already a tag.`);
      return;
    }
    if (draft.length >= CUSTOMER_MAX_TAGS) {
      setProblem(`A customer can have up to ${CUSTOMER_MAX_TAGS} tags.`);
      return;
    }
    setDraft([...draft, tag]);
    setInput('');
    setProblem(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setProblem(null);
    try {
      const result = await save.mutateAsync(draft);
      onSaved(result.tags);
      onOpenChange(false);
    } catch (failure) {
      setProblem(describeApiError(failure));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent returnFocusRef={returnFocusRef} className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Edit tags</DialogTitle>
            <DialogDescription>
              Tags are labels for your team, such as “Regular”. The customer does not see them.
            </DialogDescription>
          </DialogHeader>

          {draft.length === 0 ? (
            <p className="text-sm text-ink-muted">No tags yet.</p>
          ) : (
            <ul aria-label="Tags in this edit" className="m-0 flex list-none flex-wrap gap-2 p-0">
              {draft.map((tag) => (
                <li key={tag} className="flex items-center gap-1 rounded-full bg-surface-sunken py-0.5 pl-3 pr-1 text-sm font-semibold text-ink">
                  <span className="[overflow-wrap:anywhere]">{tag}</span>
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() => setDraft(draft.filter((existing) => existing !== tag))}
                    className="grid size-11 place-items-center rounded-full text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="customer-new-tag" className="text-sm font-semibold text-ink">
              Add a tag
            </label>
            <div className="flex gap-2">
              <input
                id="customer-new-tag"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                maxLength={CUSTOMER_TAG_MAX_LENGTH}
                aria-describedby="customer-tag-count"
                className="min-h-11 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
              <Button type="button" variant="secondary" className="min-h-11 flex-none" onClick={add}>
                Add
              </Button>
            </div>
            <p id="customer-tag-count" className="text-xs text-ink-muted">
              {draft.length} of {CUSTOMER_MAX_TAGS} tags · up to {CUSTOMER_TAG_MAX_LENGTH} characters each
            </p>
          </div>

          {problem && (
            <p role="alert" className="text-sm font-semibold text-danger-ink">
              {problem}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending} aria-busy={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save tags'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
