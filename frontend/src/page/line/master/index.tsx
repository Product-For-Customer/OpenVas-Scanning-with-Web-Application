import React, { useEffect, useMemo, useState } from "react";
import {
  FiSearch,
  FiRefreshCw,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiX,
  FiLink2,
  FiSettings,
  FiAlertCircle,
  FiBell,
  FiCpu,
  FiSlack,
  FiMail,
  FiEye,
  FiEyeOff,
  FiCopy,
} from "react-icons/fi";
import {
  FaTiktok,
  FaGoogle,
  FaYoutube,
  FaMicrosoft,
} from "react-icons/fa";
import {
  ListAppLineMaster,
  CreateAppLineMaster,
  UpdateAppLineMasterByID,
  DeleteAppLineMasterByID,
  type AppLineMasterResponse,
} from "../../../services";

type FormMode = "create" | "edit";

type FormData = {
  name: string;
  token: string;
};

type UiApp = {
  id: number;
  name: string;
  token: string;
  category: string;
  description: string;
  icon: React.ReactNode;
  chipClass: string;
  iconWrapClass: string;
};

const normalizeText = (value?: string | null) => (value || "").trim();

const getCategoryFromName = (name: string) => {
  const lower = normalizeText(name).toLowerCase();

  if (lower.includes("slack")) return "Social Authority";
  if (lower.includes("google") || lower.includes("meet")) return "Management";
  if (lower.includes("tiktok")) return "Entertainment";
  if (lower.includes("excel") || lower.includes("microsoft")) return "Analytics";
  if (lower.includes("mail")) return "Business";
  if (lower.includes("youtube")) return "Entertainment";
  if (lower.includes("line")) return "Messaging";
  if (lower.includes("notify")) return "Notification";
  return "Integration";
};

const getDescriptionFromName = (name: string) => {
  const lower = normalizeText(name).toLowerCase();

  if (lower.includes("slack")) {
    return "Connect Slack for team alerts, updates, and workflow communication.";
  }
  if (lower.includes("google") || lower.includes("meet")) {
    return "Connect Google services to support meeting and management workflows.";
  }
  if (lower.includes("tiktok")) {
    return "Connect TikTok for content and social engagement workflows.";
  }
  if (lower.includes("excel") || lower.includes("microsoft")) {
    return "Connect Microsoft tools for reporting, analytics, and productivity.";
  }
  if (lower.includes("mail")) {
    return "Connect email services for notifications and communication.";
  }
  if (lower.includes("youtube")) {
    return "Connect YouTube for media and content-related workflows.";
  }
  if (lower.includes("line")) {
    return "Connect your LINE channel for notifications and automated message delivery.";
  }

  return "Manage and connect this integration to expand your workflow.";
};

const FiMessageSquareIcon: React.FC = () => <FiBell />;

const getMetaByName = (name: string) => {
  const lower = normalizeText(name).toLowerCase();

  if (lower.includes("slack")) {
    return {
      icon: <FiSlack />,
      chipClass:
        "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300",
      iconWrapClass:
        "border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300",
    };
  }

  if (lower.includes("google") || lower.includes("meet")) {
    return {
      icon: <FaGoogle />,
      chipClass:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
      iconWrapClass:
        "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
    };
  }

  if (lower.includes("tiktok")) {
    return {
      icon: <FaTiktok />,
      chipClass:
        "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-400/20 dark:bg-fuchsia-400/10 dark:text-fuchsia-300",
      iconWrapClass:
        "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-600 dark:border-fuchsia-400/20 dark:bg-fuchsia-400/10 dark:text-fuchsia-300",
    };
  }

  if (lower.includes("excel") || lower.includes("microsoft")) {
    return {
      icon: <FaMicrosoft />,
      chipClass:
        "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-300",
      iconWrapClass:
        "border-teal-200 bg-teal-50 text-teal-600 dark:border-teal-400/20 dark:bg-teal-400/10 dark:text-teal-300",
    };
  }

  if (lower.includes("mail")) {
    return {
      icon: <FiMail />,
      chipClass:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300",
      iconWrapClass:
        "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300",
    };
  }

  if (lower.includes("youtube")) {
    return {
      icon: <FaYoutube />,
      chipClass:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300",
      iconWrapClass:
        "border-red-200 bg-red-50 text-red-600 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300",
    };
  }

  if (lower.includes("line")) {
    return {
      icon: <FiMessageSquareIcon />,
      chipClass:
        "border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-400/20 dark:bg-lime-400/10 dark:text-lime-300",
      iconWrapClass:
        "border-lime-200 bg-lime-50 text-lime-600 dark:border-lime-400/20 dark:bg-lime-400/10 dark:text-lime-300",
    };
  }

  return {
    icon: <FiCpu />,
    chipClass:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300",
    iconWrapClass:
      "border-cyan-200 bg-cyan-50 text-cyan-600 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300",
  };
};

