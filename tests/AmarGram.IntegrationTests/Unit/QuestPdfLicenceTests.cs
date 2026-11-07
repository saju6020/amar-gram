using AmarGram.Infrastructure.Documents;
using QuestPDF.Infrastructure;
using Xunit;

namespace AmarGram.IntegrationTests.Unit;

/// <summary>Real-API e2e finding: a customer invoice PDF answered 500 ("configure the QuestPDF license") on an API process that
/// had not exported a report yet, because only the report renderer set the licence. The shared QuestPdfFonts entry point sets it.</summary>
public sealed class QuestPdfLicenceTests
{
    [Fact]
    public void EnsureRegistered_sets_the_community_licence_even_when_the_font_is_already_registered()
    {
        QuestPdfFonts.EnsureRegistered();
        QuestPDF.Settings.License = null;

        QuestPdfFonts.EnsureRegistered();

        Assert.Equal(LicenseType.Community, QuestPDF.Settings.License);
    }
}
