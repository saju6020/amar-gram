'use client';

import { useState, type ReactNode } from 'react';
import { FormRootError, TextAreaField, TextField } from '@/components/billing/Fields';
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
import { ApiForbiddenError } from '@/lib/api/client';
import { subscriptionFieldErrors, type SubscriptionField } from '@/lib/subscriptions/errors';

/** `SubscriptionRules.MaxNoteLength`, Shared/Common/Constants/SubscriptionRules.cs:16. */
export const SUBSCRIPTION_TEXT_MAX = 500;

export interface StaffActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  /** The server's property the text answers to: `reason` (reinstate) or `note` (cancel). */
  textField: Extract<SubscriptionField, 'reason' | 'note'>;
  textLabel: string;
  textHint: string;
  textRequiredMessage: string;
  /** Reinstate asks for an optional first delivery date; cancel does not. */
  dateHint?: string;
  confirmLabel: string;
  dismissLabel: string;
  destructive?: boolean;
  onSubmit: (text: string, date: string) => Promise<unknown>;
  /** A 403 from the server: the parent replaces the action with the permission message. */
  onForbidden: () => void;
}

/**
 * HO-P6 S2 (§11.3.6, UI-3). One confirm-with-text dialog for the two staff writes. The text is required and at most 500
 * characters (checked here and by the server); the date has no client bounds because staff have no options read (BG-S6,
 * OQ-16) and the server's sentence names the range. A refusal lands under the field it names, and what was typed is kept.
 */
export function StaffActionDialog(props: StaffActionDialogProps) {
  const { open, onOpenChange, textField, onSubmit, onForbidden } = props;
  const returnFocusRef = useDialogReturnFocus(open);
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<SubscriptionField | 'root', string>>>({});

  function close(next: boolean) {
    if (busy) return;
    if (!next) {
      setText('');
      setDate('');
      setErrors({});
    }
    onOpenChange(next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (text.trim() === '') return setErrors({ [textField]: props.textRequiredMessage });
    if (text.length > SUBSCRIPTION_TEXT_MAX) return setErrors({ [textField]: `Use up to ${SUBSCRIPTION_TEXT_MAX} characters.` });
    setBusy(true);
    setErrors({});
    try {
      await onSubmit(text.trim(), date);
      setBusy(false);
      close(false);
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiForbiddenError) {
        close(false);
        onForbidden();
        return;
      }
      setErrors(subscriptionFieldErrors(error));
    }
  }

  const id = `staff-action-${textField}`;
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent returnFocusRef={returnFocusRef} hideClose className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
          <FormRootError message={errors.root} />
          {props.dateHint && (
            <TextField
              id={`${id}-date`}
              label="First delivery (optional)"
              type="date"
              className="min-h-11"
              value={date}
              hint={props.dateHint}
              error={errors.firstDeliveryOn}
              onChange={(event) => setDate(event.target.value)}
            />
          )}
          <TextAreaField
            id={id}
            label={props.textLabel}
            required
            value={text}
            hint={`${props.textHint} ${text.length} / ${SUBSCRIPTION_TEXT_MAX}`}
            error={errors[textField]}
            onChange={(event) => setText(event.target.value)}
          />
        </form>
        <DialogFooter>
          <Button variant="secondary" className="min-h-11" onClick={() => close(false)} disabled={busy}>
            {props.dismissLabel}
          </Button>
          <Button
            type="submit"
            form={`${id}-form`}
            variant={props.destructive ? 'destructive' : 'primary'}
            className="min-h-11"
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? 'Working…' : props.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
