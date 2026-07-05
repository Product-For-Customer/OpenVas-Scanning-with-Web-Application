import React from "react";
import { useLanguage } from "../../../contexts/LanguageContext";

type ReportFooterProps = {
  page?: string;
};

const index: React.FC<ReportFooterProps> = ({ page }) => {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-slate-300 pt-2">
      <div className="flex items-center justify-between gap-4 text-[11px] leading-[1.35] text-slate-500">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold uppercase tracking-[0.15em] text-slate-700">
            {t("footer.internalReport")}
          </span>
          <span>•</span>
          <span>{t("footer.networkVulnerabilityAssessment")}</span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 text-right">
          <span>{t("footer.preparedForReview")}</span>
          <span>•</span>
          <span className="font-medium text-slate-700">
            {page || t("capture.pageOfPages", { current: 1, total: 1 })}
          </span>
        </div>
      </div>
    </footer>
  );
};

export default index;