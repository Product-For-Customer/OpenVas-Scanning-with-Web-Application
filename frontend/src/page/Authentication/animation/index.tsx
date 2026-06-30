/**
 * Post-login success animation
 * Network Scanning Vulnerability — 3D card + starfield warp + live scan stats
 * Supports dark / light mode
 */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase    = "boot" | "scanning" | "complete" | "exit";
type LineType = "info" | "safe" | "vuln";
type Props    = { onFinished?: () => void; duration?: number };

// ─── Network nodes (normalized 0–1, pre-set vulnerable) ───────────────────────
const NET_NODES = [
  { x: 0.06, y: 0.30, vuln: false },
  { x: 0.18, y: 0.72, vuln: false },
  { x: 0.29, y: 0.22, vuln: true  },
  { x: 0.41, y: 0.58, vuln: false },
  { x: 0.52, y: 0.28, vuln: false },
  { x: 0.62, y: 0.78, vuln: true  },
  { x: 0.73, y: 0.40, vuln: false },
  { x: 0.83, y: 0.66, vuln: false },
  { x: 0.93, y: 0.20, vuln: true  },
];
const VULN_COUNT = NET_NODES.filter(n => n.vuln).length;

// ─── Terminal scan lines (at = ms after scanning phase starts) ─────────────────
const SCAN_LINES: Array<{ text: string; type: LineType; at: number }> = [
  { text: "Initializing scanner engine...",           type: "info", at: 0    },
  { text: "Discovering hosts on 192.168.0.0/24",     type: "info", at: 280  },
  { text: "[✓] 192.168.0.1    Gateway     SECURE",   type: "safe", at: 560  },
  { text: "[✓] 192.168.0.4    Host        SECURE",   type: "safe", at: 820  },
  { text: "[⚠] 192.168.0.7    CVE-2024-3148  HIGH",  type: "vuln", at: 1080 },
  { text: "[✓] 192.168.0.10   Host        SECURE",   type: "safe", at: 1340 },
  { text: "[⚠] 192.168.0.15   CVE-2024-8891  CRIT",  type: "vuln", at: 1620 },
  { text: "[✓] 192.168.0.18   Host        SECURE",   type: "safe", at: 1880 },
  { text: "[⚠] 192.168.0.22   CVE-2024-5573  MED",   type: "vuln", at: 2100 },
  { text: "Finalizing analysis report...",            type: "info", at: 2350 },
];

// ─── Backwards-compat export ──────────────────────────────────────────────────
export const preloadLoginSuccessAnimationAssets = (): Promise<void> => Promise.resolve();

// ─── Dark-mode hook ───────────────────────────────────────────────────────────
const useDark = () => {
  const [dark, setDark] = useState(
    () => typeof document !== "undefined" &&
          document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains("dark")),
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
};

// ─── 3D Warp starfield (dark mode only) ──────────────────────────────────────
const Starfield: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    cvs.width  = window.innerWidth;
    cvs.height = window.innerHeight;

    const W = cvs.width, H = cvs.height;
    const FOCAL = W * 0.42;
    const N = 180;
    const stars = Array.from({ length: N }, () => ({
      x:  (Math.random() - 0.5) * 2,
      y:  (Math.random() - 0.5) * 2,
      z:  Math.random(),
      pz: 1,
    }));

    ctx.fillStyle = "#060b18";
    ctx.fillRect(0, 0, W, H);

    let raf = 0;
    const tick = () => {
      ctx.fillStyle = "rgba(6,11,24,0.22)";
      ctx.fillRect(0, 0, W, H);

      for (const s of stars) {
        s.pz = s.z;
        s.z -= 0.0038;
        if (s.z <= 0) {
          s.x = (Math.random() - 0.5) * 2;
          s.y = (Math.random() - 0.5) * 2;
          s.z = 1; s.pz = 1;
        }
        const sx  = (s.x / s.z)  * FOCAL + W / 2;
        const sy  = (s.y / s.z)  * FOCAL + H / 2;
        const spx = (s.x / s.pz) * FOCAL + W / 2;
        const spy = (s.y / s.pz) * FOCAL + H / 2;
        if (sx < 0 || sx > W || sy < 0 || sy > H) continue;
        const size  = Math.max(0.2, (1 - s.z) * 3.2);
        const alpha = (1 - s.z) * 0.72 + 0.04;
        ctx.beginPath();
        ctx.moveTo(spx, spy);
        ctx.lineTo(sx,  sy);
        ctx.strokeStyle = `rgba(96,165,250,${alpha * 0.55})`;
        ctx.lineWidth   = size * 0.65;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, size * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148,210,255,${alpha})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onResize = () => {
      cvs.width = window.innerWidth; cvs.height = window.innerHeight;
      ctx.fillStyle = "#060b18"; ctx.fillRect(0, 0, cvs.width, cvs.height);
    };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);
  return (
    <canvas ref={ref}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
  );
};

