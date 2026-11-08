using QuestPDF.Drawing;

namespace AmarGram.Infrastructure.Documents;

/// <summary>
/// Registers the embedded Bengali fallback font (Noto Sans Bengali, SIL Open Font License 1.1, bundled
/// under Documents/Fonts/) once per process. The default font (Lato) has no Bengali glyphs, so every
/// QuestPDF document names this family second in its <c>FontFamily(...)</c> calls and QuestPDF falls
/// back to it for any glyph Lato does not have.
/// </summary>
public static class QuestPdfFonts
{
    public const string BengaliFallbackFontFamily = "Noto Sans Bengali";

    private const string BengaliFontEmbeddedResourceName =
        "AmarGram.Infrastructure.Documents.Fonts.NotoSansBengali-Regular.ttf";

    private static readonly object FontRegistrationLock = new();
    private static bool _bengaliFontRegistered;

    /// <summary>Every QuestPDF renderer calls this before it builds a document. It also sets the community licence, which
    /// QuestPDF requires before the first render: it used to be set only by the report renderer's constructor, so a customer
    /// invoice PDF failed with a 500 on an API process that had not yet exported a report.</summary>
    public static void EnsureRegistered()
    {
        QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

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
