"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
  CalendarDays,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  FileText,
  Video,
  Image as ImageIcon,
  Share2,
  X,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Building2,
} from "lucide-react";

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

export interface QueuedPostItem {
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

interface QueuesCalendarViewProps {
  posts: QueuedPostItem[];
  onDeletePost: (post: { postId: string; accountId: string; title: string }) => void;
  isDeleting: boolean;
  deletingPostId?: string;
  getStatusBadge: (status: string) => {
    label: string;
    classes: string;
    dotColor: string;
  };
  getPlatformBadgeColor: (platform: string) => string;
}

export interface ChannelMeta {
  name: string;
  short: string;
  brandColor: string;
  borderLeft: string;
  borderClass: string;
  badgeBg: string;
  badgeText: string;
  dotBg: string;
  cardBg: string;
  cardBorder: string;
  pillBg: string;
  accentText: string;
}

export function getChannelMeta(platformName: string): ChannelMeta {
  const p = (platformName || "unknown").toLowerCase();

  if (p === "linkedin") {
    return {
      name: "LinkedIn Personal",
      short: "LI Personal",
      brandColor: "#0A66C2",
      borderLeft: "border-l-[#0A66C2]",
      borderClass: "border-[#0A66C2]",
      badgeBg: "bg-[#0A66C2]",
      badgeText: "text-white",
      dotBg: "bg-[#0A66C2]",
      cardBg: "bg-sky-500/[0.04] dark:bg-sky-500/[0.08]",
      cardBorder: "border-sky-500/25 dark:border-sky-500/35",
      pillBg: "bg-[#0A66C2]/10 text-[#0A66C2] dark:text-sky-300 border-[#0A66C2]/25",
      accentText: "text-[#0A66C2] dark:text-sky-300",
    };
  }

  if (p === "linkedin_page") {
    return {
      name: "LinkedIn Business Page",
      short: "LI Page",
      brandColor: "#4338CA",
      borderLeft: "border-l-indigo-600 dark:border-l-indigo-500",
      borderClass: "border-indigo-600 dark:border-indigo-500",
      badgeBg: "bg-indigo-700 dark:bg-indigo-600",
      badgeText: "text-white",
      dotBg: "bg-indigo-600 dark:bg-indigo-400",
      cardBg: "bg-indigo-500/[0.05] dark:bg-indigo-500/[0.10]",
      cardBorder: "border-indigo-500/25 dark:border-indigo-500/35",
      pillBg: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25",
      accentText: "text-indigo-600 dark:text-indigo-400",
    };
  }

  if (p === "youtube") {
    return {
      name: "YouTube",
      short: "YouTube",
      brandColor: "#FF0000",
      borderLeft: "border-l-[#FF0000]",
      borderClass: "border-[#FF0000]",
      badgeBg: "bg-[#FF0000]",
      badgeText: "text-white",
      dotBg: "bg-[#FF0000]",
      cardBg: "bg-red-500/[0.04] dark:bg-red-500/[0.08]",
      cardBorder: "border-red-500/25 dark:border-red-500/35",
      pillBg: "bg-[#FF0000]/10 text-red-600 dark:text-red-300 border-[#FF0000]/25",
      accentText: "text-red-600 dark:text-red-300",
    };
  }

  if (p === "instagram") {
    return {
      name: "Instagram",
      short: "Instagram",
      brandColor: "#E1306C",
      borderLeft: "border-l-[#E1306C]",
      borderClass: "border-[#E1306C]",
      badgeBg: "bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737]",
      badgeText: "text-white",
      dotBg: "bg-[#E1306C]",
      cardBg: "bg-pink-500/[0.04] dark:bg-pink-500/[0.08]",
      cardBorder: "border-pink-500/25 dark:border-pink-500/35",
      pillBg: "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/25",
      accentText: "text-pink-600 dark:text-pink-300",
    };
  }

  if (p === "facebook") {
    return {
      name: "Facebook",
      short: "Facebook",
      brandColor: "#1877F2",
      borderLeft: "border-l-[#1877F2]",
      borderClass: "border-[#1877F2]",
      badgeBg: "bg-[#1877F2]",
      badgeText: "text-white",
      dotBg: "bg-[#1877F2]",
      cardBg: "bg-blue-500/[0.04] dark:bg-blue-500/[0.08]",
      cardBorder: "border-blue-500/25 dark:border-blue-500/35",
      pillBg: "bg-blue-600/10 text-blue-700 dark:text-blue-300 border-blue-600/25",
      accentText: "text-blue-600 dark:text-blue-300",
    };
  }

  if (p === "twitter" || p === "x") {
    return {
      name: "X (Twitter)",
      short: "X",
      brandColor: "#000000",
      borderLeft: "border-l-zinc-900 dark:border-l-zinc-100",
      borderClass: "border-zinc-900 dark:border-zinc-100",
      badgeBg: "bg-zinc-900 dark:bg-zinc-100",
      badgeText: "text-white dark:text-zinc-900",
      dotBg: "bg-zinc-900 dark:bg-zinc-100",
      cardBg: "bg-zinc-100/60 dark:bg-zinc-800/40",
      cardBorder: "border-zinc-300 dark:border-zinc-700",
      pillBg: "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700",
      accentText: "text-zinc-900 dark:text-zinc-100",
    };
  }

  if (p === "threads") {
    return {
      name: "Threads",
      short: "Threads",
      brandColor: "#101010",
      borderLeft: "border-l-zinc-800 dark:border-l-zinc-200",
      borderClass: "border-zinc-800 dark:border-zinc-200",
      badgeBg: "bg-zinc-800 dark:bg-zinc-200",
      badgeText: "text-white dark:text-zinc-900",
      dotBg: "bg-zinc-800 dark:bg-zinc-200",
      cardBg: "bg-zinc-100/60 dark:bg-zinc-800/40",
      cardBorder: "border-zinc-300 dark:border-zinc-700",
      pillBg: "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700",
      accentText: "text-zinc-800 dark:text-zinc-200",
    };
  }

  if (p === "skool") {
    return {
      name: "Skool",
      short: "Skool",
      brandColor: "#F59E0B",
      borderLeft: "border-l-amber-500",
      borderClass: "border-amber-500",
      badgeBg: "bg-amber-500",
      badgeText: "text-white",
      dotBg: "bg-amber-500",
      cardBg: "bg-amber-500/[0.04] dark:bg-amber-500/[0.08]",
      cardBorder: "border-amber-500/25 dark:border-amber-500/35",
      pillBg: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
      accentText: "text-amber-600 dark:text-amber-300",
    };
  }

  return {
    name: platformName,
    short: platformName,
    brandColor: "#71717A",
    borderLeft: "border-l-zinc-400 dark:border-l-zinc-600",
    borderClass: "border-zinc-400",
    badgeBg: "bg-zinc-600",
    badgeText: "text-white",
    dotBg: "bg-zinc-400",
    cardBg: "bg-zinc-50 dark:bg-zinc-900",
    cardBorder: "border-zinc-200 dark:border-zinc-800",
    pillBg: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
    accentText: "text-zinc-700 dark:text-zinc-300",
  };
}

export function ChannelBrandIcon({ platform, className = "w-3 h-3" }: { platform: string; className?: string }) {
  const p = (platform || "").toLowerCase();

  if (p === "linkedin_page") {
    return (
      <span className="inline-flex items-center gap-0.5 shrink-0" title="LinkedIn Business Page">
        <svg className={`${className} fill-current`} viewBox="0 0 24 24">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.2a1.62 1.62 0 1 0 1.62 1.62A1.62 1.62 0 0 0 7.83 6.2Z" />
        </svg>
        <Building2 className="w-2.5 h-2.5 opacity-90 shrink-0" />
      </span>
    );
  }

  if (p === "linkedin") {
    return (
      <svg className={`${className} fill-current`} viewBox="0 0 24 24" aria-label="LinkedIn Personal">
        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.2a1.62 1.62 0 1 0 1.62 1.62A1.62 1.62 0 0 0 7.83 6.2Z" />
      </svg>
    );
  }

  if (p === "youtube") {
    return (
      <svg className={`${className} fill-current`} viewBox="0 0 24 24">
        <path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42A2.5 2.5 0 0 0 2.42 7.19C2 8.76 2 12 2 12s0 3.24.42 4.81a2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77C22 15.24 22 12 22 12s0-3.24-.42-4.81zM10 15V9l5.2 3-5.2 3z" />
      </svg>
    );
  }

  if (p === "instagram") {
    return (
      <svg className={`${className} fill-current`} viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
      </svg>
    );
  }

  if (p === "facebook") {
    return (
      <svg className={`${className} fill-current`} viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  }

  if (p === "twitter" || p === "x") {
    return (
      <svg className={`${className} fill-current`} viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }

  if (p === "threads") {
    return <span className="font-bold text-[10px] leading-none">@</span>;
  }

  if (p === "skool") {
    return <span className="font-bold text-[9px] leading-none">SK</span>;
  }

  return <Share2 className={className} />;
}

export function QueuesCalendarView({
  posts,
  onDeletePost,
  isDeleting,
  deletingPostId,
  getStatusBadge,
  getPlatformBadgeColor,
}: QueuesCalendarViewProps) {
  const today = useMemo(() => new Date(), []);
  const agendaRef = useRef<HTMLDivElement>(null);

  const [currentDate, setCurrentDate] = useState(() => {
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [inspectingPost, setInspectingPost] = useState<QueuedPostItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Close Post Details modal on Escape key press
  useEffect(() => {
    if (!inspectingPost) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInspectingPost(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inspectingPost]);

  const viewYear = currentDate.getFullYear();
  const viewMonth = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    setSelectedDateKey(`${y}-${m}-${d}`);
  };

  const toDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Group posts by YYYY-MM-DD
  const { postsByDate, unscheduledPosts } = useMemo(() => {
    const map = new Map<string, QueuedPostItem[]>();
    const unscheduled: QueuedPostItem[] = [];

    posts.forEach((post) => {
      if (!post.scheduledFor) {
        unscheduled.push(post);
        return;
      }
      const d = new Date(post.scheduledFor);
      if (isNaN(d.getTime())) {
        unscheduled.push(post);
        return;
      }
      const key = toDateKey(d);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(post);
    });

    // Sort posts within each day chronologically
    map.forEach((dayPosts) => {
      dayPosts.sort((a, b) => {
        const timeA = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
        const timeB = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
        return timeA - timeB;
      });
    });

    return { postsByDate: map, unscheduledPosts: unscheduled };
  }, [posts]);

  // Calendar cells generation with day channels
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const totalDaysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: Array<{
      date: Date;
      dateKey: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      posts: QueuedPostItem[];
      distinctChannels: string[];
    }> = [];

    const todayKey = toDateKey(today);

    const buildCell = (d: Date, dayNum: number, isCurrMonth: boolean) => {
      const key = toDateKey(d);
      const dayPosts = postsByDate.get(key) || [];
      const channelsSet = new Set<string>();
      dayPosts.forEach((p) => {
        p.platforms.forEach((pl) => {
          if (pl.platform) channelsSet.add(pl.platform.toLowerCase());
        });
      });

      return {
        date: d,
        dateKey: key,
        dayNumber: dayNum,
        isCurrentMonth: isCurrMonth,
        isToday: key === todayKey,
        isSelected: key === selectedDateKey,
        posts: dayPosts,
        distinctChannels: Array.from(channelsSet),
      };
    };

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = totalDaysInPrevMonth - i;
      const d = new Date(viewYear, viewMonth - 1, dayNum);
      cells.push(buildCell(d, dayNum, false));
    }

    // Current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const d = new Date(viewYear, viewMonth, i);
      cells.push(buildCell(d, i, true));
    }

    // Next month padding
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(viewYear, viewMonth + 1, i);
      cells.push(buildCell(d, i, false));
    }

    return cells;
  }, [viewYear, viewMonth, today, selectedDateKey, postsByDate]);

