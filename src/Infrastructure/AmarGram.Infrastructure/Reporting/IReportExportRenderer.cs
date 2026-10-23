using AmarGram.Domain.Models;
using AmarGram.Shared.Common.Enums;

namespace AmarGram.Infrastructure.Reporting;

/// <summary>The business name printed on the PDF header. Who generated the file is on the result itself.</summary>
public sealed record ReportRenderContext(string OutletName);

/// <summary>
/// HO-RPT-001 section 8.12 / 8.13 (ADR-285) -- the CSV and PDF shapes of one <see cref="ReportResult"/>. The same code renders an interactive export and a scheduled one, so a scheduled
/// attachment is byte-for-byte what the recipient could export on screen (I-G2). Stateless, so registered as a singleton.
/// </summary>
public interface IReportExportRenderer
{
    ReportFormat Format { get; }

    string ContentType { get; }

    string Extension { get; }

    byte[] Render(ReportResult result, ReportRenderContext context);
}
