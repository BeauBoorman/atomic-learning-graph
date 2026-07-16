import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..", "..");
const read = (path: string): string => readFileSync(resolve(root, path), "utf8");
const uiRuntimeFiles = globSync("src/ui/**/*.{ts,tsx}", {
  cwd: root,
  exclude: ["src/ui/**/*.test.*"],
});

function rootThemeTokens(css: string, theme?: string): Record<string, string> {
  const selector = theme === undefined ? ":root" : `:root[data-theme="${theme}"]`;
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2].trim(),
    ]),
  );
}

describe("Gate 9 architecture", () => {
  it("loads the committed graph at build time through loadGraph", () => {
    const config = read("vite.config.ts");
    expect(config).toContain('import { loadGraph } from "./src/graph/load"');
    expect(config).toContain("const graph = loadGraph()");
    expect(read("src/ui/main.tsx")).toContain("__LEARNING_GRAPH__");
  });

  it("keeps every browser interaction free of network clients", () => {
    const runtime = uiRuntimeFiles.map(read).join("\n");

    const networkClients = [
      "fetch" + "(",
      "XMLHttp" + "Request",
      "Web" + "Socket",
      "Event" + "Source",
      "send" + "Beacon",
      "open" + "ai",
    ];
    for (const client of networkClients) expect(runtime.toLowerCase()).not.toContain(client.toLowerCase());
  });

  it("computes the dark background token for the dark theme", () => {
    const css = read("src/ui/styles.css");
    const computedDarkTokens = {
      ...rootThemeTokens(css),
      ...rootThemeTokens(css, "dark"),
    };

    expect(computedDarkTokens["--bg"]).toBe("#0d1712");
  });

  it("routes progress through the deterministic path module", () => {
    const model = read("src/ui/model.ts");
    expect(model).toContain('import { getPath } from "../graph/path"');
    expect(model.match(/getPath\(/g)?.length).toBe(2);
  });
});
