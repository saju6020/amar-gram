'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { UnsavedChangesGuard } from '@/components/account/UnsavedChangesGuard';
import { ScanField } from '@/components/common/ScanField';
import { Panel } from '@/components/back-office/Panel';
import { ActionDialog } from './ReasonDialog';
import { SelectField, TextField } from './fields';
import { SkuPicker } from './SkuPicker';
import { ReceiptLineCard } from './ReceiptLineCard';
import { ReceiptErrorSummary } from './ReceiptErrorSummary';
import { EMPTY_ERRORS, distributeViolations, errorsForRow, focusErrorTarget, hasErrors, stampRowKeys, type DistributedErrors } from './lineErrors';
import {
  EMPTY_RECEIPT,
  defaultReceiptLocation,
  describeReceiptError,
  lineFromSku,
  toDraftRequest,
  toPostRequest,
  validateReceipt,
  type ReceiptFormState,
} from './receiptModel';
import { formatQuantity } from '@/lib/format/inventory';
import { formatDateOnly, timeOnlyInZone } from '@/lib/format/time';
import Link from 'next/link';
import { ApiValidationError } from '@/lib/api/client';
import { useReceiptDraftAutosave } from '@/lib/hooks/useInventory';
import type { ReceiptDraftLine } from '@/lib/drafts/receipt-draft';
import type { SkuLookup, StockLocation } from '@/lib/api/inventory-lookup';
import type { PostGoodsReceiptRequest } from '@/lib/api/inventory-receipts';
import type { ConsignmentSummary } from '@/lib/api/procurement-consignments';
import type { PurchaseOrderSummary } from '@/lib/api/procurement-orders';

/** How long the form must stay saved before the draft id is written to the address (see the comment in the form). */
const ADDRESS_AFTER_SETTLED_MS = 600;
const TOP_FIELDS = ['purchaseOrderId', 'consignmentId', 'supplierId', 'deliveryReference'] as const;

export interface PurchaseOrderLinesFor {
  purchaseOrderId: string;
  lines: ReceiptDraftLine[];
}

/** A branch the signed-in staff member works in, with its name (the "Receive into" choices). */
export interface ReceivingBranch {
  id: string;
  name: string;
}

/**
 * `components/inventory/GoodsReceiptForm.tsx` — HO-IMP-002 §11.3, US-IMP-04. The screen someone uses
 * standing at a delivery. Source (against a purchase order, a cleared consignment, or direct),
 * delivery reference, a scan field that adds a line per scan (HW-2) beside the SKU picker, and one
 * card per line. **Post** is confirmed — naming the lines, their quantities with units, where they go,
 * and that a posted receipt cannot be edited. A `400` puts EVERY violation on its own field and scrolls
 * to the first. No quantity is added up here: the confirmation lists each line's quantity with its unit.
 *
 * HO-P5 BG-18 (ADR-FE-190): the form **autosaves to a draft on the server** (the caller's own, whole-form `PUT`
 * 1.5 s after the last change and on field blur, never two requests at once). "Draft saved at hh:mm" sits under the
 * heading in a polite live region; "Post to stock" sends `draftId` so the draft closes; "Discard draft" confirms and
 * deletes it. Nothing is kept in browser storage any more (the sessionStorage draft of ADR-FE-043 is superseded).
 * "Receive into" appears only for a person who works in two or more branches (OQ-13), defaulting to the active one;
 * changing it asks first when lines exist, because locations belong to a branch. `UnsavedChangesGuard` releases only
 * once the newest change has been saved (NFR-USA-5).
 */
