using AmarGram.Domain.DomainServices;
using AmarGram.Shared.Common.Constants;

namespace AmarGram.Application.Tests.TestSupport;

/// <summary>Wraps the shipped catalogue plus any test-only additions, exactly like the real
/// StaticNotificationTemplateCatalogue -- hand-written per the foundation handover §13 (no mocking library).</summary>
public sealed class FakeNotificationTemplateCatalogue : INotificationTemplateCatalogue
{
    private readonly List<NotificationTemplateDefinition> _all = [.. NotificationTemplateCatalogue.Definitions];

    public IReadOnlyList<NotificationTemplateDefinition> All => _all;

    public void Add(NotificationTemplateDefinition definition) => _all.Add(definition);

    public NotificationTemplateDefinition? Find(string key) => _all.FirstOrDefault(d => d.Key == key);
}
