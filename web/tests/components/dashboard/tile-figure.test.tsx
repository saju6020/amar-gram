import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TileFigure } from '@/components/dashboard/TileFigure';

const NO_BREAK_SPACE = String.fromCharCode(0xa0);

describe('TileFigure line breaks', () => {
  it('binds a unit to its number with a non-breaking space and still offers a break after each thousands comma', () => {
    const { container } = render(
      <dl>
        <TileFigure
          figure={{ key: 'k', label: 'Handling time', value: 1234567, type: 'Integer', unit: 'h' }}
          timeZoneId="Asia/Dhaka"
        />
      </dl>,
    );
    const figure = container.querySelector('dd > span')!;
    expect(figure.textContent).toBe(`1,234,567${NO_BREAK_SPACE}h`);
    expect(figure.querySelectorAll('wbr')).toHaveLength(2);
    // The accessible text is unchanged for a reader (and for getByText, which folds the space).
    expect(screen.getByText('1,234,567 h')).toBeInTheDocument();
  });

  it('lets a long figure with no break opportunity break anywhere instead of overflowing its tile', () => {
    const { container } = render(
      <dl>
        <TileFigure
          figure={{ key: 'k', label: 'Reference', value: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', type: 'Text' }}
          timeZoneId="Asia/Dhaka"
        />
      </dl>,
    );
    expect(container.querySelector('dd > span')!.className).toContain('[overflow-wrap:anywhere]');
  });

  it('adds no non-breaking space to a figure that is not recorded', () => {
    const { container } = render(
      <dl>
        <TileFigure
          figure={{ key: 'k', label: 'Since', value: null, type: 'Integer', unit: 'h' }}
          timeZoneId="Asia/Dhaka"
        />
      </dl>,
    );
    expect(container.querySelector('dd')!.textContent).toContain('Not recorded');
    expect(container.querySelector('dd > span')!.textContent).not.toContain(NO_BREAK_SPACE);
  });
});
