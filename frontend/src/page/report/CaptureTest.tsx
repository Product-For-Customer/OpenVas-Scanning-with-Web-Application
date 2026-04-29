import React, { useEffect, useMemo, useRef, useState } from "react";
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
const PAGE_HEIGHT = 1604;

const HIGHLIGHTS_PAGE_SIZE = 2;
const DEVICE_PAGE_SIZE = 18;

type CaptureTestProps = {
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

const CaptureTest: React.FC<CaptureTestProps> = ({
  refreshToken = 0,
  selectedTaskIDs = [],
}) => {
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

  const [queryTaskIDs, setQueryTaskIDs] = useState<string[]>([]);
  const [taskMode, setTaskMode] = useState<"all" | "filtered">("all");

  const [kpiReady, setKpiReady] = useState(false);
  const [severityReady, setSeverityReady] = useState(false);
  const [comparisonReady, setComparisonReady] = useState(false);
  const [monthlyReady, setMonthlyReady] = useState(false);
  const [conclusionReady, setConclusionReady] = useState(false);

  const [domSettled, setDomSettled] = useState(false);
  const settleTimerRef = useRef<number | null>(null);

  const normalizedSelectedTaskIDs = useMemo(
    () => normalizeTaskIDs(selectedTaskIDs),
    [selectedTaskIDs]
  );

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

  useEffect(() => {
    setKpiReady(false);
    setSeverityReady(false);
    setComparisonReady(false);
    setMonthlyReady(false);
    setConclusionReady(false);
    setDomSettled(false);
  }, [refreshToken, effectiveTaskMode, effectiveTaskIDs]);

  useEffect(() => {
    let alive = true;

    const preloadData = async () => {
      try {
        setPrefetchLoading(true);

        const requestTaskIds =
          effectiveTaskMode === "all" || effectiveTaskIDs.length === 0
            ? undefined
            : effectiveTaskIDs;

        const [summaryResult, criticalResult, deviceResult] = await Promise.all([
          ListTaskVulnSummaryForReport(requestTaskIds),
          ListCriticalForReport(requestTaskIds, 9999),
          ListDeviceRiskForReport(),
        ]);

        if (!alive) return;

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
        console.error("CaptureTest preload data error:", error);
        if (!alive) return;
        setPrefetchedSummaryRows([]);
        setPrefetchedHighlights([]);
        setPrefetchedDevices([]);
      } finally {
        if (!alive) return;
        setPrefetchLoading(false);
      }
    };

    preloadData();

    return () => {
      alive = false;
    };
  }, [effectiveTaskMode, effectiveTaskIDs, refreshToken]);

  const highlightPages = useMemo(() => {
    const total = prefetchedHighlights.length;
    if (total <= 0) return 1;
    return Math.max(1, Math.ceil(total / HIGHLIGHTS_PAGE_SIZE));
  }, [prefetchedHighlights]);

  const devicePages = useMemo(() => {
    const total = prefetchedDevices.length;
    if (total <= 0) return 1;
    return Math.max(1, Math.ceil(total / DEVICE_PAGE_SIZE));
  }, [prefetchedDevices]);

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
    setDomSettled(false);

    if (settleTimerRef.current) {
      window.clearTimeout(settleTimerRef.current);
    }

    if (prefetchLoading) {
      return;
    }

    settleTimerRef.current = window.setTimeout(() => {
      setDomSettled(true);
    }, 500);

    return () => {
      if (settleTimerRef.current) {
        window.clearTimeout(settleTimerRef.current);
      }
    };
  }, [
    prefetchLoading,
    totalPages,
    highlightPages,
    devicePages,
    prefetchedSummaryRows,
    prefetchedHighlights,
    prefetchedDevices,
  ]);

  const reportReady = useMemo(() => {
    return (
      !prefetchLoading &&
      domSettled &&
      kpiReady &&
      severityReady &&
      comparisonReady &&
      monthlyReady &&
      conclusionReady
    );
  }, [
    prefetchLoading,
    domSettled,
    kpiReady,
    severityReady,
    comparisonReady,
    monthlyReady,
    conclusionReady,
  ]);

  const basePageStyle: React.CSSProperties = {
    position: "relative",
    display: "block",
    width: `${PAGE_WIDTH}px`,
    height: `${PAGE_HEIGHT}px`,
    overflow: "hidden",
    background: "#ffffff",
    color: "#0f172a",
    boxSizing: "border-box",
    margin: 0,
    padding: 0,
  };

  const renderFooter = (pageNumber: number) => (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        background: "#ffffff",
        padding: "20px 32px 24px 32px",
        boxSizing: "border-box",
      }}
    >
      <ReportFooter page={`Page ${pageNumber} of ${totalPages}`} />
    </div>
  );

  const renderSimpleLoader = () => (
    <div className="flex h-full w-full items-center justify-center bg-white">
      <div className="text-[12px] text-slate-500">Preparing report data...</div>
    </div>
  );

  const renderOverviewPage = (pageNumber: number): React.ReactElement => {
    return (
      <div
        key="overview"
        data-page-number={pageNumber}
        data-page-type="overview"
        className="capture-page"
        style={basePageStyle}
      >
        <div className="w-full bg-white">
          <ReportHeader refreshToken={refreshToken} />
        </div>

        <main className="px-8 pt-6 pb-24">
          <section className="mt-0">
            <div className="mb-3 border-b border-slate-200 pb-2.5">
              <h1 className={HeadingClass}>Total Severity</h1>
              <p className={DescClass}>
                แสดงสรุปผลการสแกนล่าสุด พร้อมจำนวนช่องโหว่ที่พบ
                แยกตามระดับความรุนแรง
              </p>
            </div>

            <ReportKPI
              onReady={setKpiReady}
              selectedTaskIDs={effectiveTaskIDs}
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
              onReady={setSeverityReady}
              selectedTaskIDs={effectiveTaskIDs}
              prefetchedRows={prefetchedSummaryRows}
              prefetchedLoading={prefetchLoading}
            />
          </section>
        </main>

        {renderFooter(pageNumber)}
      </div>
    );
  };

  const renderHighlightsPage = (
    descriptor: Extract<PageDescriptor, { type: "highlights" }>,
    pageNumber: number
  ): React.ReactElement => {
    return (
      <div
        key={descriptor.key}
        data-page-number={pageNumber}
        data-page-type="highlights"
        className="capture-page"
        style={basePageStyle}
      >
        <main className="px-8 pt-7 pb-24">
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
              onReady={() => {}}
              selectedTaskIDs={effectiveTaskIDs}
              pageIndex={descriptor.pageIndex}
              pageSize={descriptor.pageSize}
              showOuterHeader={true}
              onDataCountChange={() => {}}
              prefetchedRows={prefetchedHighlights}
              prefetchedLoading={prefetchLoading}
            />
          </section>
        </main>

        {renderFooter(pageNumber)}
      </div>
    );
  };

  const renderDeviceRiskPage = (
    descriptor: Extract<PageDescriptor, { type: "device-risk" }>,
    pageNumber: number
  ): React.ReactElement => {
    return (
      <div
        key={descriptor.key}
        data-page-number={pageNumber}
        data-page-type="device-risk"
        className="capture-page"
        style={basePageStyle}
      >
        <main className="px-8 pt-7 pb-24">
          <section className="mt-0">
            <div className="mb-3 border-b border-slate-200 pb-2.5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h1 className={HeadingClass}>Top Device Risk Report</h1>
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
              onReady={() => {}}
              selectedTaskIDs={effectiveTaskIDs}
              pageIndex={descriptor.pageIndex}
              pageSize={descriptor.pageSize}
              showOuterHeader={true}
              onDataCountChange={() => {}}
              prefetchedDevices={prefetchedDevices}
              prefetchedLoading={prefetchLoading}
            />
          </section>
        </main>

        {renderFooter(pageNumber)}
      </div>
    );
  };

  const renderComparisonMonthlyPage = (
    pageNumber: number
  ): React.ReactElement => {
    return (
      <div
        key="comparison-monthly"
        data-page-number={pageNumber}
        data-page-type="comparison-monthly"
        className="capture-page"
        style={basePageStyle}
      >
        <main className="px-8 pt-7 pb-24">
          <section className="mt-0">
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
              onReady={setComparisonReady}
              selectedTaskIDs={effectiveTaskIDs}
            />
          </section>

          <section className="mt-5">
            <div className="mb-3 border-b border-slate-200 pb-2.5">
              <h2 className={HeadingClass}>
                Monthly Risk Score Overview
              </h2>
              <p
                className={`${DescClass}`}
              >
                แสดงจำนวนช่องโหว่และค่า Risk Score รายเดือนของปีปัจจุบัน
                พร้อมตารางสรุปสำหรับใช้ตรวจสอบรายงาน
              </p>
            </div>

            <Section6MonthlyRiskReport
              onReady={setMonthlyReady}
              selectedTaskIDs={effectiveTaskIDs}
            />
          </section>
        </main>

        {renderFooter(pageNumber)}
      </div>
    );
  };

  const renderConclusionPage = (pageNumber: number): React.ReactElement => {
    return (
      <div
        key="conclusion"
        data-page-number={pageNumber}
        data-page-type="conclusion"
        className="capture-page"
        style={basePageStyle}
      >
        <main className="px-8 pt-7 pb-24">
          <section className="mt-0">
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

            <Conclusion
              onReady={setConclusionReady}
              selectedTaskIDs={effectiveTaskIDs}
            />
          </section>
        </main>

        {renderFooter(pageNumber)}
      </div>
    );
  };

  const renderedPages = useMemo(() => {
    if (prefetchLoading) {
      return [
        <div key="loading" className="capture-page" style={basePageStyle}>
          {renderSimpleLoader()}
        </div>,
      ];
    }

    return pageDescriptors.map((descriptor, index) => {
      const pageNumber = index + 1;

      switch (descriptor.type) {
        case "overview":
          return renderOverviewPage(pageNumber);
        case "highlights":
          return renderHighlightsPage(descriptor, pageNumber);
        case "device-risk":
          return renderDeviceRiskPage(descriptor, pageNumber);
        case "comparison-monthly":
          return renderComparisonMonthlyPage(pageNumber);
        case "conclusion":
          return renderConclusionPage(pageNumber);
        default:
          return null;
      }
    });
  }, [
    prefetchLoading,
    pageDescriptors,
    effectiveTaskIDs,
    prefetchedSummaryRows,
    prefetchedHighlights,
    prefetchedDevices,
    refreshToken,
    totalPages,
  ]);

  return (
    <div
      id="capture-root"
      className="bg-white text-slate-900"
      data-report-ready={reportReady ? "true" : "false"}
      data-prefetch-loading={prefetchLoading ? "true" : "false"}
      data-dom-settled={domSettled ? "true" : "false"}
      data-task-id-mode={effectiveTaskIDs.length > 0 ? "filtered" : "all"}
      data-task-ids={effectiveTaskIDs.join(",")}
      data-total-pages={String(totalPages)}
      style={{
        width: `${PAGE_WIDTH}px`,
        margin: "0 auto",
        position: "relative",
        background: "#ffffff",
      }}
    >
      <style>
        {`
          @page {
            size: A4;
            margin: 0.2in;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          #capture-root {
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          #capture-root > .capture-page {
            margin: 0 !important;
            padding: 0 !important;
          }

          #capture-root > .capture-page:last-child {
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
          }
        `}
      </style>

      {!reportReady && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,255,255,0.01)",
            zIndex: 50,
            pointerEvents: "none",
          }}
        />
      )}

      {renderedPages}
    </div>
  );
};

export default CaptureTest;