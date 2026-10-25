using AmarGram.Read.ViewModels;
using Platform.Infrastructure.Core.Queries;

namespace AmarGram.Read.Queries.Order;

/// <summary>
/// HO-P3 G5 -- the shop's public delivery promise, readable without signing in: the free-delivery threshold and the default lead time the checkout quote
/// uses. These vary per delivery zone and service level, so this answers for the <b>primary zone</b> -- the storefront branch's active zone with the lowest
/// <c>Priority</c> (then name) that offers an active Standard service -- and its Standard level. Every field is null when no such zone exists.
/// </summary>
public sealed class GetDeliveryPromiseQuery : Query<DeliveryPromiseViewModel>;

/// <summary><c>FreeOver</c> is null when the primary zone's Standard level has no free-delivery threshold.</summary>
public sealed record DeliveryPromiseViewModel(string? CurrencyCode, MoneyViewModel? FreeOver, int? LeadTimeDays, string? ZoneName);
