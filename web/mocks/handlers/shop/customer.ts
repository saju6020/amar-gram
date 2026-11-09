import { http, HttpResponse, type HttpHandler } from 'msw';
import { badRequest, shopFixtureIds } from './fixtures';
import { hasCustomerSession } from './catalogue';
import {
  db,
  findById,
  findBySlug,
  findSku,
  isOnStorefront,
  money,
  persist,
  skuAvailability,
} from './store';

/**
 * `mocks/handlers/shop/customer.ts` — HO-SHP-002 §12. The signed-in customer's endpoints of
 * HO-SHP-001 §12.4. Session = the `pc_session` cookie `accounts.ts` sets; without it every route is
 * the `401 session_invalid` body `client.ts` expects. Another customer's ids are not modelled (one
 * customer is seeded); a `403`/`503` a test needs is produced with `server.use(...)`.
 */

const unauthorised = () => HttpResponse.json({ error: 'session_invalid' }, { status: 401 });
const notFound = () => new HttpResponse(null, { status: 404 });
const noContent = () => new HttpResponse(null, { status: 204 });

export const customerHandlers: HttpHandler[] = [
  http.get('*/api/customers/me/shop/products/:slug/review-eligibility', ({ params, request }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    const slug = String(params.slug);
    const product = findBySlug(slug);
    if (!product || !isOnStorefront(product)) return notFound();
    const existing = db.reviews.find(
      (r) =>
        r.mine && r.slug === slug && (r.status === 'PendingModeration' || r.status === 'Published'),
    );
    if (existing) {
      return HttpResponse.json({
        canReview: false,
        reason: 'AlreadyReviewed',
        purchasedSkus: [],
        existingReviewId: existing.reviewId,
      });
    }
    if (slug !== shopFixtureIds.reviewableSlug) {
      return HttpResponse.json({
        canReview: false,
        reason: 'NotPurchased',
        purchasedSkus: [],
        existingReviewId: null,
      });
    }
    return HttpResponse.json({
      canReview: true,
      reason: null,
      purchasedSkus: product.skus
        .filter((s) => s.inStock)
        .map((s) => ({ skuId: s.skuId, label: s.sizeOrWeight ?? s.code })),
      existingReviewId: null,
    });
  }),

  http.get('*/api/customers/me/reviews', ({ request }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    return HttpResponse.json(
      db.reviews
        .filter((r) => r.mine)
        .map((r) => ({
          reviewId: r.reviewId,
          productId: r.productId,
          productName: r.productName,
          skuLabel: r.skuLabel,
          rating: r.rating,
          title: r.title,
          body: r.body,
          status: r.status,
          submittedOn: r.submittedOn,
        })),
    );
  }),

  http.post('*/api/customers/me/reviews', async ({ request }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    const body = (await request.json()) as {
      productId: string;
      skuId: string;
      rating: number;
      title?: string | null;
      body: string;
    };
    const product = findById(body.productId);
    if (!product) return notFound();
    if (
      db.reviews.some(
        (r) =>
          r.mine &&
          r.productId === body.productId &&
          ['PendingModeration', 'Published'].includes(r.status),
      )
    ) {
      return badRequest(
        'ProductId',
        'AlreadyReviewed',
        'You have already reviewed this product.',
        'ProductReview',
      );
    }
    if (product.slug !== shopFixtureIds.reviewableSlug) {
      return badRequest(
        'ProductId',
        'ReviewNotPermitted',
        'Only customers who bought this product can review it.',
        'ProductReview',
      );
    }
    if (!body.body?.trim() || body.rating < 1 || body.rating > 5) {
      return badRequest(
        'Body',
        'InvalidReviewText',
        'Write a few words about the product and choose 1 to 5 stars.',
        'ProductReview',
      );
    }
    const found = findSku(body.skuId);
    const reviewId = crypto.randomUUID();
    db.reviews.push({
      reviewId,
      productId: product.productId,
      slug: product.slug,
      productName: product.name,
      skuId: body.skuId,
      skuLabel: found?.sku.sizeOrWeight ?? '',
      rating: body.rating,
      title: body.title ?? null,
      body: body.body,
      status: 'PendingModeration',
      submittedOn: new Date().toISOString(),
      authorDisplayName: 'You',
      mine: true,
    });
    persist();
    return HttpResponse.json({ reviewId, status: 'PendingModeration' }, { status: 201 });
  }),

  http.put('*/api/customers/me/reviews/:reviewId', async ({ params, request }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    const review = db.reviews.find((r) => r.reviewId === params.reviewId && r.mine);
    if (!review) return notFound();
    const body = (await request.json()) as { rating: number; title?: string | null; body: string };
    if (!body.body?.trim()) {
      return badRequest(
        'Body',
        'InvalidReviewText',
        'Write a few words about the product.',
        'ProductReview',
      );
    }
    Object.assign(review, {
      rating: body.rating,
      title: body.title ?? null,
      body: body.body,
      status: 'PendingModeration',
    });
    persist();
    return HttpResponse.json({ status: 'PendingModeration' });
  }),

  http.delete('*/api/customers/me/reviews/:reviewId', ({ params, request }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    const index = db.reviews.findIndex((r) => r.reviewId === params.reviewId && r.mine);
    if (index < 0) return notFound();
    db.reviews.splice(index, 1);
    persist();
    return noContent();
  }),

  http.get('*/api/customers/me/wishlist', ({ request }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    return HttpResponse.json({
      items: db.wishlist.flatMap((entry) => {
        const found = findSku(entry.skuId);
        if (!found) return [];
        const { product, sku } = found;
        return [
          {
            skuId: sku.skuId,
            productId: product.productId,
            slug: product.slug,
            productName: product.name,
            skuLabel: sku.sizeOrWeight ?? sku.code,
            price: sku.price ? money(sku.price) : null,
            availability: skuAvailability(product, sku),
            onSale: isOnStorefront(product) && sku.status === 'Active',
            addedOn: entry.addedOn,
            primaryImage: {
              url: null,
              altText: `${product.name} — product photo`,
              isPrimary: true,
              skuId: null,
            },
          },
        ];
      }),
    });
  }),

  http.put('*/api/customers/me/wishlist/items/:skuId', ({ params, request }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    const skuId = String(params.skuId);
    if (!findSku(skuId)) return notFound();
    if (!db.wishlist.some((w) => w.skuId === skuId)) {
      db.wishlist.push({ skuId, addedOn: new Date().toISOString() });
      persist();
    }
    return noContent();
  }),

  http.delete('*/api/customers/me/wishlist/items/:skuId', ({ params, request }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    db.wishlist = db.wishlist.filter((w) => w.skuId !== params.skuId);
    persist();
    return noContent();
  }),

  http.get('*/api/customers/me/stock-alerts', ({ request }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    return HttpResponse.json(
      db.alerts.map((a) => {
        const found = findSku(a.skuId);
        return {
          stockAlertId: a.stockAlertId,
          skuId: a.skuId,
          slug: found?.product.slug ?? null,
          productName: found?.product.name ?? null,
          skuLabel: found ? (found.sku.sizeOrWeight ?? found.sku.code) : null,
          status: a.status,
          requestedOn: a.requestedOn,
          notifiedOn: a.notifiedOn,
        };
      }),
    );
  }),

  http.post('*/api/customers/me/stock-alerts', async ({ request }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    const { skuId } = (await request.json()) as { skuId: string };
    const found = findSku(skuId);
    if (!found) return notFound();
    if (skuAvailability(found.product, found.sku) === 'InStock') {
      return badRequest(
        'SkuId',
        'SkuAlreadyAvailable',
        'This size is in stock again — you can buy it now.',
        'StockAlert',
      );
    }
    if (db.alerts.some((a) => a.skuId === skuId && a.status === 'Pending')) {
      return badRequest(
        'SkuId',
        'StockAlertAlreadyRequested',
        'You already have a pending alert for this item.',
        'StockAlert',
      );
    }
    const stockAlertId = crypto.randomUUID();
    db.alerts.push({
      stockAlertId,
      skuId,
      status: 'Pending',
      requestedOn: new Date().toISOString(),
      notifiedOn: null,
    });
    persist();
    const willNotify = skuId !== shopFixtureIds.skuAlertNoConsent;
    return HttpResponse.json(
      {
        stockAlertId,
        deliverability: willNotify
          ? { willNotify: true, channels: ['InApp', 'Sms'], inboxCopy: true }
          : { willNotify: false, channels: [], inboxCopy: false },
      },
      { status: 201 },
    );
  }),

  http.delete('*/api/customers/me/stock-alerts/:stockAlertId', ({ params, request }) => {
    if (!hasCustomerSession(request)) return unauthorised();
    const alert = db.alerts.find((a) => a.stockAlertId === params.stockAlertId);
    if (!alert) return notFound();
    db.alerts = db.alerts.filter((a) => a !== alert);
    persist();
    return noContent();
  }),
];
