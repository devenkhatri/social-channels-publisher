"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Folder,
  Layers,
  Video,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Send,
  Save,
  RefreshCw,
  Sparkles,
  Shield,
  Play,
  Share2,
  RotateCcw,
  Image as ImageIcon,
  Download,
} from "lucide-react";

type ChannelType = "linkedin" | "youtube" | "instagram" | "facebook" | "skool";

interface SlideItem {
  id: string;
  name: string;
  slideNumber: number;
  downloadUrl?: string;
  size?: number;
}

interface ContentDetailResponse {
  item: {
    id: string;
    folderName: string;
    originalFolderName: string;
    folderPath: string;
    driveItemId: string;
    isDone: number;
    title: string | null;
    coverImage: string | null;
    slideCount: number;
    syncedAt: string | null;
    renamedAt: string | null;
    createdAt: string;
  };
  posts: Array<{
    id: string;
    channel: ChannelType;
    title: string | null;
    body: string | null;
    mediaType: string | null;
    postType: string | null;
    zernioAccountId: string | null;
    zernioProfileId: string | null;
    status: string;
    scheduledFor: string | null;
    publishedAt: string | null;
    zernioPostId: string | null;
    errorMessage: string | null;
  }>;
  assets: {
    captionFile: any;
    linkedinFile: any;
    skoolFile: any;
    coverPromptFile: any;
    coverFile: any;
    hyperframesVideo: any;
    videos: any[];
    pdfs: any[];
    slides: SlideItem[];
  };
}

