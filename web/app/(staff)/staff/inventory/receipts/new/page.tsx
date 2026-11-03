'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccessRefusedState } from '@/components/admin/AccessRefusedState';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { GoodsReceiptForm } from '@/components/inventory/GoodsReceiptForm';
import { ReceiptDraftList } from '@/components/inventory/ReceiptDraftList';
import { ActionLink } from '@/components/back-office/ActionLink';
import { PageHeader } from '@/components/back-office/PageHeader';
import { Button } from '@/components/ui/button';
import { linesFromPurchaseOrder, stateFromDraft } from '@/components/inventory/receiptModel';
import { ApiForbiddenError, ApiNotFoundError } from '@/lib/api/client';
import type { SkuLookup } from '@/lib/api/inventory-lookup';
import { useActiveBranchId, useMyBranches } from '@/lib/hooks/useActiveBranch';
import { useAdminBranches } from '@/lib/hooks/useAdminBranches';
import { useBranchTimeZone } from '@/lib/hooks/useBranchTimeZone';
import {
  useDiscardReceiptDraft,
  usePostGoodsReceipt,
  useReceiptDraft,
  useReceiptDrafts,
} from '@/lib/hooks/useInventory';
import { useBarcodeLookup, useLocations, useSkusByCode } from '@/lib/hooks/useInventoryLookup';
import { useConsignments, usePurchaseOrder, usePurchaseOrders } from '@/lib/hooks/useProcurement';
import { isGuid } from '@/lib/validation/guid';

const NEW_RECEIPT_PATH = '/staff/inventory/receipts/new';

interface Workspace {
  id: string;
  /** The draft already exists on the server and the form starts from it. */
  resume: boolean;
}

function freshWorkspace(): Workspace {
  return { id: crypto.randomUUID(), resume: false };
}

/**
 * `/staff/inventory/receipts/new` — US-IMP-04, the goods-receipt screen. A person who cannot read
 * purchase orders cannot receive (every receiver holds `Procurement.View` too), so the server's
 * `403` on the order list is this page's permission check — `AccessRefusedState`, not a UI rule.
 *
 * HO-P5 BG-18 (§8.4): the draft's id is minted once per new form (`crypto.randomUUID()`) and put in the
 * address as `?draft=<id>` after the first autosave, so a reload resumes it. Opening the page with a
 * `?draft=` resumes that draft; without one, "Your drafts" lists the caller's others. "Receive into" works
 * on a branch the caller is assigned to; the orders, consignments and locations are read for it.
 */
