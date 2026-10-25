/**
 * HO-SHP-002 §11.2 — "42 products for "salmon"", announced politely after each change. The element
 * stays mounted while the server re-renders the page, so the text change is what a screen reader
 * hears (UI-6). In the heading band (`inBand`, Catalogue.dc.html) it is the bold leaf-ink count on
 * the right and does not repeat the search, which the page's heading already states.
 */
export function ResultSummary({
  totalCount,
  q,
  inBand = false,
}: {
  totalCount: number;
  q: string;
  inBand?: boolean;
}) {
  const noun = totalCount === 1 ? 'product' : 'products';
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={inBand ? 'm-0 text-[15px] font-semibold text-leaf-ink' : 'text-sm text-ink-muted'}
    >
      {totalCount} {noun}
      {q && !inBand ? <> for &ldquo;{q}&rdquo;</> : null}
    </p>
  );
}
