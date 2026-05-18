using System.Collections.Concurrent;
using System.Reflection;
using System.Runtime.Loader;
using FluentResults;
using Microsoft.Extensions.Logging;
using Siloscope.Core.Components.Nuget;
using Siloscope.Core.Configuration;

namespace Siloscope.Core.Interfaces;

public sealed class InterfaceCatalogLoader(
    ILogger<InterfaceCatalogLoader>? logger = null,
    INugetConnectionManager? nugetManager = null
)
{
    private readonly ILogger<InterfaceCatalogLoader>? _logger = logger;
    private readonly INugetConnectionManager? _nugetManager = nugetManager;

    public Result<InterfaceCatalog> LoadAll(IReadOnlyList<InterfaceEntry> entries)
    {
        var allGrains = new List<GrainInterfaceDescriptor>();
        var assemblyPaths = new List<string>();
        var sources = new List<InterfaceSourceDescriptor>();

        foreach (var (entry, index) in entries.Select((entry, index) => (entry, index)))
        {
            var legacySource = new InterfaceSourceOptions(
                entry.SourceType,
                entry.DllPath,
                entry.PackageId,
                entry.PackageVersion,
                entry.PackageRoot,
                entry.NugetConfigPath
            );

            var assemblyPathResult = ResolveAssemblyPath(legacySource);
            if (assemblyPathResult.IsFailed)
            {
                return Result.Fail(assemblyPathResult.Errors.Select(e => new Error(e.Message)));
            }

            var assemblyPath = assemblyPathResult.Value;
            assemblyPaths.Add(assemblyPath);
            var sourceId = entry.SourceId ?? BuildSourceId(entry, index);

            try
            {
                var defaultLoadResult = EnsureAssemblyLoadedInDefaultContext(
                    assemblyPath,
                    legacySource.NugetConfigPath
                );
                if (defaultLoadResult.IsFailed)
                {
                    return Result.Fail(defaultLoadResult.Errors.Select(e => new Error(e.Message)));
                }

                sources.Add(
                    new InterfaceSourceDescriptor(
                        sourceId,
                        entry.SourceType.ToString(),
                        GetSourceReference(entry),
                        GetSourceLabel(entry),
                        entry.PackageVersion,
                        entry.Gateway,
                        true,
                        assemblyPath
                    )
                );

                var grains = DiscoverGrainInterfaces(
                    defaultLoadResult.Value,
                    entry.Gateway,
                    sourceId
                );
                allGrains.AddRange(grains);
            }
            catch (Exception ex)
            {
                return Result.Fail(
                    $"Failed to load interface assembly '{assemblyPath}': {ex.Message}"
                );
            }
        }

        return Result.Ok(new InterfaceCatalog(allGrains, assemblyPaths, sources));
    }

    public Result<InterfaceCatalog> Load(InterfaceSourceOptions sourceOptions)
    {
        var assemblyPathResult = ResolveAssemblyPath(sourceOptions);
        if (assemblyPathResult.IsFailed)
        {
            return Result.Fail(assemblyPathResult.Errors.Select(e => new Error(e.Message)));
        }

        var assemblyPath = assemblyPathResult.Value;

        try
        {
            var defaultLoadResult = EnsureAssemblyLoadedInDefaultContext(
                assemblyPath,
                sourceOptions.NugetConfigPath
            );
            if (defaultLoadResult.IsFailed)
            {
                return Result.Fail(defaultLoadResult.Errors.Select(e => new Error(e.Message)));
            }

            var sourceId = BuildSourceId(
                new InterfaceEntry(
                    null,
                    sourceOptions.SourceType,
                    sourceOptions.DllPath,
                    sourceOptions.PackageId,
                    sourceOptions.PackageVersion,
                    sourceOptions.PackageRoot,
                    sourceOptions.NugetConfigPath
                ),
                0
            );
            var grains = DiscoverGrainInterfaces(defaultLoadResult.Value, gateway: null, sourceId);

            return Result.Ok(
                new InterfaceCatalog(
                    grains,
                    [assemblyPath],
                    [
                        new InterfaceSourceDescriptor(
                            sourceId,
                            sourceOptions.SourceType.ToString(),
                            sourceOptions.SourceType == InterfaceSourceType.Dll
                                ? sourceOptions.DllPath ?? assemblyPath
                                : sourceOptions.PackageId ?? assemblyPath,
                            sourceOptions.SourceType == InterfaceSourceType.Dll
                                ? Path.GetFileName(sourceOptions.DllPath ?? assemblyPath)
                                : sourceOptions.PackageId ?? Path.GetFileName(assemblyPath),
                            sourceOptions.PackageVersion,
                            null,
                            true,
                            assemblyPath
                        ),
                    ]
                )
            );
        }
        catch (Exception ex)
        {
            return Result.Fail($"Failed to load interface assembly '{assemblyPath}': {ex.Message}");
        }
    }

    private static Result<string> ResolveAssemblyPath(InterfaceSourceOptions options)
    {
        if (options.SourceType == InterfaceSourceType.Dll)
        {
            if (string.IsNullOrWhiteSpace(options.DllPath))
            {
                return Result.Fail("DLL source requires a --dll path.");
            }

            var fullPath = Path.GetFullPath(options.DllPath);
            if (!File.Exists(fullPath))
            {
                return Result.Fail($"Interface DLL not found: {fullPath}");
            }

            return Result.Ok(fullPath);
        }

        if (
            string.IsNullOrWhiteSpace(options.PackageId)
            || string.IsNullOrWhiteSpace(options.PackageVersion)
        )
        {
            return Result.Fail("NuGet source requires --package-id and --package-version.");
        }

        var packageRoot = ResolveNuGetRoot(options.PackageRoot);
        var packageFolder = Path.Combine(
            packageRoot,
            options.PackageId.ToLowerInvariant(),
            options.PackageVersion.ToLowerInvariant()
        );

        if (!Directory.Exists(packageFolder))
        {
            return Result.Fail(
                $"Package not found in local NuGet cache: {packageFolder}. Restore it first."
            );
        }

        var dll = FindPackageDll(packageFolder, options.PackageId);
        if (dll is null)
        {
            return Result.Fail($"Could not find a DLL in package folder: {packageFolder}");
        }

        return Result.Ok(dll);
    }

    private static string ResolveNuGetRoot(string? packageRoot)
    {
        if (!string.IsNullOrWhiteSpace(packageRoot))
        {
            return Path.GetFullPath(packageRoot);
        }

        var fromEnv = Environment.GetEnvironmentVariable("NUGET_PACKAGES");
        if (!string.IsNullOrWhiteSpace(fromEnv))
        {
            return Path.GetFullPath(fromEnv);
        }

        var userHome = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        return Path.Combine(userHome, ".nuget", "packages");
    }

    private static string? FindPackageDll(string packageFolder, string packageId)
    {
        var libDir = Path.Combine(packageFolder, "lib");
        if (!Directory.Exists(libDir))
        {
            return Directory
                .EnumerateFiles(packageFolder, "*.dll", SearchOption.AllDirectories)
                .FirstOrDefault();
        }

        var tfmDirs = Directory
            .EnumerateDirectories(libDir)
            .OrderByDescending(static d => d, StringComparer.OrdinalIgnoreCase)
            .ToList();

        foreach (var tfmDir in tfmDirs)
        {
            var preferred = Path.Combine(tfmDir, packageId + ".dll");
            if (File.Exists(preferred))
            {
                return preferred;
            }

            var first = Directory
                .EnumerateFiles(tfmDir, "*.dll", SearchOption.TopDirectoryOnly)
                .FirstOrDefault();
            if (first is not null)
            {
                return first;
            }
        }

        return null;
    }

    private static IReadOnlyList<GrainInterfaceDescriptor> DiscoverGrainInterfaces(
        Assembly assembly,
        string? gateway,
        string? sourceId
    )
    {
        return assembly
            .ExportedTypes.Where(static t =>
                t.IsInterface && typeof(IAddressable).IsAssignableFrom(t)
            )
            .OrderBy(static t => t.FullName, StringComparer.Ordinal)
            .Select(type => new GrainInterfaceDescriptor(
                type.FullName ?? type.Name,
                type,
                type.GetMethods()
                    .OrderBy(static m => m.Name, StringComparer.Ordinal)
                    .Select(static method => new GrainMethodDescriptor(
                        FormatMethodSignature(method),
                        method
                    ))
                    .ToList(),
                gateway,
                sourceId
            ))
            .ToList();
    }

    private static string BuildSourceId(InterfaceEntry entry, int index)
    {
        return $"{entry.SourceType}:{GetSourceReference(entry)}:{entry.PackageVersion ?? ""}:{entry.Gateway ?? ""}:{index}";
    }

    private static string GetSourceReference(InterfaceEntry entry)
    {
        return entry.SourceType == InterfaceSourceType.Dll
            ? entry.DllPath ?? string.Empty
            : entry.PackageId ?? string.Empty;
    }

    private static string GetSourceLabel(InterfaceEntry entry)
    {
        if (entry.SourceType == InterfaceSourceType.Dll)
        {
            return Path.GetFileName(entry.DllPath ?? string.Empty);
        }

        return entry.PackageVersion is null
            ? entry.PackageId ?? "NuGet package"
            : $"{entry.PackageId} {entry.PackageVersion}";
    }

    private static string FormatMethodSignature(MethodInfo method)
    {
        var returnType = FormatTypeName(method.ReturnType);
        var args = string.Join(
            ", ",
            method
                .GetParameters()
                .Where(static p => p.ParameterType != typeof(CancellationToken))
                .Select(p => $"{FormatTypeName(p.ParameterType)} {p.Name}")
        );
        return $"{returnType} {method.Name}({args})";
    }

    private static string FormatTypeName(Type type)
    {
        if (!type.IsGenericType)
        {
            return type.Name;
        }

        var baseName = type.Name;
        var tick = baseName.IndexOf('`');
        if (tick >= 0)
        {
            baseName = baseName[..tick];
        }

        var args = string.Join(", ", type.GetGenericArguments().Select(FormatTypeName));
        return $"{baseName}<{args}>";
    }

    private static Result<Assembly> EnsureAssemblyLoadedInDefaultContext(
        string assemblyPath,
        string? nugetConfigPath
    )
    {
        var fullPath = Path.GetFullPath(assemblyPath);
        DefaultContextDependencyResolver.RegisterProbe(fullPath, nugetConfigPath);

        var existing = AssemblyLoadContext.Default.Assemblies.FirstOrDefault(assembly =>
            string.Equals(assembly.Location, fullPath, StringComparison.OrdinalIgnoreCase)
        );

        if (existing is not null)
        {
            return Result.Ok(existing);
        }

        try
        {
            var loaded = AssemblyLoadContext.Default.LoadFromAssemblyPath(fullPath);
            return Result.Ok(loaded);
        }
        catch (FileNotFoundException)
        {
            var restoreResult = TryRestoreInferredProjectDependencies(fullPath, nugetConfigPath);
            if (restoreResult.IsFailed)
            {
                return Result.Fail(restoreResult.Errors.Select(e => new Error(e.Message)));
            }

            try
            {
                var loaded = AssemblyLoadContext.Default.LoadFromAssemblyPath(fullPath);
                return Result.Ok(loaded);
            }
            catch (Exception retryEx)
            {
                return Result.Fail(
                    $"Failed to load interface assembly into default runtime context '{fullPath}' after dependency restore: {retryEx.Message}"
                );
            }
        }
        catch (Exception ex)
        {
            return Result.Fail(
                $"Failed to load interface assembly into default runtime context '{fullPath}': {ex.Message}"
            );
        }
    }

    private static Result<bool> TryRestoreInferredProjectDependencies(
        string assemblyPath,
        string? nugetConfigPath
    )
    {
        var inferredProject = InferProjectPathFromBuildOutput(assemblyPath);
        if (inferredProject is null)
        {
            return Result.Fail(
                "Dependency restore failed: could not infer project file from interface DLL path."
            );
        }

        var effectiveNugetConfig = ResolveNugetConfigPath(nugetConfigPath);
        var restoreCommand = BuildRestoreCommand(inferredProject, effectiveNugetConfig);

        var startInfo = new System.Diagnostics.ProcessStartInfo
        {
            FileName = "/bin/zsh",
            Arguments = $"-lc \"{restoreCommand}\"",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = Path.GetDirectoryName(inferredProject)!,
        };

        using var process = System.Diagnostics.Process.Start(startInfo);
        if (process is null)
        {
            return Result.Fail(
                "Dependency restore failed: unable to start dotnet restore process."
            );
        }

        process.WaitForExit();
        if (process.ExitCode == 0)
        {
            return Result.Ok(true);
        }

        var stdErr = process.StandardError.ReadToEnd();
        var stdOut = process.StandardOutput.ReadToEnd();
        return Result.Fail(
            "Dependency restore failed."
                + (string.IsNullOrWhiteSpace(stdErr) ? string.Empty : $" stderr: {stdErr.Trim()}")
                + (string.IsNullOrWhiteSpace(stdOut) ? string.Empty : $" stdout: {stdOut.Trim()}")
        );
    }

    private static string BuildRestoreCommand(string projectPath, string? nugetConfigPath)
    {
        var quotedProject = QuoteForShell(projectPath);
        if (string.IsNullOrWhiteSpace(nugetConfigPath))
        {
            return $"dotnet restore {quotedProject}";
        }

        var quotedConfig = QuoteForShell(nugetConfigPath);
        return $"dotnet restore {quotedProject} --configfile {quotedConfig}";
    }

    private static string QuoteForShell(string value)
    {
        return "'" + value.Replace("'", "'\\''", StringComparison.Ordinal) + "'";
    }

    private static string? ResolveNugetConfigPath(string? configuredPath)
    {
        if (!string.IsNullOrWhiteSpace(configuredPath) && File.Exists(configuredPath))
        {
            return configuredPath;
        }

        Console.Write("Custom nuget.config path (press Enter to skip): ");
        var entered = Console.ReadLine();
        if (string.IsNullOrWhiteSpace(entered))
        {
            return null;
        }

        var full = Path.GetFullPath(entered);
        return File.Exists(full) ? full : null;
    }

    private static string? InferProjectPathFromBuildOutput(string assemblyPath)
    {
        var directory = new DirectoryInfo(Path.GetDirectoryName(assemblyPath)!);

        // bin/<configuration>/<tfm>
        var projectDirectory = directory.Parent?.Parent?.Parent;
        if (projectDirectory is null || !projectDirectory.Exists)
        {
            return null;
        }

        var expectedName = Path.GetFileNameWithoutExtension(assemblyPath) + ".csproj";
        var expectedPath = Path.Combine(projectDirectory.FullName, expectedName);
        if (File.Exists(expectedPath))
        {
            return expectedPath;
        }

        return projectDirectory
            .EnumerateFiles("*.csproj", SearchOption.TopDirectoryOnly)
            .OrderByDescending(static file => file.Name, StringComparer.OrdinalIgnoreCase)
            .Select(static file => file.FullName)
            .FirstOrDefault();
    }

    private static class DefaultContextDependencyResolver
    {
        private static readonly object Sync = new();
        private static readonly Dictionary<string, ProbeContext> Probes = new(
            StringComparer.OrdinalIgnoreCase
        );
        private static readonly ConcurrentDictionary<string, bool> RestoreAttempted = new(
            StringComparer.OrdinalIgnoreCase
        );
        private static readonly ConcurrentDictionary<string, string?> NugetPathCache = new(
            StringComparer.OrdinalIgnoreCase
        );
        private static bool _isRegistered;

        public static void RegisterProbe(string assemblyPath, string? nugetConfigPath)
        {
            var fullPath = Path.GetFullPath(assemblyPath);
            var probe = new ProbeContext(
                fullPath,
                Path.GetDirectoryName(fullPath) ?? Directory.GetCurrentDirectory(),
                new AssemblyDependencyResolver(fullPath),
                ResolveNuGetRoot(null),
                nugetConfigPath
            );

            lock (Sync)
            {
                Probes[fullPath] = probe;
                if (_isRegistered)
                {
                    return;
                }

                AssemblyLoadContext.Default.Resolving += OnResolving;
                _isRegistered = true;
            }
        }

        private static Assembly? OnResolving(AssemblyLoadContext context, AssemblyName assemblyName)
        {
            var alreadyLoaded = AssemblyLoadContext.Default.Assemblies.FirstOrDefault(assembly =>
                string.Equals(
                    assembly.GetName().Name,
                    assemblyName.Name,
                    StringComparison.OrdinalIgnoreCase
                )
            );
            if (alreadyLoaded is not null)
            {
                return alreadyLoaded;
            }

            ProbeContext[] probes;
            lock (Sync)
            {
                probes = Probes.Values.ToArray();
            }

            foreach (var probe in probes)
            {
                var resolved = ResolveForProbe(probe, assemblyName);
                if (resolved is not null)
                {
                    return resolved;
                }
            }

            foreach (var probe in probes)
            {
                if (!RestoreAttempted.TryAdd(probe.AssemblyPath, true))
                {
                    continue;
                }

                var restoreResult = TryRestoreInferredProjectDependencies(
                    probe.AssemblyPath,
                    probe.NugetConfigPath
                );
                if (!restoreResult.IsSuccess)
                {
                    continue;
                }

                var resolved = ResolveForProbe(probe, assemblyName);
                if (resolved is not null)
                {
                    return resolved;
                }
            }

            return null;
        }

        private static Assembly? ResolveForProbe(ProbeContext probe, AssemblyName assemblyName)
        {
            var resolvedByDeps = probe.Resolver.ResolveAssemblyToPath(assemblyName);
            if (!string.IsNullOrWhiteSpace(resolvedByDeps))
            {
                var fromDeps = TryLoadIntoDefaultContext(resolvedByDeps);
                if (fromDeps is not null)
                {
                    return fromDeps;
                }
            }

            var localPath = Path.Combine(probe.AssemblyDirectory, assemblyName.Name + ".dll");
            if (File.Exists(localPath))
            {
                var fromLocal = TryLoadIntoDefaultContext(localPath);
                if (fromLocal is not null)
                {
                    return fromLocal;
                }
            }

            if (IsRuntimeAssemblyName(assemblyName.Name))
            {
                return null;
            }

            var nugetPath = ResolveFromNuGetCache(probe.NugetRoot, assemblyName.Name);
            if (nugetPath is null)
            {
                return null;
            }

            return TryLoadIntoDefaultContext(nugetPath);
        }

        private static Assembly? TryLoadIntoDefaultContext(string assemblyPath)
        {
            var fullPath = Path.GetFullPath(assemblyPath);
            var existingByPath = AssemblyLoadContext.Default.Assemblies.FirstOrDefault(assembly =>
                string.Equals(assembly.Location, fullPath, StringComparison.OrdinalIgnoreCase)
            );
            if (existingByPath is not null)
            {
                return existingByPath;
            }

            try
            {
                return AssemblyLoadContext.Default.LoadFromAssemblyPath(fullPath);
            }
            catch
            {
                return null;
            }
        }

        private static string? ResolveFromNuGetCache(string nugetRoot, string? assemblySimpleName)
        {
            if (string.IsNullOrWhiteSpace(assemblySimpleName) || !Directory.Exists(nugetRoot))
            {
                return null;
            }

            var cacheKey = nugetRoot + "|" + assemblySimpleName;
            if (NugetPathCache.TryGetValue(cacheKey, out var cached))
            {
                return cached;
            }

            var packageFolder = Path.Combine(nugetRoot, assemblySimpleName.ToLowerInvariant());
            if (!Directory.Exists(packageFolder))
            {
                NugetPathCache[cacheKey] = null;
                return null;
            }

            var versions = Directory
                .EnumerateDirectories(packageFolder)
                .OrderByDescending(static path => path, StringComparer.OrdinalIgnoreCase)
                .ToList();

            foreach (var version in versions)
            {
                var libDir = Path.Combine(version, "lib");
                if (!Directory.Exists(libDir))
                {
                    continue;
                }

                var tfmDirs = Directory
                    .EnumerateDirectories(libDir)
                    .OrderByDescending(static path => ScoreTfm(path))
                    .ThenByDescending(static path => path, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                foreach (var tfmDir in tfmDirs)
                {
                    var candidate = Path.Combine(tfmDir, assemblySimpleName + ".dll");
                    if (!File.Exists(candidate))
                    {
                        continue;
                    }

                    NugetPathCache[cacheKey] = candidate;
                    return candidate;
                }
            }

            NugetPathCache[cacheKey] = null;
            return null;
        }

        private static bool IsRuntimeAssemblyName(string? assemblySimpleName)
        {
            if (string.IsNullOrWhiteSpace(assemblySimpleName))
            {
                return false;
            }

            return assemblySimpleName.StartsWith("System.", StringComparison.Ordinal)
                || assemblySimpleName.Equals("System", StringComparison.Ordinal)
                || assemblySimpleName.Equals("mscorlib", StringComparison.Ordinal)
                || assemblySimpleName.Equals("netstandard", StringComparison.Ordinal)
                || assemblySimpleName.Equals("Microsoft.CSharp", StringComparison.Ordinal);
        }

        private static int ScoreTfm(string tfmPath)
        {
            var tfm = Path.GetFileName(tfmPath).ToLowerInvariant();

            return tfm switch
            {
                "net10.0" => 100,
                "net9.0" => 90,
                "net8.0" => 80,
                "net7.0" => 70,
                "net6.0" => 60,
                "net5.0" => 50,
                "netcoreapp3.1" => 40,
                "netstandard2.1" => 30,
                "netstandard2.0" => 20,
                _ => 0,
            };
        }

        private sealed record ProbeContext(
            string AssemblyPath,
            string AssemblyDirectory,
            AssemblyDependencyResolver Resolver,
            string NugetRoot,
            string? NugetConfigPath
        );
    }

    private sealed class InterfaceAssemblyLoadContext(string mainAssemblyPath)
        : AssemblyLoadContext(isCollectible: false)
    {
        private readonly AssemblyDependencyResolver _resolver = new(mainAssemblyPath);
        private readonly string _mainAssemblyDirectory =
            Path.GetDirectoryName(mainAssemblyPath) ?? Directory.GetCurrentDirectory();
        private readonly string _nugetRoot = ResolveNuGetRoot();
        private readonly Dictionary<string, string?> _nugetPathCache = new(
            StringComparer.OrdinalIgnoreCase
        );

        protected override Assembly? Load(AssemblyName assemblyName)
        {
            var defaultLoaded = AssemblyLoadContext.Default.Assemblies.FirstOrDefault(assembly =>
                string.Equals(
                    assembly.GetName().Name,
                    assemblyName.Name,
                    StringComparison.OrdinalIgnoreCase
                )
            );
            if (defaultLoaded is not null)
            {
                return defaultLoaded;
            }

            var path = _resolver.ResolveAssemblyToPath(assemblyName);
            if (path is not null)
            {
                return LoadFromAssemblyPath(path);
            }

            var localPath = Path.Combine(_mainAssemblyDirectory, assemblyName.Name + ".dll");
            if (File.Exists(localPath))
            {
                return LoadFromAssemblyPath(localPath);
            }

            // Framework/runtime assemblies should always bind from the default runtime,
            // never from arbitrary NuGet cache assets.
            if (IsRuntimeAssembly(assemblyName.Name))
            {
                try
                {
                    return AssemblyLoadContext.Default.LoadFromAssemblyName(assemblyName);
                }
                catch
                {
                    return null;
                }
            }

            try
            {
                var fromDefault = AssemblyLoadContext.Default.LoadFromAssemblyName(assemblyName);
                if (fromDefault is not null)
                {
                    return fromDefault;
                }
            }
            catch
            {
                // Fall through to NuGet probing for non-runtime dependencies.
            }

            var nugetPath = ResolveFromNuGetCache(assemblyName.Name);
            if (nugetPath is not null)
            {
                return LoadFromAssemblyPath(nugetPath);
            }

            // Class library outputs often do not carry a deps.json, so fallback to
            // the default context where tool dependencies are already resolved.
            try
            {
                return AssemblyLoadContext.Default.LoadFromAssemblyName(assemblyName);
            }
            catch
            {
                return null;
            }
        }

        private string? ResolveFromNuGetCache(string? assemblySimpleName)
        {
            if (string.IsNullOrWhiteSpace(assemblySimpleName) || !Directory.Exists(_nugetRoot))
            {
                return null;
            }

            if (_nugetPathCache.TryGetValue(assemblySimpleName, out var cached))
            {
                return cached;
            }

            var packageFolder = Path.Combine(_nugetRoot, assemblySimpleName.ToLowerInvariant());
            if (!Directory.Exists(packageFolder))
            {
                _nugetPathCache[assemblySimpleName] = null;
                return null;
            }

            var versions = Directory
                .EnumerateDirectories(packageFolder)
                .OrderByDescending(static path => path, StringComparer.OrdinalIgnoreCase)
                .ToList();

            foreach (var version in versions)
            {
                var libDir = Path.Combine(version, "lib");
                if (!Directory.Exists(libDir))
                {
                    continue;
                }

                var tfmDirs = Directory
                    .EnumerateDirectories(libDir)
                    .OrderByDescending(static path => ScoreTfmFolder(path))
                    .ThenByDescending(static path => path, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                foreach (var tfmDir in tfmDirs)
                {
                    var candidate = Path.Combine(tfmDir, assemblySimpleName + ".dll");
                    if (!File.Exists(candidate))
                    {
                        continue;
                    }

                    _nugetPathCache[assemblySimpleName] = candidate;
                    return candidate;
                }
            }

            _nugetPathCache[assemblySimpleName] = null;
            return null;
        }

        private static string ResolveNuGetRoot()
        {
            var fromEnv = Environment.GetEnvironmentVariable("NUGET_PACKAGES");
            if (!string.IsNullOrWhiteSpace(fromEnv))
            {
                return Path.GetFullPath(fromEnv);
            }

            var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            return Path.Combine(home, ".nuget", "packages");
        }

        private static bool IsRuntimeAssembly(string? assemblySimpleName)
        {
            if (string.IsNullOrWhiteSpace(assemblySimpleName))
            {
                return false;
            }

            return assemblySimpleName.StartsWith("System.", StringComparison.Ordinal)
                || assemblySimpleName.Equals("System", StringComparison.Ordinal)
                || assemblySimpleName.Equals("mscorlib", StringComparison.Ordinal)
                || assemblySimpleName.Equals("netstandard", StringComparison.Ordinal)
                || assemblySimpleName.Equals("Microsoft.CSharp", StringComparison.Ordinal);
        }

        private static int ScoreTfmFolder(string tfmPath)
        {
            var tfm = Path.GetFileName(tfmPath).ToLowerInvariant();

            return tfm switch
            {
                "net10.0" => 100,
                "net9.0" => 90,
                "net8.0" => 80,
                "net7.0" => 70,
                "net6.0" => 60,
                "net5.0" => 50,
                "netcoreapp3.1" => 40,
                "netstandard2.1" => 30,
                "netstandard2.0" => 20,
                _ => 0,
            };
        }
    }
}
