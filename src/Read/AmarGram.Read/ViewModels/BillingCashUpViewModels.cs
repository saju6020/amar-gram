namespace AmarGram.Read.ViewModels;

public sealed record CashUpLineViewModel(
    Guid Id, string Kind, string? Method, string? Collector, string? RefundMethod, MoneyViewModel Amount, bool CountsInCash, bool CarriedIn, string? Label,
    string? SourceKey = null);

/// <summary>
/// HO-P4 BG-20. One source of cash on the day (the till, or a staff collector of cash on delivery): what it was expected to hold, what was counted
/// and the server's variance (counted minus expected, signed: negative is short, positive over). <c>Counted</c> and <c>Variance</c> are null
/// while the source is not counted yet on an open day, and for every source of a day counted by total only.
/// </summary>
public sealed record CashUpSourceViewModel(string Key, string Label, MoneyViewModel Expected, MoneyViewModel? Counted, MoneyViewModel? Variance);

public sealed record CashUpCarriedInViewModel(Guid Id, string Kind, string? Label, MoneyViewModel Amount);

public sealed record CashUpExpectedViewModel(
    MoneyViewModel Cash, int CashCount, MoneyViewModel Card, int CardCount, MoneyViewModel Transfer, int TransferCount, MoneyViewModel CashRefunds,
    MoneyViewModel CashReversals, MoneyViewModel CarriedInTotal, IReadOnlyList<CashUpCarriedInViewModel> CarriedIn, MoneyViewModel ExpectedCash);

public sealed record CashUpViewModel(
    DateOnly BusinessDate, string Status, int Version, CashUpExpectedViewModel Expected, IReadOnlyList<CashUpLineViewModel> Lines, MoneyViewModel? Counted,
    MoneyViewModel? Variance, string? Explanation, int PendingApprovals, Guid? CountedBy, DateTimeOffset? CountedOn, Guid? ClosedBy, string? ClosedByName,
    DateTimeOffset? ClosedOn, IReadOnlyList<CashUpSourceViewModel> Sources);
