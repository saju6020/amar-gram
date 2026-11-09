import { BannerStrip } from '@/components/shop/BannerStrip';
import { LanguageSwitcher } from '@/components/shop/LanguageSwitcher';
import { MobileTabBar } from '@/components/shop/MobileTabBar';
import { ShopFooter } from '@/components/shop/ShopFooter';
import { ShopHeader } from '@/components/shop/ShopHeader';
import { promiseTakesStrip, ShopTopStrip } from '@/components/shop/ShopTopStrip';
import {
  getBannersServer,
  getCategoriesServer,
  getDeliveryPromiseServer,
  getLocalesServer,
  getSystemStatusServer,
} from '@/lib/api/shop-catalogue';
import { settle } from '@/lib/shop/helpers';
import { MaintenanceGate } from './_components/MaintenanceGate';
import { ShopAccountLinks } from './_components/ShopAccountLinks';

// Policy and help pages published through HO-ADM-002 (there is no list endpoint to enumerate them).
const FOOTER_LINKS = [
  { label: 'FAQs', href: '/faqs' },
  { label: 'Terms', href: '/policies/terms' },
];

/**
 * `(shop)` — HO-SHP-002 §8.1, ADR-FE-029, restyled for HO-P3 (ADR-FE-176): the PUBLIC storefront group. Its own shell
 * (the leaf top strip carrying the delivery promise, else the first `Shop` banner; header with search and categories, the other banners,
 * maintenance gate, footer, and the phone tab bar below `md`), no session guard — a guest browses
 * freely — and the warm customer layer (`data-theme="customer"`) like the portal. Server
 * Component: the shell's data comes from public endpoints through `getPublic` (ADR-FE-030). Every
 * optional read degrades quietly (no nav / no banners) rather than failing the page.
 */
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [status, categories, locales, banners, promise] = await Promise.all([
    settle(getSystemStatusServer()),
    settle(getCategoriesServer()),
    settle(getLocalesServer()),
    settle(getBannersServer('Shop')),
    settle(getDeliveryPromiseServer()),
  ]);

  const initialStatus = status.ok ? status.value : { maintenanceMode: false, message: null };
  const showLanguages = locales.ok && locales.value.locales.length > 1;
  // HO-P5 ADR-FE-187: the delivery promise takes the strip when it has a free-delivery threshold, and
  // then every `Shop` banner shows below the header. A failed or empty promise read is "no promise":
  // the first banner is the strip's text and the rest show below (HO-P3 behaviour).
  const deliveryPromise = promise.ok ? promise.value : null;
  const allBanners = banners.ok ? banners.value : [];
  const [stripBanner, ...restBanners] = allBanners;
  const otherBanners = promiseTakesStrip(deliveryPromise) ? allBanners : restBanners;

  return (
    <div data-theme="customer" className="flex min-h-screen flex-col bg-surface-page">
      <ShopTopStrip promise={deliveryPromise} banner={stripBanner} />
      <ShopHeader
        categories={categories.ok ? categories.value : []}
        accountSlot={<ShopAccountLinks />}
        languageSlot={
          showLanguages && locales.ok ? (
            <LanguageSwitcher
              defaultLocale={locales.value.defaultLocale}
              locales={locales.value.locales}
            />
          ) : null
        }
      />
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1224px] flex-1 px-4 py-6 md:px-8 md:pb-16"
      >
        <MaintenanceGate initial={initialStatus}>
          {otherBanners.length > 0 && (
            <div className="mb-6">
              <BannerStrip banners={otherBanners} />
            </div>
          )}
          {children}
        </MaintenanceGate>
      </main>
      <ShopFooter links={FOOTER_LINKS} />
      <MobileTabBar />
    </div>
  );
}
