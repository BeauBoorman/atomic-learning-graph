import { resolve } from "node:path";
import { D2L_COMMIT, D2L_TAG } from "./corpus";
import { verifyCorpus } from "./verify-corpus-lib";

const result = await verifyCorpus({
  repoRoot: resolve(import.meta.dirname, ".."),
  verifyUpstream: process.env.VERIFY_UPSTREAM === "1",
});

if (process.env.VERIFY_UPSTREAM === "1") {
  console.log("Verified pinned corpus and license bytes against upstream.");
} else {
  console.log("Skipped upstream re-fetch (set VERIFY_UPSTREAM=1 to enable it).");
}
console.log(`Verified ${result.entryCount} committed d2l sources at ${D2L_TAG} (${D2L_COMMIT}).`);
