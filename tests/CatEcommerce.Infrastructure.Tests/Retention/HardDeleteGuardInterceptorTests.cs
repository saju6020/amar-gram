using CatEcommerce.Domain.Aggregates.Account;
using CatEcommerce.Domain.Models;
using CatEcommerce.Domain.ValueObjects;
using CatEcommerce.Infrastructure.Persistence;
using CatEcommerce.Infrastructure.Retention;
using CatEcommerce.Shared.Common.Constants;
using CatEcommerce.Shared.Common.Enums;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Common.Security;

namespace CatEcommerce.Infrastructure.Tests.Retention;

/// <summary>
/// HO-XCT-001 U-A3..U-A6 -- ADR-299 layer 2. The guard runs on the change tracker, so these tests never open a connection:
/// they track real aggregates, mutate or remove them, and call the guard's check directly.
/// </summary>
public sealed class HardDeleteGuardInterceptorTests
{
    private static UserContext Actor => new(Guid.NewGuid(), Guid.NewGuid());

    private static CatEcommerceDbContext NewDb() => new(new DbContextOptionsBuilder<CatEcommerceDbContext>()
        .UseNpgsql("Host=localhost;Database=model_only;Username=model_only").Options);

    private static StaffAccountAggregate StaffAccount()
    {
        var staff = new StaffAccountAggregate(Guid.NewGuid());
        staff.Create(new StaffAccountCreationDto(
            "Staff", MobileNumber.Create("01712345678"), null, [StaffRoles.Reception], Actor, Guid.NewGuid()));
        return staff;
    }

    private static CustomerAddressBookAggregate AddressBookWithOneAddress()
    {
        var addressBook = new CustomerAddressBookAggregate(Guid.NewGuid());
        addressBook.Open(new CustomerAddressBookOpenDto(Actor, Guid.NewGuid()));
        addressBook.AddAddress(new DeliveryAddressAddDto(Guid.NewGuid(), "Home", "1 Road", null, "Dhaka", "Dhaka", null, null, DateTimeOffset.UtcNow, Actor, Guid.NewGuid()));
        return addressBook;
    }

    // U-A3
    [Fact]
    public void U_A3_RemovingAForbiddenRoot_IsRefusedBeforeAnySql()
    {
        using var db = NewDb();
        var staff = StaffAccount();
        db.Attach(staff);
        db.Remove(staff);

        var refused = Assert.Throws<ProtectedRecordDeletionException>(() => HardDeleteGuardInterceptor.EnsureNoProtectedDeletes(db));

        Assert.Equal("account", refused.Schema);
        Assert.Equal("staff_account", refused.Table);
        Assert.Equal(HardDeletePolicy.Forbidden, refused.Policy);
    }

    // U-A4
    [Fact]
    public void U_A4_AnAggregateReplacingItsOwnCurrentStateCollection_IsAllowed()
    {
        using var db = NewDb();
        var addressBook = AddressBookWithOneAddress();
        db.Attach(addressBook);

        // F32: Clear empties the address collection through the aggregate, so EF marks the old owned item Deleted.
        addressBook.Clear(new CustomerAddressBookClearDto(Actor, Guid.NewGuid()));

        Assert.Contains(db.ChangeTracker.Entries(), e => e.State == EntityState.Deleted && e.Metadata.GetTableName() == "customer_delivery_address");
        HardDeleteGuardInterceptor.EnsureNoProtectedDeletes(db);
    }

    // U-A5
    [Fact]
    public void U_A5_RemovingAnOwnedItemWhoseOwnerIsNotTracked_IsRefused()
    {
        using var db = NewDb();
        var addressBook = AddressBookWithOneAddress();
        var address = addressBook.Addresses.Single();

        // Track the owner, then detach ONLY the owner so the owned item is deleted with no tracked owner.
        db.Attach(addressBook);
        db.Entry(addressBook).State = EntityState.Detached;
        db.Entry(address).State = EntityState.Deleted;

        var refused = Assert.Throws<ProtectedRecordDeletionException>(() => HardDeleteGuardInterceptor.EnsureNoProtectedDeletes(db));
        Assert.Equal("customer_delivery_address", refused.Table);
        Assert.Equal(HardDeletePolicy.AggregateOnly, refused.Policy);
    }

    // U-A6
    [Fact]
    public void U_A6_ATrackedDeleteOfAPurgeableRoot_IsRefused_ThePurgerIsTheOnlyPath()
    {
        using var db = NewDb();
        var session = new CustomerSessionAggregate(Guid.NewGuid());
        session.Issue(new SessionIssueDto(Guid.NewGuid(), "hash", Guid.NewGuid(), DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddDays(1), null, null, Actor, Guid.NewGuid(), "csrf"));
        db.Attach(session);
        db.Remove(session);

        var refused = Assert.Throws<ProtectedRecordDeletionException>(() => HardDeleteGuardInterceptor.EnsureNoProtectedDeletes(db));
        Assert.Equal("customer_session", refused.Table);
        Assert.Equal(HardDeletePolicy.Purgeable, refused.Policy);
    }

    [Fact]
    public void TheNamedChangeTrackedPurgeException_IsOnlyTheStoredFileRow_AndIsPurgeableInTheClassification()
    {
        var entry = Assert.Single(HardDeleteGuardInterceptor.ChangeTrackedPurgeAllowList);
        var classification = RecordClassification.Find(entry.Schema, entry.Table);

        Assert.NotNull(classification);
        Assert.Equal(HardDeletePolicy.Purgeable, classification!.HardDeletePolicy);
        Assert.False(string.IsNullOrWhiteSpace(entry.Reason));
    }
}
