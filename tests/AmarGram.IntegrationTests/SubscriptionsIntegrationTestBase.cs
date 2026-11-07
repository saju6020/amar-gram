using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AmarGram.Api.Background;
using AmarGram.Shared.Common.Constants;
using Microsoft.EntityFrameworkCore;
using AmarGram.Infrastructure.Configuration;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;

namespace AmarGram.IntegrationTests;

/// <summary>
/// HO-SUB-001 section 16 -- the helpers every Subscriptions endpoint test class starts from. A subscription raises a <b>real</b> order through Ordering (real Shop, Inventory and Billing
/// behind it -- never a fake, section 20.3), so these tests build on <see cref="OrderingShopTestBase"/> and its factory: the same branch, SKU, stock, delivery zone and customer
/// helpers, the same <see cref="AdjustableTimeProvider"/> clock (a test moves the clock past a cut-off or a delivery date with <see cref="AdvanceToLocal"/>) and the same switched-off
/// workers; <c>SubscriptionWorkCycle</c> is called directly, restricted to the test's own customer so one test's clock never touches another test's subscriptions.
/// Every test mints its own branch, SKUs, stock, zone and customer (section 16.1). The commerce zone is the seeded main branch's Asia/Dhaka (UTC+6, no DST).
/// </summary>
public abstract class SubscriptionsIntegrationTestBase(OrderingApiFactory factory) : OrderingShopTestBase(factory)
{
    protected static readonly TimeSpan Dhaka = TimeSpan.FromHours(6);

    protected static DateOnly DateOf(JsonElement element, string name) => DateOnly.Parse(element.GetProperty(name).GetString()!);

