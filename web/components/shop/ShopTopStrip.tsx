import Link from 'next/link';
import { isSafeLink } from '@/lib/shop/helpers';
import type { StorefrontBanner } from '@/lib/api/shop-catalogue';

/**
 * HO-P3 §8.3 `ShopTopStrip` (ADR-FE-176): the banana-leaf strip above the header. It carries the first
 * `Shop` banner's title as plain text (a link when the banner has a safe `linkUrl`) and is not rendered
 * at all when there is no banner (G5: there is no public delivery promise to show instead).
 * `BannerStrip` shows the remaining banners.
 */
export function ShopTopStrip({ banner }: { banner: StorefrontBanner | null | undefined }) {
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
