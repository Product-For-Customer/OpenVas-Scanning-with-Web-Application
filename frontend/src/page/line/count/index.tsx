import React, { useEffect, useMemo, useState } from "react";
import {
  FiBarChart2,
  FiCalendar,
  FiRefreshCw,
  FiAlertCircle,
  FiChevronDown,
} from "react-icons/fi";
import {
  ListHistoryNotify,
  type HistoryNotifyResponse,
} from "../../../services";

type MonthRow = {
  key: number;
  monthShort: string;
  monthFull: string;
  count: number;
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
  selectedYear: number
): MonthRow[] => {
  const counts = Array(12).fill(0);

  items.forEach((item) => {
    const date = parseDate(item.datetime || item.created_at);
    if (!date) return;

    if (date.getFullYear() === selectedYear) {
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

const Index: React.FC = () => {
  const [items, setItems] = useState<HistoryNotifyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [openYearSelect, setOpenYearSelect] = useState(false);

  const fetchHistoryNotify = async (showRefresh = false) => {
    try {
      setError("");

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const res = await ListHistoryNotify();

      if (!res || !Array.isArray(res)) {
        setItems([]);
        setError("โหลดข้อมูล History Notify ไม่สำเร็จ");
        return;
      }

      setItems(res);

      const years = res
        .map((item) => parseDate(item.datetime || item.created_at))
        .filter((d): d is Date => d instanceof Date)
        .map((d) => d.getFullYear());

      if (years.length > 0) {
        setSelectedYear(Math.max(...years));
      } else {
        setSelectedYear(currentYear);
      }
    } catch (err) {
      console.error("fetchHistoryNotify error:", err);
      setItems([]);
      setError("เกิดข้อผิดพลาดระหว่างโหลดข้อมูล");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistoryNotify();
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

  const chartData = useMemo(() => {
    return buildYearData(items, selectedYear);
  }, [items, selectedYear]);

  const totalNotifications = useMemo(() => {
    return chartData.reduce((sum, row) => sum + row.count, 0);
  }, [chartData]);

  const maxCount = useMemo(() => {
    return Math.max(...chartData.map((row) => row.count), 0);
  }, [chartData]);

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
              จำนวนรายการแจ้งเตือนในแต่ละเดือนของปีที่เลือก
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenYearSelect((prev) => !prev)}
                className={[
                  "h-8.5 px-3.5 rounded-2xl inline-flex items-center gap-2 transition",
                  "bg-white border border-gray-200/80 text-[12px] font-medium text-gray-700 hover:bg-gray-50",
                  "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/8",
                ].join(" ")}
              >
                <FiCalendar className="text-[12px]" />
                {selectedYear}
                <FiChevronDown
                  className={`text-[12px] text-gray-400 transition dark:text-white/45 ${
                    openYearSelect ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openYearSelect && (
                <div className="absolute right-0 z-20 mt-2 w-32 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none">
                  {availableYears.map((year) => (
                    <button
                      key={year}
                      type="button"
                      onClick={() => {
                        setSelectedYear(year);
                        setOpenYearSelect(false);
                      }}
                      className={[
                        "w-full px-3 py-2 text-left text-[11.5px] transition",
                        selectedYear === year
                          ? "bg-violet-50 text-violet-700 font-semibold dark:bg-violet-500/10 dark:text-violet-200"
                          : "text-gray-700 hover:bg-gray-50 dark:text-white/70 dark:hover:bg-white/8",
                      ].join(" ")}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => fetchHistoryNotify(true)}
              disabled={refreshing}
              className={[
                "inline-flex h-8.5 w-8.5 items-center justify-center rounded-xl transition",
                "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50",
                "disabled:cursor-not-allowed disabled:opacity-60",
                "dark:bg-white/5 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/8",
              ].join(" ")}
              title="Refresh"
            >
              <FiRefreshCw
                className={`text-[12px] ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
            Year:
            <span className="ml-1 font-semibold text-slate-900 dark:text-white">
              {selectedYear}
            </span>
          </div>

          <div className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-medium text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200">
            Total Notifications:
            <span className="ml-1 font-semibold">{totalNotifications}</span>
          </div>

          <div className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-medium text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-200">
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
                      <th className="px-3.5 py-3 text-[10.5px] font-semibold text-slate-600 dark:text-white/60 border-b border-gray-200/80 dark:border-white/10">
                        Month
                      </th>
                      <th className="px-3.5 py-3 text-[10.5px] font-semibold text-slate-600 dark:text-white/60 border-b border-gray-200/80 dark:border-white/10">
                        Monthly Overview
                      </th>
                      <th className="px-3.5 py-3 text-[10.5px] font-semibold text-slate-600 dark:text-white/60 border-b border-gray-200/80 dark:border-white/10 text-right">
                        Count
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {chartData.map((row, index) => (
                      <tr
                        key={row.key}
                        className="transition-colors hover:bg-cyan-50/30 dark:hover:bg-white/3"
                      >
                        <td
                          className={`px-3.5 py-3 ${
                            index !== chartData.length - 1
                              ? "border-b border-gray-100 dark:border-white/10"
                              : ""
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-[11.5px] font-semibold text-slate-800 dark:text-white/85">
                              {row.monthShort}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-500 dark:text-white/45">
                              {row.monthFull}
                            </p>
                          </div>
                        </td>

                        <td
                          className={`px-3.5 py-3 ${
                            index !== chartData.length - 1
                              ? "border-b border-gray-100 dark:border-white/10"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                              <div
                                className="h-full rounded-full bg-linear-to-r from-cyan-500 to-violet-500 transition-all duration-300"
                                style={{
                                  width: `${getBarWidthPercent(
                                    row.count,
                                    maxCount
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        <td
                          className={`px-3.5 py-3 text-right ${
                            index !== chartData.length - 1
                              ? "border-b border-gray-100 dark:border-white/10"
                              : ""
                          }`}
                        >
                          <span className="inline-flex min-w-10.5 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10.5px] font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200">
                            {row.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-gray-200/80 px-3.5 py-3 dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-slate-500 dark:text-white/50">
                  <span>
                    Monthly summary for year{" "}
                    <span className="font-semibold text-slate-700 dark:text-white/80">
                      {selectedYear}
                    </span>
                  </span>

                  <span>
                    Highest month count:{" "}
                    <span className="font-semibold text-slate-700 dark:text-white/80">
                      {maxCount}
                    </span>
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {openYearSelect && (
        <button
          type="button"
          onClick={() => setOpenYearSelect(false)}
          className="fixed inset-0 z-5 cursor-default"
          aria-label="Close year select overlay"
        />
      )}
    </section>
  );
};

export default Index;