using AmarGram.Infrastructure.Documents;
using QuestPDF.Infrastructure;
using Xunit;

namespace AmarGram.IntegrationTests.Unit;

/// <summary>Real-API e2e finding: a customer invoice PDF answered 500 ("configure the QuestPDF license") on an API process that
/// had not exported a report yet, because only the report renderer set the licence. The shared QuestPdfFonts entry point sets it.</summary>
/// <remarks>The test clears the process-global licence for a moment, so it runs in its own non-parallel collection: no
/// PDF-rendering test can run while the licence is null (code review, REAL-API-E2E MEDIUM).</remarks>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class QuestPdfGlobalSettingsCollection
{
    public const string Name = "QuestPDF global settings";
}

[Collection(QuestPdfGlobalSettingsCollection.Name)]
public sealed class QuestPdfLicenceTests
{
    [Fact]
    public void EnsureRegistered_sets_the_community_licence_even_when_the_font_is_already_registered()
    {
        QuestPdfFonts.EnsureRegistered();
        var before = QuestPDF.Settings.License;
        try
        {
            QuestPDF.Settings.License = null;

            QuestPdfFonts.EnsureRegistered();

            Assert.Equal(LicenseType.Community, QuestPDF.Settings.License);
        }
        finally
        {
            QuestPDF.Settings.License = before;
        }
    }
}