    protected static DateOnly? OptionalDateOf(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? DateOnly.Parse(value.GetString()!) : null;

    /// <summary>Moves this factory's clock forward to <paramref name="hour"/>:00 Dhaka time on <paramref name="date"/> (never back).</summary>
    protected void AdvanceToLocal(DateOnly date, int hour = 6)
    {
        var target = new DateTimeOffset(date.ToDateTime(new TimeOnly(hour, 0)), Dhaka);
        var by = target - Now;
        if (by > TimeSpan.Zero) Factory.Clock.Advance(by);
    }

    // ── catalogue ────────────────────────────────────────────────────────────────────────────────

    /// <summary>Staff mark a product "Can be subscribed to" (BG-15), keeping its other details as they are.</summary>
    protected async Task SetSubscribableAsync(OrderingContext context, OrderingSku sku, bool subscribable = true)
    {
        var detail = await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await context.Admin.GetAsync($"/api/staff/shop/products/{sku.ProductId}")));
        var update = await context.Admin.PutAsJsonAsync($"/api/staff/shop/products/{sku.ProductId}", new
        {
            expectedVersion = detail.GetProperty("version").GetInt32(),
            name = detail.GetProperty("name").GetString(),
            brand = detail.GetProperty("brand").GetString(),
            category = detail.GetProperty("category").GetString(),
            subcategory = detail.TryGetProperty("subcategory", out var sub) && sub.ValueKind == JsonValueKind.String ? sub.GetString() : null,
            taxClassId = detail.GetProperty("taxClassId").GetGuid(),
            countryOfOriginCode = detail.TryGetProperty("countryOfOriginCode", out var origin) && origin.ValueKind == JsonValueKind.String ? origin.GetString() : null,
            tags = Array.Empty<string>(),
            certifications = Array.Empty<string>(),
            listedOnStorefront = detail.GetProperty("listedOnStorefront").GetBoolean(),
            isExpiryTracked = detail.GetProperty("isExpiryTracked").GetBoolean(),
            isSubscribable = subscribable,
        }, Json);
        await ExpectAsync(HttpStatusCode.NoContent, update);
    }

    private readonly System.Collections.Concurrent.ConcurrentDictionary<Guid, string> _mobiles = new();

    /// <summary>
    /// <see cref="OrderingShopTestBase.SetUpShopAsync"/>'s shop -- a branch with a billing profile, a food (850.00, 15 %) and a bag (120.00, 0 %) stocked at it and at the storefront, a
    /// delivery zone for a fresh district and a customer with an address in it -- with the food SKU offered as a subscription (BG-15). Built here rather than called, so the
    /// customer's mobile is remembered and a test that moves the clock by weeks can sign the same customer in again (<see cref="SignInAgainAsync"/>).
    /// </summary>
    protected async Task<Shop> SetUpSubscribableShopAsync(bool cod = true, decimal? codMax = null, decimal stock = 50m, string? foodName = null)
    {
        var context = await CreateContextAsync();
        await SetBillingProfileAsync(context);
        var food = await CreateSkuAsync(context, price: 850m, stock: stock, onStorefront: true, name: foodName ?? "Royal Basmati Rice 2 kg");
        var bag = await CreateSkuAsync(context, price: 120m, stock: stock, taxClassId: context.ZeroTaxClassId, onStorefront: true, name: "Jute shopping bag");
        var district = NewDistrict();
        var zoneId = await CreateZoneAsync(context, district, cod: cod, codMax: codMax);

        var (customer, customerId, mobile) = await RegisterAndSignInCustomerAsync();
        var addressId = await AddAddressAsync(customer, district);
        await AcceptPendingPoliciesAsync(customer);
        _mobiles[customerId] = mobile;

        await SetSubscribableAsync(context, food);
        return new Shop(context, district, zoneId, customer, customerId, addressId, food, bag);
    }

    /// <summary>A fresh signed-in client for a customer a test created (their session does not outlive a test that moves the clock by weeks).</summary>
    protected Task<HttpClient> SignInAgainAsync(Guid customerId) => SignInCustomerAsync(_mobiles[customerId]);

    /// <summary>A staff member of <paramref name="role"/> at the context's branch, assigned by a freshly signed-in administrator and signed in now -- for a test that has moved the
    /// clock by days, which idles out every session signed in before (the context's own <c>Admin</c> client included).</summary>
    protected async Task<HttpClient> FreshStaffClientAsync(OrderingContext context, string role)
    {
        var admin = await SignInStaffAsync(context.AdminMobile, context.AdminPassword, context.BranchId);
        var staff = await SeedStaffAsync(role);
        await AssignAsync(admin, staff.StaffAccountId, context.BranchId);
        return await SignInStaffAsync(staff.Mobile, staff.Password, context.BranchId);
    }

    /// <summary>A second customer in the shop's delivery zone, with an address and every policy accepted.</summary>
    protected async Task<(HttpClient Client, Guid CustomerId, Guid AddressId, string Mobile)> AddCustomerAsync(Shop shop)
    {
        var (client, customerId, mobile) = await RegisterAndSignInCustomerAsync();
        var addressId = await AddAddressAsync(client, shop.District);
        await AcceptPendingPoliciesAsync(client);
        _mobiles[customerId] = mobile;
        return (client, customerId, addressId, mobile);
    }

    // ── subscribing and reading ──────────────────────────────────────────────────────────────────

    protected static object CreateBody(
        Shop shop, OrderingSku sku, int quantity = 2, int interval = 4, string payment = "CashOnDelivery", DateOnly? first = null, string fulfilment = "Delivery",
        Guid? addressId = null, Guid? pickupBranchId = null) => new
    {
        skuId = sku.SkuId,
        quantity,
        intervalWeeks = interval,
        firstDeliveryOn = first,
        fulfilment,
        deliveryAddressId = fulfilment == "Delivery" ? addressId ?? shop.AddressId : (Guid?)null,
        pickupBranchId = fulfilment == "Pickup" ? pickupBranchId ?? shop.Context.BranchId : (Guid?)null,
        paymentMethod = payment,
    };

    protected Task<HttpResponseMessage> TrySubscribeAsync(
        Shop shop, int quantity = 2, int interval = 4, string payment = "CashOnDelivery", DateOnly? first = null, OrderingSku? sku = null, HttpClient? client = null) =>
        (client ?? shop.Customer).PostAsJsonAsync("/api/customers/me/subscriptions", CreateBody(shop, sku ?? shop.Food, quantity, interval, payment, first), Json);

    /// <summary>Subscribes and returns the <c>201</c> subscription view.</summary>
    protected async Task<JsonElement> SubscribeAsync(Shop shop, int quantity = 2, int interval = 4, string payment = "CashOnDelivery", DateOnly? first = null, OrderingSku? sku = null) =>
        await ReadAsync(await ExpectAsync(HttpStatusCode.Created, await TrySubscribeAsync(shop, quantity, interval, payment, first, sku)));

    protected static async Task<JsonElement> GetAsync(HttpClient customer, Guid id) =>
        await ReadAsync(await ExpectAsync(HttpStatusCode.OK, await customer.GetAsync($"/api/customers/me/subscriptions/{id}")));

    protected static Task<HttpResponseMessage> PostAsync(HttpClient client, Guid id, string action, object? body = null) =>
        client.PostAsJsonAsync($"/api/customers/me/subscriptions/{id}/{action}", body ?? new { }, Json);

    protected static string[] AllowedActions(JsonElement view) => view.GetProperty("allowedActions").EnumerateArray().Select(a => a.GetString()!).ToArray();

    // ── the worker, notifications, the database ──────────────────────────────────────────────────

    /// <summary>One <c>SubscriptionWorkCycle</c> pass (unpaid, notices, generation) restricted to <paramref name="customerId"/>.</summary>
    protected async Task RunSubscriptionWorkAsync(Guid customerId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<SubscriptionWorkCycle>().RunAsync(default, customerId);
    }

    protected Task<List<AmarGram.Domain.Aggregates.Notification.NotificationRequestAggregate>> RequestsAsync(Guid customerId, string templateKey) =>
        WithDbAsync(db => db.NotificationRequests.AsNoTracking().Where(n => n.RecipientId == customerId && n.TemplateKey == templateKey).OrderBy(n => n.RequestedOn).ToListAsync());

    protected Task<List<AmarGram.Domain.Aggregates.Subscription.SubscriptionCycleAggregate>> CyclesAsync(Guid subscriptionId) =>
        WithDbAsync(db => db.SubscriptionCycles.AsNoTracking().Where(c => c.SubscriptionId == subscriptionId).OrderBy(c => c.CycleOn).ToListAsync());

    protected Task<List<AmarGram.Domain.Aggregates.Order.OrderAggregate>> OrdersOfAsync(Guid customerId) =>
        WithDbAsync(db => db.Orders.AsNoTracking().Where(o => o.CustomerId == customerId).OrderBy(o => o.PlacedOn).ToListAsync());

    /// <summary>Asserts a refusal with <paramref name="code"/> and returns the error messages -- the body is read once (a response stream cannot be read twice).</summary>
    protected static async Task<string[]> RefusedAsync(HttpResponseMessage response, string code, HttpStatusCode status = HttpStatusCode.BadRequest)
    {
        var body = await BodyAsync(response);
        Assert.True(response.StatusCode == status, $"Expected {(int)status} but got {(int)response.StatusCode}: {body}");
        using var document = JsonDocument.Parse(body);
        var errors = document.RootElement.GetProperty("errors").EnumerateArray().ToList();
        Assert.Contains(errors, e => e.GetProperty("errorCode").GetString() == code);
        return errors.Select(e => e.GetProperty("errorMessage").GetString()!).ToArray();
    }

    /// <summary>Signs a customer in again on a new client (a session does not outlive a test that moves the clock by weeks).</summary>
    protected async Task<HttpClient> SignInCustomerAsync(string mobile)
    {
        var client = CreateClientOn(Factory);
        var signIn = await client.PostAsJsonAsync("/api/auth/sign-in", new { identifier = mobile, password = CustomerPassword }, Json);
        await ExpectAsync(HttpStatusCode.OK, signIn);
        client.DefaultRequestHeaders.Add("X-CSRF-Token", ExtractCookieValue(signIn, "pc_csrf"));
        return client;
    }

    /// <summary>Sets a global setting through the real admin endpoint (the Subscriptions settings are global-only, so the class that changes one shares the non-parallel
    /// <c>AdministrationGlobalSettingsCollection</c> with the Administration settings tests, and restores the value in a <c>finally</c>).</summary>
    protected async Task SetSettingAsync(HttpClient admin, string key, string value)
    {
        await ExpectAsync(HttpStatusCode.NoContent, await admin.PutAsJsonAsync("/api/admin/settings", new { changes = new[] { new { key, value } } }, Json));

        // The 30 s settings cache is invalidated by the change event, which can run before the commit; the same request then reads settings (the idle timeout) and re-caches the
        // old values. Evict again now that the change is committed, so the very next read sees it -- the tests assert behaviour at the new value, not the cache's timing.
        CachedBusinessSettings.Invalidate(Factory.Services.GetRequiredService<IMemoryCache>(), SettingScopes.GlobalId);
    }
}
