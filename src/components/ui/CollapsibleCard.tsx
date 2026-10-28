"use client";

import { useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

interface CollapsibleCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  defaultOpenMobile?: boolean;
  defaultOpenDesktop?: boolean;
  className?: string;
  contentClassName?: string;
}

export function CollapsibleCard({
  title,
  subtitle,
  icon: Icon,
  badge,
  headerActions,
  children,
  defaultOpenMobile = false,
  defaultOpenDesktop = true,
  className = "",
  contentClassName = "p-5 sm:p-6 space-y-6",
}: CollapsibleCardProps) {
  const [isOpenMobile, setIsOpenMobile] = useState(defaultOpenMobile);
  const [isOpenDesktop, setIsOpenDesktop] = useState(defaultOpenDesktop);

  return (
    <div
      className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm dark:shadow-xl transition-all overflow-hidden ${className}`}
    >
      {/* Card Header (clickable on mobile to toggle, with desktop toggle option) */}
      <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsOpenMobile((prev) => !prev)}
          className="flex items-start sm:items-center gap-3 cursor-pointer sm:cursor-default flex-1 min-w-0"
        >
          {Icon && (
            <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 mt-0.5 sm:mt-0 shrink-0">
              <Icon className="w-5 h-5" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>{title}</span>
              </h2>
              {badge}
            </div>
            {subtitle && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {subtitle}
              </div>
            )}
          </div>

          {/* Mobile Chevron */}
          <div className="sm:hidden flex items-center gap-1 text-zinc-400 shrink-0 pt-0.5">
            <span className="text-[11px] font-medium text-zinc-500">
              {isOpenMobile ? "Hide" : "Show"}
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isOpenMobile ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>

        {/* Header Actions & Desktop Collapse Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          {headerActions}

          {/* Desktop Toggle Button */}
          <button
            type="button"
            onClick={() => setIsOpenDesktop((prev) => !prev)}
            aria-expanded={isOpenDesktop}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <span>{isOpenDesktop ? "Collapse" : "Expand"}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isOpenDesktop ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div
        className={`${isOpenMobile ? "block" : "hidden"} ${
          isOpenDesktop ? "sm:block" : "sm:hidden"
        } ${contentClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