  // Current month total queued posts
  const currentMonthPostsCount = useMemo(() => {
    let count = 0;
    posts.forEach((p) => {
      if (!p.scheduledFor) return;
      const d = new Date(p.scheduledFor);
      if (!isNaN(d.getTime()) && d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
        count++;
      }
    });
    return count;
  }, [posts, viewYear, viewMonth]);

  // Selected day's posts
  const selectedDayPosts = useMemo(() => {
    const raw = postsByDate.get(selectedDateKey) || [];
    if (channelFilter === "all") return raw;
    return raw.filter((p) =>
      p.platforms.some((pl) => pl.platform.toLowerCase() === channelFilter.toLowerCase())
    );
  }, [postsByDate, selectedDateKey, channelFilter]);

  // Distinct channels present on the selected date
  const selectedDayChannels = useMemo(() => {
    const raw = postsByDate.get(selectedDateKey) || [];
    const set = new Set<string>();
    raw.forEach((p) => {
      p.platforms.forEach((pl) => {
        if (pl.platform) set.add(pl.platform.toLowerCase());
      });
    });
    return Array.from(set);
  }, [postsByDate, selectedDateKey]);

  const handleSelectDate = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setChannelFilter("all");
    // Scroll to agenda on mobile for quick visibility
    if (window.innerWidth < 768 && agendaRef.current) {
      setTimeout(() => {
        agendaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
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

  // Distinct channels present across the whole month for the legend
  const monthChannels = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => {
      if (!p.scheduledFor) return;
      const d = new Date(p.scheduledFor);
      if (!isNaN(d.getTime()) && d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
        p.platforms.forEach((pl) => {
          if (pl.platform) set.add(pl.platform.toLowerCase());
        });
      }
    });
    return Array.from(set);
  }, [posts, viewYear, viewMonth]);

