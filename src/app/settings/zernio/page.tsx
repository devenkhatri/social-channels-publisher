"use client";

import { KeyRound, Shield, Plus, CheckCircle2 } from "lucide-react";

export default function ZernioSettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <KeyRound className="w-6 h-6 text-indigo-400" />
            Zernio Accounts
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage your Zernio API keys for publishing to LinkedIn, YouTube, Instagram, and Facebook.
          </p>
        </div>

        <button
          disabled
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/50 text-indigo-200 text-xs font-medium cursor-not-allowed opacity-75"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Account (Phase 6)</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Zero-Knowledge AES-256-GCM Storage</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          All API keys are encrypted at rest with your unique encryption key. Multiple Zernio accounts can be configured to publish to distinct personal or client brand profiles.
        </p>
      </div>
    </div>
  );
}
