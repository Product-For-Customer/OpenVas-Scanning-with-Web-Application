import React, { useEffect, useMemo, useState } from "react";
import logo from "../../../assets/argus-description.png";

type Props = {
  onFinished?: () => void;
  duration?: number;
};

const Index: React.FC<Props> = ({ onFinished, duration = 1000 }) => {
  const [start, setStart] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setStart(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const totalDuration = Math.max(duration, 100);
    const intervalMs = 30;
    const totalSteps = Math.ceil(totalDuration / intervalMs);
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep += 1;
      const nextValue = Math.min(
        100,
        Math.round((currentStep / totalSteps) * 100)
      );

      setProgress(nextValue);

      if (nextValue >= 100) {
        clearInterval(timer);
        if (onFinished) {
          setTimeout(() => onFinished(), 280);
        }
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [duration, onFinished]);

  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => {
        const angle = (360 / 24) * i;
        const delay = (i % 8) * 0.18;
        const size = i % 4 === 0 ? 8 : i % 3 === 0 ? 6 : 4;
        const radius = i % 2 === 0 ? 36 : 43;
        return { angle, delay, size, radius };
      }),
    []
  );

  const scanBars = useMemo(() => Array.from({ length: 8 }, (_, i) => i), []);
  const streamDots = useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          width: 100%;
          min-height: 100%;
        }

        body {
          margin: 0;
          overflow: hidden;
          font-family: Arial, Helvetica, sans-serif;
        }

        .argus-login {
          position: relative;
          width: 100%;
          min-height: 100vh;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          isolation: isolate;
          transition: background 0.45s ease, color 0.45s ease;
          background:
            radial-gradient(circle at 50% 40%, rgba(14,165,233,0.18) 0%, rgba(56,189,248,0.09) 18%, rgba(255,255,255,0) 42%),
            radial-gradient(circle at 22% 18%, rgba(37,99,235,0.09) 0%, transparent 28%),
            radial-gradient(circle at 82% 78%, rgba(6,182,212,0.10) 0%, transparent 28%),
            linear-gradient(180deg, #f5fbff 0%, #edf6ff 42%, #e6f2ff 100%);
        }

        .dark .argus-login {
          background:
            radial-gradient(circle at 50% 42%, rgba(56,189,248,0.15) 0%, rgba(56,189,248,0.05) 18%, transparent 38%),
            radial-gradient(circle at 18% 20%, rgba(37,99,235,0.10) 0%, transparent 28%),
            radial-gradient(circle at 82% 76%, rgba(6,182,212,0.10) 0%, transparent 28%),
            linear-gradient(180deg, #01040b 0%, #03101f 38%, #030915 100%);
        }

        .vignette {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background:
            radial-gradient(circle at center, transparent 42%, rgba(0,0,0,0.06) 74%, rgba(0,0,0,0.10) 100%);
        }

        .dark .vignette {
          background:
            radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.24) 70%, rgba(0,0,0,0.58) 100%);
        }

        .noise {
          position: absolute;
          inset: 0;
          z-index: 1;
          opacity: 0.08;
          pointer-events: none;
          background-image:
            radial-gradient(rgba(103,232,249,0.22) 0.7px, transparent 0.7px);
          background-size: 18px 18px;
          mask-image: radial-gradient(circle at center, black 35%, transparent 92%);
          -webkit-mask-image: radial-gradient(circle at center, black 35%, transparent 92%);
        }

        .grid {
          position: absolute;
          inset: -8%;
          z-index: 1;
          opacity: 0.28;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(56,189,248,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56,189,248,0.05) 1px, transparent 1px);
          background-size: 52px 52px;
          transform: perspective(1000px) rotateX(74deg) scale(1.6);
          transform-origin: center center;
          animation: floorDrift 12s linear infinite;
        }

        .ambient-left,
        .ambient-right {
          position: absolute;
          top: 50%;
          width: 46vw;
          height: 46vw;
          max-width: 720px;
          max-height: 720px;
          border-radius: 9999px;
          filter: blur(80px);
          pointer-events: none;
          z-index: 1;
          opacity: 0.65;
        }

        .ambient-left {
          left: -10%;
          background: radial-gradient(circle, rgba(37,99,235,0.18) 0%, rgba(37,99,235,0.06) 40%, transparent 72%);
          animation: ambientFloatLeft 8s ease-in-out infinite;
        }

        .ambient-right {
          right: -10%;
          background: radial-gradient(circle, rgba(34,211,238,0.16) 0%, rgba(34,211,238,0.05) 42%, transparent 72%);
          animation: ambientFloatRight 9s ease-in-out infinite;
        }

        .center-core-glow {
          position: absolute;
          width: min(62vw, 720px);
          aspect-ratio: 1;
          border-radius: 9999px;
          z-index: 2;
          pointer-events: none;
          background:
            radial-gradient(circle, rgba(255,255,255,0.24) 0%, rgba(103,232,249,0.20) 12%, rgba(56,189,248,0.12) 26%, rgba(37,99,235,0.04) 48%, transparent 72%);
          filter: blur(28px);
          animation: coreBreath 4.5s ease-in-out infinite;
        }

        .intro-flash {
          position: absolute;
          inset: 0;
          z-index: 10;
          pointer-events: none;
          background:
            radial-gradient(circle at center, rgba(255,255,255,0.95) 0%, rgba(103,232,249,0.38) 10%, rgba(37,99,235,0.08) 22%, transparent 38%);
          opacity: 0;
          animation: introFlash 1.1s ease-out forwards;
        }

        .scene {
          position: relative;
          width: min(96vw, 1280px);
          height: min(94vh, 920px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3;
        }

        .scene.enter-ready {
          opacity: 0;
          transform: scale(0.965);
        }

        .scene.enter-ready.enter-active {
          opacity: 1;
          transform: scale(1);
          transition:
            opacity 900ms ease,
            transform 1100ms cubic-bezier(.18,.84,.24,1);
        }

        .ring-a,
        .ring-b,
        .ring-c,
        .crosshair-h,
        .crosshair-v,
        .scan-mask {
          position: absolute;
          border-radius: 9999px;
          pointer-events: none;
        }

        .ring-a {
          width: 56%;
          height: 56%;
          border: 1px solid rgba(56,189,248,0.22);
          box-shadow:
            inset 0 0 22px rgba(103,232,249,0.08),
            0 0 18px rgba(56,189,248,0.12);
          animation: spinClock 16s linear infinite;
        }

        .ring-b {
          width: 68%;
          height: 68%;
          border: 1px dashed rgba(59,130,246,0.20);
          animation: spinCounter 20s linear infinite;
        }

        .ring-c {
          width: 80%;
          height: 80%;
          border: 1px solid rgba(147,197,253,0.10);
          animation: ringBreath 4.8s ease-in-out infinite;
        }

        .crosshair-h {
          width: 72%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(103,232,249,0.58), transparent);
          opacity: 0.62;
          animation: linePulse 3s ease-in-out infinite;
        }

        .crosshair-v {
          width: 1px;
          height: 72%;
          background: linear-gradient(180deg, transparent, rgba(103,232,249,0.58), transparent);
          opacity: 0.62;
          animation: linePulse 3.2s ease-in-out infinite;
        }

        .scan-mask {
          width: 62%;
          height: 62%;
          animation: spinClock 5.4s linear infinite;
        }

        .scan-mask::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background:
            conic-gradient(
              from 0deg,
              rgba(56,189,248,0) 0deg,
              rgba(56,189,248,0) 290deg,
              rgba(56,189,248,0.08) 320deg,
              rgba(255,255,255,0.86) 343deg,
              rgba(56,189,248,0) 360deg
            );
          mask: radial-gradient(circle, transparent 58%, black 60%, black 100%);
          -webkit-mask: radial-gradient(circle, transparent 58%, black 60%, black 100%);
          filter: drop-shadow(0 0 14px rgba(103,232,249,0.42));
        }

        .network-map {
          position: absolute;
          inset: 0;
          z-index: 3;
          pointer-events: none;
        }

        .network-svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .network-link {
          stroke: rgba(125,211,252,0.42);
          stroke-width: 2;
          fill: none;
          stroke-linecap: round;
          stroke-dasharray: 6 10;
          animation: dashMove 4.2s linear infinite;
          filter: drop-shadow(0 0 8px rgba(56,189,248,0.16));
        }

        .network-link.soft {
          stroke: rgba(125,211,252,0.22);
          stroke-width: 1.4;
          stroke-dasharray: 4 9;
        }

        .signal-dot {
          fill: #dff7ff;
          filter: drop-shadow(0 0 10px rgba(103,232,249,0.75));
          animation: nodeBlink 2.5s ease-in-out infinite;
        }

        .hub-pulse {
          fill: rgba(56,189,248,0.10);
          stroke: rgba(103,232,249,0.40);
          stroke-width: 1.5;
          animation: hubPulse 2.6s ease-in-out infinite;
        }

        .device-node {
          position: absolute;
          z-index: 5;
          width: 122px;
          pointer-events: none;
          transform: translate(-50%, -50%);
          animation: floatNode 5.2s ease-in-out infinite;
        }

        .device-node.router { left: 23%; top: 28%; animation-delay: 0s; }
        .device-node.switch { left: 22%; top: 58%; animation-delay: 0.8s; }
        .device-node.server { left: 77%; top: 28%; animation-delay: 1.2s; }
        .device-node.pc { left: 79%; top: 59%; animation-delay: 0.45s; }
        .device-node.wireless { left: 50%; top: 15%; animation-delay: 1.6s; }

        /* เอากล่องขาว/ใสออกตรงนี้ */
        .device-card {
          position: relative;
          width: 100%;
          border-radius: 18px;
          padding: 12px 10px 11px;
          transition: none;
          background: transparent;
          border: none;
          box-shadow: none;
          backdrop-filter: none;
        }

        .dark .device-card {
          background: transparent;
          border: none;
          box-shadow: none;
        }

        /* เอาแสงฟุ้งของกล่องออก */
        .device-glow {
          display: none;
        }

        .device-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }

        .device-icon {
          width: 40px;
          height: 40px;
          color: #0f172a;
          filter: drop-shadow(0 0 10px rgba(56,189,248,0.18));
        }

        .dark .device-icon {
          color: #e0f7ff;
          filter: drop-shadow(0 0 12px rgba(103,232,249,0.28));
        }

        .device-label {
          text-align: center;
          font-size: 11px;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #0f172a;
          text-shadow:
            0 1px 0 rgba(255,255,255,0.4),
            0 0 10px rgba(103,232,249,0.18);
        }

        .dark .device-label {
          color: rgba(240,249,255,0.92);
          text-shadow: 0 0 12px rgba(103,232,249,0.18);
        }

        .device-sub {
          margin-top: 4px;
          text-align: center;
          font-size: 9px;
          line-height: 1.2;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(15,23,42,0.52);
        }

        .dark .device-sub {
          color: rgba(186,230,253,0.58);
        }

        .device-dot {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 10px;
          height: 10px;
          border-radius: 9999px;
          background: #22c55e;
          box-shadow:
            0 0 10px rgba(34,197,94,0.65),
            0 0 20px rgba(34,197,94,0.25);
          animation: ledPulse 1.6s ease-in-out infinite;
        }

        .logo-zone {
          position: relative;
          z-index: 6;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: min(60vw, 650px);
          max-width: 650px;
          animation: logoReveal 1.3s cubic-bezier(.18,.84,.24,1) both;
          animation-delay: 0.2s;
        }

        .logo-rim-light {
          position: absolute;
          inset: 2% -1%;
          border-radius: 9999px;
          z-index: 1;
          pointer-events: none;
          background:
            radial-gradient(circle at 50% 45%, rgba(255,255,255,0.44) 0%, rgba(186,230,253,0.18) 26%, rgba(56,189,248,0.06) 48%, transparent 70%);
          filter: blur(18px);
          animation: rimPulse 3.4s ease-in-out infinite;
        }

        .dark .logo-rim-light {
          background:
            radial-gradient(circle at 50% 45%, rgba(103,232,249,0.18) 0%, rgba(56,189,248,0.12) 26%, rgba(37,99,235,0.05) 48%, transparent 70%);
        }

        .logo-aura {
          position: absolute;
          inset: 3% -2%;
          border-radius: 9999px;
          background:
            radial-gradient(circle at 50% 42%, rgba(103,232,249,0.26) 0%, rgba(56,189,248,0.16) 32%, rgba(37,99,235,0.05) 56%, transparent 74%);
          filter: blur(26px);
          animation: auraPulse 3.6s ease-in-out infinite;
          z-index: 1;
        }

        .logo-crystal-beam {
          position: absolute;
          top: -6%;
          left: 50%;
          width: 22%;
          height: 42%;
          transform: translateX(-50%);
          pointer-events: none;
          background:
            linear-gradient(
              180deg,
              rgba(255,255,255,0) 0%,
              rgba(103,232,249,0.30) 18%,
              rgba(56,189,248,0.18) 42%,
              rgba(37,99,235,0.07) 76%,
              rgba(255,255,255,0) 100%
            );
          clip-path: polygon(48% 0%, 52% 0%, 100% 100%, 0% 100%);
          filter: blur(10px);
          opacity: 0.92;
          animation: beamSurge 2.5s ease-in-out infinite;
          z-index: 2;
        }

        .logo-crystal-focus {
          position: absolute;
          top: 3%;
          left: 50%;
          width: 46%;
          height: 46%;
          transform: translateX(-50%);
          z-index: 2;
          border-radius: 9999px;
          pointer-events: none;
          background:
            radial-gradient(circle, rgba(255,255,255,0.52) 0%, rgba(186,230,253,0.28) 22%, rgba(56,189,248,0.12) 42%, transparent 72%);
          filter: blur(20px);
          animation: crystalFocusPulse 3s ease-in-out infinite;
        }

        .dark .logo-crystal-focus {
          background:
            radial-gradient(circle, rgba(103,232,249,0.26) 0%, rgba(56,189,248,0.18) 22%, rgba(37,99,235,0.09) 42%, transparent 72%);
        }

        .logo-text-focus {
          position: absolute;
          left: 10%;
          right: 10%;
          bottom: 9%;
          height: 24%;
          z-index: 2;
          pointer-events: none;
          border-radius: 9999px;
          background:
            radial-gradient(circle at center, rgba(8,47,73,0.26) 0%, rgba(3,105,161,0.16) 28%, rgba(56,189,248,0.06) 54%, transparent 80%);
          filter: blur(16px);
          animation: textFocusPulse 3.2s ease-in-out infinite;
        }

        .dark .logo-text-focus {
          background:
            radial-gradient(circle at center, rgba(8,47,73,0.22) 0%, rgba(14,165,233,0.14) 28%, rgba(56,189,248,0.05) 54%, transparent 80%);
        }

        .logo-emphasis {
          position: absolute;
          inset: auto 10% 12% 10%;
          height: 18%;
          border-radius: 9999px;
          background:
            radial-gradient(circle, rgba(255,255,255,0.34) 0%, rgba(103,232,249,0.18) 22%, rgba(56,189,248,0.05) 46%, transparent 78%);
          filter: blur(14px);
          z-index: 3;
          animation: emphasisPulse 2.9s ease-in-out infinite;
        }

        .logo-wrap {
          position: relative;
          z-index: 4;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.2rem 1rem 0.9rem;
        }

        .logo-img {
          position: relative;
          z-index: 2;
          width: 100%;
          height: auto;
          object-fit: contain;
          user-select: none;
          -webkit-user-drag: none;
          filter:
            contrast(1.18)
            saturate(1.08)
            brightness(0.97)
            drop-shadow(0 0 1px rgba(8,47,73,0.78))
            drop-shadow(0 0 2px rgba(8,47,73,0.52))
            drop-shadow(0 0 16px rgba(103,232,249,0.26))
            drop-shadow(0 18px 32px rgba(37,99,235,0.16));
          animation: logoFloat 4.8s ease-in-out infinite;
        }

        .dark .logo-img {
          filter:
            saturate(1.04)
            brightness(1.02)
            drop-shadow(0 0 20px rgba(103,232,249,0.24))
            drop-shadow(0 20px 34px rgba(37,99,235,0.16));
        }

        .scan-lines {
          position: absolute;
          inset: 12% 8%;
          z-index: 5;
          pointer-events: none;
          overflow: hidden;
          border-radius: 22px;
          mix-blend-mode: screen;
        }

        .scan-bar {
          position: absolute;
          left: -15%;
          width: 130%;
          height: 9%;
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0) 0%,
            rgba(103,232,249,0.0) 18%,
            rgba(255,255,255,0.20) 50%,
            rgba(103,232,249,0.0) 82%,
            rgba(255,255,255,0) 100%
          );
          filter: blur(7px);
          opacity: 0;
          transform: skewY(-10deg) translateY(0);
          animation: scanPass 3.4s linear infinite;
        }

        .orbit-layer {
          position: absolute;
          width: 70%;
          height: 70%;
          animation: spinClock 13s linear infinite;
          pointer-events: none;
          z-index: 4;
        }

        .particle {
          position: absolute;
          top: 50%;
          left: 50%;
          border-radius: 9999px;
          background: radial-gradient(circle, #e0f7ff 0%, #67e8f9 30%, #38bdf8 65%, rgba(56,189,248,0) 100%);
          box-shadow:
            0 0 12px rgba(103,232,249,0.56),
            0 0 24px rgba(56,189,248,0.26);
          animation: particleTwinkle 2.6s ease-in-out infinite;
        }

        .logo-shine {
          position: absolute;
          inset: 10% 6% 12% 6%;
          z-index: 6;
          overflow: hidden;
          pointer-events: none;
          border-radius: 28px;
        }

        .logo-shine::before {
          content: "";
          position: absolute;
          top: -8%;
          left: -28%;
          width: 24%;
          height: 116%;
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.46) 48%,
            rgba(255,255,255,0) 100%
          );
          transform: skewX(-18deg);
          filter: blur(6px);
          animation: logoSweep 4.2s ease-in-out infinite;
        }

        .dark .logo-shine::before {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.28) 48%,
            rgba(255,255,255,0) 100%
          );
        }

        .loader-shell {
          position: absolute;
          left: 50%;
          bottom: 6.2%;
          transform: translateX(-50%);
          z-index: 9;
          width: min(620px, 92vw);
          animation: panelRise 1.15s ease-out both;
          animation-delay: 1s;
        }

        .loader-frame {
          position: relative;
          width: 100%;
          padding: 10px;
          border-radius: 9999px;
          background:
            linear-gradient(180deg, rgba(203, 235, 255, 0.86), rgba(220, 242, 255, 0.64));
          border: 1px solid rgba(56,189,248,0.26);
          box-shadow:
            0 12px 28px rgba(37,99,235,0.10),
            0 0 24px rgba(56,189,248,0.10),
            inset 0 1px 0 rgba(255,255,255,0.35);
          backdrop-filter: blur(10px);
        }

        .dark .loader-frame {
          background:
            linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03));
          border: 1px solid rgba(125,211,252,0.14);
          box-shadow:
            0 14px 32px rgba(0,0,0,0.22),
            0 0 34px rgba(56,189,248,0.10),
            inset 0 1px 0 rgba(255,255,255,0.08);
        }

        .loader-soft-glow {
          position: absolute;
          inset: -10px;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(56,189,248,0.12) 0%, rgba(56,189,248,0.05) 42%, transparent 72%);
          filter: blur(12px);
          z-index: -1;
          animation: loaderGlow 2.8s ease-in-out infinite;
        }

        .loader-rail {
          position: relative;
          width: 100%;
          height: 22px;
          overflow: hidden;
          border-radius: 9999px;
          background:
            linear-gradient(180deg, rgba(125,211,252,0.32), rgba(96,165,250,0.16));
          border: 1px solid rgba(56,189,248,0.24);
          box-shadow:
            inset 0 1px 10px rgba(14,165,233,0.10),
            inset 0 -1px 8px rgba(255,255,255,0.18);
        }

        .dark .loader-rail {
          background:
            linear-gradient(180deg, rgba(2,6,23,0.72), rgba(2,6,23,0.52));
          border: 1px solid rgba(125,211,252,0.14);
          box-shadow:
            inset 0 1px 12px rgba(0,0,0,0.30),
            inset 0 -1px 8px rgba(255,255,255,0.02);
        }

        .loader-rail-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(90deg, rgba(2,132,199,0.14) 1px, transparent 1px);
          background-size: 18px 100%;
          opacity: 0.38;
          animation: railGridMove 3.2s linear infinite;
          pointer-events: none;
        }

        .dark .loader-rail-grid {
          background-image:
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
          opacity: 0.10;
        }

        .loader-progress {
          position: relative;
          height: 100%;
          border-radius: inherit;
          overflow: hidden;
          transition: width 0.03s linear;
          background:
            linear-gradient(
              90deg,
              #0284c7 0%,
              #0ea5e9 24%,
              #38bdf8 52%,
              #67e8f9 78%,
              #bae6fd 100%
            );
          box-shadow:
            0 0 16px rgba(14,165,233,0.30),
            0 0 26px rgba(56,189,248,0.18);
        }

        .dark .loader-progress {
          background:
            linear-gradient(
              90deg,
              rgba(14,165,233,0.86) 0%,
              rgba(56,189,248,0.94) 35%,
              rgba(103,232,249,0.98) 68%,
              rgba(186,230,253,0.92) 100%
            );
          box-shadow:
            0 0 16px rgba(56,189,248,0.34),
            0 0 28px rgba(103,232,249,0.18);
        }

        .loader-progress::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.02));
          opacity: 0.65;
        }

        .dark .loader-progress::before {
          background:
            linear-gradient(180deg, rgba(255,255,255,0.26), rgba(255,255,255,0.03));
          opacity: 0.85;
        }

        .loader-progress::after {
          content: "";
          position: absolute;
          top: -35%;
          right: -26px;
          width: 74px;
          height: 170%;
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.42) 48%,
            rgba(255,255,255,0) 100%
          );
          transform: skewX(-18deg);
          filter: blur(4px);
          animation: loaderEdgeShine 1.5s linear infinite;
        }

        .dark .loader-progress::after {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.58) 48%,
            rgba(255,255,255,0) 100%
          );
        }

        .loader-scan-layer {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          overflow: hidden;
          pointer-events: none;
        }

        .loader-scan-layer::before {
          content: "";
          position: absolute;
          top: 0;
          left: -20%;
          width: 20%;
          height: 100%;
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.14) 50%,
            rgba(255,255,255,0) 100%
          );
          filter: blur(5px);
          animation: loaderSweep 2.4s ease-in-out infinite;
        }

        .dark .loader-scan-layer::before {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.16) 50%,
            rgba(255,255,255,0) 100%
          );
        }

        .loader-packets {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          overflow: hidden;
          pointer-events: none;
        }

        .loader-packet {
          position: absolute;
          top: 50%;
          width: 8px;
          height: 8px;
          margin-top: -4px;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(103,232,249,0.88) 55%, rgba(56,189,248,0) 100%);
          box-shadow:
            0 0 8px rgba(14,165,233,0.18),
            0 0 12px rgba(56,189,248,0.14);
          animation: loaderPacketRun 2.2s linear infinite;
          opacity: 0;
        }

        .dark .loader-packet {
          background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(103,232,249,0.95) 55%, rgba(56,189,248,0) 100%);
          box-shadow:
            0 0 10px rgba(255,255,255,0.34),
            0 0 16px rgba(103,232,249,0.24);
        }

        .loader-packet.sm {
          width: 6px;
          height: 6px;
          margin-top: -3px;
        }

        .loader-head-glow {
          position: absolute;
          top: 2px;
          bottom: 2px;
          right: 1px;
          width: 3px;
          border-radius: 9999px;
          background: linear-gradient(
            180deg,
            rgba(255,255,255,0.82) 0%,
            rgba(125,211,252,0.92) 50%,
            rgba(14,165,233,0.92) 100%
          );
          box-shadow:
            0 0 8px rgba(186,230,253,0.35),
            0 0 14px rgba(56,189,248,0.22);
        }

        .dark .loader-head-glow {
          background: linear-gradient(
            180deg,
            rgba(255,255,255,0.95) 0%,
            rgba(103,232,249,0.92) 50%,
            rgba(37,99,235,0.86) 100%
          );
          box-shadow:
            0 0 10px rgba(255,255,255,0.45),
            0 0 18px rgba(103,232,249,0.30);
        }

        .loader-tail-line {
          position: absolute;
          left: 16px;
          right: 16px;
          bottom: 4px;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(14,165,233,0.24),
            transparent
          );
          opacity: 0.7;
        }

        .dark .loader-tail-line {
          background: linear-gradient(
            90deg,
            transparent,
            rgba(103,232,249,0.20),
            transparent
          );
          opacity: 0.5;
        }

        .corner-hud {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
        }

        .hud-corner {
          position: absolute;
          width: 88px;
          height: 88px;
          opacity: 0.42;
        }

        .hud-corner::before,
        .hud-corner::after {
          content: "";
          position: absolute;
          background: linear-gradient(90deg, rgba(103,232,249,0.8), rgba(56,189,248,0.1));
          box-shadow: 0 0 12px rgba(103,232,249,0.18);
        }

        .hud-corner::before {
          width: 64px;
          height: 1px;
        }

        .hud-corner::after {
          width: 1px;
          height: 64px;
        }

        .hud-tl { top: 34px; left: 34px; }
        .hud-tr { top: 34px; right: 34px; transform: scaleX(-1); }
        .hud-bl { bottom: 34px; left: 34px; transform: scaleY(-1); }
        .hud-br { bottom: 34px; right: 34px; transform: scale(-1); }

        @keyframes introFlash {
          0% { opacity: 0; }
          12% { opacity: 1; }
          38% { opacity: 0.32; }
          100% { opacity: 0; }
        }

        @keyframes floorDrift {
          from {
            transform: perspective(1000px) rotateX(74deg) scale(1.6) translateY(0);
          }
          to {
            transform: perspective(1000px) rotateX(74deg) scale(1.6) translateY(36px);
          }
        }

        @keyframes ambientFloatLeft {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, -20px) scale(1.06); }
        }

        @keyframes ambientFloatRight {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-36px, 18px) scale(1.05); }
        }

        @keyframes coreBreath {
          0%, 100% { transform: scale(1); opacity: 0.86; }
          50% { transform: scale(1.07); opacity: 1; }
        }

        @keyframes spinClock {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes spinCounter {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes ringBreath {
          0%, 100% { transform: scale(0.98); opacity: 0.45; }
          50% { transform: scale(1.04); opacity: 0.9; }
        }

        @keyframes linePulse {
          0%, 100% { opacity: 0.34; }
          50% { opacity: 0.78; }
        }

        @keyframes beamSurge {
          0%, 100% {
            opacity: 0.5;
            transform: translateX(-50%) scaleY(0.98);
          }
          50% {
            opacity: 1;
            transform: translateX(-50%) scaleY(1.08);
          }
        }

        @keyframes dashMove {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -60; }
        }

        @keyframes nodeBlink {
          0%, 100% { opacity: 0.66; }
          50% { opacity: 1; }
        }

        @keyframes hubPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.45;
          }
          50% {
            transform: scale(1.12);
            opacity: 0.95;
          }
        }

        @keyframes floatNode {
          0%, 100% {
            transform: translate(-50%, -50%) translateY(0px);
          }
          50% {
            transform: translate(-50%, -50%) translateY(-10px);
          }
        }

        @keyframes loaderGlow {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(1.03); }
        }

        @keyframes ledPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.24);
            opacity: 0.72;
          }
        }

        @keyframes logoReveal {
          0% {
            opacity: 0;
            transform: scale(0.78) translateY(34px);
            filter: blur(16px);
          }
          55% {
            opacity: 1;
            transform: scale(1.05) translateY(-4px);
            filter: blur(0);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
            filter: blur(0);
          }
        }

        @keyframes auraPulse {
          0%, 100% { opacity: 0.72; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1.03); }
        }

        @keyframes rimPulse {
          0%, 100% { opacity: 0.66; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1.02); }
        }

        @keyframes crystalFocusPulse {
          0%, 100% { opacity: 0.72; transform: translateX(-50%) scale(0.98); }
          50% { opacity: 1; transform: translateX(-50%) scale(1.04); }
        }

        @keyframes textFocusPulse {
          0%, 100% { opacity: 0.68; transform: scaleX(0.96); }
          50% { opacity: 1; transform: scaleX(1.03); }
        }

        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        @keyframes emphasisPulse {
          0%, 100% {
            opacity: 0.6;
            transform: scaleX(0.96);
          }
          50% {
            opacity: 1;
            transform: scaleX(1.04);
          }
        }

        @keyframes logoSweep {
          0% {
            left: -35%;
            opacity: 0;
          }
          18% {
            opacity: 0.7;
          }
          58% {
            opacity: 0.35;
          }
          100% {
            left: 120%;
            opacity: 0;
          }
        }

        @keyframes scanPass {
          0% {
            top: -16%;
            opacity: 0;
          }
          12% {
            opacity: 0.36;
          }
          50% {
            opacity: 0.26;
          }
          100% {
            top: 112%;
            opacity: 0;
          }
        }

        @keyframes particleTwinkle {
          0%, 100% {
            opacity: 0.55;
            transform: translate(-50%, -50%) scale(0.92);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.18);
          }
        }

        @keyframes panelRise {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(18px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }

        @keyframes loaderEdgeShine {
          0% {
            transform: translateX(-20px) skewX(-18deg);
            opacity: 0.22;
          }
          50% {
            opacity: 0.78;
          }
          100% {
            transform: translateX(20px) skewX(-18deg);
            opacity: 0.22;
          }
        }

        @keyframes railGridMove {
          from {
            background-position: 0 0;
          }
          to {
            background-position: 18px 0;
          }
        }

        @keyframes loaderSweep {
          0% {
            left: -20%;
            opacity: 0;
          }
          18% {
            opacity: 0.45;
          }
          50% {
            opacity: 0.20;
          }
          100% {
            left: 120%;
            opacity: 0;
          }
        }

        @keyframes loaderPacketRun {
          0% {
            left: -3%;
            opacity: 0;
            transform: scale(0.86);
          }
          10% {
            opacity: 0.95;
          }
          50% {
            opacity: 0.85;
            transform: scale(1.04);
          }
          100% {
            left: 103%;
            opacity: 0;
            transform: scale(0.90);
          }
        }

        @media (max-width: 1200px) {
          .device-node {
            width: 108px;
          }

          .logo-zone {
            width: min(64vw, 590px);
          }
        }

        @media (max-width: 900px) {
          .scene {
            width: min(98vw, 980px);
            height: min(96vh, 860px);
          }

          .device-node {
            width: 92px;
          }

          .device-icon {
            width: 34px;
            height: 34px;
          }

          .device-label {
            font-size: 10px;
          }

          .device-sub {
            font-size: 8px;
          }

          .device-node.router { left: 18%; top: 29%; }
          .device-node.switch { left: 18%; top: 60%; }
          .device-node.server { left: 82%; top: 29%; }
          .device-node.pc { left: 82%; top: 60%; }
          .device-node.wireless { left: 50%; top: 12%; }

          .logo-zone {
            width: min(74vw, 540px);
          }

          .loader-shell {
            width: min(88vw, 560px);
          }
        }

        @media (max-width: 768px) {
          .grid {
            background-size: 40px 40px;
          }

          .scene {
            width: 100vw;
            height: 100vh;
          }

          .device-node {
            width: 82px;
          }

          .device-card {
            padding: 10px 8px 9px;
            border-radius: 16px;
          }

          .device-icon {
            width: 30px;
            height: 30px;
          }

          .device-label {
            font-size: 9px;
            letter-spacing: 0.12em;
          }

          .device-sub {
            display: none;
          }

          .device-node.router { left: 16%; top: 30%; }
          .device-node.switch { left: 16%; top: 58%; }
          .device-node.server { left: 84%; top: 30%; }
          .device-node.pc { left: 84%; top: 58%; }
          .device-node.wireless { left: 50%; top: 11%; }

          .logo-zone {
            width: min(84vw, 470px);
          }

          .loader-shell {
            width: min(92vw, 520px);
            bottom: 4.8%;
          }

          .loader-frame {
            padding: 9px;
          }

          .loader-rail {
            height: 20px;
          }

          .loader-packet {
            width: 7px;
            height: 7px;
            margin-top: -3.5px;
          }

          .loader-packet.sm {
            width: 5px;
            height: 5px;
            margin-top: -2.5px;
          }

          .hud-corner {
            width: 64px;
            height: 64px;
          }

          .hud-corner::before {
            width: 42px;
          }

          .hud-corner::after {
            height: 42px;
          }

          .hud-tl { top: 18px; left: 18px; }
          .hud-tr { top: 18px; right: 18px; }
          .hud-bl { bottom: 18px; left: 18px; }
          .hud-br { bottom: 18px; right: 18px; }
        }

        @media (max-width: 520px) {
          .device-node {
            width: 70px;
          }

          .device-icon {
            width: 25px;
            height: 25px;
          }

          .device-label {
            font-size: 8px;
          }

          .device-node.router { left: 14%; top: 31%; }
          .device-node.switch { left: 14%; top: 57%; }
          .device-node.server { left: 86%; top: 31%; }
          .device-node.pc { left: 86%; top: 57%; }
          .device-node.wireless { left: 50%; top: 10%; }

          .logo-zone {
            width: min(90vw, 400px);
          }

          .logo-wrap {
            padding: 1rem 0.8rem 0.8rem;
          }

          .loader-shell {
            width: min(94vw, 410px);
          }

          .loader-frame {
            padding: 8px;
          }

          .loader-rail {
            height: 18px;
          }
        }
      `}</style>

      <div className="argus-login">
        <div className="intro-flash" />
        <div className="noise" />
        <div className="grid" />
        <div className="ambient-left" />
        <div className="ambient-right" />
        <div className="center-core-glow" />
        <div className="vignette" />

        <div className="corner-hud">
          <div className="hud-corner hud-tl" />
          <div className="hud-corner hud-tr" />
          <div className="hud-corner hud-bl" />
          <div className="hud-corner hud-br" />
        </div>

        <div className={`scene enter-ready ${start ? "enter-active" : ""}`}>
          <div className="ring-c" />
          <div className="ring-b" />
          <div className="ring-a" />
          <div className="crosshair-h" />
          <div className="crosshair-v" />
          <div className="scan-mask" />

          <div className="network-map">
            <svg
              className="network-svg"
              viewBox="0 0 1280 920"
              preserveAspectRatio="none"
            >
              <line className="network-link" x1="285" y1="260" x2="640" y2="430" />
              <line className="network-link" x1="280" y1="530" x2="640" y2="430" />
              <line className="network-link" x1="995" y1="260" x2="640" y2="430" />
              <line className="network-link" x1="1010" y1="540" x2="640" y2="430" />
              <line className="network-link" x1="640" y1="140" x2="640" y2="430" />

              <line className="network-link soft" x1="285" y1="260" x2="280" y2="530" />
              <line className="network-link soft" x1="995" y1="260" x2="1010" y2="540" />
              <line className="network-link soft" x1="285" y1="260" x2="640" y2="140" />
              <line className="network-link soft" x1="995" y1="260" x2="640" y2="140" />

              <circle className="signal-dot" cx="285" cy="260" r="4" />
              <circle className="signal-dot" cx="280" cy="530" r="4" />
              <circle className="signal-dot" cx="995" cy="260" r="4" />
              <circle className="signal-dot" cx="1010" cy="540" r="4" />
              <circle className="signal-dot" cx="640" cy="140" r="4" />
              <circle className="signal-dot" cx="640" cy="430" r="6" />

              <circle className="hub-pulse" cx="640" cy="430" r="22" />
              <circle
                className="hub-pulse"
                cx="640"
                cy="430"
                r="38"
                style={{ animationDelay: "0.7s" }}
              />
            </svg>
          </div>

          <div className="device-node router">
            <div className="device-card">
              <div className="device-glow" />
              <div className="device-dot" />
              <div className="device-icon-wrap">
                <svg className="device-icon" viewBox="0 0 64 64" fill="none">
                  <rect x="13" y="25" width="38" height="16" rx="5" stroke="currentColor" strokeWidth="3" />
                  <path d="M24 21C24 16.5 27.5 13 32 13C36.5 13 40 16.5 40 21" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="24" cy="33" r="2.2" fill="currentColor" />
                  <circle cx="32" cy="33" r="2.2" fill="currentColor" />
                  <circle cx="40" cy="33" r="2.2" fill="currentColor" />
                </svg>
              </div>
              <div className="device-label">Router</div>
              <div className="device-sub">edge control</div>
            </div>
          </div>

          <div className="device-node switch">
            <div className="device-card">
              <div className="device-glow" />
              <div className="device-dot" />
              <div className="device-icon-wrap">
                <svg className="device-icon" viewBox="0 0 64 64" fill="none">
                  <rect x="10" y="22" width="44" height="20" rx="4" stroke="currentColor" strokeWidth="3" />
                  <rect x="18" y="29" width="5" height="5" rx="1.2" fill="currentColor" />
                  <rect x="27" y="29" width="5" height="5" rx="1.2" fill="currentColor" />
                  <rect x="36" y="29" width="5" height="5" rx="1.2" fill="currentColor" />
                  <rect x="45" y="29" width="5" height="5" rx="1.2" fill="currentColor" />
                </svg>
              </div>
              <div className="device-label">Switch</div>
              <div className="device-sub">traffic layer</div>
            </div>
          </div>

          <div className="device-node server">
            <div className="device-card">
              <div className="device-glow" />
              <div className="device-dot" />
              <div className="device-icon-wrap">
                <svg className="device-icon" viewBox="0 0 64 64" fill="none">
                  <rect x="16" y="14" width="32" height="13" rx="3" stroke="currentColor" strokeWidth="3" />
                  <rect x="16" y="30" width="32" height="13" rx="3" stroke="currentColor" strokeWidth="3" />
                  <circle cx="23" cy="20.5" r="2" fill="currentColor" />
                  <circle cx="23" cy="36.5" r="2" fill="currentColor" />
                  <path d="M30 20.5H41" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  <path d="M30 36.5H41" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <div className="device-label">Virtual Machine</div>
              <div className="device-sub">asset node</div>
            </div>
          </div>

          <div className="device-node pc">
            <div className="device-card">
              <div className="device-glow" />
              <div className="device-dot" />
              <div className="device-icon-wrap">
                <svg className="device-icon" viewBox="0 0 64 64" fill="none">
                  <rect x="14" y="16" width="36" height="24" rx="4" stroke="currentColor" strokeWidth="3" />
                  <path d="M24 48H40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  <path d="M32 40V48" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <div className="device-label">Device</div>
              <div className="device-sub">endpoint</div>
            </div>
          </div>

          <div className="device-node wireless">
            <div className="device-card">
              <div className="device-glow" />
              <div className="device-dot" />
              <div className="device-icon-wrap">
                <svg className="device-icon" viewBox="0 0 64 64" fill="none">
                  <path d="M18 28C26 20 38 20 46 28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  <path d="M23 34C28 29 36 29 41 34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  <path d="M28 40C30.5 37.8 33.5 37.8 36 40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="32" cy="46" r="3" fill="currentColor" />
                </svg>
              </div>
              <div className="device-label">Wireless</div>
              <div className="device-sub">radio scan</div>
            </div>
          </div>

          <div className="logo-zone">
            <div className="logo-rim-light" />
            <div className="logo-aura" />
            <div className="logo-crystal-beam" />
            <div className="logo-crystal-focus" />
            <div className="logo-text-focus" />
            <div className="logo-emphasis" />

            <div className="scan-lines">
              {scanBars.map((bar, index) => (
                <span
                  key={bar}
                  className="scan-bar"
                  style={{ animationDelay: `${index * 0.22}s` }}
                />
              ))}
            </div>

            <div className="orbit-layer">
              {particles.map((p, index) => {
                const x = Math.cos((p.angle * Math.PI) / 180) * p.radius;
                const y = Math.sin((p.angle * Math.PI) / 180) * p.radius;

                return (
                  <span
                    key={index}
                    className="particle"
                    style={{
                      width: `${p.size}px`,
                      height: `${p.size}px`,
                      marginLeft: `${x}%`,
                      marginTop: `${y}%`,
                      animationDelay: `${p.delay}s`,
                    }}
                  />
                );
              })}
            </div>

            <div className="logo-wrap">
              <img src={logo} alt="ARGUS logo" className="logo-img" />
            </div>

          </div>

          <div className="loader-shell">
            <div className="loader-frame">
              <div className="loader-soft-glow" />

              <div className="loader-rail">
                <div className="loader-rail-grid" />

                <div
                  className="loader-progress"
                  style={{ width: `${progress}%` }}
                >
                  <div className="loader-scan-layer" />
                  <div className="loader-packets">
                    {streamDots.map((dot, index) => (
                      <span
                        key={dot}
                        className={`loader-packet ${index % 2 === 0 ? "sm" : ""}`}
                        style={{
                          animationDelay: `${index * 0.28}s`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="loader-head-glow" />
                </div>
              </div>

              <div className="loader-tail-line" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Index;