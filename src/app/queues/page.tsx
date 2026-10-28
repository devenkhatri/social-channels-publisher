"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CalendarClock,
  Clock,
  RefreshCw,
  Search,
  KeyRound,
  Layers,
  FileText,
  Video,
  Image as ImageIcon,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  FolderSync,
  ChevronDown,
  ChevronUp,
  LayoutList,
  LayoutGrid,
  Filter,
  ArrowUpDown,
  CalendarDays,
  Building2,
} from "lucide-react";
import { CollapsibleCardsSection } from "@/components/ui/CollapsibleCardsSection";
import { CollapsibleFilterSection } from "@/components/ui/CollapsibleFilterSection";
import { QueuesCalendarView } from "@/components/queues/QueuesCalendarView";


interface QueuedPostPlatform {
  platform: string;
  status: string;
  username?: string | null;
  displayName?: string | null;
  profilePicture?: string | null;
  scheduledFor?: string | null;
  platformSpecificData?: Record<string, any>;
  platformPostUrl?: string | null;
  platformPostId?: string | null;
  publishedAt?: string | null;
}

interface QueuedPostItem {
  id: string;
  zernioAccountId: string;
  zernioAccountName: string;
  profileId?: string | null;
  profileName?: string | null;
  title: string;
  content: string;
  scheduledFor: string | null;
  status: string;
  queueId?: string | null;
  mediaItems: Array<{
    url: string;
    type: "video" | "image" | "document" | string;
  }>;
  platforms: QueuedPostPlatform[];
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface AccountQueueSummary {
  accountId: string;
  accountName: string;
  totalQueued: number;
  platforms: string[];
  profiles: Array<{
    id: string;
    name: string;
    queuedCount: number;
  }>;
}

interface ZernioQueuesResponse {
  accounts: AccountQueueSummary[];
  posts: QueuedPostItem[];
  totalQueued: number;
  nextScheduledAt: string | null;
}

export default function QueuesPage() {
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"cards" | "table" | "calendar">("table");
  const [expandedPostIds, setExpandedPostIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Fetch all queues
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<ZernioQueuesResponse>({
    queryKey: ["zernio-queues", selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStatus && selectedStatus !== "all") {
        params.set("status", selectedStatus);
      } else {
        params.set("status", "all");
      }
      const url = `/api/zernio/queues?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch Zernio queues");
      }
      return res.json();
    },
    staleTime: 30000,
  });

  // Delete post from queue mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ postId, accountId }: { postId: string; accountId: string }) => {
      const res = await fetch(`/api/zernio/queues?postId=${encodeURIComponent(postId)}&accountId=${encodeURIComponent(accountId)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to remove post from queue");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zernio-queues"] });
      setToastMessage({
        text: "Post successfully removed from Zernio queue",
        type: "success",
      });
      setTimeout(() => setToastMessage(null), 4000);
    },
    onError: (err: any) => {
      setToastMessage({
        text: err.message || "Failed to remove post",
        type: "error",
      });
      setTimeout(() => setToastMessage(null), 5000);
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedPostIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  // Filter posts
  const filteredPosts = useMemo(() => {
    if (!data?.posts) return [];
    return data.posts.filter((post) => {
      // Account filter
      if (selectedAccountId !== "all" && post.zernioAccountId !== selectedAccountId) {
        return false;
      }

      // Platform filter
      if (selectedPlatform !== "all") {
        const matchesPlat = post.platforms.some(
          (pl) => pl.platform.toLowerCase() === selectedPlatform.toLowerCase()
        );
        if (!matchesPlat) return false;
      }

      // Status filter
      if (selectedStatus !== "all") {
        if ((post.status || "").toLowerCase() !== selectedStatus.toLowerCase()) {
          return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = post.title.toLowerCase().includes(q);
        const matchesContent = post.content.toLowerCase().includes(q);
        const matchesAccount = post.zernioAccountName.toLowerCase().includes(q);
        const matchesStatus = (post.status || "").toLowerCase().includes(q);
        const matchesPlatform = post.platforms.some(
          (pl) =>
            pl.platform.toLowerCase().includes(q) ||
            (pl.status && pl.status.toLowerCase().includes(q)) ||
            (pl.username && pl.username.toLowerCase().includes(q)) ||
            (pl.displayName && pl.displayName.toLowerCase().includes(q))
        );
        if (!matchesTitle && !matchesContent && !matchesAccount && !matchesStatus && !matchesPlatform) {
          return false;
        }
      }

      return true;
    });
  }, [data, selectedAccountId, selectedPlatform, selectedStatus, searchQuery]);

  // Sorting state for queues table
  type SortField = "status" | "scheduledFor" | "account" | "channels" | "content" | "media";
  type SortDirection = "asc" | "desc";

  const [sortField, setSortField] = useState<SortField>("scheduledFor");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "scheduledFor" ? "asc" : "asc");
    }
  };

