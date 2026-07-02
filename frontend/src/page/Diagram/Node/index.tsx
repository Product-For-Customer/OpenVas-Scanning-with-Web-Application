import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import message from "antd/es/message";
import {
  FiArrowLeft,
  FiMapPin,
  FiImage,
  FiEdit2,
  FiLayers,
  FiAlignLeft,
  FiPlus,
  FiRefreshCw,
  FiTarget,
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
import { useStateContext } from "../../../contexts/ProviderContext";
import { useLanguage } from "../../../contexts/LanguageContext";

// ── helpers ───────────────────────────────────────────────────────────────────

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

const formatRiskScore = (value?: number) => {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
};

const getRiskScoreTone = (value?: number) => {
  const score = Number(value ?? 0);
  if (!Number.isFinite(score)) return { box: "border-slate-200 bg-slate-50", label: "text-sky-700", value: "text-slate-800", dot: "bg-slate-400" };
  if (score >= 9) return { box: "border-red-200 bg-red-50", label: "text-red-700", value: "text-red-700", dot: "bg-red-500" };
  if (score >= 7) return { box: "border-orange-200 bg-orange-50", label: "text-orange-700", value: "text-orange-700", dot: "bg-orange-500" };
  if (score >= 4) return { box: "border-amber-200 bg-amber-50", label: "text-amber-700", value: "text-amber-700", dot: "bg-amber-500" };
  if (score > 0)  return { box: "border-lime-200 bg-lime-50", label: "text-lime-700", value: "text-lime-700", dot: "bg-lime-500" };
  return { box: "border-emerald-200 bg-emerald-50", label: "text-emerald-700", value: "text-emerald-700", dot: "bg-emerald-500" };
};

type HoverCardState = {
  node: AppDiagramNodeResponse;
  left: number; top: number; arrowLeft: number; placeBelow: boolean;
};

type ModalAnchorPoint = { clientX: number; clientY: number };

const TOOLTIP_WIDTH = 272;
const TOOLTIP_ESTIMATED_HEIGHT = 390;
const TOOLTIP_GAP = 14;
const CONTAINER_PADDING = 12;

// ── Main component ────────────────────────────────────────────────────────────

const DiagramNodePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isUser: isUserRole } = useAuth();
  const { currentColor } = useStateContext();
  const { t } = useLanguage();
  const accentGrad = `linear-gradient(135deg, ${currentColor}, color-mix(in srgb, ${currentColor} 65%, #a855f7))`;

  const diagramIdParam = searchParams.get("diagramId");
  const diagramId = Number(diagramIdParam);

  const imageWrapperRef = useRef<HTMLDivElement | null>(null);
  const hoverLeaveTimerRef = useRef<number | null>(null);
  const hasFetchedRef = useRef(false);
  const isLoadingDataRef = useRef(false);
  const isMountedRef = useRef(false);
  const editRequestIdRef = useRef(0);

  const [diagram, setDiagram] = useState<DiagramResponse | null>(null);
  const [nodes, setNodes] = useState<AppDiagramNodeResponse[]>([]);//@ts-ignore
  const [allNodes, setAllNodes] = useState<AppDiagramNodeResponse[]>([]);
  const [targets, setTargets] = useState<AllTargetDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<DiagramNodeModalMode>("create");
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<AppDiagramNodeResponse | null>(null);
  const [draftPosition, setDraftPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);//@ts-ignore
  const [modalAnchorPoint, setModalAnchorPoint] = useState<ModalAnchorPoint | null>(null);
  const [hoverCard, setHoverCard] = useState<HoverCardState | null>(null);

  const imageSrc = useMemo(() => getImageSrc(diagram?.image_base64), [diagram?.image_base64]);

  const targetMap = useMemo(() => {
    const map = new Map<string, AllTargetDTO>();
    for (const target of targets) {
      const key = String(target.task_id || "").trim();
      if (key) map.set(key, target);
    }
    return map;
  }, [targets]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
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
      if (isMountedRef.current) setHoverCard(null);
    }, 40);
  }, [clearHoverLeaveTimer]);

  useEffect(() => () => { clearHoverLeaveTimer(); }, [clearHoverLeaveTimer]);

  const loadData = useCallback(async (showLoading = true) => {
    if (!diagramId || Number.isNaN(diagramId)) {
      if (isMountedRef.current) { setError(t("diagramNode.errorNoDiagramId")); setLoading(false); setReloading(false); }
      return;
    }
    if (isLoadingDataRef.current) return;
    try {
      isLoadingDataRef.current = true;
      if (isMountedRef.current) {
        if (showLoading) setLoading(true); else setReloading(true);
        setError("");
      }
      const [diagramData, fetchedAllNodes, fetchedTargets] = await Promise.all([
        ListDiagramByID(diagramId), ListAppDiagramNodes(), ListALLTarget(),
      ]);
      if (!isMountedRef.current) return;
      if (!diagramData) {
        setError(t("diagramNode.errorLoadDiagram"));
        setDiagram(null); setNodes([]); setAllNodes([]); setTargets([]);
        return;
      }
      const safeAllNodes = Array.isArray(fetchedAllNodes) ? fetchedAllNodes : [];
      const safeTargets = Array.isArray(fetchedTargets) ? fetchedTargets : [];
      const filteredNodes = safeAllNodes
        .filter((item) => Number(item.diagram_id) === diagramId)
        .sort((a, b) => {
          const zA = Number(a.z_index ?? 0), zB = Number(b.z_index ?? 0);
          return zA !== zB ? zA - zB : Number(a.id ?? 0) - Number(b.id ?? 0);
        });
      setDiagram(diagramData);
      setAllNodes(safeAllNodes);
      setNodes(filteredNodes);
      setTargets(safeTargets);
    } catch (err) {
      console.error("loadData error:", err);
      if (!isMountedRef.current) return;
      setError(t("diagramNode.errorLoadData"));
      setDiagram(null); setNodes([]); setAllNodes([]); setTargets([]);
    } finally {
      if (isMountedRef.current) { setLoading(false); setReloading(false); }
      isLoadingDataRef.current = false;
    }
  }, [diagramId]);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void loadData(true);
  }, [loadData]);

  const handleOpenCreateByClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isUserRole || !imageWrapperRef.current || !diagramId) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-node-marker='true']") || target.closest("[data-hover-card='true']")) return;
    const rect = imageWrapperRef.current.getBoundingClientRect();
    const xPercent = normalizePercentValue(((e.clientX - rect.left) / rect.width) * 100);
    const yPercent = normalizePercentValue(((e.clientY - rect.top) / rect.height) * 100);
    setDraftPosition({ x: xPercent, y: yPercent, width: 12, height: 9 });
    setModalAnchorPoint({ clientX: e.clientX, clientY: e.clientY });
    setSelectedNode(null);
    setModalMode("create");
    setModalOpen(true);
  }, [diagramId, isUserRole]);

  const handleOpenEdit = useCallback(async (nodeId: number, anchorPoint?: ModalAnchorPoint) => {
    if (isUserRole) return;
    const requestId = ++editRequestIdRef.current;
    setModalAnchorPoint(anchorPoint ?? { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 });
    setModalMode("edit");
    setSelectedNode(null);
    setDraftPosition(null);
    setModalOpen(true);
    setModalLoading(true);
    try {
      const node = await ListAppDiagramNodeByID(nodeId);
      if (!isMountedRef.current || requestId !== editRequestIdRef.current) return;
      if (!node) { message.error(t("diagramNode.errorLoadNode")); setModalOpen(false); return; }
      setSelectedNode(node);
      setHoverCard(null);
    } catch (err) {
      console.error("handleOpenEdit error:", err);
      if (!isMountedRef.current || requestId !== editRequestIdRef.current) return;
      message.error(t("diagramNode.errorLoadNode"));
      setModalOpen(false);
    } finally {
      if (isMountedRef.current && requestId === editRequestIdRef.current) setModalLoading(false);
    }
  }, [isUserRole]);

  const handleSubmit = useCallback(async (values: DiagramNodeFormValues) => {
    if (!diagramId || Number.isNaN(diagramId)) { message.error(t("diagramNode.errorNoDiagramId")); return; }
    setModalLoading(true);
    try {
      if (modalMode === "create") {
        const payload: CreateAppDiagramNodeInput = {
          diagram_id: diagramId, task_id: values.task_id.trim(), label: values.label.trim(),
          description: values.description.trim(), icon: values.icon.trim(),
          x: normalizePercentValue(values.x), y: normalizePercentValue(values.y),
          width: normalizeSizePercent(values.width, 12), height: normalizeSizePercent(values.height, 9),
          z_index: toNumber(values.z_index, 0),
        };
        const res = await CreateAppDiagramNode(payload);
        if (!res) { message.error(t("diagramNode.errorCreateNode")); return; }
        message.success(t("diagramNode.createSuccess"));
      } else {
        if (!selectedNode?.id) { message.error(t("diagramNode.errorNodeNotFoundEdit")); return; }
        const payload: UpdateAppDiagramNodeInput = {
          diagram_id: diagramId, label: values.label.trim(),
          description: values.description.trim(), icon: values.icon.trim(),
          x: normalizePercentValue(values.x), y: normalizePercentValue(values.y),
          width: normalizeSizePercent(values.width, 12), height: normalizeSizePercent(values.height, 9),
          z_index: toNumber(values.z_index, 0),
        };
        const res = await UpdateAppDiagramNodeByID(selectedNode.id, payload);
        if (!res) { message.error(t("diagramNode.errorUpdateNode")); return; }
        message.success(t("diagramNode.updateSuccess"));
      }
      if (!isMountedRef.current) return;
      setModalOpen(false); setSelectedNode(null); setDraftPosition(null); setModalAnchorPoint(null);
      await loadData(false);
    } catch (err) {
      console.error("handleSubmit error:", err);
    } finally {
      if (isMountedRef.current) setModalLoading(false);
    }
  }, [diagramId, modalMode, selectedNode, loadData]);

  const handleDeleteImmediate = useCallback(async (node: AppDiagramNodeResponse | null) => {
    if (isUserRole || !node?.id) { message.error(t("diagramNode.errorNodeNotFoundDelete")); return; }
    setModalLoading(true);
    try {
      const res = await DeleteAppDiagramNodeByID(node.id);
      if (!res) { message.error(t("diagramNode.errorDeleteNode")); return; }
      message.success(t("diagramNode.deleteSuccess"));
      if (!isMountedRef.current) return;
      setModalOpen(false); setSelectedNode(null); setDraftPosition(null); setModalAnchorPoint(null);
      await loadData(false);
    } catch (err) {
      console.error("handleDeleteImmediate error:", err);
    } finally {
      if (isMountedRef.current) setModalLoading(false);
    }
  }, [loadData, isUserRole]);

  const handleMarkerEnter = useCallback((node: AppDiagramNodeResponse, xPercent: number, yPercent: number) => {
    clearHoverLeaveTimer();
    const wrapper = imageWrapperRef.current;
    if (!wrapper) return;
    const containerWidth = wrapper.clientWidth;
    const containerHeight = wrapper.clientHeight;
    const markerX = (xPercent / 100) * containerWidth;
    const markerY = (yPercent / 100) * containerHeight;
    let left = clamp(markerX - TOOLTIP_WIDTH / 2, CONTAINER_PADDING, containerWidth - TOOLTIP_WIDTH - CONTAINER_PADDING);
    const placeBelow = markerY - TOOLTIP_ESTIMATED_HEIGHT - TOOLTIP_GAP < CONTAINER_PADDING;
    let top = placeBelow ? markerY + TOOLTIP_GAP : markerY - TOOLTIP_ESTIMATED_HEIGHT - TOOLTIP_GAP;
    top = clamp(top, CONTAINER_PADDING, containerHeight - TOOLTIP_ESTIMATED_HEIGHT - CONTAINER_PADDING);
    const arrowLeft = clamp(markerX - left, 18, TOOLTIP_WIDTH - 18);
    setHoverCard({ node, left, top, arrowLeft, placeBelow });
  }, [clearHoverLeaveTimer]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden">

      {/* ── Header bar ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 py-3 dark:border-white/8 dark:bg-[#0d0b1a]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-7 w-0.5 shrink-0 rounded-full" style={{ background: accentGrad }} />
          <div className="min-w-0">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
              {t("diagramNode.kicker")}
            </p>
            <h1 className="truncate text-[16px] font-bold text-slate-800 dark:text-white/90">
              {loading ? t("common.loading") : (diagram?.name || t("diagramNode.diagramFallback"))}
            </h1>
          </div>
          {!loading && (
            <span
              className="shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold text-white"
              style={{ background: accentGrad }}
            >
              {t("diagramNode.nodeCount", { n: nodes.length })}
            </span>
          )}
          {reloading && <FiRefreshCw className="shrink-0 animate-spin text-[13px] text-slate-400 dark:text-white/30" />}
        </div>

        <div className="flex items-center gap-2">
          {!isUserRole && !loading && (
            <span className="hidden items-center gap-1.5 text-[10.5px] text-slate-400 dark:text-white/30 sm:flex">
              <FiPlus className="text-[11px]" />
              {t("diagramNode.clickToAddNode")}
            </span>
          )}
          <button
            type="button"
            onClick={() => navigate("/admin/diagrams")}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 text-[11.5px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/65 dark:hover:bg-white/8"
          >
            <FiArrowLeft className="text-[12px]" />
            {t("common.back")}
          </button>
        </div>
      </div>

      {/* ── Body: 2-column layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: nodes list panel ── */}
        <div className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-slate-100 bg-white dark:border-white/8 dark:bg-[#0d0b1a]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/8">
            <div className="flex items-center gap-2">
              <FiLayers className="text-[13px] text-slate-400 dark:text-white/30" />
              <span className="text-[12.5px] font-semibold text-slate-700 dark:text-white/80">{t("diagramNode.nodesLabel")}</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-white/8 dark:text-white/40">
                {nodes.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => { hasFetchedRef.current = false; void loadData(false); }}
              disabled={loading || reloading}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 disabled:opacity-40 dark:text-white/30 dark:hover:bg-white/8"
            >
              <FiRefreshCw className={`text-[11px] ${reloading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-white/6" />
                ))}
              </div>
            ) : nodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: `${currentColor}12` }}>
                  <FiMapPin className="text-[16px]" style={{ color: currentColor }} />
                </div>
                <p className="text-[11.5px] font-medium text-slate-500 dark:text-white/45">{t("diagramNode.noNodesYet")}</p>
                {!isUserRole && <p className="text-[10.5px] text-slate-400 dark:text-white/30">{t("diagramNode.clickDiagramToAdd")}</p>}
              </div>
            ) : (
              <div className="space-y-0 px-2 py-2">
                {nodes.map((node) => {
                  const matchedTarget = targetMap.get(String(node.task_id || "").trim());
                  const riskScore = formatRiskScore(matchedTarget?.risk_score);
                  const riskTone = getRiskScoreTone(matchedTarget?.risk_score);
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => { if (!isUserRole) void handleOpenEdit(node.id); }}
                      className="group flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/4 focus:outline-none"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: currentColor }} />
                        <p className="truncate text-[12px] font-semibold text-slate-700 dark:text-white/80">
                          {node.label || t("diagramNode.unnamed")}
                        </p>
                        <span className={`ml-auto shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${riskTone.box} ${riskTone.value}`}>
                          {riskScore}
                        </span>
                      </div>
                      <p className="truncate pl-4 text-[10.5px] text-slate-400 dark:text-white/30">
                        {matchedTarget?.name || matchedTarget?.ip || node.task_id || "-"}
                      </p>
                      {node.description?.trim() && (
                        <p className="truncate pl-4 text-[10px] text-slate-300 dark:text-white/20">
                          {node.description}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {diagram?.description?.trim() && (
            <div className="border-t border-slate-100 px-4 py-2.5 dark:border-white/8">
              <p className="line-clamp-2 text-[10px] leading-4.5 text-slate-400 dark:text-white/30">
                {diagram.description}
              </p>
            </div>
          )}
        </div>

        {/* ── RIGHT: interactive diagram ── */}
        <div className="flex flex-1 flex-col overflow-hidden bg-slate-50/30 dark:bg-[#080614]/30">

          {/* Toolbar */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 py-2.5 dark:border-white/8 dark:bg-[#0d0b1a]">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-slate-700 dark:text-white/75">{t("diagramNode.interactiveDiagram")}</span>
              <span className="text-[10.5px] text-slate-300 dark:text-white/20">·</span>
              <span className="text-[10.5px] text-slate-400 dark:text-white/30">
                {isUserRole ? t("diagramNode.hoverMarkerDetail") : t("diagramNode.clickPlaceEdit")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                style={{ borderColor: `${currentColor}30`, color: currentColor, backgroundColor: `${currentColor}08` }}
              >
                <FiTarget className="text-[9px]" />
                {t("diagramNode.placed", { n: nodes.length })}
              </span>
            </div>
          </div>

          {/* Canvas — no scroll, image fits the viewport */}
          <div className="flex-1 overflow-hidden p-3">
            {loading ? (
              <div className="flex h-full items-center justify-center gap-2 text-[12px] text-slate-400 dark:text-white/30">
                <FiRefreshCw className="animate-spin text-[16px]" />
                {t("diagramNode.loadingDiagram")}
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center text-[12px] text-red-500 dark:text-red-300">{error}</div>
            ) : (
              <div
                className="relative h-full overflow-hidden rounded-2xl border border-slate-200/60 bg-[#f8fafc] shadow-sm dark:border-white/8 dark:bg-white/2"
                ref={imageWrapperRef}
                style={{ cursor: isUserRole ? "default" : "crosshair" }}
                onClick={handleOpenCreateByClick}
                onMouseLeave={scheduleHideHoverCard}
                onMouseEnter={clearHoverLeaveTimer}
              >
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={diagram?.name}
                    className="h-full w-full select-none pointer-events-none object-contain"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-300 dark:text-white/20">
                    <FiImage className="text-[36px]" />
                    <p className="text-[12px]">{t("diagramNode.noDiagramImage")}</p>
                  </div>
                )}

                {/* Node markers */}
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
                        void handleOpenEdit(node.id, { clientX: e.clientX, clientY: e.clientY });
                      }}
                      onMouseEnter={() => handleMarkerEnter(node, x, y)}
                      onMouseLeave={scheduleHideHoverCard}
                      className="absolute -translate-x-1/2 -translate-y-full focus:outline-none"
                      style={{ left: `${x}%`, top: `${y}%`, zIndex }}
                    >
                      <span className="relative inline-flex items-center justify-center">
                        <span className="absolute h-8 w-8 rounded-full blur-md" style={{ backgroundColor: "#ef444430" }} />
                        <FiMapPin
                          className="relative text-[28px] drop-shadow-sm transition-transform duration-200 hover:scale-110"
                          style={{ color: "#ef4444", filter: "drop-shadow(0 4px 8px #ef444455)" }}
                        />
                      </span>
                    </button>
                  );
                })}

                {/* Hover card */}
                {hoverCard && (
                  <div
                    data-hover-card="true"
                    className="pointer-events-auto absolute z-999 w-60"
                    style={{ left: hoverCard.left, top: hoverCard.top }}
                    onMouseEnter={clearHoverLeaveTimer}
                    onMouseLeave={scheduleHideHoverCard}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="relative overflow-visible">
                      <div
                        className="overflow-hidden rounded-2xl bg-white dark:bg-[#0d0b1a]"
                        style={{ border: `1px solid ${currentColor}20`, boxShadow: `0 20px 48px -8px ${currentColor}18, 0 8px 24px rgba(0,0,0,.10)` }}
                      >
                        {/* Header */}
                        <div className="flex items-center gap-2.5 border-b px-3.5 py-3" style={{ borderColor: `${currentColor}15` }}>
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: "#ef4444" }}>
                            <FiMapPin className="text-[12px]" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: currentColor }}>{t("diagramNode.nodeDetailLabel")}</p>
                            <p className="truncate text-[12.5px] font-bold text-slate-800 dark:text-white/90">
                              {hoverCard.node.label || t("diagramNode.unnamedNode")}
                            </p>
                          </div>
                        </div>

                        {/* Body */}
                        <div className="space-y-2 px-3.5 py-3">
                          {hoverCard.node.description?.trim() ? (
                            <div className="flex items-start gap-2">
                              <FiAlignLeft className="mt-0.5 shrink-0 text-[11px]" style={{ color: currentColor }} />
                              <p className="text-[10.5px] leading-5 text-slate-500 dark:text-white/45">
                                {hoverCard.node.description}
                              </p>
                            </div>
                          ) : (
                            <p className="text-[10.5px] text-slate-300 dark:text-white/20 italic">{t("diagramNode.noDescription")}</p>
                          )}
                          {!isUserRole && (
                            <button
                              type="button"
                              onClick={(e) => void handleOpenEdit(hoverCard.node.id, { clientX: e.clientX, clientY: e.clientY })}
                              className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11.5px] font-semibold text-white transition hover:opacity-90"
                              style={{ background: accentGrad }}
                            >
                              <FiEdit2 className="text-[11px]" />
                              {t("diagramNode.editNode")}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Arrow */}
                      <div
                        className="absolute h-3 w-3 bg-white dark:bg-[#0d0b1a]"
                        style={{
                          left: hoverCard.arrowLeft,
                          top: hoverCard.placeBelow ? -6 : undefined,
                          bottom: hoverCard.placeBelow ? undefined : -6,
                          border: `1px solid ${currentColor}20`,
                          borderTop: hoverCard.placeBelow ? `1px solid ${currentColor}20` : "none",
                          borderLeft: hoverCard.placeBelow ? `1px solid ${currentColor}20` : "none",
                          borderRight: hoverCard.placeBelow ? "none" : `1px solid ${currentColor}20`,
                          borderBottom: hoverCard.placeBelow ? "none" : `1px solid ${currentColor}20`,
                          transform: `translateX(-50%) rotate(${hoverCard.placeBelow ? "225" : "45"}deg)`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {!isUserRole && (
        <DiagramNodeFormModal
          open={modalOpen}
          mode={modalMode}
          loading={modalLoading}
          diagramName={diagram?.name ?? ""}
          initialData={selectedNode}
          draftPosition={draftPosition}
          onClose={() => {
            if (modalLoading) return;
            setModalOpen(false); setSelectedNode(null); setDraftPosition(null); setModalAnchorPoint(null);
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

export default DiagramNodePage;