const mapToUiApp = (item: AppLineMasterResponse): UiApp => {
  const meta = getMetaByName(item.name);

  return {
    id: item.id,
    name: item.name,
    token: item.token,
    category: getCategoryFromName(item.name),
    description: getDescriptionFromName(item.name),
    icon: meta.icon,
    chipClass: meta.chipClass,
    iconWrapClass: meta.iconWrapClass,
  };
};

const Master: React.FC = () => {
  const [items, setItems] = useState<AppLineMasterResponse[]>([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingItem, setEditingItem] = useState<AppLineMasterResponse | null>(
    null
  );
  const [formData, setFormData] = useState<FormData>({
    name: "",
    token: "",
  });
  const [showToken, setShowToken] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<AppLineMasterResponse | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [copiedToken, setCopiedToken] = useState(false);

  const loadAppLineMasters = async (showRefresh = false) => {
    try {
      setError("");

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const res = await ListAppLineMaster();

      if (Array.isArray(res)) {
        setItems(res);
      } else {
        setItems([]);
        setError("Unable to load integrations.");
      }
    } catch (err) {
      console.error("loadAppLineMasters error:", err);
      setItems([]);
      setError("Unable to load integrations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAppLineMasters();
  }, []);

  const uiItems = useMemo(() => {
    return items.map(mapToUiApp);
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return uiItems.filter((item) => {
      const blob = [item.name, item.category, item.description]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [uiItems, search]);

  const openCreateModal = () => {
    setFormMode("create");
    setEditingItem(null);
    setFormData({
      name: "",
      token: "",
    });
    setShowToken(false);
    setCopiedToken(false);
    setFormError("");
    setFormOpen(true);
  };

  const openEditModal = (item: AppLineMasterResponse) => {
    setFormMode("edit");
    setEditingItem(item);
    setFormData({
      name: item.name || "",
      token: item.token || "",
    });
    setShowToken(false);
    setCopiedToken(false);
    setFormError("");
    setFormOpen(true);
  };

  const closeFormModal = () => {
    if (submitting) return;
    setFormOpen(false);
    setFormError("");
    setEditingItem(null);
    setShowToken(false);
    setCopiedToken(false);
  };

  const validateForm = () => {
    const name = normalizeText(formData.name);
    const token = normalizeText(formData.token);

    if (!name) {
      return "Please enter integration name.";
    }

    if (name.length < 2) {
      return "Integration name must be at least 2 characters.";
    }

    if (!token) {
      return "Please enter token.";
    }

    if (token.length < 6) {
      return "Token must be at least 6 characters.";
    }

    return "";
  };

  const handleCopyToken = async () => {
    const token = normalizeText(formData.token);
    if (!token) return;

    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(true);
      window.setTimeout(() => setCopiedToken(false), 1500);
    } catch (err) {
      console.error("copy token error:", err);
    }
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setSubmitting(true);
      setFormError("");

      const payload = {
        name: normalizeText(formData.name),
        token: normalizeText(formData.token),
      };

      if (formMode === "create") {
        const res = await CreateAppLineMaster(payload);

        if (!res?.data) {
          setFormError("Failed to create integration.");
          return;
        }

        setItems((prev) => [res.data, ...prev]);
        setFormOpen(false);
        setShowToken(false);
        return;
      }

      if (!editingItem?.id) {
        setFormError("Missing integration ID.");
        return;
      }

      const res = await UpdateAppLineMasterByID(editingItem.id, payload);

      if (!res?.data) {
        setFormError("Failed to update integration.");
        return;
      }

      setItems((prev) =>
        prev.map((item) => (item.id === editingItem.id ? res.data : item))
      );
      setFormOpen(false);
      setShowToken(false);
    } catch (err) {
      console.error("handleSubmit error:", err);
      setFormError(
        formMode === "create"
          ? "Failed to create integration."
          : "Failed to update integration."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteModal = (item: AppLineMasterResponse) => {
    setDeleteTarget(item);
    setDeleteError("");
    setDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteTarget(null);
    setDeleteError("");
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) {
      setDeleteError("Missing integration ID.");
      return;
    }

    try {
      setDeleting(true);
      setDeleteError("");

      const res = await DeleteAppLineMasterByID(deleteTarget.id);

      if (!res) {
        setDeleteError("Failed to delete integration.");
        return;
      }

      setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      console.error("handleDelete error:", err);
      setDeleteError("Failed to delete integration.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <section
        className={[
          "relative h-full overflow-hidden rounded-[22px] border px-3 py-3 sm:px-3.5 sm:py-3.5",
          "border-slate-200 bg-[#f9fcff] shadow-[0_10px_28px_-22px_rgba(15,23,42,0.18)]",
          "dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:ring-1 dark:ring-white/10",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]">
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
            <div
              className="h-full w-full text-slate-500 dark:text-white/15"
              style={{
                backgroundImage: `
                  linear-gradient(to right, currentColor 1px, transparent 1px),
                  linear-gradient(to bottom, currentColor 1px, transparent 1px)
                `,
                backgroundSize: "24px 24px",
              }}
            />
          </div>
          <div className="absolute -top-10 right-0 h-28 w-28 rounded-full bg-cyan-100/60 blur-3xl dark:bg-cyan-400/10" />
          <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-sky-100/60 blur-3xl dark:bg-sky-400/10" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col gap-3.5">
            <div className="max-w-lg">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300">
                <FiSettings className="text-[10px]" />
                Integration Management
              </div>

              <h2 className="mt-2.5 text-[16px] font-semibold tracking-tight text-slate-900 sm:text-[18px] dark:text-white/90">
                All Integrations
              </h2>

              <p className="mt-1 max-w-md text-[11px] leading-5 text-slate-500 dark:text-white/55">
                Manage connected apps in one place.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/35" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search integrations..."
                    className={[
                      "h-9 w-full rounded-2xl border pl-9 pr-3 text-[11.5px] outline-none transition",
                      "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400",
                      "focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100",
                      "dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/30 dark:focus:border-cyan-400/30 dark:focus:ring-cyan-400/10",
                    ].join(" ")}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadAppLineMasters(true)}
                    disabled={refreshing}
                    className={[
                      "inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition",
                      "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                      "dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10",
                    ].join(" ")}
                    title="Refresh"
                  >
                    <FiRefreshCw
                      className={`text-[12px] ${refreshing ? "animate-spin" : ""}`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={openCreateModal}
                    className={[
                      "inline-flex h-9 items-center gap-1.5 rounded-2xl px-3 text-[11.5px] font-medium transition",
                      "bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm",
                    ].join(" ")}
                  >
                    <FiPlus className="text-[12px]" />
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-3.5 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-4">
            {loading ? (
              <div className="flex min-h-44 items-center justify-center rounded-[18px] border border-slate-200 bg-white/80 px-4 py-8 text-center dark:border-white/10 dark:bg-white/5">
                <div>
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300">
                    <FiRefreshCw className="animate-spin text-[16px]" />
                  </div>
                  <h3 className="mt-2.5 text-[13px] font-semibold text-slate-900 dark:text-white/90">
                    Loading integrations...
                  </h3>
                  <p className="mt-1 text-[10.5px] text-slate-500 dark:text-white/50">
                    Please wait while we load your integration list.
                  </p>
                </div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex min-h-44 items-center justify-center rounded-[18px] border border-slate-200 bg-white/80 px-4 py-8 text-center dark:border-white/10 dark:bg-white/5">
                <div>
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300">
                    <FiAlertCircle className="text-[16px]" />
                  </div>
                  <h3 className="mt-2.5 text-[13px] font-semibold text-slate-900 dark:text-white/90">
                    No integrations found
                  </h3>
                  <p className="mt-1 text-[10.5px] text-slate-500 dark:text-white/50">
                    Try adjusting your search or add a new integration.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredItems.map((item) => {
                  const originalItem = items.find(
                    (x) => x.id === item.id
                  ) as AppLineMasterResponse;

                  return (
                    <div
                      key={item.id}
                      className={[
                        "rounded-[18px] border px-3 py-3 transition sm:px-3.5 sm:py-3.5",
                        "border-slate-200 bg-white shadow-[0_8px_24px_-22px_rgba(15,23,42,0.16)] hover:border-cyan-200",
                        "dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:hover:border-cyan-400/20",
                      ].join(" ")}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <div
                              className={[
                                "grid h-11 w-11 shrink-0 place-items-center rounded-2xl border text-[17px]",
                                item.iconWrapClass,
                              ].join(" ")}
                            >
                              {item.icon}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                                <h3 className="truncate text-[14px] font-semibold tracking-tight text-slate-900 dark:text-white/90">
                                  {item.name}
                                </h3>

                                <span
                                  className={[
                                    "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[9.5px] font-medium",
                                    item.chipClass,
                                  ].join(" ")}
                                >
                                  {item.category}
                                </span>
                              </div>

                              <p className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-500 dark:text-white/55">
                                {item.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                            <button
                              type="button"
                              onClick={() => openEditModal(originalItem)}
                              className={[
                                "inline-flex h-8.5 w-8.5 items-center justify-center rounded-xl border transition",
                                "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                                "dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10",
                              ].join(" ")}
                              title="Edit"
                            >
                              <FiEdit2 className="text-[12px]" />
                            </button>

                            <button
                              type="button"
                              onClick={() => openDeleteModal(originalItem)}
                              className={[
                                "inline-flex h-8.5 w-8.5 items-center justify-center rounded-xl border transition",
                                "border-red-200 bg-red-50 text-red-500 hover:bg-red-100",
                                "dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300 dark:hover:bg-red-400/15",
                              ].join(" ")}
                              title="Delete"
                            >
                              <FiTrash2 className="text-[12px]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-200 flex items-center justify-center p-3.5">
          <button
            type="button"
            onClick={closeFormModal}
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-[3px] dark:bg-black/45"
            aria-label="Close form modal overlay"
          />

          <div className="relative z-10 w-full max-w-lg rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-[0_24px_70px_rgba(15,23,42,0.18)] sm:px-4.5 sm:py-4.5 dark:border-white/10 dark:bg-[#0b1220] dark:shadow-none dark:ring-1 dark:ring-white/10">
            <button
              type="button"
              onClick={closeFormModal}
              disabled={submitting}
              className="absolute right-3 top-3 text-slate-400 transition hover:text-slate-600 disabled:cursor-not-allowed dark:text-white/35 dark:hover:text-white/70"
              aria-label="Close"
            >
              <FiX className="text-[16px]" />
            </button>

            <div className="flex justify-center pt-1">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-cyan-50 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-300">
                {formMode === "create" ? (
                  <FiPlus className="text-[20px]" />
                ) : (
                  <FiEdit2 className="text-[18px]" />
                )}
              </div>
            </div>

            <h3 className="mt-2.5 text-center text-[16px] font-semibold text-slate-800 dark:text-white/90">
              {formMode === "create" ? "Create Integration" : "Update Integration"}
            </h3>

            <p className="mx-auto mt-1 max-w-96 text-center text-[11px] leading-5 text-slate-500 dark:text-white/55">
              {formMode === "create"
                ? "Add a new integration card to your management page."
                : "Edit the selected integration information."}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-[11.5px] font-medium text-slate-700 dark:text-white/75">
                  Integration Name
                </label>
                <div className="relative">
                  <FiLink2 className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/35" />
                  <input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g. Slack, Google Meet, LINE Notify"
                    className="h-9 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-[11.5px] text-slate-800 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/30 dark:focus:border-cyan-400/30 dark:focus:ring-cyan-400/10"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11.5px] font-medium text-slate-700 dark:text-white/75">
                  Token
                </label>

                <div className="relative">
                  <FiBell className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 dark:text-white/35" />

                  <input
                    type={showToken ? "text" : "password"}
                    value={formData.token}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, token: e.target.value }))
                    }
                    placeholder="Enter token"
                    className="h-9 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-18 text-[11.5px] text-slate-800 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100 dark:border-white/10 dark:bg-white/5 dark:text-white/85 dark:placeholder:text-white/30 dark:focus:border-cyan-400/30 dark:focus:ring-cyan-400/10"
                  />

                  <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/80"
                      title="Copy token"
                    >
                      <FiCopy className="text-[12px]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowToken((prev) => !prev)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white/80"
                      title={showToken ? "Hide token" : "Show token"}
                    >
                      {showToken ? (
                        <FiEyeOff className="text-[12px]" />
                      ) : (
                        <FiEye className="text-[12px]" />
                      )}
                    </button>
                  </div>
                </div>

                {copiedToken && (
                  <div className="mt-2">
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9.5px] font-medium text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
                      Copied token
                    </span>
                  </div>
                )}
              </div>

              {formError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">
                  {formError}
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/45">
                  Preview
                </p>

                <div className="mt-2 flex items-start gap-2.5">
                  <div className="grid h-9 w-9 place-items-center rounded-2xl border border-cyan-200 bg-cyan-50 text-[16px] text-cyan-600 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300">
                    {getMetaByName(formData.name).icon}
                  </div>

                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-white/90">
                      {normalizeText(formData.name) || "Integration Name"}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-slate-500 dark:text-white/50">
                      {getCategoryFromName(formData.name)}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-white/55">
                      {getDescriptionFromName(formData.name)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="min-w-24 rounded-xl bg-cyan-600 px-4 py-2 text-[11.5px] font-medium text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? formMode === "create"
                    ? "Creating..."
                    : "Updating..."
                  : formMode === "create"
                  ? "Create"
                  : "Update"}
              </button>

              <button
                type="button"
                onClick={closeFormModal}
                disabled={submitting}
                className="min-w-24 rounded-xl bg-slate-100 px-4 py-2 text-[11.5px] font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/10 dark:text-white/75 dark:hover:bg-white/15"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && deleteTarget && (
        <div className="fixed inset-0 z-210 flex items-center justify-center p-3.5">
          <button
            type="button"
            onClick={closeDeleteModal}
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-[3px] dark:bg-black/45"
            aria-label="Close delete modal overlay"
          />

          <div className="relative z-10 w-full max-w-md rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-[0_24px_70px_rgba(15,23,42,0.18)] sm:px-4.5 sm:py-4.5 dark:border-white/10 dark:bg-[#0b1220] dark:shadow-none dark:ring-1 dark:ring-white/10">
            <button
              type="button"
              onClick={closeDeleteModal}
              disabled={deleting}
              className="absolute right-3 top-3 text-slate-400 transition hover:text-slate-600 disabled:cursor-not-allowed dark:text-white/35 dark:hover:text-white/70"
              aria-label="Close"
            >
              <FiX className="text-[16px]" />
            </button>

            <div className="flex justify-center pt-1">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-500 dark:bg-red-400/10 dark:text-red-300">
                <FiTrash2 className="text-[20px]" />
              </div>
            </div>

            <h3 className="mt-2.5 text-center text-[16px] font-semibold text-slate-800 dark:text-white/90">
              Delete Integration
            </h3>

            <p className="mx-auto mt-1.5 max-w-84 text-center text-[11px] leading-5 text-slate-500 dark:text-white/55">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-700 dark:text-white/80">
                {deleteTarget.name}
              </span>
              ? This action cannot be undone.
            </p>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-start gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-2xl border border-red-200 bg-red-50 text-[16px] text-red-600 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">
                  {getMetaByName(deleteTarget.name).icon}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-800 dark:text-white/90">
                    {deleteTarget.name}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-slate-500 dark:text-white/50">
                    {getCategoryFromName(deleteTarget.name)}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-white/55">
                    {getDescriptionFromName(deleteTarget.name)}
                  </p>
                </div>
              </div>
            </div>

            {deleteError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-[11.5px] text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">
                {deleteError}
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="min-w-24 rounded-xl bg-[#f8dedd] px-4 py-2 text-[11.5px] font-medium text-[#ff5a3c] transition hover:bg-[#f4d2d1] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-400/10 dark:text-red-300 dark:hover:bg-red-400/15"
              >
                {deleting ? "Deleting..." : "Yes, Delete!"}
              </button>

              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="min-w-24 rounded-xl bg-[#6d5efc] px-4 py-2 text-[11.5px] font-medium text-white transition hover:bg-[#5f51eb] disabled:cursor-not-allowed disabled:opacity-60"
              >
                No, Keep It.
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Master;