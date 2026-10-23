using AmarGram.Shared.Common.Enums;

namespace AmarGram.Domain.Models;

public sealed record NotificationPreferenceChangeDto(
    NotificationChannel Channel,
    NotificationCategory Category,
    bool IsGranted);
