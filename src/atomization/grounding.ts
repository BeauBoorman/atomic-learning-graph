/** Return the exact stored substring when a proposed quote differs only in whitespace. */
export function groundedQuote(sourceText: string, proposedQuote: string): string | undefined {
  const tokens = proposedQuote.trim().split(/\s+/u).filter(Boolean);
  if (tokens.length === 0) return undefined;
  const escaped = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"));
  const match = sourceText.match(new RegExp(escaped.join("\\s+"), "u"));
  return match?.[0];
}
