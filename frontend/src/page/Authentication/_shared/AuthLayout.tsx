import React, { type ReactNode } from "react";
import { ParticleNetwork } from "./ParticleNetwork";

type Props = { variant?: "login" | "register"; children: ReactNode; };

/**
 * Shared shell for all auth pages.
 * - Full-screen animated particle network background (2-D canvas)
 * - Centred white card that holds the page's form content
 * - Adapts to light / dark mode automatically
 */
const AuthLayout: React.FC<Props> = ({ children }) => {
  return (
    /*
     * Outer wrapper — sets the background colour behind the canvas.
     * `relative` + `z-0` is needed so the fixed canvas sits behind the card.
     */
    <div className="relative min-h-screen bg-[#f5f7fa] dark:bg-[#0e1120] flex items-center justify-center py-8 px-4">

      {/* ── Particle animation (position: fixed → always covers viewport) ── */}
      <ParticleNetwork />

      {/* ── Centred card ── */}
      <div
        className={[
          "relative z-10",
          "w-full",
          "bg-white dark:bg-[#16182e]",
          // overflow-y-auto so tall forms (Register) scroll inside the card
          "overflow-y-auto",
        ].join(" ")}
        style={{
          maxWidth:  490,
          maxHeight: "calc(100vh - 64px)",
          boxShadow: "0 4px 32px rgba(0,0,0,0.09), 0 1px 6px rgba(0,0,0,0.06)",
        }}
      >
        {/* Inner padding */}
        <div className="px-10 py-10">
          {children}
        </div>
      </div>

    </div>
  );
};

export default AuthLayout;
