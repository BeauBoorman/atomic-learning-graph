import { describe, expect, it } from "vitest";
import type { AtomizedConcept } from "../types";
import { dedupeCandidates } from "./dedupe";

describe("dedupeCandidates", () => {
  it("is a passthrough seam until semantic deduplication lands", async () => {
    const concepts: AtomizedConcept[] = [
      {
        id: "one-concept",
        title: "One concept",
        summary: "One concept summary.",
        provenance: {
          sourceId: "source",
          quotedText: "This is a substantial grounded quote copied directly from the source.",
        },
        tags: ["test"],
        prerequisites: [],
        related: [],
      },
    ];

    await expect(dedupeCandidates(concepts)).resolves.toBe(concepts);
  });
});
