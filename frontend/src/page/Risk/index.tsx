import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  FiRefreshCw, FiShield, FiZap,
  FiPlus, FiEdit2, FiTrash2, FiCpu, FiServer,
} from "react-icons/fi";
import { message, Modal, Form, Input, Select } from "antd";
import {
  GetRiskSummary, GetEPSSStatus, TriggerEPSSSync,
  ListAssetCriticality, CreateAssetCriticality, UpdateAssetCriticality, DeleteAssetCriticality,
  type RiskSummaryDTO, type AssetCriticalityDTO, type EPSSStatusDTO,
} from "../../services";

// ===========================
// Helpers
// ===========================

const riskColor = (level: string) => {
  switch (level) {
    case "CRITICAL": return { bg: "bg-red-50 dark:bg-red-500/10", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-500/25", dot: "bg-red-500" };
    case "HIGH":     return { bg: "bg-orange-50 dark:bg-orange-500/10", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-500/25", dot: "bg-orange-500" };
    case "MEDIUM":   return { bg: "bg-yellow-50 dark:bg-yellow-500/10", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-200 dark:border-yellow-500/25", dot: "bg-yellow-500" };
    default:          return { bg: "bg-gray-50 dark:bg-white/5", text: "text-gray-600 dark:text-white/55", border: "border-gray-200 dark:border-white/10", dot: "bg-gray-400" };
  }
};

const critColor = (label: string) => {
  switch (label) {
    case "crown_jewel": return "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/25 dark:bg-purple-500/10 dark:text-purple-300";
    case "high":        return "border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300";
    case "medium":      return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300";
    default:             return "border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-white/55";
  }
};

const critLabel = (label: string) => {
  const map: Record<string, string> = { crown_jewel: "👑 Crown Jewel", high: "🔴 High", medium: "🟡 Medium", low: "🟢 Low" };
  return map[label] ?? label;
};

// ===========================
// Score Bar
// ===========================
const RiskBar: React.FC<{ score: number; level: string }> = ({ score, level }) => {
  const c = riskColor(level);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-gray-100 dark:bg-white/10">
        <div
          className={`h-full rounded-full ${c.dot}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-[11px] font-bold ${c.text}`}>{score.toFixed(1)}</span>
    </div>
  );
};

// ===========================
// Main Page
// ===========================
const Risk: React.FC = () => {
  const [summary, setSummary] = useState<RiskSummaryDTO | null>(null);
  const [epss, setEPSS] = useState<EPSSStatusDTO | null>(null);
  const [assets, setAssets] = useState<AssetCriticalityDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<"risks" | "assets">("risks");
  const [filterLevel, setFilterLevel] = useState<string>("ALL");
  const [assetModal, setAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetCriticalityDTO | null>(null);
  const [form] = Form.useForm();
  const hasFetched = useRef(false);

  const fetchAll = async () => {
    setLoading(true);
    const [s, e, a] = await Promise.all([GetRiskSummary(), GetEPSSStatus(), ListAssetCriticality()]);
    setSummary(s);
    setEPSS(e);
    setAssets(a);
    setLoading(false);
  };

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    void fetchAll();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    const ok = await TriggerEPSSSync();
    setSyncing(false);
    if (ok) {
      message.success("EPSS sync queued — รอสักครู่แล้วกด Refresh เพื่อดูคะแนนที่อัปเดต");
    } else {
      message.error("Failed to trigger EPSS sync");
    }
  };

  const filteredRisks = useMemo(() => {
    const list = summary?.top_risks ?? [];
    if (filterLevel === "ALL") return list;
    return list.filter(r => r.risk_level === filterLevel);
  }, [summary, filterLevel]);

  const openCreate = () => { setEditingAsset(null); form.resetFields(); setAssetModal(true); };
  const openEdit = (a: AssetCriticalityDTO) => { setEditingAsset(a); form.setFieldsValue(a); setAssetModal(true); };

  const handleAssetSave = async () => {
    const values = await form.validateFields();
    const critScoreMap: Record<string, number> = { crown_jewel: 5, high: 4, medium: 3, low: 1 };
    values.criticality_score = critScoreMap[values.criticality] ?? 3;

    if (editingAsset) {
      const ok = await UpdateAssetCriticality(editingAsset.id, values);
      ok ? message.success("Updated") : message.error("Update failed");
    } else {
      const ok = await CreateAssetCriticality(values);
      ok ? message.success("Created") : message.error("Create failed");
    }
    setAssetModal(false);
    void fetchAll();
  };

  const handleAssetDelete = (id: number) => {
    Modal.confirm({
      title: "Delete Asset?",
      onOk: async () => {
        await DeleteAssetCriticality(id);
        void fetchAll();
      },
    });
  };

  const s = summary;
  const counts = [
    { label: "CRITICAL", value: s?.critical_count ?? 0, color: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-500/20" },
    { label: "HIGH",     value: s?.high_count ?? 0,     color: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-500/20" },
    { label: "MEDIUM",   value: s?.medium_count ?? 0,   color: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-200 dark:border-yellow-500/20" },
    { label: "LOW",      value: s?.low_count ?? 0,      color: "text-gray-600 dark:text-white/55", border: "border-gray-200 dark:border-white/10" },
  ];

  return (
    <div className="w-full px-1 py-3 sm:px-2 sm:py-4 lg:px-2.5 xl:px-3">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[10%] top-20 h-64 w-64 rounded-full bg-violet-500/6 blur-[100px]" />
        <div className="absolute right-[8%] top-40 h-56 w-56 rounded-full bg-orange-500/6 blur-[90px]" />
      </div>

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-2xl border border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
            <FiCpu className="text-[16px]" />
          </div>
          <div>
            <h1 className="text-[18px] font-extrabold text-[#1f2240] dark:text-white/90 sm:text-[20px]">Risk Score Engine</h1>
            <p className="text-[10.5px] text-gray-500 dark:text-white/45">CVSS · EPSS · KEV · Asset Criticality → Composite Score</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {epss && (
            <div className="hidden items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white/45 sm:flex">
              <FiZap className="text-[10px]" />
              EPSS: {epss.total.toLocaleString()} scores · {epss.score_date}
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-[12px] font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-60 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300"
          >
            <FiRefreshCw className={`text-[13px] ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync EPSS"}
          </button>
        </div>
      </div>

      {/* Summary Counts */}
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {counts.map(({ label, value, color, border }) => (
          <button
            key={label}
            type="button"
            onClick={() => setFilterLevel(filterLevel === label ? "ALL" : label)}
            className={[
              "relative overflow-hidden rounded-[22px] border bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-white/5",
              border,
              filterLevel === label ? "ring-2 ring-violet-400 ring-offset-1" : "",
            ].join(" ")}
          >
            {loading ? (
              <div className="h-8 animate-pulse rounded bg-gray-100 dark:bg-white/10" />
            ) : (
              <>
                <div className={`text-[28px] font-extrabold ${color}`}>{value}</div>
                <div className="text-[10px] font-semibold text-gray-500 dark:text-white/40">{label}</div>
              </>
            )}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        {(["risks", "assets"] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={[
              "rounded-2xl border px-4 py-2 text-[12px] font-semibold transition-all",
              activeTab === tab
                ? "border-transparent bg-linear-to-r from-violet-500 to-purple-600 text-white shadow-sm"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/65",
            ].join(" ")}
          >
            {tab === "risks" ? `Top Risks (${summary?.total_items ?? 0})` : `Asset Criticality (${assets.length})`}
          </button>
        ))}
      </div>

      {/* ── Tab: Top Risks ── */}
      {activeTab === "risks" && (
        <div className="rounded-3xl border border-gray-200/80 bg-white/90 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          {loading ? (
            <div className="space-y-2 p-4">{[1,2,3,4,5].map(i => <div key={i} className="h-12 animate-pulse rounded-[14px] bg-gray-100 dark:bg-white/8" />)}</div>
          ) : filteredRisks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <FiShield className="text-[24px] text-gray-400" />
              <div className="text-[12px] text-gray-500 dark:text-white/45">No risks found</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-160">
                <thead className="sticky top-0 z-10 bg-white dark:bg-[#0f1117]">
                  <tr className="border-b border-gray-100 dark:border-white/8">
                    {["#", "Risk Level", "CVE ID", "Vulnerability", "Host", "CVSS", "EPSS", "Flags", "Score"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-white/40">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/60 dark:divide-white/5">
                  {filteredRisks.map((item, i) => {
                    const c = riskColor(item.risk_level);
                    return (
                      <tr key={`${item.cve_id}-${item.host_ip}-${i}`} className="transition-colors hover:bg-gray-50/60 dark:hover:bg-white/3">
                        <td className="px-4 py-3 text-[11px] text-gray-400 dark:text-white/30">{i + 1}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${c.bg} ${c.text} ${c.border}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                            {item.risk_level}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-[10.5px] font-bold text-gray-700 dark:text-white/80">{item.cve_id}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-50 truncate text-[11.5px] font-medium text-[#1f2240] dark:text-white/80">{item.vuln_name || "—"}</div>
                          <div className="text-[10px] text-gray-500 dark:text-white/40">{item.task_name}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-gray-700 dark:text-white/70">{item.host_ip}</td>
                        <td className="px-4 py-3 text-[11.5px] font-semibold text-gray-700 dark:text-white/75">{item.cvss_score.toFixed(1)}</td>
                        <td className="px-4 py-3">
                          <div className="text-[11.5px] font-semibold text-violet-700 dark:text-violet-300">{(item.epss_score * 100).toFixed(1)}%</div>
                          <div className="text-[9.5px] text-gray-400 dark:text-white/30">p{Math.round(item.epss_percentile * 100)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {item.is_kev && <span className="rounded-full border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[8px] font-bold text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300">KEV</span>}
                            {item.is_ransomware && <span className="rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[8px] font-bold text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">RANSOM</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <RiskBar score={item.risk_score} level={item.risk_level} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(summary?.total_items ?? 0) > 50 && (
                <div className="border-t border-gray-100 px-4 py-3 text-center text-[11px] text-gray-500 dark:border-white/8 dark:text-white/40">
                  Showing top 50 of {summary!.total_items} risks by composite score
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Asset Criticality ── */}
      {activeTab === "assets" && (
        <div className="rounded-3xl border border-gray-200/80 bg-white/90 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-white/8">
            <span className="text-[12px] font-semibold text-gray-700 dark:text-white/75">Host Asset Classification</span>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11.5px] font-semibold text-violet-700 hover:bg-violet-100 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300"
            >
              <FiPlus className="text-[12px]" /> Add Asset
            </button>
          </div>
          {assets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <FiServer className="text-[24px] text-gray-400" />
              <div className="text-[12px] text-gray-500 dark:text-white/45">No assets classified yet</div>
              <button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] font-semibold text-violet-700 hover:bg-violet-100">
                <FiPlus /> Add First Asset
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-130">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/8">
                    {["Host IP", "Criticality", "Type", "Owner", "Business Impact", ""].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-500 dark:text-white/40">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/60 dark:divide-white/5">
                  {assets.map(a => (
                    <tr key={a.id} className="transition-colors hover:bg-gray-50/60 dark:hover:bg-white/3">
                      <td className="px-4 py-3 font-mono text-[11.5px] font-bold text-gray-800 dark:text-white/85">{a.host_ip}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${critColor(a.criticality)}`}>
                          {critLabel(a.criticality)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-gray-600 dark:text-white/60 capitalize">{a.asset_type}</td>
                      <td className="px-4 py-3 text-[11px] text-gray-600 dark:text-white/60">{a.owner || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="max-w-50 truncate text-[11px] text-gray-600 dark:text-white/55">{a.business_impact || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => openEdit(a)} className="text-[13px] text-gray-400 hover:text-violet-600 dark:text-white/30 dark:hover:text-violet-400"><FiEdit2 /></button>
                          <button type="button" onClick={() => handleAssetDelete(a.id)} className="text-[13px] text-gray-400 hover:text-red-600 dark:text-white/30 dark:hover:text-red-400"><FiTrash2 /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Asset Modal */}
      <Modal
        open={assetModal}
        onCancel={() => setAssetModal(false)}
        onOk={() => void handleAssetSave()}
        title={editingAsset ? "Edit Asset" : "Add Asset"}
        okText="Save"
        styles={{ body: { padding: "16px 0 0" } }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="host_ip" label="Host IP" rules={[{ required: true }]}>
            <Input placeholder="192.168.1.100" disabled={!!editingAsset} />
          </Form.Item>
          <Form.Item name="criticality" label="Criticality" rules={[{ required: true }]}>
            <Select options={[
              { label: "👑 Crown Jewel", value: "crown_jewel" },
              { label: "🔴 High", value: "high" },
              { label: "🟡 Medium", value: "medium" },
              { label: "🟢 Low", value: "low" },
            ]} />
          </Form.Item>
          <Form.Item name="asset_type" label="Asset Type">
            <Select options={[
              { label: "Server", value: "server" },
              { label: "Database", value: "database" },
              { label: "Network", value: "network" },
              { label: "Workstation", value: "workstation" },
              { label: "IoT", value: "iot" },
              { label: "Web", value: "web" },
            ]} />
          </Form.Item>
          <Form.Item name="owner" label="Owner">
            <Input placeholder="IT Team" />
          </Form.Item>
          <Form.Item name="business_impact" label="Business Impact">
            <Input.TextArea rows={2} placeholder="What happens if this host is compromised?" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Risk;
