namespace AmarGram.Read.ViewModels;

/// <summary>HO-P4 BG-5 -- one in-house rider of a branch.</summary>
public sealed record RiderViewModel(Guid Id, string Name, string? MobileNumber, bool IsActive);