// ─── Network scanning canvas ──────────────────────────────────────────────────
const NetworkCanvas: React.FC<{ progress: number; isDark: boolean }> = ({ progress, isDark }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const W = cvs.clientWidth  || 480;
    const H = 130;
    cvs.width = W; cvs.height = H;

    const beamX = progress * W;

    // BG
    ctx.fillStyle = isDark ? "#06091a" : "#f0f4ff";
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)";
    for (let x = 0; x < W; x += 28) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 28) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Scanned zone tint
    if (beamX > 0) {
      const scanGrad = ctx.createLinearGradient(0, 0, beamX, 0);
      scanGrad.addColorStop(0,   isDark ? "rgba(37,99,235,0.06)" : "rgba(37,99,235,0.04)");
      scanGrad.addColorStop(0.8, isDark ? "rgba(37,99,235,0.08)" : "rgba(37,99,235,0.06)");
      scanGrad.addColorStop(1,   "transparent");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, 0, beamX, H);
    }

    // Scanner beam glow
    if (progress < 1) {
      const bg = ctx.createLinearGradient(Math.max(0, beamX - 32), 0, beamX + 2, 0);
      bg.addColorStop(0, "transparent");
      bg.addColorStop(0.7, isDark ? "rgba(96,165,250,0.12)" : "rgba(59,130,246,0.09)");
      bg.addColorStop(1,   isDark ? "rgba(96,165,250,0.45)" : "rgba(59,130,246,0.38)");
      ctx.fillStyle = bg;
      ctx.fillRect(Math.max(0, beamX - 32), 0, 34, H);
      ctx.beginPath();
      ctx.moveTo(beamX, 0); ctx.lineTo(beamX, H);
      ctx.strokeStyle = isDark ? "rgba(96,165,250,0.85)" : "rgba(59,130,246,0.75)";
      ctx.lineWidth   = 1.8;
      ctx.stroke();
    }

    // Connections
    const rev = NET_NODES.filter(n => n.x * W <= beamX - 5);
    for (let i = 0; i < rev.length; i++) {
      for (let j = i + 1; j < rev.length; j++) {
        const a = rev[i], b = rev[j];
        const d = Math.hypot((a.x - b.x) * W, (a.y - b.y) * H);
        if (d > W * 0.38) continue;
        ctx.beginPath();
        ctx.moveTo(a.x * W, a.y * H);
        ctx.lineTo(b.x * W, b.y * H);
        ctx.strokeStyle = (a.vuln || b.vuln)
          ? "rgba(248,113,113,0.35)"
          : isDark ? "rgba(74,222,128,0.24)" : "rgba(22,163,74,0.30)";
        ctx.lineWidth = 0.85;
        ctx.stroke();
      }
    }

    // Nodes
    NET_NODES.forEach(n => {
      const nx = n.x * W, ny = n.y * H;
      const isRev  = n.x * W <= beamX - 5;
      const isPend = !isRev && n.x * W <= beamX + 12;
      if (!isRev && !isPend) {
        ctx.beginPath(); ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)";
        ctx.fill();
        return;
      }
      const clr = n.vuln ? "#f87171" : (isDark ? "#4ade80" : "#16a34a");
      const r   = isPend ? 6 : 4;
      // Outer glow
      ctx.beginPath(); ctx.arc(nx, ny, r * 2.8, 0, Math.PI * 2);
      ctx.fillStyle = `${clr}1c`; ctx.fill();
      // Core
      ctx.beginPath(); ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.fillStyle   = clr;
      ctx.shadowColor = clr;
      ctx.shadowBlur  = isPend ? 14 : 6;
      ctx.fill();
      ctx.shadowBlur = 0;
      // Vuln "!" badge
      if (n.vuln && isRev) {
        ctx.fillStyle = "#f87171";
        ctx.font      = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText("!", nx, ny - 9);
      }
    });
  }, [progress, isDark]);

  return (
    <canvas ref={ref}
      style={{ display: "block", width: "100%", height: 130 }} />
  );
};

