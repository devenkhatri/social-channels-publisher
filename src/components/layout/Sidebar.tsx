"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderSync,
  Cloud,
  KeyRound,
  Activity,
  CalendarClock,
  Database,
  LogOut,
  Share2,
  ExternalLink,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

const NAV_ITEMS = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Content Library",
    href: "/content",
    icon: FolderSync,
  },
  {
    name: "Queues",
    href: "/queues",
    icon: CalendarClock,
  },
  {
    name: "Database",
    href: "/database",
    icon: Database,
  },
  {
    name: "Activity Log",
    href: "/activity",
    icon: Activity,
  },
  {
    name: "OneDrive Source",
    href: "/settings/onedrive",
    icon: Cloud,
  },
  {
    name: "Zernio Accounts",
    href: "/settings/zernio",
    icon: KeyRound,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/auth/login");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 z-30 transition-colors">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-sm">
          <Share2 className="w-4 h-4" />
        </div>
        <div>
          <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 block">
            Social Publisher
          </span>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">v1.0 • OneDrive</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Navigation
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold border border-zinc-200 dark:border-zinc-700/60 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40"
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"
                }`}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* External Resource Card */}
      <div className="px-3 pb-3">
        <a
          href="https://docs.zernio.com"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors group"
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Zernio Docs API
          </span>
          <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
        </a>
      </div>

      {/* Footer / User Controls & Theme */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            AD
          </div>
          <div className="text-left truncate">
            <p className="text-xs font-medium text-zinc-900 dark:text-zinc-200 leading-tight truncate">Admin</p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">Authenticated</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            type="button"
            title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
            className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-600" />
            )}
          </button>

          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
