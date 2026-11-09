'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { UnsavedChangesGuard } from '@/components/account/UnsavedChangesGuard';
import { PageHeader } from '@/components/back-office/PageHeader';
import { Panel } from '@/components/back-office/Panel';
import { Amount } from '@/components/billing/Amount';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { OrderSummary } from '@/components/orders/OrderSummary';
import { Button } from '@/components/ui/button';
import { ApiValidationError } from '@/lib/api/client';
import { describeBlockingReason, describeOrderingError } from '@/lib/api/errors';
import type { CounterSale, PosSku } from '@/lib/api/pos';
import { formatMoney } from '@/lib/format/money';
import { tenderMethodLabel } from '@/lib/format/orders';
import { useIdempotencyKey } from '@/lib/hooks/useIdempotencyKey';
import { useCompleteCounterSale, useCounterQuote } from '@/lib/hooks/usePos';
import { useStaffCustomer } from '@/lib/hooks/useStaffCustomers';
import { PosBasket } from './PosBasket';
import { PosCustomerPanel } from './PosCustomerPanel';
import { PosReviewDialog } from './PosReviewDialog';
import { PosSaleComplete } from './PosSaleComplete';
import { PosScanField } from './PosScanField';
import { PosTenderPanel } from './PosTenderPanel';
import { basketLineFromSku, type BasketLine, type PosCustomer, type PosTender } from './types';

/**
 * `components/pos/PosScreen.tsx` — ⭐ HO-ORD-002 §11.11, US-ORD-16; HO-P4 S2 (§11.3.6) laid it out as the
 * design's two columns from 1024 px (scan and product tiles | the ticket), stacked below. The counter sale.
 * The basket, the customer, the payments and the scan buffer are **this component's state** (never
 * storage); the totals come from the server's counter quote (debounced 300 ms) and the change from the
 * sale response. Scan returns focus here after each item; `F2` jumps to the payment amount; Enter adds the
 * payment and opens a review whose **Complete sale** is focused. One idempotency key per attempt, kept
 * while the payload is unchanged, so a double Enter or a retry after a lost response records one sale.
 *
 * A walk-in sale needs no customer (HO-P5 BG-8): the ticket's chip reads "Walk-in (no customer) · Add customer" (§11.3.13) and opens the
 * customer fields; name and mobile go together or not at all, and a sale with neither sends neither. The
 * cash typed is put to the quote for the server's change due (BG-7). Nothing here adds up money.
 */
const EMPTY_CUSTOMER: PosCustomer = { name: '', mobile: '', customerId: null };

