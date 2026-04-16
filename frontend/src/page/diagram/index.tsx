import React, { useEffect, useMemo, useRef, useState } from "react";
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
  FiLayers,
  FiCalendar,
  FiCheck,
  FiEye,
} from "react-icons/fi";
import {
  DeleteDiagramByID,
  ListDiagramByID,
  ListDiagrams,
  type DiagramResponse,
} from "../../services/diagram";
import DiagramFormModal from "./modal/DiagramFormModal";
import DiagramDeleteModal from "./modal/DiagramDeleteModal";
import message from "antd/es/message";
import { useNavigate } from "react-router-dom";

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

const Diagrams: React.FC = () => {
  const navigate = useNavigate();

  const [diagrams, setDiagrams] = useState<DiagramResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [openSort, setOpenSort] = useState(false);

  const [openFormModal, setOpenFormModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [selectedDiagram, setSelectedDiagram] =
    useState<DiagramResponse | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DiagramResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sortRef = useRef<HTMLDivElement | null>(null);

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

  const loadDiagrams = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await ListDiagrams();
      if (!data) {
        setError("ไม่สามารถโหลดข้อมูล Diagram ได้");
        setDiagrams([]);
        return;
      }

      setDiagrams(data);
    } catch {
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล Diagram");
      setDiagrams([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiagrams();
  }, []);

  const summary = useMemo(() => {
    const source = diagrams ?? [];
    return {
      total: source.length,
      withImage: source.filter((d) => !!d.image_base64?.trim()).length,
      updatedToday: source.filter((d) => {
        if (!d.updated_at) return false;
        const date = new Date(d.updated_at);
        const now = new Date();
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

    let items = [...diagrams];

    if (q) {
      items = items.filter((item) => {
        const name = item.name?.toLowerCase() ?? "";
        const description = item.description?.toLowerCase() ?? "";
        const createdAt = item.created_at?.toLowerCase?.() ?? "";
        const updatedAt = item.updated_at?.toLowerCase?.() ?? "";

        return (
          name.includes(q) ||
          description.includes(q) ||
          createdAt.includes(q) ||
          updatedAt.includes(q)
        );
      });
    }

    items.sort((a, b) => {
      switch (sortMode) {
        case "oldest":
          return (
            new Date(a.created_at ?? 0).getTime() -
            new Date(b.created_at ?? 0).getTime()
          );
        case "name_asc":
          return (a.name ?? "").localeCompare(b.name ?? "");
        case "name_desc":
          return (b.name ?? "").localeCompare(a.name ?? "");
        case "latest":
        default:
          return (
            new Date(b.updated_at ?? b.created_at ?? 0).getTime() -
            new Date(a.updated_at ?? a.created_at ?? 0).getTime()
          );
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

  const handleOpenCreate = () => {
    setModalMode("create");
    setSelectedDiagram(null);
    setFormLoading(false);
    setOpenFormModal(true);
  };

  const handleOpenEdit = async (diagramID: number) => {
    setModalMode("edit");
    setSelectedDiagram(null);
    setFormLoading(true);
    setOpenFormModal(true);

    const data = await ListDiagramByID(diagramID);
    if (!data) {
      setFormLoading(false);
      return;
    }

    setSelectedDiagram(data);
    setFormLoading(false);
  };

  const handleOpenDetail = (diagramID: number) => {
    navigate(`/admin/diagram-node?diagramId=${diagramID}`);
  };

  const handleDeleteDiagram = async () => {
    if (!deleteTarget?.id) return;

    setDeleting(true);
    try {
      const res = await DeleteDiagramByID(deleteTarget.id);
      if (!res) return;

      message.success("delete success");
      setDeleteTarget(null);
      await loadDiagrams();
    } finally {
      setDeleting(false);
    }
  };

  const shell = [
    "relative overflow-hidden rounded-[18px]",
    "bg-white border border-gray-200/80 shadow-sm",
    "dark:bg-white/5 dark:border-white/10 dark:ring-1 dark:ring-white/10 dark:shadow-none",
  ].join(" ");

  const inputCls = [
    "h-10 rounded-xl border px-3 text-[12px] outline-none transition w-full",
    "border-gray-200/80 bg-white text-[#1f2240] focus:ring-2 focus:ring-cyan-200",
    "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/35 dark:focus:ring-white/10",
  ].join(" ");

  const dropdownBtn = [
    "h-8 px-3 rounded-xl inline-flex items-center justify-between gap-2 transition min-w-0",
    "bg-white border border-gray-200/80 text-[11px] font-medium text-gray-600 hover:bg-gray-50",
    "dark:bg-white/5 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/8",
  ].join(" ");

  const primaryGradientBtn = [
    "inline-flex h-8 items-center justify-center gap-2 rounded-full px-3.5",
    "text-white text-[11px] font-medium shadow-sm transition-all duration-200",
    "bg-linear-to-r from-cyan-500 via-sky-500 to-blue-600",
    "hover:from-cyan-600 hover:via-sky-600 hover:to-blue-700",
    "focus:outline-none focus:ring-2 focus:ring-cyan-200",
    "dark:focus:ring-cyan-500/30",
  ].join(" ");

  const editGradientBtn = [
    "inline-flex h-8 items-center justify-center gap-2 rounded-full px-3.5",
    "text-white text-[11px] font-medium shadow-sm transition-all duration-200",
    "bg-linear-to-r from-sky-400 via-blue-400 to-indigo-500",
    "hover:from-sky-500 hover:via-blue-500 hover:to-indigo-600",
    "focus:outline-none focus:ring-2 focus:ring-sky-200",
    "dark:focus:ring-sky-500/30",
  ].join(" ");

  const deleteGradientBtn = [
    "inline-flex h-8 items-center justify-center gap-2 rounded-full px-3.5",
    "text-white text-[11px] font-medium shadow-sm transition-all duration-200",
    "bg-linear-to-r from-rose-400 via-red-400 to-rose-500",
    "hover:from-rose-500 hover:via-red-500 hover:to-rose-600",
    "focus:outline-none focus:ring-2 focus:ring-red-200",
    "dark:focus:ring-red-500/30",
  ].join(" ");

  const secondaryBtn = [
    "h-9 px-3 rounded-xl inline-flex items-center justify-center gap-2 transition text-[11px] font-semibold",
    "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50",
    "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/8",
  ].join(" ");

  return (
    <div className="w-full">
      <section className={shell}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-12 -right-8 h-24 w-24 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute -bottom-12 -left-8 h-24 w-24 rounded-full bg-violet-500/10 blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="border-b border-gray-100 px-3 py-3 dark:border-white/10 sm:px-4 sm:py-3.5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <div className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-cyan-200/80 bg-cyan-50 px-2 py-1 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300">
                    <FiLayers className="shrink-0 text-[10px]" />
                    <span className="truncate text-[9.5px] font-semibold tracking-wide">
                      Diagram Management
                    </span>
                  </div>

                  <div className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-2 py-1 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
                    <FiImage className="shrink-0 text-[10px] text-cyan-500" />
                    <span className="truncate text-[9.5px] font-medium">
                      {summary.total} diagrams
                    </span>
                  </div>

                  <div className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-2 py-1 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
                    <FiCheck className="shrink-0 text-[10px] text-emerald-500" />
                    <span className="truncate text-[9.5px] font-medium">
                      {summary.withImage} with image
                    </span>
                  </div>

                  <div className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-2 py-1 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
                    <FiRefreshCw className="shrink-0 text-[10px] text-violet-500" />
                    <span className="truncate text-[9.5px] font-medium">
                      {summary.updatedToday} updated today
                    </span>
                  </div>
                </div>

                <h2 className="wrap-break-word text-[14px] font-semibold tracking-tight text-[#1f2240] dark:text-white/90 sm:text-[16px]">
                  Diagrams
                </h2>
                <p className="mt-1 text-[10px] leading-4.5 text-gray-500 dark:text-white/55 sm:text-[11px]">
                  Manage diagram images, names, descriptions, and updates
                </p>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:w-auto lg:flex-col lg:items-end xl:flex-row xl:flex-wrap xl:items-center">
                <div className="relative hidden w-full md:block sm:w-auto">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 dark:text-white/35" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search diagrams."
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
                      <div className="absolute right-0 z-20 mt-2 w-[min(13rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#0B1220] dark:shadow-none">
                        <div className="py-1">
                          {[
                            { key: "latest", label: "Latest" },
                            { key: "oldest", label: "Oldest" },
                            { key: "name_asc", label: "Name A-Z" },
                            { key: "name_desc", label: "Name Z-A" },
                          ].map((opt) => (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => {
                                setSortMode(opt.key as SortMode);
                                setOpenSort(false);
                              }}
                              className={[
                                "w-full px-3 py-2 text-left text-[11px] transition",
                                sortMode === opt.key
                                  ? "bg-cyan-50 font-semibold text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300"
                                  : "text-gray-700 hover:bg-gray-50 dark:text-white/70 dark:hover:bg-white/8",
                              ].join(" ")}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenCreate}
                    className={primaryGradientBtn}
                  >
                    <FiPlus className="text-[12px]" />
                    <span className="text-[11px] font-medium">Add Diagram</span>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setView("list")}
                      className={[
                        "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition",
                        view === "list"
                          ? "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200"
                          : "border-gray-200/80 bg-white text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8",
                      ].join(" ")}
                    >
                      <FiList className="text-[13px]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setView("grid")}
                      className={[
                        "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition",
                        view === "grid"
                          ? "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-200"
                          : "border-gray-200/80 bg-white text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/8",
                      ].join(" ")}
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
                No Data
              </div>
            )}

            {!loading && !error && filteredItems.length > 0 && (
              <>
                {view === "list" ? (
                  <div className="min-h-105 max-h-105 divide-y divide-gray-100 overflow-y-auto dark:divide-white/10">
                    {filteredItems.map((item) => {
                      const imageSrc = getImageSrc(item.image_base64);

                      return (
                        <div
                          key={item.id}
                          className="relative px-3 py-3 sm:px-4 sm:py-3.5"
                        >
                          <div className="pointer-events-none absolute right-0 top-0 h-full w-24 bg-cyan-400/10 opacity-50 blur-3xl" />

                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-gray-200/80 bg-slate-50 dark:border-white/10 dark:bg-white/5 sm:h-18 sm:w-28">
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
                                  <span className="inline-flex items-center rounded-full border border-cyan-200/70 bg-cyan-50 px-2 py-0.5 text-[9px] font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300">
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

                              <button
                                type="button"
                                className={editGradientBtn}
                                onClick={() => handleOpenEdit(item.id)}
                              >
                                <FiEdit2 className="text-[12px]" />
                                <span className="text-[11px] font-medium">Edit</span>
                              </button>

                              <button
                                type="button"
                                className={deleteGradientBtn}
                                onClick={() => setDeleteTarget(item)}
                              >
                                <FiTrash2 className="text-[12px]" />
                                <span className="text-[11px] font-medium">Delete</span>
                              </button>
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
                            className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:ring-1 dark:ring-white/10 dark:shadow-none"
                          >
                            <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-cyan-400/10 blur-3xl" />

                            <div className="relative">
                              <div className="h-40 w-full overflow-hidden rounded-xl border border-gray-200/80 bg-slate-50 dark:border-white/10 dark:bg-white/5">
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
                                <span className="inline-flex h-6 items-center rounded-lg border border-cyan-200/70 bg-cyan-50 px-2 text-[10px] font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300">
                                  Diagram
                                </span>

                                <span className="inline-flex h-6 items-center rounded-lg border border-slate-200/70 bg-slate-50 px-2 text-[10px] font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
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

                              <div className="mt-3 grid grid-cols-3 gap-2">
                                <button
                                  type="button"
                                  className={[secondaryBtn, "w-full"].join(" ")}
                                  onClick={() => handleOpenDetail(item.id)}
                                >
                                  <FiEye className="text-[12px]" />
                                  Detail
                                </button>

                                <button
                                  type="button"
                                  className={[editGradientBtn, "w-full"].join(" ")}
                                  onClick={() => handleOpenEdit(item.id)}
                                >
                                  <FiEdit2 className="text-[12px]" />
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  className={[deleteGradientBtn, "w-full"].join(" ")}
                                  onClick={() => setDeleteTarget(item)}
                                >
                                  <FiTrash2 className="text-[12px]" />
                                  Delete
                                </button>
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
    </div>
  );
};

export default Diagrams;