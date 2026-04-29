import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiFileText,
  FiLoader,
} from "react-icons/fi";
import ReportHeader from "./ReportHeader";
import ReportKPI from "./ReportKPI";
import SeveritySnapshot from "./SeveritySnapshot";
import ExecutiveHighlights from "./ExecutiveHighlights";
import TopDeviceRiskReport from "./TopDeviceRiskReport";
import ComparisonReport from "./comparision";
import Section6MonthlyRiskReport from "./monthlyRiskReport";
import Conclusion from "./conclusion";
import ReportFooter from "./ReportFooter";
import {
  ListCriticalForReport,
  ListDeviceRiskForReport,
  ListTaskVulnSummaryForReport,
  type TaskVulnSummaryForReportResponse,
} from "../../services/report";
import type { DeviceRiskForReportDTO } from "../../services/report";

const HeadingClass =
  "mt-1 text-[22px] font-bold leading-[1.25] text-slate-900";

const DescClass =
  "mt-2 max-w-full text-[15.5px] leading-[1.85] text-slate-600";

const PAGE_WIDTH = 1120;
const PAGE_HEIGHT = 1620;

const pageShellClass = "flex h-[1620px] flex-col bg-white text-slate-900";

const noop = () => { };

const HIGHLIGHTS_PAGE_SIZE = 2;
const DEVICE_PAGE_SIZE = 18;

type PdfProps = {
  refreshToken?: number;
  selectedTaskIDs?: string[];
};

type CriticalForReportDTO = {
  task_id: string;
  task_name: string;
  ip: string;
  vulnerability_id: string;
  vulnerability_name: string;
  detected_date: string;
  severity: number;
  cve_list: string;
  summary: string;
  impact: string;
  affected: string;
  insight: string;
  solution: string;
  solution_type: string;
};

type PageDescriptor =
  | {
    key: string;
    type: "overview";
    title: string;
  }
  | {
    key: string;
    type: "highlights";
    title: string;
    pageIndex: number;
    pageSize: number;
    pageNumberInSection: number;
    totalPagesInSection: number;
  }
  | {
    key: string;
    type: "device-risk";
    title: string;
    pageIndex: number;
    pageSize: number;
    pageNumberInSection: number;
    totalPagesInSection: number;
  }
  | {
    key: string;
    type: "comparison-monthly";
    title: string;
  }
  | {
    key: string;
    type: "conclusion";
    title: string;
  };

type ViewportMode = "mobile" | "tablet" | "desktop";

const readTaskIDsFromQuery = (): { mode: "all" | "filtered"; ids: string[] } => {
  if (typeof window === "undefined") {
    return { mode: "all", ids: [] };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const raw = (searchParams.get("task_id") || "").trim();

  if (!raw || raw.toUpperCase() === "ALL") {
    return { mode: "all", ids: [] };
  }

  const ids = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");

  if (ids.length === 0) {
    return { mode: "all", ids: [] };
  }

  return { mode: "filtered", ids };
};

const normalizeTaskIDs = (ids?: string[]): string[] => {
  if (!Array.isArray(ids)) return [];

  return ids
    .map((id) => String(id).trim())
    .filter((id) => id !== "");
};

const getViewportMode = (width: number): ViewportMode => {
  if (width < 640) return "mobile";
  if (width < 1280) return "tablet";
  return "desktop";
};

const buildVisiblePageNumbers = (
  currentPage: number,
  totalPages: number
): Array<number | "ellipsis-left" | "ellipsis-right"> => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-right", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "ellipsis-left",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "ellipsis-left",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis-right",
    totalPages,
  ];
};

