import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import message from "antd/es/message";
import {
  FiArrowLeft,
  FiMapPin,
  FiImage,
  FiEdit2,
  FiLayers,
  FiCrosshair,
  FiType,
  FiAlignLeft,
  FiCpu,
  FiCalendar,
  FiAlertTriangle,
  FiBarChart2,
  FiHash,
  FiActivity,
  FiUser,
} from "react-icons/fi";
import {
  CreateAppDiagramNode,
  DeleteAppDiagramNodeByID,
  ListAppDiagramNodeByID,
  ListAppDiagramNodes,
  ListDiagramByID,
  UpdateAppDiagramNodeByID,
  type AppDiagramNodeResponse,
  type CreateAppDiagramNodeInput,
  type DiagramResponse,
  type UpdateAppDiagramNodeInput,
} from "../../../services/diagram";
import { ListALLTarget, type AllTargetDTO } from "../../../services";
import DiagramNodeFormModal, {
  type DiagramNodeFormValues,
  type DiagramNodeModalMode,
} from "../Model/DiagramNodeFormModal";
import { useAuth } from "../../../contexts/AuthContext";

const getImageSrc = (value?: string) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:image")) return trimmed;
  return `data:image/png;base64,${trimmed}`;
};

const clamp = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
};

const toNumber = (value: unknown, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizePercentValue = (value: number) => clamp(value, 0, 100);

const normalizeSizePercent = (value: number, fallback: number) => {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return clamp(value, 1, 100);
};

const formatDetectedDateTime = (value?: string) => {
  if (!value) return "-";

  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;

    return d.toLocaleString("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return value;
  }
};

const formatRiskScore = (value?: number) => {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
};

const formatSeverity = (value?: number) => {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
};

const getRiskScoreTone = (value?: number) => {
  const score = Number(value ?? 0);

  if (!Number.isFinite(score)) {
    return {
      box: "border-slate-200 bg-slate-50",
      label: "text-sky-700",
      value: "text-slate-800",
      dot: "bg-slate-400",
    };
  }

  if (score >= 9) {
    return {
      box: "border-red-200 bg-red-50",
      label: "text-red-700",
      value: "text-red-700",
      dot: "bg-red-500",
    };
  }

  if (score >= 7) {
    return {
      box: "border-orange-200 bg-orange-50",
      label: "text-orange-700",
      value: "text-orange-700",
      dot: "bg-orange-500",
    };
  }

  if (score >= 4) {
    return {
      box: "border-amber-200 bg-amber-50",
      label: "text-amber-700",
      value: "text-amber-700",
      dot: "bg-amber-500",
    };
  }

  if (score > 0) {
    return {
      box: "border-lime-200 bg-lime-50",
      label: "text-lime-700",
      value: "text-lime-700",
      dot: "bg-lime-500",
    };
  }

  return {
    box: "border-emerald-200 bg-emerald-50",
    label: "text-emerald-700",
    value: "text-emerald-700",
    dot: "bg-emerald-500",
  };
};

const getLevelTone = (level?: string) => {
  const normalized = String(level ?? "").trim().toLowerCase();

  if (normalized === "critical") {
    return {
      box: "border-red-200 bg-red-50",
      label: "text-red-700",
      value: "text-red-700",
      dot: "bg-red-500",
    };
  }

  return {
    box: "border-slate-200 bg-slate-50",
    label: "text-sky-700",
    value: "text-slate-800",
    dot: "bg-slate-400",
  };
};

type HoverCardState = {
  node: AppDiagramNodeResponse;
  left: number;
  top: number;
  arrowLeft: number;
  placeBelow: boolean;
};

type ModalAnchorPoint = {
  clientX: number;
  clientY: number;
};

const TOOLTIP_WIDTH = 300;
const TOOLTIP_ESTIMATED_HEIGHT = 420;
const TOOLTIP_GAP = 14;
const CONTAINER_PADDING = 12;

const index: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuth() as any;

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

  const diagramIdParam = searchParams.get("diagramId");
  const diagramId = Number(diagramIdParam);

  const imageWrapperRef = useRef<HTMLDivElement | null>(null);
  const hoverLeaveTimerRef = useRef<number | null>(null);

  const hasFetchedRef = useRef(false);
  const isLoadingDataRef = useRef(false);
  const isMountedRef = useRef(false);
  const editRequestIdRef = useRef(0);

  const [diagram, setDiagram] = useState<DiagramResponse | null>(null);
  const [nodes, setNodes] = useState<AppDiagramNodeResponse[]>([]);
  const [allNodes, setAllNodes] = useState<AppDiagramNodeResponse[]>([]);
  const [targets, setTargets] = useState<AllTargetDTO[]>([]);

  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<DiagramNodeModalMode>("create");
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<AppDiagramNodeResponse | null>(
    null
  );
  const [draftPosition, setDraftPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [modalAnchorPoint, setModalAnchorPoint] =
    useState<ModalAnchorPoint | null>(null);

  const [hoverCard, setHoverCard] = useState<HoverCardState | null>(null);

  const imageSrc = useMemo(
    () => getImageSrc(diagram?.image_base64),
    [diagram?.image_base64]
  );

  const targetMap = useMemo(() => {
    const map = new Map<string, AllTargetDTO>();

    for (const target of targets) {
      const key = String(target.task_id || "").trim();
      if (!key) continue;
      map.set(key, target);
    }

    return map;
  }, [targets]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const clearHoverLeaveTimer = useCallback(() => {
    if (hoverLeaveTimerRef.current) {
      window.clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
  }, []);

  const scheduleHideHoverCard = useCallback(() => {
    clearHoverLeaveTimer();
    hoverLeaveTimerRef.current = window.setTimeout(() => {
      if (isMountedRef.current) {
        setHoverCard(null);
      }
    }, 40);
  }, [clearHoverLeaveTimer]);

  useEffect(() => {
    return () => {
      clearHoverLeaveTimer();
    };
  }, [clearHoverLeaveTimer]);

  const loadData = useCallback(
    async (showLoading = true) => {
      if (!diagramId || Number.isNaN(diagramId)) {
        if (isMountedRef.current) {
          setError("ไม่พบ DiagramID");
          setLoading(false);
          setReloading(false);
        }
        return;
      }

      if (isLoadingDataRef.current) return;

      try {
        isLoadingDataRef.current = true;

        if (isMountedRef.current) {
          if (showLoading) {
            setLoading(true);
          } else {
            setReloading(true);
          }
          setError("");
        }

        const [diagramData, fetchedAllNodes, fetchedTargets] = await Promise.all([
          ListDiagramByID(diagramId),
          ListAppDiagramNodes(),
          ListALLTarget(),
        ]);

        if (!isMountedRef.current) return;

        if (!diagramData) {
          setError("ไม่สามารถโหลดข้อมูล Diagram ได้");
          setDiagram(null);
          setNodes([]);
          setAllNodes([]);
          setTargets([]);
          return;
        }

        const safeAllNodes = Array.isArray(fetchedAllNodes)
          ? fetchedAllNodes
          : [];
        const safeTargets = Array.isArray(fetchedTargets) ? fetchedTargets : [];

        const filteredNodes = safeAllNodes
          .filter((item) => Number(item.diagram_id) === diagramId)
          .sort((a, b) => {
            const zA = Number(a.z_index ?? 0);
            const zB = Number(b.z_index ?? 0);
            if (zA !== zB) return zA - zB;
            return Number(a.id ?? 0) - Number(b.id ?? 0);
          });

        setDiagram(diagramData);
        setAllNodes(safeAllNodes);
        setNodes(filteredNodes);
        setTargets(safeTargets);
      } catch (err) {
        console.error("loadData error:", err);

        if (!isMountedRef.current) return;

        setError("เกิดข้อผิดพลาดในการโหลดข้อมูล Diagram Node");
        setDiagram(null);
        setNodes([]);
        setAllNodes([]);
        setTargets([]);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setReloading(false);
        }
        isLoadingDataRef.current = false;
      }
    },
    [diagramId]
  );

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void loadData(true);
  }, [loadData]);

  const handleOpenCreateByClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isUserRole) return;
      if (!imageWrapperRef.current || !diagramId) return;

      const target = e.target as HTMLElement;
      if (
        target.closest("[data-node-marker='true']") ||
        target.closest("[data-hover-card='true']")
      ) {
        return;
      }

      const rect = imageWrapperRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const xPercent = normalizePercentValue((clickX / rect.width) * 100);
      const yPercent = normalizePercentValue((clickY / rect.height) * 100);

      setDraftPosition({
        x: xPercent,
        y: yPercent,
        width: 12,
        height: 9,
      });

      setModalAnchorPoint({
        clientX: e.clientX,
        clientY: e.clientY,
      });

      setSelectedNode(null);
      setModalMode("create");
      setModalOpen(true);
    },
    [diagramId, isUserRole]
  );

  const handleOpenEdit = useCallback(
    async (nodeId: number, anchorPoint?: ModalAnchorPoint) => {
      if (isUserRole) return;

      const requestId = ++editRequestIdRef.current;

      setModalAnchorPoint(
        anchorPoint ?? {
          clientX: window.innerWidth / 2,
          clientY: window.innerHeight / 2,
        }
      );
      setModalMode("edit");
      setSelectedNode(null);
      setDraftPosition(null);
      setModalOpen(true);
      setModalLoading(true);

      try {
        const node = await ListAppDiagramNodeByID(nodeId);

        if (!isMountedRef.current) return;
        if (requestId !== editRequestIdRef.current) return;

        if (!node) {
          message.error("ไม่สามารถโหลดข้อมูล node ได้");
          setModalOpen(false);
          return;
        }

        setSelectedNode(node);
        setHoverCard(null);
      } catch (err) {
        console.error("handleOpenEdit error:", err);

        if (!isMountedRef.current) return;
        if (requestId !== editRequestIdRef.current) return;

        message.error("ไม่สามารถโหลดข้อมูล node ได้");
        setModalOpen(false);
      } finally {
        if (isMountedRef.current && requestId === editRequestIdRef.current) {
          setModalLoading(false);
        }
      }
    },
    [isUserRole]
  );

  const handleSubmit = useCallback(
    async (values: DiagramNodeFormValues) => {
      if (!diagramId || Number.isNaN(diagramId)) {
        message.error("ไม่พบ DiagramID");
        return;
      }

      setModalLoading(true);

      try {
        if (modalMode === "create") {
          const payload: CreateAppDiagramNodeInput = {
            diagram_id: diagramId,
            task_id: values.task_id.trim(),
            label: values.label.trim(),
            description: values.description.trim(),
            icon: values.icon.trim(),
            x: normalizePercentValue(values.x),
            y: normalizePercentValue(values.y),
            width: normalizeSizePercent(values.width, 12),
            height: normalizeSizePercent(values.height, 9),
            z_index: toNumber(values.z_index, 0),
          };

          const res = await CreateAppDiagramNode(payload);
          if (!res) {
            message.error("สร้าง node ไม่สำเร็จ");
            return;
          }

          message.success("create success");
        } else {
          if (!selectedNode?.id) {
            message.error("ไม่พบ node ที่ต้องการแก้ไข");
            return;
          }

          const payload: UpdateAppDiagramNodeInput = {
            diagram_id: diagramId,
            task_id: values.task_id.trim(),
            label: values.label.trim(),
            description: values.description.trim(),
            icon: values.icon.trim(),
            x: normalizePercentValue(values.x),
            y: normalizePercentValue(values.y),
            width: normalizeSizePercent(values.width, 12),
            height: normalizeSizePercent(values.height, 9),
            z_index: toNumber(values.z_index, 0),
          };

          const res = await UpdateAppDiagramNodeByID(selectedNode.id, payload);
          if (!res) {
            message.error("แก้ไข node ไม่สำเร็จ");
            return;
          }

          message.success("update success");
        }

        if (!isMountedRef.current) return;

        setModalOpen(false);
        setSelectedNode(null);
        setDraftPosition(null);
        setModalAnchorPoint(null);
        await loadData(false);
      } catch (err) {
        console.error("handleSubmit error:", err);
      } finally {
        if (isMountedRef.current) {
          setModalLoading(false);
        }
      }
    },
    [diagramId, modalMode, selectedNode, loadData]
  );

  const handleDeleteImmediate = useCallback(
    async (node: AppDiagramNodeResponse | null) => {
      if (isUserRole) return;
      if (!node?.id) {
        message.error("ไม่พบ node ที่ต้องการลบ");
        return;
      }

      setModalLoading(true);
      try {
        const res = await DeleteAppDiagramNodeByID(node.id);
        if (!res) {
          message.error("ลบ node ไม่สำเร็จ");
          return;
        }

        message.success("delete success");

        if (!isMountedRef.current) return;

        setModalOpen(false);
        setSelectedNode(null);
        setDraftPosition(null);
        setModalAnchorPoint(null);
        await loadData(false);
      } catch (err) {
        console.error("handleDeleteImmediate error:", err);
      } finally {
        if (isMountedRef.current) {
          setModalLoading(false);
        }
      }
    },
    [loadData, isUserRole]
  );

  const handleMarkerEnter = useCallback(
    (node: AppDiagramNodeResponse, xPercent: number, yPercent: number) => {
      clearHoverLeaveTimer();

      const wrapper = imageWrapperRef.current;
      if (!wrapper) return;

      const containerWidth = wrapper.clientWidth;
      const containerHeight = wrapper.clientHeight;

      const markerX = (xPercent / 100) * containerWidth;
      const markerY = (yPercent / 100) * containerHeight;

      let left = markerX - TOOLTIP_WIDTH / 2;
      left = clamp(
        left,
        CONTAINER_PADDING,
        containerWidth - TOOLTIP_WIDTH - CONTAINER_PADDING
      );

      const placeBelow =
        markerY - TOOLTIP_ESTIMATED_HEIGHT - TOOLTIP_GAP < CONTAINER_PADDING;

      let top = placeBelow
        ? markerY + TOOLTIP_GAP
        : markerY - TOOLTIP_ESTIMATED_HEIGHT - TOOLTIP_GAP;

      top = clamp(
        top,
        CONTAINER_PADDING,
        containerHeight - TOOLTIP_ESTIMATED_HEIGHT - CONTAINER_PADDING
      );

      const arrowLeft = clamp(markerX - left, 18, TOOLTIP_WIDTH - 18);

      setHoverCard({
        node,
        left,
        top,
        arrowLeft,
        placeBelow,
      });
    },
    [clearHoverLeaveTimer]
  );

  const shell = [
    "relative overflow-hidden rounded-[18px]",
    "bg-white border border-gray-200/80 shadow-sm",
    "dark:bg-white/5 dark:border-white/10 dark:ring-1 dark:ring-white/10 dark:shadow-none",
  ].join(" ");

  const secondaryBtn = [
    "h-9 px-3 rounded-xl inline-flex items-center justify-center gap-2 transition text-[11px] font-semibold",
    "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50",
    "dark:bg-white/5 dark:border-white/10 dark:text-white/75 dark:hover:bg-white/8",
  ].join(" ");

  const badgeCls = [
    "inline-flex items-center gap-1.5 rounded-full px-2 py-1 min-w-0",
    "bg-slate-50 text-slate-600 border border-slate-200/80",
    "dark:bg-white/5 dark:text-white/65 dark:border-white/10",
  ].join(" ");

  const editGradientBtn = [
    "w-full h-9 rounded-xl inline-flex items-center justify-center gap-2",
    "text-white shadow-sm transition-all duration-200 text-[11px] font-semibold",
    "bg-linear-to-r from-sky-400 via-blue-400 to-indigo-500",
    "hover:from-sky-500 hover:via-blue-500 hover:to-indigo-600",
    "focus:outline-none focus:ring-2 focus:ring-sky-200",
    "dark:focus:ring-sky-500/30",
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
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 min-w-0 bg-cyan-50 text-cyan-700 border border-cyan-200/80 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20">
                    <FiLayers className="shrink-0 text-[10px]" />
                    <span className="truncate text-[9.5px] font-semibold tracking-wide">
                      Diagram Node Management
                    </span>
                  </div>

                  {!isUserRole && (
                    <div className={badgeCls}>
                      <FiCrosshair className="shrink-0 text-[10px] text-violet-500" />
                      <span className="truncate text-[9.5px] font-medium">
                        Click image to create node
                      </span>
                    </div>
                  )}

                  <div className={badgeCls}>
                    <FiMapPin className="shrink-0 text-[10px] text-red-500" />
                    <span className="truncate text-[9.5px] font-medium">
                      {nodes.length} saved node{nodes.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  {reloading && (
                    <div className={badgeCls}>
                      <span className="truncate text-[9.5px] font-medium">
                        Reloading...
                      </span>
                    </div>
                  )}
                </div>

                <h2 className="wrap-break-word text-[14px] font-semibold tracking-tight text-[#1f2240] dark:text-white/90 sm:text-[16px]">
                  {diagram?.name || "Diagram Node"}
                </h2>
                <p className="mt-1 text-[10px] leading-4.5 text-gray-500 dark:text-white/55 sm:text-[11px]">
                  {diagram?.description?.trim() || "No description"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={secondaryBtn}
                  onClick={() => navigate("/admin/diagrams")}
                >
                  <FiArrowLeft className="text-[12px]" />
                  Back
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-[11px] text-gray-500 dark:text-white/55">
              Loading.
            </div>
          ) : error ? (
            <div className="px-4 py-6 text-[11px] text-red-600 dark:text-red-200">
              {error}
            </div>
          ) : !diagram ? (
            <div className="px-4 py-6 text-[11px] text-gray-500 dark:text-white/55">
              No Data
            </div>
          ) : (
            <div className="p-3 sm:p-4">
              <div className="rounded-2xl border border-gray-200/80 bg-white p-3 shadow-sm dark:bg-white/5 dark:border-white/10 dark:ring-1 dark:ring-white/10 dark:shadow-none">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-[#1f2240] dark:text-white/90">
                      Interactive Diagram
                    </h3>
                    <p className="mt-1 text-[10.5px] text-gray-500 dark:text-white/55">
                      {isUserRole
                        ? "เลื่อนเมาส์เหนือ marker เพื่อดูรายละเอียด"
                        : "กดบนรูปเพื่อสร้าง node ใหม่ และกด icon พิกัดเพื่อแก้ไข / ลบ"}
                    </p>
                  </div>

                  <div className={badgeCls}>
                    <FiEdit2 className="shrink-0 text-[10px] text-cyan-500" />
                    <span className="truncate text-[9.5px] font-medium">
                      Hover marker to view detail
                    </span>
                  </div>
                </div>

                <div
                  ref={imageWrapperRef}
                  className={[
                    "relative w-full overflow-hidden rounded-2xl border border-gray-200/80 bg-slate-50 dark:bg-white/5 dark:border-white/10",
                    isUserRole ? "cursor-default" : "cursor-crosshair",
                  ].join(" ")}
                  onClick={handleOpenCreateByClick}
                  onMouseLeave={scheduleHideHoverCard}
                  onMouseEnter={clearHoverLeaveTimer}
                >
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={diagram.name}
                      className="block w-full h-auto select-none pointer-events-none"
                      draggable={false}
                    />
                  ) : (
                    <div className="h-130 w-full flex items-center justify-center text-gray-400 dark:text-white/30">
                      <div className="flex flex-col items-center gap-2">
                        <FiImage className="text-[32px]" />
                        <span className="text-[11px]">No image</span>
                      </div>
                    </div>
                  )}

                  {nodes.map((node) => {
                    const x = normalizePercentValue(toNumber(node.x, 0));
                    const y = normalizePercentValue(toNumber(node.y, 0));
                    const zIndex = toNumber(node.z_index, 1);

                    return (
                      <button
                        key={node.id}
                        type="button"
                        data-node-marker="true"
                        title={node.label || `Node ${node.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isUserRole) return;
                          void handleOpenEdit(node.id, {
                            clientX: e.clientX,
                            clientY: e.clientY,
                          });
                        }}
                        onMouseEnter={() => handleMarkerEnter(node, x, y)}
                        onMouseLeave={scheduleHideHoverCard}
                        className={[
                          "absolute -translate-x-1/2 -translate-y-full",
                          "inline-flex items-center justify-center",
                          "focus:outline-none",
                        ].join(" ")}
                        style={{
                          left: `${x}%`,
                          top: `${y}%`,
                          zIndex,
                        }}
                      >
                        <span className="relative inline-flex items-center justify-center">
                          <span className="absolute h-8 w-8 rounded-full bg-red-400/25 blur-md transition-all" />
                          <FiMapPin className="relative text-[30px] text-red-500 drop-shadow-[0_4px_10px_rgba(239,68,68,0.45)] transition-transform duration-200 hover:scale-110" />
                        </span>
                      </button>
                    );
                  })}

                  {hoverCard &&
                    (() => {
                      const matchedTarget = targetMap.get(
                        String(hoverCard.node.task_id || "").trim()
                      );

                      const targetName = String(matchedTarget?.name || "").trim();
                      const targetIP = String(matchedTarget?.ip || "").trim();
                      const detectedDate = formatDetectedDateTime(
                        matchedTarget?.detected_date
                      );
                      const riskScore = formatRiskScore(
                        matchedTarget?.risk_score
                      );
                      const level =
                        String(matchedTarget?.level || "").trim() || "-";
                      const total = Number(matchedTarget?.total ?? 0);
                      const severity = formatSeverity(matchedTarget?.severity);

                      const targetDisplay =
                        targetName || targetIP
                          ? [targetName || "-", targetIP || "-"].join(" - ")
                          : hoverCard.node.task_id || "-";

                      const riskTone = getRiskScoreTone(
                        matchedTarget?.risk_score
                      );
                      const levelTone = getLevelTone(matchedTarget?.level);

                      return (
                        <div
                          data-hover-card="true"
                          className="pointer-events-auto absolute z-999 w-75"
                          style={{
                            left: hoverCard.left,
                            top: hoverCard.top,
                          }}
                          onMouseEnter={clearHoverLeaveTimer}
                          onMouseLeave={scheduleHideHoverCard}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="relative overflow-visible">
                            <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-[0_20px_40px_rgba(14,165,233,0.14)]">
                              <div className="border-b border-sky-100 bg-linear-to-r from-sky-50 via-white to-cyan-50 px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm">
                                    <FiMapPin className="text-[14px]" />
                                  </span>
                                  <div className="min-w-0 text-left">
                                    <p className="text-[11px] font-semibold text-slate-800">
                                      Node Detail
                                    </p>
                                    <p className="text-[9.5px] text-slate-500">
                                      Marker information
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2 px-3 py-3 text-left">
                                <div>
                                  <p className="mb-1 flex items-center gap-1.5 text-[9.5px] font-medium text-sky-700">
                                    <FiType className="text-[10px] text-sky-500" />
                                    Label
                                  </p>
                                  <p className="text-[11px] font-semibold text-slate-800 wrap-break-word">
                                    {hoverCard.node.label || "-"}
                                  </p>
                                </div>

                                <div>
                                  <p className="mb-1 flex items-center gap-1.5 text-[9.5px] font-medium text-sky-700">
                                    <FiAlignLeft className="text-[10px] text-sky-500" />
                                    Description
                                  </p>
                                  <p className="text-[10.5px] leading-5 text-slate-600 wrap-break-word">
                                    {hoverCard.node.description?.trim()
                                      ? hoverCard.node.description
                                      : "No description"}
                                  </p>
                                </div>

                                <div>
                                  <p className="mb-1 flex items-center gap-1.5 text-[9.5px] font-medium text-sky-700">
                                    <FiUser className="text-[10px] text-sky-500" />
                                    App User ID
                                  </p>
                                  <p className="text-[10.5px] font-medium text-slate-800 wrap-break-word">
                                    {hoverCard.node.app_user_id || "-"}
                                  </p>
                                </div>

                                <div>
                                  <p className="mb-1 flex items-center gap-1.5 text-[9.5px] font-medium text-sky-700">
                                    <FiCpu className="text-[10px] text-sky-500" />
                                    Target
                                  </p>
                                  <p className="text-[10.5px] font-medium text-slate-800 wrap-break-word">
                                    {targetDisplay}
                                  </p>
                                </div>

                                <div>
                                  <p className="mb-1 flex items-center gap-1.5 text-[9.5px] font-medium text-sky-700">
                                    <FiCalendar className="text-[10px] text-sky-500" />
                                    Detected
                                  </p>
                                  <p className="text-[10.5px] font-medium text-slate-800 wrap-break-word">
                                    {detectedDate}
                                  </p>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div
                                    className={`rounded-xl border px-2.5 py-2 ${riskTone.box}`}
                                  >
                                    <p
                                      className={`mb-1 flex items-center gap-1.5 text-[9px] font-medium ${riskTone.label}`}
                                    >
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full ${riskTone.dot}`}
                                      />
                                      <FiBarChart2 className="text-[10px]" />
                                      Risk Score
                                    </p>
                                    <p
                                      className={`text-[10.5px] font-semibold ${riskTone.value}`}
                                    >
                                      {riskScore}
                                    </p>
                                  </div>

                                  <div
                                    className={`rounded-xl border px-2.5 py-2 ${levelTone.box}`}
                                  >
                                    <p
                                      className={`mb-1 flex items-center gap-1.5 text-[9px] font-medium ${levelTone.label}`}
                                    >
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full ${levelTone.dot}`}
                                      />
                                      <FiAlertTriangle className="text-[10px]" />
                                      Level
                                    </p>
                                    <p
                                      className={`text-[10.5px] font-semibold ${levelTone.value}`}
                                    >
                                      {level}
                                    </p>
                                  </div>

                                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                                    <p className="mb-1 flex items-center gap-1.5 text-[9px] font-medium text-sky-700">
                                      <FiHash className="text-[10px] text-sky-500" />
                                      Total
                                    </p>
                                    <p className="text-[10.5px] font-semibold text-slate-800">
                                      {total}
                                    </p>
                                  </div>

                                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                                    <p className="mb-1 flex items-center gap-1.5 text-[9px] font-medium text-sky-700">
                                      <FiActivity className="text-[10px] text-sky-500" />
                                      Severity
                                    </p>
                                    <p className="text-[10.5px] font-semibold text-slate-800">
                                      {severity}
                                    </p>
                                  </div>
                                </div>

                                {!isUserRole && (
                                  <div className="pt-1">
                                    <button
                                      type="button"
                                      className={editGradientBtn}
                                      onClick={(e) =>
                                        void handleOpenEdit(hoverCard.node.id, {
                                          clientX: e.clientX,
                                          clientY: e.clientY,
                                        })
                                      }
                                    >
                                      <FiEdit2 className="text-[12px]" />
                                      Edit Node
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div
                              className="absolute h-3 w-3 rotate-45 border-r border-b border-sky-100 bg-white"
                              style={{
                                left: hoverCard.arrowLeft,
                                top: hoverCard.placeBelow ? -6 : undefined,
                                bottom: hoverCard.placeBelow ? undefined : -6,
                                transform: `translateX(-50%) ${
                                  hoverCard.placeBelow
                                    ? "rotate(225deg)"
                                    : "rotate(45deg)"
                                }`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {!isUserRole && (
        <DiagramNodeFormModal
          open={modalOpen}
          mode={modalMode}
          loading={modalLoading}
          diagramName={diagram?.name ?? ""}
          initialData={selectedNode}
          draftPosition={draftPosition}
          allDiagramNodes={allNodes}
          currentNodeId={selectedNode?.id ?? null}
          anchorPoint={modalAnchorPoint}
          onClose={() => {
            if (modalLoading) return;
            setModalOpen(false);
            setSelectedNode(null);
            setDraftPosition(null);
            setModalAnchorPoint(null);
          }}
          onSubmit={handleSubmit}
          onDelete={
            modalMode === "edit" && selectedNode
              ? () => handleDeleteImmediate(selectedNode)
              : undefined
          }
        />
      )}
    </div>
  );
};

export default index;