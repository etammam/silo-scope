import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(scriptDirectory, "..");
const repoRoot = resolve(desktopRoot, "..", "..");
const coreProject = join(repoRoot, "src", "Siloscope.Core", "Siloscope.Core.csproj");
const outputDirectory = join(desktopRoot, "resources", "core");
const runtime = resolveRuntime();

if (!existsSync(coreProject)) {
	throw new Error(`SiloScope Core project not found at ${coreProject}`);
}

rmSync(outputDirectory, { force: true, recursive: true });
mkdirSync(outputDirectory, { recursive: true });

const publish = spawnSync(
	"dotnet",
	[
		"publish",
		coreProject,
		"--configuration",
		"Release",
		"--runtime",
		runtime,
		"--self-contained",
		"true",
		"--output",
		outputDirectory,
		"-p:PublishSingleFile=true",
		"-p:IncludeNativeLibrariesForSelfExtract=true",
	],
	{
		cwd: repoRoot,
		stdio: "inherit",
	},
);

if (publish.status !== 0) {
	throw new Error(`Failed to publish SiloScope Core for ${runtime}.`);
}

function resolveRuntime(): string {
	const os = process.env["ELECTROBUN_OS"] ?? process.platform;
	const arch = process.env["ELECTROBUN_ARCH"] ?? process.arch;

	if (os === "macos" || os === "darwin") {
		return arch === "arm64" ? "osx-arm64" : "osx-x64";
	}

	if (os === "win" || os === "win32") {
		return arch === "arm64" ? "win-arm64" : "win-x64";
	}

	return arch === "arm64" ? "linux-arm64" : "linux-x64";
}
