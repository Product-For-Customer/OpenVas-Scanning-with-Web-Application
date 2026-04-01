import React, { useEffect, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiFileText } from "react-icons/fi";
import ReportHeader from "./ReportHeader";
import ReportKPI from "./ReportKPI";
import SeveritySnapshot from "./SeveritySnapshot";
import ExecutiveHighlights from "./ExecutiveHighlights";
import TopDeviceRiskReport from "./TopDeviceRiskReport";
import ComparisonReport from "./comparision";
import Section6MonthlyRiskReport from "./monthlyRiskReport";
import Conclusion from "./conclusion";
import ReportFooter from "./ReportFooter";

const sectionLabelClass =
  "text-[8.5px] font-semibold uppercase tracking-normal text-slate-500";
const sectionHeadingClass =
  "mt-1 text-[16px] font-bold leading-[1.2] text-slate-900";
const sectionDescClass =
  "mt-1.5 max-w-full text-[10.5px] leading-[1.6] text-slate-600";

const PAGE_WIDTH = 1120;
const PAGE_HEIGHT = 1620;
const TOTAL_PAGES = 4;

const pageShellClass = "flex h-[1620px] flex-col bg-white text-slate-900";

const PAGE_META = [
  { page: 1, title: "Total Severity & Severity Distribution" },
  { page: 2, title: "Critical Highlights & Top Device Risk" },
  { page: 3, title: "Risk Comparison & Monthly Overview" },
  { page: 4, title: "Final Conclusion & Executive Summary" },
];

const noop = () => {};

type PdfProps = {
  refreshToken?: number;
};

