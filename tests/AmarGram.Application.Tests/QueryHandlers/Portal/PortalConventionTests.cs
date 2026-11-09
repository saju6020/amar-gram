using System.Reflection;
using System.Text.RegularExpressions;
using AmarGram.Infrastructure.Persistence;
using AmarGram.Read.QueryHandlers.Portal;
using AmarGram.Read.ViewModels;
using Microsoft.EntityFrameworkCore;
using Platform.Infrastructure.Core;
using Platform.Infrastructure.Core.Domain;
using Platform.Infrastructure.Core.Events;

namespace AmarGram.Application.Tests.QueryHandlers.Portal;

/// <summary>HO-POR-001 §15 group A -- the boundary rules that fail the build rather than rely on review (ADR-257, 258, 259), plus the
/// read-side ADR-012 guard the Billing area added as <c>BillingConventionTests.U_X6</c>.</summary>
public sealed class PortalConventionTests
{
    private static readonly Assembly[] ProductionAssemblies =
    [
        typeof(PortalSectionComposer).Assembly,                                  // Read
        typeof(AmarGramDbContext).Assembly,                                  // Infrastructure
        typeof(AmarGram.Shared.Common.Constants.PortalRules).Assembly,       // Shared
        typeof(AmarGram.Domain.Aggregates.Order.OrderAggregate).Assembly,    // Domain
        typeof(AmarGram.Application.Commands.Order.AddCartLineCommand).Assembly, // Application
    ];

    private static IEnumerable<Type> PortalTypes() =>
        ProductionAssemblies.SelectMany(a => a.GetTypes()).Where(t => t.Namespace is not null && t.Namespace.Contains(".Portal", StringComparison.Ordinal));

    // U-A1 -- ADR-257
    [Fact]
    public void U_A1_NoPortalTypeIsAnAggregate_AnEvent_AConfiguration_OrAnEventHandler()
    {
        var types = PortalTypes().ToList();
        Assert.NotEmpty(types);

        var offenders = types.Where(t =>
                typeof(AggregateRoot).IsAssignableFrom(t)
                || typeof(Event).IsAssignableFrom(t)
                || t.GetInterfaces().Any(i => i.IsGenericType && (
                    i.GetGenericTypeDefinition() == typeof(IEntityTypeConfiguration<>)
                    || i.GetGenericTypeDefinition() == typeof(IEventHandlerAsync<>))))
            .Select(t => t.FullName).ToList();

        Assert.True(offenders.Count == 0, "The Portal context owns no aggregate, event, configuration or event handler: " + string.Join(", ", offenders));
    }

    [Fact]
    public void U_A1_ThereIsNoPortalSchemaTableOrDbSet()
    {
        Assert.DoesNotContain(typeof(AmarGramDbContext).GetProperties(), p => p.Name.StartsWith("Portal", StringComparison.Ordinal));
        var configurations = typeof(AmarGramDbContext).Assembly.GetTypes().Where(t => t.Name.StartsWith("Portal", StringComparison.Ordinal));
        Assert.Empty(configurations);
    }

    // U-A2 -- ADR-258
    [Fact]
    public void U_A2_NoPortalQueryHandlerOrReaderTakesADbContext_ADispatcher_OrARepository()
    {
        var types = typeof(PortalSectionComposer).Assembly.GetTypes()
            .Where(t => t.Namespace is not null && t.Namespace.StartsWith("AmarGram.Read.QueryHandlers.Portal", StringComparison.Ordinal)
                        && !t.IsAbstract && !t.IsNested && !(t.Name.StartsWith('<')))
            .ToList();
        Assert.True(types.Count >= 6, "Expected the composer, handler and readers; found " + types.Count);

        var offenders = new List<string>();
        foreach (var type in types)
            foreach (var constructor in type.GetConstructors())
                foreach (var parameter in constructor.GetParameters())
                {
                    var parameterType = parameter.ParameterType;
                    var name = parameterType.Name;
                    var generic = parameterType.IsGenericType ? parameterType.GetGenericTypeDefinition().Name : name;
                    if (typeof(DbContext).IsAssignableFrom(parameterType)
                        || name.Contains("Dispatcher", StringComparison.Ordinal)
                        || generic.StartsWith("IAggregateRootRepository", StringComparison.Ordinal)
                        || name.Contains("Repository", StringComparison.Ordinal)
                        || name.Contains("DbContext", StringComparison.Ordinal))
                        offenders.Add($"{type.Name}({name} {parameter.Name})");
                }

        Assert.True(offenders.Count == 0, "Portal composers take upstream query HANDLERS only (ADR-258): " + string.Join(", ", offenders));
    }

