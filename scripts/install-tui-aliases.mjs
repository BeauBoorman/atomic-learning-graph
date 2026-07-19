import { chmod, lstat, mkdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultLauncher = resolve(repoRoot, "builder", "tui.mjs");
const aliases = ["atomic-learning", "alg"];
const windowsMarker = "REM Atomic Learning Graph managed launcher";

async function pathKind(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return undefined;
    throw error;
  }
}

function isManagedTuiTarget(target, linkPath) {
  const absolute = resolve(dirname(linkPath), target);
  return absolute.endsWith(`${join("builder", "tui.mjs")}`);
}

async function installUnixAlias(alias, binDir, launcherPath) {
  const linkPath = resolve(binDir, alias);
  const existing = await pathKind(linkPath);
  if (existing) {
    if (!existing.isSymbolicLink()) return { alias, status: "skipped", reason: "existing file" };
    const target = await readlink(linkPath);
    if (!isManagedTuiTarget(target, linkPath)) {
      return { alias, status: "skipped", reason: "unrelated symbolic link" };
    }
    await rm(linkPath);
  }
  await symlink(relative(binDir, launcherPath), linkPath);
  return { alias, status: "installed", path: linkPath };
}

async function installWindowsAlias(alias, binDir, launcherPath, nodePath) {
  const commandPath = resolve(binDir, `${alias}.cmd`);
  const existing = await pathKind(commandPath);
  if (existing) {
    if (!existing.isFile()) return { alias, status: "skipped", reason: "existing non-file" };
    const contents = await readFile(commandPath, "utf8");
    if (!contents.startsWith(windowsMarker)) {
      return { alias, status: "skipped", reason: "existing file" };
    }
  }
  const command = [
    windowsMarker,
    "@echo off",
    `"${nodePath}" "${launcherPath}" %*`,
    "",
  ].join("\r\n");
  await writeFile(commandPath, command, "utf8");
  return { alias, status: "installed", path: commandPath };
}

/** Install only the two named launchers, preserving any unrelated command at either path. */
export async function installTuiAliases({
  platform = process.platform,
  launcherPath = defaultLauncher,
  binDir = process.env.ALG_BIN_DIR || (
    platform === "win32"
      ? resolve(process.env.LOCALAPPDATA || homedir(), "Microsoft", "WindowsApps")
      : resolve(homedir(), ".local", "bin")
  ),
  nodePath = process.execPath,
  pathValue = process.env.PATH ?? "",
} = {}) {
  await mkdir(binDir, { recursive: true });
  if (platform !== "win32") await chmod(launcherPath, 0o755);
  const results = [];
  for (const alias of aliases) {
    results.push(
      platform === "win32"
        ? await installWindowsAlias(alias, binDir, launcherPath, nodePath)
        : await installUnixAlias(alias, binDir, launcherPath),
    );
  }
  const pathEntries = pathValue.split(delimiter).filter(Boolean).map((entry) => resolve(entry));
  return { binDir, onPath: pathEntries.includes(resolve(binDir)), results };
}

async function main() {
  if (process.env.CI && !process.env.ALG_INSTALL_TUI_ALIASES) {
    console.log("Skipped user command installation in CI; package bin aliases remain available.");
    return;
  }
  const result = await installTuiAliases();
  const installed = result.results.filter(({ status }) => status === "installed").map(({ alias }) => alias);
  const skipped = result.results.filter(({ status }) => status === "skipped");
  if (installed.length > 0) {
    console.log(`Installed terminal commands in ${result.binDir}: ${installed.join(", ")}`);
  }
  for (const item of skipped) {
    console.warn(`Kept existing ${item.alias} command (${item.reason}); use pnpm tui instead.`);
  }
  if (!result.onPath) {
    console.warn(`${result.binDir} is not currently on PATH; use pnpm tui until it is added.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.warn(`Could not install terminal aliases: ${error instanceof Error ? error.message : error}`);
    console.warn("The TUI is still available as pnpm tui.");
  });
}
