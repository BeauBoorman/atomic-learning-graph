import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..", "..");
const read = (path: string): string => readFileSync(resolve(root, path), "utf8");

describe("Gate 9 architecture", () => {
  it("loads the committed graph at build time through loadGraph", () => {
    const config = read("vite.config.ts");
    expect(config).toContain('import { loadGraph } from "./src/graph/load"');
    expect(config).toContain("const graph = loadGraph()");
    expect(read("src/ui/main.tsx")).toContain("__LEARNING_GRAPH__");
  });

  it("keeps every browser interaction free of network clients", () => {
    const runtime = [
      read("src/ui/main.tsx"),
      read("src/ui/App.tsx"),
      read("src/ui/model.ts"),
    ].join("\n");

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

  it("routes progress through the deterministic path module", () => {
    const model = read("src/ui/model.ts");
    expect(model).toContain('import { getPath } from "../graph/path"');
    expect(model.match(/getPath\(/g)?.length).toBe(2);
  });
});
