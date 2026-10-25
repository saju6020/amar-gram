'use client';

import { usePathname } from 'next/navigation';
import { PillTabs } from '@/components/back-office/PillTabs';

const ITEMS = [
  { key: 'products', label: 'Products', href: '/staff/shop/products' },
  { key: 'origins', label: 'Origins', href: '/staff/shop/origins' },
  { key: 'reviews', label: 'Reviews', href: '/staff/shop/reviews' },
];

/** `/staff/shop/**` — the shop section nav (HO-SHP-002 §8.1; HO-P4 §11.4.1 pill tabs). The staff guard is the parent layout's. */
export default function StaffShopLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return (
    <div className="flex flex-col gap-6">
      <PillTabs label="Shop" mode="link" items={ITEMS} value={current?.key} />
      <div>{children}</div>
    </div>
  );
}