  // Sort filtered posts
  const sortedPosts = useMemo(() => {
    return [...filteredPosts].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "status": {
          const aStat = (a.status || "").toLowerCase();
          const bStat = (b.status || "").toLowerCase();
          comparison = aStat.localeCompare(bStat);
          break;
        }
        case "scheduledFor": {
          const aTime = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
          const bTime = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
          comparison = aTime - bTime;
          break;
        }
        case "account": {
          const aAcc = (a.zernioAccountName || "").toLowerCase();
          const bAcc = (b.zernioAccountName || "").toLowerCase();
          comparison = aAcc.localeCompare(bAcc);
          break;
        }
        case "channels": {
          const aCh = a.platforms.map((p) => p.platform).sort().join(",").toLowerCase();
          const bCh = b.platforms.map((p) => p.platform).sort().join(",").toLowerCase();
          comparison = aCh.localeCompare(bCh);
          break;
        }
        case "content": {
          const aText = (a.title || a.content || "").toLowerCase();
          const bText = (b.title || b.content || "").toLowerCase();
          comparison = aText.localeCompare(bText);
          break;
        }
        case "media": {
          const aMedia = a.mediaItems?.length || 0;
          const bMedia = b.mediaItems?.length || 0;
          comparison = aMedia - bMedia;
          break;
        }
        default:
          comparison = 0;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredPosts, sortField, sortDirection]);

  // Aggregate platforms across all accounts
  const allPlatforms = useMemo(() => {
    if (!data?.posts) return [];
    const set = new Set<string>();
    data.posts.forEach((p) => {
      p.platforms.forEach((pl) => set.add(pl.platform));
    });
    return Array.from(set).sort();
  }, [data]);

  // Aggregate statuses across all posts
  const allStatuses = useMemo(() => {
    const defaultStatuses = ["scheduled", "published", "draft", "failed"];
    if (!data?.posts) return defaultStatuses;
    const set = new Set<string>(defaultStatuses);
    data.posts.forEach((p) => {
      if (p.status) set.add(p.status.toLowerCase());
    });
    return Array.from(set);
  }, [data]);

