import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScheduleChangeDialog } from '@/components/admin/ScheduleChangeDialog';
import { ApiValidationError } from '@/lib/api/client';

/** HO-P5 S3 (Amended (ak)): the shared dialog's OPTIONAL extra-field slot. Its existing callers are covered by
 *  tests/components/admin/schedule-change-dialog.test.tsx, which is unchanged. */
const slot = {
  errorProperty: 'CompareAtAmount',
  validate: (text: string) => (/^\d+$/.test(text) ? null : 'Digits only.'),
  render: ({ value, onChange, error }: { value: string; onChange: (v: string) => void; error: string | null }) => (
    <div>
      <label htmlFor="extra">Extra</label>
      <input id="extra" value={value} onChange={(e) => onChange(e.target.value)} />
      {error && <p role="alert">{error}</p>}
    </div>
  ),
};

function open(onSchedule: (v: string, iso: string, extra?: string) => Promise<unknown>, withSlot = true) {
  render(
    <ScheduleChangeDialog
      open
      onOpenChange={() => {}}
      title="Schedule"
      valueLabel="Amount"
      onSchedule={onSchedule}
      extraField={withSlot ? slot : undefined}
    />,
  );
}

describe('ScheduleChangeDialog extraField slot', () => {
  it('passes the typed text as a third argument, and nothing when left blank', async () => {
    const user = userEvent.setup();
    const onSchedule = vi.fn().mockResolvedValue(undefined);
    open(onSchedule);
    await user.type(screen.getByLabelText('Amount'), '10');
    await user.type(screen.getByLabelText('Extra'), '20');
    await user.click(screen.getByRole('button', { name: /^schedule$/i }));
    await waitFor(() => expect(onSchedule).toHaveBeenCalledTimes(1));
    expect(onSchedule.mock.calls[0]![0]).toBe('10');
    expect(onSchedule.mock.calls[0]![2]).toBe('20');
  });

  it('refuses a bad extra value before any request, and puts a server error on its property under the field', async () => {
    const user = userEvent.setup();
    const onSchedule = vi.fn().mockRejectedValue(
      new ApiValidationError({
        isValid: false,
        errors: [{ propertyName: 'CompareAtAmount', errorCode: 'X', errorMessage: 'Too low.', resourceName: 'SkuPrice' }],
      }),
    );
    open(onSchedule);
    await user.type(screen.getByLabelText('Amount'), '10');
    await user.type(screen.getByLabelText('Extra'), 'abc');
    await user.click(screen.getByRole('button', { name: /^schedule$/i }));
    expect(await screen.findByText('Digits only.')).toBeInTheDocument();
    expect(onSchedule).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText('Extra'));
    await user.type(screen.getByLabelText('Extra'), '5');
    await user.click(screen.getByRole('button', { name: /^schedule$/i }));
    expect(await screen.findByText('Too low.')).toBeInTheDocument();
  });

  it('without the slot nothing is drawn and onSchedule gets exactly two arguments', async () => {
    const user = userEvent.setup();
    const onSchedule = vi.fn().mockResolvedValue(undefined);
    open(onSchedule, false);
    expect(screen.queryByLabelText('Extra')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Amount'), '10');
    await user.click(screen.getByRole('button', { name: /^schedule$/i }));
    await waitFor(() => expect(onSchedule).toHaveBeenCalledTimes(1));
    expect(onSchedule.mock.calls[0]).toHaveLength(2);
  });
});
