import { ProductPackArt } from '@/components/hearth/ProductPackArt';
import { resolveFileUrl } from '@/lib/api/files';
import { cn } from '@/lib/utils';

/**
 * A subscription's product picture: the catalogue image when the server sends one, else the tinted pack placeholder.
 * Decorative (the product name is always written beside it).
 */
export function ProductThumb({
  imageUrl,
  className,
}: {
  imageUrl: string | null;
  className?: string;
}) {
  const src = resolveFileUrl(imageUrl);
  return (
    <span
      aria-hidden="true"
      className={cn('block size-16 flex-none overflow-hidden rounded-2xl', className)}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a signed API file URL, not a build-time asset
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <ProductPackArt tone="warm" className="size-full rounded-2xl" />
      )}
    </span>
  );
}
