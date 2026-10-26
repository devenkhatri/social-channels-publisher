"use client";

import { Cloud, CheckCircle, FolderCheck, AlertCircle } from "lucide-react";

export default function OneDriveSettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Cloud className="w-6 h-6 text-indigo-400" />
          Microsoft OneDrive Source
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Connect your Microsoft OneDrive account to automatically discover social content folders, slides, and hyperframes video reels.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Connection Status</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Delegated Microsoft Graph API connection with Files.ReadWrite permissions.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
            Not Connected
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
          <h3 className="text-xs font-semibold text-slate-300">Phase 2: Microsoft OAuth Setup</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Configure your Azure AD App Registration in <code className="text-slate-300">.env.local</code> with <code className="text-slate-300">AZURE_CLIENT_ID</code> and <code className="text-slate-300">AZURE_CLIENT_SECRET</code>. Once configured, you can connect your account and browse to select the parent folder containing your content.
          </p>
        </div>

        <button
          disabled
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/40 text-indigo-300/60 text-xs font-medium cursor-not-allowed border border-indigo-500/20"
        >
          <Cloud className="w-4 h-4" />
          <span>Connect OneDrive Account (Phase 2)</span>
        </button>
      </div>
    </div>
  );
}
