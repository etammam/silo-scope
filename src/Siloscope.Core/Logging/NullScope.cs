namespace Siloscope.Core.Logging;

internal sealed class NullScope : IDisposable
{
    public static readonly NullScope Instance = new();

    public void Dispose() { }
}
