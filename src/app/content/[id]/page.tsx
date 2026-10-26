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
          zernioProfileId: p.zernioProfileId || "",
        };
      });
      setFormState(initial);
    }
  }, [data]);

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
      await fetch(`/api/posts/${currentPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentForm),
      });

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
  const regularVideo = assets.videos.find((v) => v.id !== hyperframesVideo?.id);
  const pdfFile = assets.pdfs[0];

  // Filter profiles for this channel
  const matchingProfiles: Array<{
    id: string;
    profileId: string;
    profileName: string;
    accountName: string;
  }> = [];

  (accountsData || []).forEach((acc) => {
    (acc.profiles || []).forEach((p: any) => {
      if (p.platform?.toLowerCase() === activeChannel.toLowerCase()) {
        matchingProfiles.push({
          id: p.id,
          profileId: p.profileId,
          profileName: p.profileName || `${acc.name} - ${p.platform}`,
          accountName: acc.name,
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
                {slides.length} slides • {assets.videos.length} videos • {assets.pdfs.length} pdfs
              </span>
            </div>

            {/* Carousel / Slide Preview (for Instagram, Facebook, or when viewing slides) */}
            {slides.length > 0 &&
            (activeChannel === "instagram" ||
              activeChannel === "facebook" ||
              currentForm.postType === "carousel" ||
              (!hyperframesVideo && !pdfFile)) ? (
              <div className="space-y-3">
                <div className="relative aspect-[4/5] sm:aspect-square bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                  {slides[currentSlideIndex]?.downloadUrl ? (
                    <img
                      src={slides[currentSlideIndex].downloadUrl}
                      alt={`Slide ${currentSlideIndex + 1}`}
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <div className="text-center p-6 text-slate-500">
                      <Layers className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Slide preview loading...</p>
                    </div>
                  )}

                  {/* Navigation controls */}
                  <button
                    onClick={() =>
                      setCurrentSlideIndex((prev) =>
                        prev > 0 ? prev - 1 : slides.length - 1
                      )
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() =>
                      setCurrentSlideIndex((prev) =>
                        prev < slides.length - 1 ? prev + 1 : 0
                      )
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="absolute bottom-2 left-1/2 -translate-y-1/2 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur text-[10px] text-white font-mono">
                    Slide {currentSlideIndex + 1} of {slides.length}
                  </div>
                </div>

                {/* Thumbnails rail */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                  {slides.map((s, idx) => (
                    <button
                      key={s.id}
                      onClick={() => setCurrentSlideIndex(idx)}
                      className={`shrink-0 w-12 h-14 rounded-lg overflow-hidden border transition-all ${
                        currentSlideIndex === idx
                          ? "border-indigo-500 ring-2 ring-indigo-500/30"
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
              </div>
            ) : hyperframesVideo ? (
              /* Video Preview (for YouTube, Instagram Reels, Facebook Reels) */
              <div className="space-y-2">
                <div className="aspect-[9/16] max-h-96 mx-auto bg-black rounded-xl overflow-hidden border border-slate-800 relative">
                  {hyperframesVideo.downloadUrl ? (
                    <video
                      src={hyperframesVideo.downloadUrl}
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                      <Play className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-xs">Hyperframes Video</p>
                      <p className="text-[10px] font-mono mt-1 text-slate-600">
                        {hyperframesVideo.name}
                      </p>
                    </div>
                  )}
                </div>
                <div className="text-[11px] font-mono text-slate-400 text-center">
                  📹 {hyperframesVideo.name}
                </div>
              </div>
            ) : pdfFile ? (
              /* PDF Document Card (LinkedIn native carousel) */
              <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">
                    {pdfFile.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    LinkedIn Native Document Carousel
                  </p>
                </div>
                {pdfFile.downloadUrl && (
                  <a
                    href={pdfFile.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
                  >
                    <span>Download / View PDF</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">
                No media file available for preview.
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
                    <option value="">Default ({matchingProfiles[0].profileName})</option>
                    {matchingProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.accountName} • {p.profileName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
                    <span>No connected {activeChannel} profile in Zernio</span>
                    <Link
                      href="/settings/zernio"
                      className="text-xs underline font-medium hover:text-white"
                    >
                      Connect Profile
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
