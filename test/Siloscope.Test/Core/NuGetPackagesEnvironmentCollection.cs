using Xunit;

namespace Siloscope.Test.Core;

/// <summary>
/// Groups tests that mutate the process-wide <c>NUGET_PACKAGES</c> environment variable.
/// xUnit runs test classes in parallel by default; these tests must be serialized against
/// each other because they read and write a shared environment variable.
/// </summary>
[CollectionDefinition(Name)]
public sealed class NuGetPackagesEnvironmentCollection
{
    public const string Name = "NuGet Packages Environment";
}
