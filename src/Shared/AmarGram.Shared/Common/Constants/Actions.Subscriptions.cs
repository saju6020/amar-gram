namespace AmarGram.Shared.Common.Constants;

/// <summary>HO-SUB-001 §12.3 (ADR-248) -- Subscriptions' staff action names, appended per ADR-341. Customer endpoints carry <c>[RequireCustomerSession]</c> instead.</summary>
public static partial class Actions
{
    public static class Subscriptions
    {
        public const string View = "Subscriptions.View";
        public const string Manage = "Subscriptions.Manage";
        public const string Export = "Subscriptions.Export";
    }
}
