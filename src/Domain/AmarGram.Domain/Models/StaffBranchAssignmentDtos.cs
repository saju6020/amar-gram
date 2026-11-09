using Platform.Infrastructure.Common.Security;

namespace AmarGram.Domain.Models;

public sealed record StaffBranchAssignDto(
    IReadOnlyList<Guid> BranchIds, Guid PrimaryBranchId, UserContext UserContext, Guid CorrelationId);
