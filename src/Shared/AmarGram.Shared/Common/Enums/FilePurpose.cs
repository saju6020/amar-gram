namespace AmarGram.Shared.Common.Enums;

/// <summary>
/// Owned by HO-FIL-001 §8.3/§10.1 (ADR-318). What an uploaded file is for -- the only thing this
/// bounded context knows about a file. §10.1: "Appended by the consuming handover, with a
/// <c>FileRules</c> row in the same commit." HO-P1 retired the purposes of the retired areas; the
/// remaining values are unchanged. A later area introducing a new purpose still appends here plus its own
/// <c>FileRules</c> row (owned by HO-FIL-001, not built in this pass).
/// </summary>
public sealed class FilePurpose(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly FilePurpose ProductImage = new(4, nameof(ProductImage));
    public static readonly FilePurpose ReportExport = new(7, nameof(ReportExport));
}
