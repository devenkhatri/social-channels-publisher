"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderSync,
  CalendarClock,
  Activity,
  Database,
  Cloud,
  KeyRound,
  MoreHorizontal,
  X,
  LogOut,
  ExternalLink,
} from "lucide-react";

const PRIMARY_NAV = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Library",
    href: "/content",
    icon: FolderSync,
  },
  {
    name: "Queues",
    href: "/queues",
    icon: CalendarClock,
  },
  {
    name: "Activity",
    href: "/activity",
    icon: Activity,
  },
];

const SECONDARY_NAV = [
  {
    name: "Database Explorer",
    href: "/database",
    icon: Database,
    description: "Browse SQLite tables and raw posts",
  },
  {
    name: "OneDrive Source",
    href: "/settings/onedrive",
    icon: Cloud,
    description: "Folder configuration & auth tokens",
  },
  {
    name: "Zernio Accounts",
    href: "/settings/zernio",
    icon: KeyRound,
    description: "API keys & connected social channels",
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const isSecondaryActive = SECONDARY_NAV.some(
    (item) => pathname === item.href || pathname.startsWith(item.href)
  );

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setIsOpen(false);
      router.push("/auth/login");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      {/* Slide-up "More" Sheet Backdrop & Modal */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end transition-opacity duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 rounded-t-3xl p-5 shadow-2xl max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  More Settings & Tools
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Configuration, accounts, and system explorer
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Secondary Nav Links */}
            <div className="py-3 space-y-1.5">
              {SECONDARY_NAV.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3.5 p-3 rounded-2xl transition-colors ${
                      isActive
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        isActive
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium leading-tight">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                        {item.description}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* External Docs & Logout */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
              <a
                href="https://docs.zernio.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 transition-colors"
              >
                <span className="font-medium">Zernio Docs API</span>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
              </a>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out (Admin)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Primary Mobile Bottom Bar (Spacious 5-Column Grid) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 pb-safe transition-colors">
        <div className="grid grid-cols-5 h-16">
          {PRIMARY_NAV.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors ${
                  isActive
                    ? "text-zinc-900 dark:text-zinc-100 font-semibold"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg transition-colors ${
                    isActive
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[11px] mt-0.5 tracking-tight font-medium">
                  {item.name}
                </span>
              </Link>
            );
          })}

          {/* 5th Tab: "More" */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={`flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors cursor-pointer ${
              isSecondaryActive || isOpen
                ? "text-zinc-900 dark:text-zinc-100 font-semibold"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <div
              className={`p-1.5 rounded-lg transition-colors ${
                isSecondaryActive || isOpen
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight font-medium">
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
