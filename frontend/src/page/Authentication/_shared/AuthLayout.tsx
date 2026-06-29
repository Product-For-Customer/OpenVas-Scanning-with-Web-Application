import React, { type ReactNode, Suspense } from "react";
import QRCodeDecor from "./QRCodeDecor";
import { CyberScene } from "./CyberScene";
import { useStateContext } from "../../../contexts/ProviderContext";

type LeftVariant = "login" | "register";
interface Props { variant?: LeftVariant; children: ReactNode; }

const AuthLayout: React.FC<Props> = ({ variant = "login", children }) => {
  const isRegister       = variant === "register";
  const { currentColor } = useStateContext();

  return (
    <>
      {/* ── Mobile (no 3D — performance) ── */}
      <div className="lg:hidden min-h-screen bg-white dark:bg-[#0f0e1a] flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>

      {/* ── Desktop ── */}
      <div className="hidden lg:block relative min-h-screen overflow-hidden">

        {/* CSS fallback (shows while Canvas initialises) */}
        <div className="absolute inset-0 bg-[#02050e]" />

        {/* 3D cyber scene */}
        <Suspense fallback={<div className="absolute inset-0 bg-[#02050e]" />}>
          <CyberScene color={currentColor} />
        </Suspense>

        {/* ── Content layer (above canvas) ── */}
        <div className="relative min-h-screen flex" style={{ zIndex: 1 }}>

          {/* Left – branding */}
          <div className="flex-1 flex flex-col items-center justify-center text-white px-16 text-center">
            {!isRegister ? (
              <>
                <div className="relative inline-block mb-1">
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 block w-9 h-0.5 bg-white rounded-full" />
                  <h1 className="text-[2.5rem] font-extrabold tracking-wide leading-none drop-shadow-lg">
                    Argus
                  </h1>
                </div>
                <p className="text-base mt-3 mb-8 font-medium text-white/90">
                  We are glad to see you again!
                </p>
                <QRCodeDecor />
                <p className="text-base font-semibold mt-5">Log In with QR Code</p>
                <p className="text-sm text-white/75 mt-2 max-w-57.5 leading-relaxed">
                  Scan this with your camera or our mobile app to login instantly.
                </p>
              </>
            ) : (
              <>
                <div className="relative inline-block mb-1">
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 block w-9 h-0.5 bg-white rounded-full" />
                  <h1 className="text-[2.5rem] font-extrabold tracking-wide leading-none drop-shadow-lg">
                    Argus
                  </h1>
                </div>
                <p className="text-base mt-3 mb-6 font-medium text-white/90">
                  Looks like you're new here!
                </p>
                <p className="text-2xl font-bold max-w-72.5 leading-snug mb-8">
                  Join our group in few minutes! Sign up with your details to get started
                </p>
                <button type="button" className="text-white/75 underline text-sm hover:text-white transition">
                  Download our mobile app.
                </button>
              </>
            )}
          </div>

          {/* Right – login card */}
          <div className="flex flex-col justify-center mr-8 my-8">
            <div
              className="w-127.5 shrink-0 bg-white dark:bg-[#0f0e1a] overflow-y-auto"
              style={{ maxHeight: "calc(100vh - 4rem)", borderLeft: `3px solid ${currentColor}30` }}
            >
              <div className="px-14 py-14">{children}</div>
            </div>
          </div>

        </div>

        {/* ── Corner brackets ── */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
          <div className="absolute top-5 left-5 w-9 h-9"
            style={{ borderTop: `2px solid ${currentColor}60`, borderLeft: `2px solid ${currentColor}60` }}/>
          <div className="absolute bottom-5 left-5 w-9 h-9"
            style={{ borderBottom: `2px solid ${currentColor}60`, borderLeft: `2px solid ${currentColor}60` }}/>
          <div className="absolute top-5 right-5 w-9 h-9"
            style={{ borderTop: `1.5px solid ${currentColor}28`, borderRight: `1.5px solid ${currentColor}28` }}/>
          <div className="absolute bottom-5 right-5 w-9 h-9"
            style={{ borderBottom: `1.5px solid ${currentColor}28`, borderRight: `1.5px solid ${currentColor}28` }}/>
        </div>

        {/* ── Scanning status badge ── */}
        <div
          className="absolute bottom-7 left-16 pointer-events-none flex items-center gap-2.5"
          style={{ zIndex: 2 }}
        >
          <ScanDot color={currentColor} />
          <span style={{
            color: `${currentColor}95`,
            fontSize: "10px",
            letterSpacing: "0.22em",
            fontFamily: "monospace",
            fontWeight: 700,
          }}>
            SCANNING NETWORK
          </span>
        </div>

      </div>
    </>
  );
};

// Blinking dot — isolated so keyframes inject once
const ScanDot: React.FC<{ color: string }> = ({ color }) => (
  <>
    <style>{`@keyframes argus-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.2;transform:scale(0.7)}}`}</style>
    <span style={{
      display: "inline-block",
      width: 7, height: 7,
      borderRadius: "50%",
      backgroundColor: color,
      boxShadow: `0 0 10px 3px ${color}65`,
      animation: "argus-dot 1.4s ease-in-out infinite",
    }}/>
  </>
);

export default AuthLayout;
