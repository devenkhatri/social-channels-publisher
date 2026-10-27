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
  Share2,
  Layers,
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A66C2]/10 text-[#0A66C2] dark:text-[#70b5f9] font-medium text-xs border border-[#0A66C2]/20">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.5 1.5 0 0 0 1.5-1.5 1.5 1.5 0 0 0-1.5-1.5 1.5 1.5 0 0 0-1.5 1.5 1.5 1.5 0 0 0 1.5 1.5m1.37 9.74v-8.37H5.09v8.37h2.74z" />
            </svg>
            <span>LinkedIn</span>
          </span>
        );
      case "linkedin_page":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 font-medium text-xs border border-sky-500/20">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.5 1.5 0 0 0 1.5-1.5 1.5 1.5 0 0 0-1.5-1.5 1.5 1.5 0 0 0-1.5 1.5 1.5 1.5 0 0 0 1.5 1.5m1.37 9.74v-8.37H5.09v8.37h2.74z" />
            </svg>
            <span>LinkedIn Page</span>
          </span>
        );
      case "threads":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium text-xs border border-zinc-300 dark:border-zinc-700">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 192 192">
              <path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4384 44.7442 97.3148 44.7437 97.191 44.7437C75.2536 44.7437 57.7719 59.882 56.6347 80.609C55.4523 102.164 69.8457 121.285 91.2461 126.549C104.991 129.93 118.802 127.322 127.818 119.539L117.845 109.913C111.905 114.764 102.261 116.326 92.4277 113.906C78.0772 110.375 68.3283 97.4093 69.1171 82.9691C69.8797 69.0069 82.261 58.125 97.2365 58.125C97.3204 58.125 97.4042 58.1254 97.4879 58.126C114.15 58.2323 124.364 68.8475 125.438 88.625C118.91 88.1362 112.012 88.4285 105.12 89.5447C85.0489 92.7937 72.8222 104.457 73.8443 119.543C74.7925 133.541 87.6961 143.834 103.58 143.834C104.577 143.834 105.586 143.793 106.602 143.709C122.951 142.368 135.034 133.003 139.734 117.922C143.83 125.642 148.665 132.895 155.158 139.119L164.671 129.213C155.852 120.762 149.92 110.395 146.772 98.4239C149.889 97.0371 152.684 95.1432 155.064 92.7797C160.67 87.2144 163.784 79.5937 163.784 71.365C163.784 53.7915 150.155 39.8142 132.99 39.8142C128.536 39.8142 124.161 40.7573 120.103 42.6074L125.753 54.9922C127.973 53.9806 130.407 53.4328 132.99 53.4328C142.671 53.4328 150.165 61.1214 150.165 71.365C150.165 76.1245 148.337 80.4431 145.021 83.5186C142.637 85.7297 139.387 87.4116 135.347 88.4277C137.493 88.5833 139.548 88.7777 141.537 88.9883ZM87.2796 118.633C86.7262 110.468 93.8966 103.498 106.944 101.385C110.892 100.745 114.869 100.569 118.778 100.825C115.426 122.997 104.938 130.402 96.0121 131.134C89.919 131.634 87.7224 125.166 87.2796 118.633Z" />
            </svg>
            <span>Threads</span>
          </span>
        );
      case "twitter":
      case "x":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium text-xs border border-zinc-300 dark:border-zinc-700">
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>X (Twitter)</span>
          </span>
        );
      case "youtube":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 font-medium text-xs border border-red-500/20">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42A2.5 2.5 0 0 0 2.42 7.19C2 8.76 2 12 2 12s0 3.24.42 4.81a2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77C22 15.24 22 12 22 12s0-3.24-.42-4.81zM10 15V9l5.2 3-5.2 3z" />
            </svg>
            <span>YouTube</span>
          </span>
        );
      case "instagram":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 font-medium text-xs border border-pink-500/20">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
            </svg>
            <span>Instagram</span>
          </span>
        );
      case "facebook":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/10 text-blue-700 dark:text-blue-300 font-medium text-xs border border-blue-600/20">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <span>Facebook</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-xs border border-zinc-200 dark:border-zinc-700 capitalize">
            <span>{platform}</span>
          </span>
        );
    }
  };

  const accounts = data || [];

  return (
    <div className="max-w-4xl space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2.5">
            <KeyRound className="w-6 h-6 text-zinc-800 dark:text-zinc-200" />
            Zernio Social Accounts
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Connect your Zernio API keys to discover profiles and manage active social channel connections (LinkedIn, YouTube, Instagram, Facebook).
          </p>
        </div>

        <button
          onClick={() => {
            setIsAdding(!isAdding);
            setTestResult(null);
          }}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium shadow-sm transition-all min-h-[38px] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Account</span>
        </button>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Add Account Card */}
      {isAdding && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              Connect New Zernio Account
            </h3>
            <button
              onClick={() => setIsAdding(false)}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 min-h-[36px] flex items-center cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Account Label
              </label>
              <input
                type="text"
                placeholder="e.g. Main Brand, Personal Brand"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 min-h-[38px]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Zernio API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  placeholder="zr_live_••••••••••••••••"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 font-mono min-h-[38px]"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 min-h-[36px] min-w-[36px] flex items-center justify-center"
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
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400"
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
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium border border-zinc-200 dark:border-zinc-700 disabled:opacity-50 min-h-[38px] cursor-pointer"
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium disabled:opacity-50 shadow-sm min-h-[38px] cursor-pointer"
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
          <h3 className="text-xs uppercase font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider">
            Configured Accounts ({accounts.length})
          </h3>
          <span className="text-xs text-zinc-500">
            Social profiles & active channel connections
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-36 rounded-2xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 animate-pulse"
              />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900/50 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl p-8 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
              <KeyRound className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No Zernio accounts added</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
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
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-xl space-y-5 transition-all"
              >
                {/* Account Top Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{acc.name}</h4>
                      <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                        {acc.maskedApiKey}
                      </span>
                    </div>

                    {/* Channels Overview Badges */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        Available Channels:
                      </span>
                      {acc.availableChannels && acc.availableChannels.length > 0 ? (
                        acc.availableChannels.map((ch) => (
                          <div key={ch}>{renderPlatformBadge(ch)}</div>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-500 italic">
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
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium border border-zinc-200 dark:border-zinc-700 transition-colors disabled:opacity-50 min-h-[38px] cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${refreshingId === acc.id ? "animate-spin text-zinc-900 dark:text-zinc-100" : ""}`}
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
                      className="p-2 rounded-xl hover:bg-rose-500/10 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Profiles & Active Connections */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-zinc-500" />
                      Profiles & Connected Channels ({acc.profiles.length} Profile{acc.profiles.length === 1 ? "" : "s"}, {totalConnections} Active Connection{totalConnections === 1 ? "" : "s"})
                    </span>
                  </div>

                  {acc.profiles.length === 0 ? (
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-xs text-amber-700 dark:text-amber-400/90 flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        No profiles discovered yet. Click "Refresh Profiles" to sync your Zernio profiles and connected social accounts.
                      </span>
                    </div>
                  ) : (
                    acc.profiles.map((profile) => (
                      <div
                        key={profile.id}
                        className="rounded-xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/90 p-4 space-y-3.5"
                      >
                        {/* Profile Header */}
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-zinc-200 dark:border-zinc-800/60">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                              <FolderOpen className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-wide">
                              {profile.name}
                            </span>
                            {profile.isDefault && (
                              <span className="px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-[10px] border border-zinc-300 dark:border-zinc-700">
                                Default Profile
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                              Active Channels:
                            </span>
                            {profile.connections && profile.connections.length > 0 ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {profile.connections.map((c) => (
                                  <span
                                    key={c.id}
                                    className="px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 capitalize"
                                  >
                                    {c.platform}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">None</span>
                            )}
                          </div>
                        </div>

                        {/* Active Connections Inside Profile */}
                        {profile.connections && profile.connections.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            {profile.connections.map((conn) => (
                              <div
                                key={conn.id}
                                className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800/90 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-xs"
                              >
                                <div className="flex items-start gap-3 min-w-0">
                                  {conn.profilePicture ? (
                                    <img
                                      src={conn.profilePicture}
                                      alt={conn.displayName || ""}
                                      className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-zinc-200 dark:ring-zinc-700/80"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 text-zinc-500 dark:text-zinc-400">
                                      <Share2 className="w-4 h-4" />
                                    </div>
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                        {conn.displayName || conn.username || "Connected Channel"}
                                      </p>
                                    </div>

                                    {conn.username && (
                                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                                        @{conn.username.replace(/^@/, "")}
                                      </p>
                                    )}

                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                      {renderPlatformBadge(conn.platform)}

                                      {typeof conn.followersCount === "number" && (
                                        <span className="text-[10px] text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
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
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        conn.isActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
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
                                      className="text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 inline-flex items-center gap-1 mt-1 transition-colors min-h-[30px]"
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
                          <div className="p-3.5 rounded-xl bg-zinc-100/60 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/60 text-xs text-amber-700 dark:text-amber-400/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                              <span>
                                No active connections in this profile. Connect channels (LinkedIn, YouTube, Instagram, Facebook) in Zernio.
                              </span>
                            </div>
                            <a
                              href="https://zernio.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white whitespace-nowrap inline-flex items-center gap-1 font-medium min-h-[32px]"
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
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
          <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Zero-Knowledge AES-256-GCM Storage</span>
        </div>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Your Zernio API keys are encrypted at rest with hardware-accelerated AES-256-GCM using your application secret. Keys are decrypted strictly on the server-side during publishing execution and are never leaked to client browsers.
        </p>
        <div className="pt-2">
          <a
            href="https://docs.zernio.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors min-h-[36px]"
          >
            <span>Read Zernio API Documentation</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
