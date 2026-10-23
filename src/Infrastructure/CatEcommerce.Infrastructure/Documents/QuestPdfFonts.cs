using QuestPDF.Drawing;

namespace CatEcommerce.Infrastructure.Documents;

/// <summary>
/// Registers the embedded Bengali fallback font (Noto Sans Bengali, SIL Open Font License 1.1, bundled
/// under Documents/Fonts/) once per process. The default font (Lato) has no Bengali glyphs, so every
/// QuestPDF document names this family second in its <c>FontFamily(...)</c> calls and QuestPDF falls
/// back to it for any glyph Lato does not have. Moved here from the retired medical-history renderer
/// (HO-P1), which used to own this registration.
/// </summary>
public static class QuestPdfFonts
{
    public const string BengaliFallbackFontFamily = "Noto Sans Bengali";

    private const string BengaliFontEmbeddedResourceName =
        "CatEcommerce.Infrastructure.Documents.Fonts.NotoSansBengali-Regular.ttf";

    private static readonly object FontRegistrationLock = new();
    private static bool _bengaliFontRegistered;

    public static void EnsureRegistered()
    {
        if (_bengaliFontRegistered) return;

        lock (FontRegistrationLock)
        {
            if (_bengaliFontRegistered) return;

            using var fontStream = typeof(QuestPdfFonts).Assembly.GetManifestResourceStream(BengaliFontEmbeddedResourceName)
                ?? throw new InvalidOperationException($"Embedded font resource '{BengaliFontEmbeddedResourceName}' was not found.");

            FontManager.RegisterFontFromStream(fontStream);
            _bengaliFontRegistered = true;
        }
    }
}
