import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

/** A trigger + ConfirmDialog pair, the shape every real caller uses (open state lives with the
 *  caller — the scaffold handover §8.4, "ephemeral UI... useState, local to the component"). */
function Harness({ onConfirm }: { onConfirm: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Archive product
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Archive Organic rice 5 kg"
        consequence="Stock alerts stop, the product is hidden from the shop, and the record is kept."
        onConfirm={onConfirm}
      />
    </div>
  );
}

describe('ConfirmDialog', () => {
  it('requires an explicit consequence to be stated, not a generic "Are you sure?"', async () => {
    render(<Harness onConfirm={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Archive product' }));

    expect(
      screen.getByText(
        'Stock alerts stop, the product is hidden from the shop, and the record is kept.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
  });

  it('Escape closes the dialog and returns focus to its trigger', async () => {
    render(<Harness onConfirm={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Archive product' });
    await userEvent.click(trigger);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('calls onConfirm only when the confirm button is clicked, never on open', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Archive product' }));

    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
  });

  it('cancel closes without confirming', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Archive product' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
