import React from "react";

type LoaderProps = {
  overlay?: boolean;
};

const COLS = 5;
const ROWS = 5;

/* Diagonal gradient: step = r + c  (0 → 8)  cyan → violet → pink */
const STEP_COLORS = [
  "#22d3ee",
  "#38bdf8",
  "#60a5fa",
  "#818cf8",
  "#a78bfa",
  "#c084fc",
  "#d946ef",
  "#e879f9",
  "#f472b6",
];

const Loader: React.FC<LoaderProps> = ({ overlay = true }) => {
  const cells: { key: string; delay: number; color: string }[] = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const step = r + c;
      cells.push({
        key: `${r}-${c}`,
        delay: step * 0.085,
        color: STEP_COLORS[Math.min(step, STEP_COLORS.length - 1)],
      });
    }
  }

  return (
    <div className={overlay ? "ldr-overlay" : "ldr-wrap"}>
      <div role="status" aria-label="Loading" className="ldr-root">

        <div className="ldr-grid">
          {cells.map(({ key, delay, color }) => (
            <div
              key={key}
              className="ldr-cell"
              style={{ "--delay": `${delay}s`, "--color": color } as React.CSSProperties}
            />
          ))}
        </div>

        <div className="ldr-track">
          <div className="ldr-track-fill" />
        </div>
      </div>

      <style>{`
        .ldr-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(15, 23, 42, 0.07);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .ldr-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 28px 0;
        }

        .ldr-root {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }

        .ldr-grid {
          display: grid;
          grid-template-columns: repeat(${COLS}, 10px);
          grid-template-rows: repeat(${ROWS}, 10px);
          gap: 5px;
          transform: rotate(-8deg);
        }

        .ldr-cell {
          width: 10px;
          height: 10px;
          border-radius: 3px;
          background-color: var(--color);
          animation: cellPop 1.5s ease-in-out infinite;
          animation-delay: var(--delay);
          will-change: transform, opacity;
        }

        @keyframes cellPop {
          0%, 100% {
            transform: scale(0.3);
            opacity: 0.15;
            border-radius: 50%;
          }
          45%, 55% {
            transform: scale(1);
            opacity: 1;
            border-radius: 3px;
            box-shadow: 0 0 8px var(--color),
                        0 0 20px color-mix(in srgb, var(--color) 40%, transparent);
          }
        }

        .ldr-track {
          width: 72px;
          height: 2px;
          border-radius: 9999px;
          overflow: hidden;
          background: rgba(148, 163, 184, 0.2);
        }

        .ldr-track-fill {
          height: 100%;
          border-radius: 9999px;
          background: linear-gradient(90deg, #22d3ee, #818cf8, #c084fc, #22d3ee);
          background-size: 200% 100%;
          animation: trackSlide 1.8s linear infinite;
        }

        @keyframes trackSlide {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ldr-cell        { animation: none; opacity: 0.65; transform: scale(0.85); border-radius: 3px; }
          .ldr-track-fill  { animation: none; }
        }
      `}</style>
    </div>
  );
};

export default Loader;
