import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiChevronDown,
  FiEdit2,
  FiInfo,
  FiMail,
  FiMapPin,
  FiPhone,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUser,
  FiX,
  FiAlertTriangle,
  FiPlus,
} from "react-icons/fi";
import { DeleteUserByID, ListUser, type UserResponse } from "../../services";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import { message } from "antd";
import ModalCreateandUpdateUser from "../../Model/ModalCreateandUpdateUser";

type SortKey = "Newest" | "Role: Admin First" | "Role: User First" | "Name A-Z";

type UiUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  profile: string;
  phone_number: string;
  location: string;
  position: string;
  role: "Admin" | "User" | string;
};

const isBase64DataImage = (v: string) => {
  const s = (v || "").trim();
  return /^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml);base64,/i.test(s);
};

const Index: React.FC = () => {
  const { t } = useLanguage();
  const auth = useAuth() as any;

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("Newest");
  const [openSort, setOpenSort] = useState(false);

  const [rows, setRows] = useState<UiUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [deleteTarget, setDeleteTarget] = useState<UiUser | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>("");

  const [openEditModal, setOpenEditModal] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UiUser | null>(null);

  const hasFetchedRef = useRef(false);

  const currentUserId = useMemo(() => {
    return (
      auth?.user?.id ??
      auth?.me?.id ??
      auth?.profile?.id ??
      auth?.currentUser?.id ??
      auth?.authUser?.id ??
      null
    );
  }, [auth]);

  const authLoading = auth?.isLoading ?? false;

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await ListUser();

      if (!data) {
        setRows([]);
        setError("Failed to load users");
        return;
      }

      const mapped: UiUser[] = (data as UserResponse[]).map((u) => ({
        id: u.id,
        email: u.email ?? "",
        first_name: u.first_name ?? "",
        last_name: u.last_name ?? "",
        profile: u.profile ?? "",
        phone_number: u.phone_number ?? "",
        location: u.location ?? "",
        position: u.position ?? "",
        role: u.role ?? "User",
      }));

      setRows(mapped);
    } catch (e) {
      console.error("fetchUsers error:", e);
      setRows([]);
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (hasFetchedRef.current) return;

    hasFetchedRef.current = true;
    fetchUsers();
  }, [authLoading, fetchUsers]);

  useEffect(() => {
    const close = () => setOpenSort(false);
    if (!openSort) return;

    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [openSort]);

  const users = useMemo(() => {
    const q = search.trim().toLowerCase();

    let filtered = rows.filter((u) => {
      const blob = [
        u.first_name,
        u.last_name,
        u.email,
        u.phone_number,
        u.location,
        u.role,
        u.position,
      ]
        .join(" ")
        .toLowerCase();

      return blob.includes(q);
    });

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "Newest") return b.id - a.id;

      if (sortBy === "Role: Admin First") {
        if (a.role === b.role) {
          return `${a.first_name} ${a.last_name}`.localeCompare(
            `${b.first_name} ${b.last_name}`
          );
        }
        return a.role === "Admin" ? -1 : 1;
      }

      if (sortBy === "Role: User First") {
        if (a.role === b.role) {
          return `${a.first_name} ${a.last_name}`.localeCompare(
            `${b.first_name} ${b.last_name}`
          );
        }
        return a.role === "User" ? -1 : 1;
      }

      return `${a.first_name} ${a.last_name}`.localeCompare(
        `${b.first_name} ${b.last_name}`
      );
    });

    return filtered;
  }, [rows, search, sortBy]);

  const handleEdit = (user: UiUser) => {
    setSelectedUser(user);
    setOpenEditModal(true);
  };

  const handleCreate = () => {
    setSelectedUser(null);
    setOpenCreateModal(true);
  };

  const openDeleteModal = (user: UiUser) => {
    if (currentUserId !== null && user.id === currentUserId) {
      setDeleteError("You cannot delete your current account");
      setDeleteTarget(null);
      return;
    }

    setDeleteError("");
    setDeleteTarget(user);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    if (currentUserId !== null && deleteTarget.id === currentUserId) {
      setDeleteError("You cannot delete your current account");
      return;
    }

    try {
      setDeleting(true);
      setDeleteError("");

      const res = await DeleteUserByID(deleteTarget.id);

      if (!res) {
        setDeleteError("Delete failed");
        return;
      }

      setRows((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
      message.success("Delete success");
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.error || err?.message || "Something went wrong"
      );
    } finally {
      setDeleting(false);
    }
  };

  const renderAvatar = (u: UiUser) => {
    const showImage = isBase64DataImage(u.profile);

    if (showImage) {
      return (
        <img
          src={u.profile}
          alt={`${u.first_name} ${u.last_name}`}
          className="h-8 w-8 rounded-xl object-cover ring-1 ring-gray-200 dark:ring-white/10"
        />
      );
    }

    const isAdmin = u.role === "Admin";

    return (
      <div
        className={[
          "grid h-8 w-8 place-items-center rounded-xl ring-1",
          "bg-slate-50 text-slate-500 ring-gray-200",
          "dark:bg-white/5 dark:text-white/55 dark:ring-white/10",
        ].join(" ")}
      >
        {isAdmin ? (
          <FiShield className="text-[14px]" />
        ) : (
          <FiUser className="text-[14px]" />
        )}
      </div>
    );
  };

  const editGradientIconBtn = [
    "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
    "border border-blue-200 bg-blue-50 text-blue-700",
    "hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15",
  ].join(" ");

  const deleteGradientIconBtn = [
    "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
    "border border-red-200 bg-red-50 text-red-700",
    "hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15",
  ].join(" ");

  return (
    <>
      <section className="rounded-xl border border-slate-200/70 bg-white p-4 dark:border-white/8 dark:bg-[#0d0b1a]/80 sm:p-5">
        <div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
                  {t("user.title")}
                </h2>
                {!loading && (
                  <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                    {rows.length} users
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreate}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-[11px] font-medium text-white transition hover:bg-slate-800 dark:bg-white/15 dark:hover:bg-white/20"
            >
              <FiPlus className="text-[12px]" />
              {t("user.addUser")}
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/30" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("user.searchByNameOrEmail")}
                className="h-8 w-full rounded-lg border border-slate-200/70 bg-white pl-8.5 pr-3 text-[11px] text-slate-700 outline-none transition focus:ring-2 focus:ring-blue-200 dark:border-white/8 dark:bg-white/5 dark:text-white/75 dark:placeholder:text-white/30 dark:focus:ring-white/10"
              />
            </div>

            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setOpenSort((s) => !s)}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white px-3 text-[10.5px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8"
              >
                {sortBy}
                <FiChevronDown className={`text-[11px] text-slate-400 transition dark:text-white/35 ${openSort ? "rotate-180" : ""}`} />
              </button>

              {openSort && (
                <div className="absolute right-0 z-20 mt-1.5 w-48 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                  {(["Newest","Role: Admin First","Role: User First","Name A-Z"] as SortKey[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => { setSortBy(opt); setOpenSort(false); }}
                      className={[
                        "w-full rounded-lg px-3 py-2 text-left text-[11px] font-medium transition",
                        sortBy === opt
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                          : "text-slate-600 hover:bg-slate-50 dark:text-white/65 dark:hover:bg-white/5",
                      ].join(" ")}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-2.5 flex flex-col gap-1 text-[10px] text-slate-500 dark:text-white/50">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500/70" />
                Loading users...
              </span>
            ) : error ? (
              <span className="text-red-600 dark:text-red-300">{error}</span>
            ) : (
              <span>
                Showing <span className="font-semibold">{users.length}</span> users
              </span>
            )}

            {deleteError && !deleteTarget && (
              <span className="text-red-600 dark:text-red-300">{deleteError}</span>
            )}
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-white/3">
            <div className="min-w-280">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left">
                    <th className="border-b border-gray-200/80 px-3 py-2 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:text-white/60 w-[34%]">
                      User
                    </th>
                    <th className="border-b border-gray-200/80 px-3 py-2 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:text-white/60 w-[30%]">
                      Contact
                    </th>
                    <th className="border-b border-gray-200/80 px-3 py-2 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:text-white/60 w-[22%]">
                      Location
                    </th>
                    <th className="border-b border-gray-200/80 px-3 py-2 text-right text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:text-white/60 w-[14%]">
                      Action
                    </th>
                  </tr>
                </thead>
              </table>

              <div className="max-h-82.5 overflow-y-auto">
                <table className="w-full border-separate border-spacing-0">
                  <tbody>
                    {!loading &&
                      users.map((user, idx) => {
                        const isCurrentUser =
                          currentUserId !== null && user.id === currentUserId;

                        return (
                          <tr
                            key={user.id}
                            className="transition-colors hover:bg-violet-50/40 dark:hover:bg-white/4"
                          >
                            <td
                              className={`px-3 py-2 w-[34%] ${
                                idx !== users.length - 1
                                  ? "border-b border-gray-100 dark:border-white/10"
                                  : ""
                              }`}
                            >
                              <div className="min-w-0 flex items-center gap-2.5">
                                <div className="shrink-0">{renderAvatar(user)}</div>

                                <div className="min-w-0">
                                  <p className="truncate text-[11px] font-semibold text-slate-900 dark:text-white/85">
                                    {user.first_name} {user.last_name}
                                  </p>

                                  <div className="mt-0.5 space-y-0.5">
                                    <p className="truncate text-[10px] text-slate-500 dark:text-white/50">
                                      Role : {user.role || "-"}
                                    </p>
                                    <p className="truncate text-[10px] text-slate-500 dark:text-white/50">
                                      Position : {user.position || "-"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td
                              className={`px-3 py-2 w-[30%] ${
                                idx !== users.length - 1
                                  ? "border-b border-gray-100 dark:border-white/10"
                                  : ""
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-[10.5px] text-slate-700 dark:text-white/75">
                                  <FiMail className="text-[10px] text-cyan-600 dark:text-cyan-300" />
                                  <span className="truncate">{user.email}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10.5px] text-slate-700 dark:text-white/75">
                                  <FiPhone className="text-[10px] text-violet-600 dark:text-violet-300" />
                                  <span>{user.phone_number || "-"}</span>
                                </div>
                              </div>
                            </td>

                            <td
                              className={`px-3 py-2 w-[22%] ${
                                idx !== users.length - 1
                                  ? "border-b border-gray-100 dark:border-white/10"
                                  : ""
                              }`}
                            >
                              <div className="flex items-center gap-2 text-[10.5px] text-slate-700 dark:text-white/75">
                                <FiMapPin className="text-[10px] text-emerald-600 dark:text-emerald-300" />
                                <span className="truncate">{user.location || "-"}</span>
                              </div>
                            </td>

                            <td
                              className={`px-3 py-2 text-right w-[14%] ${
                                idx !== users.length - 1
                                  ? "border-b border-gray-100 dark:border-white/10"
                                  : ""
                              }`}
                            >
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(user)}
                                  className={editGradientIconBtn}
                                  title="Edit user"
                                  aria-label="Edit user"
                                >
                                  <FiEdit2 className="text-[11px]" />
                                </button>

                                {!isCurrentUser && (
                                  <button
                                    type="button"
                                    onClick={() => openDeleteModal(user)}
                                    className={deleteGradientIconBtn}
                                    title="Delete user"
                                    aria-label="Delete user"
                                  >
                                    <FiTrash2 className="text-[11px]" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                    {!loading && users.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-[11px] text-slate-500 dark:text-white/50"
                        >
                          {t("common.noResults")}
                        </td>
                      </tr>
                    )}

                    {loading && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-[11px] text-slate-500 dark:text-white/50"
                        >
                          Loading...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {deleteTarget && (
        <div className="fixed inset-0 z-200 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={closeDeleteModal}
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[3px]"
            aria-label="Close delete modal overlay"
          />

          <div className="relative z-10 w-full max-w-85 overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
            <button
              type="button"
              onClick={closeDeleteModal}
              disabled={deleting}
              className="absolute right-3 top-3 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/70"
              aria-label="Close delete modal"
            >
              <FiX className="text-[13px]" />
            </button>

            <div className="px-4 pb-3 pt-4">
              <div className="flex items-start gap-3 pr-8">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-500 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                  <FiAlertTriangle className="text-[14px]" />
                </div>

                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-red-500/80 dark:text-red-300/80">
                    Delete user
                  </p>
                  <h3 className="mt-1 text-[13px] font-semibold text-slate-900 dark:text-white">
                    Remove this account?
                  </h3>
                  <p className="mt-1 text-[10.5px] leading-5 text-slate-500 dark:text-white/50">
                    This action will permanently remove the selected user from the system.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-4 pb-4">
              <div className="rounded-xl border border-slate-200/70 bg-slate-50 p-3 dark:border-white/8 dark:bg-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-white ring-1 ring-gray-200 dark:bg-white/8 dark:ring-white/10">
                    <FiUser className="text-[13px] text-slate-500 dark:text-white/55" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-slate-800 dark:text-white/85">
                      {deleteTarget.first_name} {deleteTarget.last_name}
                    </p>
                    <p className="truncate text-[10px] text-slate-500 dark:text-white/50">
                      {deleteTarget.email || "-"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-400/20 dark:bg-amber-500/10">
                <div className="flex items-start gap-2">
                  <FiInfo className="mt-px text-[11px] text-amber-700 dark:text-amber-300" />
                  <p className="text-[10px] leading-5 text-amber-800 dark:text-amber-200">
                    Please confirm that this account is no longer required before deleting.
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                  {deleteError}
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={deleting}
                  className={[
                    "inline-flex h-8 items-center justify-center rounded-lg px-3 text-[10.5px] font-medium transition",
                    "border border-slate-200/70 bg-white text-slate-700 hover:bg-slate-50",
                    "dark:border-white/8 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/8",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  ].join(" ")}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className={[
                    "inline-flex h-8 items-center justify-center rounded-lg px-3 text-[10.5px] font-medium transition",
                    "bg-red-500 text-white hover:bg-red-600",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  ].join(" ")}
                >
                  {deleting ? "Deleting..." : "Delete user"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ModalCreateandUpdateUser
        open={openCreateModal}
        user={null}
        onClose={() => {
          setOpenCreateModal(false);
        }}
        onUpdated={async () => {
          setOpenCreateModal(false);
          await fetchUsers();
        }}
      />

      <ModalCreateandUpdateUser
        open={openEditModal}
        user={selectedUser}
        onClose={() => {
          setOpenEditModal(false);
          setSelectedUser(null);
        }}
        onUpdated={async () => {
          setOpenEditModal(false);
          setSelectedUser(null);
          await fetchUsers();
        }}
      />
    </>
  );
};

export default Index;