using CatEcommerce.Shared.Common.Enums;

namespace CatEcommerce.Shared.Common.Constants;

/// <summary>
/// HO-NTF-001 §8.2 -- variables available to every template, filled by the Notification context
/// itself, never the producer. <see cref="UnsubscribeLink"/> is required on every channel of a
/// marketing template and unavailable to a transactional one (checked by <c>TemplateRules</c>).
/// </summary>
public static class StandardTemplateVariables
{
    public const string RecipientName = "recipientName";
    public const string OutletName = "outletName";
    public const string OutletPhone = "outletPhone";
    public const string UnsubscribeLink = "unsubscribeLink";

    /// <summary>Available to every template, transactional or marketing.</summary>
    public static readonly IReadOnlyList<string> Common = [RecipientName, OutletName, OutletPhone];

    public static bool IsStandard(string name, bool isMarketing) =>
        Common.Contains(name, StringComparer.Ordinal) || (isMarketing && name == UnsubscribeLink);

    public static readonly IReadOnlyDictionary<string, TemplateVariableKind> Kinds = new Dictionary<string, TemplateVariableKind>(StringComparer.Ordinal)
    {
        [RecipientName] = TemplateVariableKind.Text,
        [OutletName] = TemplateVariableKind.Text,
        [OutletPhone] = TemplateVariableKind.Text,
        [UnsubscribeLink] = TemplateVariableKind.Url,
    };
}
