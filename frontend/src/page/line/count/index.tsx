import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiBarChart2,
  FiCalendar,
  FiAlertCircle,
  FiChevronDown,
  FiCheck,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { type HistoryNotifyResponse } from "../../../services";

type MonthRow = {
  key: number;
  monthShort: string;
  monthFull: string;
  count: number;
};

type YearOption = {
  key: string;
  label: string;
  value: number;
};

const MONTHS = [
  { short: "Jan", full: "January" },
  { short: "Feb", full: "February" },
  { short: "Mar", full: "March" },
  { short: "Apr", full: "April" },
  { short: "May", full: "May" },
  { short: "Jun", full: "June" },
  { short: "Jul", full: "July" },
  { short: "Aug", full: "August" },
  { short: "Sep", full: "September" },
  { short: "Oct", full: "October" },
  { short: "Nov", full: "November" },
  { short: "Dec", full: "December" },
];

const cardClass = [
  "relative h-full overflow-hidden rounded-[18px] p-3 sm:p-3.5",
  "bg-white border border-gray-200/80 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.18)]",
  "dark:bg-[#08111f]/95 dark:border-white/10 dark:ring-1 dark:ring-cyan-400/10 dark:shadow-none",
  "flex flex-col",
].join(" ");

const panelClass = [
  "overflow-hidden rounded-[18px] border border-gray-200/80 bg-white/90",
  "dark:border-white/10 dark:bg-white/[0.03]",
  "flex-1 flex flex-col",
].join(" ");

const parseDate = (value?: string) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const buildYearData = (
  items: HistoryNotifyResponse[],
  selectedYears: number[]
): MonthRow[] => {
  const counts = Array(12).fill(0);

  items.forEach((item) => {
    const date = parseDate(item.datetime || item.created_at);
    if (!date) return;

    if (
      selectedYears.length === 0 ||
      selectedYears.includes(date.getFullYear())
    ) {
      counts[date.getMonth()] += 1;
    }
  });

  return MONTHS.map((m, index) => ({
    key: index,
    monthShort: m.short,
    monthFull: m.full,
    count: counts[index],
  }));
};

const getBarWidthPercent = (count: number, max: number) => {
  if (max <= 0) return 0;
  return Math.max((count / max) * 100, count > 0 ? 8 : 0);
};

