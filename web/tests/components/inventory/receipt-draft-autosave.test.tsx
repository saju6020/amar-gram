import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ApiNotFoundError, ApiValidationError } from '@/lib/api/client';
import { saveReceiptDraft, type SaveGoodsReceiptDraftRequest } from '@/lib/api/inventory-receipts';
import { RECEIPT_DRAFT_AUTOSAVE_MS, useReceiptDraftAutosave } from '@/lib/hooks/useInventory';

vi.mock('@/lib/api/inventory-receipts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/inventory-receipts')>()),
  saveReceiptDraft: vi.fn(),
}));

const save = vi.mocked(saveReceiptDraft);

const form = (deliveryReference: string): SaveGoodsReceiptDraftRequest => ({
  branchId: null,
  supplierId: null,
  purchaseOrderId: null,
  consignmentId: null,
  deliveryReference,
  lines: [],
});

function mount(initial: SaveGoodsReceiptDraftRequest | null) {
  return renderHook(
    ({ payload }: { payload: SaveGoodsReceiptDraftRequest | null }) =>
      useReceiptDraftAutosave({ draftId: 'draft-1', payload }),
    { initialProps: { payload: initial } },
  );
}

/** A save the test settles by hand, so the "one request at a time" rule can be watched. */
function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<{ draftId: string; version: number; branchId: string }>((res, rej) => {
    resolve = () => res({ draftId: 'draft-1', version: 1, branchId: 'b' });
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
  save.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('U35 — receipt draft autosave (ADR-FE-190)', () => {
  it('saves ONE whole-form PUT 1.5 s after the last change, not before', async () => {
    save.mockResolvedValue({ draftId: 'draft-1', version: 1, branchId: 'b' });
    const { result, rerender } = mount(null);
    expect(result.current.hasUnsavedChanges).toBe(false);

    rerender({ payload: form('A') });
    expect(result.current.hasUnsavedChanges).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECEIPT_DRAFT_AUTOSAVE_MS - 1);
    });
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('draft-1', form('A'));
    expect(result.current.state).toBe('saved');
    expect(result.current.savedAt).not.toBeNull();
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('a keystroke inside the quiet moment restarts it (still one request)', async () => {
    save.mockResolvedValue({ draftId: 'draft-1', version: 1, branchId: 'b' });
    const { rerender } = mount(null);
    rerender({ payload: form('A') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    rerender({ payload: form('AB') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('draft-1', form('AB'));
  });

  it('never has two requests in flight: a change made meanwhile waits, and only the NEWEST form is sent after', async () => {
    const first = deferred();
    save.mockReturnValueOnce(first.promise).mockResolvedValue({ draftId: 'draft-1', version: 2, branchId: 'b' });
    const { result, rerender } = mount(null);
    rerender({ payload: form('B') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECEIPT_DRAFT_AUTOSAVE_MS);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('saving');

    // Two more changes while the first request is still in flight: neither starts a request.
    rerender({ payload: form('C') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECEIPT_DRAFT_AUTOSAVE_MS);
    });
    rerender({ payload: form('D') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECEIPT_DRAFT_AUTOSAVE_MS);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.hasUnsavedChanges).toBe(true);

    await act(async () => {
      first.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    // The superseded form "C" is never sent; "D" goes straight away.
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('draft-1', form('D'));
    expect(save).not.toHaveBeenCalledWith('draft-1', form('C'));
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('flush() (a field blur) saves at once', async () => {
    save.mockResolvedValue({ draftId: 'draft-1', version: 1, branchId: 'b' });
    const { result, rerender } = mount(null);
    rerender({ payload: form('A') });
    await act(async () => {
      result.current.flush();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('a 404 means the draft was closed elsewhere: autosaving stops for good and says so', async () => {
    save.mockRejectedValue(new ApiNotFoundError());
    const { result, rerender } = mount(null);
    rerender({ payload: form('A') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECEIPT_DRAFT_AUTOSAVE_MS);
    });
    expect(result.current.state).toBe('closed');
    expect(result.current.message).toMatch(/closed somewhere else/i);
    // Nothing more is sent, however much is typed.
    rerender({ payload: form('AB') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECEIPT_DRAFT_AUTOSAVE_MS * 2);
    });
    expect(save).toHaveBeenCalledTimes(1);
    // Nothing is waiting on a save that will never happen, so the unsaved-changes guard lets go.
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('GoodsReceiptDraftLimitReached is shown as plain text, the code is never shown, and the next change tries again', async () => {
    save
      .mockRejectedValueOnce(
        new ApiValidationError({
          isValid: false,
          errors: [{ propertyName: 'DraftId', errorCode: 'GoodsReceiptDraftLimitReached', errorMessage: '', resourceName: 'Inventory' }],
        }),
      )
      .mockResolvedValue({ draftId: 'draft-1', version: 1, branchId: 'b' });
    const { result, rerender } = mount(null);
    rerender({ payload: form('A') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECEIPT_DRAFT_AUTOSAVE_MS);
    });
    expect(result.current.state).toBe('error');
    expect(result.current.message).toBe('You already have 20 open drafts. Post or discard one of them first.');
    expect(result.current.message).not.toContain('GoodsReceiptDraftLimitReached');
    expect(result.current.hasUnsavedChanges).toBe(true);

    rerender({ payload: form('AB') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECEIPT_DRAFT_AUTOSAVE_MS);
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe('saved');
  });

  it('a form nobody touched (payload null) creates no draft', async () => {
    const { result } = mount(null);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECEIPT_DRAFT_AUTOSAVE_MS * 3);
    });
    expect(save).not.toHaveBeenCalled();
    expect(result.current.state).toBe('idle');
  });

  it('a change not yet saved goes out when the screen is left (the unmount flush)', async () => {
    save.mockResolvedValue({ draftId: 'draft-1', version: 1, branchId: 'b' });
    const { rerender, unmount } = mount(null);
    rerender({ payload: form('A') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECEIPT_DRAFT_AUTOSAVE_MS / 2); // still inside the quiet moment
    });
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      unmount();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('draft-1', form('A'));
  });

  it('nothing is sent on leaving when everything was saved, or after stop()', async () => {
    save.mockResolvedValue({ draftId: 'draft-1', version: 1, branchId: 'b' });
    const first = mount(null);
    first.rerender({ payload: form('A') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECEIPT_DRAFT_AUTOSAVE_MS);
    });
    expect(save).toHaveBeenCalledTimes(1);
    first.unmount();
    const second = mount(null);
    second.rerender({ payload: form('B') });
    act(() => second.result.current.stop());
    second.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECEIPT_DRAFT_AUTOSAVE_MS);
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('a change made while a save is in flight is retried when that save FAILS', async () => {
    const first = deferred();
    save.mockReturnValueOnce(first.promise).mockResolvedValue({ draftId: 'draft-1', version: 2, branchId: 'b' });
    const { result, rerender } = mount(null);
    rerender({ payload: form('A') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECEIPT_DRAFT_AUTOSAVE_MS);
    });
    rerender({ payload: form('AB') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECEIPT_DRAFT_AUTOSAVE_MS); // its timer fires while the first is in flight: nothing sent
    });
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
      first.reject(new Error('network'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.state).toBe('error');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECEIPT_DRAFT_AUTOSAVE_MS);
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('draft-1', form('AB'));
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('settle() waits for the save in flight (the one that may CREATE the draft) before a post or discard goes', async () => {
    const creating = deferred();
    save.mockReturnValueOnce(creating.promise);
    const { result, rerender } = mount(null);
    rerender({ payload: form('A') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECEIPT_DRAFT_AUTOSAVE_MS);
    });
    let settled = false;
    act(() => {
      result.current.stop();
      void result.current.settle().then(() => {
        settled = true;
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(settled).toBe(false);
    await act(async () => {
      creating.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(settled).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });
});

