// THE SHIPPED-BYTES GATE for the no-network browser claim.
//
// The fast source check in src/ui/gate9.test.ts gives developers a precise file-level failure,
// but a source-directory boundary is not a browser boundary: index.html is the real Vite entry,
// UI code imports runtime modules from other directories, and Vite may add or split code and CSS
// while building. This verifier runs AFTER the build and scans emitted JavaScript, HTML and CSS.
// Those are the bytes a learner actually downloads, so this is the evidence boundary for the
// claim that reading a lesson cannot start a network client or load a remote asset.
import { resolve } from "node:path";
import { verifyBundle } from "./verify-bundle-lib";

const result = verifyBundle(resolve(import.meta.dirname, ".."));
console.log(
  `Verified ${result.javascriptChunks} JavaScript, ${result.htmlFiles} HTML, and ` +
    `${result.cssFiles} CSS file(s): no network clients, model vendor, or remote assets.`,
);
