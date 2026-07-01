import React from "react";
import { FiRefreshCw, FiTrash2, FiX, FiAlertTriangle } from "react-icons/fi";
import { type DiagramResponse } from "../../../services/diagram";
import { useStateContext } from "../../../contexts/ProviderContext";
import { useLanguage } from "../../../contexts/LanguageContext";

interface DiagramDeleteModalProps {
  open: boolean;
  data: DiagramResponse | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

const DiagramDeleteModal: React.FC<DiagramDeleteModalProps> = ({
  open,
  data,
  deleting,
  onClose,
  onConfirm,
}) => {
  const { currentColor } = useStateContext();
  const { t } = useLanguage();

  if (!open || !data) return null;

  return (
    <div className="fixed inset-0 z-1200 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={!deleting ? onClose : undefined} />
      <div
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-[#12101f]"
        style={{ boxShadow: `0 24px 64px -12px ${currentColor}30, 0 8px 24px rgba(0,0,0,.18)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/8">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500 text-white"
            >
              <FiTrash2 className="text-[14px]" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-500">
                {t("common.confirmDeleteTitle")}
              </p>
              <h3 className="text-[14px] font-bold text-slate-800 dark:text-white/90">{t("diagramModal.deleteDiagram")}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 disabled:opacity-40 dark:text-white/35 dark:hover:bg-white/8"
          >
            <FiX className="text-[15px]" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          {/* Warning banner */}
          <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/80 px-4 py-3 dark:border-red-500/20 dark:bg-red-500/8">
            <FiAlertTriangle className="mt-0.5 shrink-0 text-[14px] text-red-500" />
            <p className="text-[12px] text-red-700 dark:text-red-300">
              {t("diagramModal.deleteWarning")}
            </p>
          </div>

          {/* Diagram info */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-white/8 dark:bg-white/3">
            <p className="text-[13px] font-semibold text-slate-800 dark:text-white/90 line-clamp-2">
              {data.name || "—"}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-white/45 line-clamp-3">
              {data.description?.trim() ? data.description : t("diagramModal.noDescription")}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-white/8 dark:text-white/55 dark:hover:bg-white/5"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={deleting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
            >
              {deleting ? (
                <>
                  <FiRefreshCw className="animate-spin text-[12px]" />
                  {t("common.deleting")}
                </>
              ) : (
                <>
                  <FiTrash2 className="text-[12px]" />
                  {t("common.delete")}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagramDeleteModal;
