import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import logo from "../../../assets/argus-description.png";

type Props = { onFinished?: () => void; duration?: number };
type Phase = "init" | "discovery" | "scanning" | "complete" | "exit";
type V3    = [number, number, number];

// ─── Preload ─────────────────────────────────────────────────────
const _p = new Map<string, Promise<void>>();
export const preloadLoginSuccessAnimationAssets = (): Promise<void> => {
  if (_p.has(logo)) return _p.get(logo)!;
  const pr = new Promise<void>(r => {
    const i = new Image(); i.onload = () => r(); i.onerror = () => r(); i.src = logo;
  });
  _p.set(logo, pr); return pr;
};

const useDark = () => {
  const [d, set] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const o = new MutationObserver(() =>
      set(document.documentElement.classList.contains("dark")),
    );
    o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => o.disconnect();
  }, []);
  return d;
};

// ─── Theme ───────────────────────────────────────────────────────
const T = {
  dark: {
    bg:           "#04080f",
    primary:      "#00e5ff",
    secondary:    "#7c3aed",
    safe:         "#00e676",
    warn:         "#ffaa00",
    danger:       "#ff1744",
    globe:        "#060e20",
    lc:           "#0a3d6b",
    emI: 0.90,    oLon: 0.30,  oLat: 0.18,  oEq: 0.60,
    vigRgb:       "4,8,15",
    vigStr:       0.90,
    panelBg:      "rgba(3,7,14,0.84)",
    panelBorder:  "rgba(0,229,255,0.18)",
    termBg:       "rgba(2,5,11,0.92)",
    termBorder:   "rgba(0,229,255,0.22)",
    grid:         "rgba(0,229,255,0.04)",
    text:         "#00e5ff",
    textMid:      "rgba(0,229,255,0.60)",
    textDim:      "rgba(0,229,255,0.28)",
    matFade:      "rgba(0,0,0,0.055)",
    matBright:    "#ffffff",
    matOpacity:   0.06,
  },
  light: {
    bg:           "#e4eefa",
    primary:      "#0284c7",
    secondary:    "#6d28d9",
    safe:         "#059669",
    warn:         "#d97706",
    danger:       "#dc2626",
    globe:        "#c3d9f5",
    lc:           "#60a5fa",
    emI: 0.45,    oLon: 0.25,  oLat: 0.16,  oEq: 0.42,
    vigRgb:       "210,228,248",
    vigStr:       0.66,
    panelBg:      "rgba(234,244,254,0.90)",
    panelBorder:  "rgba(2,132,199,0.26)",
    termBg:       "rgba(220,236,252,0.92)",
    termBorder:   "rgba(2,132,199,0.30)",
    grid:         "rgba(2,132,199,0.04)",
    text:         "#0369a1",
    textMid:      "rgba(3,105,161,0.65)",
    textDim:      "rgba(3,105,161,0.32)",
    matFade:      "rgba(228,238,250,0.07)",
    matBright:    "#0284c7",
    matOpacity:   0.038,
  },
};
type Theme = typeof T.dark;

// ─── Geo ─────────────────────────────────────────────────────────
const ll = (lat: number, lon: number, R = 2.05): V3 => {
  const phi = (90 - lat) * (Math.PI / 180);
  const th  = (lon + 180) * (Math.PI / 180);
  return [
    -R * Math.sin(phi) * Math.cos(th),
     R * Math.cos(phi),
     R * Math.sin(phi) * Math.sin(th),
  ];
};

// Scanner home = Bangkok, TH
const ORIGIN = ll(13.75, 100.52);

type ScanTarget = { src: V3; dst: V3; col: string; ip: string; cvss: number; sev: string; at: number };
const TARGETS: ScanTarget[] = [
  { src: ORIGIN, dst: ll(55.75,  37.62), col: "#ff1744", ip: "192.168.1.1",   cvss: 9.8, sev: "CRITICAL", at:  650 },
  { src: ORIGIN, dst: ll(31.23, 121.47), col: "#ff1744", ip: "10.0.2.15",     cvss: 9.1, sev: "CRITICAL", at:  950 },
  { src: ORIGIN, dst: ll(39.91, 116.39), col: "#ff8800", ip: "172.16.0.5",    cvss: 7.5, sev: "HIGH",     at: 1250 },
  { src: ORIGIN, dst: ll(35.69, 139.69), col: "#ff8800", ip: "10.10.20.228",  cvss: 7.8, sev: "HIGH",     at: 1550 },
  { src: ORIGIN, dst: ll(28.61,  77.21), col: "#ffaa00", ip: "192.168.2.10",  cvss: 6.1, sev: "MEDIUM",   at: 1850 },
  { src: ORIGIN, dst: ll(59.95,  30.32), col: "#ff1744", ip: "10.0.99.14",    cvss: 9.8, sev: "CRITICAL", at: 2100 },
  { src: ORIGIN, dst: ll(-23.55,-46.63), col: "#ffaa00", ip: "172.20.1.3",    cvss: 5.9, sev: "MEDIUM",   at: 2380 },
  { src: ORIGIN, dst: ll(22.28, 114.16), col: "#ff8800", ip: "10.0.2.1",      cvss: 8.1, sev: "HIGH",     at: 2650 },
  { src: ORIGIN, dst: ll(40.71, -74.01), col: "#00e5ff", ip: "192.168.0.99",  cvss: 2.6, sev: "LOW",      at: 2900 },
  { src: ORIGIN, dst: ll(51.51,  -0.13), col: "#00e5ff", ip: "10.100.5.2",    cvss: 4.8, sev: "MEDIUM",   at: 3150 },
];

