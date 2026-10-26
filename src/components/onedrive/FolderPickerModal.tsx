"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ArrowLeft,
  Check,
  X,
  Search,
  Loader2,
  HardDrive,
} from "lucide-react";

interface FolderItem {
  id: string;
  name: string;
  webUrl: string;
  childCount?: number;
}

interface PathCrumb {
  id: string;
  name: string;
}

interface FolderPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (folder: { id: string; name: string; path: string }) => Promise<void>;
  currentFolderId?: string;
}

export function FolderPickerModal({
  isOpen,
  onClose,
  onSelect,
  currentFolderId,
}: FolderPickerModalProps) {
  const [currentParentId, setCurrentParentId] = useState<string>("root");
  const [breadcrumbs, setBreadcrumbs] = useState<PathCrumb[]>([
    { id: "root", name: "My Files" },
  ]);
  const [selectedFolder, setSelectedFolder] = useState<FolderItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["onedrive-folders", currentParentId],
    queryFn: async () => {
      const url =
        currentParentId === "root"
          ? "/api/onedrive/folders"
          : `/api/onedrive/folders?parentId=${encodeURIComponent(currentParentId)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to list folders");
      }
      return res.json() as Promise<{ folders: FolderItem[] }>;
    },
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const folders = (data?.folders || []).filter((f) =>
    search ? f.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  const handleDrilldown = (folder: FolderItem) => {
    setCurrentParentId(folder.id);
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedFolder(folder);
    setSearch("");
  };

  const handleNavigateCrumb = (index: number) => {
    const target = breadcrumbs[index];
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setCurrentParentId(target.id);
    setSelectedFolder(null);
    setSearch("");
  };

  const handleConfirm = async () => {
    // If a folder is highlighted, select that folder; otherwise select current directory
    const targetFolder =
      selectedFolder ||
      (breadcrumbs.length > 1
        ? {
            id: breadcrumbs[breadcrumbs.length - 1].id,
            name: breadcrumbs[breadcrumbs.length - 1].name,
            webUrl: "",
          }
        : null);

    if (!targetFolder) return;

    setSaving(true);
    try {
      const fullPath = "/" + breadcrumbs.map((b) => b.name).join("/");
      await onSelect({
        id: targetFolder.id,
        name: targetFolder.name,
        path: fullPath,
      });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-indigo-400" />
              Select Parent Content Folder
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose the OneDrive folder containing individual content folders (with videos, slides, and markdown).
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Breadcrumb Navigation Bar */}
        <div className="flex items-center gap-1.5 px-5 py-3 bg-slate-950/60 border-b border-slate-800 text-xs overflow-x-auto whitespace-nowrap scrollbar-none">
          <HardDrive className="w-4 h-4 text-slate-400 shrink-0" />
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <div key={crumb.id} className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleNavigateCrumb(idx)}
                  className={`hover:text-indigo-300 transition-colors ${
                    isLast ? "font-semibold text-white" : "text-slate-400"
                  }`}
                >
                  {crumb.name}
                </button>
                {!isLast && (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Search Bar inside Folder */}
        <div className="px-5 py-3 border-b border-slate-800/80">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter folders in this directory..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Folder List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 min-h-[250px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span>Browsing OneDrive folders...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {(error as any)?.message || "Failed to load folders"}
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No subfolders found in this directory.
            </div>
          ) : (
            folders.map((folder) => {
              const isSelected = selectedFolder?.id === folder.id;
              const isCurrent = currentFolderId === folder.id;

              return (
                <div
                  key={folder.id}
                  onClick={() => setSelectedFolder(folder)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600/15 border-indigo-500/40 text-white"
                      : "bg-slate-900/60 border-transparent hover:border-slate-800 hover:bg-slate-800/40 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Folder
                      className={`w-5 h-5 shrink-0 ${
                        isSelected ? "text-indigo-400" : "text-slate-400"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{folder.name}</p>
                      {folder.childCount !== undefined && (
                        <p className="text-[10px] text-slate-400">
                          {folder.childCount} items
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCurrent && (
                      <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Current Parent
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDrilldown(folder);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors"
                    >
                      <span>Open</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 bg-slate-950/80 border-t border-slate-800">
          <div className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">
            {selectedFolder ? (
              <span className="text-slate-200">
                Selected: <strong className="text-white">{selectedFolder.name}</strong>
              </span>
            ) : (
              <span>Select a folder or click "Use Current Directory"</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || (!selectedFolder && breadcrumbs.length <= 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Select Folder</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
