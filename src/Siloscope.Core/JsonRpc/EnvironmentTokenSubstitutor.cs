using System.Text.RegularExpressions;

namespace Siloscope.Core.JsonRpc;

/// <summary>
/// Provides runtime substitution of <c>${env:KEY}</c> and <c>{{KEY}}</c> tokens using environment variable mappings.
/// </summary>
public static partial class EnvironmentTokenSubstitutor
{
    private static readonly Regex TokenRegex = GetTokenRegex();

    /// <summary>
    /// Extracts all unique environment token keys from the given text.
    /// </summary>
    /// <param name="text">The text to scan for tokens.</param>
    /// <returns>A list of unique token keys.</returns>
    public static IReadOnlyList<string> ExtractTokens(string text)
    {
        var matches = TokenRegex.Matches(text);
        var keys = new HashSet<string>(StringComparer.Ordinal);
        foreach (Match match in matches)
        {
            var key = !string.IsNullOrEmpty(match.Groups[1].Value)
                ? match.Groups[1].Value
                : match.Groups[2].Value;
            keys.Add(key);
        }
        return keys.ToList();
    }

    /// <summary>
    /// Substitutes all <c>${env:KEY}</c> and <c>{{KEY}}</c> tokens in the text with values from the provided map.
    /// </summary>
    /// <param name="text">The text containing tokens.</param>
    /// <param name="variables">The variable map to use for substitution.</param>
    /// <returns>The text with tokens replaced.</returns>
    public static string Substitute(string text, IReadOnlyDictionary<string, string> variables)
    {
        return TokenRegex.Replace(
            text,
            match =>
            {
                var key = !string.IsNullOrEmpty(match.Groups[1].Value)
                    ? match.Groups[1].Value
                    : match.Groups[2].Value;
                return variables.TryGetValue(key, out var value) ? value : match.Value;
            }
        );
    }

    /// <summary>
    /// Finds token keys present in the text that are missing from the provided variable map.
    /// </summary>
    /// <param name="text">The text to validate.</param>
    /// <param name="variables">The available variables.</param>
    /// <returns>A list of missing token keys.</returns>
    public static IReadOnlyList<string> FindMissing(
        string text,
        IReadOnlyDictionary<string, string> variables
    )
    {
        var tokens = ExtractTokens(text);
        return tokens.Where(token => !variables.ContainsKey(token)).ToList();
    }

    [GeneratedRegex(@"\$\{env:([^}]+)\}|\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}", RegexOptions.Compiled)]
    private static partial Regex GetTokenRegex();
}