type LogLine = { at: number; text: string; type: "info" | "ok" | "warn" | "crit" | "head" };
const LOG_LINES: LogLine[] = [
  { at:  400, text: "ARGUS v2.4.1 — Engine initializing",          type: "head" },
  { at:  620, text: "NVD/EPSS database loaded            [OK]",     type: "ok"   },
  { at:  820, text: "OpenVAS GMP handshake complete      [OK]",     type: "ok"   },
  { at: 1020, text: "Sweep started: 192.168.0.0/16",               type: "info" },
  { at: 1200, text: " HOST  192.168.1.1     RTT 0.11ms",           type: "info" },
  { at: 1380, text: " HOST  10.0.2.15       RTT 2.44ms",           type: "info" },
  { at: 1560, text: " HOST  172.16.0.5      RTT 1.31ms",           type: "info" },
  { at: 1740, text: " HOST  10.10.20.228    RTT 0.88ms",           type: "info" },
  { at: 1920, text: "PORT SCAN → 192.168.1.1",                     type: "head" },
  { at: 2060, text: "  22/tcp   OPEN  ssh    OpenSSH 8.9p1",       type: "info" },
  { at: 2180, text: "  80/tcp   OPEN  http   Apache/2.4.52",       type: "info" },
  { at: 2300, text: "  443/tcp  OPEN  https  nginx/1.24.0",        type: "info" },
  { at: 2430, text: "VULN CHECK → 192.168.1.1",                    type: "head" },
  { at: 2580, text: "⚠  CVE-2023-44487  7.5  HIGH    :80",        type: "warn" },
  { at: 2730, text: "⚠  CVE-2024-21887  9.1  CRITICAL :443",      type: "crit" },
  { at: 2880, text: "⚠  CVE-2023-23397  9.8  CRITICAL :25",       type: "crit" },
  { at: 3020, text: "PORT SCAN → 10.0.2.1",                        type: "head" },
  { at: 3140, text: "  3306/tcp OPEN  mysql  MySQL 8.0.34",        type: "info" },
  { at: 3260, text: "  21/tcp   OPEN  ftp    vsftpd 3.0.5",       type: "info" },
  { at: 3380, text: "⚠  CVE-2024-1394   8.1  HIGH    :3306",      type: "warn" },
  { at: 3520, text: "⚠  CVE-2023-5363   7.8  HIGH    :21",        type: "warn" },
  { at: 3680, text: "REPORT: 10 hosts · 3 CRIT · 5 HIGH · 2 MED", type: "ok"   },
  { at: 3820, text: "✓  SCAN COMPLETE — SYSTEM SECURED",           type: "ok"   },
];

type CveFeed = { at: number; id: string; score: number; sev: string; host: string; col: string };
const CVE_FEED: CveFeed[] = [
  { at: 2580, id: "CVE-2023-44487", score: 7.5, sev: "HIGH",     host: "192.168.1.1:80",   col: "#ff8800" },
  { at: 2730, id: "CVE-2024-21887", score: 9.1, sev: "CRITICAL", host: "192.168.1.1:443",  col: "#ff1744" },
  { at: 2880, id: "CVE-2023-23397", score: 9.8, sev: "CRITICAL", host: "192.168.1.1:25",   col: "#ff1744" },
  { at: 3380, id: "CVE-2024-1394",  score: 8.1, sev: "HIGH",     host: "10.0.2.1:3306",    col: "#ff8800" },
  { at: 3520, id: "CVE-2023-5363",  score: 7.8, sev: "HIGH",     host: "10.0.2.1:21",      col: "#ff8800" },
];

