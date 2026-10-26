"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

export function Header() {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

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
    <header className="h-16 sticky top-0 z-20 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      {/* Left: Mobile Brand / Desktop Title */}
      <div className="flex items-center gap-3">
        <div className="lg:hidden w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-semibold text-sm sm:text-base text-white tracking-tight">
          Social Channels Publisher
        </span>
      </div>

      {/* Right: Quick Sync & Status */}
      <div className="flex items-center gap-3">
        {syncMessage && (
          <div
            className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full animate-in fade-in ${
              syncMessage.includes("success")
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
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

        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 transition-all active:scale-95 disabled:opacity-60"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-indigo-400" : "text-slate-400"}`}
          />
          <span className="hidden sm:inline">Sync OneDrive</span>
          <span className="sm:hidden">Sync</span>
        </button>
      </div>
    </header>
  );
}