const Pdf: React.FC<PdfProps> = ({ refreshToken = 0 }) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateScale = () => {
      const el = previewFrameRef.current;
      if (!el) return;

      const frameWidth = el.clientWidth;
      const nextScale = Math.min(
        1,
        Math.max(0.35, (frameWidth - 32) / PAGE_WIDTH)
      );
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

  const goToPage = (page: number) => {
    if (page < 1 || page > TOTAL_PAGES) return;
    setCurrentPage(page);
  };

  const goToPrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(TOTAL_PAGES, prev + 1));
  };

  const renderPage = (pageNumber: number) => {
    switch (pageNumber) {
      case 1:
        return (
          <div className={pageShellClass} >
            <div className="w-full bg-white">
              <ReportHeader refreshToken={refreshToken} />
            </div>

            <main className="flex-1 px-8 pt-6 pb-8">
              <section className="mt-0">
                <div className="mb-3 border-b border-slate-200 pb-2.5">
                  <p className={sectionLabelClass}>Section 1</p>
                  <h2 className={sectionHeadingClass}>Total Severity</h2>
                  <p className={sectionDescClass}>
                    สรุปภาพรวมผลการสแกนล่าสุด โดยแสดงตัวชี้วัดสำคัญของการประเมิน
                    พร้อมจำนวนช่องโหว่ในแต่ละระดับความรุนแรง
                  </p>
                </div>

                <ReportKPI onReady={noop} />
              </section>

              <section className="mt-5">
                <div className="mb-3 border-b border-slate-200 pb-2.5">
                  <p className={sectionLabelClass}>Section 2</p>
                  <h2 className={sectionHeadingClass}>
                    Severity Distribution Overview
                  </h2>
                  <p className={sectionDescClass}>
                    แสดงภาพรวมการกระจายของช่องโหว่ตามระดับความรุนแรงในรูปแบบย่อ
                    เพื่อให้เหมาะกับการจัดวางในรายงาน PDF แบบหน้าเดียว
                  </p>
                </div>

                <SeveritySnapshot onReady={noop} />
              </section>
            </main>

            <div className="mt-auto px-8 pt-8 pb-12">
              <ReportFooter page="Page 1 of 4" />
            </div>
          </div>
        );

      case 2:
        return (
          <div className={pageShellClass}>
            <main className="flex-1 px-8 pt-7 pb-8">
              <section className="mt-0">
                <div className="mb-3 border-b border-slate-200 pb-2.5">
                  <p className={sectionLabelClass}>Section 3</p>
                  <h2 className={sectionHeadingClass}>Critical Highlights</h2>
                  <p className={sectionDescClass}>
                    สรุปประเด็นสำคัญของช่องโหว่ระดับวิกฤตที่ควรได้รับการติดตามก่อน
                    โดยแสดงชื่อช่องโหว่ , ผลกระทบ , รายละเอียด
                    และข้อมูลเชิงลึกรวมถึงวิธีการแก้ไขเพื่อใช้ประกอบการตัดสินใจ
                  </p>
                </div>

                <ExecutiveHighlights onReady={noop} />
              </section>

              <section
                className="mt-5"
                style={{
                  breakInside: "avoid-page",
                  pageBreakInside: "avoid",
                }}
              >
                <div className="mb-3 border-b border-slate-200 pb-2.5">
                  <p className={sectionLabelClass}>Section 4</p>
                  <h2 className={sectionHeadingClass}>Top Device Risk Report</h2>
                  <p className={sectionDescClass}>
                    แสดงรายการอุปกรณ์ที่มีความเสี่ยงสูงจากผลการประเมินล่าสุด
                    โดยเรียงลำดับตามค่า Risk Score
                    เพื่อช่วยให้ติดตามอุปกรณ์ที่ควรได้รับการจัดการก่อน
                    ในรูปแบบที่เหมาะกับการอ่านบนรายงาน PDF
                  </p>
                </div>

                <TopDeviceRiskReport onReady={noop} />
              </section>
            </main>

            <div className="mt-auto px-8 pt-8 pb-12">
              <ReportFooter page="Page 2 of 4" />
            </div>
          </div>
        );

      case 3:
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
                  <p className={sectionLabelClass}>Section 5</p>
                  <h2 className={sectionHeadingClass}>Risk Score Comparison</h2>
                  <p className={sectionDescClass}>
                    เปรียบเทียบค่า Latest Risk และ Previous Risk ของแต่ละเป้าหมาย
                    เพื่อให้เห็นแนวโน้มความเสี่ยงล่าสุด
                  </p>
                </div>

                <ComparisonReport onReady={noop} />
              </section>

              <section
                className="mt-5"
                style={{
                  breakInside: "avoid-page",
                  pageBreakInside: "avoid",
                }}
              >
                <div className="mb-3 border-b border-slate-200 pb-2.5">
                  <p className={sectionLabelClass}>Section 6</p>
                  <h2 className={sectionHeadingClass}>
                    Monthly Risk Score Overview
                  </h2>
                  <p className={sectionDescClass}>
                    This section presents mock monthly vulnerability counts and
                    risk scores for the current year, together with a compact
                    summary table for report review.
                  </p>
                </div>

                <Section6MonthlyRiskReport onReady={noop} />
              </section>
            </main>

            <div className="mt-auto px-8 pt-8 pb-12">
              <ReportFooter page="Page 3 of 4" />
            </div>
          </div>
        );

      case 4:
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
                  <p className={sectionLabelClass}>Section 7</p>
                  <h2 className={sectionHeadingClass}>
                    Final Conclusion and Executive Summary
                  </h2>
                  <p className={sectionDescClass}>
                    สรุปภาพรวมของรายงานทั้งหมดในหน้าเดียว
                    โดยรวบรวมตัวเลขสำคัญ การกระจายความรุนแรง
                    ความเสี่ยงของเป้าหมายหลัก และข้อสังเกตสำหรับการตัดสินใจเชิงปฏิบัติการ
                  </p>
                </div>

                <Conclusion onReady={noop} />
              </section>
            </main>

            <div className="mt-auto px-8 pt-8 pb-12">
              <ReportFooter page="Page 4 of 4" />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const currentMeta =
    PAGE_META.find((item) => item.page === currentPage) ?? PAGE_META[0];

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900 transition-colors dark:bg-[#07101d] dark:text-white/90">
      <div className="w-full border border-slate-200 bg-white transition-colors dark:border-cyan-400/12 dark:bg-[#08111f] dark:shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_18px_50px_-28px_rgba(0,0,0,0.75)]">
        <div className="mx-auto max-w-360 px-4 py-4 md:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 border border-slate-200 px-3 py-1 text-slate-700 transition-colors dark:border-cyan-400/15 dark:bg-[#0d1628] dark:text-white/80">
                <FiFileText className="text-[13px]" />
                <span className="text-[11px] font-medium">PDF Preview Mode</span>
              </div>

              <h1 className="mt-3 text-[18px] font-semibold text-slate-900 dark:text-white/92">
                Network Vulnerability Assessment Report
              </h1>

              <p className="mt-1 text-[12px] text-slate-500 dark:text-white/50">
                Preview one page at a time before exporting or downloading.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                className={[
                  "inline-flex h-9 items-center gap-2 border px-3 text-[12px] font-medium transition",
                  currentPage === 1
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white/30"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-cyan-400/12 dark:bg-[#111a2d] dark:text-white/82 dark:hover:bg-[#162238]",
                ].join(" ")}
              >
                <FiChevronLeft className="text-[14px]" />
                Previous
              </button>

              <div className="flex items-center border border-slate-200 bg-white transition-colors dark:border-cyan-400/12 dark:bg-[#111a2d]">
                {PAGE_META.map((item) => {
                  const active = item.page === currentPage;

                  return (
                    <button
                      key={item.page}
                      type="button"
                      onClick={() => goToPage(item.page)}
                      className={[
                        "inline-flex h-9 min-w-9 items-center justify-center border-r border-slate-200 px-3 text-[12px] font-medium transition last:border-r-0 dark:border-cyan-400/12",
                        active
                          ? "bg-slate-900 text-white dark:bg-cyan-600 dark:text-white"
                          : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-[#111a2d] dark:text-white/78 dark:hover:bg-[#162238]",
                      ].join(" ")}
                    >
                      {item.page}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={goToNextPage}
                disabled={currentPage === TOTAL_PAGES}
                className={[
                  "inline-flex h-9 items-center gap-2 border px-3 text-[12px] font-medium transition",
                  currentPage === TOTAL_PAGES
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white/30"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-cyan-400/12 dark:bg-[#111a2d] dark:text-white/82 dark:hover:bg-[#162238]",
                ].join(" ")}
              >
                Next
                <FiChevronRight className="text-[14px]" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-1 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-cyan-400/10">
            <div>
              <p className="text-[13px] font-semibold text-slate-800 dark:text-white/86">
                Page {currentPage} of {TOTAL_PAGES}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/50">
                {currentMeta.title}
              </p>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-white/50">
              Preview scale: {Math.round(scale * 100)}%
            </div>
          </div>
        </div>
      </div>

      <div
        ref={previewFrameRef}
        className="mt-4 w-full overflow-auto border border-slate-200 bg-white px-3 py-4 transition-colors md:px-6 md:py-6 dark:border-cyan-400/10 dark:bg-[#0b1424] dark:shadow-[0_0_0_1px_rgba(34,211,238,0.04),inset_0_1px_0_rgba(255,255,255,0.02)]"
      >
        <div className="flex justify-center">
          <div
            className="relative"
            style={{
              width: PAGE_WIDTH * scale,
              height: PAGE_HEIGHT * scale,
            }}
          >
            <div
              className="absolute left-0 top-0 border border-slate-300 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)] dark:border-slate-500/30 dark:shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
              style={{
                width: PAGE_WIDTH,
                minHeight: PAGE_HEIGHT,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                colorScheme: "light",
              }}
            >
              {renderPage(currentPage)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pdf;