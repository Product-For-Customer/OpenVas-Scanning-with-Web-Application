/**
 * CustomSelect — single-select and multi-select dropdown components
 * matching the /admin/dashboard "Target Query" dropdown style.
 *
 * Usage:
 *   <CustomSelect
 *     options={[{ value: "a", label: "Option A" }]}
 *     value="a"
 *     onChange={(v) => setValue(v)}
 *     placeholder="Choose…"
 *   />
 *
 *   <CustomMultiSelect
 *     options={[{ value: "a", label: "Option A", badge?: number }]}
 *     value={["a"]}
 *     onChange={(vals) => setValues(vals)}
 *     placeholder="Choose…"
 *     searchPlaceholder="Search…"
 *   />
 */

import React, { useEffect, useRef, useState } from "react";
import { FiCheck, FiChevronDown, FiSearch, FiX } from "react-icons/fi";

// ─── Shared types ────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
  /** Optional count badge shown on the right of the option row */
  badge?: number;
}

// ─── Single-Select ───────────────────────────────────────────────────────────

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Show the search input (default: true when options > 5) */
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  /** Icon shown before the trigger label */
  icon?: React.ReactNode;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  searchable,
  disabled = false,
  className = "",
  icon,
}) => {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const ref                 = useRef<HTMLDivElement>(null);

  const showSearch = searchable ?? options.length > 5;
  const selected   = options.find((o) => o.value === value);
  const filtered   = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (opt: SelectOption) => {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((p) => !p)}
        className={[
          "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12.5px] font-medium transition",
          "border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
          "dark:border-white/8 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/8",
          "focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/15",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        ].join(" ")}
      >
        {icon && (
          <span className="shrink-0 text-[13px] text-slate-400 dark:text-white/35">{icon}</span>
        )}
        <span className="flex-1 truncate">
          {selected ? selected.label : (
            <span className="text-slate-400 dark:text-white/30">{placeholder}</span>
          )}
        </span>
        <FiChevronDown
          className={`shrink-0 text-[12px] text-slate-400 transition-transform dark:text-white/35 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 z-[9999] mt-1.5 w-full min-w-[220px] overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
          {showSearch && (
            <div className="border-b border-slate-100 p-2.5 dark:border-white/8">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-2.5 dark:border-white/8 dark:bg-white/5">
                <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-8 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30"
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")}>
                    <FiX className="text-[11px] text-slate-400 hover:text-slate-600 dark:text-white/30" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="max-h-52 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-2.5 py-3 text-center text-[11px] text-slate-400 dark:text-white/30">
                No results
              </p>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt)}
                      className={[
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-500/10"
                          : "hover:bg-slate-50 dark:hover:bg-white/5",
                      ].join(" ")}
                    >
                      {/* Check indicator */}
                      <span
                        className={[
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition",
                          isSelected
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5",
                        ].join(" ")}
                      >
                        <FiCheck className="text-[9px]" />
                      </span>
                      <span className="flex-1 truncate text-[11.5px] text-slate-700 dark:text-white/75">
                        {opt.label}
                      </span>
                      {typeof opt.badge === "number" && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-px text-[9.5px] font-semibold text-slate-500 dark:bg-white/8 dark:text-white/40">
                          {opt.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Multi-Select ────────────────────────────────────────────────────────────

interface CustomMultiSelectProps {
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  /** Icon shown before the trigger label */
  icon?: React.ReactNode;
}

export const CustomMultiSelect: React.FC<CustomMultiSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  disabled = false,
  className = "",
  icon,
}) => {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const ref               = useRef<HTMLDivElement>(null);

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => value.includes(o.value));

  // Trigger label
  const triggerLabel =
    value.length === 0
      ? null
      : value.length === 1
      ? (options.find((o) => o.value === value[0])?.label ?? "1 selected")
      : `${value.length} selected`;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (optValue: string) => {
    onChange(
      value.includes(optValue)
        ? value.filter((v) => v !== optValue)
        : [...value, optValue],
    );
  };

  const toggleAll = () => {
    const visibleVals = filtered.map((o) => o.value);
    if (allFilteredSelected) {
      onChange(value.filter((v) => !visibleVals.includes(v)));
    } else {
      onChange([...new Set([...value, ...visibleVals])]);
    }
  };

  const clear = () => onChange([]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((p) => !p)}
        className={[
          "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12.5px] font-medium transition",
          "border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
          "dark:border-white/8 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/8",
          "focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/15",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        ].join(" ")}
      >
        {icon && (
          <span className="shrink-0 text-[13px] text-slate-400 dark:text-white/35">{icon}</span>
        )}
        <span className="flex-1 truncate">
          {triggerLabel ?? (
            <span className="text-slate-400 dark:text-white/30">{placeholder}</span>
          )}
        </span>
        {value.length > 0 && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
        )}
        <FiChevronDown
          className={`shrink-0 text-[12px] text-slate-400 transition-transform dark:text-white/35 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-0 z-[9999] mt-1.5 w-full min-w-[240px] overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
          {/* Search + select-all row */}
          <div className="border-b border-slate-100 p-2.5 dark:border-white/8">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-2.5 dark:border-white/8 dark:bg-white/5">
              <FiSearch className="shrink-0 text-[11px] text-slate-400 dark:text-white/35" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-white/75 dark:placeholder:text-white/30"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")}>
                  <FiX className="text-[11px] text-slate-400 hover:text-slate-600 dark:text-white/30" />
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={toggleAll}
                className="text-[10px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400"
              >
                {allFilteredSelected ? "Unselect all" : "Select all"}
              </button>
              {value.length > 0 && (
                <button
                  type="button"
                  onClick={clear}
                  className="text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:text-white/35 dark:hover:text-white/55"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-44 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-2.5 py-3 text-center text-[11px] text-slate-400 dark:text-white/30">
                No results
              </p>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((opt) => {
                  const checked = value.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggle(opt.value)}
                      className={[
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                        checked
                          ? "bg-blue-50 dark:bg-blue-500/10"
                          : "hover:bg-slate-50 dark:hover:bg-white/5",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                          checked
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-slate-300 bg-white text-transparent dark:border-white/20 dark:bg-white/5",
                        ].join(" ")}
                      >
                        <FiCheck className="text-[9px]" />
                      </span>
                      <span className="flex-1 truncate text-[11.5px] text-slate-700 dark:text-white/75">
                        {opt.label}
                      </span>
                      {typeof opt.badge === "number" && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-px text-[9.5px] font-semibold text-slate-500 dark:bg-white/8 dark:text-white/40">
                          {opt.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
