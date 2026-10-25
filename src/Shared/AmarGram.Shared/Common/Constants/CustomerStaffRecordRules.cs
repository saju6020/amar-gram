namespace AmarGram.Shared.Common.Constants;

/// <summary>HO-P4 BG-19. Limits of the staff-only record kept on a customer: free-text notes and free labels (tags).</summary>
public static class CustomerStaffRecordRules
{
    public const int MaxNotes = 200;
    public const int NoteMaxLength = 1000;
    public const int MaxTags = 10;
    public const int TagMaxLength = 30;
}