// ─── Main animation component ─────────────────────────────────────────────────
const Animation: React.FC<Props> = ({ onFinished, duration = 4600 }) => {
  const TOTAL = Math.max(duration, 4600);

  const navigate   = useNavigate();
  const location   = useLocation();
  const redirectTo = (location.state as any)?.redirect ?? "/admin";
  const isDark     = useDark();

  const [phase,    setPhase]    = useState<Phase>("boot");
  const [progress, setProgress] = useState(0);
  const [visLines, setVisLines] = useState(0);

  const onFinRef = useRef(onFinished);
  const navRef   = useRef(navigate);
  const redRef   = useRef(redirectTo);
  useEffect(() => { onFinRef.current = onFinished; }, [onFinished]);
  useEffect(() => { navRef.current   = navigate;   }, [navigate]);
  useEffect(() => { redRef.current   = redirectTo; }, [redirectTo]);

  useEffect(() => {
    const BOOT   = 460;
    const SCAN_E = Math.round(TOTAL * 0.63);
    const DONE_E = Math.round(TOTAL * 0.86);
    const SDUR   = SCAN_E - BOOT;

    const tids = [
      setTimeout(() => setPhase("scanning"),  BOOT),
      setTimeout(() => setPhase("complete"),  SCAN_E),
      setTimeout(() => setPhase("exit"),      DONE_E),
      setTimeout(() => {
        if (onFinRef.current) onFinRef.current();
        else navRef.current(redRef.current, { replace: true });
      }, TOTAL),
    ];
    const lineTids = SCAN_LINES.map((l, i) =>
      setTimeout(() => setVisLines(v => Math.max(v, i + 1)), BOOT + l.at),
    );
    const t0 = performance.now();
    let raf = 0;
    const animP = (t: number) => {
      const el = t - t0 - BOOT;
      if (el >= 0) setProgress(Math.min(el / SDUR, 1));
      if (el < SDUR) raf = requestAnimationFrame(animP);
      else setProgress(1);
    };
    raf = requestAnimationFrame(animP);
    return () => {
      tids.forEach(clearTimeout);
      lineTids.forEach(clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, [TOTAL]);

  const isComplete = phase === "complete" || phase === "exit";
  const isExit     = phase === "exit";
  const pct        = Math.round(progress * 100);

  // Live stats
  const hostsScanned = Math.min(Math.round(progress * NET_NODES.length), NET_NODES.length);
  const vulnsFound   = NET_NODES.filter(n => n.vuln && n.x <= progress).length;

  // ── Theme ──────────────────────────────────────────────────────────────────
  const BG       = isDark ? "#060b18"                : "#edf2ff";
  const CARD_BG  = isDark ? "rgba(8,13,30,0.98)"    : "rgba(255,255,255,0.98)";
  const CARD_BDR = isDark ? "rgba(96,165,250,0.22)" : "rgba(59,130,246,0.20)";
  const CARD_SHD = isDark
    ? "0 0 0 1px rgba(96,165,250,0.06), 0 20px 80px rgba(37,99,235,0.28), 0 0 120px rgba(96,165,250,0.06)"
    : "0 20px 60px rgba(37,99,235,0.14), 0 2px 12px rgba(0,0,0,0.06)";
  const HEAD_CLR = isDark ? "rgba(96,165,250,0.82)" : "rgba(37,99,235,0.78)";
  const DIV_LINE = isDark
    ? "linear-gradient(90deg,transparent,rgba(96,165,250,0.40),rgba(74,222,128,0.25),transparent)"
    : "linear-gradient(90deg,transparent,rgba(37,99,235,0.22),transparent)";
  const TERM_BG  = isDark ? "rgba(0,0,0,0.35)"      : "rgba(0,0,0,0.025)";
  const TERM_BDR = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const STAT_BG  = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)";
  const STAT_BDR = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const INFO_CLR = isDark ? "#94a3b8"                : "#64748b";
  const SAFE_CLR = isDark ? "#4ade80"                : "#16a34a";
  const VULN_CLR = isDark ? "#f87171"                : "#dc2626";
  const BAR_TRK  = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const BAR_CLR  = isComplete
    ? (isDark ? "#4ade80" : "#16a34a")
    : (isDark ? "#60a5fa" : "#3b82f6");
  const DOT_OFF  = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";

  const phaseIdx: Record<Phase, number> = { boot: 0, scanning: 1, complete: 2, exit: 2 };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isExit ? 0 : 1 }}
      transition={{ duration: 0.50 }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: BG, padding: "20px 16px",
      }}
    >
      {/* ── 3D Warp starfield (dark only) ── */}
      {isDark && <Starfield />}

      {/* ── 3D Perspective wrapper ── */}
      <div style={{ perspective: "1500px", position: "relative", zIndex: 10, width: "100%", maxWidth: 580 }}>
        <motion.div
          initial={{ opacity: 0, rotateX: 32, rotateY: -4, y: 90, scale: 0.86 }}
          animate={{ opacity: 1, rotateX: 0,  rotateY: 0,  y: 0,  scale: 1   }}
          transition={{ duration: 0.70, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background:      CARD_BG,
            border:          `1px solid ${CARD_BDR}`,
            boxShadow:       CARD_SHD,
            borderRadius:    16,
            padding:         "30px 32px 26px",
            position:        "relative",
            overflow:        "hidden",
            transformStyle:  "preserve-3d",
          }}
        >
          {/* ── Corner accents ── */}
          {([
            { s: "left:0;top:0",    b: "border-l border-t"    },
            { s: "right:0;top:0",   b: "border-r border-t"    },
            { s: "left:0;bottom:0", b: "border-l border-b"    },
            { s: "right:0;bottom:0",b: "border-r border-b"    },
          ] as const).map(({ s, b }, i) => (
            <span
              key={i}
              className={`absolute ${b} w-4 h-4`}
              style={{ ...Object.fromEntries(s.split(";").map(p => p.split(":"))) as React.CSSProperties, borderColor: `rgba(96,165,250,0.45)` }}
            />
          ))}

          {/* ── Header ── */}
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <p style={{
              fontFamily: "ui-monospace,'Courier New',monospace",
              fontSize: 10.5, fontWeight: 700,
              letterSpacing: "0.28em", textTransform: "uppercase",
              color: HEAD_CLR, margin: "0 0 10px",
            }}>
              ◈ ARGUS VULNERABILITY SCANNER ◈
            </p>
            <div style={{ height: 1, background: DIV_LINE }} />
          </div>

          {/* ── Network canvas ── */}
          <div style={{
            borderRadius: 10, overflow: "hidden", marginBottom: 14,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
          }}>
            <NetworkCanvas progress={isComplete ? 1 : progress} isDark={isDark} />
          </div>

          {/* ── Legend ── */}
          <div style={{ display: "flex", gap: 14, justifyContent: "flex-end", marginBottom: 14 }}>
            {([
              { color: isDark ? "#4ade80" : "#16a34a", label: "Secure" },
              { color: "#f87171",                       label: "Vulnerable" },
            ] as const).map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: color, boxShadow: `0 0 5px ${color}` }} />
                <span style={{ fontFamily: "ui-monospace,'Courier New',monospace", fontSize: 9.5, color: INFO_CLR }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* ── Live stats row ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: phase !== "boot" ? 1 : 0, y: phase !== "boot" ? 0 : 8 }}
            transition={{ duration: 0.35 }}
            style={{ display: "flex", gap: 8, marginBottom: 14 }}
          >
            {[
              { label: "Hosts Scanned",     value: hostsScanned.toString(),                     color: isDark ? "#60a5fa" : "#2563eb" },
              { label: "Vulnerabilities",   value: isComplete ? VULN_COUNT.toString() : vulnsFound.toString(), color: VULN_CLR },
              { label: "Status",            value: isComplete ? "DONE" : "LIVE",                color: isComplete ? SAFE_CLR : isDark ? "#fbbf24" : "#d97706" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ flex: 1, padding: "8px 10px", borderRadius: 9, background: STAT_BG, border: `1px solid ${STAT_BDR}`, textAlign: "center" }}>
                <p style={{ fontFamily: "ui-monospace,'Courier New',monospace", fontSize: 22, fontWeight: 900, color, margin: 0, lineHeight: 1 }}>
                  {value}
                </p>
                <p style={{ fontFamily: "ui-monospace,'Courier New',monospace", fontSize: 8.5, color: INFO_CLR, margin: "4px 0 0", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  {label}
                </p>
              </div>
            ))}
          </motion.div>

          {/* ── Terminal output ── */}
          <div style={{
            height: 124, overflowY: "hidden",
            padding: "9px 13px",
            background: TERM_BG, borderRadius: 8, border: `1px solid ${TERM_BDR}`,
            marginBottom: 16,
          }}>
            <AnimatePresence mode="popLayout">
              {!isComplete ? (
                <React.Fragment key="scanning">
                  {SCAN_LINES.slice(0, visLines).map((line, i) => (
                    <motion.p key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        fontFamily: "ui-monospace,'Courier New',monospace",
                        fontSize: 10.5, margin: "0 0 3px",
                        color: line.type === "safe" ? SAFE_CLR
                             : line.type === "vuln" ? VULN_CLR
                             : INFO_CLR,
                      }}
                    >
                      {line.text}
                    </motion.p>
                  ))}
                  {phase === "scanning" && (
                    <motion.span
                      key="cursor"
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ repeat: Infinity, duration: 0.85, ease: "linear" }}
                      style={{ display: "inline-block", width: 7, height: 12, background: INFO_CLR, verticalAlign: "middle" }}
                    />
                  )}
                </React.Fragment>
              ) : (
                <motion.div key="complete"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.30 }}
                  style={{ textAlign: "center", paddingTop: 18 }}
                >
                  <p style={{
                    fontFamily: "ui-monospace,'Courier New',monospace",
                    fontSize: 17, fontWeight: 800, color: SAFE_CLR, margin: "0 0 8px",
                    textShadow: `0 0 20px ${SAFE_CLR}70`,
                  }}>
                    ✓ SCAN COMPLETE
                  </p>
                  <p style={{ fontFamily: "ui-monospace,'Courier New',monospace", fontSize: 11, color: VULN_CLR, margin: "0 0 5px" }}>
                    {VULN_COUNT} vulnerabilities detected across {NET_NODES.length} hosts
                  </p>
                  <p style={{ fontFamily: "ui-monospace,'Courier New',monospace", fontSize: 10, color: INFO_CLR, margin: 0, letterSpacing: "0.06em" }}>
                    Redirecting to dashboard...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Progress bar ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{ fontFamily: "ui-monospace,'Courier New',monospace", fontSize: 10, color: INFO_CLR, margin: 0 }}>
                {isComplete ? "Analysis complete" : "Scanning network..."}
              </p>
              <p style={{ fontFamily: "ui-monospace,'Courier New',monospace", fontSize: 10, fontWeight: 700, color: BAR_CLR, margin: 0 }}>
                {pct}%
              </p>
            </div>
            <div style={{ height: 4, borderRadius: 99, background: BAR_TRK, overflow: "hidden" }}>
              <motion.div
                animate={{ width: `${Math.min(pct, 100)}%` }}
                transition={{ duration: 0.1, ease: "linear" }}
                style={{ height: "100%", borderRadius: 99, background: BAR_CLR, boxShadow: `0 0 8px ${BAR_CLR}60` }}
              />
            </div>
          </div>

          {/* ── Divider ── */}
          <div style={{ height: 1, background: DIV_LINE, marginBottom: 14 }} />

          {/* ── Phase dots ── */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
            {[0, 1, 2].map(i => (
              <motion.div key={i}
                animate={{
                  backgroundColor: i <= phaseIdx[phase] ? BAR_CLR : DOT_OFF,
                  boxShadow:       i <= phaseIdx[phase] ? `0 0 7px ${BAR_CLR}` : "none",
                }}
                transition={{ duration: 0.4 }}
                style={{ width: 6, height: 6, borderRadius: "50%" }}
              />
            ))}
          </div>

          {/* ── Scan line sweep ── */}
          {phase === "scanning" && (
            <motion.div
              initial={{ top: 0 }}
              animate={{ top: "100%" }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }}
              style={{
                position: "absolute", left: 0, width: "100%", height: 1.5, pointerEvents: "none",
                background: isDark
                  ? "linear-gradient(90deg,transparent,rgba(96,165,250,0.28),rgba(74,222,128,0.18),rgba(96,165,250,0.28),transparent)"
                  : "linear-gradient(90deg,transparent,rgba(59,130,246,0.22),transparent)",
              }}
            />
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Animation;
