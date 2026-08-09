// Patches CFBundleName in the dev Electron binary so the macOS app menu
// shows the right name instead of "Electron". Only runs on macOS.
// Triggered automatically by the "postinstall" script in package.json.
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

if (process.platform !== "darwin") process.exit(0);

const PLIST = join(__dirname, "..", "node_modules", "electron", "dist", "Electron.app", "Contents", "Info.plist");
const NAME = "SiloScope";

try {
  const xml = readFileSync(PLIST, "utf8");
  const replaced = xml.replace(
    /(<key>CFBundleName<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${NAME}$2`
  );
  if (replaced !== xml) {
    writeFileSync(PLIST, replaced);
    console.log(`[postinstall] CFBundleName → ${NAME}`);
  } else {
    console.log("[postinstall] CFBundleName already patched");
  }
} catch (err) {
  console.warn("[postinstall] Could not patch Electron plist:", err.message);
}
