using AmarGram.Shared.Common.Constants;
using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

/// <summary>HO-NTF-001 §8.2 -- input to <c>NotificationTemplateAggregate.Customise</c>/<c>Edit</c>.</summary>
public sealed record NotificationTemplateCustomiseDto(
    NotificationTemplateDefinition Definition,
    IReadOnlyList<TemplateContentInput> Contents,
    Guid EditedBy,
    DateTimeOffset EditedOn,
    UserContext UserContext,
    Guid CorrelationId);