export default function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  const [activeChannel, setActiveChannel] = useState<ChannelType>("linkedin");
  const [activeMediaTab, setActiveMediaTab] = useState<"slides" | "video" | "pdf" | "cover">("slides");
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Form states per channel
  const [formState, setFormState] = useState<{
    [key in ChannelType]?: {
      title: string;
      body: string;
      postType: string;
      zernioProfileId: string;
    };
  }>({});

  const { data, isLoading, refetch } = useQuery<ContentDetailResponse>({
    queryKey: ["content-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/content/${id}`);
      if (!res.ok) throw new Error("Failed to load content details");
      return res.json();
    },
    refetchInterval: (query) => {
      const posts = query.state.data?.posts;
      const isPublishing = posts?.some((p) => p.status === "publishing");
      return isPublishing ? 2000 : false;
    },
  });

  const { data: accountsData } = useQuery({
    queryKey: ["zernio-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/zernio/accounts");
      if (!res.ok) return [];
      const json = await res.json();
      return json.accounts as any[];
    },
  });

  // Populate form states once data is loaded
  useEffect(() => {
    if (data?.posts) {
      const initial: any = {};
      data.posts.forEach((p) => {
        initial[p.channel] = {
          title: p.title || "",
          body: p.body || "",
          postType: p.postType || "feed",
          zernioProfileId: (p as any).zernioConnectionId || p.zernioProfileId || "",
        };
      });
      setFormState(initial);
    }
  }, [data]);

  // Set default media tab when activeChannel or data changes
  useEffect(() => {
    if (!data?.assets) return;
    const { assets } = data;
    const currentPostType = formState[activeChannel]?.postType;
    if (activeChannel === "youtube") {
      if (assets.hyperframesVideo || (assets.videos && assets.videos.length > 0)) {
        setActiveMediaTab("video");
      } else if (assets.slides && assets.slides.length > 0) {
        setActiveMediaTab("slides");
      }
    } else if (activeChannel === "linkedin") {
      if (assets.slides && assets.slides.length > 0) {
        setActiveMediaTab("slides");
      } else if (assets.pdfs && assets.pdfs.length > 0) {
        setActiveMediaTab("pdf");
      }
    } else if (activeChannel === "instagram" || activeChannel === "facebook") {
      if (currentPostType === "reel" && (assets.hyperframesVideo || (assets.videos && assets.videos.length > 0))) {
        setActiveMediaTab("video");
      } else if (assets.slides && assets.slides.length > 0) {
        setActiveMediaTab("slides");
      }
    } else {
      if (assets.slides && assets.slides.length > 0) {
        setActiveMediaTab("slides");
      } else if (assets.hyperframesVideo || (assets.videos && assets.videos.length > 0)) {
        setActiveMediaTab("video");
      } else if (assets.pdfs && assets.pdfs.length > 0) {
        setActiveMediaTab("pdf");
      }
    }
  }, [activeChannel, data, formState]);

  const currentPost = data?.posts.find((p) => p.channel === activeChannel);
  const currentForm = formState[activeChannel] || {
    title: "",
    body: "",
    postType: "feed",
    zernioProfileId: "",
  };

  const handleFormChange = (field: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [activeChannel]: {
        ...(prev[activeChannel] || {
          title: "",
          body: "",
          postType: "feed",
          zernioProfileId: "",
        }),
        [field]: value,
      },
    }));
  };

  // Save draft mutation
  const savePostMutation = useMutation({
    mutationFn: async () => {
      if (!currentPost) return;
      const res = await fetch(`/api/posts/${currentPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentForm),
      });
      if (!res.ok) throw new Error("Failed to save changes");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-detail", id] });
      setToastMessage({ text: "Draft changes saved!", type: "success" });
      setTimeout(() => setToastMessage(null), 3000);
    },
    onError: (err: any) => {
      setToastMessage({
        text: err.message || "Failed to save draft",
        type: "error",
      });
      setTimeout(() => setToastMessage(null), 4000);
    },
  });

  // Publish post mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!currentPost) return;
      // First save current form
      const saveRes = await fetch(`/api/posts/${currentPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentForm),
      });
      if (!saveRes.ok) {
        const errJson = await saveRes.json();
        throw new Error(errJson.error || "Failed to save draft before publishing");
      }

      const res = await fetch("/api/zernio/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: currentPost.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Publishing failed");
      return json;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["content-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["content-items"] });
      setToastMessage({
        text: res.message || `Published to ${activeChannel}!`,
        type: "success",
      });
      setTimeout(() => setToastMessage(null), 4000);
    },
    onError: (err: any) => {
      setToastMessage({
        text: err.message || "Publishing failed",
        type: "error",
      });
      setTimeout(() => setToastMessage(null), 5000);
    },
  });

  // Mark as Done and rename folder on OneDrive mutation
  const markDoneMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/zernio/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentItemId: id, markDoneOnly: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to mark as done");
      return json;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["content-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["content-items"] });
      setToastMessage({
        text: res.message || "Marked as Done & renamed folder on OneDrive!",
        type: "success",
      });
      setTimeout(() => setToastMessage(null), 4000);
    },
    onError: (err: any) => {
      setToastMessage({
        text: err.message || "Failed to mark as done",
        type: "error",
      });
      setTimeout(() => setToastMessage(null), 4000);
    },
  });

  // Revert / Unmark as Done mutation
  const unmarkDoneMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/content/${id}/unmark-done`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to revert folder");
      return json;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["content-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["content-items"] });
      setToastMessage({
        text: res.message || "Folder reverted to Unpublished on OneDrive!",
        type: "success",
      });
      setTimeout(() => setToastMessage(null), 4000);
    },
    onError: (err: any) => {
      setToastMessage({
        text: err.message || "Failed to revert folder",
        type: "error",
      });
      setTimeout(() => setToastMessage(null), 4000);
    },
  });

  // Publish all channels mutation
  const publishAllMutation = useMutation({
    mutationFn: async () => {
      if (currentPost) {
        await fetch(`/api/posts/${currentPost.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentForm),
        });
      }

      const res = await fetch("/api/zernio/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentItemId: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to publish all channels");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["content-items"] });
      setToastMessage({
        text: "Published all channels! Checking folder status...",
        type: "success",
      });
      setTimeout(() => setToastMessage(null), 4000);
    },
    onError: (err: any) => {
      setToastMessage({
        text: err.message || "Failed to publish all channels",
        type: "error",
      });
      setTimeout(() => setToastMessage(null), 5000);
    },
  });

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-slate-800 rounded" />
        <div className="h-12 w-3/4 bg-slate-800 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-slate-900 rounded-2xl" />
          <div className="h-96 bg-slate-900 rounded-2xl" />
        </div>
      </div>
    );
  }

  const { item, assets, posts } = data;
  const slides = assets.slides || [];
  const hyperframesVideo = assets.hyperframesVideo;
  const allVideos: any[] = [];
  if (hyperframesVideo) {
    allVideos.push(hyperframesVideo);
  }
  (assets.videos || []).forEach((v: any) => {
    if (!allVideos.some((x) => x.id === v.id)) {
      allVideos.push(v);
    }
  });
  const activeVideo = allVideos.find((v) => v.id === selectedVideoId) || allVideos[0];
  const pdfFile = assets.pdfs?.[0] || null;
  const coverFile = assets.coverFile || null;

  // Filter profiles & active connections for this channel
  const matchingProfiles: Array<{
    id: string;
    profileId: string;
    profileName: string;
    accountName: string;
    handle?: string | null;
    avatar?: string | null;
  }> = [];

  (accountsData || []).forEach((acc: any) => {
    (acc.profiles || []).forEach((p: any) => {
      // Check connections inside profile
      if (Array.isArray(p.connections) && p.connections.length > 0) {
        p.connections.forEach((conn: any) => {
          if (conn.platform?.toLowerCase() === activeChannel.toLowerCase() && conn.isActive) {
            matchingProfiles.push({
              id: conn.id,
              profileId: conn.connectionId,
              profileName: conn.displayName || conn.username || p.name,
              handle: conn.username,
              avatar: conn.profilePicture,
              accountName: `${acc.name} • ${p.name}`,
            });
          }
        });
      } else if (p.platform?.toLowerCase() === activeChannel.toLowerCase()) {
        matchingProfiles.push({
          id: p.id,
          profileId: p.profileId,
          profileName: p.profileName || `${acc.name} - ${p.platform}`,
          accountName: acc.name,
          avatar: p.profileAvatar,
        });
      }
    });
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl border text-xs font-medium flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200 ${
            toastMessage.type === "success"
              ? "bg-slate-900 text-emerald-400 border-emerald-500/30"
              : "bg-slate-900 text-rose-400 border-rose-500/30"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Navigation & Header */}
      <div className="flex flex-col gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <Folder className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-mono text-xs font-semibold text-slate-300">
                {item.folderName}
              </span>
              <span
                className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${
                  item.isDone === 1
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}
              >
                {item.isDone === 1 ? "Published (-Done)" : "Unpublished"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
              {item.title || item.originalFolderName}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {item.folderPath && (
              <a
                href={item.folderPath}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-800 transition-colors"
              >
                <span>Open in OneDrive</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            )}

            {item.isDone === 0 && (
              <>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Publish this content across all configured social channels (YouTube, LinkedIn, Instagram, Facebook)?`
                      )
                    ) {
                      publishAllMutation.mutate();
                    }
                  }}
                  disabled={publishAllMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all disabled:opacity-50"
                >
                  {publishAllMutation.isPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Publish All Channels</span>
                </button>

                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Mark this folder as published and rename to "${item.originalFolderName}-Done" on OneDrive?`
                      )
                    ) {
                      markDoneMutation.mutate();
                    }
                  }}
                  disabled={markDoneMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  {markDoneMutation.isPending ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Mark as Done (-Done)</span>
                </button>
              </>
            )}

            {item.isDone === 1 && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      `Revert this folder to Unpublished and remove "-Done" suffix on OneDrive?`
                    )
                  ) {
                    unmarkDoneMutation.mutate();
                  }
                }}
                disabled={unmarkDoneMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-all disabled:opacity-50"
              >
                {unmarkDoneMutation.isPending ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>Revert to Unpublished</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Channel Switcher Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800/80 scrollbar-none">
        {(
          [
            { id: "linkedin", name: "LinkedIn", badge: "PDF / Video" },
            { id: "youtube", name: "YouTube", badge: "Shorts / Video" },
            { id: "instagram", name: "Instagram", badge: "Reel / Carousel" },
            { id: "facebook", name: "Facebook", badge: "Reel / Feed" },
            { id: "skool", name: "Skool", badge: "Manual Copy" },
          ] as const
        ).map((tab) => {
          const post = posts.find((p) => p.channel === tab.id);
          const isPublished = post?.status === "published";
          const isFailed = post?.status === "failed";

          return (
            <button
              key={tab.id}
              onClick={() => setActiveChannel(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                activeChannel === tab.id
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/25"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <span>{tab.name}</span>
              {isPublished ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              ) : isFailed ? (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              ) : null}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  activeChannel === tab.id
                    ? "bg-indigo-700 text-indigo-100"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Split Layout: Media Preview & Post Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Media Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Folder Media Assets
              </span>
              <span className="text-slate-500 text-[11px]">
                {slides.length} slides • {allVideos.length} videos • {assets.pdfs.length} pdfs
              </span>
            </div>

            {/* Media Type Tabs Switcher */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
              {slides.length > 0 && (
                <button
                  id="media-tab-slides"
                  type="button"
                  onClick={() => setActiveMediaTab("slides")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                    activeMediaTab === "slides"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Slides</span>
                  <span className="text-[10px] opacity-75">({slides.length})</span>
                </button>
              )}
              {allVideos.length > 0 && (
                <button
                  id="media-tab-video"
                  type="button"
                  onClick={() => setActiveMediaTab("video")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                    activeMediaTab === "video"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Video</span>
                  <span className="text-[10px] opacity-75">({allVideos.length})</span>
                </button>
              )}
              {pdfFile && (
                <button
                  id="media-tab-pdf"
                  type="button"
                  onClick={() => setActiveMediaTab("pdf")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                    activeMediaTab === "pdf"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
              )}
              {coverFile && (
                <button
                  id="media-tab-cover"
                  type="button"
                  onClick={() => setActiveMediaTab("cover")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                    activeMediaTab === "cover"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Cover</span>
                </button>
              )}
            </div>

            {/* TAB CONTENT: 1. Slides Carousel */}
            {activeMediaTab === "slides" && slides.length > 0 && (
              <div className="space-y-3">
                <div className="relative aspect-[4/5] sm:aspect-square bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
                  {slides[currentSlideIndex]?.downloadUrl ? (
                    <img
                      id="slide-preview-image"
                      src={slides[currentSlideIndex].downloadUrl}
                      alt={`Slide ${currentSlideIndex + 1}`}
                      className="w-full h-full object-contain p-2 select-none"
                    />
                  ) : (
                    <div className="text-center p-6 text-slate-500">
                      <Layers className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Slide preview loading...</p>
                    </div>
                  )}

                  {/* Navigation controls */}
                  <button
                    id="slide-prev-btn"
                    type="button"
                    onClick={() =>
                      setCurrentSlideIndex((prev) =>
                        prev > 0 ? prev - 1 : slides.length - 1
                      )
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur transition-all shadow-lg"
                    title="Previous Slide"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    id="slide-next-btn"
                    type="button"
                    onClick={() =>
                      setCurrentSlideIndex((prev) =>
                        prev < slides.length - 1 ? prev + 1 : 0
                      )
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur transition-all shadow-lg"
                    title="Next Slide"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="absolute bottom-2 left-1/2 -translate-y-1/2 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur text-[10px] text-white font-mono shadow">
                    Slide {currentSlideIndex + 1} of {slides.length}
                  </div>
                </div>

                {/* Thumbnails rail */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                  {slides.map((s, idx) => (
                    <button
                      key={s.id}
                      id={`slide-thumb-${idx}`}
                      type="button"
                      onClick={() => setCurrentSlideIndex(idx)}
                      className={`shrink-0 w-12 h-14 rounded-lg overflow-hidden border transition-all ${
                        currentSlideIndex === idx
                          ? "border-indigo-500 ring-2 ring-indigo-500/30 scale-105"
                          : "border-slate-800 opacity-60 hover:opacity-100"
                      }`}
                    >
                      {s.downloadUrl ? (
                        <img
                          src={s.downloadUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center text-[10px] text-slate-500">
                          {idx + 1}
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Slide Info & Quick Actions */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1 border-t border-slate-800/60">
                  <span className="font-mono truncate max-w-[200px]">
                    {slides[currentSlideIndex]?.name}
                  </span>
                  {slides[currentSlideIndex]?.downloadUrl && (
                    <a
                      href={slides[currentSlideIndex].downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      <span>Full view</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: 2. Video Player */}
            {activeMediaTab === "video" && allVideos.length > 0 && activeVideo && (
              <div className="space-y-3">
                {/* Video Selector if multiple videos */}
                {allVideos.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {allVideos.map((v) => (
                      <button
                        key={v.id}
                        id={`video-select-${v.id}`}
                        type="button"
                        onClick={() => setSelectedVideoId(v.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 shrink-0 ${
                          activeVideo.id === v.id
                            ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                        }`}
                      >
                        <Play className="w-3 h-3" />
                        <span className="truncate max-w-[140px]">{v.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Video Player */}
                <div className="aspect-[9/16] max-h-[440px] mx-auto bg-black rounded-xl overflow-hidden border border-slate-800 relative flex items-center justify-center shadow-lg">
                  {activeVideo.downloadUrl ? (
                    <video
                      id="video-player"
                      key={activeVideo.id}
                      src={activeVideo.downloadUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                      <Play className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-xs">Video preview loading...</p>
                    </div>
                  )}
                </div>

                {/* Video Info & Download */}
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate font-mono">
                      {activeVideo.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {activeVideo.name.includes("-hyperframes") ? "Hyperframes Vertical Video" : "Video Asset"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={`${activeVideo.downloadUrl}&download=1`}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium border border-indigo-500/30 flex items-center gap-1"
                      title="Download Video"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 3. PDF Document Viewer */}
            {activeMediaTab === "pdf" && pdfFile && (
              <div className="space-y-3">
                <div className="relative aspect-[4/5] sm:aspect-square bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex flex-col shadow-inner">
                  {pdfFile.downloadUrl ? (
                    <object
                      id="pdf-object-viewer"
                      data={`${pdfFile.downloadUrl}#toolbar=0&navpanes=0`}
                      type="application/pdf"
                      className="w-full h-full rounded-xl"
                    >
                      <iframe
                        id="pdf-preview-frame"
                        src={`${pdfFile.downloadUrl}#toolbar=0&navpanes=0`}
                        title={pdfFile.name}
                        className="w-full h-full border-0 bg-white/5 rounded-xl"
                      />
                    </object>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500">
                      <FileText className="w-10 h-10 mb-2 opacity-50 text-blue-400" />
                      <p className="text-xs">PDF preview not available</p>
                    </div>
                  )}
                </div>

                {/* PDF Info & Download Bar */}
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate font-mono">
                      {pdfFile.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      LinkedIn Native Document Carousel
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {slides.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveMediaTab("slides")}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium border border-indigo-500/30 flex items-center gap-1"
                        title="View slides carousel"
                      >
                        <Layers className="w-3 h-3" />
                        <span>Slides ({slides.length})</span>
                      </button>
                    )}
                    <a
                      href={pdfFile.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1"
                      title="Open in new window"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={`${pdfFile.downloadUrl}&download=1`}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium border border-indigo-500/30 flex items-center gap-1"
                      title="Download PDF"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 4. Cover Image */}
            {activeMediaTab === "cover" && coverFile && (
              <div className="space-y-3">
                <div className="relative aspect-[16/9] sm:aspect-square bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
                  {coverFile.downloadUrl ? (
                    <img
                      src={coverFile.downloadUrl}
                      alt={coverFile.name}
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <div className="text-center p-6 text-slate-500">
                      <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Cover preview not available</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate font-mono">
                      {coverFile.name}
                    </p>
                    <p className="text-[11px] text-slate-500">Cover Graphic</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={coverFile.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1"
                      title="Open in new window"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={`${coverFile.downloadUrl}&download=1`}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium border border-indigo-500/30 flex items-center gap-1"
                      title="Download Cover"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state if folder has no media files */}
            {slides.length === 0 && allVideos.length === 0 && !pdfFile && !coverFile && (
              <div className="p-8 text-center text-slate-500 text-xs">
                No media files (slides, video, pdf, or cover) found in this folder.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Per-Channel Post Editor (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
            {/* Channel header & status badge */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white capitalize">
                  {activeChannel} Post Configuration
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    currentPost?.status === "published"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : currentPost?.status === "failed"
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      : currentPost?.status === "publishing"
                      ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {currentPost?.status || "draft"}
                </span>
              </div>

              {/* Skool manual actions */}
              {activeChannel === "skool" && (
                <a
                  href="https://www.skool.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium"
                >
                  <span>Open Skool</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Error banner if previous publish failed */}
            {currentPost?.errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{currentPost.errorMessage}</span>
              </div>
            )}

            {/* Title field (where applicable) */}
            {activeChannel !== "instagram" && activeChannel !== "facebook" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Post Title / Heading
                  </label>
                  {activeChannel === "skool" && (
                    <button
                      onClick={() =>
                        copyToClipboard(currentForm.title, "title")
                      }
                      className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300"
                    >
                      {copiedField === "title" ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Title</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={currentForm.title}
                  onChange={(e) => handleFormChange("title", e.target.value)}
                  placeholder="Enter compelling post headline..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Post Type Selector (Instagram / Facebook / LinkedIn) */}
            {(activeChannel === "instagram" ||
              activeChannel === "facebook" ||
              activeChannel === "linkedin") && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Media / Publication Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {activeChannel === "linkedin" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleFormChange("postType", "document")}
                        className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                          currentForm.postType === "document"
                            ? "bg-indigo-600/20 text-indigo-300 border-indigo-500"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        📄 Document (PDF)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormChange("postType", "video")}
                        className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                          currentForm.postType === "video"
                            ? "bg-indigo-600/20 text-indigo-300 border-indigo-500"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        📹 Video Post
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormChange("postType", "feed")}
                        className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                          currentForm.postType === "feed"
                            ? "bg-indigo-600/20 text-indigo-300 border-indigo-500"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        📝 Text Only
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleFormChange("postType", "reel")}
                        className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                          currentForm.postType === "reel"
                            ? "bg-indigo-600/20 text-indigo-300 border-indigo-500"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        ⚡ Video Reel
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleFormChange("postType", "carousel")
                        }
                        className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                          currentForm.postType === "carousel"
                            ? "bg-indigo-600/20 text-indigo-300 border-indigo-500"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        🖼️ Slide Carousel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormChange("postType", "feed")}
                        className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                          currentForm.postType === "feed"
                            ? "bg-indigo-600/20 text-indigo-300 border-indigo-500"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        📰 Standard Feed
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Body / Description Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">
                  {activeChannel === "youtube"
                    ? "Video Description"
                    : "Post Content / Caption"}
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500">
                    {currentForm.body.length} characters
                  </span>
                  {activeChannel === "skool" && (
                    <button
                      onClick={() => copyToClipboard(currentForm.body, "body")}
                      className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300"
                    >
                      {copiedField === "body" ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Body</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              <textarea
                rows={9}
                value={currentForm.body}
                onChange={(e) => handleFormChange("body", e.target.value)}
                placeholder="Write post content..."
                className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans resize-y"
              />
            </div>

            {/* Target Zernio Social Profile (except Skool) */}
            {activeChannel !== "skool" && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Publishing As Profile
                </label>
                {matchingProfiles.length > 0 ? (
                  <select
                    value={currentForm.zernioProfileId}
                    onChange={(e) =>
                      handleFormChange("zernioProfileId", e.target.value)
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">
                      Default ({matchingProfiles[0].profileName}
                      {matchingProfiles[0].handle ? ` - @${matchingProfiles[0].handle.replace(/^@/, "")}` : ""})
                    </option>
                    {matchingProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.accountName} → {p.profileName}
                        {p.handle ? ` (@${p.handle.replace(/^@/, "")})` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
                    <span>No active connected {activeChannel} channel found in Zernio</span>
                    <Link
                      href="/settings/zernio"
                      className="text-xs underline font-medium hover:text-white"
                    >
                      Connect Channel in Settings
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Actions Bar */}
            <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                disabled={savePostMutation.isPending}
                onClick={() => savePostMutation.mutate()}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
              >
                {savePostMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>Save Draft</span>
              </button>

              {activeChannel !== "skool" ? (
                <button
                  type="button"
                  disabled={publishMutation.isPending}
                  onClick={() => publishMutation.mutate()}
                  className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
                >
                  {publishMutation.isPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Publish to {activeChannel}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      copyToClipboard(
                        `${currentForm.title}\n\n${currentForm.body}`,
                        "all"
                      );
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-medium border border-amber-500/30 transition-all"
                  >
                    {copiedField === "all" ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {copiedField === "all"
                        ? "Copied Full Post!"
                        : "Copy Title & Body"}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
