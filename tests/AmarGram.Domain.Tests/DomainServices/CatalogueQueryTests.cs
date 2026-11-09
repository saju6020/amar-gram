using AmarGram.Domain.DomainServices;

namespace AmarGram.Domain.Tests.DomainServices;

/// <summary>HO-SHP-001 §15 U-E1, U-E2.</summary>
public sealed class CatalogueQueryTests
{
    [Fact]
    public void Normalise_TrimsCollapsesLowersAndEscapes()
    {
        var result = CatalogueQuery.Normalise("  Chashi   GOLDEN%_ ");
        Assert.Equal("chashi golden\\%\\_", result);
    }

    [Fact]
    public void Normalise_BlankOrNull_ReturnsEmpty()
    {
        Assert.Equal("", CatalogueQuery.Normalise(null));
        Assert.Equal("", CatalogueQuery.Normalise("   "));
    }

    [Fact]
    public void DefaultSort_WithQuery_Relevance_WithoutQuery_Newest()
    {
        Assert.Equal(AmarGram.Shared.Common.Enums.CatalogueSort.Relevance, CatalogueQuery.DefaultSort(hasQuery: true));
        Assert.Equal(AmarGram.Shared.Common.Enums.CatalogueSort.Newest, CatalogueQuery.DefaultSort(hasQuery: false));
    }
}
