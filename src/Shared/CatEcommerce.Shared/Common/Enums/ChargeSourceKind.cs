namespace CatEcommerce.Shared.Common.Enums;

/// <summary>
/// Owned by HO-BIL-001 §8.2/§8.3. Named <c>ChargeSourceKind</c> here for the field HO-BIL-001's own
/// prose calls <c>SourceKind</c> (on <c>ChargeAggregate</c> and <c>ChargeRequestDto</c>) -- given the
/// generic-sounding field name, the type itself is named for what it discriminates rather than
/// reusing the bare word "SourceKind" as a type name. HO-P1 retired the kinds of the
/// retired areas; the remaining values are unchanged.
/// </summary>
public sealed class ChargeSourceKind(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly ChargeSourceKind Order = new(5, nameof(Order));
    public static readonly ChargeSourceKind Manual = new(7, nameof(Manual));
}
