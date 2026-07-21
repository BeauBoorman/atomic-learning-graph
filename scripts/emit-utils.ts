// Shared utilities for emit scripts. No project-specific logic.
import { readFileSync, writeFileSync } from "node:fs";

// Strip C0 control characters (U+0000–U+001F) except tab (U+0009),
// newline (U+000A), and carriage return (U+000D) from a string.
export function stripControlChars(text: string): string {
  return text
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/gu, "")
    .replace(/\u0003/gu, ""); // explicit ETX removal
}

// Read artifact text from a path.
export function readArtifact(path: string): string {
  return readFileSync(path, "utf8");
}

// Write artifact text to a path after stripping control chars.
export function writeCleanArtifact(path: string, text: string): void {
  writeFileSync(path, stripControlChars(text), "utf8");
}

// Assert no C0 control chars in a string (for regression tests).
export function assertNoControlChars(text: string, label: string): void {
  const ctrl = [...text].filter(c => c >= "\x00" && c <= "\x1f" && c !== "\t" && c !== "\n" && c !== "\r");
  if (ctrl.length > 0) {
    const hex = [...new Set(ctrl.map(c => c.charCodeAt(0).toString(16).padStart(2, "0")))].join(", ");
    throw new Error(`${label}: found ${ctrl.length} control char(s): U+00${hex}`);
  }
}
