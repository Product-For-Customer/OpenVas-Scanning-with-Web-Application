import React, { useEffect, useMemo, useState } from "react";
import fallbackLogo from "../../../assets/getonlogo.jpg";
import {
  ListAppReport,
  type AppReportResponse,
} from "../../../services/report";

type ReportInfo = {
  title: string;
  subtitle?: string;
  dateRange?: string;
  generatedAt?: string;
  classification?: string;
  version?: string;
  companyName?: string;
  logo?: string;
};

type ReportHeaderProps = {
  info?: ReportInfo;
  refreshToken?: number;
};

const metaLabelClass =
  "text-[10.5px] font-semibold uppercase tracking-normal text-slate-500";

const metaValueClass =
  "mt-1 text-[13px] font-medium leading-[1.6] text-slate-800";

const formatEnglishDate = (date: Date): string => {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

const defaultInfo: ReportInfo = {
  title: "Network Vulnerability Assessment Report",
  subtitle:
    "Executive summary of scan coverage, severity distribution, and priority findings from the latest assessment.",
  classification: "Internal Report",
  version: "Version 1.0",
};

const ReportHeader: React.FC<ReportHeaderProps> = ({
  info = defaultInfo,
  refreshToken = 0,
}) => {
  const [appReport, setAppReport] = useState<AppReportResponse | null>(null);

  const generatedDate = useMemo(() => formatEnglishDate(new Date()), []);

  useEffect(() => {
    let mounted = true;

    const fetchAppReport = async () => {
      try {
        const data = await ListAppReport();

        if (!mounted) return;

        if (data && !data.error) {
          setAppReport(data);
        } else {
          setAppReport(null);
        }
      } catch (error) {
        console.error("ListAppReport in ReportHeader error:", error);
        if (mounted) {
          setAppReport(null);
        }
      }
    };

    fetchAppReport();

    return () => {
      mounted = false;
    };
  }, [refreshToken]);

  const companyName =
    appReport?.company_name?.trim() ||
    info.companyName?.trim() ||
    "Get on Technology";

  const logoSrc =
    appReport?.logo?.trim() || info.logo?.trim() || fallbackLogo;

  return (
    <header className="w-full border-b-[3px] border-slate-900 bg-white">
      <div className="px-8 py-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center border border-slate-900 bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-normal text-white">
                Network Security Report
              </span>

              {info.classification ? (
                <span className="inline-flex items-center border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-normal text-slate-700">
                  {info.classification}
                </span>
              ) : null}
            </div>

            <h1 className="mt-3 text-[25px] font-bold leading-tight text-slate-950">
              {info.title || defaultInfo.title}
            </h1>

            {info.subtitle ? (
              <p className="mt-2 max-w-190 text-[13.5px] leading-[1.75] text-slate-600">
                {info.subtitle}
              </p>
            ) : null}
          </div>

          <div className="flex w-45 shrink-0 items-start justify-end pt-1">
            <img
              src={logoSrc}
              alt="Security Report Logo"
              className="h-26 w-auto object-contain"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== fallbackLogo) {
                  target.src = fallbackLogo;
                }
              }}
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-200 pt-3">
          <div>
            <p className={metaLabelClass}>Generated At</p>
            <p className={metaValueClass}>{generatedDate}</p>
          </div>

          <div className="text-right">
            <p className={metaLabelClass}>Prepared By</p>
            <p className={metaValueClass}>{companyName}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default ReportHeader;