function NewReceiptContent() {
  const router = useRouter();
  const params = useSearchParams();
  const initialPo = params.get('purchaseOrderId') ?? '';
  const initialCn = params.get('consignmentId') ?? '';
  const draftParam = params.get('draft') ?? '';
  const [workspace, setWorkspace] = useState<Workspace>(() =>
    isGuid(draftParam) ? { id: draftParam, resume: true } : freshWorkspace(),
  );
  const [receiveInto, setReceiveInto] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  // The workspace whose form has been drawn once: its data is the form's own from then on (see `draftReady`).
  const [drawnFor, setDrawnFor] = useState<string | null>(null);

  const draft = useReceiptDraft(workspace.resume ? workspace.id : null);
  const draftLineCodes = (draft.data?.lines ?? []).map((l) => l.skuCode ?? '').filter(Boolean);
  const draftSkus = useSkusByCode(draftLineCodes);

  const activeBranchId = useActiveBranchId();
  const myBranches = useMyBranches();
  const allBranches = useAdminBranches();
  // The receiving branch belongs to THIS form, fixed when the workspace is created: the branch the caller was in then, or
  // the saved draft's own branch. A later switch in the sidebar changes neither the draft's branch nor the form (only
  // the "Receive into" choice does, through its confirm); the lists keep reading the form's branch with `branchId`.
  const [startBranch, setStartBranch] = useState<string | null>(null);
  useEffect(() => {
    if (!startBranch && !workspace.resume && activeBranchId) setStartBranch(activeBranchId);
  }, [startBranch, workspace.resume, activeBranchId]);
  const branchId =
    receiveInto ??
    (workspace.resume ? draft.data?.branchId : startBranch) ??
    activeBranchId ??
    undefined;
  // Another branch's lists are read with `branchId`; its own (the active one) with no parameter.
  const branchParam = branchId && branchId !== activeBranchId ? branchId : undefined;
  const branches = (myBranches.data?.branchIds ?? []).map((id) => ({
    id,
    name: allBranches.data?.find((b) => b.id === id)?.name ?? id,
  }));

  const [poChoice, setPoChoice] = useState(initialPo);
  const poId = poChoice || draft.data?.purchaseOrderId || '';
  const orders = usePurchaseOrders({ status: 'Issued', pageSize: 100, branchId: branchParam });
  const consignments = useConsignments({ status: 'Cleared', pageSize: 100, branchId: branchParam });
  const locations = useLocations(branchParam);
  const po = usePurchaseOrder(poId || null);
  const skus = useSkusByCode(po.data?.lines.map((l) => l.skuCode) ?? []);
  const lookup = useBarcodeLookup();
  const post = usePostGoodsReceipt();
  const discard = useDiscardReceiptDraft();
  const drafts = useReceiptDrafts();
  const zone = useBranchTimeZone();
  // The orders and locations gate only the FIRST paint. Choosing another branch re-reads them, and the form (with the
  // lines typed so far) must stay mounted while that happens; a draft being opened, though, always waits for itself.
  const firstLoad = !orders.isLoading && !locations.isLoading;
  useEffect(() => {
    if (firstLoad) setBooted(true);
  }, [firstLoad]);
  const resumedLoaded =
    workspace.resume && draft.isFetchedAfterMount && !!draft.data && draftSkus.every((q) => !q.isLoading);
  useEffect(() => {
    if (resumedLoaded) setDrawnFor(workspace.id);
  }, [resumedLoaded, workspace.id]);

  if (orders.error instanceof ApiForbiddenError) return <AccessRefusedState error={orders.error} />;

  function startFresh() {
    setStartBranch(null);
    setWorkspace(freshWorkspace());
    setReceiveInto(null);
    setPoChoice('');
    router.replace(NEW_RECEIPT_PATH, { scroll: false });
  }

  function continueDraft(id: string) {
    setStartBranch(null);
    setWorkspace({ id, resume: true });
    setReceiveInto(null);
    setPoChoice('');
    router.replace(`${NEW_RECEIPT_PATH}?draft=${id}`, { scroll: false });
  }

  // A draft the server no longer has (closed elsewhere, or another person's) is a 404.
  if (workspace.resume && draft.error instanceof ApiNotFoundError) {
    return (
      <EmptyState
        title="That draft is no longer here"
        description="It was posted, discarded or never saved. Start a new receipt, or pick another draft."
        action={<Button onClick={startFresh}>Start a new receipt</Button>}
      />
    );
  }

  const draftLoaded =
    !workspace.resume || (draft.isFetchedAfterMount && !!draft.data && draftSkus.every((q) => !q.isLoading));
  // Once drawn, a draft's form stays mounted: the SKU lookups are keyed by the active branch and reload on a sidebar
  // switch, which must not swap the form (and the text typed in it) for a loading state.
  const draftReady = draftLoaded || drawnFor === workspace.id;
  if ((!booted && !firstLoad) || !draftReady) return <LoadingState rows={5} />;

  const skusByCode: Record<string, SkuLookup | null | undefined> = {};
  po.data?.lines.forEach((l, i) => {
    skusByCode[l.skuCode] = skus[i]?.data;
  });
  const ready = po.data && skus.every((q) => !q.isLoading);
  const draftSkusByCode: Record<string, SkuLookup | null | undefined> = {};
  draftLineCodes.forEach((code, i) => {
    draftSkusByCode[code] = draftSkus[i]?.data;
  });
  const initial =
    workspace.resume && draft.data
      ? stateFromDraft(draft.data, draftSkusByCode)
      : initialPo
        ? { source: 'purchase-order' as const, purchaseOrderId: initialPo }
        : initialCn
          ? { source: 'consignment' as const, consignmentId: initialCn }
          : undefined;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Receive goods"
        description="Scan or pick each item, enter the lot and dates, then post the receipt in one action. Your entries are saved as a draft while you work."
        actions={
          <ActionLink href="/staff/inventory/receipts" variant="outline">
            All receipts
          </ActionLink>
        }
      />
      <ReceiptDraftList
        drafts={(drafts.data ?? []).filter((d) => d.draftId !== workspace.id)}
        timeZoneLabel={zone}
        onContinue={continueDraft}
        onDiscard={(id) => discard.mutateAsync(id)}
      />
      <GoodsReceiptForm
        key={workspace.id}
        draftId={workspace.id}
        branches={branches}
        branchId={branchId}
        onBranchChange={(id) => {
          setReceiveInto(id);
          setPoChoice('');
        }}
        locations={locations.isLoading ? undefined : locations.data}
        purchaseOrders={orders.data?.items ?? []}
        consignments={consignments.data?.items ?? []}
        purchaseOrderLines={ready ? { purchaseOrderId: po.data.id, lines: linesFromPurchaseOrder(po.data, skusByCode) } : null}
        initial={initial}
        initialIsDraft={workspace.resume}
        onPurchaseOrderChange={setPoChoice}
        onScan={lookup}
        isPosting={post.isPending}
        timeZoneLabel={zone}
        onDraftSaved={(id) => router.replace(`${NEW_RECEIPT_PATH}?draft=${id}`, { scroll: false })}
        onDiscardDraft={async () => {
          try {
            await discard.mutateAsync(workspace.id);
          } catch (error) {
            // A draft that was never saved (or is already gone) has nothing to delete.
            if (!(error instanceof ApiNotFoundError)) throw error;
          }
          startFresh();
        }}
        onPost={async (request) => {
          const posted = await post.mutateAsync(request);
          router.push(`/staff/inventory/receipts/${posted.goodsReceiptId}`);
        }}
      />
    </div>
  );
}

export default function NewReceiptPage() {
  return (
    <Suspense fallback={<LoadingState rows={5} />}>
      <NewReceiptContent />
    </Suspense>
  );
}
