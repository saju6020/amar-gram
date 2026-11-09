using AmarGram.Domain.DomainServices;
using AmarGram.Domain.Models;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.Queries.Subscription;
using AmarGram.Read.ViewModels;
using AmarGram.Shared.Common.Constants;
using AmarGram.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.QueryHandlers.Subscription;

internal static class SubscriptionPaging
{
    public static (int PageNumber, int PageSize) Of(int pageNumber, int pageSize) => (Math.Max(pageNumber, 1), Math.Clamp(pageSize <= 0 ? 20 : pageSize, 1, 100));
}

/// <summary>HO-SUB-001 §12.4 -- the caller's subscriptions (<c>status=live|cancelled</c>), live ones first by next delivery. By caller only.</summary>
public sealed class GetCustomerSubscriptionsQueryHandler(AmarGramDbContext db, SubscriptionViews views)
    : IQueryHandlerAsync<GetCustomerSubscriptionsQuery, PagedResult<SubscriptionViewModel>>
{
    public async Task<QueryResponse<PagedResult<SubscriptionViewModel>>> HandleAsync(GetCustomerSubscriptionsQuery query)
    {
        var (pageNumber, pageSize) = SubscriptionPaging.Of(query.PageNumber, query.PageSize);
        var rows = db.Subscriptions.AsNoTracking().Where(s => s.CustomerId == query.CustomerId);
        if (query.Live is true) rows = rows.Where(s => s.Status != SubscriptionStatus.Cancelled);
        else if (query.Live is false) rows = rows.Where(s => s.Status == SubscriptionStatus.Cancelled);

        var total = await rows.CountAsync();
        var page = await rows.OrderBy(s => s.Status == SubscriptionStatus.Cancelled).ThenBy(s => s.NextDeliveryOn == null).ThenBy(s => s.NextDeliveryOn).ThenByDescending(s => s.StartedOn).ThenBy(s => s.Id)
            .Skip((pageNumber - 1) * pageSize).Take(pageSize).ToListAsync();

        return new QueryResponse<PagedResult<SubscriptionViewModel>> { Result = new PagedResult<SubscriptionViewModel>(await views.BuildAsync(page), pageNumber, pageSize, total) };
    }
}

/// <summary>HO-SUB-001 §12.4 -- one subscription of the caller's with its latest 12 cycles; another customer's is <c>null</c> (-> <c>404</c>).</summary>
public sealed class GetCustomerSubscriptionDetailQueryHandler(AmarGramDbContext db, SubscriptionViews views)
    : IQueryHandlerAsync<GetCustomerSubscriptionDetailQuery, CustomerSubscriptionDetailViewModel?>
{
    public async Task<QueryResponse<CustomerSubscriptionDetailViewModel?>> HandleAsync(GetCustomerSubscriptionDetailQuery query)
    {
        var subscription = await db.Subscriptions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == query.SubscriptionId && s.CustomerId == query.CustomerId);
        if (subscription is null) return new QueryResponse<CustomerSubscriptionDetailViewModel?> { Result = null };

        var view = (await views.BuildAsync([subscription]))[0];
        var cycles = await views.CyclesAsync(subscription.Id, SubscriptionRules.CustomerCycleHistory);
        return new QueryResponse<CustomerSubscriptionDetailViewModel?> { Result = new CustomerSubscriptionDetailViewModel(view, cycles) };
    }
}

/// <summary>HO-SUB-001 §12.4 -- a page of one subscription's cycles, newest first (<c>null</c> -> <c>404</c> when the caller does not own it).</summary>
public sealed class GetSubscriptionCyclesQueryHandler(AmarGramDbContext db)
    : IQueryHandlerAsync<GetSubscriptionCyclesQuery, PagedResult<SubscriptionCycleViewModel>?>
{
    public async Task<QueryResponse<PagedResult<SubscriptionCycleViewModel>?>> HandleAsync(GetSubscriptionCyclesQuery query)
    {
        var owned = await db.Subscriptions.AsNoTracking().AnyAsync(s => s.Id == query.SubscriptionId && (query.CustomerId == null || s.CustomerId == query.CustomerId));
        if (!owned) return new QueryResponse<PagedResult<SubscriptionCycleViewModel>?> { Result = null };

        var (pageNumber, pageSize) = SubscriptionPaging.Of(query.PageNumber, query.PageSize);
        var rows = db.SubscriptionCycles.AsNoTracking().Where(c => c.SubscriptionId == query.SubscriptionId);
        var total = await rows.CountAsync();
        var page = await rows.OrderByDescending(c => c.CycleOn).Skip((pageNumber - 1) * pageSize).Take(pageSize).ToListAsync();

        return new QueryResponse<PagedResult<SubscriptionCycleViewModel>?>
        {
            Result = new PagedResult<SubscriptionCycleViewModel>(page.Select(SubscriptionViews.CycleOf).ToList(), pageNumber, pageSize, total),
        };
    }
}