export function PosScreen() {
  const searchParams = useSearchParams();
  const presetCustomerId = searchParams.get('customerId') ?? '';
  const [lines, setLinesState] = useState<BasketLine[]>([]);
  // The basket is also held in a ref that is updated synchronously, so two scans arriving between renders each
  // see the other's line (a closure over `lines` would make both set the same quantity).
  const linesRef = useRef<BasketLine[]>([]);
  const setLines = (update: BasketLine[] | ((current: BasketLine[]) => BasketLine[])) => {
    const next = typeof update === 'function' ? update(linesRef.current) : update;
    linesRef.current = next;
    setLinesState(next);
  };
  const [customer, setCustomer] = useState<PosCustomer>(EMPTY_CUSTOMER);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [tenders, setTenders] = useState<PosTender[]>([]);
  const [discountCode, setDiscountCode] = useState('');
  // The cash typed in the tender panel, put to the quote for the server's change due (HO-P5 BG-7, ADR-FE-191).
  const [cashTyped, setCashTyped] = useState<string | undefined>();
  const [sale, setSale] = useState<CounterSale | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [rootError, setRootError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; mobile?: string }>({});
  const scanRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const key = useIdempotencyKey();
  const complete = useCompleteCounterSale();

  const router = useRouter();
  // The profile's "New order" link presets the buyer once PER MOUNT (the two real links are on other pages, so a later
  // link always mounts this screen afresh). The id is taken into state and out of the address at once (replace, so no
  // history entry keeps it, and before any basket exists for the unsaved-changes guard to trap the old address). Any
  // later customerId parameter on the same mount (Back through the guard's sentinel, say) only has its address cleaned: it
  // never presets again. Client state survives a replace to the same route.
  const [presetId, setPresetId] = useState('');
  const [presetLink, setPresetLink] = useState(0);
  const appliedLink = useRef(0);
  const presetTaken = useRef(false);
  useEffect(() => {
    if (presetCustomerId === '') return;
    if (!presetTaken.current) {
      presetTaken.current = true;
      setPresetId(presetCustomerId);
      setPresetLink(1);
    }
    router.replace('/staff/pos');
  }, [presetCustomerId, router]);
  const preset = useStaffCustomer(presetId);
  const [presetNoticeHidden, setPresetNoticeHidden] = useState(false);
  useEffect(() => {
    // A lookup that failed on first load is final for this link: a later successful refetch must not attach the customer.
    if (preset.isLoadingError && presetLink !== 0) appliedLink.current = presetLink;
    if (!preset.data || presetLink === 0 || appliedLink.current === presetLink) return;
    appliedLink.current = presetLink;
    setCustomer((current) =>
      !current.customerId && current.name === '' && current.mobile === ''
        ? { name: preset.data.fullName, mobile: preset.data.mobileNumber ?? '', customerId: preset.data.id }
        : current,
    );
  }, [preset.data, preset.isLoadingError, presetLink]);

  const quoteLines = lines.map((l) => ({ skuId: l.skuId, quantity: l.quantity }));
  const quote = useCounterQuote({
    customerId: customer.customerId ?? undefined,
    lines: quoteLines,
    discountCode: discountCode.trim() || undefined,
    tenderedCash: cashTyped,
  });
  const currency = quote.data?.currencyCode ?? 'BDT';

  // Settled = the quote on screen is for the basket on screen (not the debounce window, not a refetch in flight,
  // not the previous basket's quote kept as placeholder data).
  const settled = !quote.isSettling && !quote.isFetching && !quote.isPlaceholderData;
  // The change preview is the quote's answer for the cash typed: shown only while the quote on screen is for it.
  // (Amended (ab)) Once a payment has been added the quote's one-tender answer would mislead on a split payment, so it is hidden.
  const previewSettled = !quote.isSettling && !quote.isPlaceholderData && cashTyped !== undefined && tenders.length === 0;
  const preview =
    previewSettled && quote.data?.changeDue
      ? ({ kind: 'change', money: quote.data.changeDue } as const)
      : previewSettled && quote.data?.cashShort
        ? ({ kind: 'short', money: quote.data.cashShort } as const)
        : null;
  // HO-P5 BG-8: the buyer's name and mobile are given together or not at all; neither is an anonymous walk-in sale.
  const customerPartial = (customer.name.trim() === '') !== (customer.mobile.trim() === '');
  const customerGiven = customer.name.trim() !== '' && customer.mobile.trim() !== '';
  const ready = lines.length > 0 && tenders.length > 0 && !!quote.data?.canSell && settled && !customerPartial;
  // Enter in the amount field adds the payment and asks for the review. The payment lands in state a render
  // later, so the request waits here until the quote has settled, then opens the review only if the sale is ready.
  const [reviewRequested, setReviewRequested] = useState(false);
  useEffect(() => {
    if (!reviewRequested || !settled) return;
    setReviewRequested(false);
    if (ready) setReviewOpen(true);
    // Only one of the buyer's name and mobile is filled in: show the fields so the missing part is in front of the cashier.
    else if (customerPartial) setCustomerOpen(true);
  }, [reviewRequested, settled, ready, customerPartial]);

  function addSku(sku: PosSku): string {
    const existing = linesRef.current.find((l) => l.skuId === sku.skuId);
    const name = `${sku.productName} ${sku.variantLabel}`.trim();
    const quantity = existing ? existing.quantity + 1 : 1;
    setLines((cur) => (existing ? cur.map((l) => (l.skuId === sku.skuId ? { ...l, quantity } : l)) : [...cur, basketLineFromSku(sku)]));
    scanRef.current?.focus();
    return `Added ${name}, quantity ${quantity}`;
  }

  function payload() {
    return {
      // Neither name nor mobile for a walk-in sale: the request then carries neither (BG-8).
      customerName: customerGiven ? customer.name.trim() : undefined,
      customerMobile: customerGiven ? customer.mobile.trim() : undefined,
      lines: quoteLines,
      discountCode: discountCode.trim() || undefined,
      tenders: tenders.map((t) => ({ method: t.method, amount: t.amount, reference: t.reference || undefined })),
    };
  }

  async function send() {
    setRootError(null);
    setFieldErrors({});
    const request = payload();
    try {
      const result = await complete.mutateAsync({ sale: request, idempotencyKey: key.keyFor(JSON.stringify(request)) });
      key.renew();
      setReviewOpen(false);
      setSale(result);
    } catch (error) {
      // A definitive refusal ends this key: the API replays it for an unchanged body. In-progress / network keep it.
      key.settleFailure(error);
      setReviewOpen(false);
      const perField: { name?: string; mobile?: string } = {};
      const other: string[] = [];
      if (error instanceof ApiValidationError) {
        for (const v of error.response.errors) {
          if (/customername/i.test(v.propertyName)) perField.name = v.errorMessage;
          else if (/customermobile/i.test(v.propertyName) && v.errorCode !== 'AccountNotActive') perField.mobile = v.errorMessage;
          else other.push(v.errorMessage);
        }
      }
      setFieldErrors(perField);
      if (Object.keys(perField).length > 0) setCustomerOpen(true);
      setRootError(other.length > 0 ? other.join(' ') : Object.keys(perField).length > 0 ? 'Check the customer’s details.' : describeOrderingError(error));
    }
  }

  function reset() {
    // A lookup still in flight must not attach its customer to the sale that starts now.
    appliedLink.current = presetLink;
    setPresetNoticeHidden(true);
    setLines([]);
    setCustomer(EMPTY_CUSTOMER);
    setCustomerOpen(false);
    setTenders([]);
    setDiscountCode('');
    setSale(null);
    setRootError(null);
    setFieldErrors({});
    setCashTyped(undefined);
    key.renew();
    setTimeout(() => scanRef.current?.focus(), 0);
  }

  // The name is customer free text: isolate it (<bdi>) so a bidi/format character in it cannot reorder the amounts around it.
  const buyerText = customerGiven ? (
    <>
      Buyer: <bdi>{customer.name.trim()}</bdi> (<bdi>{customer.mobile.trim()}</bdi>).
    </>
  ) : (
    'No customer (walk-in sale).'
  );
  const reviewText = quote.data ? (
    <>
      {buyerText} Total {formatMoney(quote.data.totals.grandTotal)}. Payments:{' '}
      {tenders.map((t) => `${tenderMethodLabel(t.method)} ${formatMoney({ amount: t.amount, currencyCode: currency })}`).join(', ')}.
    </>
  ) : (
    ''
  );

  if (sale) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Counter sale" />
        <PosSaleComplete sale={sale} onNewSale={reset} />
      </div>
    );
  }

  const customerLabel =
    customer.name.trim() !== '' || customer.mobile.trim() !== ''
      ? [customer.name.trim(), customer.mobile.trim()].filter(Boolean).join(' · ')
      : 'Walk-in (no customer) · Add customer';

  return (
    <div
      className="flex flex-col gap-5"
      onKeyDown={(event) => {
        if (event.key === 'F2') {
          event.preventDefault();
          amountRef.current?.focus();
        }
      }}
    >
      <UnsavedChangesGuard when={lines.length > 0} />
      {preset.isLoadingError && !presetNoticeHidden && !customerGiven && (
        <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-bg p-3 text-sm font-semibold text-danger-ink">
          We couldn’t attach that customer to this sale. It is a walk-in sale; enter the customer here if you need them.
        </p>
      )}
      <PageHeader
        title="Counter sale"
        description="Scan items, take payment, print the receipt."
        actions={
          <Button variant="secondary" disabled={lines.length === 0} onClick={() => setVoidOpen(true)}>
            Void basket
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <div className="min-w-0">
          <PosScanField inputRef={scanRef} onAdd={addSku} />
        </div>
        <Panel
          title="Ticket"
          actions={
            <button
              type="button"
              aria-expanded={customerOpen}
              aria-controls="pos-customer"
              onClick={() => setCustomerOpen((open) => !open)}
              className="min-h-9 max-w-full rounded-full border border-dashed border-ink-muted px-3 text-[13px] text-ink-muted [overflow-wrap:anywhere] hover:bg-surface-sunken"
            >
              {customerLabel}
            </button>
          }
        >
          <div className="flex flex-col gap-4">
            <div id="pos-customer">
              {customerOpen && <PosCustomerPanel customer={customer} onChange={setCustomer} errors={fieldErrors} />}
            </div>
            <PosBasket
              lines={lines}
              quote={quote.data}
              onQuantity={(skuId, quantity) => setLines((cur) => cur.map((l) => (l.skuId === skuId ? { ...l, quantity } : l)))}
              onRemove={(skuId) => setLines((cur) => cur.filter((l) => l.skuId !== skuId))}
            />
            {quote.data && quote.data.blockingReasons.length > 0 && (
              <ul aria-label="Why this sale can’t be completed" className="m-0 list-none rounded-[var(--radius-sm)] bg-danger-bg p-3 text-sm font-semibold text-danger-ink">
                {quote.data.blockingReasons.map((code) => (
                  <li key={code}>{describeBlockingReason(code)}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-1">
              <label htmlFor="pos-discount" className="text-[13px] font-semibold text-ink-muted">Discount code (optional)</label>
              <input id="pos-discount" value={discountCode} onChange={(e) => setDiscountCode(e.target.value.toUpperCase())} maxLength={40} className="w-full rounded-[var(--radius-md)] border border-border-strong bg-surface px-3 py-2 text-sm text-ink" />
            </div>
            <section aria-label="Sale total" className="border-t-2 border-ink pt-3">
              {quote.data ? (
                <dl className="m-0 flex items-baseline justify-between gap-3">
                  <dt className="font-bold text-ink">Total</dt>
                  <dd className="m-0 font-display text-[30px] font-bold leading-tight text-ink">
                    <Amount money={quote.data.totals.grandTotal} />
                  </dd>
                </dl>
              ) : (
                <p className="text-sm text-ink-muted">{lines.length === 0 ? 'Totals appear when you scan an item.' : 'Working out the total…'}</p>
              )}
            </section>
            {quote.data && (
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold text-ink-muted">Price breakdown</summary>
                <div className="mt-2">
                  <OrderSummary totals={quote.data.totals} fulfilment="Counter" heading="Price breakdown" discountCode={discountCode.trim().toUpperCase() || null} />
                </div>
              </details>
            )}
            <PosTenderPanel
              ref={amountRef}
              tenders={tenders}
              currencyCode={currency}
              exactAmount={quote.data?.totals.grandTotal.amount ?? null}
              disabled={lines.length === 0}
              onAdd={(t) => setTenders((cur) => [...cur, { ...t, id: crypto.randomUUID() }])}
              onRemove={(id) => setTenders((cur) => cur.filter((t) => t.id !== id))}
              onReview={() => setReviewRequested(true)}
              onCashAmountChange={setCashTyped}
              preview={preview}
            />
            {rootError && <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-bg p-3 text-sm font-semibold text-danger-ink">{rootError}</p>}
            <Button className="h-14 w-full rounded-xl text-[17px]" disabled={!ready || complete.isPending} onClick={() => setReviewOpen(true)}>
              Complete sale
            </Button>
            {!ready && lines.length > 0 && (
              <p className="text-sm text-ink-muted">
                {customerPartial ? 'Enter both the name and the mobile number, or neither. ' : ''}
                {tenders.length === 0 ? 'Add a payment.' : ''}
              </p>
            )}
          </div>
        </Panel>
      </div>
      <PosReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} summary={reviewText} pending={complete.isPending} onConfirm={() => void send()} />
      <ConfirmDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title="Void this basket"
        consequence={`All ${lines.length} item${lines.length === 1 ? '' : 's'} are removed and the payments entered are cleared. Nothing is recorded.`}
        confirmLabel="Void basket"
        variant="destructive"
        onConfirm={() => { reset(); setVoidOpen(false); }}
      />
    </div>
  );
}
