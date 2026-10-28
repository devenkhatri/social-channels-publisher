"use client";

import { useState } from "react";
import { ChevronDown, Layers, type LucideIcon } from "lucide-react";

interface CollapsibleCardsSectionProps {
  title?: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  summary?: React.ReactNode;
  children: React.ReactNode;
  defaultOpenMobile?: boolean;
  defaultOpenDesktop?: boolean;
  className?: string;
}

export function CollapsibleCardsSection({
  title = "Overview Metrics",
  icon: Icon = Layers,
  badge,
  summary,
  children,
  defaultOpenMobile = false,
  defaultOpenDesktop = true,
  className = "",
}: CollapsibleCardsSectionProps) {
  const [isOpenMobile, setIsOpenMobile] = useState(defaultOpenMobile);
  const [isOpenDesktop, setIsOpenDesktop] = useState(defaultOpenDesktop);

  return (
    <section className={`w-full ${className}`}>
      {/* Mobile Toggle Bar */}
      <div className="sm:hidden mb-2">
        <button
          type="button"
          onClick={() => setIsOpenMobile((prev) => !prev)}
          aria-expanded={isOpenMobile}
          className="w-full flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs transition-all text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {title}
                </span>
                {badge}
              </div>
              {summary && (
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                  {summary}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 shrink-0 text-xs">
            <span className="text-[11px] font-medium">
              {isOpenMobile ? "Hide" : "Show"}
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isOpenMobile ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>
      </div>

      {/* Desktop Header with optional collapse toggle */}
      <div className="hidden sm:flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-zinc-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {title}
          </span>
          {badge}
        </div>

        <button
          type="button"
          onClick={() => setIsOpenDesktop((prev) => !prev)}
          aria-expanded={isOpenDesktop}
          className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          <span>{isOpenDesktop ? "Collapse" : "Expand"}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpenDesktop ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* Content wrapper */}
      <div
        className={`${isOpenMobile ? "block" : "hidden"} ${
          isOpenDesktop ? "sm:block" : "sm:hidden"
        }`}
      >
        {children}
      </div>
    </section>
  );
}
