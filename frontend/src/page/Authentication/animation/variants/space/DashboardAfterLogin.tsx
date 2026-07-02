import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import SpaceCanvas from "./SpaceCanvas";

type Props = {
  onFinished?: () => void;
  duration?: number;
};

/** No real assets to warm here — kept for interface parity with the other variant. */
export const preloadLoginSuccessAnimationAssets = (): Promise<void> => Promise.resolve();

const EXIT_FADE = 380; // ms

const DashboardAfterLogin: React.FC<Props> = ({ onFinished, duration = 4200 }) => {
  const [entrance, setEntrance] = useState(0);
  const [exiting, setExiting] = useState(false);

  const onFinishedRef = useRef(onFinished);
  const finishedRef = useRef(false);
  const safeDuration = useMemo(() => Math.max(duration, 1200), [duration]);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  // Cinematic camera pull-back that settles into the final framing.
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const entranceDuration = Math.min(safeDuration * 0.55, 1800);

    const tick = (now: number) => {
      const t = Math.min((now - start) / entranceDuration, 1);
      setEntrance(t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [safeDuration]);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setExiting(true);
    window.setTimeout(() => onFinishedRef.current?.(), EXIT_FADE);
  };

  useEffect(() => {
    const timer = window.setTimeout(finish, safeDuration);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeDuration]);

  return (
    <motion.div
      className="relative h-screen w-full overflow-hidden bg-[#01030a]"
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: exiting ? EXIT_FADE / 1000 : 0.5, ease: "easeInOut" }}
    >
      <React.Suspense fallback={<div className="absolute inset-0 bg-[#01030a]" />}>
        <SpaceCanvas entrance={entrance} />
      </React.Suspense>

      {/* soft radial vignette for depth — no text, just Earth centered on a starfield */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.45)_100%)]" />
    </motion.div>
  );
};

export default DashboardAfterLogin;