type CountProps = {
  items: HistoryNotifyResponse[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  onRefresh: (showRefresh?: boolean) => Promise<void> | void;
};

const Index: React.FC<CountProps> = ({
  items,
  loading,
  error,
}) => {
  const currentYear = new Date().getFullYear();

  const [openYearSelect, setOpenYearSelect] = useState(false);
  const [yearSearch, setYearSearch] = useState("");
  const [selectedYears, setSelectedYears] = useState<number[]>([]);

  const yearRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!yearRef.current) return;
      if (!yearRef.current.contains(e.target as Node)) {
        setOpenYearSelect(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const availableYears = useMemo(() => {
    const years = items
      .map((item) => parseDate(item.datetime || item.created_at))
      .filter((d): d is Date => d instanceof Date)
      .map((d) => d.getFullYear());

    const uniqueYears = Array.from(new Set(years)).sort((a, b) => b - a);

    if (uniqueYears.length === 0) return [currentYear];
    return uniqueYears;
  }, [items, currentYear]);

  const yearOptions = useMemo<YearOption[]>(() => {
    return availableYears.map((year) => ({
      key: String(year),
      label: String(year),
      value: year,
    }));
  }, [availableYears]);

  const filteredYearOptions = useMemo(() => {
    const keyword = yearSearch.trim().toLowerCase();
    if (!keyword) return yearOptions;

    return yearOptions.filter((opt) =>
      opt.label.toLowerCase().includes(keyword)
    );
  }, [yearOptions, yearSearch]);

  const selectedCount = selectedYears.length;

  const yearButtonLabel = useMemo(() => {
    if (selectedCount === 0) return "Year Filter";
    if (selectedCount === 1) {
      const found = yearOptions.find((x) => x.value === selectedYears[0]);
      return found?.label || "1 selected";
    }
    return `${selectedCount} selected`;
  }, [selectedCount, yearOptions, selectedYears]);

  const chartData = useMemo(() => {
    return buildYearData(items, selectedYears);
  }, [items, selectedYears]);

  const totalNotifications = useMemo(() => {
    return chartData.reduce((sum, row) => sum + row.count, 0);
  }, [chartData]);

  const maxCount = useMemo(() => {
    return Math.max(...chartData.map((row) => row.count), 0);
  }, [chartData]);

  const toggleYear = (year: number) => {
    setSelectedYears((prev) =>
      prev.includes(year)
        ? prev.filter((item) => item !== year)
        : [...prev, year].sort((a, b) => b - a)
    );
  };

  const handleSelectAllVisible = () => {
    const visibleYears = filteredYearOptions.map((x) => x.value);

    setSelectedYears((prev) => {
      const prevSet = new Set(prev);
      const allVisibleSelected =
        visibleYears.length > 0 &&
        visibleYears.every((year) => prevSet.has(year));

      if (allVisibleSelected) {
        return prev.filter((year) => !visibleYears.includes(year));
      }

      return Array.from(new Set([...prev, ...visibleYears])).sort(
        (a, b) => b - a
      );
    });
  };

  const clearAllSelections = () => {
    setSelectedYears([]);
  };

  const allVisibleSelected =
    filteredYearOptions.length > 0 &&
    filteredYearOptions.every((opt) => selectedYears.includes(opt.value));

  return (
    <section className={cardClass}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-12 right-5 h-24 w-24 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `
                linear-gradient(to right, currentColor 1px, transparent 1px),
                linear-gradient(to bottom, currentColor 1px, transparent 1px)
              `,
              backgroundSize: "24px 24px",
            }}
          />
        </div>
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300">
              <FiBarChart2 className="text-[10px]" />
              History Notify Analytics
            </div>

            <h2 className="mt-2 text-[16px] font-semibold tracking-tight text-slate-900 sm:text-[18px] dark:text-white">
              Monthly Notifications Massage
            </h2>

            <p className="mt-1 text-[10.5px] text-slate-500 sm:text-[11px] dark:text-white/55">
              The number of notifications for each month of the selected year
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-58" ref={yearRef}>
              <button
                type="button"
                onClick={() => setOpenYearSelect((prev) => !prev)}
                className={[
                  "w-full h-8.5 rounded-2xl px-2.5 inline-flex items-center justify-between gap-2.5 transition text-left",
                  "bg-white border border-gray-200/80 text-[10.5px] font-medium text-gray-700 hover:bg-gray-50",
                  "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/8",
                ].join(" ")}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FiCalendar className="shrink-0 text-[12px] text-gray-500 dark:text-white/55" />
                  <span className="truncate">{yearButtonLabel}</span>
                </div>

                <FiChevronDown
                  className={`pointer-events-none shrink-0 text-[12px] text-gray-400 dark:text-white/45 transition-transform ${
                    openYearSelect ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openYearSelect && (
                <div className="absolute right-0 mt-2 w-full rounded-[18px] border border-gray-200 bg-white shadow-xl overflow-hidden z-30 dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none">
                  <div className="p-2 border-b border-gray-100 dark:border-white/10">
                    <div
                      className={[
                        "flex items-center gap-2 rounded-[14px] px-2.5 h-8",
                        "bg-slate-50 border border-slate-200/80",
                        "dark:bg-white/5 dark:border-white/10",
                      ].join(" ")}
                    >
                      <FiSearch className="text-[11px] text-gray-400 dark:text-white/40 shrink-0" />
                      <input
                        type="text"
                        value={yearSearch}
                        onChange={(e) => setYearSearch(e.target.value)}
                        placeholder="Search year..."
                        className="w-full bg-transparent outline-none text-[10.5px] text-gray-700 placeholder:text-gray-400 dark:text-white/80 dark:placeholder:text-white/30"
                      />
                      {yearSearch.trim() !== "" && (
                        <button
                          type="button"
                          onClick={() => setYearSearch("")}
                          className="text-gray-400 hover:text-gray-600 dark:text-white/35 dark:hover:text-white/70"
                          aria-label="Clear year search"
                        >
                          <FiX className="text-[11px]" />
                        </button>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllVisible}
                        className="text-[10px] font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200"
                      >
                        {allVisibleSelected ? "Unselect visible" : "Select visible"}
                      </button>

                      <button
                        type="button"
                        onClick={clearAllSelections}
                        className="text-[10px] font-medium text-gray-500 hover:text-gray-700 dark:text-white/50 dark:hover:text-white/75"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto p-2">
                    {filteredYearOptions.length === 0 ? (
                      <div className="px-3 py-6 text-center text-[11px] text-gray-500 dark:text-white/50">
                        No matching year
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredYearOptions.map((opt) => {
                          const checked = selectedYears.includes(opt.value);

                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => toggleYear(opt.value)}
                              className={[
                                "w-full flex items-start gap-2.5 rounded-[14px] px-2.5 py-2 text-left transition",
                                checked
                                  ? "bg-cyan-50 border border-cyan-200 dark:bg-cyan-500/10 dark:border-cyan-400/20"
                                  : "border border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
                              ].join(" ")}
                            >
                              <span
                                className={[
                                  "mt-0.5 h-4 w-4 rounded-md border flex items-center justify-center shrink-0 transition",
                                  checked
                                    ? "bg-cyan-500 border-cyan-500 text-white"
                                    : "bg-white border-gray-300 text-transparent dark:bg-white/5 dark:border-white/20",
                                ].join(" ")}
                              >
                                <FiCheck className="text-[9px]" />
                              </span>

                              <span className="min-w-0 flex-1">
                                <span className="block text-[10px] sm:text-[10.5px] font-medium text-gray-700 dark:text-white/80 wrap-break-word">
                                  {opt.label}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
            Year:
            <span className="ml-1 font-semibold text-slate-900 dark:text-white">
              {selectedYears.length === 0
                ? "All"
                : selectedYears.length === 1
                ? selectedYears[0]
                : `${selectedYears.length} selected`}
            </span>
          </div>

          <div className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-medium text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200">
            Total Notifications:
            <span className="ml-1 font-semibold">{totalNotifications}</span>
          </div>

          <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
            Fixed Months:
            <span className="ml-1 font-semibold">12</span>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <div className={`mt-3.5 ${panelClass}`}>
          {loading ? (
            <div className="flex flex-1 items-center justify-center px-4 py-12">
              <div className="inline-flex items-center gap-2 text-[11px] text-slate-500 dark:text-white/50">
                <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500/70" />
                Loading monthly notifications...
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-4 py-12">
              <div className="inline-flex items-center gap-2 text-[11px] text-slate-500 dark:text-white/50">
                <FiAlertCircle className="text-[13px]" />
                No monthly notification data
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-x-auto overflow-y-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur dark:bg-[#0f172a]/95">
                    <tr className="text-left">
                      <th className="border-b border-gray-200/80 px-3.5 py-3 text-[10.5px] font-semibold text-slate-600 dark:border-white/10 dark:text-white/60">
                        Month
                      </th>
                      <th className="border-b border-gray-200/80 px-3.5 py-3 text-[10.5px] font-semibold text-slate-600 dark:border-white/10 dark:text-white/60">
                        Monthly Overview
                      </th>
                      <th className="border-b border-gray-200/80 px-3.5 py-3 text-right text-[10.5px] font-semibold text-slate-600 dark:border-white/10 dark:text-white/60">
                        Count
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {chartData.map((row) => {
                      const width = getBarWidthPercent(row.count, maxCount);

                      return (
                        <tr
                          key={row.key}
                          className="transition hover:bg-slate-50/70 dark:hover:bg-white/3"
                        >
                          <td className="border-b border-gray-100/80 px-3.5 py-3 dark:border-white/5">
                            <div className="flex flex-col">
                              <span className="text-[11.5px] font-semibold text-slate-800 dark:text-white/90">
                                {row.monthShort}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-white/45">
                                {row.monthFull}
                              </span>
                            </div>
                          </td>

                          <td className="border-b border-gray-100/80 px-3.5 py-3 dark:border-white/5">
                            <div className="flex items-center gap-3">
                              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                                <div
                                  className="h-full rounded-full bg-linear-to-r from-cyan-400 via-sky-500 to-violet-500 transition-all duration-500"
                                  style={{ width: `${width}%` }}
                                />
                              </div>

                              <span className="min-w-10.5 text-right text-[10.5px] font-medium text-slate-500 dark:text-white/50">
                                {maxCount > 0
                                  ? `${Math.round((row.count / maxCount) * 100)}%`
                                  : "0%"}
                              </span>
                            </div>
                          </td>

                          <td className="border-b border-gray-100/80 px-3.5 py-3 text-right dark:border-white/5">
                            <span className="inline-flex min-w-13 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10.5px] font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200">
                              {row.count}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-gray-200/80 px-3.5 py-2.5 dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-white/45">
                  <span>
                    Showing aggregated monthly notifications for{" "}
                    {selectedYears.length === 0
                      ? "all years"
                      : selectedYears.length === 1
                      ? `${selectedYears[0]}`
                      : `${selectedYears.length} selected years`}
                  </span>
                  <span>Total: {totalNotifications}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default Index;