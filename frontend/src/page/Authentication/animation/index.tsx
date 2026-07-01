import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import logo from "../../../assets/argus-description.png";

type Props = {
  onFinished?: () => void;
  duration?: number;
};

const assetPreloadCache = new Map<string, Promise<void>>();

const preloadAssetImage = (src: string): Promise<void> => {
  if (!src || typeof window === "undefined") {
    return Promise.resolve();
  }

  const cached = assetPreloadCache.get(src);
  if (cached) {
    return cached;
  }

  const promise = new Promise<void>((resolve) => {
    const img = new Image();

    const finish = () => {
      if (typeof img.decode === "function") {
        img.decode().catch(() => undefined).finally(resolve);
        return;
      }

      resolve();
    };

    img.decoding = "async";
    img.onload = finish;
    img.onerror = () => resolve();
    img.src = src;
  });

  assetPreloadCache.set(src, promise);
  return promise;
};

export const preloadLoginSuccessAnimationAssets = (): Promise<void> => {
  return preloadAssetImage(logo);
};

const Index: React.FC<Props> = ({ onFinished, duration = 1000 }) => {
  const [start, setStart] = useState(false);
  const [logoReady, setLogoReady] = useState(false);

  const onFinishedRef = useRef(onFinished);
  const finishedRef = useRef(false);

  const safeDuration = useMemo(() => Math.max(duration, 100), [duration]);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;

    preloadLoginSuccessAnimationAssets().finally(() => {
      if (cancelled) {
        return;
      }

      setLogoReady(true);

      raf = requestAnimationFrame(() => {
        if (!cancelled) {
          setStart(true);
        }
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!start) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (finishedRef.current) {
        return;
      }

      finishedRef.current = true;
      onFinishedRef.current?.();
    }, safeDuration + 420);

    return () => window.clearTimeout(timer);
  }, [safeDuration, start]);

  const scanBars = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);
  const streamDots = useMemo(() => Array.from({ length: 10 }, (_, i) => i), []);
  const pulseRings = useMemo(() => Array.from({ length: 5 }, (_, i) => i), []);
  const radarSweeps = useMemo(() => Array.from({ length: 4 }, (_, i) => i), []);
  const dataPackets = useMemo(() => Array.from({ length: 18 }, (_, i) => i), []);
  const backgroundDots = useMemo(() => Array.from({ length: 62 }, (_, i) => i), []);
  const orbitParticles = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => {
        const angle = (360 / 48) * i;
        const delay = (i % 12) * 0.12;
        const size = i % 7 === 0 ? 8 : i % 4 === 0 ? 6 : 4;
        const radius = i % 2 === 0 ? 40 : 51;

        return { angle, delay, size, radius };
      }),
    []
  );

  const outerParticles = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => {
        const angle = (360 / 36) * i;
        const delay = (i % 9) * 0.15;
        const size = i % 5 === 0 ? 7 : 4;
        const radius = i % 2 === 0 ? 50 : 60;

        return { angle, delay, size, radius };
      }),
    []
  );

  const hexTicks = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const waveLines = useMemo(() => Array.from({ length: 14 }, (_, i) => i), []);

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
          background:
            radial-gradient(circle at 50% 42%, rgba(14,165,233,0.24) 0%, rgba(56,189,248,0.12) 20%, rgba(255,255,255,0) 44%),
            radial-gradient(circle at 18% 18%, rgba(37,99,235,0.13) 0%, transparent 30%),
            radial-gradient(circle at 82% 78%, rgba(6,182,212,0.16) 0%, transparent 31%),
            linear-gradient(180deg, #f7fcff 0%, #edf7ff 46%, #e6f2ff 100%);
        }

        .dark .argus-login {
          background:
            radial-gradient(circle at 50% 42%, rgba(56,189,248,0.18) 0%, rgba(56,189,248,0.06) 20%, transparent 44%),
            radial-gradient(circle at 18% 18%, rgba(37,99,235,0.15) 0%, transparent 30%),
            radial-gradient(circle at 82% 78%, rgba(6,182,212,0.16) 0%, transparent 31%),
            linear-gradient(180deg, #01030a 0%, #03111f 44%, #020714 100%);
        }

        .intro-flash {
          position: absolute;
          inset: 0;
          z-index: 50;
          pointer-events: none;
          background:
            radial-gradient(circle at center, rgba(255,255,255,0.95) 0%, rgba(103,232,249,0.48) 10%, rgba(37,99,235,0.12) 24%, transparent 42%);
          opacity: 0;
          animation: introFlash 1.18s ease-out forwards;
        }

        .vignette {
          position: absolute;
          inset: 0;
          z-index: 22;
          pointer-events: none;
          background:
            radial-gradient(circle at center, transparent 40%, rgba(2,6,23,0.07) 73%, rgba(2,6,23,0.16) 100%);
        }

        .dark .vignette {
          background:
            radial-gradient(circle at center, transparent 36%, rgba(0,0,0,0.28) 70%, rgba(0,0,0,0.68) 100%);
        }

        .noise {
          position: absolute;
          inset: 0;
          z-index: 2;
          opacity: 0.1;
          pointer-events: none;
          background-image:
            radial-gradient(rgba(103,232,249,0.26) 0.75px, transparent 0.75px);
          background-size: 18px 18px;
          mask-image: radial-gradient(circle at center, black 32%, transparent 92%);
          -webkit-mask-image: radial-gradient(circle at center, black 32%, transparent 92%);
        }

        .grid {
          position: absolute;
          inset: -12%;
          z-index: 1;
          opacity: 0.36;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(56,189,248,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56,189,248,0.07) 1px, transparent 1px);
          background-size: 52px 52px;
          transform: perspective(1050px) rotateX(74deg) scale(1.65);
          transform-origin: center center;
          animation: floorDrift 10s linear infinite;
        }

        .dark .grid {
          opacity: 0.3;
          background-image:
            linear-gradient(rgba(103,232,249,0.065) 1px, transparent 1px),
            linear-gradient(90deg, rgba(103,232,249,0.065) 1px, transparent 1px);
        }

        .diagonal-beams {
          position: absolute;
          inset: -20%;
          z-index: 2;
          pointer-events: none;
          opacity: 0.18;
          background:
            repeating-linear-gradient(
              120deg,
              transparent 0px,
              transparent 74px,
              rgba(14,165,233,0.18) 75px,
              rgba(14,165,233,0.18) 76px,
              transparent 77px,
              transparent 150px
            );
          animation: diagonalMove 13s linear infinite;
        }

        .dark .diagonal-beams {
          opacity: 0.13;
        }

        .ambient-left,
        .ambient-right {
          position: absolute;
          top: 50%;
          width: 46vw;
          height: 46vw;
          max-width: 760px;
          max-height: 760px;
          border-radius: 9999px;
          filter: blur(82px);
          pointer-events: none;
          z-index: 1;
          opacity: 0.74;
        }

        .ambient-left {
          left: -12%;
          background:
            radial-gradient(circle, rgba(37,99,235,0.22) 0%, rgba(37,99,235,0.08) 42%, transparent 74%);
          animation: ambientFloatLeft 8s ease-in-out infinite;
        }

        .ambient-right {
          right: -12%;
          background:
            radial-gradient(circle, rgba(34,211,238,0.21) 0%, rgba(34,211,238,0.07) 42%, transparent 74%);
          animation: ambientFloatRight 9s ease-in-out infinite;
        }

        .center-core-glow {
          position: absolute;
          width: min(64vw, 760px);
          aspect-ratio: 1;
          border-radius: 9999px;
          z-index: 3;
          pointer-events: none;
          background:
            radial-gradient(circle, rgba(255,255,255,0.32) 0%, rgba(103,232,249,0.24) 13%, rgba(56,189,248,0.13) 28%, rgba(37,99,235,0.04) 50%, transparent 74%);
          filter: blur(28px);
          animation: coreBreath 4.3s ease-in-out infinite;
        }

        .dark .center-core-glow {
          background:
            radial-gradient(circle, rgba(103,232,249,0.22) 0%, rgba(56,189,248,0.16) 18%, rgba(37,99,235,0.06) 46%, transparent 74%);
        }

        .background-dots {
          position: absolute;
          inset: 0;
          z-index: 5;
          pointer-events: none;
          overflow: hidden;
          mask-image: radial-gradient(circle at center, transparent 12%, black 56%, transparent 96%);
          -webkit-mask-image: radial-gradient(circle at center, transparent 12%, black 56%, transparent 96%);
        }

        .background-dot {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: rgba(56,189,248,0.44);
          box-shadow: 0 0 14px rgba(56,189,248,0.38);
          animation: backgroundDotPulse 3s ease-in-out infinite;
        }

        .background-dot.green {
          background: rgba(34,197,94,0.48);
          box-shadow: 0 0 14px rgba(34,197,94,0.34);
        }

        .background-dot.orange {
          background: rgba(251,146,60,0.55);
          box-shadow: 0 0 14px rgba(251,146,60,0.34);
        }

        .light-streaks {
          position: absolute;
          inset: 0;
          z-index: 6;
          pointer-events: none;
          overflow: hidden;
          mask-image: radial-gradient(circle at center, black 24%, transparent 96%);
          -webkit-mask-image: radial-gradient(circle at center, black 24%, transparent 96%);
        }

        .light-streak {
          position: absolute;
          width: 38vw;
          height: 1px;
          border-radius: 9999px;
          background:
            linear-gradient(
              90deg,
              transparent,
              rgba(103,232,249,0.62),
              rgba(255,255,255,0.48),
              transparent
            );
          filter: blur(0.2px) drop-shadow(0 0 10px rgba(103,232,249,0.3));
          opacity: 0;
          transform: rotate(-18deg);
          animation: streakMove 4.6s ease-in-out infinite;
        }

        .scan-wave-layer {
          position: absolute;
          inset: 0;
          z-index: 7;
          pointer-events: none;
          overflow: hidden;
          mask-image: radial-gradient(circle at center, black 18%, transparent 88%);
          -webkit-mask-image: radial-gradient(circle at center, black 18%, transparent 88%);
        }

        .scan-wave {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 80px;
          height: 80px;
          border-radius: 9999px;
          border: 1px solid rgba(56,189,248,0.3);
          transform: translate(-50%, -50%);
          opacity: 0;
          animation: scanWave 4s ease-out infinite;
        }

        .floating-panels {
          position: absolute;
          inset: 0;
          z-index: 8;
          pointer-events: none;
          overflow: hidden;
          mask-image: radial-gradient(circle at center, transparent 8%, black 52%, transparent 95%);
          -webkit-mask-image: radial-gradient(circle at center, transparent 8%, black 52%, transparent 95%);
        }

        .floating-panel {
          position: absolute;
          width: 78px;
          height: 38px;
          border-radius: 14px;
          border: 1px solid rgba(56,189,248,0.16);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.08));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.3),
            0 0 24px rgba(56,189,248,0.06);
          backdrop-filter: blur(8px);
          opacity: 0.42;
          animation: panelFloat 6s ease-in-out infinite;
        }

        .dark .floating-panel {
          border: 1px solid rgba(125,211,252,0.1);
          background:
            linear-gradient(180deg, rgba(15,23,42,0.28), rgba(2,6,23,0.12));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.05),
            0 0 26px rgba(56,189,248,0.07);
          opacity: 0.36;
        }

        .floating-panel::before,
        .floating-panel::after {
          content: "";
          position: absolute;
          left: 12px;
          right: 12px;
          height: 2px;
          border-radius: 9999px;
          background: linear-gradient(90deg, rgba(56,189,248,0.62), transparent);
        }

        .floating-panel::before {
          top: 12px;
        }

        .floating-panel::after {
          top: 22px;
          right: 28px;
          opacity: 0.5;
        }

        .scene {
          position: relative;
          width: min(96vw, 1280px);
          height: min(94vh, 920px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 20;
        }

        .scene.enter-ready {
          opacity: 0;
          transform: scale(0.962);
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
        .ring-d,
        .ring-e,
        .ring-f,
        .crosshair-h,
        .crosshair-v,
        .scan-mask,
        .security-hex,
        .security-hex-inner {
          position: absolute;
          pointer-events: none;
        }

        .ring-a,
        .ring-b,
        .ring-c,
        .ring-d,
        .ring-e,
        .ring-f,
        .scan-mask {
          border-radius: 9999px;
        }

        .ring-a {
          width: 56%;
          height: 56%;
          border: 1px solid rgba(56,189,248,0.28);
          box-shadow:
            inset 0 0 24px rgba(103,232,249,0.1),
            0 0 20px rgba(56,189,248,0.14);
          animation: spinClock 14s linear infinite;
        }

        .ring-b {
          width: 68%;
          height: 68%;
          border: 1px dashed rgba(59,130,246,0.24);
          animation: spinCounter 19s linear infinite;
        }

        .ring-c {
          width: 80%;
          height: 80%;
          border: 1px solid rgba(147,197,253,0.14);
          animation: ringBreath 4.8s ease-in-out infinite;
        }

        .ring-d {
          width: 43%;
          height: 43%;
          border: 1px dashed rgba(34,197,94,0.28);
          box-shadow: 0 0 26px rgba(34,197,94,0.08);
          animation: spinClock 7s linear infinite;
        }

        .ring-e {
          width: 92%;
          height: 92%;
          border: 1px solid rgba(56,189,248,0.08);
          box-shadow:
            inset 0 0 30px rgba(56,189,248,0.04),
            0 0 36px rgba(56,189,248,0.04);
          animation: ringWidePulse 5.6s ease-in-out infinite;
        }

        .ring-f {
          width: 102%;
          height: 102%;
          border: 1px dashed rgba(14,165,233,0.08);
          animation: spinCounter 28s linear infinite;
        }

        .security-hex {
          width: 42%;
          aspect-ratio: 1;
          z-index: 2;
          border: 1px solid rgba(103,232,249,0.3);
          clip-path: polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%);
          box-shadow:
            0 0 24px rgba(56,189,248,0.12),
            inset 0 0 30px rgba(103,232,249,0.06);
          animation: hexPulse 4.4s ease-in-out infinite;
        }

        .security-hex-inner {
          width: 31%;
          aspect-ratio: 1;
          z-index: 2;
          border: 1px solid rgba(34,197,94,0.24);
          clip-path: polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%);
          box-shadow:
            0 0 18px rgba(34,197,94,0.12),
            inset 0 0 20px rgba(34,197,94,0.05);
          animation: hexPulseInner 3.6s ease-in-out infinite;
        }

        .hex-tick {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 2px;
          height: 18px;
          border-radius: 9999px;
          background:
            linear-gradient(
              180deg,
              rgba(103,232,249,0),
              rgba(103,232,249,0.78),
              rgba(103,232,249,0)
            );
          transform-origin: 0 0;
          filter: drop-shadow(0 0 8px rgba(103,232,249,0.38));
          animation: tickBlink 2.2s ease-in-out infinite;
        }

        .crosshair-h {
          width: 74%;
          height: 1px;
          border-radius: 9999px;
          background: linear-gradient(90deg, transparent, rgba(103,232,249,0.64), transparent);
          opacity: 0.62;
          animation: linePulse 3s ease-in-out infinite;
        }

        .crosshair-v {
          width: 1px;
          height: 74%;
          border-radius: 9999px;
          background: linear-gradient(180deg, transparent, rgba(103,232,249,0.64), transparent);
          opacity: 0.62;
          animation: linePulse 3.2s ease-in-out infinite;
        }

        .scan-mask {
          width: 62%;
          height: 62%;
          animation: spinClock 5s linear infinite;
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
              rgba(56,189,248,0) 284deg,
              rgba(56,189,248,0.12) 316deg,
              rgba(255,255,255,0.9) 344deg,
              rgba(56,189,248,0) 360deg
            );
          mask: radial-gradient(circle, transparent 56%, black 59%, black 100%);
          -webkit-mask: radial-gradient(circle, transparent 56%, black 59%, black 100%);
          filter: drop-shadow(0 0 16px rgba(103,232,249,0.5));
        }

        .network-map {
          position: absolute;
          inset: 0;
          z-index: 4;
          pointer-events: none;
        }

        .network-svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .network-link {
          stroke: rgba(125,211,252,0.48);
          stroke-width: 2;
          fill: none;
          stroke-linecap: round;
          stroke-dasharray: 6 10;
          animation: dashMove 3.2s linear infinite;
          filter: drop-shadow(0 0 9px rgba(56,189,248,0.22));
        }

        .network-link.soft {
          stroke: rgba(125,211,252,0.25);
          stroke-width: 1.4;
          stroke-dasharray: 4 9;
        }

        .network-link.alert {
          stroke: rgba(248,113,113,0.34);
          stroke-width: 1.5;
          stroke-dasharray: 2 10;
          animation: dashMoveAlert 2.4s linear infinite;
        }

        .network-link.green {
          stroke: rgba(34,197,94,0.38);
          stroke-width: 1.5;
          stroke-dasharray: 5 11;
          animation: dashMove 2.8s linear infinite;
        }

        .signal-dot {
          fill: #dff7ff;
          filter: drop-shadow(0 0 11px rgba(103,232,249,0.8));
          animation: nodeBlink 2.3s ease-in-out infinite;
        }

        .signal-dot.safe {
          fill: #bbf7d0;
          filter: drop-shadow(0 0 12px rgba(34,197,94,0.66));
        }

        .signal-dot.warn {
          fill: #fed7aa;
          filter: drop-shadow(0 0 12px rgba(251,146,60,0.68));
        }

        .hub-pulse {
          fill: rgba(56,189,248,0.1);
          stroke: rgba(103,232,249,0.42);
          stroke-width: 1.5;
          transform-origin: 640px 430px;
          animation: hubPulse 2.5s ease-in-out infinite;
        }

        .packet-layer {
          position: absolute;
          inset: 0;
          z-index: 5;
          pointer-events: none;
        }

        .packet {
          position: absolute;
          width: 9px;
          height: 9px;
          border-radius: 9999px;
          background: radial-gradient(circle, #ffffff 0%, #67e8f9 42%, rgba(56,189,248,0) 72%);
          box-shadow:
            0 0 10px rgba(103,232,249,0.55),
            0 0 22px rgba(56,189,248,0.22);
          opacity: 0;
          animation: packetMove 3.4s ease-in-out infinite;
        }

        .packet.green {
          background: radial-gradient(circle, #ffffff 0%, #86efac 42%, rgba(34,197,94,0) 72%);
          box-shadow:
            0 0 10px rgba(34,197,94,0.45),
            0 0 22px rgba(34,197,94,0.18);
        }

        .device-node {
          position: absolute;
          z-index: 8;
          width: 126px;
          pointer-events: none;
          transform: translate(-50%, -50%);
          animation: floatNode 5.2s ease-in-out infinite;
        }

        .device-node.router {
          left: 23%;
          top: 28%;
          animation-delay: 0s;
        }

        .device-node.switch {
          left: 22%;
          top: 58%;
          animation-delay: 0.8s;
        }

        .device-node.server {
          left: 77%;
          top: 28%;
          animation-delay: 1.2s;
        }

        .device-node.pc {
          left: 79%;
          top: 59%;
          animation-delay: 0.45s;
        }

        .device-node.wireless {
          left: 50%;
          top: 15%;
          animation-delay: 1.6s;
        }

        .device-card {
          position: relative;
          width: 100%;
          border-radius: 20px;
          padding: 12px 10px 11px;
          background: transparent;
          border: none;
          box-shadow: none;
          backdrop-filter: none;
        }

        .device-card::before {
          content: "";
          position: absolute;
          left: 50%;
          top: 43%;
          width: 70px;
          height: 70px;
          transform: translate(-50%, -50%);
          border-radius: 9999px;
          background:
            radial-gradient(circle, rgba(103,232,249,0.2) 0%, rgba(56,189,248,0.09) 38%, transparent 72%);
          filter: blur(8px);
          opacity: 0.82;
          z-index: -1;
          animation: deviceHalo 2.6s ease-in-out infinite;
        }

        .device-card::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 35%;
          width: 58px;
          height: 58px;
          transform: translate(-50%, -50%);
          border-radius: 9999px;
          border: 1px solid rgba(56,189,248,0.18);
          opacity: 0.6;
          animation: deviceScanRing 2.8s ease-in-out infinite;
        }

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
          width: 42px;
          height: 42px;
          color: #0f172a;
          filter:
            drop-shadow(0 0 10px rgba(56,189,248,0.24))
            drop-shadow(0 8px 14px rgba(15,23,42,0.12));
        }

        .dark .device-icon {
          color: #e0f7ff;
          filter:
            drop-shadow(0 0 13px rgba(103,232,249,0.36))
            drop-shadow(0 10px 16px rgba(0,0,0,0.2));
        }

        .device-label {
          text-align: center;
          font-size: 11px;
          line-height: 1.2;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #0f172a;
          text-shadow:
            0 1px 0 rgba(255,255,255,0.45),
            0 0 11px rgba(103,232,249,0.22);
        }

        .dark .device-label {
          color: rgba(240,249,255,0.94);
          text-shadow: 0 0 12px rgba(103,232,249,0.22);
        }

        .device-sub {
          margin-top: 4px;
          text-align: center;
          font-size: 9px;
          line-height: 1.2;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(15,23,42,0.56);
        }

        .dark .device-sub {
          color: rgba(186,230,253,0.62);
        }

        .device-dot {
          position: absolute;
          top: 0;
          right: 6px;
          width: 10px;
          height: 10px;
          border-radius: 9999px;
          background: #22c55e;
          box-shadow:
            0 0 10px rgba(34,197,94,0.75),
            0 0 22px rgba(34,197,94,0.3);
          animation: ledPulse 1.5s ease-in-out infinite;
        }

        .device-node.server .device-dot {
          background: #fb923c;
          box-shadow:
            0 0 10px rgba(251,146,60,0.75),
            0 0 22px rgba(251,146,60,0.3);
        }

        .device-node.pc .device-dot {
          background: #38bdf8;
          box-shadow:
            0 0 10px rgba(56,189,248,0.75),
            0 0 22px rgba(56,189,248,0.3);
        }

        .logo-zone {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: min(60vw, 650px);
          max-width: 650px;
          animation: logoReveal 1.35s cubic-bezier(.18,.84,.24,1) both;
          animation-delay: 0.18s;
        }

        .logo-rim-light {
          position: absolute;
          inset: 2% -2%;
          z-index: 1;
          border-radius: 9999px;
          pointer-events: none;
          background:
            radial-gradient(circle at 50% 45%, rgba(255,255,255,0.5) 0%, rgba(186,230,253,0.22) 25%, rgba(56,189,248,0.08) 48%, transparent 72%);
          filter: blur(18px);
          animation: rimPulse 3.2s ease-in-out infinite;
        }

        .dark .logo-rim-light {
          background:
            radial-gradient(circle at 50% 45%, rgba(103,232,249,0.24) 0%, rgba(56,189,248,0.13) 28%, rgba(37,99,235,0.05) 50%, transparent 72%);
        }

        .logo-aura {
          position: absolute;
          inset: 2% -3%;
          z-index: 1;
          border-radius: 9999px;
          pointer-events: none;
          background:
            radial-gradient(circle at 50% 42%, rgba(103,232,249,0.32) 0%, rgba(56,189,248,0.18) 32%, rgba(37,99,235,0.06) 58%, transparent 76%);
          filter: blur(28px);
          animation: auraPulse 3.6s ease-in-out infinite;
        }

        .logo-shield {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 60%;
          aspect-ratio: 1;
          z-index: 2;
          transform: translate(-50%, -50%);
          pointer-events: none;
          clip-path: polygon(50% 0%, 86% 12%, 95% 38%, 82% 76%, 50% 100%, 18% 76%, 5% 38%, 14% 12%);
          border: 1px solid rgba(103,232,249,0.26);
          background:
            radial-gradient(circle at 50% 40%, rgba(255,255,255,0.2), transparent 42%),
            linear-gradient(180deg, rgba(103,232,249,0.09), rgba(37,99,235,0.03));
          box-shadow:
            inset 0 0 34px rgba(103,232,249,0.08),
            0 0 28px rgba(56,189,248,0.12);
          animation: shieldBreath 3.6s ease-in-out infinite;
        }

        .logo-crystal-beam {
          position: absolute;
          top: -6%;
          left: 50%;
          width: 24%;
          height: 44%;
          z-index: 2;
          transform: translateX(-50%);
          pointer-events: none;
          background:
            linear-gradient(
              180deg,
              rgba(255,255,255,0) 0%,
              rgba(103,232,249,0.38) 20%,
              rgba(56,189,248,0.21) 44%,
              rgba(37,99,235,0.08) 76%,
              rgba(255,255,255,0) 100%
            );
          clip-path: polygon(48% 0%, 52% 0%, 100% 100%, 0% 100%);
          filter: blur(10px);
          opacity: 0.92;
          animation: beamSurge 2.4s ease-in-out infinite;
        }

        .logo-crystal-focus {
          position: absolute;
          top: 2%;
          left: 50%;
          width: 48%;
          height: 48%;
          z-index: 2;
          transform: translateX(-50%);
          border-radius: 9999px;
          pointer-events: none;
          background:
            radial-gradient(circle, rgba(255,255,255,0.54) 0%, rgba(186,230,253,0.31) 22%, rgba(56,189,248,0.14) 42%, transparent 72%);
          filter: blur(20px);
          animation: crystalFocusPulse 3s ease-in-out infinite;
        }

        .dark .logo-crystal-focus {
          background:
            radial-gradient(circle, rgba(103,232,249,0.3) 0%, rgba(56,189,248,0.18) 22%, rgba(37,99,235,0.09) 42%, transparent 72%);
        }

        .logo-text-focus {
          position: absolute;
          left: 9%;
          right: 9%;
          bottom: 8%;
          height: 25%;
          z-index: 2;
          pointer-events: none;
          border-radius: 9999px;
          background:
            radial-gradient(circle at center, rgba(8,47,73,0.29) 0%, rgba(3,105,161,0.16) 28%, rgba(56,189,248,0.07) 54%, transparent 82%);
          filter: blur(16px);
          animation: textFocusPulse 3.1s ease-in-out infinite;
        }

        .dark .logo-text-focus {
          background:
            radial-gradient(circle at center, rgba(8,47,73,0.22) 0%, rgba(14,165,233,0.15) 28%, rgba(56,189,248,0.05) 54%, transparent 82%);
        }

        .logo-emphasis {
          position: absolute;
          inset: auto 10% 11% 10%;
          height: 19%;
          z-index: 3;
          border-radius: 9999px;
          pointer-events: none;
          background:
            radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(103,232,249,0.21) 24%, rgba(56,189,248,0.06) 48%, transparent 78%);
          filter: blur(14px);
          animation: emphasisPulse 2.8s ease-in-out infinite;
        }

        .scan-lines {
          position: absolute;
          inset: 11% 7%;
          z-index: 6;
          pointer-events: none;
          overflow: hidden;
          border-radius: 26px;
          mix-blend-mode: screen;
        }

        .scan-bar {
          position: absolute;
          left: -15%;
          width: 130%;
          height: 9%;
          background:
            linear-gradient(
              90deg,
              rgba(255,255,255,0) 0%,
              rgba(103,232,249,0) 18%,
              rgba(255,255,255,0.31) 50%,
              rgba(103,232,249,0) 82%,
              rgba(255,255,255,0) 100%
            );
          filter: blur(7px);
          opacity: 0;
          transform: skewY(-10deg) translateY(0);
          animation: scanPass 3.1s linear infinite;
        }

        .orbit-layer {
          position: absolute;
          width: 72%;
          height: 72%;
          z-index: 4;
          pointer-events: none;
          animation: spinClock 12s linear infinite;
        }

        .orbit-layer-outer {
          position: absolute;
          width: 86%;
          height: 86%;
          z-index: 3;
          pointer-events: none;
          animation: spinCounter 18s linear infinite;
        }

        .particle {
          position: absolute;
          top: 50%;
          left: 50%;
          border-radius: 9999px;
          background:
            radial-gradient(circle, #e0f7ff 0%, #67e8f9 30%, #38bdf8 65%, rgba(56,189,248,0) 100%);
          box-shadow:
            0 0 13px rgba(103,232,249,0.6),
            0 0 26px rgba(56,189,248,0.28);
          animation: particleTwinkle 2.45s ease-in-out infinite;
        }

        .particle.outer {
          background:
            radial-gradient(circle, #dcfce7 0%, #86efac 34%, #22c55e 68%, rgba(34,197,94,0) 100%);
          box-shadow:
            0 0 12px rgba(34,197,94,0.48),
            0 0 24px rgba(34,197,94,0.18);
        }

        .logo-shine {
          position: absolute;
          inset: 10% 6% 12% 6%;
          z-index: 7;
          overflow: hidden;
          pointer-events: none;
          border-radius: 28px;
        }

        .logo-shine::before {
          content: "";
          position: absolute;
          top: -8%;
          left: -32%;
          width: 24%;
          height: 116%;
          background:
            linear-gradient(
              90deg,
              rgba(255,255,255,0) 0%,
              rgba(255,255,255,0.55) 48%,
              rgba(255,255,255,0) 100%
            );
          transform: skewX(-18deg);
          filter: blur(6px);
          animation: logoSweep 3.8s ease-in-out infinite;
        }

        .dark .logo-shine::before {
          background:
            linear-gradient(
              90deg,
              rgba(255,255,255,0) 0%,
              rgba(255,255,255,0.32) 48%,
              rgba(255,255,255,0) 100%
            );
        }

        .logo-wrap {
          position: relative;
          z-index: 8;
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
          opacity: 0;
          filter:
            contrast(1.2)
            saturate(1.1)
            brightness(0.97)
            drop-shadow(0 0 1px rgba(8,47,73,0.8))
            drop-shadow(0 0 3px rgba(8,47,73,0.58))
            drop-shadow(0 0 18px rgba(103,232,249,0.3))
            drop-shadow(0 20px 34px rgba(37,99,235,0.18));
          animation: logoFloat 4.7s ease-in-out infinite;
          transform: translateZ(0);
          transition: opacity 280ms ease;
          will-change: transform, opacity;
        }

        .logo-img.logo-img-ready {
          opacity: 1;
        }

        .dark .logo-img {
          filter:
            saturate(1.05)
            brightness(1.03)
            drop-shadow(0 0 22px rgba(103,232,249,0.27))
            drop-shadow(0 20px 36px rgba(37,99,235,0.18));
        }

        .corner-hud {
          position: absolute;
          inset: 0;
          z-index: 9;
          pointer-events: none;
        }

        .hud-corner {
          position: absolute;
          width: 90px;
          height: 90px;
          opacity: 0.52;
        }

        .hud-corner::before,
        .hud-corner::after {
          content: "";
          position: absolute;
          background:
            linear-gradient(90deg, rgba(103,232,249,0.86), rgba(56,189,248,0.12));
          box-shadow: 0 0 13px rgba(103,232,249,0.22);
        }

        .hud-corner::before {
          width: 66px;
          height: 1px;
        }

        .hud-corner::after {
          width: 1px;
          height: 66px;
        }

        .hud-tl {
          top: 34px;
          left: 34px;
        }

        .hud-tr {
          top: 34px;
          right: 34px;
          transform: scaleX(-1);
        }

        .hud-bl {
          bottom: 34px;
          left: 34px;
          transform: scaleY(-1);
        }

        .hud-br {
          bottom: 34px;
          right: 34px;
          transform: scale(-1);
        }

        .loader-shell {
          position: absolute;
          left: 50%;
          bottom: 6.2%;
          z-index: 14;
          width: min(650px, 92vw);
          transform: translateX(-50%);
          animation: panelRise 1.15s ease-out both;
          animation-delay: 0.95s;
        }

        .loader-frame {
          position: relative;
          width: 100%;
          padding: 10px;
          border-radius: 9999px;
          background:
            linear-gradient(180deg, rgba(203,235,255,0.88), rgba(220,242,255,0.64));
          border: 1px solid rgba(56,189,248,0.3);
          box-shadow:
            0 14px 32px rgba(37,99,235,0.12),
            0 0 26px rgba(56,189,248,0.12),
            inset 0 1px 0 rgba(255,255,255,0.38);
          backdrop-filter: blur(12px);
        }

        .dark .loader-frame {
          background:
            linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03));
          border: 1px solid rgba(125,211,252,0.16);
          box-shadow:
            0 16px 36px rgba(0,0,0,0.24),
            0 0 36px rgba(56,189,248,0.12),
            inset 0 1px 0 rgba(255,255,255,0.08);
        }

        .loader-soft-glow {
          position: absolute;
          inset: -12px;
          z-index: -1;
          border-radius: 9999px;
          background:
            radial-gradient(circle, rgba(56,189,248,0.15) 0%, rgba(56,189,248,0.06) 44%, transparent 74%);
          filter: blur(13px);
          animation: loaderGlow 2.6s ease-in-out infinite;
        }

        .loader-rail {
          position: relative;
          width: 100%;
          height: 23px;
          overflow: hidden;
          border-radius: 9999px;
          background:
            linear-gradient(180deg, rgba(125,211,252,0.34), rgba(96,165,250,0.16));
          border: 1px solid rgba(56,189,248,0.26);
          box-shadow:
            inset 0 1px 11px rgba(14,165,233,0.12),
            inset 0 -1px 8px rgba(255,255,255,0.18);
        }

        .dark .loader-rail {
          background:
            linear-gradient(180deg, rgba(2,6,23,0.74), rgba(2,6,23,0.52));
          border: 1px solid rgba(125,211,252,0.15);
          box-shadow:
            inset 0 1px 12px rgba(0,0,0,0.32),
            inset 0 -1px 8px rgba(255,255,255,0.02);
        }

        .loader-rail-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.38;
          background-image:
            linear-gradient(90deg, rgba(2,132,199,0.16) 1px, transparent 1px);
          background-size: 18px 100%;
          animation: railGridMove 3s linear infinite;
        }

        .dark .loader-rail-grid {
          opacity: 0.12;
          background-image:
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px);
        }

        .loader-progress {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: inherit;
          overflow: hidden;
          transform: scaleX(0);
          transform-origin: left center;
          will-change: transform;
          animation: loaderFill var(--loader-duration, 5000ms) linear forwards;
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
            0 0 18px rgba(14,165,233,0.34),
            0 0 28px rgba(56,189,248,0.2);
        }

        .dark .loader-progress {
          background:
            linear-gradient(
              90deg,
              rgba(14,165,233,0.88) 0%,
              rgba(56,189,248,0.95) 35%,
              rgba(103,232,249,0.98) 68%,
              rgba(186,230,253,0.94) 100%
            );
          box-shadow:
            0 0 18px rgba(56,189,248,0.38),
            0 0 30px rgba(103,232,249,0.2);
        }

        .loader-progress::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.03));
          opacity: 0.75;
        }

        .loader-progress::after {
          content: "";
          position: absolute;
          top: -35%;
          right: -28px;
          width: 78px;
          height: 170%;
          background:
            linear-gradient(
              90deg,
              rgba(255,255,255,0) 0%,
              rgba(255,255,255,0.54) 48%,
              rgba(255,255,255,0) 100%
            );
          transform: skewX(-18deg);
          filter: blur(4px);
          animation: loaderEdgeShine 1.4s linear infinite;
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
          background:
            linear-gradient(
              90deg,
              rgba(255,255,255,0) 0%,
              rgba(255,255,255,0.18) 50%,
              rgba(255,255,255,0) 100%
            );
          filter: blur(5px);
          animation: loaderSweep 2.1s ease-in-out infinite;
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
          background:
            radial-gradient(circle, rgba(255,255,255,0.98) 0%, rgba(103,232,249,0.9) 55%, rgba(56,189,248,0) 100%);
          box-shadow:
            0 0 9px rgba(14,165,233,0.22),
            0 0 13px rgba(56,189,248,0.18);
          opacity: 0;
          animation: loaderPacketRun 2s linear infinite;
        }

        .dark .loader-packet {
          box-shadow:
            0 0 11px rgba(255,255,255,0.38),
            0 0 17px rgba(103,232,249,0.26);
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
          background:
            linear-gradient(
              180deg,
              rgba(255,255,255,0.86) 0%,
              rgba(125,211,252,0.94) 50%,
              rgba(14,165,233,0.94) 100%
            );
          box-shadow:
            0 0 9px rgba(186,230,253,0.38),
            0 0 15px rgba(56,189,248,0.26);
        }

        .loader-tail-line {
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: 4px;
          height: 1px;
          opacity: 0.72;
          background:
            linear-gradient(90deg, transparent, rgba(14,165,233,0.26), transparent);
        }

        .dark .loader-tail-line {
          opacity: 0.55;
          background:
            linear-gradient(90deg, transparent, rgba(103,232,249,0.22), transparent);
        }

        @keyframes introFlash {
          0% { opacity: 0; }
          12% { opacity: 1; }
          38% { opacity: 0.35; }
          100% { opacity: 0; }
        }

        @keyframes loaderFill {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }

        @keyframes floorDrift {
          from {
            transform: perspective(1050px) rotateX(74deg) scale(1.65) translateY(0);
          }
          to {
            transform: perspective(1050px) rotateX(74deg) scale(1.65) translateY(38px);
          }
        }

        @keyframes diagonalMove {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(140px, 80px, 0); }
        }

        @keyframes ambientFloatLeft {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(42px, -22px) scale(1.06); }
        }

        @keyframes ambientFloatRight {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-38px, 20px) scale(1.05); }
        }

        @keyframes coreBreath {
          0%, 100% { transform: scale(1); opacity: 0.86; }
          50% { transform: scale(1.08); opacity: 1; }
        }

        @keyframes backgroundDotPulse {
          0%, 100% {
            opacity: 0.22;
            transform: scale(0.8);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.35);
          }
        }

        @keyframes streakMove {
          0% {
            opacity: 0;
            transform: translateX(-30vw) translateY(0) rotate(-18deg);
          }
          18% {
            opacity: 0.68;
          }
          58% {
            opacity: 0.28;
          }
          100% {
            opacity: 0;
            transform: translateX(118vw) translateY(-12vh) rotate(-18deg);
          }
        }

        @keyframes scanWave {
          0% {
            width: 70px;
            height: 70px;
            opacity: 0.45;
            border-color: rgba(56,189,248,0.42);
          }
          70% {
            opacity: 0.12;
          }
          100% {
            width: 980px;
            height: 980px;
            opacity: 0;
            border-color: rgba(56,189,248,0);
          }
        }

        @keyframes panelFloat {
          0%, 100% {
            transform: translateY(0) scale(1);
            opacity: 0.35;
          }
          50% {
            transform: translateY(-12px) scale(1.03);
            opacity: 0.64;
          }
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
          0%, 100% { transform: scale(0.98); opacity: 0.48; }
          50% { transform: scale(1.045); opacity: 0.96; }
        }

        @keyframes ringWidePulse {
          0%, 100% { transform: scale(0.985); opacity: 0.36; }
          50% { transform: scale(1.035); opacity: 0.72; }
        }

        @keyframes hexPulse {
          0%, 100% {
            opacity: 0.5;
            transform: scale(0.98);
          }
          50% {
            opacity: 0.92;
            transform: scale(1.035);
          }
        }

        @keyframes hexPulseInner {
          0%, 100% {
            opacity: 0.42;
            transform: scale(1.02) rotate(0deg);
          }
          50% {
            opacity: 0.88;
            transform: scale(0.96) rotate(2deg);
          }
        }

        @keyframes tickBlink {
          0%, 100% { opacity: 0.28; }
          50% { opacity: 0.92; }
        }

        @keyframes linePulse {
          0%, 100% { opacity: 0.34; }
          50% { opacity: 0.82; }
        }

        @keyframes dashMove {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -64; }
        }

        @keyframes dashMoveAlert {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: 48; }
        }

        @keyframes nodeBlink {
          0%, 100% { opacity: 0.66; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.18); }
        }

        @keyframes hubPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.46;
          }
          50% {
            transform: scale(1.13);
            opacity: 0.96;
          }
        }

        @keyframes packetMove {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) scale(0.82);
          }
          10% {
            opacity: 1;
          }
          52% {
            opacity: 0.95;
            transform: translate3d(var(--packet-x), var(--packet-y), 0) scale(1.1);
          }
          100% {
            opacity: 0;
            transform: translate3d(calc(var(--packet-x) * 1.05), calc(var(--packet-y) * 1.05), 0) scale(0.86);
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

        @keyframes deviceHalo {
          0%, 100% {
            opacity: 0.52;
            transform: translate(-50%, -50%) scale(0.96);
          }
          50% {
            opacity: 0.9;
            transform: translate(-50%, -50%) scale(1.08);
          }
        }

        @keyframes deviceScanRing {
          0% {
            opacity: 0.05;
            transform: translate(-50%, -50%) scale(0.8);
          }
          45% {
            opacity: 0.62;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.55);
          }
        }

        @keyframes ledPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.25);
            opacity: 0.72;
          }
        }

        @keyframes logoReveal {
          0% {
            opacity: 0;
            transform: scale(0.76) translateY(34px);
            filter: blur(16px);
          }
          55% {
            opacity: 1;
            transform: scale(1.055) translateY(-5px);
            filter: blur(0);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
            filter: blur(0);
          }
        }

        @keyframes auraPulse {
          0%, 100% { opacity: 0.74; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1.035); }
        }

        @keyframes rimPulse {
          0%, 100% { opacity: 0.66; transform: scale(0.98); }
          50% { opacity: 1; transform: scale(1.02); }
        }

        @keyframes shieldBreath {
          0%, 100% {
            opacity: 0.5;
            transform: translate(-50%, -50%) scale(0.98);
          }
          50% {
            opacity: 0.86;
            transform: translate(-50%, -50%) scale(1.035);
          }
        }

        @keyframes beamSurge {
          0%, 100% {
            opacity: 0.52;
            transform: translateX(-50%) scaleY(0.98);
          }
          50% {
            opacity: 1;
            transform: translateX(-50%) scaleY(1.08);
          }
        }

        @keyframes crystalFocusPulse {
          0%, 100% { opacity: 0.72; transform: translateX(-50%) scale(0.98); }
          50% { opacity: 1; transform: translateX(-50%) scale(1.045); }
        }

        @keyframes textFocusPulse {
          0%, 100% { opacity: 0.68; transform: scaleX(0.96); }
          50% { opacity: 1; transform: scaleX(1.035); }
        }

        @keyframes emphasisPulse {
          0%, 100% {
            opacity: 0.62;
            transform: scaleX(0.96);
          }
          50% {
            opacity: 1;
            transform: scaleX(1.04);
          }
        }

        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        @keyframes logoSweep {
          0% {
            left: -36%;
            opacity: 0;
          }
          18% {
            opacity: 0.78;
          }
          58% {
            opacity: 0.38;
          }
          100% {
            left: 122%;
            opacity: 0;
          }
        }

        @keyframes scanPass {
          0% {
            top: -16%;
            opacity: 0;
          }
          12% {
            opacity: 0.42;
          }
          50% {
            opacity: 0.28;
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

        @keyframes loaderGlow {
          0%, 100% { opacity: 0.56; transform: scale(1); }
          50% { opacity: 0.98; transform: scale(1.035); }
        }

        @keyframes loaderEdgeShine {
          0% {
            transform: translateX(-22px) skewX(-18deg);
            opacity: 0.22;
          }
          50% {
            opacity: 0.82;
          }
          100% {
            transform: translateX(22px) skewX(-18deg);
            opacity: 0.22;
          }
        }

        @keyframes railGridMove {
          from { background-position: 0 0; }
          to { background-position: 18px 0; }
        }

        @keyframes loaderSweep {
          0% {
            left: -20%;
            opacity: 0;
          }
          18% {
            opacity: 0.5;
          }
          50% {
            opacity: 0.24;
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
            opacity: 0.86;
            transform: scale(1.05);
          }
          100% {
            left: 103%;
            opacity: 0;
            transform: scale(0.9);
          }
        }

        @media (max-width: 1200px) {
          .device-node {
            width: 110px;
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

          .floating-panel {
            opacity: 0.34;
            transform: scale(0.86);
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

          .floating-panels {
            display: none;
          }
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

          .ring-c {
            width: 88%;
            height: 88%;
          }

          .ring-b {
            width: 76%;
            height: 76%;
          }

          .ring-a {
            width: 62%;
            height: 62%;
          }

          .scan-wave {
            animation-duration: 4.8s;
          }
        }
      `}</style>

      <motion.div
        className="argus-login"
        style={{ "--loader-duration": `${safeDuration}ms` } as React.CSSProperties}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <div className="intro-flash" />
        <div className="noise" />
        <div className="grid" />
        <div className="diagonal-beams" />
        <div className="ambient-left" />
        <div className="ambient-right" />
        <div className="center-core-glow" />

        <div className="background-dots">
          {backgroundDots.map((item) => (
            <span
              key={item}
              className={`background-dot ${
                item % 7 === 0 ? "orange" : item % 3 === 0 ? "green" : ""
              }`}
              style={{
                left: `${5 + ((item * 37) % 90)}%`,
                top: `${6 + ((item * 53) % 86)}%`,
                width: `${item % 8 === 0 ? 10 : item % 5 === 0 ? 7 : 4}px`,
                height: `${item % 8 === 0 ? 10 : item % 5 === 0 ? 7 : 4}px`,
                animationDelay: `${(item % 12) * 0.18}s`,
                animationDuration: `${2.2 + (item % 5) * 0.32}s`,
              }}
            />
          ))}
        </div>

        <div className="light-streaks">
          {waveLines.map((item) => (
            <span
              key={item}
              className="light-streak"
              style={{
                top: `${8 + item * 7}%`,
                left: `${-18 - item * 4}%`,
                animationDelay: `${item * 0.32}s`,
                animationDuration: `${4.2 + (item % 3) * 0.8}s`,
              }}
            />
          ))}
        </div>

        <div className="scan-wave-layer">
          {pulseRings.map((item) => (
            <span
              key={item}
              className="scan-wave"
              style={{
                animationDelay: `${item * 0.72}s`,
              }}
            />
          ))}
        </div>

        <div className="floating-panels">
          {Array.from({ length: 10 }, (_, item) => (
            <span
              key={item}
              className="floating-panel"
              style={{
                left: `${8 + ((item * 17) % 82)}%`,
                top: `${10 + ((item * 23) % 72)}%`,
                animationDelay: `${item * 0.42}s`,
                animationDuration: `${5.2 + (item % 4) * 0.7}s`,
              }}
            />
          ))}
        </div>

        <div className="corner-hud">
          <div className="hud-corner hud-tl" />
          <div className="hud-corner hud-tr" />
          <div className="hud-corner hud-bl" />
          <div className="hud-corner hud-br" />
        </div>

        <div className={`scene enter-ready ${start ? "enter-active" : ""}`}>
          <div className="ring-f" />
          <div className="ring-e" />
          <div className="ring-c" />
          <div className="ring-b" />
          <div className="ring-a" />
          <div className="ring-d" />
          <div className="security-hex" />
          <div className="security-hex-inner" />

          {hexTicks.map((tick) => (
            <span
              key={tick}
              className="hex-tick"
              style={{
                transform: `rotate(${tick * 15}deg) translateY(-190px)`,
                animationDelay: `${tick * 0.07}s`,
              }}
            />
          ))}

          <div className="crosshair-h" />
          <div className="crosshair-v" />

          {radarSweeps.map((item) => (
            <div
              key={item}
              className="scan-mask"
              style={{
                animationDelay: `${item * 0.55}s`,
                opacity: 1 - item * 0.16,
              }}
            />
          ))}

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
              <line className="network-link green" x1="640" y1="140" x2="640" y2="430" />

              <line className="network-link soft" x1="285" y1="260" x2="280" y2="530" />
              <line className="network-link soft" x1="995" y1="260" x2="1010" y2="540" />
              <line className="network-link soft" x1="285" y1="260" x2="640" y2="140" />
              <line className="network-link soft" x1="995" y1="260" x2="640" y2="140" />

              <line className="network-link alert" x1="220" y1="145" x2="640" y2="430" />
              <line className="network-link alert" x1="1060" y1="740" x2="640" y2="430" />

              <circle className="signal-dot safe" cx="285" cy="260" r="4" />
              <circle className="signal-dot safe" cx="280" cy="530" r="4" />
              <circle className="signal-dot warn" cx="995" cy="260" r="4" />
              <circle className="signal-dot safe" cx="1010" cy="540" r="4" />
              <circle className="signal-dot safe" cx="640" cy="140" r="4" />
              <circle className="signal-dot" cx="640" cy="430" r="6" />

              <circle className="hub-pulse" cx="640" cy="430" r="22" />
              <circle
                className="hub-pulse"
                cx="640"
                cy="430"
                r="38"
                style={{ animationDelay: "0.7s" }}
              />
              <circle
                className="hub-pulse"
                cx="640"
                cy="430"
                r="56"
                style={{ animationDelay: "1.35s" }}
              />
              <circle
                className="hub-pulse"
                cx="640"
                cy="430"
                r="78"
                style={{ animationDelay: "2s" }}
              />
            </svg>
          </div>

          <div className="packet-layer">
            {dataPackets.map((packet) => {
              const routes = [
                { left: "50%", top: "47%", x: "-275px", y: "-172px" },
                { left: "50%", top: "47%", x: "-282px", y: "110px" },
                { left: "50%", top: "47%", x: "280px", y: "-170px" },
                { left: "50%", top: "47%", x: "292px", y: "118px" },
                { left: "50%", top: "47%", x: "0px", y: "-280px" },
                { left: "22%", top: "28%", x: "345px", y: "170px" },
                { left: "78%", top: "59%", x: "-360px", y: "-120px" },
              ];

              const route = routes[packet % routes.length];

              return (
                <span
                  key={packet}
                  className={`packet ${packet % 4 === 0 ? "green" : ""}`}
                  style={
                    {
                      left: route.left,
                      top: route.top,
                      "--packet-x": route.x,
                      "--packet-y": route.y,
                      animationDelay: `${packet * 0.16}s`,
                      animationDuration: `${2.7 + (packet % 5) * 0.24}s`,
                    } as React.CSSProperties
                  }
                />
              );
            })}
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
            <div className="logo-shield" />
            <div className="logo-crystal-beam" />
            <div className="logo-crystal-focus" />
            <div className="logo-text-focus" />
            <div className="logo-emphasis" />

            <div className="scan-lines">
              {scanBars.map((bar, index) => (
                <span
                  key={bar}
                  className="scan-bar"
                  style={{ animationDelay: `${index * 0.18}s` }}
                />
              ))}
            </div>

            <div className="orbit-layer">
              {orbitParticles.map((particle, index) => {
                const x = Math.cos((particle.angle * Math.PI) / 180) * particle.radius;
                const y = Math.sin((particle.angle * Math.PI) / 180) * particle.radius;

                return (
                  <span
                    key={index}
                    className="particle"
                    style={{
                      width: `${particle.size}px`,
                      height: `${particle.size}px`,
                      marginLeft: `${x}%`,
                      marginTop: `${y}%`,
                      animationDelay: `${particle.delay}s`,
                    }}
                  />
                );
              })}
            </div>

            <div className="orbit-layer-outer">
              {outerParticles.map((particle, index) => {
                const x = Math.cos((particle.angle * Math.PI) / 180) * particle.radius;
                const y = Math.sin((particle.angle * Math.PI) / 180) * particle.radius;

                return (
                  <span
                    key={index}
                    className="particle outer"
                    style={{
                      width: `${particle.size}px`,
                      height: `${particle.size}px`,
                      marginLeft: `${x}%`,
                      marginTop: `${y}%`,
                      animationDelay: `${particle.delay}s`,
                    }}
                  />
                );
              })}
            </div>

            <div className="logo-shine" />

            <div className="logo-wrap">
              <img
                src={logo}
                alt="ARGUS logo"
                className={`logo-img ${logoReady ? "logo-img-ready" : ""}`}
                loading="eager"
                decoding="async"
                onLoad={() => setLogoReady(true)}
              />
            </div>
          </div>

          <div className="loader-shell">
            <div className="loader-frame">
              <div className="loader-soft-glow" />

              <div className="loader-rail">
                <div className="loader-rail-grid" />

                <div className="loader-progress">
                  <div className="loader-scan-layer" />

                  <div className="loader-packets">
                    {streamDots.map((dot, index) => (
                      <span
                        key={dot}
                        className={`loader-packet ${index % 2 === 0 ? "sm" : ""}`}
                        style={{
                          animationDelay: `${index * 0.22}s`,
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

        <div className="vignette" />
      </motion.div>
    </>
  );
};

export default Index;