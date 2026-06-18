import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineSun, HiOutlineMoon, HiOutlinePaintBrush } from "react-icons/hi2";
import { FiCheck, FiRotateCcw, FiX } from "react-icons/fi";
import { themeColors } from "../sidebar/data";
import { useStateContext } from "../../../contexts/ProviderContext";
import { useLanguage } from "../../../contexts/LanguageContext";

// ─────────────────────────────────────────────────────────────
// Mini UI Previews
// ─────────────────────────────────────────────────────────────

const LightPreview: React.FC = () => (
  <div className="h-14 w-full overflow-hidden rounded-lg select-none" style={{ background: "#f1f5f9" }}>
    <div className="flex h-full">
      <div className="flex w-7 flex-col gap-1 p-1.5" style={{ background: "#fff", borderRight: "1px solid #e2e8f0" }}>
        <div className="h-1 rounded-full" style={{ background: "#cbd5e1" }} />
        <div className="h-1 w-[70%] rounded-full" style={{ background: "#e2e8f0" }} />
        <div className="h-1 rounded-full" style={{ background: "#e2e8f0" }} />
        <div className="h-1 w-[80%] rounded-full" style={{ background: "#e2e8f0" }} />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-1.5">
        <div className="h-1.5 w-[55%] rounded-full" style={{ background: "#94a3b8" }} />
        <div className="mt-0.5 flex gap-1">
          {[0,1,2].map(i => <div key={i} className="h-4 flex-1 rounded" style={{ background: "#fff", border: "1px solid #e2e8f0" }} />)}
        </div>
        <div className="h-1 rounded-full" style={{ background: "#e2e8f0" }} />
      </div>
    </div>
  </div>
);

const DarkPreview: React.FC = () => (
  <div className="h-14 w-full overflow-hidden rounded-lg select-none" style={{ background: "#0f1123" }}>
    <div className="flex h-full">
      <div className="flex w-7 flex-col gap-1 p-1.5" style={{ background: "#13152a", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
        <div className="h-1 w-[70%] rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
        <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
        <div className="h-1 w-[80%] rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-1.5">
        <div className="h-1.5 w-[55%] rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
        <div className="mt-0.5 flex gap-1">
          {[0,1,2].map(i => <div key={i} className="h-4 flex-1 rounded" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }} />)}
        </div>
        <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const hexToRgb = (hex: string) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-3 flex items-center gap-2">
    <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-white/30">
      {children}
    </p>
    <div className="h-px flex-1 bg-slate-100 dark:bg-white/8" />
  </div>
);

const DEFAULT_COLOR = "#1A97F5";

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

