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
  Layers,
  Radio,
  Check,
  FolderOpen,
} from "lucide-react";

interface Connection {
  id: string;
  connectionId: string;
  platform: string;
  username: string | null;
  displayName: string | null;
  profilePicture: string | null;
  profileUrl: string | null;
  isActive: boolean;
  platformStatus: string | null;
  followersCount: number | null;
}

interface Profile {
  id: string;
  profileId: string;
  name: string;
  isDefault: boolean;
  color: string | null;
  connectionsCount: number;
  availableChannels: string[];
  connections: Connection[];
  // backward compat
  platform?: string;
  profileName?: string | null;
  profileAvatar?: string | null;
}

interface ZernioAccount {
  id: string;
  name: string;
  maskedApiKey: string;
  createdAt: string | null;
  availableChannels: string[];
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
    availableChannels?: string[];
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
      setStatusMessage("Account added successfully! Profiles and active connections synchronized.");
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
      setStatusMessage(data.message || "Profiles & connections refreshed!");
      setTimeout(() => setStatusMessage(null), 4000);
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

  const renderPlatformBadge = (platform: string) => {
    const p = platform.toLowerCase();
    switch (p) {
      case "linkedin":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A66C2]/15 text-[#70b5f9] font-medium text-xs border border-[#0A66C2]/30">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.5 1.5 0 0 0 1.5-1.5 1.5 1.5 0 0 0-1.5-1.5 1.5 1.5 0 0 0-1.5 1.5 1.5 1.5 0 0 0 1.5 1.5m1.37 9.74v-8.37H5.09v8.37h2.74z" />
            </svg>
            <span>LinkedIn</span>
          </span>
        );
      case "linkedin_page":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-300 font-medium text-xs border border-sky-500/30">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.5 1.5 0 0 0 1.5-1.5 1.5 1.5 0 0 0-1.5-1.5 1.5 1.5 0 0 0-1.5 1.5 1.5 1.5 0 0 0 1.5 1.5m1.37 9.74v-8.37H5.09v8.37h2.74z" />
            </svg>
            <span>LinkedIn Page</span>
          </span>
        );
      case "twitter":
      case "x":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-white font-medium text-xs border border-slate-700">
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>X (Twitter)</span>
          </span>
        );
      case "youtube":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 font-medium text-xs border border-red-500/30">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42A2.5 2.5 0 0 0 2.42 7.19C2 8.76 2 12 2 12s0 3.24.42 4.81a2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77C22 15.24 22 12 22 12s0-3.24-.42-4.81zM10 15V9l5.2 3-5.2 3z" />
            </svg>
            <span>YouTube</span>
          </span>
        );
      case "instagram":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-500/15 text-pink-400 font-medium text-xs border border-pink-500/30">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
            </svg>
            <span>Instagram</span>
          </span>
        );
      case "facebook":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/15 text-blue-300 font-medium text-xs border border-blue-600/30">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <span>Facebook</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium text-xs border border-slate-700 capitalize">
            <span>{platform}</span>
          </span>
        );
    }
  };

  const accounts = data || [];

  return (
    <div className="max-w-4xl space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <KeyRound className="w-6 h-6 text-indigo-400" />
            Zernio Social Accounts
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Connect your Zernio API keys to discover profiles and manage active social channel connections (LinkedIn, YouTube, Instagram, Facebook).
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
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
            Configured Accounts ({accounts.length})
          </h3>
          <span className="text-xs text-slate-500">
            Social profiles & active channel connections
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-36 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse"
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
          accounts.map((acc) => {
            const totalConnections = acc.profiles.reduce(
              (sum, p) => sum + (p.connections?.length || 0),
              0
            );

            return (
              <div
                key={acc.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5 transition-all"
              >
                {/* Account Top Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h4 className="text-base font-bold text-white">{acc.name}</h4>
                      <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-lg bg-slate-800/90 text-slate-400 border border-slate-700">
                        {acc.maskedApiKey}
                      </span>
                    </div>

                    {/* Channels Overview Badges */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[11px] font-medium text-slate-400">
                        Available Channels:
                      </span>
                      {acc.availableChannels && acc.availableChannels.length > 0 ? (
                        acc.availableChannels.map((ch) => (
                          <div key={ch}>{renderPlatformBadge(ch)}</div>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500 italic">
                          No active channel connections discovered
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <button
                      onClick={() => refreshProfiles(acc.id)}
                      disabled={refreshingId === acc.id}
                      title="Refresh connected profiles & active channels from Zernio"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${refreshingId === acc.id ? "animate-spin text-indigo-400" : ""}`}
                      />
                      <span>Refresh Profiles</span>
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Delete account "${acc.name}"?`)) {
                          deleteMutation.mutate(acc.id);
                        }
                      }}
                      title="Delete Account"
                      className="p-1.5 rounded-xl hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Profiles & Active Connections */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      Profiles & Connected Channels ({acc.profiles.length} Profile{acc.profiles.length === 1 ? "" : "s"}, {totalConnections} Active Connection{totalConnections === 1 ? "" : "s"})
                    </span>
                  </div>

                  {acc.profiles.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-amber-400/90 flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        No profiles discovered yet. Click "Refresh Profiles" to sync your Zernio profiles and connected social accounts.
                      </span>
                    </div>
                  ) : (
                    acc.profiles.map((profile) => (
                      <div
                        key={profile.id}
                        className="rounded-xl bg-slate-950/80 border border-slate-800/90 p-4 space-y-3.5"
                      >
                        {/* Profile Header */}
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-800/60">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                              <FolderOpen className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-bold text-white tracking-wide">
                              {profile.name}
                            </span>
                            {profile.isDefault && (
                              <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 font-semibold text-[10px] border border-indigo-500/30">
                                Default Profile
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400 font-medium">
                              Active Channels:
                            </span>
                            {profile.connections && profile.connections.length > 0 ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {profile.connections.map((c) => (
                                  <span
                                    key={c.id}
                                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300 capitalize"
                                  >
                                    {c.platform}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">None</span>
                            )}
                          </div>
                        </div>

                        {/* Active Connections Inside Profile */}
                        {profile.connections && profile.connections.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            {profile.connections.map((conn) => (
                              <div
                                key={conn.id}
                                className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 transition-all shadow-sm"
                              >
                                <div className="flex items-start gap-3 min-w-0">
                                  {conn.profilePicture ? (
                                    <img
                                      src={conn.profilePicture}
                                      alt={conn.displayName || ""}
                                      className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-slate-700/80"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-400">
                                      <Share2 className="w-4 h-4" />
                                    </div>
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="text-xs font-bold text-white truncate">
                                        {conn.displayName || conn.username || "Connected Channel"}
                                      </p>
                                    </div>

                                    {conn.username && (
                                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                        @{conn.username.replace(/^@/, "")}
                                      </p>
                                    )}

                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                      {renderPlatformBadge(conn.platform)}

                                      {typeof conn.followersCount === "number" && (
                                        <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                                          {conn.followersCount.toLocaleString()} {conn.platform.toLowerCase() === "youtube" ? "subscribers" : "followers"}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                      conn.isActive
                                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                        : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        conn.isActive ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                                      }`}
                                    />
                                    <span>{conn.isActive ? "Active" : "Inactive"}</span>
                                  </span>

                                  {conn.profileUrl && (
                                    <a
                                      href={conn.profileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Open channel page"
                                      className="text-[11px] text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 mt-1 transition-colors"
                                    >
                                      <span>Channel</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/60 text-xs text-amber-400/90 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                              <span>
                                No active connections in this profile. Connect channels (LinkedIn, YouTube, Instagram, Facebook) in Zernio.
                              </span>
                            </div>
                            <a
                              href="https://zernio.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-400 hover:text-indigo-300 whitespace-nowrap inline-flex items-center gap-1 font-medium"
                            >
                              <span>Open Zernio</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })
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
