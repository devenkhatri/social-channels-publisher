"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
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
  const [filter, setFilter] = useState<"unpublished" | "published" | "all">(
    "unpublished"
  );
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "title">(
    "newest"
  );

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

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Content Dashboard
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
              OneDrive Source
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Publish social content extracted from your OneDrive folders across 5 channels.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/settings/onedrive"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
          >
            <Cloud className="w-3.5 h-3.5 text-indigo-400" />
            <span>Folder Config</span>
          </Link>
        </div>
      </div>

      {/* Analytics KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Unpublished Card */}
        <div
          onClick={() => setFilter("unpublished")}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            filter === "unpublished"
              ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-400 font-medium">
            <span>Pending Publish</span>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white mt-2">
            {counts.unpublished}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Folders without <code className="text-slate-300">-Done</code>
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
            <span>Published</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white mt-2">
            {counts.published}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Tagged with <code className="text-slate-300">-Done</code>
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
            <span>Total Folders</span>
            <Folder className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white mt-2">
            {counts.total}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Synced from OneDrive</p>
        </div>

        {/* Channels Card */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-blue-400 font-medium">
            <span>Target Channels</span>
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
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === "unpublished"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Unpublished ({counts.unpublished})
          </button>
          <button
            onClick={() => setFilter("published")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === "published"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Published -Done ({counts.published})
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
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
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search content..."
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
              ? "Connect your Microsoft OneDrive account in Settings to select your content parent folder and start extracting social posts."
              : "Try switching between the Unpublished and Published tabs or adjust your search filter."}
          </p>

          {counts.total === 0 ? (
            <Link
              href="/settings/onedrive"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-lg shadow-indigo-600/25 transition-all"
            >
              <Cloud className="w-4 h-4" />
              <span>Connect Microsoft OneDrive</span>
            </Link>
          ) : (
            <button
              onClick={() => {
                setFilter("all");
                setSearch("");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg shadow-black/20 flex flex-col justify-between transition-all"
            >
              <div>
                {/* Header: Folder name & Done badge */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
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
                <h4 className="text-sm font-semibold text-white line-clamp-1 group-hover:text-indigo-300 transition-colors">
                  {item.title || "Untitled Post"}
                </h4>

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
              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold" title="LinkedIn">
                    LI
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-semibold" title="YouTube">
                    YT
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-semibold" title="Instagram">
                    IG
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-600/10 text-blue-300 font-semibold" title="Facebook">
                    FB
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold" title="Skool">
                    SK
                  </span>
                </div>

                <Link
                  href={`/content/${item.id}`}
                  className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <span>Open Editor</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
