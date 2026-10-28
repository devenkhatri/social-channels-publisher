"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal, Filter, X } from "lucide-react";

interface CollapsibleFilterSectionProps {
  title?: string;
  activeFiltersCount?: number;
  activeFiltersSummary?: React.ReactNode;
  onClearFilters?: () => void;
  children: React.ReactNode;
  defaultOpenMobile?: boolean;
  className?: string;
}

export function CollapsibleFilterSection({
  title = "Filters & Sorting",
  activeFiltersCount = 0,
  activeFiltersSummary,
  onClearFilters,
  children,
  defaultOpenMobile = false,
  className = "",
}: CollapsibleFilterSectionProps) {
  const [isOpenMobile, setIsOpenMobile] = useState(defaultOpenMobile);

  return (
    <div className={`w-full ${className}`}>
      {/* Mobile Toggle Trigger */}
      <div className="sm:hidden mb-2">
        <button
          type="button"
          onClick={() => setIsOpenMobile((prev) => !prev)}
          aria-expanded={isOpenMobile}
          className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left ${
            activeFiltersCount > 0
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-sm"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                activeFiltersCount > 0
                  ? "bg-white/20 dark:bg-zinc-900/20 text-white dark:text-zinc-900"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold truncate">
                  {title}
                </span>
                {activeFiltersCount > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeFiltersCount > 0
                        ? "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white"
                        : "bg-zinc-200 text-zinc-800"
                    }`}
                  >
                    {activeFiltersCount} active
                  </span>
                )}
              </div>
              {activeFiltersSummary && (
                <div
                  className={`text-[11px] truncate mt-0.5 ${
                    activeFiltersCount > 0
                      ? "text-zinc-300 dark:text-zinc-600"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {activeFiltersSummary}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onClearFilters && activeFiltersCount > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onClearFilters();
                }}
                className="text-[11px] underline opacity-90 hover:opacity-100 px-1 py-0.5"
              >
                Reset
              </span>
            )}
            <div className="flex items-center gap-1 opacity-80 text-xs">
              <span className="text-[11px] font-medium">
                {isOpenMobile ? "Hide" : "Show"}
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  isOpenMobile ? "rotate-180" : ""
                }`}
              />
            </div>
          </div>
        </button>
      </div>

      {/* Filter controls content */}
      <div
        className={`${
          isOpenMobile
            ? "block p-3 sm:p-0 rounded-2xl sm:rounded-none bg-zinc-50/80 sm:bg-transparent dark:bg-zinc-900/60 sm:dark:bg-transparent border border-zinc-200 sm:border-0 dark:border-zinc-800 animate-in fade-in duration-150"
            : "hidden sm:block"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
