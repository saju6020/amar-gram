namespace AmarGram.Read.ViewModels;

/// <summary>HO-SHP-001 section 12.4 -- <c>GET /api/shop/locales</c>.</summary>
public sealed record LocalesViewModel(string DefaultLocale, IReadOnlyList<string> Locales);

public sealed record StaffTranslationViewModel(string Locale, string? Name, string? Description, string? IngredientList);
