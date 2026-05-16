using System.Diagnostics.CodeAnalysis;

namespace Siloscope.Core.Nuget.Models;

public class NugetFeedSourceAuthentication
{
    [SetsRequiredMembers]
    public NugetFeedSourceAuthentication(string username, string password, bool isPasswordClearText)
    {
        Username = username;
        Password = password;
        IsPasswordClearText = isPasswordClearText;
    }

    public required string Username { get; set; }
    public required string Password { get; set; }
    public required bool IsPasswordClearText { get; set; }
}

public class NugetFeedSource
{
    [SetsRequiredMembers]
    public NugetFeedSource(
        string sourceUrl,
        string name,
        bool persist,
        NugetFeedSourceAuthentication? credentials
    )
    {
        SourceUrl = sourceUrl;
        Name = name;
        Persist = persist;
        Credentials = credentials;
    }

    public required string SourceUrl { get; set; }
    public required string Name { get; set; }
    public NugetFeedSourceAuthentication? Credentials { get; set; }
    public required bool Persist { get; set; }
}
