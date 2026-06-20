import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { motion } from "framer-motion";
import logo from "../../../assets/argus-description.png";

type Props = { onFinished?: () => void; duration?: number };
type Phase = "init" | "active" | "complete" | "exit";
type V3    = [number, number, number];

// ─── Preload ─────────────────────────────────────────────────────
const _p = new Map<string, Promise<void>>();
export const preloadLoginSuccessAnimationAssets = (): Promise<void> => {
  if (_p.has(logo)) return _p.get(logo)!;
  const pr = new Promise<void>(r => { const i = new Image(); i.onload = () => r(); i.onerror = () => r(); i.src = logo; });
  _p.set(logo, pr); return pr;
};

const useDark = () => {
  const [d, set] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const o = new MutationObserver(() => set(document.documentElement.classList.contains("dark")));
    o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => o.disconnect();
  }, []);
  return d;
};

// ─── Theme ───────────────────────────────────────────────────────
// dark mode = electric cyan modern cyber
// light mode = phosphor green retro terminal
const T = {
  dark:  { bg: "#000000", primary: "#00f0ff", secondary: "#7b2fff", safe: "#00ff88", globe: "#000d1a", lc: "#0066aa", emI: 0.85, oLon: 0.30, oLat: 0.18, oEq: 0.62 },
  light: { bg: "#060c07", primary: "#39ff14", secondary: "#00cc88", safe: "#39ff14",  globe: "#020802", lc: "#00aa33", emI: 0.95, oLon: 0.35, oLat: 0.22, oEq: 0.70 },
};

// ─── Geo ─────────────────────────────────────────────────────────
const ll = (lat: number, lon: number, R = 2.05): V3 => {
  const phi = (90 - lat) * (Math.PI / 180);
  const th  = (lon + 180) * (Math.PI / 180);
  return [-R * Math.sin(phi) * Math.cos(th), R * Math.cos(phi), R * Math.sin(phi) * Math.sin(th)];
};

const ATTACKS = [
  { src: ll(55.75, 37.62), dst: ll(40.71, -74.01), col: "#ff0044", at: 700  },
  { src: ll(31.23,121.47), dst: ll(37.77,-122.42), col: "#ff0044", at: 1000 },
  { src: ll(39.91,116.39), dst: ll(51.51,  -0.13), col: "#ff8800", at: 1280 },
  { src: ll(35.69,139.69), dst: ll(48.86,   2.35), col: "#ffee00", at: 1560 },
  { src: ll(28.61, 77.21), dst: ll(-33.87,151.21), col: "#ff8800", at: 1840 },
  { src: ll(59.95, 30.32), dst: ll(52.37,   4.90), col: "#ff0044", at: 2120 },
  { src: ll(-23.55,-46.63),dst: ll(19.43, -99.13), col: "#ffee00", at: 2380 },
  { src: ll(22.28,114.16), dst: ll( 1.35, 103.82), col: "#ff8800", at: 2640 },
];

// ─────────────────────────────────────────────────────────────────
// Canvas background via Three.js clear color
// ─────────────────────────────────────────────────────────────────
const CanvasBg: React.FC<{ bg: string }> = ({ bg }) => {
  const { gl } = useThree();
  useEffect(() => { gl.setClearColor(new THREE.Color(bg), 1); }, [gl, bg]);
  return null;
};

// ─────────────────────────────────────────────────────────────────
// 3D ── Globe
// ─────────────────────────────────────────────────────────────────
const GeoNode: React.FC<{ pos: V3; col: string }> = ({ pos, col }) => {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(s => { if (mat.current) mat.current.emissiveIntensity = 3 + Math.sin(s.clock.elapsedTime * 5 + pos[0] * 4) * 2.5; });
  return (
    <mesh position={pos}>
      <sphereGeometry args={[0.06, 8, 8]} />
      <meshStandardMaterial ref={mat} color={col} emissive={col} emissiveIntensity={3} />
    </mesh>
  );
};

