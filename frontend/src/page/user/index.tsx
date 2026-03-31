import React, { useEffect, useMemo, useState } from "react";
import {
  FiSearch,
  FiShield,
  FiUser,
  FiMail,
  FiPhone,
  FiMapPin,
  FiChevronDown,
  FiEdit2,
  FiTrash2,
  FiX,
  FiLink2,
} from "react-icons/fi";
import { ListUser, DeleteUserByID, type UserResponse } from "../../services";
import { useAuth } from "../../contexts/AuthContext";
import ModalCreateUser from "../../Model/ModalCreateUser";
import OwnManageModal from "./OwnManageModal";

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
  const [selectedUser, setSelectedUser] = useState<UiUser | null>(null);

  const [openOwnModal, setOpenOwnModal] = useState(false);
  const [selectedOwnUser, setSelectedOwnUser] = useState<UiUser | null>(null);

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

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await ListUser();

      if (!data) {
        setRows([]);
        setError("โหลดข้อมูลผู้ใช้ไม่สำเร็จ (ListUser returned null)");
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
      setError("เกิดข้อผิดพลาดตอนโหลดข้อมูลผู้ใช้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    fetchUsers();
  }, [authLoading]);

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
        if (a.role === b.role) return a.first_name.localeCompare(b.first_name);
        return a.role === "Admin" ? -1 : 1;
      }

      if (sortBy === "Role: User First") {
        if (a.role === b.role) return a.first_name.localeCompare(b.first_name);
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

  const handleOpenOwn = (user: UiUser) => {
    setSelectedOwnUser(user);
    setOpenOwnModal(true);
  };

  const openDeleteModal = (user: UiUser) => {
    if (currentUserId !== null && user.id === currentUserId) {
      setDeleteError("ไม่สามารถลบบัญชีของตัวเองหรือบัญชีที่กำลังเข้าสู่ระบบอยู่ได้");
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
      setDeleteError("ไม่สามารถลบบัญชีของตัวเองหรือบัญชีที่กำลังเข้าสู่ระบบอยู่ได้");
      return;
    }

    try {
      setDeleting(true);
      setDeleteError("");

      const res = await DeleteUserByID(deleteTarget.id);

      if (!res) {
        setDeleteError("ลบผู้ใช้ไม่สำเร็จ");
        return;
      }

      setDeleteTarget(null);
      await fetchUsers();
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.error ||
          err?.message ||
          "เกิดข้อผิดพลาดระหว่างลบผู้ใช้"
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
          className="h-10 w-10 rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-white/10"
        />
      );
    }

    const isAdmin = u.role === "Admin";

    return (
      <div
        className={[
          "h-10 w-10 rounded-2xl grid place-items-center ring-1",
          "bg-slate-50 ring-gray-200 text-slate-500",
          "dark:bg-white/5 dark:ring-white/10 dark:text-white/55",
        ].join(" ")}
        aria-label="User avatar icon"
        title="No base64 profile image"
      >
        {isAdmin ? (
          <FiShield className="text-[16px]" />
        ) : (
          <FiUser className="text-[16px]" />
        )}
      </div>
    );
  };

  return (
    <>
      <section
        className={[
          "relative overflow-hidden rounded-[22px] p-3 sm:p-4 md:p-4.5",
          "bg-white border border-gray-200/80 shadow-[0_14px_34px_-24px_rgba(15,23,42,0.25)]",
          "dark:bg-[#08111f]/90 dark:border-white/10 dark:ring-1 dark:ring-cyan-400/10 dark:shadow-none",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-14 right-6 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.035] dark:opacity-[0.055]">
            <div
              className="h-full w-full"
              style={{
                backgroundImage: `
                  linear-gradient(to right, currentColor 1px, transparent 1px),
                  linear-gradient(to bottom, currentColor 1px, transparent 1px)
                `,
                backgroundSize: "26px 26px",
              }}
            />
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[10.5px] font-semibold text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-300">
                <FiShield className="text-[11px]" />
                User Access Monitoring
              </div>

              <h2 className="mt-2.5 text-[18px] sm:text-[20px] font-semibold tracking-tight text-slate-900 dark:text-white">
                User Security Table
              </h2>

              <p className="mt-1 text-[11px] sm:text-[12px] text-slate-500 dark:text-white/55">
                Monitor administrator access, analyst accounts, operators, and own assignments.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/35 text-[13px]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search firstname / lastname / email / phone / role..."
                className={[
                  "w-full h-9 rounded-2xl pl-9 pr-3.5 text-[12px] outline-none transition",
                  "border border-gray-200 bg-white text-slate-800 focus:ring-2 focus:ring-violet-200",
                  "dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:placeholder:text-white/35 dark:focus:ring-violet-400/10",
                ].join(" ")}
              />
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenSort((s) => !s)}
                className={[
                  "h-9 px-3.5 rounded-2xl inline-flex items-center gap-2 transition",
                  "bg-white border border-gray-200/80 text-[12px] font-medium text-gray-700 hover:bg-gray-50",
                  "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/8",
                ].join(" ")}
              >
                {sortBy}
                <FiChevronDown
                  className={`transition ${
                    openSort ? "rotate-180" : ""
                  } text-gray-400 dark:text-white/45 text-[13px]`}
                />
              </button>

              {openSort && (
                <div className="absolute right-0 mt-2 w-48 rounded-[18px] overflow-hidden z-20 border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none">
                  {(
                    [
                      "Newest",
                      "Role: Admin First",
                      "Role: User First",
                      "Name A-Z",
                    ] as SortKey[]
                  ).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setSortBy(opt);
                        setOpenSort(false);
                      }}
                      className={[
                        "w-full text-left px-3.5 py-2.5 text-[12px] transition",
                        sortBy === opt
                          ? "bg-violet-50 text-violet-700 font-semibold dark:bg-violet-500/10 dark:text-violet-200"
                          : "text-gray-700 hover:bg-gray-50 dark:text-white/70 dark:hover:bg-white/8",
                      ].join(" ")}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-2.5 flex flex-col gap-1 text-[11px] text-slate-500 dark:text-white/50">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-violet-500/70 animate-pulse" />
                Loading users...
              </span>
            ) : error ? (
              <span className="text-red-600 dark:text-red-300">{error}</span>
            ) : (
              <span>
                Showing <span className="font-semibold">{users.length}</span>{" "}
                users
              </span>
            )}

            {deleteError && !deleteTarget && (
              <span className="text-red-600 dark:text-red-300">
                {deleteError}
              </span>
            )}
          </div>

          <div className="mt-3.5 overflow-x-auto rounded-[22px] border border-gray-200/80 bg-white/80 dark:border-white/10 dark:bg-white/3">
            <table className="min-w-280 w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left">
                  <th className="px-3.5 py-3 text-[11px] font-semibold text-slate-600 dark:text-white/60 border-b border-gray-200/80 dark:border-white/10">
                    User
                  </th>
                  <th className="px-3.5 py-3 text-[11px] font-semibold text-slate-600 dark:text-white/60 border-b border-gray-200/80 dark:border-white/10">
                    Contact
                  </th>
                  <th className="px-3.5 py-3 text-[11px] font-semibold text-slate-600 dark:text-white/60 border-b border-gray-200/80 dark:border-white/10">
                    Location
                  </th>
                  <th className="px-3.5 py-3 text-[11px] font-semibold text-slate-600 dark:text-white/60 border-b border-gray-200/80 dark:border-white/10 text-center">
                    Own
                  </th>
                  <th className="px-3.5 py-3 text-[11px] font-semibold text-slate-600 dark:text-white/60 border-b border-gray-200/80 dark:border-white/10 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {!loading &&
                  users.map((user, idx) => {
                    const isCurrentUser =
                      currentUserId !== null && user.id === currentUserId;

                    return (
                      <tr
                        key={user.id}
                        className={[
                          "transition-colors",
                          "hover:bg-violet-50/40 dark:hover:bg-white/4",
                        ].join(" ")}
                      >
                        <td
                          className={`px-3.5 py-3 ${
                            idx !== users.length - 1
                              ? "border-b border-gray-100 dark:border-white/10"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">{renderAvatar(user)}</div>

                            <div className="min-w-0">
                              <p className="text-[12.5px] font-semibold text-slate-900 dark:text-white/85 truncate">
                                {user.first_name} {user.last_name}
                              </p>

                              <div className="mt-1 space-y-0.5">
                                <p className="text-[11px] text-slate-500 dark:text-white/50 truncate">
                                  Role : {user.role || "-"}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-white/50 truncate">
                                  Position : {user.position || "-"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td
                          className={`px-3.5 py-3 ${
                            idx !== users.length - 1
                              ? "border-b border-gray-100 dark:border-white/10"
                              : ""
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-[12px] text-slate-700 dark:text-white/75">
                              <FiMail className="text-[12px] text-cyan-600 dark:text-cyan-300" />
                              <span className="truncate">{user.email}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[12px] text-slate-700 dark:text-white/75">
                              <FiPhone className="text-[12px] text-violet-600 dark:text-violet-300" />
                              <span>{user.phone_number || "-"}</span>
                            </div>
                          </div>
                        </td>

                        <td
                          className={`px-3.5 py-3 ${
                            idx !== users.length - 1
                              ? "border-b border-gray-100 dark:border-white/10"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 text-[12px] text-slate-700 dark:text-white/75">
                            <FiMapPin className="text-[12px] text-emerald-600 dark:text-emerald-300" />
                            <span>{user.location || "-"}</span>
                          </div>
                        </td>

                        <td
                          className={`px-3.5 py-3 text-center ${
                            idx !== users.length - 1
                              ? "border-b border-gray-100 dark:border-white/10"
                              : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenOwn(user)}
                            className={[
                              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold transition",
                              "bg-violet-50 text-violet-700 hover:bg-violet-100",
                              "dark:bg-violet-500/10 dark:text-violet-200 dark:hover:bg-violet-500/15",
                            ].join(" ")}
                          >
                            <FiLink2 className="text-[12px]" />
                            Own
                          </button>
                        </td>

                        <td
                          className={`px-3.5 py-3 text-right ${
                            idx !== users.length - 1
                              ? "border-b border-gray-100 dark:border-white/10"
                              : ""
                          }`}
                        >
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(user)}
                              className={[
                                "inline-flex h-8.5 w-8.5 items-center justify-center rounded-[14px] transition-colors",
                                "text-cyan-600 bg-cyan-50 hover:bg-cyan-100 active:bg-cyan-200",
                                "dark:text-cyan-300 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/15 dark:active:bg-cyan-500/20",
                              ].join(" ")}
                              title="Edit user"
                              aria-label="Edit user"
                            >
                              <FiEdit2 className="text-[13px]" />
                            </button>

                            {!isCurrentUser && (
                              <button
                                type="button"
                                onClick={() => openDeleteModal(user)}
                                className={[
                                  "inline-flex h-8.5 w-8.5 items-center justify-center rounded-[14px] transition-colors",
                                  "text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200",
                                  "dark:text-red-300 dark:bg-red-500/10 dark:hover:bg-red-500/15 dark:active:bg-red-500/20",
                                ].join(" ")}
                                title="Delete user"
                                aria-label="Delete user"
                              >
                                <FiTrash2 className="text-[13px]" />
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
                      colSpan={5}
                      className="px-4 py-8 text-center text-[12px] text-slate-500 dark:text-white/50"
                    >
                      No user data found
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-[12px] text-slate-500 dark:text-white/50"
                    >
                      Loading...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {openSort && (
          <button
            type="button"
            onClick={() => setOpenSort(false)}
            className="fixed inset-0 z-5 cursor-default"
            aria-label="Close sort overlay"
          />
        )}
      </section>

      {deleteTarget && (
        <div className="fixed inset-0 z-200 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={closeDeleteModal}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            aria-label="Close delete modal overlay"
          />

          <div
            className={[
              "relative z-10 w-full max-w-130 rounded-[18px] border border-gray-200 bg-white px-4 py-4 shadow-[0_20px_70px_rgba(15,23,42,0.18)]",
              "dark:border-white/10 dark:bg-[#0d1524]",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={closeDeleteModal}
              disabled={deleting}
              className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-600 disabled:cursor-not-allowed dark:text-white/45 dark:hover:text-white/70"
              aria-label="Close"
            >
              <FiX className="text-[18px]" />
            </button>

            <div className="flex justify-center pt-1">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-300">
                <FiTrash2 className="text-[22px]" />
              </div>
            </div>

            <h3 className="mt-3 text-center text-[18px] font-semibold text-slate-800 dark:text-white">
              Delete Account
            </h3>

            <p className="mx-auto mt-2.5 max-w-95 text-center text-[12px] leading-5 text-slate-500 dark:text-white/55">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-700 dark:text-white/80">
                {deleteTarget.first_name} {deleteTarget.last_name}
              </span>
              ? This action cannot be undone.
            </p>

            <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-white/40">
              Email: {deleteTarget.email || "-"}
            </p>

            {deleteError && (
              <div className="mt-3 rounded-[14px] border border-red-200 bg-red-50 px-3.5 py-2.5 text-center text-[11px] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                {deleteError}
              </div>
            )}

            <div className="mt-5 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className={[
                  "min-w-27.5 rounded-xl px-3.5 py-2 text-[12px] font-medium transition",
                  "bg-[#f8dedd] text-[#ff5a3c] hover:bg-[#f4d2d1]",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              >
                {deleting ? "Deleting..." : "Yes, Delete!"}
              </button>

              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className={[
                  "min-w-27.5 rounded-xl px-3.5 py-2 text-[12px] font-medium transition",
                  "bg-[#6d5efc] text-white hover:bg-[#5f51eb]",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
              >
                No, Keep It.
              </button>
            </div>
          </div>
        </div>
      )}

      <ModalCreateUser
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

      <OwnManageModal
        open={openOwnModal}
        userId={selectedOwnUser?.id ?? null}
        userName={
          selectedOwnUser
            ? `${selectedOwnUser.first_name} ${selectedOwnUser.last_name}`
            : ""
        }
        onClose={() => {
          setOpenOwnModal(false);
          setSelectedOwnUser(null);
        }}
      />
    </>
  );
};

export default Index;