const ThemeSettings: React.FC = () => {
  const { setColor, setTheme, currentMode, currentColor, setThemeSettings } = useStateContext();
  const { t } = useLanguage();

  const [draftColor, setDraftColor] = useState(currentColor);
  const [mounted, setMounted]       = useState(false);
  const [hoveredSwatch, setHoveredSwatch] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animate in
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Sync draft
  useEffect(() => { setDraftColor(currentColor); }, [currentColor]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const handleClose = () => {
    setMounted(false);
    setTimeout(() => setThemeSettings(false), 300);
  };

  const handleColorInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const c = e.target.value;
    setDraftColor(c);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setColor(c), 600);
  };

  const handleColorCommit = (e: React.FocusEvent<HTMLInputElement>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setColor(e.target.value);
  };

  const handleReset = () => {
    setColor(DEFAULT_COLOR);
    setTheme("Light");
  };

  const { r, g, b } = hexToRgb(draftColor.length === 7 ? draftColor : currentColor);

  return createPortal(
    /* ── Overlay (no blur, subtle dim) ── */
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Appearance settings"
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        transition: "background 0.3s ease",
        background: mounted ? "rgba(0,0,0,0.25)" : "transparent",
      }}
    >
      {/* ── Slide-in Panel ── */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          height: "100%",
          width: "300px",
          display: "flex",
          flexDirection: "column",
          transition: "transform 0.3s cubic-bezier(0.32,0.72,0,1)",
          transform: mounted ? "translateX(0)" : "translateX(100%)",
          boxShadow: "-20px 0 48px rgba(0,0,0,0.12)",
        }}
        className="bg-white dark:bg-[#0d0b1a]"
      >
        {/* Top accent bar */}
        <div style={{
          height: "2px",
          flexShrink: 0,
          background: `linear-gradient(90deg, rgba(${r},${g},${b},0.2), rgba(${r},${g},${b},1) 60%, rgba(${r},${g},${b},0.4))`,
          transition: "background 0.4s ease",
        }} />

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 pb-4 pt-5 dark:border-white/8">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `rgba(${r},${g},${b},0.12)` }}
            >
              <HiOutlinePaintBrush className="text-[16px]" style={{ color: currentColor }} />
            </div>
            <div>
              <p className="text-[13px] font-semibold leading-tight text-slate-800 dark:text-white">{t("theme.appearance")}</p>
              <p className="mt-0.5 text-[11px] leading-none text-slate-400 dark:text-white/35">{t("theme.customize")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-white/35 dark:hover:bg-white/8 dark:hover:text-white/70"
          >
            <FiX className="text-[16px]" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">

          {/* Interface mode */}
          <section>
            <SectionLabel>{t("theme.interface")}</SectionLabel>
            <div className="grid grid-cols-2 gap-2.5">
              {([
                { value: "Light" as const, label: t("theme.light"), icon: <HiOutlineSun />, preview: <LightPreview /> },
                { value: "Dark"  as const, label: t("theme.dark"),  icon: <HiOutlineMoon />, preview: <DarkPreview /> },
              ]).map(m => {
                const active = currentMode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setTheme(m.value)}
                    className={[
                      "relative flex flex-col items-center gap-2 overflow-hidden rounded-xl border-2 p-3 transition-all duration-200 focus:outline-none",
                      active
                        ? "bg-slate-50 dark:bg-white/4"
                        : "border-slate-150 hover:border-slate-200 hover:bg-slate-50 dark:border-white/8 dark:hover:border-white/15 dark:hover:bg-white/3",
                    ].join(" ")}
                    style={active ? { borderColor: currentColor } : undefined}
                  >
                    {m.preview}
                    <div className="flex w-full items-center justify-center gap-1.5">
                      <span className="text-[13px] transition-colors" style={active ? { color: currentColor } : { color: "#94a3b8" }}>
                        {m.icon}
                      </span>
                      <span className={`text-[11px] font-semibold transition-colors ${active ? "text-slate-700 dark:text-white/90" : "text-slate-400 dark:text-white/35"}`}>
                        {m.label}
                      </span>
                      {active && <FiCheck className="ml-0.5 text-[10px]" style={{ color: currentColor }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Accent Color */}
          <section>
            <SectionLabel>{t("theme.accentColor")}</SectionLabel>

            {/* Custom picker */}
            <label
              className="group mb-3 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-slate-200 dark:border-white/8 dark:hover:border-white/15"
              title="Click swatch to pick color"
            >
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl shadow-sm">
                <div className="absolute inset-0 transition-colors duration-300" style={{ backgroundColor: draftColor }} />
                <input
                  type="color"
                  value={draftColor}
                  onChange={handleColorInput}
                  onBlur={handleColorCommit}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-150 group-hover:bg-black/20">
                  <span className="text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">Pick</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-white/45">Selected</span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide"
                    style={{ background: `rgba(${r},${g},${b},0.12)`, color: draftColor }}
                  >
                    {t("theme.custom")}
                  </span>
                </div>
                <p className="font-mono text-[13px] font-bold tracking-wider text-slate-800 dark:text-white">
                  {draftColor.toUpperCase()}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400 dark:text-white/25">rgb({r}, {g}, {b})</p>
              </div>
              <p className="shrink-0 text-right text-[10px] leading-relaxed text-slate-400 dark:text-white/25">
                {t("theme.clickSwatch")}
              </p>
            </label>

            {/* Swatches grid */}
            <div className="grid grid-cols-5 gap-2">
              {themeColors.map(item => {
                const selected = item.color === currentColor;
                const hovered  = hoveredSwatch === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setColor(item.color)}
                    onMouseEnter={() => setHoveredSwatch(item.name)}
                    onMouseLeave={() => setHoveredSwatch(null)}
                    aria-label={item.name.replace(/-/g, " ")}
                    title={item.name.replace(/-/g, " ")}
                    className="relative h-9 w-full rounded-xl transition-all duration-150 focus:outline-none"
                    style={{
                      backgroundColor: item.color,
                      transform: selected ? "scale(1.12)" : hovered ? "scale(1.06)" : "scale(1)",
                      boxShadow: selected
                        ? `0 0 0 2px white, 0 0 0 4px ${item.color}`
                        : hovered
                        ? `0 4px 12px ${item.color}55`
                        : "none",
                      transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    }}
                  >
                    {selected && <FiCheck className="absolute inset-0 m-auto text-[13px] text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>

            {/* Hover name */}
            <div
              className="mt-1.5 flex h-5 items-center justify-center transition-opacity duration-150"
              style={{ opacity: hoveredSwatch ? 1 : 0 }}
            >
              <span className="text-[10px] font-medium capitalize text-slate-500 dark:text-white/35">
                {hoveredSwatch?.replace(/-/g, " ")}
              </span>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="shrink-0 space-y-2 border-t border-slate-100 px-5 py-4 dark:border-white/8">
          <button
            type="button"
            onClick={handleReset}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-[11.5px] font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:border-white/8 dark:text-white/40 dark:hover:bg-white/4 dark:hover:text-white/60"
          >
            <FiRotateCcw className="text-[11px]" />
            {t("theme.resetDefaults")}
          </button>
          <p className="text-center text-[10px] text-slate-400 dark:text-white/25">
            {t("theme.preferencesSaved")}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ThemeSettings;
