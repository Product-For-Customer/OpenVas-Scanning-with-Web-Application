import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiKey,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiUsers,
  FiAlertTriangle,
  FiX,
} from "react-icons/fi";
import { message } from "antd";
import { ListRoles, type RoleResponse } from "../../services";
import {
  GetRole,
  DeleteRole,
  ListPermissionCategories,
  type RoleDetail,
  type PermissionCategory,
} from "../../services/role";
import { useLanguage } from "../../contexts/LanguageContext";
import { useStateContext } from "../../contexts/ProviderContext";
import { useAuth } from "../../contexts/AuthContext";
import ModalCreateandUpdateRole from "../../Model/ModalCreateandUpdateRole";

const RoleManagementPage: React.FC = () => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const { can } = useAuth();
  const canManage = can("user_management", "manage");
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [categories, setCategories] = useState<PermissionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDetail | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");

  const [deleteTarget, setDeleteTarget] = useState<RoleResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const hasFetchedRef = useRef(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    const [roleList, cats] = await Promise.all([ListRoles(), ListPermissionCategories()]);
    if (!roleList) {
      setError(t("roleMgmt.loadFailed"));
      setRoles([]);
    } else {
      setRoles(roleList);
    }
    if (cats) setCategories(cats);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void fetchAll();
  }, [fetchAll]);

  const handleCreate = () => {
    setModalMode("create");
    setEditingRole(null);
    setModalOpen(true);
  };

  const handleEdit = async (r: RoleResponse) => {
    const detail = await GetRole(r.id);
    if ("error" in detail && detail.error) {
      message.error(detail.error);
      return;
    }
    setModalMode("edit");
    setEditingRole(detail as RoleDetail);
    setModalOpen(true);
  };

  // Only "Admin" and "User" are permanently protected — they can never be
  // deleted, full stop, regardless of user count (matches backend
  // isProtectedRole() in role/handler.go). Every other role, including the
  // built-in Operator/Auditor defaults, is deletable once zero users are
  // assigned to it, same as any custom role.
  //
  // Surfaced two ways: the delete button itself is disabled (with a tooltip
  // explaining why) so it can never be clicked into an error state, and
  // openDeleteModal re-checks the same condition as a defense-in-depth guard
  // in case the role list is stale (e.g. another admin session just assigned
  // a user to it). The backend re-validates both conditions again
  // regardless, since frontend state can never be fully trusted.
  const isProtectedRoleName = (roleName: string) => {
    const name = roleName.trim().toLowerCase();
    return name === "admin" || name === "user";
  };

  // The Admin role specifically (not User) gets no action buttons at all —
  // its permissions can never be edited (locked to full access on the
  // backend) and it can never be deleted, so Edit/Delete would just be
  // dead ends. Matches backend isAdminRole() in role/handler.go.
  const isAdminRoleRow = (r: RoleResponse) => !!r.is_built_in && r.role.trim().toLowerCase() === "admin";

  const deleteBlockReason = (r: RoleResponse): string | null => {
    if (isProtectedRoleName(r.role)) return t("roleMgmt.deleteBlockedBuiltIn");
    if ((r.user_count ?? 0) > 0) return t("roleMgmt.deleteBlockedHasUsers", { count: r.user_count ?? 0 });
    return null;
  };

  const openDeleteModal = (r: RoleResponse) => {
    const blockReason = deleteBlockReason(r);
    if (blockReason) {
      message.error(blockReason);
      return;
    }
    setDeleteError("");
    setDeleteTarget(r);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await DeleteRole(deleteTarget.id);
      if (res.error) {
        setDeleteError(res.error);
        return;
      }
      message.success(t("roleMgmt.deleteSuccess"));
      setDeleteTarget(null);
      await fetchAll();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full space-y-4 sm:space-y-5">
      {/* Header card */}
      <div
        className="relative overflow-hidden rounded-[18px] bg-white/95 p-4 shadow-sm backdrop-blur sm:rounded-[22px] sm:p-6 dark:bg-[#0d0b1a]/90"
        style={{ border: `1px solid ${currentColor}30` }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 right-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}1e` }} />
        </div>
        <div className="relative z-10 flex items-center gap-3 sm:gap-4">
          <div
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-13 sm:w-13"
            style={{ background: accentGrad, boxShadow: `0 8px 24px -6px ${currentColor}50` }}
          >
            <FiKey className="text-[20px] sm:text-[22px]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
              {t("roleMgmt.kicker")}
            </p>
            <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
              {t("roleMgmt.title")}
            </h1>
            <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
              {t("roleMgmt.subtitle")}
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={handleCreate}
              className="ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-[11.5px] font-medium text-white transition hover:opacity-90"
              style={{ background: accentGrad }}
            >
              <FiPlus className="text-[13px]" />
              {t("roleMgmt.addRole")}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white dark:border-white/8 dark:bg-[#0d0b1a]/60">
        <div className="overflow-x-auto">
          <table className="w-full min-w-150">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/8">
                {[t("roleMgmt.tableRole"), t("roleMgmt.tableType"), t("roleMgmt.tableUsers"), t("common.actions")].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30 ${i === 3 ? "text-right" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60 dark:divide-white/5">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td colSpan={4} className="h-14 animate-pulse px-4" />
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[11px] text-red-600 dark:text-red-300">{error}</td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[11px] text-slate-400 dark:text-white/35">{t("roleMgmt.noRoles")}</td>
                </tr>
              ) : (
                roles.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/2">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="grid h-7 w-7 place-items-center rounded-lg bg-slate-50 text-slate-500 dark:bg-white/5 dark:text-white/55">
                          <FiKey className="text-[12px]" />
                        </div>
                        <span className="text-[12.5px] font-medium text-slate-700 dark:text-white/80">{r.role}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-semibold",
                          r.is_built_in
                            ? "bg-slate-100 text-slate-600 dark:bg-white/8 dark:text-white/60"
                            : "bg-violet-50 text-violet-700 dark:bg-violet-500/12 dark:text-violet-200",
                        ].join(" ")}
                      >
                        {t(r.is_built_in ? "roleMgmt.builtIn" : "roleMgmt.custom")}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-[12px] text-slate-600 dark:text-white/55">
                        <FiUsers className="text-[11px] text-slate-400 dark:text-white/30" />
                        {r.user_count ?? 0}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {isAdminRoleRow(r) || !canManage ? (
                        // The Admin role always has full access and can never
                        // be renamed-away-from-protected or deleted — there's
                        // nothing actionable here, so no buttons at all rather
                        // than disabled ones that invite "why can't I click this?"
                        // Same em-dash for View-only roles (no user_management Manage).
                        <span className="text-[10.5px] text-slate-300 dark:text-white/15">—</span>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleEdit(r)}
                            title={t("roleMgmt.edit")}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15"
                          >
                            <FiEdit2 className="text-[11px]" />
                          </button>
                          {(() => {
                            const blockReason = deleteBlockReason(r);
                            return (
                              <button
                                type="button"
                                onClick={() => openDeleteModal(r)}
                                disabled={!!blockReason}
                                title={blockReason ?? t("roleMgmt.delete")}
                                aria-label={blockReason ?? t("roleMgmt.delete")}
                                className={[
                                  "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition",
                                  blockReason
                                    ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300 dark:border-white/8 dark:bg-white/5 dark:text-white/20"
                                    : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15",
                                ].join(" ")}
                              >
                                <FiTrash2 className="text-[11px]" />
                              </button>
                            );
                          })()}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ModalCreateandUpdateRole
        open={modalOpen}
        role={modalMode === "edit" ? editingRole : null}
        categories={categories}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          setModalOpen(false);
          await fetchAll();
        }}
      />

      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => !deleting && setDeleteTarget(null)}
            className="absolute inset-0 bg-black/55"
            aria-label={t("roleMgmt.cancel")}
          />
          <div className="relative z-10 w-full max-w-85 overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
            <button
              type="button"
              onClick={() => !deleting && setDeleteTarget(null)}
              disabled={deleting}
              className="absolute right-3 top-3 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/70"
              aria-label={t("roleMgmt.cancel")}
            >
              <FiX className="text-[13px]" />
            </button>
            <div className="px-4 pb-3 pt-4">
              <div className="flex items-start gap-3 pr-8">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-500 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                  <FiAlertTriangle className="text-[14px]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white">
                    {t("roleMgmt.deleteConfirmTitle")}
                  </h3>
                  <p className="mt-1 text-[10.5px] leading-5 text-slate-500 dark:text-white/50">
                    {t("roleMgmt.deleteConfirmDesc")}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-4 pb-4">
              <div className="rounded-xl border border-slate-200/70 bg-slate-50 p-3 dark:border-white/8 dark:bg-white/5">
                <p className="truncate text-[11px] font-semibold text-slate-800 dark:text-white/85">{deleteTarget.role}</p>
              </div>
              {deleteError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                  {deleteError}
                </div>
              )}
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/8 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/8"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDelete()}
                  disabled={deleting}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-red-500 px-3 text-[10.5px] font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting ? t("common.deleting") : t("roleMgmt.delete")}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default RoleManagementPage;
