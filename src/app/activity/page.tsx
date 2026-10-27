"use client";

import { useState, useMemo } from "react";
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
  Info,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  SlidersHorizontal,
  X,
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

const CHANNEL_BADGES: Record<string, string> = {
  linkedin: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25",
  linkedin_page: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25",
  youtube: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/25",
  instagram: "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/25",
  facebook: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25",
  threads: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/25",
  skool: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
};

export default function ActivityLogPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"all" | "sync" | "publish" | "rename" | "error">("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
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

  // Filter & sort
  const filteredActivities = useMemo(() => {
    return activities
      .filter((act) => {
        if (channelFilter !== "all") {
          if (!act.channel || act.channel.toLowerCase() !== channelFilter.toLowerCase()) {
            return false;
          }
        }
        if (statusFilter !== "all") {
          if (act.status !== statusFilter) return false;
        }
        if (search) {
          const q = search.toLowerCase();
          const matchTitle = act.title.toLowerCase().includes(q);
          const matchDesc = act.description?.toLowerCase().includes(q);
          const matchContent = act.contentItemId?.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchContent) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === "newest") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [activities, channelFilter, statusFilter, search, sortOrder]);

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
      return <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />;
    }
    switch (type) {
      case "sync":
        return <FolderSync className="w-4 h-4 text-sky-500 shrink-0" />;
      case "publish":
        return <Send className="w-4 h-4 text-emerald-500 shrink-0" />;
      case "rename":
        return <FolderCheck className="w-4 h-4 text-amber-500 shrink-0" />;
      default:
        return <Activity className="w-4 h-4 text-zinc-500 shrink-0" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "sync":
        return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25";
      case "publish":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25";
      case "rename":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25";
      case "error":
        return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25";
      default:
        return "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700";
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 transition-colors">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 p-4 rounded-xl shadow-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border border-zinc-700 text-xs font-medium flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200">
          <Info className="w-4 h-4 text-sky-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-1 text-xs font-semibold uppercase tracking-wider">
            <Activity className="w-4 h-4" />
            <span>Audit Trail & Telemetry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Activity Log
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time audit log of all OneDrive synchronizations, social channel publishes, and folder renames.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-medium border border-zinc-200 dark:border-zinc-800 transition-colors disabled:opacity-50 min-h-[40px] shadow-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading || isRefetching ? "animate-spin text-zinc-600 dark:text-zinc-400" : ""}`}
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:border-rose-500/30 transition-colors disabled:opacity-50 min-h-[40px] shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs by Event Type */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-zinc-200 dark:border-zinc-800 scrollbar-none">
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
            className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all min-h-[40px] flex items-center ${
              activeTab === tab.id
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs font-semibold"
                : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Channel & Status Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activity description..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2">
          <Filter className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="w-full bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none text-xs cursor-pointer truncate"
          >
            <option value="all" className="bg-white dark:bg-zinc-900">
              All Channels
            </option>
            <option value="linkedin" className="bg-white dark:bg-zinc-900">
              LinkedIn
            </option>
            <option value="linkedin_page" className="bg-white dark:bg-zinc-900">
              LinkedIn Page
            </option>
            <option value="threads" className="bg-white dark:bg-zinc-900">
              Threads
            </option>
            <option value="youtube" className="bg-white dark:bg-zinc-900">
              YouTube
            </option>
            <option value="instagram" className="bg-white dark:bg-zinc-900">
              Instagram
            </option>
            <option value="facebook" className="bg-white dark:bg-zinc-900">
              Facebook
            </option>
            <option value="skool" className="bg-white dark:bg-zinc-900">
              Skool
            </option>
          </select>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <select
            value={sortOrder}
            onChange={(e: any) => setSortOrder(e.target.value)}
            className="w-full bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none text-xs cursor-pointer truncate"
          >
            <option value="newest" className="bg-white dark:bg-zinc-900">
              Newest First
            </option>
            <option value="oldest" className="bg-white dark:bg-zinc-900">
              Oldest First
            </option>
          </select>
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-20 bg-zinc-100 dark:bg-zinc-900/80 rounded-2xl border border-zinc-200 dark:border-zinc-800 animate-pulse"
            />
          ))}
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800">
          <Activity className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
            No activity logs match the selected filters
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
            Logs for OneDrive content syncing, Zernio social post publishing, and automatic folder renaming will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredActivities.map((act) => {
            const isExpanded = expandedId === act.id;
            const hasMetadata = Boolean(act.metadata);

            return (
              <div
                key={act.id}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 mt-0.5">
                      {getTypeIcon(act.type, act.status)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
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
                              CHANNEL_BADGES[act.channel.toLowerCase()] ||
                              "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                            }`}
                          >
                            {act.channel}
                          </span>
                        )}

                        <span
                          className={`text-[10px] uppercase font-medium px-1.5 py-0.5 rounded ${
                            act.status === "success"
                              ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                              : act.status === "error"
                              ? "text-rose-700 dark:text-rose-300 bg-rose-500/10"
                              : "text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800"
                          }`}
                        >
                          {act.status}
                        </span>
                      </div>

                      {act.description && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 font-mono break-all">
                          {act.description}
                        </p>
                      )}

                      {act.contentItemId && (
                        <Link
                          href={`/content/${act.contentItemId}`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 hover:underline transition-colors pt-1"
                        >
                          <span>View Associated Content Folder</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Timestamp & Expand */}
                  <div className="flex items-center sm:flex-col sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800 pt-2 sm:pt-0">
                    <div
                      className="text-[11px] text-zinc-500 font-mono cursor-help flex items-center gap-1"
                      title={act.createdAt}
                    >
                      <Clock className="w-3 h-3 text-zinc-400" />
                      <span>{formatRelativeTime(act.createdAt)}</span>
                    </div>

                    {hasMetadata && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : act.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
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
                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] uppercase font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider block mb-1">
                      Event Metadata / Debug Context:
                    </span>
                    <pre className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 font-mono text-[11px] overflow-x-auto border border-zinc-200 dark:border-zinc-800 max-h-60">
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
