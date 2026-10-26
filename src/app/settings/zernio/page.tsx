"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  KeyRound,
  Shield,
  Plus,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
  AlertCircle,
  Sparkles,
  Share2,
} from "lucide-react";

interface Profile {
  id: string;
  platform: string;
  profileId: string;
  profileName: string | null;
  profileAvatar: string | null;
}

interface ZernioAccount {
  id: string;
  name: string;
  maskedApiKey: string;
  createdAt: string | null;
  profiles: Profile[];
}

export default function ZernioSettingsPage() {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    valid?: boolean;
    message?: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["zernio-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/zernio/accounts");
      if (!res.ok) throw new Error("Failed to load accounts");
      const json = await res.json();
      return json.accounts as ZernioAccount[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (payload: { name: string; apiKey: string }) => {
      const res = await fetch("/api/zernio/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add account");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zernio-accounts"] });
      setIsAdding(false);
      setAccountName("");
      setApiKey("");
      setTestResult(null);
      setStatusMessage("Account added successfully! Profiles synchronized.");
      setTimeout(() => setStatusMessage(null), 4000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/zernio/accounts?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete account");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zernio-accounts"] });
      setStatusMessage("Account deleted.");
      setTimeout(() => setStatusMessage(null), 3000);
    },
  });

  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const refreshProfiles = async (accountId: string) => {
    try {
      setRefreshingId(accountId);
      const res = await fetch("/api/zernio/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Discovery failed");
      queryClient.invalidateQueries({ queryKey: ["zernio-accounts"] });
      setStatusMessage(data.message || "Profiles refreshed!");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to refresh profiles");
    } finally {
      setRefreshingId(null);
    }
  };

  const [testingKey, setTestingKey] = useState(false);
  const testNewKey = async () => {
    if (!apiKey) return;
    try {
      setTestingKey(true);
      setTestResult(null);
      const res = await fetch("/api/zernio/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const result = await res.json();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        valid: false,
        message: err.message || "Connection test failed",
      });
    } finally {
      setTestingKey(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "linkedin":
        return <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold text-xs border border-blue-500/20">LinkedIn</span>;
      case "youtube":
        return <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 font-semibold text-xs border border-red-500/20">YouTube</span>;
      case "instagram":
        return <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-semibold text-xs border border-purple-500/20">Instagram</span>;
      case "facebook":
        return <span className="px-2 py-0.5 rounded bg-blue-600/10 text-blue-300 font-semibold text-xs border border-blue-600/20">Facebook</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs">{platform}</span>;
    }
  };

  const accounts = data || [];

  return (
    <div className="max-w-4xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <KeyRound className="w-6 h-6 text-indigo-400" />
            Zernio Social Accounts
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Connect your Zernio API keys to publish social posts directly to LinkedIn, YouTube, Instagram, and Facebook.
          </p>
        </div>

        <button
          onClick={() => {
            setIsAdding(!isAdding);
            setTestResult(null);
          }}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-lg shadow-indigo-600/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Account</span>
        </button>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Add Account Card */}
      {isAdding && (
        <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Connect New Zernio Account
            </h3>
            <button
              onClick={() => setIsAdding(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Account Label
              </label>
              <input
                type="text"
                placeholder="e.g. Main Brand, Personal Brand"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Zernio API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  placeholder="zr_live_••••••••••••••••"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showApiKey ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                testResult.valid
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
              }`}
            >
              {testResult.valid ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={testingKey || !apiKey}
              onClick={testNewKey}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 disabled:opacity-50"
            >
              {testingKey ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              <span>Test Connection</span>
            </button>

            <button
              type="button"
              disabled={addMutation.isPending || !accountName || !apiKey}
              onClick={() => addMutation.mutate({ name: accountName, apiKey })}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium disabled:opacity-50 shadow"
            >
              {addMutation.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              <span>Save & Discover Profiles</span>
            </button>
          </div>
        </div>
      )}

      {/* Configured Accounts List */}
      <div className="space-y-4">
        <h3 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
          Configured Accounts ({accounts.length})
        </h3>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-semibold text-white">No Zernio accounts added</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Add your Zernio API key above to connect your social channels and start automated publishing.
            </p>
          </div>
        ) : (
          accounts.map((acc) => (
            <div
              key={acc.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg space-y-4 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-white">{acc.name}</h4>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {acc.maskedApiKey}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Connected profiles: {acc.profiles.length}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => refreshProfiles(acc.id)}
                    disabled={refreshingId === acc.id}
                    title="Refresh connected profiles from Zernio"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${refreshingId === acc.id ? "animate-spin" : ""}`}
                    />
                    <span className="hidden sm:inline">Refresh Profiles</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Delete account "${acc.name}"?`)) {
                        deleteMutation.mutate(acc.id);
                      }
                    }}
                    title="Delete Account"
                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Profiles Grid */}
              {acc.profiles.length > 0 ? (
                <div className="pt-3 border-t border-slate-800/80">
                  <p className="text-[11px] font-medium text-slate-400 mb-2">
                    Discovered Social Profiles:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                    {acc.profiles.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800"
                      >
                        {p.profileAvatar ? (
                          <img
                            src={p.profileAvatar}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-slate-400 text-xs">
                            <Share2 className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white truncate">
                            {p.profileName || "Connected Profile"}
                          </p>
                          <div className="mt-0.5">{getPlatformIcon(p.platform)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="pt-3 border-t border-slate-800/80 text-xs text-amber-400/90 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    No profiles connected yet on this Zernio account. Connect platforms in Zernio, then click "Refresh Profiles".
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Security Info Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Zero-Knowledge AES-256-GCM Storage</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Your Zernio API keys are encrypted at rest with hardware-accelerated AES-256-GCM using your application secret. Keys are decrypted strictly on the server-side during publishing execution and are never leaked to client browsers.
        </p>
        <div className="pt-2">
          <a
            href="https://docs.zernio.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <span>Read Zernio API Documentation</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
