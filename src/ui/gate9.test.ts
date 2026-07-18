import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..", "..");
const read = (path: string): string => readFileSync(resolve(root, path), "utf8");
const uiRuntimeFiles = globSync("src/ui/**/*.{css,ts,tsx}", {
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

function contrastRatio(first: string, second: string): number {
  const luminance = (hex: string) => {
    const channels = hex.match(/[\da-f]{2}/gi)?.map((channel) => Number.parseInt(channel, 16) / 255);
    if (!channels || channels.length !== 3) throw new Error(`expected six-digit hex color, received ${hex}`);
    const [red, green, blue] = channels.map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("Gate 9 architecture", () => {
  it("loads the committed graph at build time through loadGraph", () => {
    const config = read("vite.config.ts");
    expect(config).toContain('import { loadGraph } from "./src/graph/load"');
    expect(config).toContain("const graph = loadGraph()");
    expect(read("src/ui/main.tsx")).toContain("__LEARNING_GRAPH__");
  });

  it("loads committed renderings at build time through loadRenderings", () => {
    const config = read("vite.config.ts");
    expect(config).toContain('import { loadRenderings } from "./src/graph/load"');
    expect(config).toContain("const renderings = loadRenderings()");
    expect(config).toContain("__RENDERINGS__: JSON.stringify(renderings)");
    expect(read("src/ui/main.tsx")).toContain("__RENDERINGS__");
  });

  it("keeps every browser interaction free of network clients and remote CSS assets", () => {
    const runtime = uiRuntimeFiles.map(read).join("\n");
    const css = globSync("src/**/*.css", { cwd: root }).map(read).join("\n");

    const networkClients = [
      "fetch" + "(",
      "XMLHttp" + "Request",
      "Web" + "Socket",
      "Event" + "Source",
      "send" + "Beacon",
      "open" + "ai",
    ];
    for (const client of networkClients) expect(runtime.toLowerCase()).not.toContain(client.toLowerCase());
    
    // Assert no CSS imports, remote URLs, or protocol-relative paths
    const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(cssWithoutComments).not.toContain("@import");
    expect(cssWithoutComments).not.toMatch(/url\(\s*["']?(?:https?:)?\/\//i);
    expect(cssWithoutComments).not.toMatch(/@font-face\b[^}]*\bsrc\s*:[^}]*["'(](?:https?:)?\/\//is);
  });

  it("computes the dark background token for the dark theme", () => {
    const css = read("src/ui/styles.css");
    const computedDarkTokens = {
      ...rootThemeTokens(css),
      ...rootThemeTokens(css, "dark"),
    };

    // Retargeted from #0d1712 (the old green-black) to the Plain Reading Edition's warm black.
    // Kept, not deleted: a pinned dark --bg is a cheap tripwire against a palette revert, and
    // the real check is the contrast suite below. The zero-AI purpose of this gate is untouched.
    expect(computedDarkTokens["--bg"]).toBe("#14120e");
  });

  it("defines an explicit light theme that mirrors the default convention", () => {
    const css = read("src/ui/styles.css");
    const defaults = rootThemeTokens(css);
    const light = rootThemeTokens(css, "light");

    for (const token of ["--bg", "--surface", "--ink", "--muted", "--line", "--focus", "--primary", "--primary-ink", "--mark", "--mark-ink"]) {
      expect(light[token]).toBe(defaults[token]);
    }
    expect(css).toMatch(/:root\[data-theme="light"\]\s*\{[^}]*color-scheme:\s*light;/s);
    expect(css).toMatch(/:root\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark;/s);
  });

  it("keeps text, controls, focus, and cited marks at WCAG AA contrast in both themes", () => {
    const css = read("src/ui/styles.css");
    const themes = [rootThemeTokens(css, "light"), rootThemeTokens(css, "dark")];

    for (const tokens of themes) {
      expect(contrastRatio(tokens["--ink"], tokens["--bg"])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens["--muted"], tokens["--bg"])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens["--muted"], tokens["--surface"])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens["--primary-ink"], tokens["--primary"])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens["--mark-ink"], tokens["--mark"])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens["--line"], tokens["--bg"])).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(tokens["--line"], tokens["--surface"])).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(tokens["--focus"], tokens["--bg"])).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(tokens["--focus"], tokens["--surface"])).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(tokens["--primary"], tokens["--surface"])).toBeGreaterThanOrEqual(3);
    }
  });

  it("routes progress through the deterministic path module", () => {
    const model = read("src/ui/model.ts");
    expect(model).toContain('import { getPath } from "../graph/path"');
    expect(model.match(/getPath\(/g)?.length).toBe(1);
  });

  it("keeps self-explanation outside persistence, progression, and covered status", () => {
    const lesson = read("src/ui/LessonPage.tsx");
    const promptStart = lesson.indexOf("function SelfExplanation");
    const promptEnd = lesson.indexOf("function RenderingStep", promptStart);
    const promptComponent = lesson.slice(promptStart, promptEnd);
    expect(promptStart).toBeGreaterThanOrEqual(0);
    expect(promptEnd).toBeGreaterThan(promptStart);
    expect(promptComponent).not.toMatch(/\b(?:useState|localStorage|sessionStorage|onChange|onInput|required)\b/);
    expect(promptComponent).not.toContain("name=");

    const app = read("src/ui/App.tsx");
    const nextStart = app.indexOf("const handleNext");
    const nextEnd = app.indexOf("// None of these clear progress", nextStart);
    const nextHandler = app.slice(nextStart, nextEnd);
    expect(nextStart).toBeGreaterThanOrEqual(0);
    expect(nextEnd).toBeGreaterThan(nextStart);
    expect(nextHandler).not.toMatch(/explanation|response/i);

    const model = read("src/ui/model.ts");
    const coveredStart = model.indexOf("export function coveredConcepts");
    const coveredEnd = model.indexOf("export function selfExplanationPrompt", coveredStart);
    const coveredFunction = model.slice(coveredStart, coveredEnd);
    expect(coveredStart).toBeGreaterThanOrEqual(0);
    expect(coveredEnd).toBeGreaterThan(coveredStart);
    expect(coveredFunction).not.toMatch(/explanation|response/i);
  });
});
