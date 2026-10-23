using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

public sealed record PersonalDataExportDto(DateTimeOffset ExportedOn, UserContext UserContext, Guid CorrelationId);
