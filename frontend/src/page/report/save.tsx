import React, { useEffect, useMemo, useState } from "react";
import ReportHeader from "./ReportHeader";
import ReportKPI from "./ReportKPI";
import SeveritySnapshot from "./SeveritySnapshot";
import ExecutiveHighlights from "./ExecutiveHighlights";
import TopDeviceRiskReport from "./TopDeviceRiskReport";
import ComparisonReport from "./comparision";
import Section6MonthlyRiskReport from "./monthlyRiskReport";
import Conclusion from "./conclusion";
import ReportFooter from "./ReportFooter";
import { reportInfo } from "../../interface/mock";

const sectionLabelClass =
  "text-[8.5px] font-semibold uppercase tracking-normal text-slate-500";
const sectionHeadingClass =
  "mt-1 text-[16px] font-bold leading-[1.2] text-slate-900";
const sectionDescClass =
  "mt-1.5 max-w-full text-[10.5px] leading-[1.6] text-slate-600";

const pageShellClass = "flex h-[1550px] flex-col bg-white";

const CaptureTest: React.FC = () => {
  const [kpiReady, setKpiReady] = useState(false);
  const [severityReady, setSeverityReady] = useState(false);
  const [executiveReady, setExecutiveReady] = useState(false);
  const [topDeviceReady, setTopDeviceReady] = useState(false);
  const [comparisonReady, setComparisonReady] = useState(false);
  const [section6Ready, setSection6Ready] = useState(false);
  const [conclusionReady, setConclusionReady] = useState(false);
  const [headerRefreshToken, setHeaderRefreshToken] = useState(0);

  useEffect(() => {
    setHeaderRefreshToken(Date.now());
  }, []);

  const reportReady = useMemo(() => {
    return (
      kpiReady &&
      severityReady &&
      executiveReady &&
      topDeviceReady &&
      comparisonReady &&
      section6Ready &&
      conclusionReady
    );
  }, [
    kpiReady,
    severityReady,
    executiveReady,
    topDeviceReady,
    comparisonReady,
    section6Ready,
    conclusionReady,
  ]);

  return (
    <div
      id="capture-root"
      className="w-full bg-white text-slate-900"
      data-report-ready={reportReady ? "true" : "false"}
      data-kpi-ready={kpiReady ? "true" : "false"}
      data-severity-ready={severityReady ? "true" : "false"}
      data-executive-ready={executiveReady ? "true" : "false"}
      data-top-device-ready={topDeviceReady ? "true" : "false"}
      data-comparison-ready={comparisonReady ? "true" : "false"}
      data-section6-ready={section6Ready ? "true" : "false"}
      data-conclusion-ready={conclusionReady ? "true" : "false"}
      style={{
        width: "1060px",
        margin: "0 auto 0 18px",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
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

      {/* PAGE 1 */}
      <div className={pageShellClass}>
        <div className="w-full bg-white">
          <ReportHeader
            refreshToken={headerRefreshToken}
            info={{
              ...reportInfo,
              companyName: "Get on Technology",
            }}
          />
        </div>

        <main className="flex-1 px-7 pt-5 pb-2">
          <section className="mt-0">
            <div className="mb-3 border-b border-slate-200 pb-2.5">
              <p className={sectionLabelClass}>Section 1</p>

              <h2 className={sectionHeadingClass}>Total Severity</h2>

              <p className={sectionDescClass}>
                สรุปภาพรวมผลการสแกนล่าสุด โดยแสดงตัวชี้วัดสำคัญของการประเมิน
                พร้อมจำนวนช่องโหว่ในแต่ละระดับความรุนแรง
              </p>
            </div>

            <ReportKPI onReady={setKpiReady} />
          </section>

          <section className="mt-4">
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

            <SeveritySnapshot onReady={setSeverityReady} />
          </section>
        </main>

        <div className="mt-auto px-7 pb-0">
          <ReportFooter page="Page 1 of 4" />
        </div>
      </div>

      {/* PAGE 2 */}
      <div
        className={pageShellClass}
        style={{
          pageBreakBefore: "always",
          breakBefore: "page",
        }}
      >
        <main className="flex-1 px-7 pt-6 pb-2">
          <section className="mt-0">
            <div className="mb-3 border-b border-slate-200 pb-2.5">
              <p className={sectionLabelClass}>Section 3</p>

              <h2 className={sectionHeadingClass}>Criticals Highlights</h2>

              <p className={sectionDescClass}>
                สรุปประเด็นสำคัญของช่องโหว่ระดับวิกฤตที่ควรได้รับการติดตามก่อน
                โดยแสดงชื่อช่องโหว่ , ผลกระทบ , รายละเอียด
                และข้อมูลเชิงลึกรวมถึงวิธีการแก้ไขเพื่อใช้ประกอบการตัดสินใจ
              </p>
            </div>

            <ExecutiveHighlights onReady={setExecutiveReady} />
          </section>

          <section
            className="mt-4"
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

            <TopDeviceRiskReport onReady={setTopDeviceReady} />
          </section>
        </main>

        <div className="mt-auto px-7 pb-0">
          <ReportFooter page="Page 2 of 4" />
        </div>
      </div>

      {/* PAGE 3 */}
      <div
        className={pageShellClass}
        style={{
          pageBreakBefore: "always",
          breakBefore: "page",
        }}
      >
        <main className="flex-1 px-7 pt-6 pb-2">
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

            <ComparisonReport onReady={setComparisonReady} />
          </section>

          <section
            className="mt-4"
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
                This section presents mock monthly vulnerability counts and risk
                scores for the current year, together with a compact summary
                table for report review.
              </p>
            </div>

            <Section6MonthlyRiskReport onReady={setSection6Ready} />
          </section>
        </main>

        <div className="mt-auto px-7 pb-0">
          <ReportFooter page="Page 3 of 4" />
        </div>
      </div>

      {/* PAGE 4 */}
      <div
        className={pageShellClass}
        style={{
          pageBreakBefore: "always",
          breakBefore: "page",
        }}
      >
        <main className="flex-1 px-7 pt-6 pb-2">
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

            <Conclusion onReady={setConclusionReady} />
          </section>
        </main>

        <div className="mt-auto px-7 pb-0">
          <ReportFooter page="Page 4 of 4" />
        </div>
      </div>
    </div>
  );
};

export default CaptureTest;