const STAGE_STEPS = [
  { label: "INIT",          from: 0.00, to: 0.10 },
  { label: "HOST DISCOVERY",from: 0.10, to: 0.34 },
  { label: "PORT SCAN",     from: 0.34, to: 0.56 },
  { label: "VULN ASSESS.",  from: 0.56, to: 0.80 },
  { label: "REPORT GEN.",   from: 0.80, to: 0.94 },
  { label: "SECURED",       from: 0.94, to: 1.00 },
];

// ─── Canvas bg ───────────────────────────────────────────────────
const CanvasBg: React.FC<{ bg: string }> = ({ bg }) => {
  const { gl } = useThree();
  useEffect(() => { gl.setClearColor(new THREE.Color(bg), 1); }, [gl, bg]);
  return null;
};

// ─── Globe node ──────────────────────────────────────────────────
const GeoNode: React.FC<{ pos: V3; col: string; size?: number }> = ({ pos, col, size = 0.058 }) => {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(s => {
    if (mat.current)
      mat.current.emissiveIntensity = 3.5 + Math.sin(s.clock.elapsedTime * 5 + pos[0] * 4) * 2.5;
  });
  return (
    <mesh position={pos}>
      <sphereGeometry args={[size, 8, 8]} />
      <meshStandardMaterial ref={mat} color={col} emissive={col} emissiveIntensity={3.5} />
    </mesh>
  );
};

// ─── Scan arc (origin → target) ──────────────────────────────────
const ScanArc: React.FC<{ src: V3; dst: V3; col: string }> = ({ src, dst, col }) => {
  const refs = [
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
  ];
  const curve = useMemo(() => {
    const a = new THREE.Vector3(...src);
    const b = new THREE.Vector3(...dst);
    const ctrl = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(3.2);
    return new THREE.QuadraticBezierCurve3(a, ctrl, b);
  }, [src, dst]);
  const pts = useMemo<V3[]>(() => curve.getPoints(80).map(p => [p.x, p.y, p.z]), [curve]);
  useFrame(s => {
    refs.forEach((ref, i) => {
      if (!ref.current) return;
      const t = ((s.clock.elapsedTime * 0.32 + i * 0.5) % 1);
      ref.current.position.copy(curve.getPoint(t));
    });
  });
  return (
    <>
      <Line points={pts} color={col} lineWidth={1.0} transparent opacity={0.32} />
      {refs.map((ref, i) => (
        <mesh key={i} ref={ref} position={src}>
          <sphereGeometry args={[0.038, 6, 6]} />
          <meshStandardMaterial color={col} emissive={col} emissiveIntensity={12} />
        </mesh>
      ))}
    </>
  );
};

// ─── Pulse ring ──────────────────────────────────────────────────
const PulseRing: React.FC<{ phase: Phase; col: string }> = ({ phase, col }) => {
  const mesh = useRef<THREE.Mesh>(null);
  const mat  = useRef<THREE.MeshStandardMaterial>(null);
  const t    = useRef(0);
  useFrame((_, dt) => {
    t.current += dt * 0.6;
    const s = 1 + (t.current % 1) * 0.9;
    if (mesh.current) mesh.current.scale.setScalar(s);
    if (mat.current)  mat.current.opacity = 0.18 * (1 - (t.current % 1));
  });
  if (phase === "init") return null;
  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[2.25, 24, 24]} />
      <meshStandardMaterial ref={mat} color={col} emissive={col}
        emissiveIntensity={0.5} transparent opacity={0.1} side={THREE.FrontSide} wireframe />
    </mesh>
  );
};

