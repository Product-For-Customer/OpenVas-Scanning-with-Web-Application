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
  FiHash,
  FiType,
  FiAlignLeft,
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
import DiagramNodeFormModal, {
  type DiagramNodeFormValues,
  type DiagramNodeModalMode,
} from "../modal/DiagramNodeFormModal";

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

type HoverCardState = {
  node: AppDiagramNodeResponse;
  left: number;
  top: number;
  arrowLeft: number;
  placeBelow: boolean;
};

const TOOLTIP_WIDTH = 260;
const TOOLTIP_ESTIMATED_HEIGHT = 210;
const TOOLTIP_GAP = 14;
const CONTAINER_PADDING = 12;

const DiagramNode: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const diagramIdParam = searchParams.get("diagramId");
  const diagramId = Number(diagramIdParam);

  const imageWrapperRef = useRef<HTMLDivElement | null>(null);
  const hoverLeaveTimerRef = useRef<number | null>(null);

  const [diagram, setDiagram] = useState<DiagramResponse | null>(null);
  const [nodes, setNodes] = useState<AppDiagramNodeResponse[]>([]);

  const [loading, setLoading] = useState(true); //@ts-ignore
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<DiagramNodeModalMode>("create");
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<AppDiagramNodeResponse | null>(null);
  const [draftPosition, setDraftPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const [hoverCard, setHoverCard] = useState<HoverCardState | null>(null);

  const imageSrc = useMemo(() => getImageSrc(diagram?.image_base64), [diagram?.image_base64]);

  const clearHoverLeaveTimer = () => {
    if (hoverLeaveTimerRef.current) {
      window.clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
  };

  const scheduleHideHoverCard = () => {
    clearHoverLeaveTimer();
    hoverLeaveTimerRef.current = window.setTimeout(() => {
      setHoverCard(null);
    }, 40);
  };

  useEffect(() => {
    return () => {
      clearHoverLeaveTimer();
    };
  }, []);

  const loadData = useCallback(
    async (showLoading = true) => {
      if (!diagramId || Number.isNaN(diagramId)) {
        setError("ไม่พบ DiagramID");
        setLoading(false);
        return;
      }

      if (showLoading) {
        setLoading(true);
      } else {
        setReloading(true);
      }

      setError("");

      try {
        const [diagramData, allNodes] = await Promise.all([
          ListDiagramByID(diagramId),
          ListAppDiagramNodes(),
        ]);

        if (!diagramData) {
          setError("ไม่สามารถโหลดข้อมูล Diagram ได้");
          setDiagram(null);
          setNodes([]);
          return;
        }

        const filteredNodes = (allNodes ?? [])
          .filter((item) => Number(item.diagram_id) === diagramId)
          .sort((a, b) => {
            const zA = Number(a.z_index ?? 0);
            const zB = Number(b.z_index ?? 0);
            if (zA !== zB) return zA - zB;
            return Number(a.id ?? 0) - Number(b.id ?? 0);
          });

        setDiagram(diagramData);
        setNodes(filteredNodes);
      } catch {
        setError("เกิดข้อผิดพลาดในการโหลดข้อมูล Diagram Node");
        setDiagram(null);
        setNodes([]);
      } finally {
        setLoading(false);
        setReloading(false);
      }
    },
    [diagramId]
  );

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  const handleOpenCreateByClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageWrapperRef.current || !diagramId) return;

    const target = e.target as HTMLElement;
    if (target.closest("[data-node-marker='true']") || target.closest("[data-hover-card='true']")) {
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

    setSelectedNode(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const handleOpenEdit = async (nodeId: number) => {
    setModalMode("edit");
    setSelectedNode(null);
    setDraftPosition(null);
    setModalOpen(true);
    setModalLoading(true);

    try {
      const node = await ListAppDiagramNodeByID(nodeId);
      if (!node) {
        message.error("ไม่สามารถโหลดข้อมูล node ได้");
        setModalOpen(false);
        return;
      }
      setSelectedNode(node);
      setHoverCard(null);
    } finally {
      setModalLoading(false);
    }
  };

  const handleSubmit = async (values: DiagramNodeFormValues) => {
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

      setModalOpen(false);
      setSelectedNode(null);
      setDraftPosition(null);
      await loadData(false);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteImmediate = async (node: AppDiagramNodeResponse | null) => {
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
      setModalOpen(false);
      setSelectedNode(null);
      setDraftPosition(null);
      await loadData(false);
    } finally {
      setModalLoading(false);
    }
  };

  const handleMarkerEnter = (
    node: AppDiagramNodeResponse,
    xPercent: number,
    yPercent: number
  ) => {
    clearHoverLeaveTimer();

    const wrapper = imageWrapperRef.current;
    if (!wrapper) return;

    const containerWidth = wrapper.clientWidth;
    const containerHeight = wrapper.clientHeight;

    const markerX = (xPercent / 100) * containerWidth;
    const markerY = (yPercent / 100) * containerHeight;

    let left = markerX - TOOLTIP_WIDTH / 2;
    left = clamp(left, CONTAINER_PADDING, containerWidth - TOOLTIP_WIDTH - CONTAINER_PADDING);

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
  };

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
          <div className="px-3 py-3 sm:px-4 sm:py-3.5 border-b border-gray-100 dark:border-white/10">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 min-w-0 bg-cyan-50 text-cyan-700 border border-cyan-200/80 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-400/20">
                    <FiLayers className="shrink-0 text-[10px]" />
                    <span className="truncate text-[9.5px] font-semibold tracking-wide">
                      Diagram Node Management
                    </span>
                  </div>

                  <div className={badgeCls}>
                    <FiCrosshair className="shrink-0 text-[10px] text-violet-500" />
                    <span className="truncate text-[9.5px] font-medium">
                      Click image to create node
                    </span>
                  </div>

                  <div className={badgeCls}>
                    <FiMapPin className="shrink-0 text-[10px] text-red-500" />
                    <span className="truncate text-[9.5px] font-medium">
                      {nodes.length} saved node{nodes.length > 1 ? "s" : ""}
                    </span>
                  </div>
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
                      กดบนรูปเพื่อสร้าง node ใหม่ และกด icon พิกัดเพื่อแก้ไข / ลบ
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
                  className="relative w-full overflow-hidden rounded-2xl border border-gray-200/80 bg-slate-50 dark:bg-white/5 dark:border-white/10 cursor-crosshair"
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
                          handleOpenEdit(node.id);
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

                  {hoverCard && (
                    <div
                      data-hover-card="true"
                      className="pointer-events-auto absolute z-999 w-65"
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
                                <FiHash className="text-[10px] text-sky-500" />
                                Task ID
                              </p>
                              <p className="text-[10.5px] font-medium text-slate-800 wrap-break-word">
                                {hoverCard.node.task_id || "-"}
                              </p>
                            </div>

                            <div className="pt-1">
                              <button
                                type="button"
                                className={editGradientBtn}
                                onClick={() => handleOpenEdit(hoverCard.node.id)}
                              >
                                <FiEdit2 className="text-[12px]" />
                                Edit Node
                              </button>
                            </div>
                          </div>
                        </div>

                        <div
                          className="absolute h-3 w-3 rotate-45 border-r border-b border-sky-100 bg-white"
                          style={{
                            left: hoverCard.arrowLeft,
                            top: hoverCard.placeBelow ? -6 : undefined,
                            bottom: hoverCard.placeBelow ? undefined : -6,
                            transform: `translateX(-50%) ${
                              hoverCard.placeBelow ? "rotate(225deg)" : "rotate(45deg)"
                            }`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <DiagramNodeFormModal
        open={modalOpen}
        mode={modalMode}
        loading={modalLoading}
        diagramName={diagram?.name ?? ""}
        initialData={selectedNode}
        draftPosition={draftPosition}
        onClose={() => {
          if (modalLoading) return;
          setModalOpen(false);
          setSelectedNode(null);
          setDraftPosition(null);
        }}
        onSubmit={handleSubmit}
        onDelete={
          modalMode === "edit" && selectedNode
            ? () => handleDeleteImmediate(selectedNode)
            : undefined
        }
      />
    </div>
  );
};

export default DiagramNode;