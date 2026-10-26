"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderSync,
  Cloud,
  KeyRound,
  Activity,
  LogOut,
  Sparkles,
  ExternalLink,
} from "lucide-react";

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
    <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 bg-slate-900 border-r border-slate-800 z-30">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800/80">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-500/20 ring-1 ring-white/20">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="font-semibold text-sm tracking-tight text-white block">
            Social Publisher
          </span>
          <span className="text-[11px] text-slate-400 font-mono">v1.0 • OneDrive</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
                  ? "bg-indigo-600/15 text-indigo-400 font-semibold border border-indigo-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? "text-indigo-400" : "text-slate-400"
                }`}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* External Resource Card */}
      <div className="px-3 pb-4">
        <a
          href="https://docs.zernio.com"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 text-xs text-slate-400 hover:text-slate-200 transition-colors group"
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Zernio Docs API
          </span>
          <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
        </a>
      </div>

      {/* Footer / User Controls */}
      <div className="p-4 border-t border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-300">
            AD
          </div>
          <div className="text-left">
            <p className="text-xs font-medium text-slate-200 leading-tight">Admin</p>
            <p className="text-[10px] text-slate-400">Authenticated</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          title="Sign out"
          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
