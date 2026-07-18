import { Buffer } from "node:buffer";

/**
 * Build a pnpm subprocess invocation without asking Node to execute a Windows .cmd shim directly.
 *
 * Windows PowerShell is explicit here rather than `shell: true`: pnpm's arguments are serialized,
 * UTF-16/base64 encoded, decoded into an array in the child, and splatted as distinct arguments.
 * User-controlled paths therefore never become shell source and retain spaces and Unicode exactly.
 */
export function pnpmSpawnInvocation(args, { platform = process.platform } = {}) {
  if (platform !== "win32") {
    return { command: "pnpm", args: [...args], spawnOptions: {} };
  }

  const encodedArgs = Buffer.from(JSON.stringify(args), "utf16le").toString("base64");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$pnpmArgs = ConvertFrom-Json ([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encodedArgs}')))`,
    "& pnpm @pnpmArgs",
    "exit $LASTEXITCODE",
  ].join("; ");

  return {
    command: "powershell.exe",
    args: [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
    ],
    spawnOptions: { windowsHide: true },
  };
}
