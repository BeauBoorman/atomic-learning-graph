import type { AtomizedConcept } from "../types";
import type { ResponsesClient } from "./client";

/**
 * SEAM. Semantic cross-chunk / cross-source merge is owned by a separate track (the dedup +
 * multisource window). Keep this signature stable; do not implement semantic merge here.
 */
export async function dedupeCandidates(
  concepts: AtomizedConcept[],
  _client?: ResponsesClient,
): Promise<AtomizedConcept[]> {
  return concepts;
}
