'use client';

import type { FormEvent, ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialogReturnFocus,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OFFLINE_CANT_SAVE_LABEL, useWriteEnabled } from '@/lib/hooks/useConnectivity';
import { cn } from '@/lib/utils';

export interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The heading, announced when the dialog opens. It names what is affected (UI-3). */
  title: string;
  /** One plain sentence under the heading, naming what will happen. */
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
  pending: boolean;
  /** An error the server (or the form) gave; shown in an alert region above the buttons. */
  error?: string | null;
  destructive?: boolean;
  /** A wider dialog for the change form. */
  wide?: boolean;
  onConfirm: () => void;
}

/**
 * The one dialog shell of the customer subscription actions (HO-P6 §11.2.6): focus-trapped Radix dialog with its heading
 * announced, a cancel and a confirm button at least 44 px high, the confirm busy (and announced) while it is in flight,
 * and an `alert` region for the server's sentence. The caller owns the form values, so they survive an error.
 */
export function SubscriptionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  pendingLabel = 'Working…',
  cancelLabel = 'Not now',
  pending,
  error,
  destructive,
  wide,
  onConfirm,
}: SubscriptionDialogProps) {
  const returnFocusRef = useDialogReturnFocus(open);
  const writeEnabled = useWriteEnabled();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!pending && writeEnabled) onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent
        hideClose
        returnFocusRef={returnFocusRef}
        className={cn('max-h-[90vh] overflow-y-auto', wide ? 'max-w-xl' : 'max-w-md')}
      >
        <form onSubmit={submit} noValidate className="flex flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children && <div className="flex flex-col gap-4">{children}</div>}
          {error && (
            <p role="alert" className="mb-0 mt-4 text-sm font-semibold text-danger-ink">
              {error}
            </p>
          )}
          <DialogFooter>
            {!writeEnabled && <p className="m-0 w-full text-sm text-ink-muted">{OFFLINE_CANT_SAVE_LABEL}</p>}
            <Button
              variant="pillSecondary"
              size="pillMd"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              type="submit"
              variant={destructive ? 'destructive' : 'pill'}
              size="pillMd"
              disabled={pending || !writeEnabled}
              aria-busy={pending}
            >
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
