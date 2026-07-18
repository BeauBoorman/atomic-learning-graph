import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { verifySingleArtifact } from "./verify-single";

const temporaryDirectories: string[] = [];

function artifact(html: string, extraFiles: Record<string, string> = {}): string {
  const directory = mkdtempSync(join(tmpdir(), "atomic-learning-graph-single-"));
  temporaryDirectories.push(directory);
  writeFileSync(join(directory, "index.html"), html);
  for (const [path, contents] of Object.entries(extraFiles)) {
    const absolutePath = join(directory, path);
    mkdirSync(join(absolutePath, ".."), { recursive: true });
    writeFileSync(absolutePath, contents);
  }
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("verifySingleArtifact", () => {
  it("accepts one HTML file with inline CSS and JavaScript", () => {
    const directory = artifact(
      "<!doctype html><html><head><style>body{color:#111}</style></head>" +
        "<body><div id=\"root\"></div><script>document.body.dataset.ready='yes'</script></body></html>",
    );

    expect(() => verifySingleArtifact(directory)).not.toThrow();
  });

  it.each([
    ["external script", '<script src="./app.js"></script>'],
    ["external stylesheet", '<link rel="stylesheet" href="./app.css">'],
    ["image source", '<img src="data:image/png;base64,AAAA">'],
    ["CSS URL", "<style>.hero{background:url('./hero.png')}</style>"],
    ["CSS import", "<style>@import './theme.css';</style>"],
  ])("rejects an %s reference", (_label, poison) => {
    const directory = artifact(
      `<!doctype html><html><head>${poison}</head><body><script>document.body.hidden=false</script></body></html>`,
    );

    expect(() => verifySingleArtifact(directory)).toThrow(/external resource reference/);
  });

  it("rejects a resource reference created by bundled JavaScript", () => {
    const directory = artifact(
      "<!doctype html><html><head><style>body{color:#111}</style></head>" +
        '<body><script>(0,h.jsx)("img",{src:"./hero.png"})</script></body></html>',
    );

    expect(() => verifySingleArtifact(directory)).toThrow(/external resource reference/);
  });

  it.each([
    ["request client", ["fet", "ch("].join("")],
    ["XHR client", ["XML", "HttpRequest"].join("")],
    ["socket client", ["Web", "Socket"].join("")],
    ["event-stream client", ["Event", "Source"].join("")],
    ["beacon client", ["send", "Beacon"].join("")],
  ])("rejects a %s signature", (_label, signature) => {
    const directory = artifact(
      `<!doctype html><html><head><style>body{color:#111}</style></head><body><script>${signature}</script></body></html>`,
    );

    expect(() => verifySingleArtifact(directory)).toThrow(/network client/);
  });

  it("rejects any second file", () => {
    const directory = artifact(
      "<!doctype html><html><head><style>body{color:#111}</style></head>" +
        "<body><script>document.body.hidden=false</script></body></html>",
      { "assets/app.js": "document.body.hidden=false" },
    );

    expect(() => verifySingleArtifact(directory)).toThrow(/exactly one file/);
  });

  it("rejects HTML without inline CSS or JavaScript", () => {
    expect(() => verifySingleArtifact(artifact("<!doctype html><html><body></body></html>"))).toThrow(
      /inline CSS/,
    );
    expect(() =>
      verifySingleArtifact(
        artifact("<!doctype html><html><head><style>body{color:#111}</style></head><body></body></html>"),
      ),
    ).toThrow(/inline JavaScript/);
  });
});
