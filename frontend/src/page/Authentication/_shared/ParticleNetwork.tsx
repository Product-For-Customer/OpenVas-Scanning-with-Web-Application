import React, { useEffect, useRef } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────
const P_COUNT = 75;
const P_MAXD  = 145;
const P_SPD   = 2.8; // fast movement

// ─── Colour constants ─────────────────────────────────────────────────────────
// Fixed brand-blue scheme (#1A97F5) — auth pages no longer switch between a
// light/dark particle palette, so there is just one pairing: the dot uses the
// brand colour at full saturation, the connecting line uses a slightly
// darker/desaturated companion shade (same relationship the old dark-mode
// D_DOT/D_LINE pair had to each other).
const BRAND_DOT  = "26, 151, 245";
const BRAND_LINE = "20, 118, 205";

// ─── Component ────────────────────────────────────────────────────────────────
export const ParticleNetwork: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    interface Pt { x: number; y: number; vx: number; vy: number; r: number; }
    const pts: Pt[] = [];

    const resize = () => {
      cvs.width  = window.innerWidth;
      cvs.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < P_COUNT; i++) {
      pts.push({
        x:  Math.random() * cvs.width,
        y:  Math.random() * cvs.height,
        vx: (Math.random() - 0.5) * P_SPD,
        vy: (Math.random() - 0.5) * P_SPD,
        r:  Math.random() * 1.6 + 1.1,
      });
    }

    const tick = () => {
      ctx.clearRect(0, 0, cvs.width, cvs.height);

      const dotC  = BRAND_DOT;
      const lineC = BRAND_LINE;
      const dotA  = 0.64;
      const lineA = 0.40;

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x <= 0 || p.x >= cvs.width)  { p.vx *= -1; p.x = Math.max(0, Math.min(cvs.width,  p.x)); }
        if (p.y <= 0 || p.y >= cvs.height) { p.vy *= -1; p.y = Math.max(0, Math.min(cvs.height, p.y)); }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${dotC},${dotA})`;
        ctx.fill();

        for (let j = i + 1; j < pts.length; j++) {
          const q  = pts[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const d  = Math.sqrt(dx*dx + dy*dy);
          if (d < P_MAXD) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(${lineC},${(1 - d/P_MAXD) * lineA})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{
        position:      "fixed",
        top:           0,
        left:          0,
        width:         "100%",
        height:        "100%",
        pointerEvents: "none",
      }}
    />
  );
};