// ─── Globe ───────────────────────────────────────────────────────
const Globe: React.FC<{
  active: Set<number>; phase: Phase; theme: Theme; isDark: boolean;
}> = ({ active, phase, theme, isDark }) => {
  const gRef   = useRef<THREE.Group>(null);
  const rimMat = useRef<THREE.MeshStandardMaterial>(null);
  const isOk   = phase === "complete" || phase === "exit";
  useFrame((_, dt) => {
    if (gRef.current) gRef.current.rotation.y += dt * (isOk ? 0.08 : 0.13);
    if (rimMat.current) {
      const col = new THREE.Color(isOk ? theme.safe : theme.primary);
      rimMat.current.emissive.lerp(col, 0.04);
    }
  });
  const LATS = [-60, -30, 0, 30, 60];
  const LONS = Array.from({ length: 6 }, (_, i) => i * (Math.PI / 6));
  return (
    <group ref={gRef}>
      {/* Core sphere */}
      <mesh>
        <sphereGeometry args={[1.97, 40, 40]} />
        <meshStandardMaterial color={theme.globe} transparent opacity={isDark ? 0.94 : 0.58} />
      </mesh>
      {/* Glow rim */}
      <mesh>
        <sphereGeometry args={[2.22, 32, 32]} />
        <meshStandardMaterial ref={rimMat}
          color={theme.primary} emissive={theme.primary}
          emissiveIntensity={isDark ? 0.14 : 0.07}
          transparent opacity={isDark ? 0.045 : 0.022} side={THREE.BackSide} />
      </mesh>
      {/* Lon lines */}
      {LONS.map((a, i) => (
        <mesh key={i} rotation={[0, a, Math.PI / 2]}>
          <torusGeometry args={[2, 0.0035, 4, 100]} />
          <meshStandardMaterial color={theme.lc} emissive={theme.lc}
            emissiveIntensity={theme.emI} transparent opacity={theme.oLon} />
        </mesh>
      ))}
      {/* Lat lines */}
      {LATS.map(lat => {
        const phi = lat * (Math.PI / 180);
        return (
          <mesh key={lat} position={[0, 2 * Math.sin(phi), 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2 * Math.cos(phi), lat === 0 ? 0.007 : 0.0035, 4, 80]} />
            <meshStandardMaterial color={theme.lc} emissive={theme.lc}
              emissiveIntensity={lat === 0 ? theme.emI * 2.0 : theme.emI}
              transparent opacity={lat === 0 ? theme.oEq : theme.oLat} />
          </mesh>
        );
      })}
      {/* Scanner origin node */}
      <GeoNode pos={ORIGIN} col={isOk ? theme.safe : theme.primary} size={0.09} />
      {/* Targets */}
      {TARGETS.map((t, i) => active.has(i) && (
        <React.Fragment key={i}>
          <GeoNode pos={t.dst} col={isOk ? theme.safe : t.col} />
          <ScanArc src={t.src} dst={t.dst} col={isOk ? `${theme.safe}99` : t.col} />
        </React.Fragment>
      ))}
      {/* Pulse ring */}
      <PulseRing phase={phase} col={isOk ? theme.safe : theme.primary} />
    </group>
  );
};

// ─── Scan ring ───────────────────────────────────────────────────
const ScanRing: React.FC<{ phase: Phase; theme: Theme }> = ({ phase, theme }) => {
  const gRef = useRef<THREE.Group>(null);
  const mat  = useRef<THREE.MeshStandardMaterial>(null);
  const ok   = phase === "complete" || phase === "exit";
  useFrame((_, dt) => {
    if (gRef.current) gRef.current.rotation.y += dt * (ok ? 3.5 : 1.3);
    if (mat.current) mat.current.emissive.lerp(new THREE.Color(ok ? theme.safe : theme.primary), 0.06);
  });
  return (
    <group rotation={[0.55, 0, 0.12]}>
      <group ref={gRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.56, 0.010, 4, 180]} />
          <meshStandardMaterial ref={mat} color={theme.primary} emissive={theme.primary}
            emissiveIntensity={2.4} transparent opacity={0.85} />
        </mesh>
        <mesh position={[2.56, 0, 0]}>
          <sphereGeometry args={[0.068, 8, 8]} />
          <meshStandardMaterial color="#ffffff" emissive={theme.primary} emissiveIntensity={14} />
        </mesh>
      </group>
    </group>
  );
};