/// <summary>HO-SUB-001 §12.4 -- what the product page's "Subscribe" needs. <c>null</c> (-> <c>404</c>) for an unknown SKU.</summary>
public sealed class GetSubscriptionOptionsQueryHandler(
    ISubscribableCatalogue catalogue, ISubscriptionFinder finder, ICommerceClock commerceClock, IBusinessSettings settings, AmarGramDbContext db,
    QueryHandlers.StoredFile.IStoredFileSigningBatcher signer)
    : IQueryHandlerAsync<GetSubscriptionOptionsQuery, SubscriptionOptionsViewModel?>
{
    public async Task<QueryResponse<SubscriptionOptionsViewModel?>> HandleAsync(GetSubscriptionOptionsQuery query)
    {
        var clock = await commerceClock.GetAsync();
        var skus = await catalogue.GetAsync([query.SkuId], clock.Now, default);
        if (!skus.TryGetValue(query.SkuId, out var sku)) return new QueryResponse<SubscriptionOptionsViewModel?> { Result = null };

        var images = await Product.ProductImageUrls.ForSkusAsync(db, signer, [query.SkuId]);
        var subscribable = sku.IsPurchasable && sku.IsSubscribable;
        var reason = subscribable ? null : !sku.IsPurchasable ? SubscriptionMessages.SkuNotSubscribableInactive : SubscriptionMessages.SkuNotSubscribableNotOffered;
        var currency = sku.CurrencyCode ?? settings.GetString(SettingKeys.CommerceCurrencyCode);

        var view = new SubscriptionOptionsViewModel(
            new SubscriptionProductViewModel(sku.SkuId, sku.ProductName, sku.VariantLabel, images.GetValueOrDefault(sku.SkuId), sku.IsPurchasable),
            OrderMoney.Of(sku.UnitPrice, currency), subscribable, reason, SubscriptionRules.AllowedIntervalWeeks, SubscriptionRules.MaxQuantity,
            settings.GetDecimal(SettingKeys.SubscriptionDiscountPercent).ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
            clock.EarliestDeliveryOn, clock.Today.AddDays(SubscriptionRules.MaxFirstDeliveryDays), settings.GetInt(SettingKeys.SubscriptionChangeCutoffDays),
            settings.GetInt(SettingKeys.SubscriptionPreChargeNoticeDays), await finder.FindLiveIdAsync(query.CustomerId, query.SkuId, default), clock.ZoneId);

        return new QueryResponse<SubscriptionOptionsViewModel?> { Result = view };
    }
}

/// <summary>
/// HO-SUB-001 §12.4 (C-ORD-2, adapted) -- the payment methods Orders would offer this subscription's fulfilment at the estimated value, limited to the fulfilment's
/// allowed methods (delivery: cash on delivery or bank transfer; collection: bank transfer or pay at the shop). The decision is Orders' own pure pricing
/// (<c>CheckoutPricing</c> over <c>ICheckoutInputsLoader</c>), so BR-15 is asked, never reimplemented. <c>null</c> (-> <c>404</c>) for an unknown SKU.
/// </summary>
public sealed class GetSubscriptionPaymentMethodsQueryHandler(
    ISubscribableCatalogue catalogue, ICheckoutInputsLoader inputsLoader, ICommerceClock commerceClock, IBusinessSettings settings)
    : IQueryHandlerAsync<GetSubscriptionPaymentMethodsQuery, IReadOnlyList<SubscriptionPaymentMethodViewModel>?>
{
    public async Task<QueryResponse<IReadOnlyList<SubscriptionPaymentMethodViewModel>?>> HandleAsync(GetSubscriptionPaymentMethodsQuery query)
    {
        var clock = await commerceClock.GetAsync();
        var skus = await catalogue.GetAsync([query.SkuId], clock.Now, default);
        if (!skus.ContainsKey(query.SkuId)) return new QueryResponse<IReadOnlyList<SubscriptionPaymentMethodViewModel>?> { Result = null };

        var delivery = query.DeliveryAddressId is not null;
        if (!delivery && query.PickupBranchId is null) return new QueryResponse<IReadOnlyList<SubscriptionPaymentMethodViewModel>?> { Result = [] };

        var allowed = delivery
            ? new[] { SubscriptionPaymentMethod.CashOnDelivery, SubscriptionPaymentMethod.BankTransfer }
            : new[] { SubscriptionPaymentMethod.BankTransfer, SubscriptionPaymentMethod.PayAtPickup };

        var choice = new FulfilmentChoice(
            delivery ? FulfilmentMethod.Delivery : FulfilmentMethod.Pickup, query.DeliveryAddressId, null, null, null, query.PickupBranchId, allowed[0].ToOrderPaymentMethod(), null);
        var inputs = await inputsLoader.LoadSubscriptionAsync(
            query.CustomerId, [new CounterLineRequest(query.SkuId, Math.Clamp(query.Quantity, 1, SubscriptionRules.MaxQuantity))], choice,
            settings.GetDecimal(SettingKeys.SubscriptionDiscountPercent), clock.Now, default);
        var quote = CheckoutPricing.Quote(inputs);

        var result = allowed.Select(method =>
        {
            var option = quote.PaymentOptions.FirstOrDefault(o => o.Method == method.ToOrderPaymentMethod());
            return new SubscriptionPaymentMethodViewModel(method.DisplayName, option?.Available ?? false, option is { Available: false } ? option.Message ?? option.UnavailableReason : null);
        }).ToList();

        return new QueryResponse<IReadOnlyList<SubscriptionPaymentMethodViewModel>?> { Result = result };
    }
}