export function GoodsReceiptForm({
  draftId,
  branches,
  branchId,
  onBranchChange,
  locations,
  purchaseOrders,
  consignments,
  purchaseOrderLines,
  initial,
  initialIsDraft = false,
  onPurchaseOrderChange,
  onScan,
  onPost,
  onDiscardDraft,
  onDraftSaved,
  isPosting,
  timeZoneLabel,
}: {
  /** The client-minted id of this form's draft; the draft `PUT`s go to it. */
  draftId: string;
  /** The branches the caller works in; the "Receive into" select shows only with two or more. */
  branches?: ReceivingBranch[];
  /** The branch being received into (the active one unless the caller chose another). */
  branchId?: string;
  onBranchChange?: (branchId: string) => void;
  locations: StockLocation[] | undefined;
  purchaseOrders: PurchaseOrderSummary[];
  consignments: ConsignmentSummary[];
  /** The selected order's lines, once loaded (null while there is none or it is loading). */
  purchaseOrderLines: PurchaseOrderLinesFor | null;
  initial?: Partial<ReceiptFormState>;
  /** The initial values are a saved draft's: keep its lines rather than refilling them from the order. */
  initialIsDraft?: boolean;
  onPurchaseOrderChange: (purchaseOrderId: string) => void;
  onScan: (barcode: string) => Promise<SkuLookup | null>;
  onPost: (request: PostGoodsReceiptRequest) => Promise<void>;
  /** Deletes the draft on the server; the screen then starts a fresh form with a new draft id. */
  onDiscardDraft: () => Promise<void>;
  /** Called once the first autosave has succeeded, so the screen can put `?draft=` in the address. */
  onDraftSaved?: (draftId: string) => void;
  isPosting: boolean;
  timeZoneLabel: string;
}) {
  const [state, setState] = React.useState<ReceiptFormState>({ ...EMPTY_RECEIPT, ...initial });
  const [errors, setErrors] = React.useState<DistributedErrors>(EMPTY_ERRORS);
  const [confirming, setConfirming] = React.useState(false);
  const [discarding, setDiscarding] = React.useState(false);
  const [switchingTo, setSwitchingTo] = React.useState<ReceivingBranch | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const appliedPoRef = React.useRef<string>(initialIsDraft ? (initial?.purchaseOrderId ?? '') : '');
  const focusKeyRef = React.useRef<string | null>(null);
  const defaultLocation = defaultReceiptLocation(locations);
  const chosenOrder = purchaseOrders.find((po) => po.id === state.purchaseOrderId);
  const showBranchChoice = (branches?.length ?? 0) >= 2;

  // ADR-FE-190: nothing is saved until the form has been touched; the draft is the whole form.
  const autosave = useReceiptDraftAutosave({
    draftId,
    payload: dirty
      ? toDraftRequest(state, {
          branchId: showBranchChoice ? (branchId ?? null) : null,
          supplierId: state.source === 'purchase-order' ? (chosenOrder?.supplierId ?? null) : null,
        })
      : null,
    enabled: !submitting,
  });

  const draftSaved = autosave.state === 'saved' || autosave.state === 'idle' ? autosave.savedAt : null;
  // The address gets `?draft=` once the draft exists AND nothing is waiting to be saved. While a change is pending the
  // unsaved-changes guard keeps a sentinel history entry, and when the change is saved it steps back off that entry
  // (`history.back()`, asynchronous): an address written in that same tick lands on the entry being left and is lost.
  // So the address is written a moment after the form has settled, and only if it still has.
  const onDraftSavedRef = React.useRef(onDraftSaved);
  React.useEffect(() => {
    onDraftSavedRef.current = onDraftSaved;
  });
  const reportedRef = React.useRef(false);
  const draftSettled = !!autosave.savedAt && !autosave.hasUnsavedChanges;
  React.useEffect(() => {
    if (reportedRef.current || !draftSettled) return;
    const timer = setTimeout(() => {
      reportedRef.current = true;
      onDraftSavedRef.current?.(draftId);
    }, ADDRESS_AFTER_SETTLED_MS);
    return () => clearTimeout(timer);
  }, [draftSettled, draftId]);

  // A change the quiet-moment timer has not sent yet goes out when the page is hidden.
  const flushRef = React.useRef(autosave.flush);
  flushRef.current = autosave.flush;
  React.useEffect(() => {
    const flush = () => flushRef.current();
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  // A purchase order's lines arrive after it is chosen: pre-fill them once per order.
  React.useEffect(() => {
    if (!purchaseOrderLines || state.source !== 'purchase-order') return;
    if (purchaseOrderLines.purchaseOrderId !== state.purchaseOrderId) return;
    if (appliedPoRef.current === purchaseOrderLines.purchaseOrderId) return;
    appliedPoRef.current = purchaseOrderLines.purchaseOrderId;
    setState((current) => ({
      ...current,
      lines: [...purchaseOrderLines.lines, ...current.lines.filter((l) => l.purchaseOrderLineId === '')],
    }));
    setDirty(true);
  }, [purchaseOrderLines, state.source, state.purchaseOrderId]);

  // After a line is added, put the cursor in its first quantity field.
  React.useEffect(() => {
    if (!focusKeyRef.current) return;
    const index = state.lines.findIndex((l) => l.key === focusKeyRef.current);
    focusKeyRef.current = null;
    if (index >= 0) document.getElementById(`receipt-line-${index}-quantityAccepted`)?.focus();
  }, [state.lines]);

  function patch(next: Partial<ReceiptFormState>) {
    setState((current) => ({ ...current, ...next }));
    setDirty(true);
  }

  function patchLine(key: string, change: Partial<ReceiptDraftLine>) {
    setState((current) => ({ ...current, lines: current.lines.map((l) => (l.key === key ? { ...l, ...change } : l)) }));
    setDirty(true);
  }

  function addSku(sku: SkuLookup) {
    const line = lineFromSku(sku, defaultLocation);
    focusKeyRef.current = line.key;
    patch({ lines: [...state.lines, line] });
  }

  async function handleScan(barcode: string): Promise<string | null> {
    const sku = await onScan(barcode);
    if (!sku) return null;
    addSku(sku);
    return `${sku.displayName} — ${sku.skuCode}`;
  }

  function changeSource(source: ReceiptFormState['source']) {
    appliedPoRef.current = '';
    patch({ source, purchaseOrderId: '', consignmentId: '' });
  }

  function chooseOrder(id: string) {
    appliedPoRef.current = '';
    patch({ purchaseOrderId: id });
    if (id) onPurchaseOrderChange(id);
  }

  // OQ-13: another branch has its own orders, consignments and locations, so the order and consignment are
  // un-chosen, the lines that came from an order are dropped and every line's location is cleared.
  function applyBranch(next: string) {
    appliedPoRef.current = '';
    setState((current) => ({
      ...current,
      purchaseOrderId: '',
      consignmentId: '',
      lines: current.lines.filter((l) => l.purchaseOrderLineId === '').map((l) => ({ ...l, locationId: '' })),
    }));
    setDirty(true);
    onBranchChange?.(next);
  }

  function chooseBranch(next: string) {
    if (next === branchId) return;
    const target = branches?.find((b) => b.id === next);
    if (!target) return;
    if (state.lines.length > 0) setSwitchingTo(target);
    else applyBranch(next);
  }

  async function discardDraft() {
    autosave.stop();
    await onDiscardDraft();
  }

  function review(event: React.FormEvent) {
    event.preventDefault();
    const local = validateReceipt(state);
    setErrors(stampRowKeys(local, state.lines.map((l) => l.key)));
    if (local.firstTarget || local.general.length > 0) {
      focusErrorTarget('receipt', local.firstTarget);
      return;
    }
    setConfirming(true);
  }

  async function post() {
    setSubmitting(true);
    autosave.stop();
    try {
      await onPost({
        ...toPostRequest(state),
        ...(showBranchChoice && branchId ? { branchId } : {}),
        draftId,
      });
      setDirty(false);
    } catch (error) {
      setSubmitting(false);
      setConfirming(false);
      const distributed =
        error instanceof ApiValidationError
          ? distributeViolations(error, { knownFields: TOP_FIELDS })
          : { ...EMPTY_ERRORS, general: [describeReceiptError(error)] };
      setErrors(stampRowKeys(distributed, state.lines.map((l) => l.key)));
      // Wait a frame so the closing dialog has returned focus before we move it.
      setTimeout(() => focusErrorTarget('receipt', distributed.firstTarget), 0);
    }
  }

  const locationName = (id: string) => locations?.find((l) => l.id === id)?.name ?? 'the chosen location';
  const lineCount = state.lines.length;
  // "Expected" is what the chosen order still expects on this line: the server's outstanding
  // quantity exactly as it pre-filled the line (never recomputed here).
  const expectedFor = (line: ReceiptDraftLine): string | undefined =>
    line.purchaseOrderLineId === ''
      ? undefined
      : purchaseOrderLines?.lines.find((l) => l.purchaseOrderLineId === line.purchaseOrderLineId)?.quantityAccepted;

  const saveStatus =
    autosave.state === 'saving'
      ? 'Saving draft…'
      : autosave.state === 'error' || autosave.state === 'closed'
        ? (autosave.message ?? '')
        : draftSaved
          ? `Draft saved at ${timeOnlyInZone(draftSaved, timeZoneLabel)} (${timeZoneLabel})`
          : '';

  return (
    <form onSubmit={review} noValidate className="flex flex-col gap-4" onBlurCapture={() => autosave.flush()}>
      <UnsavedChangesGuard when={autosave.hasUnsavedChanges && !submitting} />
      <p
        role="status"
        className={
          autosave.state === 'error' || autosave.state === 'closed'
            ? 'min-h-5 text-sm font-semibold text-danger-ink'
            : 'min-h-5 text-sm text-ink-muted'
        }
      >
        {saveStatus}
      </p>
      <ReceiptErrorSummary errors={errors} />

      <Panel title="Delivery">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {showBranchChoice && (
            <SelectField
              id="receipt-branchId"
              label="Receive into"
              wrapperClassName="sm:col-span-2 lg:col-span-3"
              value={branchId ?? ''}
              hint="Orders, consignments and locations below are this branch's."
              onChange={(e) => chooseBranch(e.target.value)}
            >
              {branches!.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </SelectField>
          )}
          <fieldset className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3">
            <legend id="receipt-source-heading" className="mb-1 text-sm font-semibold text-ink">Receiving</legend>
            {(
              [
                ['purchase-order', 'Against a purchase order'],
                ['consignment', 'Against a consignment (cleared ones only)'],
                ['direct', 'Direct, with no order'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name="receipt-source"
                  value={value}
                  checked={state.source === value}
                  onChange={() => changeSource(value)}
                  className="h-4 w-4 accent-leaf"
                />
                {label}
              </label>
            ))}
          </fieldset>
          {state.source === 'purchase-order' && (
            <SelectField
              id="receipt-purchaseOrderId"
              label="Purchase order"
              required
              value={state.purchaseOrderId}
              error={errors.fields.purchaseOrderId}
              hint="Lines are filled in with what the order still expects."
              onChange={(e) => chooseOrder(e.target.value)}
            >
              <option value="">Choose an issued order</option>
              {purchaseOrders.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.number} · {po.supplierName} · due {formatDateOnly(po.expectedDeliveryOn)}
                </option>
              ))}
            </SelectField>
          )}
          {state.source === 'purchase-order' && chosenOrder && (
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink">Supplier</span>
              <p className="py-2 text-sm text-ink">{chosenOrder.supplierName}</p>
            </div>
          )}
          {state.source === 'consignment' && (
            <SelectField
              id="receipt-consignmentId"
              label="Consignment"
              required
              value={state.consignmentId}
              error={errors.fields.consignmentId}
              onChange={(e) => patch({ consignmentId: e.target.value })}
            >
              <option value="">Choose a cleared consignment</option>
              {consignments.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.reference} · shipment {c.shipmentReference}
                </option>
              ))}
            </SelectField>
          )}
          <TextField
            id="receipt-deliveryReference"
            label="Delivery reference"
            maxLength={60}
            value={state.deliveryReference}
            error={errors.fields.deliveryReference}
            onChange={(e) => patch({ deliveryReference: e.target.value })}
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">Received on</span>
            <p className="py-2 text-sm text-ink">Now ({timeZoneLabel}). The server records the time when you post.</p>
          </div>
          {state.source === 'consignment' && state.consignmentId && (
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--radius-md)] border border-dashed border-leaf bg-leaf-soft px-3 py-3 text-sm text-leaf-ink sm:col-span-2 lg:col-span-3">
              <span>Landed cost and documents belong to the consignment:</span>
              <Link href={`/staff/procurement/consignments/${state.consignmentId}/documents`} className="font-semibold text-leaf-ink underline">
                Documents
              </Link>
              <Link href={`/staff/procurement/consignments/${state.consignmentId}/costs`} className="font-semibold text-leaf-ink underline">
                Costs
              </Link>
            </p>
          )}
        </div>
      </Panel>

      <section aria-labelledby="receipt-add-heading" className="flex flex-col gap-3">
        <h2 id="receipt-add-heading" className="font-display text-lg font-semibold text-ink">Add lines</h2>
        <ScanField id="receipt-scan" onScan={handleScan} className="rounded-xl border-leaf" />
        <SkuPicker id="receipt-sku-picker" label="Or find an item" onSelect={addSku} />
      </section>

      <section aria-labelledby="receipt-lines-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="receipt-lines-heading" className="font-display text-lg font-semibold text-ink">
            Lines ({lineCount})
          </h2>
        </div>
        {lineCount === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-strong bg-surface p-4 text-sm text-ink-muted">
            No lines yet. Scan a barcode, find an item above, or choose a purchase order to fill them in.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {state.lines.map((line, index) => (
              <ReceiptLineCard
                key={line.key}
                line={line}
                index={index}
                errors={errorsForRow(errors, line.key, index)}
                locations={locations}
                expected={expectedFor(line)}
                onChange={(change) => patchLine(line.key, change)}
                onRemove={() => patch({ lines: state.lines.filter((l) => l.key !== line.key) })}
              />
            ))}
          </ol>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <p role="status" aria-live="polite" className={hasErrors(errors) ? 'min-w-0 flex-1 text-sm font-semibold text-danger-ink' : 'min-w-0 flex-1 text-sm text-ink-muted'}>
          {submitting
            ? 'Posting…'
            : hasErrors(errors)
              ? 'Nothing was posted. Fix the highlighted fields, then post again.'
              : 'A posted receipt cannot be edited; corrections are adjustments.'}
        </p>
        <Button variant="secondary" disabled={lineCount === 0 && !dirty && !autosave.savedAt} onClick={() => setDiscarding(true)}>
          Discard draft
        </Button>
        <Button type="submit" disabled={isPosting || submitting || lineCount === 0}>
          Review and post
        </Button>
      </div>

      <ActionDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Post this receipt?"
        consequence={`${lineCount} ${lineCount === 1 ? 'line' : 'lines'} will be received. A posted receipt cannot be edited; corrections are adjustments.`}
        confirmLabel="Post receipt"
        pendingLabel="Posting…"
        onConfirm={post}
      >
        <ul className="mt-3 max-h-60 list-disc overflow-y-auto pl-5 text-sm text-ink">
          {state.lines.map((l) => (
            <li key={l.key}>
              {l.quantityAccepted.trim() === '' ? 'Nothing accepted' : formatQuantity(l.quantityAccepted, l.stockUnit)} of {l.skuLabel}
              {l.lotNumber ? `, lot ${l.lotNumber}` : ''} → {locationName(l.locationId)}
              {l.quantityRejected.trim() !== '' && l.quantityRejected.trim() !== '0' ? `; ${formatQuantity(l.quantityRejected, l.stockUnit)} rejected` : ''}
            </li>
          ))}
        </ul>
      </ActionDialog>
      <ActionDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title="Discard this draft?"
        consequence="The lines you have entered and the draft saved for you are deleted. Nothing has been posted."
        confirmLabel="Discard draft"
        variant="destructive"
        onConfirm={discardDraft}
      />
      <ActionDialog
        open={switchingTo !== null}
        onOpenChange={(open) => !open && setSwitchingTo(null)}
        title={switchingTo ? `Receive into ${switchingTo.name}?` : ''}
        consequence="Locations belong to a branch, so the location on every line is cleared and you choose it again. The order or consignment chosen so far belongs to the other branch, so it is un-chosen and any lines filled in from an order are removed."
        confirmLabel="Change branch"
        onConfirm={async () => {
          if (switchingTo) applyBranch(switchingTo.id);
          setSwitchingTo(null);
        }}
      />
    </form>
  );
}
