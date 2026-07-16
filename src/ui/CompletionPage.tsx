export function CompletionPage({ onRestart }: { onRestart: () => void }) {
  return (
    <main className="completion-page" id="main-content" aria-labelledby="completion-title">
      <p className="completion-mark" aria-hidden="true">✓</p>
      <p className="eyebrow">You reached your goal</p>
      <h1 id="completion-title">Course complete</h1>
      <p>You followed the ideas in order and reached the end of this path.</p>
      <button className="primary-button" type="button" onClick={onRestart}>Choose another goal</button>
    </main>
  );
}