  // Format countdown
  const getRelativeTime = (dateString: string | null) => {
    if (!dateString) return "Unscheduled";
    const target = new Date(dateString).getTime();
    const now = Date.now();
    const diffMs = target - now;

    if (diffMs < 0) return "Due now / past";
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      const remHours = diffHours % 24;
      return `in ${diffDays}d ${remHours}h`;
    }
    if (diffHours > 0) {
      const remMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `in ${diffHours}h ${remMins}m`;
    }
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `in ${Math.max(1, diffMins)}m`;
  };

  const formatScheduleDate = (dateString: string | null) => {
    if (!dateString) return "No date assigned";
    const d = new Date(dateString);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPlatformBadgeColor = (plat: string) => {
    switch (plat.toLowerCase()) {
      case "linkedin":
        return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25";
      case "linkedin_page":
        return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25";
      case "youtube":
        return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/25";
      case "instagram":
        return "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/25";
      case "facebook":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25";
      case "threads":
      case "twitter":
      case "x":
        return "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700";
      default:
        return "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700";
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "scheduled").toLowerCase();
    switch (s) {
      case "scheduled":
      case "queue":
      case "queued":
        return {
          label: "Scheduled",
          classes: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
          dotColor: "bg-amber-500",
        };
      case "published":
      case "posted":
      case "success":
        return {
          label: "Published",
          classes: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
          dotColor: "bg-emerald-500",
        };
      case "failed":
      case "error":
        return {
          label: "Failed",
          classes: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25",
          dotColor: "bg-rose-500",
        };
      case "draft":
        return {
          label: "Draft",
          classes: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/25",
          dotColor: "bg-zinc-400",
        };
      default:
        return {
          label: status,
          classes: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25",
          dotColor: "bg-indigo-500",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3">
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg border ${
              toastMessage.type === "success"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-700 dark:border-zinc-300"
                : "bg-rose-600 text-white border-rose-700"
            }`}
          >
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-white shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center shadow-xs">
              <CalendarClock className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Zernio Queues
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
            Live schedule and publishing queues across all configured Zernio accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white shadow-xs transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading || isRefetching ? "animate-spin" : ""}`}
            />
            <span>Refresh Queues</span>
          </button>

          <Link
            href="/settings/zernio"
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 transition-all shadow-xs"
          >
            <KeyRound className="w-3.5 h-3.5 text-zinc-500" />
            <span>Manage Accounts</span>
          </Link>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <CollapsibleCardsSection
        title="Overview Cards"
        icon={CalendarClock}
        summary={`${data?.totalQueued ?? 0} posts queued • ${allPlatforms.length} active channels`}
        badge={
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            4 cards
          </span>
        }
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Queued */}
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              <span className="font-medium">Total Queued</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {isLoading ? "..." : data?.totalQueued ?? 0}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">Posts waiting in queue</p>
          </div>

          {/* Configured Accounts */}
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              <span className="font-medium">Zernio Accounts</span>
              <KeyRound className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {isLoading ? "..." : data?.accounts.length ?? 0}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">Configured publishing keys</p>
          </div>

          {/* Active Platforms */}
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              <span className="font-medium">Active Channels</span>
              <Layers className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {isLoading ? "..." : allPlatforms.length}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">Scheduled platforms</p>
          </div>

          {/* Next Scheduled */}
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              <span className="font-medium">Next Post</span>
              <CalendarClock className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {isLoading
                ? "..."
                : data?.nextScheduledAt
                ? getRelativeTime(data.nextScheduledAt)
                : "None scheduled"}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
              {data?.nextScheduledAt ? formatScheduleDate(data.nextScheduledAt) : "Queue is empty"}
            </p>
          </div>
        </div>
      </CollapsibleCardsSection>

      {/* Account Switcher Tabs & Filter Toolbar inside CollapsibleFilterSection */}
      <CollapsibleFilterSection
        title="Queue Filters & Accounts"
        activeFiltersCount={
          (selectedAccountId !== "all" ? 1 : 0) +
          (selectedPlatform !== "all" ? 1 : 0) +
          (selectedStatus !== "all" ? 1 : 0) +
          (searchQuery.trim() ? 1 : 0)
        }
        activeFiltersSummary={`${
          selectedAccountId !== "all"
            ? data?.accounts.find((a) => a.accountId === selectedAccountId)?.accountName || "Account"
            : "All Accounts"
        } • ${selectedPlatform !== "all" ? selectedPlatform : "All Platforms"} • ${
          selectedStatus !== "all" ? selectedStatus : "All Statuses"
        }${searchQuery.trim() ? ` • "${searchQuery}"` : ""}`}
        onClearFilters={() => {
          setSelectedAccountId("all");
          setSelectedPlatform("all");
          setSelectedStatus("all");
          setSearchQuery("");
        }}
      >
        <div className="space-y-3">
          {/* Account Switcher Tabs */}
          {data?.accounts && data.accounts.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedAccountId("all")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  selectedAccountId === "all"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs"
                    : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <span>All Accounts</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedAccountId === "all"
                      ? "bg-zinc-800 text-zinc-200 dark:bg-zinc-200 dark:text-zinc-800"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {data.totalQueued}
                </span>
              </button>

              {data.accounts.map((acc) => {
                const isSelected = selectedAccountId === acc.accountId;
                return (
                  <button
                    key={acc.accountId}
                    onClick={() => setSelectedAccountId(acc.accountId)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                      isSelected
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs font-semibold"
                        : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    <span>{acc.accountName}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected
                          ? "bg-zinc-800 text-zinc-200 dark:bg-zinc-200 dark:text-zinc-800"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {acc.totalQueued}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Filter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 shadow-xs">
            {/* Left: Platform filter & Search */}
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1 sm:max-w-xs min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search posts, handles, topics..."
                  className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                />
              </div>

              {/* Platform filter pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                <button
                  onClick={() => setSelectedPlatform("all")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedPlatform === "all"
                      ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  All Platforms
                </button>
                {allPlatforms.map((plat) => (
                  <button
                    key={plat}
                    onClick={() => setSelectedPlatform(plat)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                      selectedPlatform === plat
                        ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                    }`}
                  >
                    {plat === "linkedin_page" ? "LinkedIn Page" : plat}
                  </button>
                ))}
              </div>

              {/* Status filter dropdown / pills */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-800 py-1 shrink-0 whitespace-nowrap">
                <span className="text-[11px] text-zinc-400 font-medium inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                  <Filter className="w-3 h-3 shrink-0" />
                  <span>Status:</span>
                </span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 capitalize cursor-pointer shrink-0"
                >
                  <option value="all">All Statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>

            {/* Right: View mode & Count */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <span className="text-xs text-zinc-500 font-mono hidden sm:inline">
                Showing {filteredPosts.length} of {data?.totalQueued ?? 0}
              </span>

              <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
                <button
                  onClick={() => setViewMode("table")}
                  title="Compact List View"
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === "table"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                      : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  }`}
                >
                  <LayoutList className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("cards")}
                  title="Timeline Cards View"
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === "cards"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                      : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("calendar")}
                  title="Calendar Schedule View"
                  className={`p-1.5 rounded-lg transition-all ${
                    viewMode === "calendar"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                      : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleFilterSection>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center">
          <RefreshCw className="w-6 h-6 animate-spin text-zinc-400 mx-auto mb-3" />
          <p className="text-xs text-zinc-500 font-medium">Fetching scheduled queues from Zernio accounts...</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center mx-auto mb-4 text-zinc-400">
            <CalendarClock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {data?.totalQueued === 0 ? "No posts currently queued in Zernio" : "No queued posts match your filters"}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mt-1.5 mb-6">
            {data?.totalQueued === 0
              ? "Open any folder in your Content Library and click 'Publish All' or 'Publish Channel' to schedule posts into Zernio queues."
              : "Try switching account tabs or resetting your platform filters to see scheduled posts."}
          </p>
          <div className="flex items-center justify-center gap-3">
            {data?.totalQueued === 0 ? (
              <Link
                href="/content"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-all"
              >
                <FolderSync className="w-4 h-4" />
                <span>Go to Content Library</span>
              </Link>
            ) : (
              <button
                onClick={() => {
                  setSelectedAccountId("all");
                  setSelectedPlatform("all");
                  setSelectedStatus("all");
                  setSearchQuery("");
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      ) : viewMode === "calendar" ? (
        /* CALENDAR VIEW */
        <QueuesCalendarView
          posts={filteredPosts}
          onDeletePost={(post) => {
            if (
              confirm(
                `Remove "${post.title}" from queue?`
              )
            ) {
              deleteMutation.mutate({
                postId: post.postId,
                accountId: post.accountId,
              });
            }
          }}
          isDeleting={deleteMutation.isPending}
          deletingPostId={deleteMutation.variables?.postId}
          getStatusBadge={getStatusBadge}
          getPlatformBadgeColor={getPlatformBadgeColor}
        />
      ) : viewMode === "cards" ? (
        /* CARDS / TIMELINE VIEW */
        <div className="space-y-4">
          {sortedPosts.map((post) => {
            const isExpanded = expandedPostIds[post.id];
            const hasLongContent = post.content && post.content.length > 280;
            const isDeleting = deleteMutation.isPending && deleteMutation.variables?.postId === post.id;
            const statusInfo = getStatusBadge(post.status);

            return (
              <div
                key={post.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between gap-4"
              >
                {/* Header row: Account Badge, Platform Chips, Status & Scheduled Time */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Account Pill */}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      <KeyRound className="w-3 h-3 text-zinc-400" />
                      <span>{post.zernioAccountName}</span>
                    </span>

                    {/* Status Pill */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusInfo.classes}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
                      <span className="capitalize">{statusInfo.label}</span>
                    </span>

                    {/* Platforms */}
                    {post.platforms.map((pl, idx) => {
                      const badgeClasses = `inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getPlatformBadgeColor(
                        pl.platform
                      )}`;
                      const label =
                        pl.platform === "linkedin_page"
                          ? "LinkedIn Page"
                          : pl.platform === "linkedin"
                          ? "LinkedIn Personal"
                          : pl.platform;

                      if (pl.platformPostUrl) {
                        return (
                          <a
                            key={idx}
                            href={pl.platformPostUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${badgeClasses} hover:brightness-110 hover:shadow-xs transition-all cursor-pointer`}
                            title={`Open published post on ${label}`}
                          >
                            {pl.profilePicture && (
                              <img
                                src={pl.profilePicture}
                                alt=""
                                className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                              />
                            )}
                            {pl.platform === "linkedin_page" && (
                              <Building2 className="w-3 h-3 shrink-0 opacity-80" />
                            )}
                            <span className="capitalize">{label}</span>
                            {pl.username && (
                              <span className="text-[10px] opacity-75 font-mono">
                                @{pl.username}
                              </span>
                            )}
                            <ExternalLink className="w-3 h-3 opacity-75 ml-0.5" />
                          </a>
                        );
                      }

                      return (
                        <span key={idx} className={badgeClasses}>
                          {pl.profilePicture && (
                            <img
                              src={pl.profilePicture}
                              alt=""
                              className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                            />
                          )}
                          {pl.platform === "linkedin_page" && (
                            <Building2 className="w-3 h-3 shrink-0 opacity-80" />
                          )}
                          <span className="capitalize">{label}</span>
                          {pl.username && (
                            <span className="text-[10px] opacity-75 font-mono">
                              @{pl.username}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>

                  {/* Schedule Countdown & Exact Time */}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                      <Clock className="w-3 h-3" />
                      <span>{getRelativeTime(post.scheduledFor)}</span>
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                      {formatScheduleDate(post.scheduledFor)}
                    </span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="space-y-2">
                  {post.title && (
                    <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                      {post.title}
                    </h3>
                  )}

                  <div className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed font-sans">
                    {hasLongContent && !isExpanded
                      ? `${post.content.slice(0, 280)}...`
                      : post.content}
                  </div>

                  {hasLongContent && (
                    <button
                      onClick={() => toggleExpand(post.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors pt-1"
                    >
                      <span>{isExpanded ? "Show Less" : "Read Full Post"}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>

                {/* Media Attachments & Card Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  {/* Media Chips */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {post.mediaItems && post.mediaItems.length > 0 ? (
                      post.mediaItems.map((m, mIdx) => (
                        <a
                          key={mIdx}
                          href={m.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 transition-all shadow-2xs"
                        >
                          {m.type === "video" ? (
                            <Video className="w-3.5 h-3.5 text-rose-500" />
                          ) : m.type === "document" ? (
                            <FileText className="w-3.5 h-3.5 text-sky-500" />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                          <span className="capitalize">{m.type}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-zinc-400" />
                        </a>
                      ))
                    ) : (
                      <span className="text-[11px] text-zinc-400 italic font-mono">
                        Text-only post
                      </span>
                    )}
                  </div>

                  {/* Actions: Copy & Delete */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() =>
                        copyToClipboard(
                          post.title ? `${post.title}\n\n${post.content}` : post.content,
                          post.id
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                      title="Copy post content"
                    >
                      {copiedId === post.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-zinc-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Remove this post ("${post.title || post.content.slice(0, 30)}...") from the ${post.zernioAccountName} queue?`
                          )
                        ) {
                          deleteMutation.mutate({
                            postId: post.id,
                            accountId: post.zernioAccountId,
                          });
                        }
                      }}
                      disabled={isDeleting}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-50"
                      title="Cancel and remove from queue"
                    >
                      {isDeleting ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE / COMPACT LIST VIEW */
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th
                    onClick={() => handleSort("status")}
                    className="py-3 px-4 cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                    title="Click to sort by status"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Status</span>
                      {sortField === "status" ? (
                        sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-zinc-400 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("scheduledFor")}
                    className="py-3 px-4 cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                    title="Click to sort by scheduled time"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Scheduled For</span>
                      {sortField === "scheduledFor" ? (
                        sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-zinc-400 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("account")}
                    className="py-3 px-4 cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                    title="Click to sort by account"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Account</span>
                      {sortField === "account" ? (
                        sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-zinc-400 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("channels")}
                    className="py-3 px-4 cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                    title="Click to sort by channels"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Channels</span>
                      {sortField === "channels" ? (
                        sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-zinc-400 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("content")}
                    className="py-3 px-4 min-w-[280px] cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                    title="Click to sort by title & content"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Content & Title</span>
                      {sortField === "content" ? (
                        sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-zinc-400 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("media")}
                    className="py-3 px-4 cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                    title="Click to sort by media count"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Media</span>
                      {sortField === "media" ? (
                        sortDirection === "asc" ? (
                          <ChevronUp className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-zinc-400 opacity-60" />
                      )}
                    </div>
                  </th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {sortedPosts.map((post) => {
                  const isDeleting = deleteMutation.isPending && deleteMutation.variables?.postId === post.id;
                  const statusInfo = getStatusBadge(post.status);
                  return (
                    <tr
                      key={post.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.classes}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
                          <span className="capitalize">{statusInfo.label}</span>
                        </span>
                      </td>

                      {/* Scheduled Time */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {getRelativeTime(post.scheduledFor)}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {formatScheduleDate(post.scheduledFor)}
                        </div>
                      </td>

                      {/* Account */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {post.zernioAccountName}
                        </span>
                      </td>

                      {/* Platforms */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {post.platforms.map((pl, idx) => {
                            const badgeClasses = `inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${getPlatformBadgeColor(
                              pl.platform
                            )}`;
                            const label =
                              pl.platform === "linkedin_page"
                                ? "LI Page"
                                : pl.platform === "linkedin"
                                ? "LI Personal"
                                : pl.platform;

                            if (pl.platformPostUrl) {
                              return (
                                <a
                                  key={idx}
                                  href={pl.platformPostUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`${badgeClasses} hover:brightness-110 transition-all cursor-pointer`}
                                  title={`Open published post on ${label}`}
                                >
                                  {pl.platform === "linkedin_page" && (
                                    <Building2 className="w-2.5 h-2.5 shrink-0" />
                                  )}
                                  <span className="capitalize">{label}</span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-75" />
                                </a>
                              );
                            }

                            return (
                              <span key={idx} className={badgeClasses}>
                                {pl.platform === "linkedin_page" && (
                                  <Building2 className="w-2.5 h-2.5 shrink-0" />
                                )}
                                <span className="capitalize">{label}</span>
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* Title & Preview */}
                      <td className="py-3 px-4">
                        {post.title && (
                          <div className="font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-sm mb-0.5">
                            {post.title}
                          </div>
                        )}
                        <div className="text-zinc-600 dark:text-zinc-400 truncate max-w-md">
                          {post.content}
                        </div>
                      </td>

                      {/* Media */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {post.mediaItems.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                            {post.mediaItems[0].type === "video" ? (
                              <Video className="w-3.5 h-3.5 text-rose-500" />
                            ) : post.mediaItems[0].type === "document" ? (
                              <FileText className="w-3.5 h-3.5 text-sky-500" />
                            ) : (
                              <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                            )}
                            <span className="capitalize">
                              {post.mediaItems[0].type}
                              {post.mediaItems.length > 1 ? ` (+${post.mediaItems.length - 1})` : ""}
                            </span>
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() =>
                              copyToClipboard(
                                post.title ? `${post.title}\n\n${post.content}` : post.content,
                                post.id
                              )
                            }
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                            title="Copy Content"
                          >
                            {copiedId === post.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `Remove this post from ${post.zernioAccountName} queue?`
                                )
                              ) {
                                deleteMutation.mutate({
                                  postId: post.id,
                                  accountId: post.zernioAccountId,
                                });
                              }
                            }}
                            disabled={isDeleting}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-50"
                            title="Cancel queued post"
                          >
                            {isDeleting ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
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
    </div>
  );
}
