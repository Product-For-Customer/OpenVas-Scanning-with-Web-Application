import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FiShieldOff, FiX, FiSave, FiAlertTriangle } from "react-icons/fi";
import { message } from "antd";
import {
  CreateRole,
  UpdateRole,
  type PermissionCategory,
  type RoleDetail,
  type PermissionInput,
} from "../services/role";
import { useStateContext } from "../contexts/ProviderContext";
import { useLanguage } from "../contexts/LanguageContext";
import type { TranslationKey } from "../locales";

const CATEGORY_LABEL_KEY: Record<string, TranslationKey> = {
  dashboard: "roleMgmt.category.dashboard",
  scan_management: "roleMgmt.category.scan_management",
  threat_intel: "roleMgmt.category.threat_intel",
  risk_scoring: "roleMgmt.category.risk_scoring",
  reports_diagrams: "roleMgmt.category.reports_diagrams",
  user_management: "roleMgmt.category.user_management",
  line_settings: "roleMgmt.category.line_settings",
  audit_log: "roleMgmt.category.audit_log",
};

type PermState = Record<string, { view: boolean; manage: boolean }>;

const emptyPermState = (categories: PermissionCategory[]): PermState => {
  const state: PermState = {};
  for (const c of categories) state[c.key] = { view: false, manage: false };
  return state;
};

type Props = {
  open: boolean;
  role: RoleDetail | null; // null = create mode
  categories: PermissionCategory[];
  onClose: () => void;
  onSaved: () => void;
};

const ModalCreateandUpdateRole: React.FC<Props> = ({ open, role, categories, onClose, onSaved }) => {
  const { currentColor } = useStateContext();
  const { t } = useLanguage();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [roleName, setRoleName] = useState("");
  const [perms, setPerms] = useState<PermState>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!role;
  const lockAdminUserManagement = !!role?.is_built_in && role.role.toLowerCase() === "admin";

  useEffect(() => {
    if (!open) return;
    setError("");
    if (role) {
      const next = emptyPermState(categories);
      for (const [cat, p] of Object.entries(role.permissions)) {
        next[cat] = { view: p.view, manage: p.manage };
      }
      setPerms(next);
      setRoleName(role.role);
    } else {
      setPerms(emptyPermState(categories));
      setRoleName("");
    }
  }, [open, role, categories]);

  const permissionsPayload = useMemo<PermissionInput[]>(
    () =>
      categories.map((c) => ({
        category: c.key,
        can_view: perms[c.key]?.view ?? false,
        can_manage: c.supports_manage ? perms[c.key]?.manage ?? false : false,
      })),
    [categories, perms]
  );

  const toggleView = (key: string) => {
    setPerms((prev) => {
      const cur = prev[key] ?? { view: false, manage: false };
      const nextView = !cur.view;
      // Unchecking View also clears Manage — you can't manage what you can't see.
      return { ...prev, [key]: { view: nextView, manage: nextView ? cur.manage : false } };
    });
  };

  const toggleManage = (key: string, supportsManage: boolean) => {
    if (!supportsManage) return;
    if (key === "user_management" && lockAdminUserManagement) return;
    setPerms((prev) => {
      const cur = prev[key] ?? { view: false, manage: false };
      // Checking Manage implies View.
      return { ...prev, [key]: { view: true, manage: !cur.manage } };
    });
  };

  const handleSave = async () => {
    const trimmed = roleName.trim();
    if (!trimmed) {
      setError(t("roleMgmt.roleNameRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = isEdit
        ? await UpdateRole(role!.id, { role: trimmed, permissions: permissionsPayload })
        : await CreateRole(trimmed, permissionsPayload);

      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      message.success(t(isEdit ? "roleMgmt.updateSuccess" : "roleMgmt.createSuccess"));
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <button
        type="button"
        onClick={saving ? undefined : onClose}
        className="absolute inset-0 bg-black/55"
        aria-label={t("roleMgmt.cancel")}
      />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="absolute right-3 top-3 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/70"
          aria-label={t("roleMgmt.cancel")}
        >
          <FiX className="text-[13px]" />
        </button>

        <div className="px-4 pb-3 pt-4">
          <div className="flex items-center gap-3 pr-8">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
              style={{ background: accentGrad }}
            >
              <FiShieldOff className="text-[15px]" />
            </div>
            <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white">
              {t(isEdit ? "roleMgmt.editTitle" : "roleMgmt.createTitle")}
            </h3>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 pb-2">
          <label className="mb-1 block text-[10.5px] font-semibold text-slate-500 dark:text-white/45">
            {t("roleMgmt.roleNameLabel")}
          </label>
          <input
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder={t("roleMgmt.roleNamePlaceholder")}
            className="h-9 w-full rounded-lg border border-slate-200/70 bg-white px-3 text-[12px] text-slate-700 outline-none transition focus:ring-2 focus:ring-blue-200 dark:border-white/8 dark:bg-white/5 dark:text-white/80 dark:placeholder:text-white/25 dark:focus:ring-white/10"
          />

          <p className="mb-1.5 mt-3.5 block text-[10.5px] font-semibold text-slate-500 dark:text-white/45">
            {t("roleMgmt.permissionsLabel")}
          </p>
          <div className="overflow-hidden rounded-xl border border-slate-200/70 dark:border-white/8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 dark:border-white/8 dark:bg-white/3">
                  <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">
                    {t("roleMgmt.colCategory")}
                  </th>
                  <th className="w-16 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">
                    {t("roleMgmt.colView")}
                  </th>
                  <th className="w-16 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">
                    {t("roleMgmt.colManage")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => {
                  const p = perms[c.key] ?? { view: false, manage: false };
                  const manageLocked = c.key === "user_management" && lockAdminUserManagement;
                  return (
                    <tr key={c.key} className="border-b border-slate-100 last:border-0 dark:border-white/5">
                      <td className="px-3 py-2 text-[11.5px] text-slate-700 dark:text-white/70">
                        {t(CATEGORY_LABEL_KEY[c.key] ?? (c.key as TranslationKey))}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={p.view}
                          onChange={() => toggleView(c.key)}
                          className="h-3.5 w-3.5 cursor-pointer accent-current"
                          style={{ color: currentColor }}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={c.supports_manage && p.manage}
                          disabled={!c.supports_manage || manageLocked}
                          onChange={() => toggleManage(c.key, c.supports_manage)}
                          title={manageLocked ? t("roleMgmt.adminLockGuard") : undefined}
                          className="h-3.5 w-3.5 cursor-pointer accent-current disabled:cursor-not-allowed disabled:opacity-30"
                          style={{ color: currentColor }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10.5px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
              <FiAlertTriangle className="mt-px shrink-0 text-[11px]" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-white/8">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/8 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/8"
          >
            {t("roleMgmt.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-8 items-center gap-1.5 justify-center rounded-lg px-3.5 text-[10.5px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: accentGrad }}
          >
            <FiSave className="text-[12px]" />
            {saving ? t("roleMgmt.saving") : t("roleMgmt.save")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ModalCreateandUpdateRole;