// ─── Matrix rain ─────────────────────────────────────────────────
const MatrixRain: React.FC<{ color: string; fade: string; bright: string; opacity: number }> = ({
  color, fade, bright, opacity,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx    = canvas.getContext("2d"); if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener("resize", resize);
    const fs    = 11;
    const chars = "01アイウエオABCDEF0123456789><{}[]=";
    const cols  = Math.floor(canvas.width / fs);
    const drops = Array.from({ length: cols }, () => Math.random() * -canvas.height);
    const draw  = () => {
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fs}px monospace`;
      drops.forEach((y, i) => {
        ctx.fillStyle = Math.random() > 0.97 ? bright : color;
        ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * fs, y);
        if (y > canvas.height) drops[i] = Math.random() * -canvas.height * 0.5;
        drops[i] += fs * 0.82;
      });
    };
    const id = setInterval(draw, 54);
    return () => { clearInterval(id); window.removeEventListener("resize", resize); };
  }, [color, fade, bright]);
  return (
    <canvas ref={ref}
      style={{ position: "absolute", inset: 0, opacity, zIndex: 2, pointerEvents: "none" }} />
  );
};

// ─── Scan beam ───────────────────────────────────────────────────
const ScanBeam: React.FC<{ color: string }> = ({ color }) => (
  <motion.div
    animate={{ top: ["-2%", "102%"] }}
    transition={{ repeat: Infinity, duration: 3.8, ease: "linear", repeatDelay: 0.6 }}
    style={{
      position: "absolute", left: 0, right: 0, height: 2, zIndex: 7, pointerEvents: "none",
      background: `linear-gradient(90deg,transparent 0%,${color}28 12%,${color}99 50%,${color}28 88%,transparent 100%)`,
      boxShadow: `0 0 20px ${color}55, 0 0 5px ${color}`,
    }}
  />
);

// ─── HUD corners ─────────────────────────────────────────────────
const Corner: React.FC<{ pos: "tl"|"tr"|"bl"|"br"; col: string }> = ({ pos, col }) => {
  const st: Record<string, React.CSSProperties> = {
    tl: { top: 16, left: 16 },
    tr: { top: 16, right: 16, transform: "scaleX(-1)" },
    bl: { bottom: 16, left: 16, transform: "scaleY(-1)" },
    br: { bottom: 16, right: 16, transform: "scale(-1)" },
  };
  const sh = `0 0 12px ${col}`;
  return (
    <div style={{ position: "absolute", width: 28, height: 28, pointerEvents: "none", ...st[pos] }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 22, height: 2, background: col, boxShadow: sh }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: 2, height: 22, background: col, boxShadow: sh }} />
    </div>
  );
};

// ─── Glitch text ─────────────────────────────────────────────────
const GlitchText: React.FC<{ text: string; col: string; style?: React.CSSProperties }> = ({
  text, col, style,
}) => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const go = () => { setOn(true); setTimeout(() => setOn(false), 140); };
    let id = setTimeout(function repeat() {
      go(); id = setTimeout(repeat, 2800 + Math.random() * 2200);
    }, 1600);
    return () => clearTimeout(id);
  }, []);
  return (
    <div style={{ position: "relative", display: "inline-block", ...style }}>
      <span style={{ color: col, textShadow: `0 0 16px ${col}88` }}>{text}</span>
      {on && (
        <>
          <span style={{ position: "absolute", inset: 0, color: "#ff0033", transform: "translate(-2px,1px)", opacity: 0.7 }}>{text}</span>
          <span style={{ position: "absolute", inset: 0, color: "#00ffff", transform: "translate(2px,-1px)", opacity: 0.7 }}>{text}</span>
        </>
      )}
    </div>
  );
};

// ─── Terminal Panel ───────────────────────────────────────────────
const TerminalPanel: React.FC<{
  lines: LogLine[]; elapsed: number; theme: Theme; phase: Phase;
}> = ({ lines, elapsed, theme, phase }) => {
  const shown = lines.filter(l => l.at <= elapsed).slice(-11);
  const col = (type: LogLine["type"]) => {
    if (type === "ok")   return theme.safe;
    if (type === "warn") return theme.warn;
    if (type === "crit") return theme.danger;
    if (type === "head") return theme.text;
    return theme.textMid;
  };
  const dim = (type: LogLine["type"]) =>
    type === "info" ? "rgba(0,0,0,0)" : "rgba(0,0,0,0)";

  return (
    <motion.div
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: phase !== "init" ? 1 : 0, x: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      style={{
        position: "absolute", top: 54, left: 18, zIndex: 20, pointerEvents: "none",
        width: 264,
        background: theme.termBg,
        border: `1px solid ${theme.termBorder}`,
        backdropFilter: "blur(6px)",
      }}
    >
      {/* Header */}
      <div style={{
        borderBottom: `1px solid ${theme.termBorder}`,
        padding: "5px 10px",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <div style={{ display: "flex", gap: 4 }}>
          {["#ff5f56","#ffbd2e","#27c93f"].map(c => (
            <div key={c} style={{ width: 7, height: 7, borderRadius: 9999, background: c }} />
          ))}
        </div>
        <span style={{ fontSize: 8, color: theme.textMid, letterSpacing: "0.18em", marginLeft: 4 }}>
          ARGUS — SCAN TERMINAL
        </span>
      </div>
      {/* Lines */}
      <div style={{ padding: "6px 10px", minHeight: 148, display: "flex", flexDirection: "column", gap: 2.5 }}>
        {shown.map((line, i) => (
          <motion.div
            key={`${line.at}-${i}`}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22 }}
            style={{
              fontFamily: "ui-monospace,'Courier New',monospace",
              fontSize: 8.5,
              letterSpacing: "0.06em",
              color: col(line.type),
              textShadow: line.type !== "info" ? `0 0 8px ${col(line.type)}66` : "none",
              lineHeight: 1.5,
              background: dim(line.type),
            }}
          >
            {line.text}
          </motion.div>
        ))}
        {/* Blinking cursor */}
        <span style={{
          display: "inline-block", width: 6, height: 12,
          background: theme.text,
          opacity: Math.floor(elapsed / 500) % 2 === 0 ? 1 : 0,
          boxShadow: `0 0 6px ${theme.text}`,
          verticalAlign: "middle",
        }} />
      </div>
    </motion.div>
  );
};

// ─── CVE Feed Panel ───────────────────────────────────────────────
const CveFeedPanel: React.FC<{
  cves: CveFeed[]; elapsed: number; theme: Theme; active: Set<number>;
}> = ({ cves, elapsed, theme, active }) => {
  const shown = cves.filter(c => c.at <= elapsed);
  const critN  = shown.filter(c => c.sev === "CRITICAL").length;
  const highN  = shown.filter(c => c.sev === "HIGH").length;
  const totHost = active.size;

  return (
    <motion.div
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: active.size > 0 ? 1 : 0, x: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        position: "absolute", top: 54, right: 18, zIndex: 20, pointerEvents: "none",
        width: 226,
        background: theme.termBg,
        border: `1px solid ${theme.termBorder}`,
        backdropFilter: "blur(6px)",
      }}
    >
      {/* Header */}
      <div style={{
        borderBottom: `1px solid ${theme.termBorder}`,
        padding: "5px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 8, color: theme.textMid, letterSpacing: "0.18em" }}>
          THREAT INTEL FEED
        </span>
        <div style={{
          fontSize: 7.5, color: theme.danger,
          textShadow: `0 0 8px ${theme.danger}`,
          letterSpacing: "0.12em",
        }}>
          LIVE
          <span style={{
            display: "inline-block", width: 5, height: 5, borderRadius: 9999,
            background: theme.danger, marginLeft: 4,
            boxShadow: `0 0 6px ${theme.danger}`,
            animation: "none",
          }} />
        </div>
      </div>

      {/* Metrics row */}
      <div style={{
        display: "flex", gap: 0,
        borderBottom: `1px solid ${theme.termBorder}`,
      }}>
        {[
          { label: "HOSTS", val: totHost,  col: theme.text    },
          { label: "CRIT",  val: critN,    col: theme.danger  },
          { label: "HIGH",  val: highN,    col: theme.warn    },
          { label: "TOTAL", val: shown.length, col: theme.textMid },
        ].map(({ label, val, col }, i) => (
          <div key={label} style={{
            flex: 1, textAlign: "center", padding: "5px 0",
            borderRight: i < 3 ? `1px solid ${theme.termBorder}` : "none",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: col, textShadow: `0 0 10px ${col}66` }}>
              {val}
            </div>
            <div style={{ fontSize: 6.5, color: theme.textDim, letterSpacing: "0.14em" }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* CVE list */}
      <div style={{ padding: "6px 0", display: "flex", flexDirection: "column" }}>
        <AnimatePresence>
          {shown.slice().reverse().slice(0, 5).map(c => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
              style={{
                padding: "4px 10px",
                borderBottom: `1px solid ${theme.termBorder}44`,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <div style={{
                width: 5, height: 5, borderRadius: 9999, flexShrink: 0,
                background: c.col, boxShadow: `0 0 8px ${c.col}`,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 8.5, fontWeight: 700, color: c.col, textShadow: `0 0 8px ${c.col}55`, letterSpacing: "0.04em" }}>
                  {c.id}
                </div>
                <div style={{ fontSize: 7.5, color: theme.textDim, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.host}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: c.col }}>{c.score}</div>
                <div style={{ fontSize: 6.5, color: `${c.col}88`, letterSpacing: "0.1em" }}>{c.sev.slice(0, 4)}</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {shown.length === 0 && (
          <div style={{ padding: "12px 10px", fontSize: 8, color: theme.textDim, textAlign: "center" }}>
            Scanning for vulnerabilities...
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Stage progress bar ───────────────────────────────────────────
const StageBar: React.FC<{ progress: number; theme: Theme; isOk: boolean }> = ({
  progress, theme, isOk,
}) => {
  const curStage = STAGE_STEPS.findIndex(s => progress / 100 >= s.from && progress / 100 < s.to);
  const stageIdx = curStage === -1 ? STAGE_STEPS.length - 1 : curStage;
  const accent   = isOk ? theme.safe : theme.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      style={{
        position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)",
        width: "min(400px, 76vw)", zIndex: 20, pointerEvents: "none",
      }}
    >
      {/* Stage dots */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
        {STAGE_STEPS.map((s, i) => {
          const done    = progress / 100 >= s.to;
          const current = i === stageIdx;
          return (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{
                width: 7, height: 7, borderRadius: 9999,
                background:  done || current ? accent : "transparent",
                border:      `1px solid ${done || current ? accent : `${accent}30`}`,
                boxShadow:   current ? `0 0 10px ${accent}` : "none",
                transition:  "all 0.3s",
              }} />
              <span style={{
                fontSize: 6.5, letterSpacing: "0.12em",
                color:   done || current ? `${accent}cc` : `${accent}30`,
                fontWeight: current ? 700 : 400,
              }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bar */}
      <div style={{
        width: "100%", height: 5, position: "relative",
        border: `1px solid ${accent}25`,
        background: `${accent}08`,
        overflow: "hidden",
      }}>
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1, ease: "linear" }}
          style={{
            position: "absolute", inset: "0 auto 0 0", height: "100%",
            background: `linear-gradient(90deg, ${accent}66, ${accent})`,
            boxShadow: `0 0 12px ${accent}, 0 0 4px ${accent}`,
          }}
        />
        {/* Tick marks */}
        {Array.from({ length: 19 }, (_, i) => (
          <div key={i} style={{
            position: "absolute", top: 0, bottom: 0, left: `${(i + 1) * 5}%`,
            width: 1, background: `${theme.bg}88`, zIndex: 1,
          }} />
        ))}
      </div>

      {/* Footer row */}
      <div style={{
        marginTop: 7, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 7.5, color: `${accent}55`, letterSpacing: "0.14em" }}>
          {isOk ? "SCAN COMPLETE" : STAGE_STEPS[stageIdx]?.label ?? "SCANNING"}
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700, color: accent,
          textShadow: `0 0 12px ${accent}`, letterSpacing: "0.06em",
          fontFamily: "ui-monospace,'Courier New',monospace",
        }}>
          {Math.round(progress).toString().padStart(3, "0")}%
        </span>
        <span style={{ fontSize: 7.5, color: `${accent}55`, letterSpacing: "0.14em" }}>
          ARGUS v2.4.1
        </span>
      </div>
    </motion.div>
  );
};

// ─── Center status overlay ────────────────────────────────────────
const CenterOverlay: React.FC<{ phase: Phase; theme: Theme; progress: number }> = ({
  phase, theme, progress,
}) => {
  const isOk   = phase === "complete" || phase === "exit";
  const accent = isOk ? theme.safe : theme.primary;
  const stageIdx = STAGE_STEPS.findIndex(s => progress / 100 >= s.from && progress / 100 < s.to);
  const label  = isOk ? "SYSTEM SECURED" : (STAGE_STEPS[stageIdx < 0 ? 0 : stageIdx]?.label ?? "SCANNING");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: phase !== "init" ? 1 : 0, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      style={{
        position: "absolute", inset: 0, zIndex: 18, pointerEvents: "none",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 10,
      }}
    >
      {/* Logo */}
      <div style={{
        padding: "10px 18px",
        background: theme.panelBg,
        border: `1px solid ${accent}22`,
        backdropFilter: "blur(8px)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      }}>
        <img src={logo} alt="Argus"
          style={{ height: 32, objectFit: "contain", filter: `drop-shadow(0 0 8px ${accent}66)` }} />
        <div style={{ width: "100%", height: 1, background: `linear-gradient(90deg,transparent,${accent}44,transparent)` }} />
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{
            width: 6, height: 6, borderRadius: 9999,
            background: isOk ? theme.safe : theme.warn,
            boxShadow: `0 0 10px ${isOk ? theme.safe : theme.warn}`,
            animation: isOk ? "none" : undefined,
          }} />
          <span style={{
            fontSize: 8.5, letterSpacing: "0.22em", fontWeight: 700,
            color: accent, textShadow: `0 0 12px ${accent}66`,
            fontFamily: "ui-monospace,'Courier New',monospace",
          }}>
            {label}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────
const Animation: React.FC<Props> = ({ onFinished, duration = 5200 }) => {
  const TOTAL  = Math.max(duration, 5000);
  const isDark = useDark();
  const theme  = isDark ? T.dark : T.light;

  const [phase,    setPhase]    = useState<Phase>("init");
  const [active,   setActive]   = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState(0);
  const [elapsed,  setElapsed]  = useState(0);

  const onFinRef = useRef(onFinished);
  const doneRef  = useRef(false);
  useEffect(() => { onFinRef.current = onFinished; }, [onFinished]);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("discovery"),                         380),
      setTimeout(() => setPhase("scanning"),  Math.max(TOTAL * 0.34, 1800)),
      setTimeout(() => setPhase("complete"),  Math.max(TOTAL - 900,  3800)),
      setTimeout(() => setPhase("exit"),      Math.max(TOTAL - 350,  4400)),
      ...TARGETS.map((t, i) => setTimeout(() => setActive(p => new Set([...p, i])), t.at)),
      setTimeout(() => {
        if (!doneRef.current) { doneRef.current = true; onFinRef.current?.(); }
      }, TOTAL + 400),
    ];
    const start = performance.now();
    let raf = 0;
    const frame = () => {
      const ms = performance.now() - start;
      setProgress(Math.min((ms / TOTAL) * 100, 100));
      setElapsed(ms);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { timers.forEach(clearTimeout); cancelAnimationFrame(raf); };
  }, [TOTAL]);

  const isOk   = phase === "complete" || phase === "exit";
  const accent = isOk ? theme.safe : theme.primary;

  const ambientInt = isDark ? 0.04 : 0.28;
  const ptInt1     = isDark ? 11   : 7;
  const ptInt2     = isDark ? 5    : 3;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === "exit" ? 0 : 1 }}
      transition={{ duration: 0.5 }}
      style={{
        position: "fixed", inset: 0, overflow: "hidden",
        background: theme.bg,
        fontFamily: "ui-monospace,'Courier New',monospace",
      }}
    >
      {/* Grid overlay */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(${theme.grid} 1px, transparent 1px),
          linear-gradient(90deg, ${theme.grid} 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }} />

      {/* Matrix rain */}
      <MatrixRain
        color={theme.primary}
        fade={theme.matFade}
        bright={theme.matBright}
        opacity={theme.matOpacity}
      />

      {/* Scan beam */}
      {phase !== "init" && <ScanBeam color={theme.primary} />}

      {/* 3D scene */}
      <div style={{ position: "absolute", inset: 0, zIndex: 5 }}>
        <Canvas camera={{ position: [0, 1.2, 8.2], fov: 42 }}
          gl={{ antialias: true, alpha: false }} dpr={[1, 1.5]}>
          <CanvasBg bg={theme.bg} />
          <ambientLight intensity={ambientInt} />
          <pointLight position={[5,  6,  6]}  color="#ffffff"         intensity={ptInt1} distance={26} />
          <pointLight position={[-4,-4, -5]}  color={theme.secondary} intensity={ptInt2} distance={22} />
          {!isDark && <pointLight position={[0, 0, 6]} color={theme.primary} intensity={2.5} distance={18} />}
          <Globe active={active} phase={phase} theme={theme} isDark={isDark} />
          <ScanRing phase={phase} theme={theme} />
        </Canvas>
      </div>

      {/* Vignette */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 8, pointerEvents: "none",
        background: `radial-gradient(ellipse 72% 72% at 50% 52%, transparent 28%, rgba(${theme.vigRgb},${theme.vigStr}) 100%)`,
      }} />

      {/* Secure flash */}
      {isOk && (
        <motion.div
          initial={{ opacity: 0.35 }} animate={{ opacity: 0 }} transition={{ duration: 1.2 }}
          style={{
            position: "absolute", inset: 0, zIndex: 9, pointerEvents: "none",
            background: `radial-gradient(ellipse at center, ${theme.safe}28 0%, transparent 60%)`,
          }}
        />
      )}

      {/* HUD corners */}
      <div style={{ position: "absolute", inset: 0, zIndex: 15, pointerEvents: "none" }}>
        {(["tl","tr","bl","br"] as const).map(p => <Corner key={p} pos={p} col={accent} />)}
      </div>

      {/* Top title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        style={{
          position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 20, pointerEvents: "none", textAlign: "center",
        }}
      >
        <GlitchText
          text={isOk ? "[ NETWORK SECURED ]" : "[ THREAT INTELLIGENCE ACTIVE ]"}
          col={accent}
          style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.22em" }}
        />
      </motion.div>

      {/* Terminal panel — left */}
      <TerminalPanel
        lines={LOG_LINES}
        elapsed={elapsed}
        theme={theme}
        phase={phase}
      />

      {/* CVE feed panel — right */}
      <CveFeedPanel
        cves={CVE_FEED}
        elapsed={elapsed}
        theme={theme}
        active={active}
      />

      {/* Center logo + stage */}
      <CenterOverlay phase={phase} theme={theme} progress={progress} />

      {/* Stage progress bar — bottom */}
      <StageBar progress={progress} theme={theme} isOk={isOk} />
    </motion.div>
  );
};

export default Animation;
