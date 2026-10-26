"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Cloud,
  CheckCircle2,
  FolderOpen,
  AlertCircle,
  FolderCheck,
  RefreshCw,
  LogOut,
  ExternalLink,
  Shield,
  KeyRound,
  Check,
  Loader2,
  Tag,
  ArrowRight,
} from "lucide-react";
import { FolderPickerModal } from "@/components/onedrive/FolderPickerModal";

export default function OneDriveSettingsPage() {
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsSuccess, setCredsSuccess] = useState(false);
  const [savingAutoRename, setSavingAutoRename] = useState(false);

  // Form states for Azure App Registration
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tenantId, setTenantId] = useState("common");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["onedrive-status"],
    queryFn: async () => {
      const res = await fetch("/api/onedrive/status");
      if (!res.ok) throw new Error("Failed to load OneDrive status");
      const json = await res.json();
      if (json.credentials) {
        setClientId((prev) => prev || json.credentials.clientId || "");
        setTenantId((prev) => (prev === "common" && json.credentials.tenantId ? json.credentials.tenantId : prev));
      }
      return json;
    },
  });

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/onedrive/auth");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start auth flow");
      window.location.href = json.url;
    } catch (err: any) {
      alert(err.message || "Failed to connect to Microsoft");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect Microsoft OneDrive?")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/onedrive/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Failed to disconnect");
      await refetch();
    } catch (err: any) {
      alert(err.message || "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreds(true);
    setCredsSuccess(false);

    try {
      const res = await fetch("/api/settings/azure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          clientSecret,
          tenantId,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save Azure credentials");

      setCredsSuccess(true);
      setTimeout(() => setCredsSuccess(false), 3000);
      await refetch();
    } catch (err: any) {
      alert(err.message || "Failed to save credentials");
    } finally {
      setSavingCreds(false);
    }
  };

  const handleFolderSelect = async (folder: { id: string; name: string; path: string }) => {
    const res = await fetch("/api/onedrive/select-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folderId: folder.id,
        folderName: folder.name,
        folderPath: folder.path,
      }),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || "Failed to save parent folder");
    }

    await refetch();
  };

  const handleToggleAutoRename = async (enabled: boolean) => {
    if (!data?.selectedFolder?.id) return;
    setSavingAutoRename(true);
    try {
      await fetch("/api/onedrive/select-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: data.selectedFolder.id,
          autoRename: enabled,
        }),
      });
      await refetch();
    } finally {
      setSavingAutoRename(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-xs gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        <span>Loading OneDrive configuration...</span>
      </div>
    );
  }

  const isConnected = data?.connected;
  const user = data?.user;
  const selectedFolder = data?.selectedFolder;
  const hasAzureCreds = data?.hasAzureCreds;

  return (
    <div className="max-w-4xl space-y-8 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Cloud className="w-6 h-6 text-indigo-400" />
          Microsoft OneDrive Source
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Connect your Microsoft account and designate the parent folder where your social post directories reside.
        </p>
      </div>

      {/* Card 1: Connection & Account */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/20 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <span>Account Connection</span>
              {isConnected ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected
                </span>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                  Not Connected
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Delegated Microsoft Graph API connection with <code className="text-slate-300">Files.ReadWrite</code> permissions to read content and rename published folders to <code className="text-slate-300">-Done</code>.
            </p>
          </div>

          <div>
            {isConnected ? (
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{disconnecting ? "Disconnecting..." : "Disconnect"}</span>
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting || !hasAzureCreds}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-indigo-500 hover:from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {connecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Cloud className="w-3.5 h-3.5" />
                )}
                <span>Connect Microsoft OneDrive</span>
              </button>
            )}
          </div>
        </div>

        {isConnected && user && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-sm font-bold text-indigo-300">
              {user.displayName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{user.displayName}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
        )}

        {!hasAzureCreds && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-200">Azure App Registration Required</p>
              <p className="text-amber-300/80 mt-0.5">
                Before connecting your Microsoft account, save your Azure Client ID and Client Secret in the credentials form below.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Card 2: Parent Folder Selector */}
      {isConnected && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/20 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-indigo-400" />
                <span>Parent Content Folder</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                The folder containing all generated social post directories (e.g., <code className="text-slate-300">20261026-0823</code>).
              </p>
            </div>

            <button
              onClick={() => setIsFolderPickerOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>{selectedFolder ? "Change Folder" : "Select Parent Folder"}</span>
            </button>
          </div>

          {selectedFolder ? (
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <FolderCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {selectedFolder.name}
                  </p>
                  <p className="text-xs text-slate-400 font-mono truncate">
                    {selectedFolder.path}
                  </p>
                </div>
              </div>

              <span className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Active Source
              </span>
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-400">
              No parent folder selected yet. Click <strong>"Select Parent Folder"</strong> above to browse your OneDrive files.
            </div>
          )}

          {/* Suffix Lifecycle Setting */}
          {selectedFolder && (
            <div className="pt-4 border-t border-slate-800/80">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={data?.autoRename}
                  disabled={savingAutoRename}
                  onChange={(e) => handleToggleAutoRename(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 group-hover:text-white transition-colors block">
                    Automatically rename OneDrive folder to suffix "-Done" upon successful publishing
                  </span>
                  <span className="text-slate-400 leading-relaxed block mt-0.5">
                    When you publish to all targeted channels, the application will automatically rename the folder on OneDrive (e.g., from <code className="text-slate-300">20261026-0823</code> to <code className="text-slate-300">20261026-0823-Done</code>), marking it as published and moving it to the archive view.
                  </span>
                </div>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Card 3: Azure App Registration Credentials Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-black/20 space-y-6">
        <div className="pb-4 border-b border-slate-800/80">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-400" />
            <span>Azure App Registration Credentials</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure your Microsoft Entra ID (Azure AD) App Registration to authenticate with Microsoft Graph API.
          </p>
        </div>

        <form onSubmit={handleSaveCredentials} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Azure Client ID (Application ID)
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Azure Client Secret
              </label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={data?.credentials?.hasSecret ? "•••••••••••••••••••••••• (Saved)" : "Enter client secret value..."}
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Azure Tenant ID
              </label>
              <input
                type="text"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="common (or your specific tenant ID)"
                className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Redirect URI (Fixed)
              </label>
              <input
                type="text"
                readOnly
                value={data?.credentials?.redirectUri || "http://localhost:3000/auth/microsoft/callback"}
                className="w-full px-3.5 py-2 text-xs bg-slate-950/60 border border-slate-800 rounded-xl text-slate-400 font-mono cursor-not-allowed"
              />
            </div>
          </div>

          {credsSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Azure App Registration credentials saved successfully!</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <a
              href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              <span>Open Azure Portal App Registrations</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="submit"
              disabled={savingCreds}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white transition-colors"
            >
              {savingCreds ? "Saving..." : "Save Credentials"}
            </button>
          </div>
        </form>

        {/* Azure App Registration Guide Note */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs text-slate-400">
          <p className="font-semibold text-slate-300">Quick Azure AD Setup Steps:</p>
          <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] leading-relaxed">
            <li>Register an application in Azure Portal &gt; App registrations.</li>
            <li>Supported account types: <em>"Accounts in any organizational directory and personal Microsoft accounts"</em> (Multitenant).</li>
            <li>Add a Web redirect URI: <code className="text-slate-300 font-mono">http://localhost:3000/auth/microsoft/callback</code>.</li>
            <li>Under API Permissions, add Microsoft Graph delegated permissions: <code className="text-slate-300 font-mono">Files.ReadWrite</code>, <code className="text-slate-300 font-mono">Files.ReadWrite.All</code>, and <code className="text-slate-300 font-mono">User.Read</code>.</li>
            <li>Create a Client Secret under Certificates & secrets, copy the Value, and save it above.</li>
          </ol>
        </div>
      </div>

      {/* Folder Picker Modal Dialog */}
      <FolderPickerModal
        isOpen={isFolderPickerOpen}
        onClose={() => setIsFolderPickerOpen(false)}
        onSelect={handleFolderSelect}
        currentFolderId={selectedFolder?.id}
      />
    </div>
  );
}
