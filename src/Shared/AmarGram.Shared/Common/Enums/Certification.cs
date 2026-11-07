namespace AmarGram.Shared.Common.Enums;

/// <summary>HO-P2 §1.3 -- a food product's certifications and claims (multi-select, food only). <see cref="CertifiedOrganic"/> needs the organic certifier and certificate
/// number in the food details before the product can be published.</summary>
public sealed class Certification(int value, string displayName) : Enumeration(value, displayName)
{
    public static readonly Certification CertifiedOrganic = new(1, nameof(CertifiedOrganic));
    public static readonly Certification PesticideFree = new(2, nameof(PesticideFree));
    public static readonly Certification Traditional = new(3, nameof(Traditional));
    public static readonly Certification Halal = new(4, nameof(Halal));
}