const Pdf: React.FC<PdfProps> = ({
  refreshToken = 0,
  selectedTaskIDs = [],
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");

  const [prefetchedSummaryRows, setPrefetchedSummaryRows] = useState<
    TaskVulnSummaryForReportResponse[]
  >([]);
  const [prefetchedHighlights, setPrefetchedHighlights] = useState<
    CriticalForReportDTO[]
  >([]);
  const [prefetchedDevices, setPrefetchedDevices] = useState<
    DeviceRiskForReportDTO[]
  >([]);
  const [prefetchLoading, setPrefetchLoading] = useState<boolean>(true);

  const previewFrameRef = useRef<HTMLDivElement | null>(null);

  const isMountedRef = useRef(false);
  const isPrefetchingRef = useRef(false);
  const lastPrefetchKeyRef = useRef("");

  const normalizedSelectedTaskIDs = useMemo(
    () => normalizeTaskIDs(selectedTaskIDs),
    [selectedTaskIDs]
  );

  const [queryTaskIDs, setQueryTaskIDs] = useState<string[]>([]);
  const [taskMode, setTaskMode] = useState<"all" | "filtered">("all");

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const parsed = readTaskIDsFromQuery();
    setQueryTaskIDs(parsed.ids);
    setTaskMode(parsed.mode);
  }, []);

  const effectiveTaskMode = useMemo<"all" | "filtered">(() => {
    if (normalizedSelectedTaskIDs.length > 0) {
      return "filtered";
    }
    return taskMode;
  }, [normalizedSelectedTaskIDs, taskMode]);

  const effectiveTaskIDs = useMemo<string[]>(() => {
    if (normalizedSelectedTaskIDs.length > 0) {
      return normalizedSelectedTaskIDs;
    }
    return queryTaskIDs;
  }, [normalizedSelectedTaskIDs, queryTaskIDs]);

  const prefetchKey = useMemo(() => {
    return JSON.stringify({
      refreshToken,
      mode: effectiveTaskMode,
      ids: effectiveTaskIDs,
    });
  }, [refreshToken, effectiveTaskMode, effectiveTaskIDs]);

  useEffect(() => {
    const updateScale = () => {
      const el = previewFrameRef.current;
      const windowWidth =
        typeof window !== "undefined" ? window.innerWidth : 1440;

      const nextViewportMode = getViewportMode(windowWidth);
      setViewportMode(nextViewportMode);

      if (!el) return;

      const frameWidth = el.clientWidth;

      let horizontalPadding = 32;
      let minScale = 0.84;
      let maxScale = 1;

      if (nextViewportMode === "tablet") {
        horizontalPadding = 14;
        minScale = 0.56;
        maxScale = 0.92;
      } else if (nextViewportMode === "mobile") {
        horizontalPadding = 10;
        minScale = 0.26;
        maxScale = 0.5;
      }

      const usableWidth = Math.max(frameWidth - horizontalPadding, 260);
      const fittedScale = usableWidth / PAGE_WIDTH;
      const nextScale = Math.min(maxScale, Math.max(minScale, fittedScale));

      setScale(nextScale);
    };

    updateScale();

    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });

    if (previewFrameRef.current) {
      resizeObserver.observe(previewFrameRef.current);
    }

    window.addEventListener("resize", updateScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  const loadPrefetchData = useCallback(async () => {
    if (isPrefetchingRef.current) return;
    if (lastPrefetchKeyRef.current === prefetchKey) return;

    try {
      isPrefetchingRef.current = true;
      lastPrefetchKeyRef.current = prefetchKey;

      if (isMountedRef.current) {
        setPrefetchLoading(true);
      }

      const requestTaskIds =
        effectiveTaskMode === "all" || effectiveTaskIDs.length === 0
          ? undefined
          : effectiveTaskIDs;

      const [summaryResult, criticalResult, deviceResult] = await Promise.all([
        ListTaskVulnSummaryForReport(requestTaskIds),
        ListCriticalForReport(requestTaskIds, 9999),
        ListDeviceRiskForReport(),
      ]);

      if (!isMountedRef.current) return;

      const summaryRows = Array.isArray(summaryResult)
        ? (summaryResult as TaskVulnSummaryForReportResponse[])
        : [];

      const criticalRows = Array.isArray(criticalResult)
        ? (criticalResult as CriticalForReportDTO[])
        : [];

      const allDevices = Array.isArray(deviceResult)
        ? (deviceResult as DeviceRiskForReportDTO[])
        : [];

      const selectedTaskSet = new Set(
        effectiveTaskIDs.map((id) => String(id).trim())
      );

      const filteredDevices =
        effectiveTaskMode === "all" || effectiveTaskIDs.length === 0
          ? allDevices
          : allDevices.filter((item) =>
            selectedTaskSet.has(String(item.task_id).trim())
          );

      setPrefetchedSummaryRows(summaryRows);
      setPrefetchedHighlights(criticalRows);
      setPrefetchedDevices(filteredDevices);
    } catch (error) {
      console.error("Pdf preload data error:", error);

      if (!isMountedRef.current) return;

      setPrefetchedSummaryRows([]);
      setPrefetchedHighlights([]);
      setPrefetchedDevices([]);
      lastPrefetchKeyRef.current = "";
    } finally {
      if (isMountedRef.current) {
        setPrefetchLoading(false);
      }
      isPrefetchingRef.current = false;
    }
  }, [effectiveTaskMode, effectiveTaskIDs, prefetchKey]);

  useEffect(() => {
    void loadPrefetchData();
  }, [loadPrefetchData]);

  const highlightsCount = useMemo(() => {
    return prefetchedHighlights.length;
  }, [prefetchedHighlights]);

  const deviceRiskCount = useMemo(() => {
    return prefetchedDevices.length;
  }, [prefetchedDevices]);

  const highlightPages = useMemo(() => {
    if (highlightsCount <= 0) return 1;
    return Math.max(1, Math.ceil(highlightsCount / HIGHLIGHTS_PAGE_SIZE));
  }, [highlightsCount]);

  const devicePages = useMemo(() => {
    if (deviceRiskCount <= 0) return 1;
    return Math.max(1, Math.ceil(deviceRiskCount / DEVICE_PAGE_SIZE));
  }, [deviceRiskCount]);

  const pageDescriptors = useMemo<PageDescriptor[]>(() => {
    const pages: PageDescriptor[] = [
      {
        key: "overview",
        type: "overview",
        title: "Total Severity & Severity Distribution",
      },
    ];

    for (let i = 0; i < highlightPages; i += 1) {
      pages.push({
        key: `highlights-${i}`,
        type: "highlights",
        title:
          highlightPages > 1
            ? `Critical Highlights (${i + 1}/${highlightPages})`
            : "Critical Highlights",
        pageIndex: i,
        pageSize: HIGHLIGHTS_PAGE_SIZE,
        pageNumberInSection: i + 1,
        totalPagesInSection: highlightPages,
      });
    }

    for (let i = 0; i < devicePages; i += 1) {
      pages.push({
        key: `device-risk-${i}`,
        type: "device-risk",
        title:
          devicePages > 1
            ? `Top Device Risk Report (${i + 1}/${devicePages})`
            : "Top Device Risk Report",
        pageIndex: i,
        pageSize: DEVICE_PAGE_SIZE,
        pageNumberInSection: i + 1,
        totalPagesInSection: devicePages,
      });
    }

    pages.push({
      key: "comparison-monthly",
      type: "comparison-monthly",
      title: "Risk Comparison & Monthly Overview",
    });

    pages.push({
      key: "conclusion",
      type: "conclusion",
      title: "Final Conclusion & Executive Summary",
    });

    return pages;
  }, [highlightPages, devicePages]);

  const totalPages = pageDescriptors.length;

  useEffect(() => {
    setCurrentPage((prev) => {
      if (prev < 1) return 1;
      if (prev > totalPages) return totalPages;
      return prev;
    });
  }, [totalPages]);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const goToPrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const currentDescriptor = pageDescriptors[currentPage - 1];
  const visiblePageNumbers = useMemo(
    () => buildVisiblePageNumbers(currentPage, totalPages),
    [currentPage, totalPages]
  );

  const scaledWidth = PAGE_WIDTH * scale;
  const scaledHeight = PAGE_HEIGHT * scale;

  const renderFooter = (pageNumber: number) => (
    <div className="mt-auto px-8 pt-8 pb-12">
      <ReportFooter page={`Page ${pageNumber} of ${totalPages}`} />
    </div>
  );

  const renderSimpleLoader = () => (
    <div className="flex h-full min-h-405 w-full items-center justify-center bg-white">
      <FiLoader className="animate-spin text-[28px] text-slate-500" />
    </div>
  );

  const renderPage = (pageNumber: number) => {
    const descriptor = pageDescriptors[pageNumber - 1];
    if (!descriptor) return null;

    if (prefetchLoading) {
      return renderSimpleLoader();
    }

    switch (descriptor.type) {
      case "overview":
        return (
          <div className={pageShellClass}>
            <div className="w-full bg-white">
              <ReportHeader refreshToken={refreshToken} />
            </div>

            <main className="flex-1 px-8 pt-6 pb-8">
              <section className="mt-0">
                <div className="mb-3 border-b border-slate-200 pb-2.5">
                  <h1 className={HeadingClass}>Total Severity</h1>
                  <p className={DescClass}>
                    แสดงสรุปผลการสแกนล่าสุด พร้อมจำนวนช่องโหว่ที่พบ
                    แยกตามระดับความรุนแรง
                  </p>
                </div>

                <ReportKPI
                  onReady={noop}
                  selectedTaskIDs={selectedTaskIDs}
                  prefetchedRows={prefetchedSummaryRows}
                  prefetchedLoading={prefetchLoading}
                />
              </section>

              <section className="mt-5">
                <div className="mb-3 border-b border-slate-200 pb-2.5">
                  <h1 className={HeadingClass}>
                    Severity Distribution Overview
                  </h1>
                  <p
                    className={`${DescClass}`}
                  >
                    แสดงจำนวนช่องโหว่ในแต่ละระดับความรุนแรงในรูปแบบกราฟ
                  </p>
                </div>

                <SeveritySnapshot
                  onReady={noop}
                  selectedTaskIDs={selectedTaskIDs}
                  prefetchedRows={prefetchedSummaryRows}
                  prefetchedLoading={prefetchLoading}
                />
              </section>
            </main>

            {renderFooter(pageNumber)}
          </div>
        );

      case "highlights":
        return (
          <div className={pageShellClass}>
            <main className="flex-1 px-8 pt-7 pb-8">
              <section className="mt-0">
                <div className="mb-3 border-b border-slate-200 pb-2.5">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h1 className={HeadingClass}>Critical Highlights</h1>
                      <p
                        className={`${DescClass}`}
                      >
                        สรุปช่องโหว่ระดับวิกฤตที่ควรติดตามก่อน
                        พร้อมผลกระทบ รายละเอียด และแนวทางแก้ไข
                      </p>
                    </div>

                    {descriptor.totalPagesInSection > 1 ? (
                      <div className="shrink-0 text-[10px] font-medium text-slate-500">
                        Page {descriptor.pageNumberInSection} of{" "}
                        {descriptor.totalPagesInSection}
                      </div>
                    ) : null}
                  </div>
                </div>

                <ExecutiveHighlights
                  onReady={noop}
                  selectedTaskIDs={selectedTaskIDs}
                  pageIndex={descriptor.pageIndex}
                  pageSize={descriptor.pageSize}
                  showOuterHeader={true}
                  onDataCountChange={noop}
                  prefetchedRows={prefetchedHighlights}
                  prefetchedLoading={prefetchLoading}
                />
              </section>
            </main>

            {renderFooter(pageNumber)}
          </div>
        );

      case "device-risk":
        return (
          <div className={pageShellClass}>
            <main className="flex-1 px-8 pt-7 pb-8">
              <section className="mt-0">
                <div className="mb-3 border-b border-slate-200 pb-2.5">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h1 className={HeadingClass}>
                        Top Device Risk Report
                      </h1>
                      <p
                        className={`${DescClass}`}
                      >
                        แสดงรายการอุปกรณ์ที่มีความเสี่ยงสูงจากผลการประเมินล่าสุด
                        โดยเรียงลำดับตามค่า Risk Score
                        เพื่อช่วยให้ติดตามอุปกรณ์ที่ควรได้รับการจัดการก่อน
                      </p>
                    </div>

                    {descriptor.totalPagesInSection > 1 ? (
                      <div className="shrink-0 text-[10px] font-medium text-slate-500">
                        Page {descriptor.pageNumberInSection} of{" "}
                        {descriptor.totalPagesInSection}
                      </div>
                    ) : null}
                  </div>
                </div>

                <TopDeviceRiskReport
                  onReady={noop}
                  selectedTaskIDs={selectedTaskIDs}
                  pageIndex={descriptor.pageIndex}
                  pageSize={descriptor.pageSize}
                  showOuterHeader={true}
                  onDataCountChange={noop}
                  prefetchedDevices={prefetchedDevices}
                  prefetchedLoading={prefetchLoading}
                />
              </section>
            </main>

            {renderFooter(pageNumber)}
          </div>
        );

      case "comparison-monthly":
        return (
          <div className={pageShellClass}>
            <main className="flex-1 px-8 pt-7 pb-8">
              <section
                className="mt-0"
                style={{
                  breakInside: "avoid-page",
                  pageBreakInside: "avoid",
                }}
              >
                <div className="mb-3 border-b border-slate-200 pb-2.5">
                  <h1 className={HeadingClass}>
                    Top 10 Risk Score Comparison
                  </h1>
                  <p
                    className={`${DescClass}`}
                  >
                    เปรียบเทียบค่า Latest Risk และ Previous Risk ของแต่ละเป้าหมาย
                    เพื่อให้เห็นแนวโน้มความเสี่ยงล่าสุด
                  </p>
                </div>

                <ComparisonReport
                  onReady={noop}
                  selectedTaskIDs={selectedTaskIDs}
                />
              </section>

              <section
                className="mt-5"
                style={{
                  breakInside: "avoid-page",
                  pageBreakInside: "avoid",
                }}
              >
                <div className="mb-3 border-b border-slate-200 pb-2.5">
                  <h1 className={HeadingClass}>
                    Monthly Risk Score Overview
                  </h1>
                  <p
                    className={`${DescClass}`}
                  >
                    แสดงจำนวนช่องโหว่และค่า Risk Score รายเดือนของปี
                    พร้อมตารางสรุปสำหรับใช้ตรวจสอบรายงาน
                  </p>
                </div>

                <Section6MonthlyRiskReport
                  onReady={noop}
                  selectedTaskIDs={selectedTaskIDs}
                />
              </section>
            </main>

            {renderFooter(pageNumber)}
          </div>
        );

      case "conclusion":
        return (
          <div className={pageShellClass}>
            <main className="flex-1 px-8 pt-7 pb-8">
              <section
                className="mt-0"
                style={{
                  breakInside: "avoid-page",
                  pageBreakInside: "avoid",
                }}
              >
                <div className="mb-3 border-b border-slate-200 pb-2.5">
                  <h1 className={HeadingClass}>
                    Final Conclusion and Executive Summary
                  </h1>
                  <p
                    className={`${DescClass}`}
                  >
                    สรุปภาพรวมรายงานในหน้าเดียว พร้อมตัวเลขสำคัญ ระดับความรุนแรง ความเสี่ยงหลัก และข้อสังเกตเพื่อการตัดสินใจ
                  </p>
                </div>

                <Conclusion onReady={noop} selectedTaskIDs={selectedTaskIDs} />
              </section>
            </main>

            {renderFooter(pageNumber)}
          </div>
        );

      default:
        return null;
    }
  };

  const isMobile = viewportMode === "mobile";
  const isTablet = viewportMode === "tablet";

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900 transition-colors dark:bg-[#07101d] dark:text-white/90">
      <div className="w-full border border-slate-200 bg-white transition-colors dark:border-cyan-400/12 dark:bg-[#08111f] dark:shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_18px_50px_-28px_rgba(0,0,0,0.75)]">
        <div className="mx-auto max-w-420 px-2 py-2 sm:px-4 sm:py-4 md:px-5 lg:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 border border-slate-200 px-3 py-1 text-slate-700 transition-colors dark:border-cyan-400/15 dark:bg-[#0d1628] dark:text-white/80">
                <FiFileText className="text-[13px]" />
                <span className="text-[11px] font-medium">
                  PDF Preview Mode
                </span>
              </div>

              <h1 className="mt-3 text-[16px] font-semibold text-slate-900 dark:text-white/92 sm:text-[20px]">
                Network Vulnerability Assessment Report
              </h1>

              <p className="mt-1 text-[11px] text-slate-500 dark:text-white/50 sm:text-[13px]">
                Preview one page at a time before exporting or downloading.
              </p>
            </div>

            {isMobile ? (
              <div className="flex w-full flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 dark:border-cyan-400/12 dark:bg-[#0d1628]">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={goToPrevPage}
                    disabled={currentPage === 1 || prefetchLoading}
                    className={[
                      "inline-flex h-9 min-w-23 items-center justify-center gap-2 rounded-xl border px-3 text-[12px] font-medium transition",
                      currentPage === 1 || prefetchLoading
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white/30"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-cyan-400/12 dark:bg-[#111a2d] dark:text-white/82 dark:hover:bg-[#162238]",
                    ].join(" ")}
                  >
                    <FiChevronLeft className="text-[14px]" />
                    Prev
                  </button>

                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-center dark:border-cyan-400/12 dark:bg-[#111a2d]">
                    <div className="text-[11px] font-semibold text-slate-800 dark:text-white/85">
                      {prefetchLoading
                        ? "Loading..."
                        : `Page ${currentPage} of ${totalPages}`}
                    </div>
                    <div className="mt-0.5 max-w-full truncate text-[10px] text-slate-500 dark:text-white/45">
                      {prefetchLoading
                        ? "Preparing report..."
                        : currentDescriptor?.title ?? "-"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages || prefetchLoading}
                    className={[
                      "inline-flex h-9 min-w-23 items-center justify-center gap-2 rounded-xl border px-3 text-[12px] font-medium transition",
                      currentPage === totalPages || prefetchLoading
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white/30"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-cyan-400/12 dark:bg-[#111a2d] dark:text-white/82 dark:hover:bg-[#162238]",
                    ].join(" ")}
                  >
                    Next
                    <FiChevronRight className="text-[14px]" />
                  </button>
                </div>

                <div className="text-center text-[10px] text-slate-500 dark:text-white/45">
                  Swipe left or right to preview the full PDF page
                </div>
              </div>
            ) : (
              <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-center lg:justify-between xl:w-auto xl:justify-end">
                <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                  <button
                    type="button"
                    onClick={goToPrevPage}
                    disabled={currentPage === 1 || prefetchLoading}
                    className={[
                      "inline-flex h-9 items-center gap-2 border px-3 text-[12px] font-medium transition",
                      currentPage === 1 || prefetchLoading
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white/30"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-cyan-400/12 dark:bg-[#111a2d] dark:text-white/82 dark:hover:bg-[#162238]",
                    ].join(" ")}
                  >
                    <FiChevronLeft className="text-[14px]" />
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages || prefetchLoading}
                    className={[
                      "inline-flex h-9 items-center gap-2 border px-3 text-[12px] font-medium transition xl:hidden",
                      currentPage === totalPages || prefetchLoading
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white/30"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-cyan-400/12 dark:bg-[#111a2d] dark:text-white/82 dark:hover:bg-[#162238]",
                    ].join(" ")}
                  >
                    Next
                    <FiChevronRight className="text-[14px]" />
                  </button>
                </div>

                <div className="flex w-full items-center gap-2 xl:w-auto">
                  <div className="-mx-0.5 flex-1 overflow-x-auto pb-1 xl:flex-none xl:overflow-visible xl:pb-0">
                    <div className="flex w-max items-center border border-slate-200 bg-white transition-colors dark:border-cyan-400/12 dark:bg-[#111a2d]">
                      {visiblePageNumbers.map((item, index) => {
                        if (
                          item === "ellipsis-left" ||
                          item === "ellipsis-right"
                        ) {
                          return (
                            <div
                              key={`${item}-${index}`}
                              className="inline-flex h-9 min-w-9 items-center justify-center border-r border-slate-200 px-2 text-[12px] font-medium text-slate-400 last:border-r-0 dark:border-cyan-400/12 dark:text-white/35"
                            >
                              ...
                            </div>
                          );
                        }

                        const page = item;
                        const active = page === currentPage;
                        const descriptor = pageDescriptors[page - 1];

                        return (
                          <button
                            key={descriptor?.key ?? page}
                            type="button"
                            onClick={() => goToPage(page)}
                            disabled={prefetchLoading}
                            className={[
                              "inline-flex h-9 min-w-9 items-center justify-center border-r border-slate-200 px-3 text-[12px] font-medium transition last:border-r-0 dark:border-cyan-400/12",
                              prefetchLoading
                                ? "cursor-not-allowed text-slate-400 dark:text-white/30"
                                : active
                                  ? "bg-slate-900 text-white dark:bg-cyan-400 dark:text-slate-950"
                                  : "text-slate-700 hover:bg-slate-50 dark:text-white/78 dark:hover:bg-[#162238]",
                            ].join(" ")}
                            title={descriptor?.title ?? `Page ${page}`}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages || prefetchLoading}
                    className={[
                      "hidden h-9 items-center gap-2 border px-3 text-[12px] font-medium transition xl:inline-flex",
                      currentPage === totalPages || prefetchLoading
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white/30"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-cyan-400/12 dark:bg-[#111a2d] dark:text-white/82 dark:hover:bg-[#162238]",
                    ].join(" ")}
                  >
                    Next
                    <FiChevronRight className="text-[14px]" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {!isMobile && (
            <div className="mt-4 flex flex-col gap-2 border border-slate-200 bg-slate-50 px-3 py-3 text-[12px] text-slate-600 dark:border-cyan-400/12 dark:bg-[#0d1628] dark:text-white/65 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <div className="min-w-0 wrap-break-word">
                <span className="font-semibold text-slate-800 dark:text-white/85">
                  Current:
                </span>{" "}
                {prefetchLoading
                  ? "Preparing report data..."
                  : currentDescriptor?.title ?? "-"}
              </div>

              <div className="shrink-0">
                {prefetchLoading
                  ? "Loading..."
                  : `Page ${currentPage} of ${totalPages}`}
              </div>
            </div>
          )}

          <div
            ref={previewFrameRef}
            className={[
              "mt-4 border border-slate-200 bg-slate-200/70 dark:border-cyan-400/12 dark:bg-[#050b14]",
              isMobile
                ? "overflow-x-auto overflow-y-hidden px-1.5 py-2"
                : isTablet
                  ? "overflow-y-auto overflow-x-hidden px-2 py-3 sm:px-3 sm:py-4"
                  : "overflow-hidden p-4",
            ].join(" ")}
          >
            <div
              className={[
                "flex",
                isMobile ? "justify-start" : "justify-center",
              ].join(" ")}
            >
              <div
                style={{
                  width: scaledWidth,
                  height: scaledHeight,
                  flex: "0 0 auto",
                }}
              >
                <div
                  style={{
                    width: PAGE_WIDTH,
                    height: PAGE_HEIGHT,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                  }}
                >
                  {renderPage(currentPage)}
                </div>
              </div>
            </div>
          </div>

          {isMobile && (
            <div className="mt-3 flex items-center justify-center text-center text-[10px] text-slate-500 dark:text-white/40">
              PDF preview is optimized for horizontal swipe on mobile
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Pdf;