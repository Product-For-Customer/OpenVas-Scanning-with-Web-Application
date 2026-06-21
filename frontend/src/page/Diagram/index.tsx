import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FiGrid,
  FiList,
  FiChevronDown,
  FiSearch,
  FiImage,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiRefreshCw,
  FiCalendar,
  FiEye,
} from "react-icons/fi";
import {
  DeleteDiagramByID,
  ListDiagramByID,
  ListDiagrams,
  type DiagramResponse,
} from "../../services/diagram";
import { useLanguage } from "../../contexts/LanguageContext";
import { useStateContext } from "../../contexts/ProviderContext";
import DiagramFormModal from "./Model/DiagramFormModal";
import DiagramDeleteModal from "./Model/DiagramDeleteModal";
import message from "antd/es/message";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

type ViewMode = "list" | "grid";
type SortMode = "latest" | "oldest" | "name_asc" | "name_desc";
type ModalMode = "create" | "edit";

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const getImageSrc = (value?: string) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:image")) return trimmed;
  return `data:image/png;base64,${trimmed}`;
};

const safeTime = (value?: string) => {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const index: React.FC = () => {
  const { t } = useLanguage();
  const { currentColor } = useStateContext();
  const navigate = useNavigate();
  const auth = useAuth() as any;

  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const roleName = String(
    auth?.user?.role ??
      auth?.me?.role ??
      auth?.profile?.role ??
      auth?.currentUser?.role ??
      auth?.authUser?.role ??
      ""
  )
    .trim()
    .toLowerCase();

  const isUserRole = roleName === "user";

  const [diagrams, setDiagrams] = useState<DiagramResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [sortMode, setSortMode] = useState<SortMode>("oldest");
  const [openSort, setOpenSort] = useState(false);

  const [openFormModal, setOpenFormModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [selectedDiagram, setSelectedDiagram] =
    useState<DiagramResponse | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DiagramResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sortRef = useRef<HTMLDivElement | null>(null);

  const hasFetchedRef = useRef(false);
  const isLoadingListRef = useRef(false);
  const isMountedRef = useRef(false);
  const editRequestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (sortRef.current && !sortRef.current.contains(target)) {
        setOpenSort(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const loadDiagrams = useCallback(async () => {
    if (isLoadingListRef.current) return;

    try {
      isLoadingListRef.current = true;

      if (isMountedRef.current) {
        setLoading(true);
        setError("");
      }

      const data = await ListDiagrams();

      if (!isMountedRef.current) return;

      if (!data) {
        setError("ไม่สามารถโหลดข้อมูล Diagram ได้");
        setDiagrams([]);
        return;
      }

      setDiagrams(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("loadDiagrams error:", error);

      if (!isMountedRef.current) return;

      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล Diagram");
      setDiagrams([]);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
      isLoadingListRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void loadDiagrams();
  }, [loadDiagrams]);

  const summary = useMemo(() => {
    const source = diagrams ?? [];
    const now = new Date();

    return {
      total: source.length,
      withImage: source.filter((d) => !!d.image_base64?.trim()).length,
      updatedToday: source.filter((d) => {
        if (!d.updated_at) return false;
        const date = new Date(d.updated_at);
        return (
          date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth() &&
          date.getDate() === now.getDate()
        );
      }).length,
    };
  }, [diagrams]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    const items = diagrams
      .map((item) => ({
        ...item,
        _createdTime: safeTime(item.created_at),
        _updatedTime: safeTime(item.updated_at ?? item.created_at),
        _searchName: (item.name ?? "").toLowerCase(),
        _searchDescription: (item.description ?? "").toLowerCase(),
        _searchCreatedAt: String(item.created_at ?? "").toLowerCase(),
        _searchUpdatedAt: String(item.updated_at ?? "").toLowerCase(),
      }))
      .filter((item) => {
        if (!q) return true;

        return (
          item._searchName.includes(q) ||
          item._searchDescription.includes(q) ||
          item._searchCreatedAt.includes(q) ||
          item._searchUpdatedAt.includes(q)
        );
      });

    items.sort((a, b) => {
      switch (sortMode) {
        case "oldest":
          return a._createdTime - b._createdTime;
        case "name_asc":
          return (a.name ?? "").localeCompare(b.name ?? "");
        case "name_desc":
          return (b.name ?? "").localeCompare(a.name ?? "");
        case "latest":
        default:
          return b._updatedTime - a._updatedTime;
      }
    });

    return items;
  }, [diagrams, query, sortMode]);

  const sortLabel = useMemo(() => {
    switch (sortMode) {
      case "oldest":
        return "Oldest";
      case "name_asc":
        return "Name A-Z";
      case "name_desc":
        return "Name Z-A";
      case "latest":
      default:
        return "Latest";
    }
  }, [sortMode]);

  const handleOpenCreate = useCallback(() => {
    if (isUserRole) return;

    setModalMode("create");
    setSelectedDiagram(null);
    setFormLoading(false);
    setOpenFormModal(true);
  }, [isUserRole]);

  const handleOpenEdit = useCallback(
    async (diagramID: number) => {
      if (isUserRole) return;

      const requestId = ++editRequestIdRef.current;

      setModalMode("edit");
      setSelectedDiagram(null);
      setFormLoading(true);
      setOpenFormModal(true);

      try {
        const data = await ListDiagramByID(diagramID);

        if (!isMountedRef.current) return;
        if (requestId !== editRequestIdRef.current) return;

        if (!data) {
          message.error("ไม่สามารถโหลดข้อมูล Diagram ได้");
          setOpenFormModal(false);
          return;
        }

        setSelectedDiagram(data);
      } catch (error) {
        console.error("handleOpenEdit error:", error);

        if (!isMountedRef.current) return;
        if (requestId !== editRequestIdRef.current) return;

        message.error("เกิดข้อผิดพลาดในการโหลดข้อมูล Diagram");
        setOpenFormModal(false);
      } finally {
        if (isMountedRef.current && requestId === editRequestIdRef.current) {
          setFormLoading(false);
        }
      }
    },
    [isUserRole]
  );

  const handleOpenDetail = useCallback(
    (diagramID: number) => {
      navigate(`/admin/diagram-node?diagramId=${diagramID}`);
    },
    [navigate]
  );

  const handleDeleteDiagram = useCallback(async () => {
    if (isUserRole) return;
    if (!deleteTarget?.id || deleting) return;

    setDeleting(true);
    try {
      const res = await DeleteDiagramByID(deleteTarget.id);
      if (!res) {
        message.error("delete failed");
        return;
      }

      message.success("delete success");
      setDeleteTarget(null);
      await loadDiagrams();
    } catch (error) {
      console.error("handleDeleteDiagram error:", error);
      message.error("delete failed");
    } finally {
      if (isMountedRef.current) {
        setDeleting(false);
      }
    }
  }, [deleteTarget, deleting, loadDiagrams, isUserRole]);

  const shell = [
    "rounded-xl border border-slate-200/70 bg-white",
    "dark:border-white/8 dark:bg-[#0d0b1a]/80",
  ].join(" ");

  const inputCls = [
    "h-9 rounded-lg border px-3 text-[12px] outline-none transition w-full",
    "border-slate-200/70 bg-white text-slate-700 focus:ring-2 focus:ring-blue-200",
    "dark:border-white/8 dark:bg-white/5 dark:text-white/80 dark:placeholder:text-white/30 dark:focus:ring-white/10",
  ].join(" ");

  const dropdownBtn = [
    "h-8 px-3 rounded-lg inline-flex items-center justify-between gap-1.5 transition min-w-0",
    "bg-white border border-slate-200/70 text-[10.5px] font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50",
    "dark:bg-white/5 dark:border-white/8 dark:text-white/60 dark:hover:bg-white/8",
  ].join(" ");

  const primaryGradientBtn = [
    "inline-flex h-8 items-center justify-center gap-2 rounded-lg px-3.5",
    "text-white text-[11px] font-medium transition-all duration-200",
    "hover:opacity-90 focus:outline-none",
  ].join(" ");

  const editGradientBtn = [
    "inline-flex h-8 items-center justify-center gap-2 rounded-lg px-3.5",
    "border border-blue-200 bg-blue-50 text-blue-700 text-[11px] font-medium transition-all duration-200",
    "hover:bg-blue-100 focus:outline-none dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/15",
  ].join(" ");

  const deleteGradientBtn = [
    "inline-flex h-8 items-center justify-center gap-2 rounded-lg px-3.5",
    "border border-red-200 bg-red-50 text-red-700 text-[11px] font-medium transition-all duration-200",
    "hover:bg-red-100 focus:outline-none dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15",
  ].join(" ");

  const secondaryBtn = [
    "h-8 px-3 rounded-lg inline-flex items-center justify-center gap-2 transition text-[11px] font-medium",
    "bg-white border border-slate-200/70 text-slate-600 hover:bg-slate-50",
    "dark:bg-white/5 dark:border-white/8 dark:text-white/65 dark:hover:bg-white/8",
  ].join(" ");

  return (
    <div className="w-full space-y-4 sm:space-y-5">

      {/* ── Header card ── */}
      <div
        className="relative overflow-hidden rounded-[18px] bg-white/95 p-4 shadow-sm backdrop-blur sm:rounded-[22px] sm:p-6 dark:bg-[#0d0b1a]/90"
        style={{ border: `1px solid ${currentColor}30` }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 right-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}1e` }} />
          <div className="absolute -bottom-12 left-10 h-40 w-40 rounded-full blur-3xl" style={{ backgroundColor: `${currentColor}14` }} />
        </div>
        <div className="relative z-10 flex items-center gap-3 sm:gap-4">
          <div
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:h-13 sm:w-13"
            style={{ background: accentGrad, boxShadow: `0 8px 24px -6px ${currentColor}50` }}
          >
            <FiGrid className="text-[20px] sm:text-[22px]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] sm:text-[10.5px]" style={{ color: currentColor }}>
              APPS · DIAGRAMS
            </p>
            <h1 className="truncate text-[18px] font-bold text-slate-900 sm:text-[20px] dark:text-white/90">
              {t("diagram.title")}
            </h1>
            <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-[12px] dark:text-white/45">
              {t("diagram.subtitle")}
            </p>
          </div>
        </div>
      </div>

      <section className={shell}>
        <div>
          <div className="border-b border-slate-100 px-4 py-4 dark:border-white/8 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-[13px] font-semibold text-slate-700 dark:text-white/80">
                    {t("diagram.title")}
                  </h2>
                  <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                    {summary.total} total
                  </span>
                  <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10.5px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                    {summary.withImage} with image
                  </span>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:w-auto lg:flex-col lg:items-end xl:flex-row xl:flex-wrap xl:items-center">
                <div className="relative hidden w-full md:block sm:w-auto">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 dark:text-white/35" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("diagram.searchDiagram")}
                    className={["w-full pl-8 pr-3 sm:w-56", inputCls].join(" ")}
                  />
                </div>

                <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
                  <div className="relative min-w-0 flex-1 sm:flex-none" ref={sortRef}>
                    <button
                      type="button"
                      onClick={() => setOpenSort((s) => !s)}
                      className={[dropdownBtn, "w-full sm:w-32"].join(" ")}
                    >
                      <span className="truncate">{sortLabel}</span>
                      <FiChevronDown
                        className={[
                          "shrink-0 text-[12px] transition",
                          "text-gray-400 dark:text-white/45",
                          openSort ? "rotate-180" : "",
                        ].join(" ")}
                      />
                    </button>

                    {openSort && (
                      <div className="absolute right-0 z-20 mt-1.5 w-[min(12rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#0d0b1a]">
                        {[
                          { key: "latest", label: "Latest" },
                          { key: "oldest", label: "Oldest" },
                          { key: "name_asc", label: "Name A-Z" },
                          { key: "name_desc", label: "Name Z-A" },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => { setSortMode(opt.key as SortMode); setOpenSort(false); }}
                            className={[
                              "w-full rounded-lg px-3 py-2 text-left text-[11px] font-medium transition",
                              sortMode === opt.key
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                                : "text-slate-600 hover:bg-slate-50 dark:text-white/65 dark:hover:bg-white/5",
                            ].join(" ")}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {!isUserRole && (
                    <button
                      type="button"
                      onClick={handleOpenCreate}
                      className={primaryGradientBtn}
                      style={{ background: accentGrad }}
                    >
                      <FiPlus className="text-[12px]" />
                      <span className="text-[11px] font-medium">{t("diagram.createDiagram")}</span>
                    </button>
                  )}

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setView("list")}
                      className={[
                        "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition",
                        view === "list"
                          ? "border-transparent text-white"
                          : "border-slate-200/70 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/55 dark:hover:bg-white/8",
                      ].join(" ")}
                      style={view === "list" ? { background: accentGrad } : undefined}
                    >
                      <FiList className="text-[13px]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setView("grid")}
                      className={[
                        "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition",
                        view === "grid"
                          ? "border-transparent text-white"
                          : "border-slate-200/70 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/8 dark:bg-white/5 dark:text-white/55 dark:hover:bg-white/8",
                      ].join(" ")}
                      style={view === "grid" ? { background: accentGrad } : undefined}
                    >
                      <FiGrid className="text-[13px]" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative mt-2.5 md:hidden">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 dark:text-white/35" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search diagrams."
                className={["w-full pl-8 pr-3", inputCls].join(" ")}
              />
            </div>
          </div>

          <div className={view === "grid" ? "min-h-105" : "min-h-80"}>
            {loading && (
              <div className="px-3 py-4 text-[11px] text-gray-500 dark:text-white/55 sm:px-4">
                Loading.
              </div>
            )}

            {!loading && !!error && (
              <div className="px-3 py-4 text-[11px] text-red-600 dark:text-red-200 sm:px-4">
                {error}
              </div>
            )}

            {!loading && !error && filteredItems.length === 0 && (
              <div className="px-3 py-4 text-[11px] text-gray-500 dark:text-white/55 sm:px-4">
                {t("diagram.noDiagrams")}
              </div>
            )}

            {!loading && !error && filteredItems.length > 0 && (
              <>
                {view === "list" ? (
                  <div className="min-h-105 max-h-105 divide-y divide-slate-100 overflow-y-auto dark:divide-white/8">
                    {filteredItems.map((item) => {
                      const imageSrc = getImageSrc(item.image_base64);

                      return (
                        <div
                          key={item.id}
                          className="px-4 py-3.5 sm:px-5"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200/70 bg-slate-50 dark:border-white/8 dark:bg-white/5 sm:h-18 sm:w-28">
                                {imageSrc ? (
                                  <img
                                    src={imageSrc}
                                    alt={item.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-gray-400 dark:text-white/30">
                                    <FiImage className="text-[18px]" />
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-slate-50 px-2 py-0.5 text-[9px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                                    Diagram
                                  </span>
                                </div>

                                <h3 className="mt-1 line-clamp-2 text-[12px] font-semibold leading-5 text-[#1f2240] dark:text-white sm:text-[13px]">
                                  {item.name || "-"}
                                </h3>

                                <p className="mt-1 line-clamp-2 text-[10.5px] leading-5 text-gray-500 dark:text-white/55">
                                  {item.description?.trim()
                                    ? item.description
                                    : "No description"}
                                </p>

                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-gray-500 dark:text-white/50">
                                  <span className="inline-flex items-center gap-1">
                                    <FiCalendar className="shrink-0" />
                                    Created: {formatDateTime(item.created_at)}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <FiRefreshCw className="shrink-0" />
                                    Updated: {formatDateTime(item.updated_at)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                              <button
                                type="button"
                                className={secondaryBtn}
                                onClick={() => handleOpenDetail(item.id)}
                              >
                                <FiEye className="text-[12px]" />
                                Detail
                              </button>

                              {!isUserRole && (
                                <>
                                  <button
                                    type="button"
                                    className={editGradientBtn}
                                    onClick={() => handleOpenEdit(item.id)}
                                  >
                                    <FiEdit2 className="text-[12px]" />
                                    <span className="text-[11px] font-medium">
                                      Edit
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    className={deleteGradientBtn}
                                    onClick={() => setDeleteTarget(item)}
                                  >
                                    <FiTrash2 className="text-[12px]" />
                                    <span className="text-[11px] font-medium">
                                      Delete
                                    </span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="min-h-105 max-h-105 overflow-y-auto p-3 sm:p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {filteredItems.map((item) => {
                        const imageSrc = getImageSrc(item.image_base64);

                        return (
                          <div
                            key={item.id}
                            className="rounded-xl border border-slate-200/70 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/8 dark:bg-white/4"
                          >
                            <div>
                              <div className="h-40 w-full overflow-hidden rounded-xl border border-slate-200/70 bg-slate-50 dark:border-white/8 dark:bg-white/5">
                                {imageSrc ? (
                                  <img
                                    src={imageSrc}
                                    alt={item.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-gray-400 dark:text-white/30">
                                    <FiImage className="text-[22px]" />
                                  </div>
                                )}
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-2">
                                <span className="inline-flex h-6 items-center rounded-lg border border-slate-200/70 bg-slate-50 px-2 text-[10px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                                  Diagram
                                </span>
                                <span className="inline-flex h-6 items-center rounded-lg border border-slate-200/70 bg-slate-50 px-2 text-[10px] font-medium text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-white/40">
                                  ID: {item.id}
                                </span>
                              </div>

                              <p className="mt-2 line-clamp-2 text-[12px] font-semibold leading-5 text-[#1f2240] dark:text-white">
                                {item.name || "-"}
                              </p>

                              <p className="mt-1 line-clamp-3 text-[10.5px] leading-5 text-gray-500 dark:text-white/55">
                                {item.description?.trim()
                                  ? item.description
                                  : "No description"}
                              </p>

                              <div className="mt-2 space-y-1 text-[10.5px] text-gray-500 dark:text-white/55">
                                <p className="inline-flex items-center gap-1">
                                  <FiCalendar className="shrink-0" />
                                  Created: {formatDateTime(item.created_at)}
                                </p>
                                <p className="inline-flex items-center gap-1">
                                  <FiRefreshCw className="shrink-0" />
                                  Updated: {formatDateTime(item.updated_at)}
                                </p>
                              </div>

                              <div
                                className={[
                                  "mt-3 grid gap-2",
                                  isUserRole ? "grid-cols-1" : "grid-cols-3",
                                ].join(" ")}
                              >
                                <button
                                  type="button"
                                  className={[secondaryBtn, "w-full"].join(" ")}
                                  onClick={() => handleOpenDetail(item.id)}
                                >
                                  <FiEye className="text-[12px]" />
                                  Detail
                                </button>

                                {!isUserRole && (
                                  <>
                                    <button
                                      type="button"
                                      className={[editGradientBtn, "w-full"].join(
                                        " "
                                      )}
                                      onClick={() => handleOpenEdit(item.id)}
                                    >
                                      <FiEdit2 className="text-[12px]" />
                                      Edit
                                    </button>

                                    <button
                                      type="button"
                                      className={[deleteGradientBtn, "w-full"].join(
                                        " "
                                      )}
                                      onClick={() => setDeleteTarget(item)}
                                    >
                                      <FiTrash2 className="text-[12px]" />
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {!isUserRole && (
        <>
          <DiagramFormModal
            open={openFormModal}
            mode={modalMode}
            loading={formLoading}
            initialData={selectedDiagram}
            onClose={() => {
              if (!formLoading) setOpenFormModal(false);
            }}
            onSuccess={async () => {
              setOpenFormModal(false);
              await loadDiagrams();
            }}
          />

          <DiagramDeleteModal
            open={!!deleteTarget}
            data={deleteTarget}
            deleting={deleting}
            onClose={() => {
              if (!deleting) setDeleteTarget(null);
            }}
            onConfirm={handleDeleteDiagram}
          />
        </>
      )}
    </div>
  );
};

export default index;