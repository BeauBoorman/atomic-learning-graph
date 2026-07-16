import { createHash } from "node:crypto";

export const WIKIPEDIA_LICENSE_STATEMENT =
  "Text is available under the Creative Commons Attribution-ShareAlike 4.0 License";
export const WIKIPEDIA_LICENSE_NAME =
  "Creative Commons Attribution-ShareAlike 4.0 License";
export const CC_BY_SA_4_DEED = "https://creativecommons.org/licenses/by-sa/4.0/";

export interface LicenseEvidence {
  url: string;
  statement: string;
  licenseName: string;
}

export interface AuditedSourceEntry {
  id: string;
  title: string;
  url: string;
  license: string;
  textPath: string;
  sha256: string;
  author: string;
  licenseEvidence: LicenseEvidence;
  modifications: string;
  licenseDeed: string;
}

export function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function checkedFetch(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "atomic-learning-graph corpus verifier/0.1 (https://github.com/; educational build)",
    },
  });
  if (!response.ok) {
    throw new Error(`corpus fetch failed: ${response.status} ${response.statusText} for ${url}`);
  }
  return response;
}

export async function fetchWikipediaExtract(revision: string): Promise<string> {
  if (!/^\d+$/.test(revision)) {
    throw new Error(`Wikipedia revision must be numeric, received ${JSON.stringify(revision)}`);
  }

  const params = new URLSearchParams({
    action: "query",
    prop: "extracts",
    explaintext: "1",
    format: "json",
    formatversion: "2",
    revids: revision,
  });
  const response = await checkedFetch(`https://en.wikipedia.org/w/api.php?${params}`);
  const raw = (await response.json()) as {
    query?: { pages?: Array<{ missing?: boolean; extract?: unknown }> };
  };
  const page = raw.query?.pages?.[0];
  if (!page || page.missing || typeof page.extract !== "string" || page.extract.length === 0) {
    throw new Error(`Wikipedia revision ${revision} did not resolve to a non-empty plain-text extract`);
  }
  return page.extract;
}

export function wikipediaRevision(url: string): string | undefined {
  const parsed = new URL(url);
  if (parsed.hostname !== "en.wikipedia.org") return undefined;
  const oldid = parsed.searchParams.get("oldid") ?? undefined;
  return oldid && /^\d+$/.test(oldid) ? oldid : undefined;
}

export async function fetchPinnedText(url: string): Promise<string> {
  const wikipediaOldid = wikipediaRevision(url);
  if (wikipediaOldid) return fetchWikipediaExtract(wikipediaOldid);

  const parsed = new URL(url);
  if (parsed.hostname === "raw.githubusercontent.com") {
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 4 || !/^[0-9a-f]{40}$/i.test(segments[2] ?? "")) {
      throw new Error(`raw GitHub source is not pinned to a 40-hex commit: ${url}`);
    }
    return (await checkedFetch(url)).text();
  }

  throw new Error(`unsupported or unpinned corpus URL: ${url}`);
}

export async function verifyLicenseEvidence(entry: AuditedSourceEntry): Promise<void> {
  const response = await checkedFetch(entry.licenseEvidence.url);
  const page = await response.text();
  if (!page.includes(entry.licenseEvidence.licenseName)) {
    throw new Error(
      `licence evidence no longer contains ${JSON.stringify(entry.licenseEvidence.licenseName)}: ` +
        entry.licenseEvidence.url
    );
  }
}

export function renderAttributions(entries: AuditedSourceEntry[]): string {
  const sections = entries.map(
    (entry) => `## ${entry.title}

- Source: [pinned revision](${entry.url})
- Author: ${entry.author}
- Licence: \`${entry.license}\` ([licence deed](${entry.licenseDeed}))
- Licence evidence: [CC statement on the pinned page](${entry.licenseEvidence.url}) — “${entry.licenseEvidence.statement}.”
- Stored text SHA-256: \`${entry.sha256}\`
- Modifications made: ${entry.modifications}
`
  );

  return `# Attributions

The source texts under \`data/oer/\` are redistributed under their source licences. The project
code is separately licensed under MIT; see \`LICENSE\` and \`DATA-LICENSE\`.

${sections.join("\n")}`;
}
