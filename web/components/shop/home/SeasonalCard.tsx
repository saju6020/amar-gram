import Link from 'next/link';
import { isSafeLink, plainExcerpt } from '@/lib/shop/helpers';
import type { StorefrontBanner } from '@/lib/api/shop-catalogue';

/**
 * The phone home's seasonal card (HomePhone.dc.html): the first `Home` banner on a leaf-soft card,
 * only when the shop has one. Phone only; from `md` the same banner is the hero. A card with no
 * safe link is plain text, not a dead link.
 */
export function SeasonalCard({ banner }: { banner: StorefrontBanner | null }) {
  if (!banner) return null;
  const title = plainExcerpt(banner.title, 80);
  if (!title) return null;
  const body = plainExcerpt(banner.body, 90);
  const href = isSafeLink(banner.linkUrl) ? banner.linkUrl : null;
  const className =
    'flex flex-col gap-1 rounded-3xl bg-leaf-soft p-[18px] text-ink no-underline md:hidden';
  const content = (
    <>
      <strong className="font-display text-[22px] leading-[1.15]">{title}</strong>
      {body && <span className="text-[13px] text-leaf-ink">{body}</span>}
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
