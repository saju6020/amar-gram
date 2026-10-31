import Link from 'next/link';
import { formatMoney } from '@/lib/format/money';
import { isSafeLink } from '@/lib/shop/helpers';
import type { DeliveryPromise, StorefrontBanner } from '@/lib/api/shop-catalogue';

/**
 * True when the public delivery promise takes the strip: it carries a free-delivery threshold
 * (HO-P5 ADR-FE-187, OQ-1). The layout uses this to decide which banners go to `BannerStrip`.
 */
export function promiseTakesStrip(
  promise: DeliveryPromise | null | undefined,
): promise is DeliveryPromise & { freeOver: NonNullable<DeliveryPromise['freeOver']> } {
  return !!promise?.freeOver;
}

/**
 * HO-P3 §8.3 `ShopTopStrip` (ADR-FE-176), wired to the delivery promise by HO-P5 (ADR-FE-187): the
 * banana-leaf strip above the header. When the server's promise has a free-delivery threshold the strip
 * states it as plain text, "Free delivery over ৳X · Cash on delivery across Bangladesh" (no place name,
 * OQ-2); the amount is the server's string through `formatMoney`, nothing is computed. Otherwise it
 * carries the first `Shop` banner's title as plain text (a link when the banner has a safe `linkUrl`),
 * and is not rendered at all when there is no banner. `BannerStrip` shows the other banners.
 */
export function ShopTopStrip({
  promise,
  banner,
}: {
  promise?: DeliveryPromise | null;
  banner?: StorefrontBanner | null;
}) {
  if (promiseTakesStrip(promise)) {
    return (
      <div data-testid="shop-top-strip" className="bg-leaf px-4 text-center text-sm text-leaf-soft">
        <p className="m-0 py-2">
          Free delivery over {formatMoney(promise.freeOver)} · Cash on delivery across Bangladesh
        </p>
      </div>
    );
  }
  if (!banner) return null;
  return (
    <div data-testid="shop-top-strip" className="bg-leaf px-4 text-center text-sm text-leaf-soft">
      {isSafeLink(banner.linkUrl) ? (
        <Link
          href={banner.linkUrl}
          className="inline-flex min-h-11 items-center text-leaf-soft underline underline-offset-2"
        >
          {banner.title}
        </Link>
      ) : (
        <p className="m-0 py-2">{banner.title}</p>
      )}
    </div>
  );
}