  return (
    <div className="space-y-6">
      {/* Calendar Header & Month Navigation */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-800 dark:text-zinc-200 shadow-xs">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {monthNames[viewMonth]} {viewYear}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold">
                  {currentMonthPostsCount} post{currentMonthPostsCount === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Channel-coded schedule calendar • Click any day to view channel-specific queued posts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={handleToday}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold border border-zinc-200 dark:border-zinc-700 transition-colors min-h-[36px] cursor-pointer"
            >
              Today
            </button>
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
              <button
                onClick={handlePrevMonth}
                title="Previous Month"
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300 transition-all min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextMonth}
                title="Next Month"
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300 transition-all min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Channel Indicator Legend Bar */}
        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mr-1">
            Channel Indicators:
          </span>
          {["linkedin", "twitter", "youtube", "instagram", "facebook", "threads", "skool"].map((chan) => {
            const meta = getChannelMeta(chan);
            const isPresent = monthChannels.includes(chan);

            return (
              <span
                key={chan}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-opacity ${
                  meta.pillBg
                } ${isPresent ? "opacity-100 font-bold" : "opacity-45"}`}
                title={isPresent ? `${meta.name} (active this month)` : `${meta.name} (no posts this month)`}
              >
                <span className={`w-2 h-2 rounded-full ${meta.dotBg}`} />
                <ChannelBrandIcon platform={chan} className="w-2.5 h-2.5" />
                <span>{meta.short}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Main Calendar Grid */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 text-center text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 py-2.5">
          {daysOfWeek.map((day, idx) => (
            <div
              key={day}
              className={idx === 0 || idx === 6 ? "text-zinc-400 dark:text-zinc-500" : ""}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Day Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-zinc-200 dark:divide-zinc-800/80">
          {calendarCells.map((cell) => {
            const hasPosts = cell.posts.length > 0;

            return (
              <div
                key={cell.dateKey}
                onClick={() => handleSelectDate(cell.dateKey)}
                role="button"
                tabIndex={0}
                className={`min-h-[85px] sm:min-h-[125px] p-1.5 sm:p-2 transition-all flex flex-col justify-between cursor-pointer relative select-none group ${
                  !cell.isCurrentMonth
                    ? "bg-zinc-50/40 dark:bg-zinc-950/20 text-zinc-300 dark:text-zinc-600"
                    : "bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                } ${
                  cell.isSelected
                    ? "ring-2 ring-zinc-900 dark:ring-zinc-100 z-10 bg-zinc-50/90 dark:bg-zinc-800/60 shadow-xs"
                    : ""
                }`}
              >
                {/* Cell Header: Date Number & Badge & Distinct Channel Dots */}
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                        cell.isToday
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                          : cell.isSelected
                          ? "font-bold text-zinc-950 dark:text-white"
                          : ""
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {hasPosts && (
                      <span className="px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold border border-zinc-200 dark:border-zinc-700 shrink-0">
                        {cell.posts.length}
                      </span>
                    )}
                  </div>

                  {/* Channel Indicator Row directly beneath Day Number (shows all distinct channels on this day) */}
                  {cell.distinctChannels.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {cell.distinctChannels.map((chan) => {
                        const meta = getChannelMeta(chan);
                        return (
                          <span
                            key={chan}
                            className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold border ${meta.pillBg}`}
                            title={`Queued on ${meta.name}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dotBg}`} />
                            <ChannelBrandIcon platform={chan} className="w-2.5 h-2.5" />
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Desktop Post Chips with Channel-Based Color Coding */}
                <div className="hidden sm:flex flex-col gap-1 mt-1 flex-1 min-h-0 justify-end">
                  {cell.posts.slice(0, 2).map((post) => {
                    const primaryPlatform = post.platforms[0]?.platform || "unknown";
                    const channelMeta = getChannelMeta(primaryPlatform);

                    const postTime = post.scheduledFor
                      ? new Date(post.scheduledFor).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : "";

                    return (
                      <div
                        key={post.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDateKey(cell.dateKey);
                          setInspectingPost(post);
                        }}
                        className={`px-1.5 py-1 rounded-md text-[10px] border-l-[3px] border border-zinc-200 dark:border-zinc-800 ${channelMeta.borderLeft} ${channelMeta.cardBg} hover:brightness-95 dark:hover:brightness-110 leading-tight truncate transition-all shadow-2xs font-medium cursor-pointer`}
                        title={`[${channelMeta.name}] ${postTime ? postTime + " - " : ""}${post.title || post.content}`}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          {/* Channel Badge */}
                          <span
                            className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-xs ${channelMeta.badgeBg} ${channelMeta.badgeText} shrink-0`}
                          >
                            <ChannelBrandIcon platform={primaryPlatform} className="w-2.5 h-2.5" />
                          </span>

                          {postTime && (
                            <span className="font-mono text-[9px] text-zinc-500 dark:text-zinc-400 shrink-0 font-semibold">
                              {postTime}
                            </span>
                          )}

                          <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                            {post.title || post.content || "Scheduled Post"}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {cell.posts.length > 2 && (
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold pl-1">
                      +{cell.posts.length - 2} more item{cell.posts.length - 2 > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Mobile Channel-coded Dots Indicator Bar */}
                <div className="flex sm:hidden items-center gap-1 mt-1 justify-center flex-wrap">
                  {cell.posts.slice(0, 4).map((p, idx) => {
                    const plat = p.platforms[0]?.platform || "unknown";
                    const meta = getChannelMeta(plat);
                    return (
                      <span
                        key={idx}
                        className={`w-2 h-2 rounded-full ${meta.dotBg} ring-1 ring-white dark:ring-zinc-900`}
                        title={meta.name}
                      />
                    );
                  })}
                  {cell.posts.length > 4 && (
                    <span className="text-[9px] text-zinc-400 font-bold leading-none">
                      +{cell.posts.length - 4}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day: Channel-based Color Coded Queued Items List */}
      <div
        ref={agendaRef}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-5"
      >
        {/* Agenda Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Queued Items for{" "}
                {new Date(selectedDateKey + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </h3>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {selectedDayPosts.length === 0
                ? "No posts scheduled for this day"
                : `Showing ${selectedDayPosts.length} queued item${selectedDayPosts.length === 1 ? "" : "s"} with channel-based color coding`}
            </p>
          </div>

          {/* Day Channel Filter Pills (if multiple channels present on that day) */}
          {selectedDayChannels.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mr-1">
                Filter Channel:
              </span>
              <button
                onClick={() => setChannelFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  channelFilter === "all"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                All Channels
              </button>
              {selectedDayChannels.map((chan) => {
                const meta = getChannelMeta(chan);
                const isSelected = channelFilter === chan;

                return (
                  <button
                    key={chan}
                    onClick={() => setChannelFilter(chan)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      isSelected
                        ? `${meta.badgeBg} ${meta.badgeText} ${meta.borderClass} shadow-2xs`
                        : `${meta.pillBg} hover:opacity-100`
                    }`}
                  >
                    <ChannelBrandIcon platform={chan} className="w-3 h-3" />
                    <span>{meta.short}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Empty State */}
        {selectedDayPosts.length === 0 ? (
          <div className="p-10 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">No queued items found on this date</p>
            <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
              Select another day on the calendar above to inspect its scheduled posts and channel targets.
            </p>
          </div>
        ) : (
          /* Channel-Based Color Coded List of Queued Items */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedDayPosts.map((post) => {
              const primaryPlatform = post.platforms[0]?.platform || "unknown";
              const primaryMeta = getChannelMeta(primaryPlatform);
              const statusInfo = getStatusBadge(post.status);
              const isDeletingThis = isDeleting && deletingPostId === post.id;

              const postTime = post.scheduledFor
                ? new Date(post.scheduledFor).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Unscheduled";

              return (
                <div
                  key={post.id}
                  className={`rounded-2xl border-l-[5px] border ${primaryMeta.borderLeft} ${primaryMeta.cardBorder} ${primaryMeta.cardBg} p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4`}
                >
                  {/* Card Header: Channel Brand Banner, Scheduled Time & Status */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-2.5 border-b border-zinc-200/60 dark:border-zinc-800/60">
                      {/* Target Channel Brand Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {post.platforms.map((pl, idx) => {
                          const plMeta = getChannelMeta(pl.platform);
                          if (pl.platformPostUrl) {
                            return (
                              <a
                                key={idx}
                                href={pl.platformPostUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold shadow-2xs hover:brightness-110 hover:shadow-xs transition-all cursor-pointer ${plMeta.badgeBg} ${plMeta.badgeText}`}
                                title={`Open live post on ${plMeta.name}`}
                              >
                                <ChannelBrandIcon platform={pl.platform} className="w-3.5 h-3.5" />
                                <span>{plMeta.name}</span>
                                <ExternalLink className="w-3 h-3 opacity-75 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                              </a>
                            );
                          }
                          return (
                            <span
                              key={idx}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold shadow-2xs ${plMeta.badgeBg} ${plMeta.badgeText}`}
                            >
                              <ChannelBrandIcon platform={pl.platform} className="w-3.5 h-3.5" />
                              <span>{plMeta.name}</span>
                            </span>
                          );
                        })}
                      </div>

                      {/* Scheduled Time Pill */}
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold font-mono text-zinc-900 dark:text-zinc-100 shadow-2xs">
                          <Clock className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{postTime}</span>
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.classes}`}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Account Info */}
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span className="font-medium">
                        Account: <strong className="text-zinc-800 dark:text-zinc-200 font-semibold">{post.zernioAccountName}</strong>
                      </span>
                      {post.profileName && (
                        <span>
                          Profile: <strong className="text-zinc-800 dark:text-zinc-200 font-semibold">{post.profileName}</strong>
                        </span>
                      )}
                    </div>

                    {/* Post Title */}
                    {post.title && (
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                        {post.title}
                      </h4>
                    )}

                    {/* Post Content Preview */}
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                      {post.content || "No post body text"}
                    </p>

                    {/* Media attachments */}
                    {post.mediaItems?.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {post.mediaItems.slice(0, 3).map((m, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                          >
                            {m.type === "video" ? (
                              <Video className="w-3 h-3 text-zinc-500" />
                            ) : (
                              <ImageIcon className="w-3 h-3 text-zinc-500" />
                            )}
                            <span className="truncate max-w-[120px]">{m.url.split("/").pop() || "media"}</span>
                          </span>
                        ))}
                        {post.mediaItems.length > 3 && (
                          <span className="text-[10px] text-zinc-500 font-semibold">
                            +{post.mediaItems.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60">
                    <button
                      onClick={() => setInspectingPost(post)}
                      className={`text-xs font-bold hover:underline flex items-center gap-1 cursor-pointer ${primaryMeta.accentText}`}
                    >
                      <span>Full Post Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyToClipboard(post.content, post.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
                        title="Copy post content"
                      >
                        {copiedId === post.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() =>
                          onDeletePost({
                            postId: post.id,
                            accountId: post.zernioAccountId,
                            title: post.title || post.content || "this queued post",
                          })
                        }
                        disabled={isDeletingThis}
                        className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-50"
                        title="Cancel queued post"
                      >
                        {isDeletingThis ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unscheduled Posts Section (if any) */}
      {unscheduledPosts.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              <span>Unscheduled Queue Items ({unscheduledPosts.length})</span>
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {unscheduledPosts.map((post) => {
              const primaryMeta = getChannelMeta(post.platforms[0]?.platform || "unknown");

              return (
                <div
                  key={post.id}
                  onClick={() => setInspectingPost(post)}
                  className={`p-3.5 rounded-xl border-l-4 border ${primaryMeta.borderLeft} ${primaryMeta.cardBorder} ${primaryMeta.cardBg} hover:brightness-95 dark:hover:brightness-110 cursor-pointer transition-all space-y-1.5`}
                >
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {post.title || "Untitled Post"}
                    </span>
                    <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
                      No date
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                    {post.content}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Post Detail Modal */}
      {inspectingPost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setInspectingPost(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">
                  {inspectingPost.status === "published" ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Published Post Details
                    </span>
                  ) : (
                    <span className="text-zinc-500">Queued Post Details</span>
                  )}
                </span>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {inspectingPost.title || "Scheduled Post"}
                </h3>
              </div>
              <button
                onClick={() => setInspectingPost(null)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Published Post Direct Action Banner */}
            {inspectingPost.platforms.some((pl) => Boolean(pl.platformPostUrl)) && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Live on Social Channel</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {inspectingPost.platforms
                    .filter((pl) => Boolean(pl.platformPostUrl))
                    .map((pl, idx) => {
                      const meta = getChannelMeta(pl.platform);
                      return (
                        <a
                          key={idx}
                          href={pl.platformPostUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors cursor-pointer"
                        >
                          <ChannelBrandIcon platform={pl.platform} className="w-3 h-3" />
                          <span>View on {meta.short}</span>
                          <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                        </a>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Scheduled Time & Status */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
              {inspectingPost.publishedAt ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Published Date:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {new Date(inspectingPost.publishedAt).toLocaleString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Scheduled Date:</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                    {inspectingPost.scheduledFor
                      ? new Date(inspectingPost.scheduledFor).toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Unscheduled"}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Target Account:</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {inspectingPost.zernioAccountName}
                </span>
              </div>
              {inspectingPost.profileName && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Profile:</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {inspectingPost.profileName}
                  </span>
                </div>
              )}
            </div>

            {/* Target Channels */}
            <div>
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-2">
                Target Channels ({inspectingPost.platforms.length})
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {inspectingPost.platforms.map((pl, idx) => {
                  const meta = getChannelMeta(pl.platform);
                  if (pl.platformPostUrl) {
                    return (
                      <a
                        key={idx}
                        href={pl.platformPostUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`group text-xs font-bold px-3 py-1.5 rounded-lg shadow-2xs flex items-center gap-1.5 transition-all hover:brightness-110 hover:shadow-md cursor-pointer ${meta.badgeBg} ${meta.badgeText}`}
                        title={`Open live post on ${meta.name}`}
                      >
                        <ChannelBrandIcon platform={pl.platform} className="w-3.5 h-3.5" />
                        <span>{meta.name}</span>
                        {pl.username && (
                          <span className="text-[10px] opacity-80 font-mono font-normal">
                            (@{pl.username})
                          </span>
                        )}
                        <ExternalLink className="w-3.5 h-3.5 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </a>
                    );
                  }
                  return (
                    <span
                      key={idx}
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1.5 ${meta.badgeBg} ${meta.badgeText}`}
                    >
                      <ChannelBrandIcon platform={pl.platform} className="w-3.5 h-3.5" />
                      <span>{meta.name}</span>
                      {pl.username && (
                        <span className="text-[10px] opacity-80 font-mono font-normal">
                          (@{pl.username})
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Post Content */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Post Content
                </label>
                <button
                  onClick={() => copyToClipboard(inspectingPost.content, "modal")}
                  className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1 cursor-pointer"
                >
                  {copiedId === "modal" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600 font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto font-sans">
                {inspectingPost.content}
              </div>
            </div>

            {/* Media Items */}
            {inspectingPost.mediaItems?.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-2">
                  Attached Media ({inspectingPost.mediaItems.length})
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {inspectingPost.mediaItems.map((media, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs flex items-center gap-2"
                    >
                      {media.type === "video" ? (
                        <Video className="w-4 h-4 text-zinc-500 shrink-0" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-zinc-500 shrink-0" />
                      )}
                      <span className="truncate text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                        {media.url.split("/").pop() || "media item"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => {
                  onDeletePost({
                    postId: inspectingPost.id,
                    accountId: inspectingPost.zernioAccountId,
                    title: inspectingPost.title || inspectingPost.content || "this post",
                  });
                  setInspectingPost(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove from Queue</span>
              </button>

              <button
                onClick={() => setInspectingPost(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