const AttackArc: React.FC<{ src: V3; dst: V3; col: string }> = ({ src, dst, col }) => {
  const refs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const curve = useMemo(() => {
    const a = new THREE.Vector3(...src), b = new THREE.Vector3(...dst);
    const ctrl = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(3.0);
    return new THREE.QuadraticBezierCurve3(a, ctrl, b);
  }, [src, dst]);
  const pts = useMemo<V3[]>(() => curve.getPoints(72).map(p => [p.x, p.y, p.z]), [curve]);
  useFrame(s => {
    refs.forEach((ref, i) => {
      if (!ref.current) return;
      ref.current.position.copy(curve.getPoint(((s.clock.elapsedTime * 0.26 + i * 0.36) % 1)));
    });
  });
  return (
    <>
      <Line points={pts} color={col} lineWidth={1.1} transparent opacity={0.38} />
      {refs.map((ref, i) => (
        <mesh key={i} ref={ref} position={src}>
          <sphereGeometry args={[0.044, 6, 6]} />
          <meshStandardMaterial color={col} emissive={col} emissiveIntensity={10} />
        </mesh>
      ))}
    </>
  );
};

const Globe: React.FC<{ active: Set<number>; phase: Phase; theme: typeof T.dark }> = ({ active, phase, theme }) => {
  const gRef   = useRef<THREE.Group>(null);
  const rimMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((_, dt) => {
    if (gRef.current) gRef.current.rotation.y += dt * 0.13;
    if (rimMat.current) {
      const col = new THREE.Color(phase === "complete" ? theme.safe : theme.primary);
      rimMat.current.emissive.lerp(col, 0.04);
    }
  });
  const LATS = [-60, -30, 0, 30, 60];
  const LONS = Array.from({ length: 6 }, (_, i) => i * (Math.PI / 6));
  return (
    <group ref={gRef}>
      <mesh><sphereGeometry args={[1.97, 32, 32]} />
        <meshStandardMaterial color={theme.globe} transparent opacity={0.92} />
      </mesh>
      {/* Outer glow rim */}
      <mesh><sphereGeometry args={[2.2, 32, 32]} />
        <meshStandardMaterial ref={rimMat} color={theme.primary} emissive={theme.primary}
          emissiveIntensity={0.12} transparent opacity={0.04} side={THREE.BackSide} />
      </mesh>
      {LONS.map((a, i) => (
        <mesh key={i} rotation={[0, a, Math.PI / 2]}>
          <torusGeometry args={[2, 0.004, 4, 100]} />
          <meshStandardMaterial color={theme.lc} emissive={theme.lc} emissiveIntensity={theme.emI} transparent opacity={theme.oLon} />
        </mesh>
      ))}
      {LATS.map(lat => {
        const phi = lat * (Math.PI / 180);
        return (
          <mesh key={lat} position={[0, 2 * Math.sin(phi), 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2 * Math.cos(phi), lat === 0 ? 0.007 : 0.004, 4, 80]} />
            <meshStandardMaterial color={theme.lc} emissive={theme.lc}
              emissiveIntensity={lat === 0 ? theme.emI * 1.9 : theme.emI}
              transparent opacity={lat === 0 ? theme.oEq : theme.oLat} />
          </mesh>
        );
      })}
      {ATTACKS.map((a, i) => active.has(i) && (
        <React.Fragment key={i}>
          <GeoNode pos={a.src} col={a.col} />
          <GeoNode pos={a.dst} col="#ffffff" />
          <AttackArc src={a.src} dst={a.dst} col={a.col} />
        </React.Fragment>
      ))}
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────
// 3D ── Scan ring
// ─────────────────────────────────────────────────────────────────
const ScanRing: React.FC<{ phase: Phase; theme: typeof T.dark }> = ({ phase, theme }) => {
  const gRef = useRef<THREE.Group>(null);
  const mat  = useRef<THREE.MeshStandardMaterial>(null);
  const ok   = phase === "complete";
  useFrame((_, dt) => {
    if (gRef.current) gRef.current.rotation.y += dt * (ok ? 2.8 : 1.1);
    if (mat.current) mat.current.emissive.lerp(new THREE.Color(ok ? theme.safe : theme.primary), 0.06);
  });
  return (
    <group rotation={[0.55, 0, 0.12]}>
      <group ref={gRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.52, 0.011, 4, 160]} />
          <meshStandardMaterial ref={mat} color={theme.primary} emissive={theme.primary} emissiveIntensity={2.2} transparent opacity={0.88} />
        </mesh>
        <mesh position={[2.52, 0, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color="#ffffff" emissive={theme.primary} emissiveIntensity={12} />
        </mesh>
        <mesh position={[2.06, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.03, 0.48, 5]} />
          <meshStandardMaterial color={theme.primary} emissive={theme.primary} emissiveIntensity={2} transparent opacity={0.3} />
        </mesh>
      </group>
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────
// HTML ── Matrix rain
// ─────────────────────────────────────────────────────────────────
const MatrixRain: React.FC<{ color: string }> = ({ color }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const fs = 12;
    const chars = "01アイウエオABCDEF0123456789";
    const cols = Math.floor(canvas.width / fs);
    const drops = Array.from({ length: cols }, () => Math.random() * -canvas.height);
    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.055)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fs}px monospace`;
      drops.forEach((y, i) => {
        ctx.fillStyle = Math.random() > 0.97 ? "#ffffff" : color;
        ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * fs, y);
        if (y > canvas.height) drops[i] = Math.random() * -canvas.height * 0.5;
        drops[i] += fs * 0.85;
      });
    };
    const id = setInterval(draw, 52);
    return () => { clearInterval(id); window.removeEventListener("resize", resize); };
  }, [color]);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, opacity: 0.06, zIndex: 2, pointerEvents: "none" }} />;
};

// ─────────────────────────────────────────────────────────────────
// HTML ── Horizontal scan beam (sweeps top→bottom repeatedly)
// ─────────────────────────────────────────────────────────────────
const ScanBeam: React.FC<{ color: string }> = ({ color }) => (
  <motion.div
    animate={{ top: ["-2%", "102%"] }}
    transition={{ repeat: Infinity, duration: 4, ease: "linear", repeatDelay: 0.8 }}
    style={{ position: "absolute", left: 0, right: 0, height: 1.5, zIndex: 7, pointerEvents: "none",
      background: `linear-gradient(90deg, transparent 0%, ${color}30 15%, ${color}99 50%, ${color}30 85%, transparent 100%)`,
      boxShadow: `0 0 18px ${color}55, 0 0 4px ${color}` }}
  />
);

// ─────────────────────────────────────────────────────────────────
// HTML ── HUD corner brackets
// ─────────────────────────────────────────────────────────────────
const Corner: React.FC<{ pos: "tl"|"tr"|"bl"|"br"; col: string }> = ({ pos, col }) => {
  const st: Record<string, React.CSSProperties> = {
    tl: { top: 14, left: 14 }, tr: { top: 14, right: 14, transform: "scaleX(-1)" },
    bl: { bottom: 14, left: 14, transform: "scaleY(-1)" }, br: { bottom: 14, right: 14, transform: "scale(-1)" },
  };
  const sh = `0 0 10px ${col}`;
  return (
    <div style={{ position: "absolute", width: 26, height: 26, pointerEvents: "none", ...st[pos] }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 20, height: 2, background: col, boxShadow: sh }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: 2, height: 20, background: col, boxShadow: sh }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// HTML ── Glitch text
// ─────────────────────────────────────────────────────────────────
const GlitchText: React.FC<{ text: string; col: string; style?: React.CSSProperties }> = ({ text, col, style }) => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const go = () => { setOn(true); setTimeout(() => setOn(false), 160); };
    let id = setTimeout(function repeat() { go(); id = setTimeout(repeat, 3200 + Math.random() * 2400); }, 1800);
    return () => clearTimeout(id);
  }, []);
  return (
    <div style={{ position: "relative", display: "inline-block", ...style }}>
      <span style={{ color: col, textShadow: `0 0 14px ${col}88` }}>{text}</span>
      {on && (
        <>
          <span style={{ position: "absolute", inset: 0, color: "#ff0033", transform: "translate(-2px, 1px)", opacity: 0.75, textShadow: "none" }}>{text}</span>
          <span style={{ position: "absolute", inset: 0, color: "#00ffff", transform: "translate(2px, -1px)", opacity: 0.75, textShadow: "none" }}>{text}</span>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────
const Animation: React.FC<Props> = ({ onFinished, duration = 5000 }) => {
  const TOTAL = Math.max(duration, 4800);
  const dark  = useDark();
  const theme = dark ? T.dark : T.light;

  const [phase,    setPhase]    = useState<Phase>("init");
  const [active,   setActive]   = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState(0);
  const [tick,     setTick]     = useState(0); // drives terminal text flicker

  const onFinRef = useRef(onFinished);
  const doneRef  = useRef(false);
  useEffect(() => { onFinRef.current = onFinished; }, [onFinished]);

  useEffect(() => {
    const T2 = TOTAL;
    const timers = [
      setTimeout(() => setPhase("active"),                      380),
      setTimeout(() => setPhase("complete"), Math.max(T2 - 800, 3600)),
      setTimeout(() => setPhase("exit"),     Math.max(T2 - 300, 4150)),
      ...ATTACKS.map((a, i) => setTimeout(() => setActive(p => new Set([...p, i])), a.at)),
      setTimeout(() => { if (!doneRef.current) { doneRef.current = true; onFinRef.current?.(); } }, T2 + 380),
    ];
    const start = performance.now();
    let raf = 0;
    const tick2 = () => {
      setProgress(Math.min(((performance.now() - start) / T2) * 100, 100));
      setTick(t => t + 1);
      raf = requestAnimationFrame(tick2);
    };
    raf = requestAnimationFrame(tick2);
    return () => { timers.forEach(clearTimeout); cancelAnimationFrame(raf); };
  }, [TOTAL]);

  const isOk   = phase === "complete" || phase === "exit";
  const accent = isOk ? theme.safe : theme.primary;

  const redN    = [...active].filter(i => ATTACKS[i]?.col === "#ff0044").length;
  const orangeN = [...active].filter(i => ATTACKS[i]?.col === "#ff8800").length;
  const yellowN = [...active].filter(i => ATTACKS[i]?.col === "#ffee00").length;

  // Terminal line flicker helper
  const blink = tick % 90 < 60;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === "exit" ? 0 : 1 }}
      transition={{ duration: 0.45 }}
      style={{ position: "fixed", inset: 0, overflow: "hidden", background: theme.bg,
        fontFamily: "ui-monospace,'Courier New',monospace" }}
    >
      {/* Matrix rain */}
      <MatrixRain color={theme.primary} />

      {/* Horizontal scan beam */}
      {phase !== "init" && <ScanBeam color={theme.primary} />}

      {/* 3D */}
      <div style={{ position: "absolute", inset: 0, zIndex: 5 }}>
        <Canvas camera={{ position: [0, 1.4, 8.0], fov: 44 }} gl={{ antialias: true, alpha: false }} dpr={[1, 1.5]}>
          <CanvasBg bg={theme.bg} />
          <ambientLight intensity={0.04} />
          <pointLight position={[5, 6, 6]}  color="#ffffff" intensity={10} distance={24} />
          <pointLight position={[-4,-4,-5]} color={theme.secondary} intensity={5} distance={20} />
          <Globe active={active} phase={phase} theme={theme} />
          <ScanRing phase={phase} theme={theme} />
        </Canvas>
      </div>

      {/* Vignette */}
      <div style={{ position: "absolute", inset: 0, zIndex: 8, pointerEvents: "none",
        background: "radial-gradient(ellipse 75% 75% at 50% 52%, transparent 30%, rgba(0,0,0,.80) 100%)" }} />

      {/* Complete flash */}
      {isOk && (
        <motion.div initial={{ opacity: 0.3 }} animate={{ opacity: 0 }} transition={{ duration: 1.0 }}
          style={{ position: "absolute", inset: 0, zIndex: 9, pointerEvents: "none",
            background: `radial-gradient(ellipse at center, ${theme.safe}22 0%, transparent 65%)` }} />
      )}

      {/* HUD corners */}
      <div style={{ position: "absolute", inset: 0, zIndex: 15, pointerEvents: "none" }}>
        {(["tl","tr","bl","br"] as const).map(p => <Corner key={p} pos={p} col={accent} />)}
      </div>

      {/* Top — glitch title */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}
        style={{ position: "absolute", top: 22, left: "50%", transform: "translateX(-50%)",
          zIndex: 20, pointerEvents: "none", textAlign: "center" }}>
        <GlitchText
          text={isOk ? "[ NETWORK SECURED ]" : "[ CYBER THREAT INTELLIGENCE ]"}
          col={accent}
          style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em" }}
        />
      </motion.div>

      {/* Right — threat terminal */}
      {active.size > 0 && (
        <motion.div initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
          style={{ position: "absolute", top: 50, right: 22, zIndex: 20, pointerEvents: "none",
            display: "flex", flexDirection: "column", gap: 2,
            border: `1px solid ${accent}22`, padding: "8px 12px",
            background: `${theme.bg}cc`, backdropFilter: "blur(4px)" }}>
          <div style={{ fontSize: 7.5, color: accent, letterSpacing: "0.18em", marginBottom: 5 }}>THREATS DETECTED</div>
          {[{ n: redN, col: "#ff0044", label: "CRITICAL" }, { n: orangeN, col: "#ff8800", label: "HIGH" }, { n: yellowN, col: "#ffee00", label: "MEDIUM" }]
            .map(({ n, col, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, opacity: n === 0 ? 0.3 : 1 }}>
                <div style={{ width: 5, height: 5, borderRadius: 9999, background: n > 0 ? col : "transparent",
                  border: `1px solid ${col}`, boxShadow: n > 0 ? `0 0 8px ${col}` : "none" }} />
                <span style={{ fontSize: 8, color: `${col}aa`, letterSpacing: "0.1em", width: 50 }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: n > 0 ? col : `${col}44`,
                  textShadow: n > 0 ? `0 0 10px ${col}` : "none" }}>{n}</span>
              </div>
            ))}
          <div style={{ marginTop: 4, borderTop: `1px solid ${accent}22`, paddingTop: 4,
            fontSize: 8, color: `${accent}66`, letterSpacing: "0.1em" }}>
            TOTAL {redN + orangeN + yellowN} EVENTS
          </div>
        </motion.div>
      )}

      {/* Left — terminal readout */}
      {phase !== "init" && (
        <motion.div initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.7 }}
          style={{ position: "absolute", top: 50, left: 22, zIndex: 20, pointerEvents: "none",
            display: "flex", flexDirection: "column", gap: 3,
            border: `1px solid ${accent}22`, padding: "8px 12px",
            background: `${theme.bg}cc`, backdropFilter: "blur(4px)" }}>
          {[
            `> TARGET: 192.168.0.0/24`,
            `> HOSTS:  ${active.size}/${ATTACKS.length} SCANNED`,
            `> PROTO:  TCP/UDP + GMP`,
            `> STATUS: ${isOk ? "SECURED" : "SCANNING"} ${blink ? "_" : " "}`,
          ].map((line, i) => (
            <div key={i} style={{ fontSize: 8, letterSpacing: "0.08em",
              color: i === 3 ? accent : `${accent}88` }}>
              {line}
            </div>
          ))}
        </motion.div>
      )}

      {/* Bottom — progress */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.4 }}
        style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
          width: "min(340px, 72vw)", zIndex: 20, pointerEvents: "none",
          display: "flex", flexDirection: "column", gap: 7, alignItems: "center" }}>

        {/* Bar with segments */}
        <div style={{ width: "100%", position: "relative", height: 6,
          border: `1px solid ${accent}30`, background: `${accent}08`, overflow: "hidden" }}>
          <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.08, ease: "linear" }}
            style={{ position: "absolute", inset: "0 auto 0 0", height: "100%",
              background: `linear-gradient(90deg, ${accent}88, ${accent})`,
              boxShadow: `0 0 10px ${accent}, 0 0 3px ${accent}` }} />
          {/* Segment dividers */}
          {Array.from({length: 19}, (_, i) => (
            <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${(i+1)*5}%`,
              width: 1, background: `${theme.bg}88`, zIndex: 1 }} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontSize: 8, color: `${accent}66`, letterSpacing: "0.14em" }}>SCAN PROGRESS</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: accent,
            textShadow: `0 0 10px ${accent}`, letterSpacing: "0.08em" }}>
            {Math.round(progress).toString().padStart(3, "0")}%
          </span>
          <span style={{ fontSize: 8, color: `${accent}66`, letterSpacing: "0.14em" }}>
            {isOk ? "COMPLETE" : "ACTIVE"}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Animation;
