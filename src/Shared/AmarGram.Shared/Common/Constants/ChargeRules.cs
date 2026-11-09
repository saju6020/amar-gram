using AmarGram.Shared.Common.Enums;

namespace AmarGram.Shared.Common.Constants;

/// <summary>HO-BIL-001 §8.2/§8.3 -- charge field bounds and the default business line per source.</summary>
public static class ChargeRules
{
    public const int MaxSourceLineRefLength = 100;
    public const int MaxReportingTagLength = 50;
    public const int MaxVoidReasonLength = 500;
    public const string DefaultSourceLineRef = "main";
    public const int MaxQuantityDecimals = 3;
    public const int MaxMoneyDecimals = 2;

    /// <summary>§8.2: every source defaults to Shop, the only business line (HO-P1).</summary>
    public static BusinessLine DefaultBusinessLine(ChargeSourceKind sourceKind) => BusinessLine.Shop;

    /// <summary>§8.2: the default mapping is overridable only by <c>Manual</c>.</summary>
    public static bool MayOverrideBusinessLine(ChargeSourceKind sourceKind) => sourceKind == ChargeSourceKind.Manual;
}
