'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * `components/back-office-stock/StockPager.tsx` — HO-P4 S4. The Previous / Next row under the
 * expandable stock list. `DataTable` cannot show a detail row under a table row, so this list
 * pages itself with the same `?page=` URL param and the same "Page N of M · T total" wording
 * (UI-4); the counts are the server's `totalCount`.
 */
export function StockPager({ totalCount, pageSize }: { totalCount: number; pageSize: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

  function go(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (next <= 1) params.delete('page');
    else params.set('page', String(next));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
      <span>{`Page ${page} of ${pageCount} · ${totalCount} total`}</span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => go(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => go(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}
