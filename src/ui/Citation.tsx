import type { ResolvedPassage } from "./model";

const licenseUrls: Record<string, string> = {
  "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC-BY-SA-4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
};

export function Passage({ passage, quote }: { passage: string; quote: string }) {
  const quoteIndex = passage.indexOf(quote);
  if (quoteIndex < 0) return <>{passage}</>;
  return (
    <>
      {passage.slice(0, quoteIndex)}
      <mark>{quote}</mark>
      {passage.slice(quoteIndex + quote.length)}
    </>
  );
}

export function Citation({ resolved }: { resolved: ResolvedPassage }) {
  const { source } = resolved;
  const title = source.url
    ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
    : source.title;
  const licenseUrl = licenseUrls[source.license];
  const license = licenseUrl
    ? <a href={licenseUrl} target="_blank" rel="noreferrer">{source.license}</a>
    : source.license;

  return (
    <section className="citation" aria-label="Lesson source">
      <p className="attribution">
        AI-translated from {title} by {source.author}. Licensed {license}.
      </p>
      <details>
        <summary>Show the source</summary>
        <blockquote cite={source.url}>
          <Passage passage={resolved.passage} quote={resolved.quote} />
        </blockquote>
        {resolved.context !== resolved.passage && (
          <p className="source-context"><strong>Nearby context:</strong> {resolved.context}</p>
        )}
        <p className="citation-note">The highlighted words are copied from the source. The lesson above is a plain-language translation.</p>
      </details>
    </section>
  );
}
