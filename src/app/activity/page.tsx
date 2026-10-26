"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  FolderSync,
  Send,
  FolderCheck,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react";

type ActivityLog = {
  id: string;
  type: "sync" | "publish" | "rename" | "error";
  title: string;
  description: string | null;
  contentItemId: string | null;
  channel: string | null;
  status: "success" | "warning" | "error" | "info";
  metadata: string | null;
  createdAt: string;
};

const CHANNEL_COLORS: Record<string, string> = {
  linkedin: "bg-blue-600/15 text-blue-400 border-blue-500/20",
  youtube: "bg-red-600/15 text-red-400 border-red-500/20",
  instagram: "bg-pink-600/15 text-pink-400 border-pink-500/20",
  facebook: "bg-indigo-600/15 text-indigo-400 border-indigo-500/20",
  skool: "bg-amber-600/15 text-amber-400 border-amber-500/20",
};

export default function ActivityLogPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"all" | "sync" | "publish" | "rename" | "error">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { data, isLoading, isRefetching, refetch } = useQuery<{ activities: ActivityLog[] }>({
    queryKey: ["activity-logs", activeTab],
    queryFn: async () => {
      const url = activeTab === "all" ? "/api/activity" : `/api/activity?type=${activeTab}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load activity logs");
      return res.json();
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/activity", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear logs");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      setToastMessage("Activity logs cleared successfully");
      setTimeout(() => setToastMessage(null), 3000);
    },
    onError: (err: any) => {
      setToastMessage(err.message || "Failed to clear logs");
      setTimeout(() => setToastMessage(null), 4000);
    },
  });

  const activities = data?.activities || [];

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSec < 45) return "just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const getTypeIcon = (type: string, status: string) => {
    if (type === "error" || status === "error") {
      return <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />;
    }
    switch (type) {
      case "sync":
        return <FolderSync className="w-4 h-4 text-cyan-400 shrink-0" />;
      case "publish":
        return <Send className="w-4 h-4 text-emerald-400 shrink-0" />;
      case "rename":
        return <FolderCheck className="w-4 h-4 text-purple-400 shrink-0" />;
      default:
        return <Activity className="w-4 h-4 text-indigo-400 shrink-0" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "sync":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "publish":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "rename":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "error":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-200 flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200">
          <Info className="w-4 h-4 text-indigo-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 mb-1 text-xs font-semibold uppercase tracking-wider">
            <Activity className="w-4 h-4" />
            <span>Audit Trail & Telemetry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Activity Log
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time audit log of all OneDrive synchronizations, social channel publishes, and folder renames.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50 min-h-[44px]"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading || isRefetching ? "animate-spin text-indigo-400" : ""}`}
            />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              if (confirm("Are you sure you want to clear all activity logs? This action cannot be undone.")) {
                clearMutation.mutate();
              }
            }}
            disabled={clearMutation.isPending || activities.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 text-xs font-medium border border-slate-800 hover:border-rose-500/30 transition-colors disabled:opacity-50 min-h-[44px]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800/80 scrollbar-none">
        {(
          [
            { id: "all", label: "All Events" },
            { id: "publish", label: "Publishes" },
            { id: "sync", label: "OneDrive Syncs" },
            { id: "rename", label: "Folder Renames (-Done)" },
            { id: "error", label: "Errors" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all min-h-[44px] flex items-center ${
              activeTab === tab.id
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-20 bg-slate-900/80 rounded-2xl border border-slate-800/80 animate-pulse"
            />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/60">
          <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No activity logs recorded yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Logs for OneDrive content syncing, Zernio social post publishing, and automatic folder renaming will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((act) => {
            const isExpanded = expandedId === act.id;
            const hasMetadata = Boolean(act.metadata);

            return (
              <div
                key={act.id}
                className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-all shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50 mt-0.5">
                      {getTypeIcon(act.type, act.status)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-white">
                          {act.title}
                        </span>

                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${getTypeBadge(
                            act.type
                          )}`}
                        >
                          {act.type}
                        </span>

                        {act.channel && (
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${
                              CHANNEL_COLORS[act.channel.toLowerCase()] ||
                              "bg-slate-800 text-slate-300 border-slate-700"
                            }`}
                          >
                            {act.channel}
                          </span>
                        )}

                        <span
                          className={`text-[10px] uppercase font-medium px-1.5 py-0.5 rounded ${
                            act.status === "success"
                              ? "text-emerald-400 bg-emerald-500/10"
                              : act.status === "error"
                              ? "text-rose-400 bg-rose-500/10"
                              : "text-slate-400 bg-slate-800"
                          }`}
                        >
                          {act.status}
                        </span>
                      </div>

                      {act.description && (
                        <p className="text-xs text-slate-300 font-mono break-all">
                          {act.description}
                        </p>
                      )}

                      {act.contentItemId && (
                        <Link
                          href={`/content/${act.contentItemId}`}
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors pt-1"
                        >
                          <span>View Associated Content Folder</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Timestamp & Expand */}
                  <div className="flex items-center sm:flex-col sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 border-slate-800/60 pt-2 sm:pt-0">
                    <div
                      className="text-[11px] text-slate-400 flex items-center gap-1 font-mono cursor-help"
                      title={act.createdAt}
                    >
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{formatRelativeTime(act.createdAt)}</span>
                    </div>

                    {hasMetadata && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : act.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        <span>{isExpanded ? "Hide Details" : "Inspect Payload"}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded metadata drawer */}
                {isExpanded && act.metadata && (
                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block mb-1">
                      Event Metadata / Debug Context:
                    </span>
                    <pre className="p-3 rounded-xl bg-slate-950 text-slate-300 font-mono text-[11px] overflow-x-auto border border-slate-800/80 max-h-60">
                      {JSON.stringify(JSON.parse(act.metadata), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
