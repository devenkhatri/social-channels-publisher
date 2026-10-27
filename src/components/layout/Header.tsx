"use client";

import { useState } from "react";
import { Share2, RefreshCw, CheckCircle2, AlertCircle, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

export function Header() {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const { resolvedTheme, toggleTheme } = useTheme();

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Sync failed");
      }
      setSyncMessage("Synced successfully");
      setTimeout(() => setSyncMessage(null), 3000);
    } catch (err: any) {
      setSyncMessage(err.message || "OneDrive not connected yet");
      setTimeout(() => setSyncMessage(null), 4000);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className="h-16 sticky top-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 sm:px-6 lg:px-8 transition-colors">
      {/* Left: Mobile Brand / Desktop Title */}
      <div className="flex items-center gap-3">
        <div className="lg:hidden w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-sm">
          <Share2 className="w-4 h-4" />
        </div>
        <span className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 tracking-tight">
          Social Channels Publisher
        </span>
      </div>

      {/* Right: Theme Toggle & Quick Sync & Status */}
      <div className="flex items-center gap-2 sm:gap-3">
        {syncMessage && (
          <div
            className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full animate-in fade-in ${
              syncMessage.includes("success")
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
            }`}
          >
            {syncMessage.includes("success") ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" />
            )}
            <span>{syncMessage}</span>
          </div>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          type="button"
          title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
          aria-label="Toggle theme"
          className="p-2 min-h-[38px] min-w-[38px] rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 transition-all flex items-center justify-center active:scale-95"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-zinc-600" />
          )}
        </button>

        {/* Sync Button */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 transition-all active:scale-95 disabled:opacity-60 shadow-sm"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
          />
          <span className="hidden sm:inline">Sync OneDrive</span>
          <span className="sm:hidden">Sync</span>
        </button>
      </div>
    </header>
  );
}
