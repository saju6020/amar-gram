using AmarGram.Infrastructure.Persistence.ReportingViews;

namespace AmarGram.Infrastructure.Persistence.Configurations.Reporting;

public sealed class RvOrderConfiguration() : ReportViewConfiguration<RvOrderRow>("rv_order");
public sealed class RvOrderReturnConfiguration() : ReportViewConfiguration<RvOrderReturnRow>("rv_order_return");
