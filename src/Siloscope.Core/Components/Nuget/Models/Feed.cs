namespace Siloscope.Core.Nuget.Store;

public class Feed
{
    public required string Name { get; set; }
    public required string Url { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
    public bool? IsPasswordClearText { get; set; }
}
