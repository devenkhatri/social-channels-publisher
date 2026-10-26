"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Folder,
  Layers,
  Video,
  FileText,
  Clock,
  ArrowUpRight,
  Search,
  Sparkles,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Send,
  SlidersHorizontal,
  RefreshCw,
  ExternalLink,
  Check,
  CheckSquare,
  Square,
  X,
} from "lucide-react";

type ContentItem = {
  id: string;
  folderName: string;
  originalFolderName: string;
  folderPath: string;
  isDone: number;
  title: string | null;
  coverImage: string | null;
  slideCount: number;
  syncedAt: string | null;
  createdAt: string;
  posts: Array<{
    id: string;
    channel: string;
    status: string;
    title: string | null;
  }>;
};

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"unpublished" | "published" | "all">(
    "unpublished"
  );
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "title">(
    "newest"
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Fetch sync status (last refreshed datetime, etc.)
  const { data: syncStatus, refetch: refetchSyncStatus } = useQuery({
    queryKey: ["sync-status"],
    queryFn: async () => {
      const res = await fetch("/api/sync");
      if (!res.ok) return null;
      return res.json() as Promise<{
        lastSyncedAt: string | null;
        parentFolderPath: string | null;
        counts: { total: number; unpublished: number; published: number };
      }>;
    },
  });

  // Fetch content items with filter
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["content-items", filter],
    queryFn: async () => {
      const res = await fetch(`/api/content?filter=${filter}`);
      if (!res.ok) throw new Error("Failed to load content");
      return res.json() as Promise<{
        items: ContentItem[];
        counts: { total: number; unpublished: number; published: number };
      }>;
    },
  });

  // Sync Mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sync failed");
      return json;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["content-items"] });
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      setToastMessage(res.message || "Synced from OneDrive successfully!");
      setTimeout(() => setToastMessage(null), 4000);
    },
    onError: (err: any) => {
      setToastMessage(`Sync failed: ${err.message}`);
      setTimeout(() => setToastMessage(null), 5000);
    },
  });

  // Quick "Mark as Done & Rename on OneDrive" mutation
  const markDoneMutation = useMutation({
    mutationFn: async (contentItemId: string) => {
      const res = await fetch("/api/zernio/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentItemId, markDoneOnly: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to mark as done");
      return json;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["content-items"] });
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      setToastMessage(res.message || "Folder marked as -Done on OneDrive!");
      setTimeout(() => setToastMessage(null), 3500);
    },
    onError: (err: any) => {
      setToastMessage(`Error: ${err.message}`);
      setTimeout(() => setToastMessage(null), 4000);
    },
  });

  // Batch mutation for multi-selected content folders
  const batchMutation = useMutation({
    mutationFn: async (action: "mark-done" | "publish-all") => {
      const res = await fetch("/api/content/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: selectedIds, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Batch action failed");
      return json;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["content-items"] });
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      setSelectedIds([]);
      setToastMessage(res.message || "Batch action completed successfully!");
      setTimeout(() => setToastMessage(null), 4000);
    },
    onError: (err: any) => {
      setToastMessage(`Batch error: ${err.message}`);
      setTimeout(() => setToastMessage(null), 5000);
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = (itemsToSelect: ContentItem[]) => {
    setSelectedIds(itemsToSelect.map((item) => item.id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const counts = data?.counts || { total: 0, unpublished: 0, published: 0 };
  const rawItems = data?.items || [];

  const filteredItems = rawItems
    .filter((item) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        item.folderName.toLowerCase().includes(q) ||
        (item.title && item.title.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortOrder === "newest") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      if (sortOrder === "oldest") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
      return (a.title || a.folderName).localeCompare(b.title || b.folderName);
    });

  // Format relative time for last refreshed
  const formatLastSynced = (iso: string | null | undefined) => {
    if (!iso) return "Never synced";
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins === 1) return "1 minute ago";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getChannelPill = (channel: string, posts: any[]) => {
    const post = posts.find((p) => p.channel.toLowerCase() === channel.toLowerCase());
    const isPub = post?.status === "published";
    const isFail = post?.status === "failed";
    const isSched = post?.status === "scheduled";
    const isPublishing = post?.status === "publishing";

    let label = channel.toUpperCase().slice(0, 2);
    if (channel === "linkedin") label = "LI";
    if (channel === "linkedin_page") label = "LP";
    if (channel === "twitter" || channel === "x") label = "X";
    if (channel === "youtube") label = "YT";
    if (channel === "instagram") label = "IG";
    if (channel === "facebook") label = "FB";
    if (channel === "skool") label = "SK";

    return (
      <span
        key={channel}
        title={`${channel}: ${post?.status || "draft"}`}
        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1 ${
          isPub
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            : isFail
            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
            : isPublishing
            ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 animate-pulse"
            : isSched
            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
            : "bg-slate-800 text-slate-400 border border-slate-700/60"
        }`}
      >
        <span>{label}</span>
        {isPub && <span className="w-1 h-1 rounded-full bg-emerald-400" />}
        {isSched && <span className="w-1 h-1 rounded-full bg-blue-400" />}
        {isFail && <span className="w-1 h-1 rounded-full bg-rose-400" />}
        {isPublishing && <RefreshCw className="w-2.5 h-2.5 animate-spin text-indigo-400" />}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl bg-slate-900 border border-slate-700 text-white text-xs font-medium flex items-center gap-2.5 animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Content Dashboard
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
              OneDrive Source
            </span>
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400">
            <span>Social channel publisher & automated folder manager</span>
            <span className="text-slate-600">•</span>
            <div
              className="flex items-center gap-1 text-slate-300 cursor-help"
              title={syncStatus?.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleString() : undefined}
            >
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Last Refreshed: {formatLastSynced(syncStatus?.lastSyncedAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`}
            />
            <span>{syncMutation.isPending ? "Syncing..." : "Sync from OneDrive"}</span>
          </button>

          <Link
            href="/settings/onedrive"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors"
          >
            <Cloud className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Folder Settings</span>
          </Link>
        </div>
      </div>

      {/* Analytics KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Unpublished (Default) Card */}
        <div
          onClick={() => setFilter("unpublished")}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            filter === "unpublished"
              ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-400 font-medium">
            <span>Unpublished Folders</span>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white mt-2">
            {counts.unpublished}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Pending publication (without <code className="text-slate-300">-Done</code>)
          </p>
        </div>

        {/* Published Card */}
        <div
          onClick={() => setFilter("published")}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            filter === "published"
              ? "bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-400 font-medium">
            <span>Published Folders</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white mt-2">
            {counts.published}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Renamed with <code className="text-slate-300">-Done</code> suffix
          </p>
        </div>

        {/* Total Folders Card */}
        <div
          onClick={() => setFilter("all")}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            filter === "all"
              ? "bg-indigo-500/10 border-indigo-500/40 ring-1 ring-indigo-500/30"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-indigo-400 font-medium">
            <span>All Content Folders</span>
            <Folder className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white mt-2">
            {counts.total}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Synced from OneDrive source</p>
        </div>

        {/* Channels Card */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-blue-400 font-medium">
            <span>Social Platforms</span>
            <Send className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white mt-2">5</p>
          <p className="text-[11px] text-slate-400 mt-1">LI • YT • IG • FB • SK</p>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        {/* Status Filter Tabs */}
        <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setFilter("unpublished")}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              filter === "unpublished"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Unpublished ({counts.unpublished})
          </button>
          <button
            onClick={() => setFilter("published")}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              filter === "published"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Published -Done ({counts.published})
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              filter === "all"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All Folders ({counts.total})
          </button>
        </div>

        {/* Search & Sort */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or folder..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <SlidersHorizontal className="w-3 h-3" />
            <select
              value={sortOrder}
              onChange={(e: any) => setSortOrder(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none text-xs cursor-pointer"
            >
              <option value="newest" className="bg-slate-900 text-white">
                Newest
              </option>
              <option value="oldest" className="bg-slate-900 text-white">
                Oldest
              </option>
              <option value="title" className="bg-slate-900 text-white">
                Title A-Z
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Select All / Batch Options Toolbar */}
      {!isLoading && filteredItems.length > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-400 px-1 py-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (selectedIds.length === filteredItems.length) {
                  deselectAll();
                } else {
                  selectAll(filteredItems);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-medium transition-all shadow-sm min-h-[36px]"
            >
              {selectedIds.length === filteredItems.length && filteredItems.length > 0 ? (
                <>
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-slate-400" />
                  <span>Select All ({filteredItems.length})</span>
                </>
              )}
            </button>

            {selectedIds.length > 0 && (
              <span className="text-[11px] font-semibold text-indigo-400 animate-in fade-in">
                {selectedIds.length} of {filteredItems.length} selected
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
            Showing {filteredItems.length} folders
          </div>
        </div>
      )}

      {/* Content Items List / Empty State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-44 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse p-5"
            />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 sm:p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Folder className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">
            {counts.total === 0
              ? "No OneDrive content synced yet"
              : "No content matching this filter"}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1.5 mb-6">
            {counts.total === 0
              ? "Connect your Microsoft OneDrive account in Settings to select your content folder, then click Sync from OneDrive."
              : "Try switching between the Unpublished and Published tabs or adjust your search query."}
          </p>

          {counts.total === 0 ? (
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/settings/onedrive"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-lg shadow-indigo-600/25 transition-all"
              >
                <Cloud className="w-4 h-4" />
                <span>Configure OneDrive</span>
              </Link>
            </div>
          ) : (
            <button
              onClick={() => {
                setFilter("all");
                setSearch("");
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
                className={`group rounded-2xl p-5 shadow-lg shadow-black/20 flex flex-col justify-between transition-all ${
                  isSelected
                    ? "bg-indigo-950/30 border-2 border-indigo-500 ring-2 ring-indigo-500/20"
                    : "bg-slate-900/90 border border-slate-800 hover:border-slate-700"
                }`}
              >
                <div>
                  {/* Header: Select Checkbox, Folder name & Done badge */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(item.id);
                        }}
                        className={`p-1 rounded-lg transition-all min-h-[32px] min-w-[32px] flex items-center justify-center ${
                          isSelected
                            ? "text-indigo-400 bg-indigo-500/20"
                            : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                        }`}
                        title={isSelected ? "Deselect item" : "Select item for batch action"}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <Folder className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                        {item.folderName}
                      </span>
                    </div>

                    <span
                      className={`shrink-0 text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${
                        item.isDone === 1
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {item.isDone === 1 ? "Published (-Done)" : "Unpublished"}
                    </span>
                  </div>

                  {/* Title */}
                  <Link href={`/content/${item.id}`} className="block">
                    <h4 className="text-sm font-semibold text-white line-clamp-2 group-hover:text-indigo-300 transition-colors">
                      {item.title || "Untitled Post"}
                    </h4>
                  </Link>

                  {/* Media Badges */}
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      <Layers className="w-3 h-3 text-slate-400" />
                      <span>{item.slideCount || 0} Slides</span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      <Video className="w-3 h-3 text-rose-400" />
                      <span>Hyperframes</span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      <FileText className="w-3 h-3 text-blue-400" />
                      <span>PDF</span>
                    </div>
                  </div>
                </div>

                {/* Channels Status Strip & Action */}
                <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {["linkedin", "linkedin_page", "twitter", "youtube", "instagram", "facebook", "skool"].map(
                      (ch) => getChannelPill(ch, item.posts)
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.isDone === 0 && (
                      <button
                        onClick={() => markDoneMutation.mutate(item.id)}
                        disabled={markDoneMutation.isPending}
                        title="Mark as published & rename folder on OneDrive"
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600/20 text-slate-300 hover:text-emerald-400 text-[11px] font-medium border border-slate-700 hover:border-emerald-500/30 transition-all"
                      >
                        <span>-Done</span>
                      </button>
                    )}

                    <Link
                      href={`/content/${item.id}`}
                      className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <span>Editor</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Batch Action Dock */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-20 lg:bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-xl border border-indigo-500/50 shadow-2xl shadow-indigo-950/80 rounded-2xl px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200 max-w-[95vw] sm:max-w-max">
          <div className="flex items-center gap-2 text-xs font-semibold text-white pr-3 border-r border-slate-800">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-[11px] flex items-center justify-center font-bold">
              {selectedIds.length}
            </span>
            <span className="hidden sm:inline">Selected</span>
          </div>

          <button
            onClick={() => {
              if (
                confirm(
                  `Mark ${selectedIds.length} selected folders as Done & rename them with "-Done" on OneDrive?`
                )
              ) {
                batchMutation.mutate("mark-done");
              }
            }}
            disabled={batchMutation.isPending}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 min-h-[44px]"
          >
            {batchMutation.isPending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>Mark Done & Rename (-Done)</span>
          </button>

          <button
            onClick={() => {
              if (
                confirm(
                  `Publish all configured channels for ${selectedIds.length} selected folders?`
                )
              ) {
                batchMutation.mutate("publish-all");
              }
            }}
            disabled={batchMutation.isPending}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 min-h-[44px]"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publish All</span>
          </button>

          <button
            onClick={deselectAll}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
