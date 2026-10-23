using System.Net;
using System.Net.Http.Json;
using CatEcommerce.Read.Queries.Portal;
using CatEcommerce.Read.ViewModels;
using CatEcommerce.Shared.Common.Constants;
using Microsoft.Extensions.DependencyInjection;
using Platform.Infrastructure.Core.Queries;
using Xunit;

namespace CatEcommerce.IntegrationTests.Endpoints;

/// <summary>HO-POR-001 §16 groups A and B, the profile section and the host wiring. Each test mints its own customers and
/// asserts only their own dashboard (§16.1 rules 1 to 4).</summary>
public sealed class PortalDashboardEndpointTests(PortalApiFactory factory) : PortalIntegrationTestBase(factory)
{
    // I-A1 -- the host starts with ValidateScopes + ValidateOnBuild (Program.cs), so reaching this line already proves every reader
    // and every upstream handler it takes is registered; resolving them explicitly makes the proof visible and also covers the Q1 handler.
    [Fact]
    public async Task I_A1_TheComposingHandlerAndItsReadersResolve()
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        Assert.NotNull(scope.ServiceProvider.GetRequiredService<IQueryHandlerAsync<GetPortalDashboardQuery, PortalDashboardViewModel>>());
        Assert.NotNull(scope.ServiceProvider.GetService(typeof(CatEcommerce.Read.QueryHandlers.Portal.IPortalSectionReader<PortalCustomerViewModel>)));
        Assert.NotNull(scope.ServiceProvider.GetService(typeof(CatEcommerce.Read.QueryHandlers.Portal.IPortalSectionReader<PortalBalancesViewModel>)));
        Assert.NotNull(scope.ServiceProvider.GetService(typeof(CatEcommerce.Read.QueryHandlers.Portal.IPortalSectionReader<PortalOrdersViewModel>)));

        var customer = await RegisterCustomerAsync();
        Assert.Equal(HttpStatusCode.OK, (await customer.Client.GetAsync("/api/portal/dashboard")).StatusCode);
    }

    // I-A3
    [Fact]
    public async Task I_A3_NoSession_AndStaffSessionOnly_Are401SessionInvalid()
    {
        var anonymous = ClientOn(Factory);
        var anonymousResponse = await anonymous.GetAsync("/api/portal/dashboard");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymousResponse.StatusCode);
        Assert.Equal("session_invalid", (await ReadAsync(anonymousResponse)).GetProperty("error").GetString());

        var (staff, _) = await SignInNewStaffAsync(StaffRoles.Administrator);
        var staffResponse = await staff.GetAsync("/api/portal/dashboard");
        Assert.Equal(HttpStatusCode.Unauthorized, staffResponse.StatusCode);
        Assert.Equal("session_invalid", (await ReadAsync(staffResponse)).GetProperty("error").GetString());
    }

    // I-B1 (Phase A part) -- US-POR-01 AC2
    [Fact]
    public async Task I_B1_NewCustomer_GreetingPresent_AndTheDashboardIsNeverCached()
    {
        var customer = await RegisterCustomerAsync("Nusrat Jahan");

        var response = await customer.Client.GetAsync("/api/portal/dashboard");
        await ExpectAsync(HttpStatusCode.OK, response);
        Assert.Contains("no-store", response.Headers.CacheControl?.ToString());
        var dashboard = await ReadAsync(response);

        Assert.Equal("Nusrat Jahan", dashboard.GetProperty("customer").GetProperty("data").GetProperty("fullName").GetString());
    }
}
