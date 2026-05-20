import React from "react";
import { FiAlertTriangle } from "react-icons/fi";
import type { Device } from "../index";

type Props = {
  open: boolean;
  loading: boolean;
  error: string;
  target: Device | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

const ModalDelete: React.FC<Props> = ({
  open,
  loading,
  error,
  target,
  onClose,
  onConfirm,
}) => {
  if (!open || !target) return null;

  return (
    <div className="absolute inset-0 z-300 flex items-center justify-center bg-slate-900/0 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl dark:bg-[#0B1220]">
        <div className="mx-auto flex h-13 w-13 items-center justify-center rounded-full bg-[#f8dedd] text-[#ff5a3c]">
          <FiAlertTriangle className="text-[22px]" />
        </div>

        <div className="mt-4 text-center">
          <h3 className="text-[17px] font-semibold text-slate-900 dark:text-white">
            Delete Location?
          </h3>
          <p className="mt-2 text-[12px] leading-5 text-slate-500 dark:text-white/50">
            คุณกำลังจะลบ location นี้ออกจากระบบ
          </p>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-left text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/55">
            <p>
              <span className="font-medium text-slate-700 dark:text-white/80">
                Device:
              </span>{" "}
              {target.device_name}
            </p>
            <p>
              <span className="font-medium text-slate-700 dark:text-white/80">
                Building:
              </span>{" "}
              {target.building}
            </p>
            <p>
              <span className="font-medium text-slate-700 dark:text-white/80">
                Floor:
              </span>{" "}
              {target.floor}
            </p>
            <p>
              <span className="font-medium text-slate-700 dark:text-white/80">
                IP:
              </span>{" "}
              {target.ip}
            </p>
            <p>
              <span className="font-medium text-slate-700 dark:text-white/80">
                Detected Time:
              </span>{" "}
              {target.detected_time}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-[14px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-center text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={loading}
            className={[
              "min-w-27.5 rounded-[10px] px-3.5 py-2 text-[12px] font-medium transition",
              "bg-[#f8dedd] text-[#ff5a3c] hover:bg-[#f4d2d1]",
              "disabled:cursor-not-allowed disabled:opacity-60",
            ].join(" ")}
          >
            {loading ? "Deleting..." : "Yes, Delete!"}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={[
              "min-w-27.5 rounded-[10px] px-3.5 py-2 text-[12px] font-medium transition",
              "bg-linear-to-r color-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20",
              "disabled:cursor-not-allowed disabled:opacity-60",
            ].join(" ")}
          >
            No, Keep It.
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalDelete;