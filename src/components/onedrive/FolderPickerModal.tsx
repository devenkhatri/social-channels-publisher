"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Folder,
  FolderOpen,
  ChevronRight,
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

  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl dark:shadow-black/70 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              Select Parent Content Folder
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Choose the OneDrive folder containing individual content folders (with videos, slides, and markdown).
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Breadcrumb Navigation Bar */}
        <div className="flex items-center gap-1.5 px-4 sm:px-5 py-3 bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-xs overflow-x-auto whitespace-nowrap scrollbar-none">
          <HardDrive className="w-4 h-4 text-zinc-400 shrink-0" />
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <div key={crumb.id} className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleNavigateCrumb(idx)}
                  className={`hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors py-1 px-1 rounded min-h-[32px] flex items-center ${
                    isLast ? "font-semibold text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {crumb.name}
                </button>
                {!isLast && (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Search Bar inside Folder */}
        <div className="px-4 sm:px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter folders in this directory..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 min-h-[38px]"
            />
          </div>
        </div>

        {/* Folder List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1 min-h-[250px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-500 dark:text-zinc-400 text-xs gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-800 dark:text-zinc-200" />
              <span>Browsing OneDrive folders...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
              {(error as any)?.message || "Failed to load folders"}
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 text-xs">
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
                      ? "bg-zinc-100 dark:bg-zinc-800/80 border-zinc-400 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 shadow-xs"
                      : "bg-white dark:bg-zinc-900/60 border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Folder
                      className={`w-5 h-5 shrink-0 ${
                        isSelected ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{folder.name}</p>
                      {folder.childCount !== undefined && (
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          {folder.childCount} items
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCurrent && (
                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Current Parent
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDrilldown(folder);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1 transition-colors min-h-[34px] cursor-pointer"
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
        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/80 border-t border-zinc-200 dark:border-zinc-800">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-xs sm:max-w-md">
            {selectedFolder ? (
              <span className="text-zinc-700 dark:text-zinc-300">
                Selected: <strong className="text-zinc-900 dark:text-zinc-100">{selectedFolder.name}</strong>
              </span>
            ) : (
              <span>Select a folder or click "Use Current Directory"</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors min-h-[38px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || (!selectedFolder && breadcrumbs.length <= 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[38px] cursor-pointer"
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
