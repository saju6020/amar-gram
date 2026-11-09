using AmarGram.Domain.DomainServices;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Shared.Common.Constants;
using Microsoft.EntityFrameworkCore;

namespace AmarGram.Infrastructure.Operations;

/// <summary>The main branch's calendar date and hour; see <see cref="IOperationsClock"/>.</summary>
public sealed class OperationsClock(AmarGramDbContext db, TimeProvider timeProvider) : IOperationsClock
{
    private const string FallbackZone = "Asia/Dhaka";

    private async Task<string> ZoneIdAsync(CancellationToken ct) =>
        await db.Branches.AsNoTracking().Where(b => b.Id == AdministrationSeed.MainBranchId).Select(b => b.TimeZoneId).FirstOrDefaultAsync(ct) ?? FallbackZone;

    public async Task<DateOnly> LocalDateOfAsync(DateTimeOffset instant, CancellationToken ct) =>
        BranchCalendar.LocalDateOf(instant, await ZoneIdAsync(ct));

    public async Task<MainBranchTime> NowAsync(CancellationToken ct)
    {
        var zoneId = await db.Branches.AsNoTracking()
            .Where(b => b.Id == AdministrationSeed.MainBranchId)
            .Select(b => b.TimeZoneId)
            .FirstOrDefaultAsync(ct) ?? FallbackZone;

        var utc = timeProvider.GetUtcNow();
        var zone = TimeZoneInfo.FindSystemTimeZoneById(zoneId);
        var local = TimeZoneInfo.ConvertTime(utc, zone);
        return new MainBranchTime(utc, zoneId, BranchCalendar.LocalDateOf(utc, zoneId), local.Hour);
    }
}
