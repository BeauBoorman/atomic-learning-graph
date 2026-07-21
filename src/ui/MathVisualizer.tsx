import { useState } from "react";

interface VectorVisualizerProps {
  // no props needed
}

function DotProductVisualizer() {
  const [vecA, setVecA] = useState<number[]>([2, -1, 3]);
  const [vecB, setVecB] = useState<number[]>([1, 4, 2]);

  const dotProduct = vecA[0] * vecB[0] + vecA[1] * vecB[1] + vecA[2] * vecB[2];

  const updateVec = (vector: "A" | "B", index: number, val: number) => {
    if (vector === "A") {
      setVecA((prev) => {
        const next = [...prev];
        next[index] = val;
        return next;
      });
    } else {
      setVecB((prev) => {
        const next = [...prev];
        next[index] = val;
        return next;
      });
    }
  };

  return (
    <div className="math-visualizer dot-product-viz" aria-label="Interactive dot product calculator">
      <h4>Interactive Dot Product Calculator</h4>
      <p className="viz-intro">The lesson describes the dot product in words — here you can do it. Drag the sliders and watch each matching pair get multiplied, then summed into one number.</p>
      
      <div className="vector-section">
        <div className="vector-row">
          <span className="vector-name">Vector A:</span>
          {vecA.map((val, idx) => (
            <div key={`a-${idx}`} className="vector-element font-mono">
              <span className="element-label">a{idx + 1} = {val.toFixed(1)}</span>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.5"
                value={val}
                onChange={(e) => updateVec("A", idx, parseFloat(e.target.value))}
                aria-label={`Vector A element ${idx + 1}`}
              />
            </div>
          ))}
        </div>

        <div className="vector-row">
          <span className="vector-name">Vector B:</span>
          {vecB.map((val, idx) => (
            <div key={`b-${idx}`} className="vector-element font-mono">
              <span className="element-label">b{idx + 1} = {val.toFixed(1)}</span>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.5"
                value={val}
                onChange={(e) => updateVec("B", idx, parseFloat(e.target.value))}
                aria-label={`Vector B element ${idx + 1}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="result-display font-mono">
        <div className="result-formula">
          ({vecA[0].toFixed(1)} × {vecB[0].toFixed(1)}) + ({vecA[1].toFixed(1)} × {vecB[1].toFixed(1)}) + ({vecA[2].toFixed(1)} × {vecB[2].toFixed(1)})
        </div>
        <div className="result-equals">
          = {vecA[0] * vecB[0]} + ({vecA[1] * vecB[1]}) + ({vecA[2] * vecB[2]})
        </div>
        <div className="result-value">
          = <strong className="primary-color-text">{dotProduct.toFixed(2)}</strong>
        </div>
      </div>
    </div>
  );
}

function SoftmaxVisualizer() {
  const [scores, setScores] = useState<number[]>([2.0, 1.0, 0.0]);

  const exps = scores.map((s) => Math.exp(s));
  const sumExps = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((e) => e / sumExps);

  const updateScore = (index: number, val: number) => {
    setScores((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  return (
    <div className="math-visualizer softmax-viz" aria-label="Interactive softmax probability visualizer">
      <h4>Interactive Softmax Calculator</h4>
      <p className="viz-intro">Try the softmax from the lesson yourself: drag the scores and watch how exponentiation stretches the gaps between them, then normalizes everything to 100%.</p>

      <div className="softmax-inputs">
        {scores.map((score, idx) => (
          <div key={idx} className="softmax-row">
            <div className="softmax-row-label font-mono">
              <span>Score o{idx + 1} = {score.toFixed(1)}</span>
              <span className="exp-label">e^(o{idx + 1}) = {exps[idx].toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="-4"
              max="4"
              step="0.2"
              value={score}
              onChange={(e) => updateScore(idx, parseFloat(e.target.value))}
              aria-label={`Score input ${idx + 1}`}
            />
            <div className="softmax-bar-container">
              <div 
                className="softmax-bar" 
                style={{ 
                  width: `${probs[idx] * 100}%`,
                  transition: "width 200ms cubic-bezier(0.4, 0, 0.2, 1)"
                }} 
              />
              <span className="softmax-percentage font-mono">{(probs[idx] * 100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MathVisualizer({ conceptId }: { conceptId: string }) {
  if (conceptId === "dot-product") {
    return <DotProductVisualizer />;
  }
  if (conceptId === "softmax") {
    return <SoftmaxVisualizer />;
  }
  return null;
}
