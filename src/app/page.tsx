"use client";

import { useState, useMemo } from "react";
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
  Cloud,
  CheckCircle2,
  AlertCircle,
  Send,
  SlidersHorizontal,
  RefreshCw,
  ExternalLink,
  Check,
  CheckSquare,
  Square,
  X,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Filter,
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
    errorMessage?: string | null;
  }>;
};

type StatusFilter = "all" | "unpublished" | "in_progress" | "published";
type SortOption =
  | "newest"
  | "oldest"
  | "title_asc"
  | "title_desc"
  | "most_published"
  | "least_published"
  | "slides_desc";

const CHANNELS = [
  { id: "all", name: "All Channels" },
  { id: "linkedin", name: "LinkedIn" },
  { id: "linkedin_page", name: "LinkedIn Page" },
  { id: "threads", name: "Threads" },
  { id: "youtube", name: "YouTube" },
  { id: "instagram", name: "Instagram" },
  { id: "facebook", name: "Facebook" },
  { id: "skool", name: "Skool" },
];

export default function DashboardPage() {
  const queryClient = useQueryClient();

  // Filters & Sorting state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("unpublished");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [channelStatusFilter, setChannelStatusFilter] = useState<
    "any" | "published" | "pending" | "failed"
  >("any");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(24);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Selection & Feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Fetch sync status
  const { data: syncStatus } = useQuery({
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

  // Fetch content items (we fetch all and filter client-side for immediate responsive sorting & multi-filtering)
  const { data, isLoading } = useQuery({
    queryKey: ["content-items"],
    queryFn: async () => {
      const res = await fetch(`/api/content?filter=all`);
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

  const rawItems = data?.items || [];

  // Compute calculated metrics across all items
  const summaryCounts = useMemo(() => {
    let total = rawItems.length;
    let unpublished = 0;
    let inProgress = 0;
    let published = 0;

    for (const item of rawItems) {
      const pubCount = (item.posts || []).filter((p) => p.status === "published").length;
      if (item.isDone === 1 || pubCount === 7) {
        published++;
      } else if (pubCount > 0) {
        inProgress++;
        unpublished++;
      } else {
        unpublished++;
      }
    }

    return { total, unpublished, inProgress, published };
  }, [rawItems]);

  // Comprehensive Filtering and Sorting logic
  const filteredItems = useMemo(() => {
    return rawItems
      .filter((item) => {
        const pubCount = (item.posts || []).filter((p) => p.status === "published").length;
        const isDoneOrAllPub = item.isDone === 1 || pubCount === 7;

        // 1. Status Filter
        if (statusFilter === "unpublished" && isDoneOrAllPub) return false;
        if (statusFilter === "published" && !isDoneOrAllPub) return false;
        if (statusFilter === "in_progress" && (pubCount === 0 || isDoneOrAllPub)) return false;

        // 2. Channel Filter
        if (channelFilter !== "all") {
          const post = (item.posts || []).find(
            (p) => p.channel.toLowerCase() === channelFilter.toLowerCase()
          );
          if (channelStatusFilter === "published" && post?.status !== "published") return false;
          if (channelStatusFilter === "pending" && post?.status === "published") return false;
          if (channelStatusFilter === "failed" && post?.status !== "failed") return false;
        }

        // 3. Search query (matches title or folderName)
        if (search) {
          const q = search.toLowerCase();
          const matchTitle = item.title && item.title.toLowerCase().includes(q);
          const matchFolder = item.folderName.toLowerCase().includes(q);
          if (!matchTitle && !matchFolder) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOrder === "newest") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortOrder === "oldest") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortOrder === "title_asc") {
          return (a.title || a.folderName).localeCompare(b.title || b.folderName);
        }
        if (sortOrder === "title_desc") {
          return (b.title || b.folderName).localeCompare(a.title || a.folderName);
        }
        if (sortOrder === "slides_desc") {
          return (b.slideCount || 0) - (a.slideCount || 0);
        }
        if (sortOrder === "most_published") {
          const aPub = (a.posts || []).filter((p) => p.status === "published").length;
          const bPub = (b.posts || []).filter((p) => p.status === "published").length;
          return bPub - aPub;
        }
        if (sortOrder === "least_published") {
          const aPub = (a.posts || []).filter((p) => p.status === "published").length;
          const bPub = (b.posts || []).filter((p) => p.status === "published").length;
          return aPub - bPub;
        }
        return 0;
      });
  }, [rawItems, statusFilter, channelFilter, channelStatusFilter, search, sortOrder]);

  // Paginated slice
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    if (pageSize === 0) return filteredItems;
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

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
    if (channel === "threads") label = "TH";
    if (channel === "twitter" || channel === "x") label = "X";
    if (channel === "youtube") label = "YT";
    if (channel === "instagram") label = "IG";
    if (channel === "facebook") label = "FB";
    if (channel === "skool") label = "SK";

    const statusTitle = isPub
      ? `${channel}: Published`
      : isSched
      ? `${channel}: Queued`
      : isFail
      ? `${channel}: Failed (${post?.errorMessage || "error"})`
      : `${channel}: Pending`;

    return (
      <span
        key={channel}
        title={statusTitle}
        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium flex items-center gap-1 transition-all ${
          isPub
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25"
            : isFail
            ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25"
            : isPublishing
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 animate-pulse"
            : isSched
            ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25"
            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60"
        }`}
      >
        <span>{label}</span>
        {isPub && <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />}
        {isSched && <Clock className="w-2.5 h-2.5 text-sky-600 dark:text-sky-400" />}
        {isFail && <AlertCircle className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />}
        {isPublishing && <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-600 dark:text-amber-400" />}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12 transition-colors">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 p-4 rounded-xl shadow-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border border-zinc-700 text-xs font-medium flex items-center gap-2.5 animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Content Dashboard
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-medium">
              OneDrive Source
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Automated multi-channel publisher & folder sync</span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <div
              className="flex items-center gap-1 cursor-help"
              title={
                syncStatus?.lastSyncedAt
                  ? new Date(syncStatus.lastSyncedAt).toLocaleString()
                  : undefined
              }
            >
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span>Last Refreshed: {formatLastSynced(syncStatus?.lastSyncedAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`}
            />
            <span>{syncMutation.isPending ? "Syncing..." : "Sync from OneDrive"}</span>
          </button>

          <Link
            href="/settings/onedrive"
            className="flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs font-medium bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 transition-colors shadow-xs"
          >
            <Cloud className="w-3.5 h-3.5 text-zinc-500" />
            <span className="hidden sm:inline">Folder Settings</span>
          </Link>
        </div>
      </div>

      {/* Analytics KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Unpublished (Pending) Card */}
        <div
          onClick={() => {
            setStatusFilter("unpublished");
            setCurrentPage(1);
          }}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === "unpublished"
              ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-medium">
            <span>Pending Folders</span>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
            {summaryCounts.unpublished}
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
            Folders pending publication
          </p>
        </div>

        {/* In-Progress Card */}
        <div
          onClick={() => {
            setStatusFilter("in_progress");
            setCurrentPage(1);
          }}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === "in_progress"
              ? "bg-sky-500/10 border-sky-500/40 ring-1 ring-sky-500/30"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-sky-600 dark:text-sky-400 font-medium">
            <span>In Progress (1-6)</span>
            <Send className="w-3.5 h-3.5 text-sky-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
            {summaryCounts.inProgress}
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
            Partially published channels
          </p>
        </div>

        {/* Published Card */}
        <div
          onClick={() => {
            setStatusFilter("published");
            setCurrentPage(1);
          }}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === "published"
              ? "bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <span>Published (-Done)</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
            {summaryCounts.published}
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
            Marked with <code className="text-zinc-600 dark:text-zinc-300">-Done</code>
          </p>
        </div>

        {/* Total Folders Card */}
        <div
          onClick={() => {
            setStatusFilter("all");
            setCurrentPage(1);
          }}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === "all"
              ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 ring-1 ring-zinc-400/30"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300 font-medium">
            <span>All Folders</span>
            <Folder className="w-3.5 h-3.5 text-zinc-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
            {summaryCounts.total}
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
            Total synced content units
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search & View Controls */}
      <div className="space-y-3 pt-2">
        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 text-xs font-medium max-w-full overflow-x-auto">
            <button
              onClick={() => {
                setStatusFilter("unpublished");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                statusFilter === "unpublished"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              Pending ({summaryCounts.unpublished})
            </button>
            <button
              onClick={() => {
                setStatusFilter("in_progress");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                statusFilter === "in_progress"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              In Progress ({summaryCounts.inProgress})
            </button>
            <button
              onClick={() => {
                setStatusFilter("published");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                statusFilter === "published"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              Published ({summaryCounts.published})
            </button>
            <button
              onClick={() => {
                setStatusFilter("all");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                statusFilter === "all"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              All ({summaryCounts.total})
            </button>
          </div>

          {/* View mode toggle (Table/List vs Grid) */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60">
            <button
              onClick={() => setViewMode("table")}
              title="Table / List View"
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "table"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              title="Grid View"
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "grid"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search, Channel Dropdown, and Sort Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search title or folder..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Channel Filter Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2">
            <Filter className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <select
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none text-xs cursor-pointer truncate"
            >
              {CHANNELS.map((ch) => (
                <option key={ch.id} value={ch.id} className="bg-white dark:bg-zinc-900">
                  {ch.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Order Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <select
              value={sortOrder}
              onChange={(e: any) => setSortOrder(e.target.value)}
              className="w-full bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none text-xs cursor-pointer truncate"
            >
              <option value="newest" className="bg-white dark:bg-zinc-900">
                Newest Date
              </option>
              <option value="oldest" className="bg-white dark:bg-zinc-900">
                Oldest Date
              </option>
              <option value="title_asc" className="bg-white dark:bg-zinc-900">
                Title (A to Z)
              </option>
              <option value="title_desc" className="bg-white dark:bg-zinc-900">
                Title (Z to A)
              </option>
              <option value="most_published" className="bg-white dark:bg-zinc-900">
                Most Published
              </option>
              <option value="least_published" className="bg-white dark:bg-zinc-900">
                Most Pending
              </option>
              <option value="slides_desc" className="bg-white dark:bg-zinc-900">
                Most Slides
              </option>
            </select>
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2">
            <span className="text-[11px] text-zinc-500 whitespace-nowrap">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none text-xs cursor-pointer ml-2"
            >
              <option value={12} className="bg-white dark:bg-zinc-900">
                12
              </option>
              <option value={24} className="bg-white dark:bg-zinc-900">
                24
              </option>
              <option value={48} className="bg-white dark:bg-zinc-900">
                48
              </option>
              <option value={0} className="bg-white dark:bg-zinc-900">
                All ({filteredItems.length})
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Select All / Batch Options Toolbar */}
      {!isLoading && filteredItems.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400 px-1 py-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (selectedIds.length === filteredItems.length) {
                  deselectAll();
                } else {
                  selectAll(filteredItems);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium transition-all shadow-xs min-h-[36px] whitespace-nowrap shrink-0"
            >
              {selectedIds.length === filteredItems.length && filteredItems.length > 0 ? (
                <>
                  <CheckSquare className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0" />
                  <span className="whitespace-nowrap">Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="whitespace-nowrap">Select All ({filteredItems.length})</span>
                </>
              )}
            </button>

            {selectedIds.length > 0 && (
              <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 animate-in fade-in">
                {selectedIds.length} of {filteredItems.length} selected
              </span>
            )}
          </div>

          <div className="text-[11px] text-zinc-500 font-mono">
            Showing {paginatedItems.length} of {filteredItems.length} folders
          </div>
        </div>
      )}

      {/* Content Items List / Empty State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-44 rounded-2xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 animate-pulse p-5"
            />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 p-8 sm:p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center mx-auto mb-4 text-zinc-400">
            <Folder className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {summaryCounts.total === 0
              ? "No OneDrive content synced yet"
              : "No content matching this filter"}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mt-1.5 mb-6">
            {summaryCounts.total === 0
              ? "Connect your Microsoft OneDrive account in Settings to select your content folder, then click Sync from OneDrive."
              : "Try switching status filters, resetting channel options, or clearing your search term."}
          </p>

          {summaryCounts.total === 0 ? (
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/settings/onedrive"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium shadow-sm transition-all"
              >
                <Cloud className="w-4 h-4" />
                <span>Configure OneDrive</span>
              </Link>
            </div>
          ) : (
            <button
              onClick={() => {
                setStatusFilter("all");
                setChannelFilter("all");
                setSearch("");
                setCurrentPage(1);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium border border-zinc-200 dark:border-zinc-700 transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedItems.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
                className={`group rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all ${
                  isSelected
                    ? "bg-zinc-50 dark:bg-zinc-800/50 border-2 border-zinc-900 dark:border-zinc-100 ring-2 ring-zinc-900/10 dark:ring-zinc-100/10"
                    : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
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
                            ? "text-zinc-900 dark:text-zinc-100 bg-zinc-200 dark:bg-zinc-700"
                            : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                        title={isSelected ? "Deselect item" : "Select item for batch action"}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <Folder className="w-4 h-4 text-zinc-500 shrink-0" />
                      <span className="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        {item.folderName}
                      </span>
                    </div>

                    <span
                      className={`shrink-0 text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${
                        item.isDone === 1
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25"
                      }`}
                    >
                      {item.isDone === 1 ? "Published (-Done)" : "Pending"}
                    </span>
                  </div>

                  {/* Title */}
                  <Link href={`/content/${item.id}`} className="block">
                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors">
                      {item.title || "Untitled Post"}
                    </h4>
                  </Link>

                  {/* Media Badges */}
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                      <Layers className="w-3 h-3 text-zinc-500" />
                      <span>{item.slideCount || 0} Slides</span>
                    </div>
                    <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                      <Video className="w-3 h-3 text-rose-500" />
                      <span>Hyperframes</span>
                    </div>
                    <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                      <FileText className="w-3 h-3 text-sky-500" />
                      <span>PDF</span>
                    </div>
                  </div>
                </div>

                {/* Channels Status Strip & Action */}
                <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 text-[11px]">
                      {(() => {
                        const pubCount = (item.posts || []).filter(
                          (p: any) => p.status === "published"
                        ).length;
                        const schedCount = (item.posts || []).filter(
                          (p: any) => p.status === "scheduled"
                        ).length;

                        if (pubCount === 7) {
                          return (
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>All 7 channels published</span>
                            </span>
                          );
                        }
                        if (pubCount > 0) {
                          return (
                            <span className="text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <span>
                                {pubCount} of 7 published ({7 - pubCount} pending
                                {schedCount > 0 ? `, ${schedCount} queued` : ""})
                              </span>
                            </span>
                          );
                        }
                        if (schedCount > 0) {
                          return (
                            <span className="text-sky-700 dark:text-sky-300 font-medium flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                              <span>{schedCount} queued • {7 - schedCount} pending</span>
                            </span>
                          );
                        }
                        return (
                          <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                            <span>7 channels pending</span>
                          </span>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        "linkedin",
                        "linkedin_page",
                        "threads",
                        "youtube",
                        "instagram",
                        "facebook",
                        "skool",
                      ].map((ch) => getChannelPill(ch, item.posts || []))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {item.isDone === 0 && (
                      <button
                        onClick={() => markDoneMutation.mutate(item.id)}
                        disabled={markDoneMutation.isPending}
                        title="Mark as published & rename folder on OneDrive"
                        className="px-2.5 py-1 min-h-[32px] rounded-lg bg-zinc-100 hover:bg-emerald-500/10 text-zinc-700 hover:text-emerald-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:text-emerald-300 text-[11px] font-medium border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500/30 transition-all"
                      >
                        <span>-Done</span>
                      </button>
                    )}

                    <Link
                      href={`/content/${item.id}`}
                      className="flex items-center gap-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors px-2.5 py-1 min-h-[32px] rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-xs"
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
      ) : (
        /* TABLE / LIST VIEW */
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedIds.length === filteredItems.length) {
                          deselectAll();
                        } else {
                          selectAll(filteredItems);
                        }
                      }}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      {selectedIds.length === filteredItems.length && filteredItems.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 min-w-[200px]">Folder & Title</th>
                  <th className="py-3 px-4">Slides</th>
                  <th className="py-3 px-4 min-w-[260px]">Channels</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {paginatedItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  const pubCount = (item.posts || []).filter(
                    (p: any) => p.status === "published"
                  ).length;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors ${
                        isSelected ? "bg-zinc-50 dark:bg-zinc-800/30" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => toggleSelect(item.id)}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 min-h-[32px] min-w-[32px] flex items-center justify-center"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Folder className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="font-mono text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                            {item.folderName}
                          </span>
                        </div>
                        <Link
                          href={`/content/${item.id}`}
                          className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline line-clamp-1 mt-0.5"
                        >
                          {item.title || "Untitled Post"}
                        </Link>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-500 font-mono">
                        {item.slideCount || 0} slides
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[
                            "linkedin",
                            "linkedin_page",
                            "threads",
                            "youtube",
                            "instagram",
                            "facebook",
                            "skool",
                          ].map((ch) => getChannelPill(ch, item.posts || []))}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${
                            item.isDone === 1 || pubCount === 7
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                              : pubCount > 0
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                          }`}
                        >
                          {item.isDone === 1
                            ? "Done"
                            : pubCount === 7
                            ? "All Pub"
                            : pubCount > 0
                            ? `${pubCount}/7 Pub`
                            : "Pending"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {item.isDone === 0 && (
                            <button
                              onClick={() => markDoneMutation.mutate(item.id)}
                              disabled={markDoneMutation.isPending}
                              title="Mark as -Done on OneDrive"
                              className="px-2 py-1 rounded bg-zinc-100 hover:bg-emerald-500/10 text-zinc-700 hover:text-emerald-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:text-emerald-300 text-[10px] font-medium border border-zinc-200 dark:border-zinc-700 transition-colors"
                            >
                              -Done
                            </button>
                          )}
                          <Link
                            href={`/content/${item.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium shadow-xs transition-colors"
                          >
                            <span>Open</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-zinc-600 dark:text-zinc-400">
          <div className="text-[11px] text-zinc-500">
            Page {currentPage} of {totalPages} ({filteredItems.length} items total)
          </div>

          <div className="flex items-center gap-1.5 self-center sm:self-auto">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 transition-colors shadow-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNum = currentPage - 3 + i;
                  if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                      currentPage === pageNum
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 transition-colors shadow-xs"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Batch Action Dock */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-20 lg:bottom-8 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/95 text-white dark:bg-zinc-800/95 backdrop-blur-xl border border-zinc-700 shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200 max-w-[95vw] sm:max-w-max">
          <div className="flex items-center gap-2 text-xs font-semibold text-white pr-3 border-r border-zinc-700">
            <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-900 text-[11px] flex items-center justify-center font-bold">
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
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 min-h-[44px]"
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
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-zinc-900 hover:bg-zinc-100 text-xs font-semibold shadow-sm transition-all disabled:opacity-50 min-h-[44px]"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publish All</span>
          </button>

          <button
            onClick={deselectAll}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors ml-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
