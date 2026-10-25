import type { ReactNode } from 'react';

/**
 * HO-P4 §11.1 — the scroll region for a one-off wide table (the same pattern `DataTable` uses).
 * The region itself is focusable and named, so a keyboard user can reach content past the edge
 * (WCAG 2.1.1). `minWidth` (px) keeps the table from squashing before the region starts to scroll.
 */
export function TableFrame({
  label,
  minWidth,
  children,
}: {
  label: string;
  minWidth?: number;
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="w-full overflow-x-auto rounded-2xl border border-border bg-surface"
    >
      <div style={minWidth ? { minWidth } : undefined}>{children}</div>
    </div>
  );
}
