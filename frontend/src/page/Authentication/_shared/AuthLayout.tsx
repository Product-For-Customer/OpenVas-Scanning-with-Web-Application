import React, { type ReactNode } from "react";
import { ParticleNetwork } from "./ParticleNetwork";
import isometricBg from "../../../assets/isometric_login_background.jpg";

type Props = { variant?: "login" | "register"; children: ReactNode; };

// ─────────────────────────────────────────────────────────────
// Background switch — flip this back to "particles" to restore
// the old animated network-particle background across every
// auth page (Login, Register, Forgot Password, Reset Password,
// OTP, Register-OTP, Reset-OTP). The particle version is kept
// in place (ParticleNetwork.tsx untouched) so switching back is
// a one-line change.
// ─────────────────────────────────────────────────────────────
let BACKGROUND_MODE: "image" | "particles" = "particles";

/**
 * Shared shell for all auth pages.
 * - Full-screen background: either the isometric artwork or the animated
 *   particle network (see BACKGROUND_MODE above)
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

      {/* ── Background layer (position: fixed → always covers viewport) ── */}
      {BACKGROUND_MODE === "particles" ? (
        <ParticleNetwork />
      ) : (
        <div
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${isometricBg})`,
            // Source artwork is only 1402x980 — on larger screens the
            // browser has to upscale it. These hints push Chrome/Safari
            // toward a sharper (less smoothed) scaling algorithm and add
            // a touch of contrast/saturation to make edges read crisper.
            // This can't add real pixel detail; a higher-res source image
            // is the only true fix if more sharpness is needed.
            imageRendering: "-webkit-optimize-contrast",
            filter: "contrast(1.08) saturate(1.1)",
          }}
          aria-hidden
        />
      )}

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