    // U-A3 -- ADR-259: the portal's own shapes hold no other module's ViewModel
    [Fact]
    public void U_A3_NoPortalViewModelHoldsAnotherModulesViewModel_Recursively()
    {
        var portalViewModels = typeof(PortalSection<>).Assembly.GetTypes()
            .Where(t => t.Namespace == typeof(PortalSection<>).Namespace && t.Name.StartsWith("Portal", StringComparison.Ordinal))
            .ToList();
        Assert.True(portalViewModels.Count >= 8);

        var offenders = new List<string>();
        var seen = new HashSet<Type>();
        foreach (var type in portalViewModels) Visit(type, type.Name, offenders, seen);

        Assert.True(offenders.Count == 0, "A Portal ViewModel exposes a type it does not own: " + string.Join(", ", offenders));
    }

    private static void Visit(Type type, string path, List<string> offenders, HashSet<Type> seen)
    {
        if (!seen.Add(type)) return;

        foreach (var property in type.GetProperties(BindingFlags.Public | BindingFlags.Instance))
            foreach (var leaf in Leaves(property.PropertyType).Where(l => !l.IsGenericParameter))
            {
                var label = $"{path}.{property.Name}:{leaf.Name}";
                if (leaf.Namespace == typeof(PortalSection<>).Namespace)
                {
                    if (!leaf.Name.StartsWith("Portal", StringComparison.Ordinal)) offenders.Add(label);
                    else Visit(leaf, $"{path}.{property.Name}", offenders, seen);
                }
                else if (leaf.Namespace is not null && leaf.Namespace.StartsWith("AmarGram.", StringComparison.Ordinal)
                         && leaf.Namespace != "AmarGram.Shared.Common.Enums")
                {
                    offenders.Add(label);
                }
            }
    }

    private static IEnumerable<Type> Leaves(Type type)
    {
        type = Nullable.GetUnderlyingType(type) ?? type;
        if (type.IsGenericType)
        {
            foreach (var argument in type.GetGenericArguments())
                foreach (var leaf in Leaves(argument)) yield return leaf;
            if (type.Namespace == typeof(PortalSection<>).Namespace) yield return type.GetGenericTypeDefinition();
        }
        else if (type.IsArray) { foreach (var leaf in Leaves(type.GetElementType()!)) yield return leaf; }
        else yield return type;
    }

    // ADR-012 / BillingConventionTests.U_X6 -- the read side never rehydrates an aggregate; the portal read side touches no database at all
    [Fact]
    public void U_X6_ThePortalReadSide_TouchesNoDatabase_NeverLoadsAnAggregate_AndNeverFansOutInParallel()
    {
        var directory = Path.Combine(RepositoryRoot(), "src", "Read", "AmarGram.Read", "QueryHandlers", "Portal");
        var files = Directory.EnumerateFiles(directory, "*.cs", SearchOption.AllDirectories).ToList();
        Assert.True(files.Count >= 7);

        var wholeEntity = new Regex(@"AsNoTracking\(\)\s*\.\s*(FirstOrDefaultAsync|SingleOrDefaultAsync|SingleAsync|FirstAsync)\s*\(");
        string[] forbiddenText =
            ["AmarGramDbContext", "DbSet", ".ToDictionaryAsync", ".AsNoTracking", "Task.WhenAll", "Task.WhenAny", "Parallel.", "IInMemoryDispatcher", "IAggregateRootRepository"];

        var offenders = files
            .Select(f => (File: Path.GetFileName(f), Text: File.ReadAllText(f)))
            .Where(f => wholeEntity.IsMatch(f.Text) || forbiddenText.Any(f.Text.Contains))
            .Select(f => f.File).ToList();

        Assert.True(offenders.Count == 0, "These Portal read files touch a database, rehydrate an aggregate or fan out: " + string.Join(", ", offenders));
    }

    // ADR-260 -- the dashboard path has one catch site
    [Fact]
    public void ADR_260_OnlyTheComposerCatchesExceptions()
    {
        var directory = Path.Combine(RepositoryRoot(), "src", "Read", "AmarGram.Read", "QueryHandlers", "Portal");
        var catchers = Directory.EnumerateFiles(directory, "*.cs", SearchOption.AllDirectories)
            .Where(f => Regex.IsMatch(File.ReadAllText(f), @"catch\s*\(\s*Exception")).Select(Path.GetFileName).Order(StringComparer.Ordinal).ToList();

        Assert.Equal(["PortalSectionComposer.cs"], catchers);
    }

    [Fact]
    public void TheDashboardMessagesAreGuidanceOnly_NoPayLinkAnywhereInThePortalConstants()
    {
        var constants = typeof(AmarGram.Shared.Common.Constants.PortalMessages).GetFields(BindingFlags.Public | BindingFlags.Static).Select(f => f.Name);
        Assert.DoesNotContain(constants, n => n.Contains("Link", StringComparison.OrdinalIgnoreCase) || n.Contains("Url", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("cash or card, or by bank transfer", AmarGram.Shared.Common.Constants.PortalMessages.HowToPayOffline);
    }

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "AmarGram.sln")))
            directory = directory.Parent;

        return directory?.FullName ?? throw new InvalidOperationException("AmarGram.sln was not found above the test binaries.");
    }
}
