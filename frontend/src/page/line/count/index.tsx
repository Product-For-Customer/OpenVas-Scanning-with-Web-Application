import React, { useEffect, useMemo, useState } from "react";
import {
  FiBarChart2,
  FiCalendar,
  FiRefreshCw,
  FiAlertCircle,
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
              Monthly Notifications
            </h2>

            <p className="mt-1 text-[10.5px] text-slate-500 sm:text-[11px] dark:text-white/55">
              จำนวนรายการแจ้งเตือนในแต่ละเดือนของปีที่เลือก
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className={[
                "inline-flex h-8.5 items-center gap-1.5 rounded-xl border px-3",
                "border-gray-200 bg-white text-slate-700",
                "dark:border-white/10 dark:bg-white/5 dark:text-white/80",
              ].join(" ")}
            >
              <FiCalendar className="text-[12px]" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-[11px] outline-none"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
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
            <div className="flex h-full items-center justify-center px-5 py-9 text-center">
              <div>
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200">
                  <FiRefreshCw className="animate-spin text-[16px]" />
                </div>
                <h3 className="mt-3 text-[13px] font-semibold text-slate-900 dark:text-white/85">
                  Loading chart data...
                </h3>
                <p className="mt-1 text-[10.5px] text-slate-500 dark:text-white/55">
                  Please wait while we build the monthly chart.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col p-3 sm:p-3.5">
              <div className="flex-1 space-y-2">
                {chartData.map((row) => {
                  const width = getBarWidthPercent(row.count, maxCount);

                  return (
                    <div
                      key={row.key}
                      className="grid grid-cols-[42px_minmax(0,1fr)_38px] items-center gap-2 sm:grid-cols-[52px_minmax(0,1fr)_42px]"
                    >
                      <div className="flex items-center justify-start">
                        <span className="text-[11px] font-medium text-slate-700 dark:text-white/75">
                          {row.monthShort}
                        </span>
                      </div>

                      <div className="relative">
                        <div
                          className={[
                            "h-7.5 w-full overflow-hidden rounded-xl",
                            "bg-slate-100/90 ring-1 ring-slate-200/80",
                            "dark:bg-white/5 dark:ring-white/10",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "flex h-full items-center justify-end rounded-xl px-2 transition-all duration-500",
                              "bg-[linear-gradient(90deg,#6aa0e8_0%,#5b97e5_100%)]",
                              row.count === 0 ? "opacity-0" : "opacity-100",
                            ].join(" ")}
                            style={{
                              width: `${width}%`,
                              minWidth: row.count > 0 ? "34px" : "0px",
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <span
                          className={[
                            "inline-flex min-w-8 items-center justify-center rounded-lg px-2 py-1 text-[10px] font-semibold",
                            row.count > 0
                              ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-200"
                              : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-white/45",
                          ].join(" ")}
                        >
                          {row.count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[10.5px] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                <div className="flex items-start gap-2">
                  <FiAlertCircle className="mt-0.5 shrink-0 text-[12px]" />
                  <span>
                    กราฟนี้จะแสดงครบ 12 เดือนตั้งแต่ Jan ถึง Dec เสมอ
                    แม้บางเดือนจะไม่มีข้อมูลก็ยังแสดงเป็น 0
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Index;