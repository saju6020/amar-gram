import Link from 'next/link';

export interface FooterLink {
  label: string;
  href: string;
}

/**
 * Placeholder contact details (owner, 2026-10-25, HO-P3 OQ-3). The owner will replace both values; they
 * live here, in one place, until the shop's real contact settings exist.
 */
export const FOOTER_CONTACT = {
  phoneDisplay: '+880 1711-000100',
  phoneHref: 'tel:+8801711000100',
  email: 'hello@amargram.example',
} as const;

const SHOP_LINKS: FooterLink[] = [
  { label: 'All products', href: '/shop/products' },
  { label: 'Shop by country', href: '/shop/countries' },
];

const LINK_CLASS =
  'inline-flex min-h-11 items-center text-border no-underline hover:text-surface-page hover:underline';

function FooterColumn({
  title,
  label,
  children,
}: {
  title: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <nav aria-label={label} className="flex flex-col">
      <strong className="mb-1 text-surface-page">{title}</strong>
      {children}
    </nav>
  );
}

/**
 * HO-SHP-002 §11.1 `ShopFooter`, restyled for HO-P3 (§8.3): an ink band with the brand line and the
 * Shop, Help and Contact columns. Help links are the published policy and help pages (HO-ADM-002),
 * passed in by the layout.
 */
export function ShopFooter({ links }: { links: FooterLink[] }) {
  return (
    <footer className="mt-16 bg-ink px-4 py-10 text-sm text-border md:px-8">
      <div className="mx-auto grid max-w-[1224px] gap-8 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-2">
          <p className="m-0 font-display text-2xl font-bold text-surface-page">
            Amar <span className="text-warm">Gram</span>
          </p>
          <p className="m-0 max-w-xs">
            Organic and everyday goods, bought from the families who grow them and sent from the
            village to your door.
          </p>
        </div>
        <FooterColumn title="Shop" label="Shop links">
          {SHOP_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={LINK_CLASS}>
              {link.label}
            </Link>
          ))}
        </FooterColumn>
        {links.length > 0 && (
          <FooterColumn title="Help" label="Help and policies">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={LINK_CLASS}>
                {link.label}
              </Link>
            ))}
          </FooterColumn>
        )}
        <FooterColumn title="Contact" label="Contact us">
          <a href={FOOTER_CONTACT.phoneHref} className={LINK_CLASS}>
            {FOOTER_CONTACT.phoneDisplay}
          </a>
          <a href={`mailto:${FOOTER_CONTACT.email}`} className={LINK_CLASS}>
            {FOOTER_CONTACT.email}
          </a>
        </FooterColumn>
      </div>
      <p className="mx-auto mt-8 max-w-[1224px] border-t border-ink-muted pt-4 text-xs">
        © Amar Gram
      </p>
    </footer>
  );
}
