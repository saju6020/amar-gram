'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { bannerWarnClass } from '@/components/hearth/card';
import type { SubscriptionView } from '@/lib/api/subscriptions';
import { SKIP_LINK_STALE, skipInsteadLabel } from '@/lib/subscriptions/copy';
import { cn } from '@/lib/utils';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The reminder's skip link `?skip=yyyy-MM-dd` (HO-P6 §11.2.7, ADR-FE-111, US-SUB-03). It **never acts on load**: once the
 * detail has loaded it is read once and removed from the address (`router.replace`). A date equal to the server's
 * `skippableCycleOn` opens the skip confirmation for it; any other date is explained ("That delivery can no longer be
 * skipped.") with, when the server names one, a button to skip that delivery instead. A malformed value is ignored and
 * removed. Comparing the two dates is an equality check on the server's field, not schedule logic.
 */
export function SkipLinkHandler({
  subscription,
  onSkip,
}: {
  subscription: SubscriptionView;
  onSkip: (cycleOn: string) => void;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const handled = useRef(false);
  const [stale, setStale] = useState(false);
  const raw = params.get('skip');

  useEffect(() => {
    if (handled.current || raw === null) return;
    handled.current = true;
    if (DATE_ONLY.test(raw)) {
      if (raw === subscription.skippableCycleOn) onSkip(raw);
      else setStale(true);
    }
    router.replace(pathname, { scroll: false });
  }, [raw, subscription.skippableCycleOn, onSkip, pathname, router]);

  if (!stale) return null;
  return (
    <div role="status" className={cn(bannerWarnClass, 'flex-wrap items-center')}>
      <p className="m-0 font-semibold">{SKIP_LINK_STALE}</p>
      {subscription.skippableCycleOn && (
        <Button
          variant="pillSecondary"
          size="pillMd"
          onClick={() => {
            setStale(false);
            onSkip(subscription.skippableCycleOn!);
          }}
        >
          {skipInsteadLabel(subscription.skippableCycleOn)}
        </Button>
      )}
    </div>
  );
}
