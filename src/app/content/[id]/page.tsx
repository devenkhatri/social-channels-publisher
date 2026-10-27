"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Clock,
  Save,
  RefreshCw,
  Sparkles,
  Shield,
  Play,
  Share2,
  RotateCcw,
  Image as ImageIcon,
  Download,
  Link2,
} from "lucide-react";
import { parseThreadItems } from "@/services/extractor";

type ChannelType =
  | "linkedin"
  | "linkedin_page"
  | "threads"
  | "youtube"
  | "instagram"
  | "facebook"
  | "skool";

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
  navigation?: {
    prevId: string | null;
    prevTitle: string | null;
    nextId: string | null;
    nextTitle: string | null;
    currentIndex: number;
    totalCount: number;
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
    facebookFile?: any;
    youtubeFile?: any;
    instagramFile?: any;
    twitterFile?: any;
    threadsFile?: any;
    captionFile: any;
    linkedinFile: any;
    skoolFile: any;
    coverPromptFile: any;
    coverFile: any;
    hyperframesVideo: any;
    videos: any[];
    pdfs: any[];
    slides: SlideItem[];
    youtubeData?: {
      titleOptions?: string[];
      tags?: string[];
    };
  };
}

export default function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
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

  // Live publishing progress state for transparent per-channel feedback
  const [publishProgress, setPublishProgress] = useState<{
    isActive: boolean;
    currentChannel?: string;
    step: number;
    total: number;
  }>({
    isActive: false,
    step: 0,
    total: 0,
  });

  // Swipe gesture detection on mobile to navigate between content records
  const [touchCoords, setTouchCoords] = useState<{ x: number; y: number } | null>(null);

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

  // Handle mobile swipe start
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("textarea") ||
      target.closest("input") ||
      target.closest("button") ||
      target.closest("#slide-prev-btn") ||
      target.closest("#slide-next-btn")
    ) {
      setTouchCoords(null);
      return;
    }
    setTouchCoords({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    });
  };

  // Handle mobile swipe end
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchCoords || !data?.navigation) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - touchCoords.x;
    const dy = endY - touchCoords.y;

    // Minimum horizontal movement of 60px, must be mostly horizontal
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0 && data.navigation.nextId) {
        // Swiped Left -> Navigate to Next post
        setToastMessage({
          text: `Navigating to next post...`,
          type: "success",
        });
        router.push(`/content/${data.navigation.nextId}`);
      } else if (dx > 0 && data.navigation.prevId) {
        // Swiped Right -> Navigate to Previous post
        setToastMessage({
          text: `Navigating to previous post...`,
          type: "success",
        });
        router.push(`/content/${data.navigation.prevId}`);
      }
    }
    setTouchCoords(null);
  };

  // Populate form states once data is loaded
  useEffect(() => {
    if (data?.posts) {
      const initial: any = {};
      data.posts.forEach((p) => {
        let postType = p.postType;
        if (!postType) {
          if (p.channel === "linkedin" || p.channel === "linkedin_page") postType = "document";
          else if (p.channel === "youtube" || p.channel === "instagram" || p.channel === "facebook") postType = "reel";
          else postType = "feed";
        }
        if (p.channel === "threads" && postType === "carousel") {
          postType = "feed";
        }
        initial[p.channel] = {
          title: p.title || "",
          body: p.body || "",
          postType,
          zernioProfileId: (p as any).zernioConnectionId || p.zernioProfileId || "",
        };
      });

      // Ensure LinkedIn Business Page uses the same content as LinkedIn Personal
      if (initial.linkedin && initial.linkedin_page) {
        if (initial.linkedin.body || initial.linkedin.title) {
          initial.linkedin_page.title = initial.linkedin.title;
          initial.linkedin_page.body = initial.linkedin.body;
          initial.linkedin_page.postType = initial.linkedin.postType;
        } else if (initial.linkedin_page.body || initial.linkedin_page.title) {
          initial.linkedin.title = initial.linkedin_page.title;
          initial.linkedin.body = initial.linkedin_page.body;
          initial.linkedin.postType = initial.linkedin_page.postType;
        }
      }

      setFormState(initial);
    }
  }, [data]);

  // Set default media tab when activeChannel or data changes
  useEffect(() => {
    if (!data?.assets) return;
    const { assets } = data;
    const currentPostType = formState[activeChannel]?.postType;

    if (activeChannel === "linkedin" || activeChannel === "linkedin_page") {
      // PDF is default for LinkedIn
      if (assets.pdfs && assets.pdfs.length > 0) {
        setActiveMediaTab("pdf");
      } else if (assets.hyperframesVideo || (assets.videos && assets.videos.length > 0)) {
        setActiveMediaTab("video");
      } else if (assets.slides && assets.slides.length > 0) {
        setActiveMediaTab("slides");
      }
    } else if (activeChannel === "youtube" || activeChannel === "instagram" || activeChannel === "facebook") {
      // Hyperframe video is default for YouTube, Instagram, Facebook
      if (assets.hyperframesVideo || (assets.videos && assets.videos.length > 0)) {
        setActiveMediaTab("video");
      } else if (assets.slides && assets.slides.length > 0) {
        setActiveMediaTab("slides");
      }
    } else if (activeChannel === "threads") {
      // Text-only is default for Threads
      if (currentPostType === "video" && (assets.hyperframesVideo || (assets.videos && assets.videos.length > 0))) {
        setActiveMediaTab("video");
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
    setFormState((prev) => {
      const updatedChannelState = {
        ...(prev[activeChannel] || {
          title: "",
          body: "",
          postType: "feed",
          zernioProfileId: "",
        }),
        [field]: value,
      };

      const next = {
        ...prev,
        [activeChannel]: updatedChannelState,
      };

      // Keep LinkedIn Personal and LinkedIn Business Page content in sync
      if (field !== "zernioProfileId") {
        if (activeChannel === "linkedin") {
          next.linkedin_page = {
            ...(prev.linkedin_page || {
              title: "",
              body: "",
              postType: "feed",
              zernioProfileId: "",
            }),
            [field]: value,
          };
        } else if (activeChannel === "linkedin_page") {
          next.linkedin = {
            ...(prev.linkedin || {
              title: "",
              body: "",
              postType: "feed",
              zernioProfileId: "",
            }),
            [field]: value,
          };
        }
      }

      return next;
    });
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

      // If saving LinkedIn or LinkedIn Page, also save the other channel post to keep database in sync
      if (activeChannel === "linkedin" || activeChannel === "linkedin_page") {
        const otherChannel = activeChannel === "linkedin" ? "linkedin_page" : "linkedin";
        const otherPost = data?.posts.find((p) => p.channel === otherChannel);
        const otherForm = formState[otherChannel];
        if (otherPost && otherForm) {
          await fetch(`/api/posts/${otherPost.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(otherForm),
          });
        }
      }

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

      // If publishing LinkedIn or LinkedIn Page, also save the other channel post
      if (activeChannel === "linkedin" || activeChannel === "linkedin_page") {
        const otherChannel = activeChannel === "linkedin" ? "linkedin_page" : "linkedin";
        const otherPost = data?.posts.find((p) => p.channel === otherChannel);
        const otherForm = formState[otherChannel];
        if (otherPost && otherForm) {
          await fetch(`/api/posts/${otherPost.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(otherForm),
          });
        }
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

  // Publish all pending channels sequentially with real-time per-channel progress and toast feedback
  const handlePublishAll = async () => {
    if (!data?.posts) return;

    // 1. Save currently active post edits first
    if (currentPost) {
      try {
        await fetch(`/api/posts/${currentPost.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentForm),
        });
      } catch (err) {
        console.warn("Could not auto-save current post before publishing:", err);
      }
    }

    const pendingPosts = data.posts.filter(
      (p) => p.status !== "published" && p.status !== "scheduled"
    );

    if (pendingPosts.length === 0) {
      setToastMessage({
        text: "All channels are already published or queued.",
        type: "success",
      });
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const channelNameMap: Record<string, string> = {
      linkedin: "LinkedIn (Personal)",
      linkedin_page: "LinkedIn (Business Page)",
      threads: "Threads",
      youtube: "YouTube Shorts",
      instagram: "Instagram",
      facebook: "Facebook",
      skool: "Skool",
    };

    setPublishProgress({
      isActive: true,
      currentChannel: channelNameMap[pendingPosts[0].channel] || pendingPosts[0].channel,
      step: 1,
      total: pendingPosts.length,
    });

    let successCount = 0;
    const failedChannels: string[] = [];

    for (let i = 0; i < pendingPosts.length; i++) {
      const p = pendingPosts[i];
      const chName = channelNameMap[p.channel] || p.channel;

      setPublishProgress({
        isActive: true,
        currentChannel: chName,
        step: i + 1,
        total: pendingPosts.length,
      });

      setToastMessage({
        text: `Publishing [${i + 1}/${pendingPosts.length}]: ${chName}...`,
        type: "success",
      });

      try {
        const res = await fetch("/api/zernio/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: p.id }),
        });
        const json = await res.json();
        if (!res.ok || json.success === false) {
          throw new Error(json.error || `Failed to publish to ${chName}`);
        }
        successCount++;
        // Invalidate immediately so this channel's checklist card turns green in real time!
        await queryClient.invalidateQueries({ queryKey: ["content-detail", id] });
      } catch (err: any) {
        console.error(`Error publishing to ${chName}:`, err);
        failedChannels.push(chName);
        await queryClient.invalidateQueries({ queryKey: ["content-detail", id] });
      }
    }

    setPublishProgress({
      isActive: false,
      step: pendingPosts.length,
      total: pendingPosts.length,
    });

    await queryClient.invalidateQueries({ queryKey: ["content-detail", id] });
    await queryClient.invalidateQueries({ queryKey: ["content-items"] });

    if (failedChannels.length === 0) {
      setToastMessage({
        text: `✓ All ${successCount} channels published! Folder marked -Done on OneDrive.`,
        type: "success",
      });
      setTimeout(() => setToastMessage(null), 6000);
    } else {
      setToastMessage({
        text: `Published ${successCount} channel${successCount > 1 ? "s" : ""}, but ${failedChannels.length} failed: ${failedChannels.join(", ")}`,
        type: "error",
      });
      setTimeout(() => setToastMessage(null), 8000);
    }
  };

  // Single channel status manual toggle mutation (e.g. Mark as Done / Undo)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ postId, status }: { postId: string; status: "draft" | "published" }) => {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update channel status");
      return json;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["content-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["content-items"] });
      setToastMessage({
        text: variables.status === "published" ? "Channel marked as Published!" : "Channel reset to Pending.",
        type: "success",
      });
      setTimeout(() => setToastMessage(null), 3500);
    },
    onError: (err: any) => {
      setToastMessage({
        text: err.message || "Failed to update channel status",
        type: "error",
      });
      setTimeout(() => setToastMessage(null), 4000);
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
        <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-12 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl" />
          <div className="h-96 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl" />
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

  interface ChannelListItem {
    id: ChannelType;
    name: string;
    shortName: string;
    badge: string;
    shortLabel: string;
  }

  const channelList: ChannelListItem[] = [
    { id: "linkedin", name: "LinkedIn", shortName: "LinkedIn", badge: "Personal", shortLabel: "LI" },
    { id: "linkedin_page", name: "LinkedIn Page", shortName: "LI Page", badge: "Business", shortLabel: "LP" },
    { id: "threads", name: "Threads", shortName: "Threads", badge: "Post", shortLabel: "TH" },
    { id: "youtube", name: "YouTube", shortName: "YouTube", badge: "Shorts / Video", shortLabel: "YT" },
    { id: "instagram", name: "Instagram", shortName: "Instagram", badge: "Reel / Carousel", shortLabel: "IG" },
    { id: "facebook", name: "Facebook", shortName: "Facebook", badge: "Reel / Feed", shortLabel: "FB" },
    { id: "skool", name: "Skool", shortName: "Skool", badge: "Manual Copy", shortLabel: "SK" },
  ];

  const publishedPosts = posts.filter((p) => p.status === "published");
  const scheduledPosts = posts.filter((p) => p.status === "scheduled");
  const failedPosts = posts.filter((p) => p.status === "failed");
  const pendingPosts = posts.filter((p) => p.status !== "published" && p.status !== "scheduled");
  const publishedCount = publishedPosts.length;
  const scheduledCount = scheduledPosts.length;
  const failedCount = failedPosts.length;
  const pendingCount = pendingPosts.length;
  const totalChannels = channelList.length;

  const sourceFileBadge = (() => {
    if (activeChannel === "facebook") {
      return assets.facebookFile ? assets.facebookFile.name : (assets.captionFile ? "caption.md (fallback)" : null);
    }
    if (activeChannel === "youtube") {
      return assets.youtubeFile ? assets.youtubeFile.name : (assets.captionFile ? "caption.md (fallback)" : null);
    }
    if (activeChannel === "instagram") {
      return assets.instagramFile ? assets.instagramFile.name : (assets.captionFile ? "caption.md (fallback)" : null);
    }
    if (activeChannel === "threads") {
      return assets.twitterFile ? assets.twitterFile.name : (assets.captionFile ? "caption.md (fallback)" : null);
    }
    if (activeChannel === "linkedin") {
      return assets.linkedinFile ? assets.linkedinFile.name : (assets.captionFile ? "caption.md (fallback)" : null);
    }
    if (activeChannel === "linkedin_page") {
      return "Mirrored from LinkedIn";
    }
    if (activeChannel === "skool") {
      return assets.skoolFile ? assets.skoolFile.name : (assets.captionFile ? "caption.md (fallback)" : null);
    }
    return null;
  })();

  // Filter profiles & active connections for this channel
  const matchingProfiles: Array<{
    id: string;
    profileId: string;
    profileName: string;
    accountName: string;
    handle?: string | null;
    avatar?: string | null;
    isBusinessPage?: boolean;
  }> = [];

  (accountsData || []).forEach((acc: any) => {
    const accNameLower = (acc.name || "").toLowerCase();
    const isBizAccount =
      accNameLower.includes("biz") ||
      accNameLower.includes("page") ||
      accNameLower.includes("company") ||
      accNameLower.includes("org");

    (acc.profiles || []).forEach((p: any) => {
      // Check connections inside profile
      if (Array.isArray(p.connections) && p.connections.length > 0) {
        p.connections.forEach((conn: any) => {
          const connPlatform = conn.platform?.toLowerCase();
          const displayNameLower = (conn.displayName || "").toLowerCase();
          const usernameLower = (conn.username || "").toLowerCase();
          const isOrgOrPage =
            connPlatform === "linkedin_page" ||
            isBizAccount ||
            Boolean(conn.connectionId?.includes("::")) ||
            displayNameLower.includes("page") ||
            displayNameLower.includes("technolabs") ||
            displayNameLower.includes("company") ||
            usernameLower.includes("page") ||
            usernameLower.includes("company");

          let matches = false;
          if (activeChannel === "linkedin_page") {
            // LinkedIn Company / Business Page can be stored as linkedin_page or standard linkedin
            matches = connPlatform === "linkedin_page" || connPlatform === "linkedin";
          } else if (activeChannel === "threads") {
            matches = connPlatform === "threads";
          } else if (activeChannel === "linkedin") {
            matches = connPlatform === "linkedin" || connPlatform === "linkedin_page";
          } else {
            matches = connPlatform === activeChannel.toLowerCase();
          }

          if (matches && conn.isActive) {
            matchingProfiles.push({
              id: conn.id,
              profileId: conn.connectionId,
              profileName: conn.displayName || conn.username || p.name,
              handle: conn.username,
              avatar: conn.profilePicture,
              accountName: `${acc.name} • ${p.name}`,
              isBusinessPage: isOrgOrPage,
            });
          }
        });
      } else {
        const profPlatform = p.platform?.toLowerCase();
        let matches = false;
        if (activeChannel === "linkedin_page") {
          matches = profPlatform === "linkedin_page" || profPlatform === "linkedin";
        } else if (activeChannel === "threads") {
          matches = profPlatform === "threads";
        } else if (activeChannel === "linkedin") {
          matches = profPlatform === "linkedin" || profPlatform === "linkedin_page";
        } else {
          matches = profPlatform === activeChannel.toLowerCase();
        }

        if (matches) {
          matchingProfiles.push({
            id: p.id,
            profileId: p.profileId,
            profileName: p.profileName || `${acc.name} - ${p.platform}`,
            accountName: acc.name,
            avatar: p.profileAvatar,
            isBusinessPage: isBizAccount,
          });
        }
      }
    });
  });

  // Sort matching profiles so the most relevant one is default (index 0)
  if (activeChannel === "linkedin_page") {
    matchingProfiles.sort((a, b) => {
      if (a.isBusinessPage && !b.isBusinessPage) return -1;
      if (!a.isBusinessPage && b.isBusinessPage) return 1;
      return 0;
    });
  } else if (activeChannel === "linkedin") {
    matchingProfiles.sort((a, b) => {
      if (!a.isBusinessPage && b.isBusinessPage) return -1;
      if (a.isBusinessPage && !b.isBusinessPage) return 1;
      return 0;
    });
  }  return (
    <div
      className="max-w-6xl mx-auto space-y-6 pb-16 transition-colors"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 p-4 rounded-xl shadow-2xl border text-xs font-medium flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200 ${
            toastMessage.type === "success"
              ? "bg-zinc-900 text-emerald-400 dark:bg-zinc-100 dark:text-emerald-700 border-zinc-700 dark:border-zinc-300"
              : "bg-zinc-900 text-rose-400 dark:bg-zinc-100 dark:text-rose-700 border-zinc-700 dark:border-zinc-300"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 dark:text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 dark:text-rose-600" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Live Publishing Progress Card */}
      {publishProgress.isActive && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 p-4 rounded-2xl shadow-2xl border bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-700 dark:border-zinc-300 min-w-[280px] max-w-sm animate-in slide-in-from-bottom-3 duration-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400 dark:text-sky-600 shrink-0" />
              <span>Publishing: {publishProgress.currentChannel}</span>
            </span>
            <span className="font-mono text-[11px] opacity-80">
              {publishProgress.step} of {publishProgress.total}
            </span>
          </div>
          <div className="w-full bg-zinc-800 dark:bg-zinc-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-sky-500 h-full transition-all duration-300"
              style={{
                width: `${Math.round((publishProgress.step / Math.max(1, publishProgress.total)) * 100)}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-600">
            Publishing sequentially across channels with live status updates...
          </p>
        </div>
      )}

      {/* Navigation & Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors w-fit min-h-[32px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>

          {/* Record Prev/Next Navigation Controls */}
          {data?.navigation && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="hidden sm:inline font-mono text-[11px] text-zinc-400 dark:text-zinc-500 mr-1">
                Post {data.navigation.currentIndex} of {data.navigation.totalCount}
              </span>
              <button
                type="button"
                onClick={() =>
                  data.navigation?.prevId && router.push(`/content/${data.navigation.prevId}`)
                }
                disabled={!data.navigation.prevId}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors text-zinc-700 dark:text-zinc-300 font-medium shadow-2xs"
                title={data.navigation.prevTitle ? `Previous post: ${data.navigation.prevTitle}` : "No previous post"}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Prev</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  data.navigation?.nextId && router.push(`/content/${data.navigation.nextId}`)
                }
                disabled={!data.navigation.nextId}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors text-zinc-700 dark:text-zinc-300 font-medium shadow-2xs"
                title={data.navigation.nextTitle ? `Next post: ${data.navigation.nextTitle}` : "No next post"}
              >
                <span className="hidden xs:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <span className="sm:hidden text-[10px] text-zinc-400 font-mono ml-0.5">
                {data.navigation.currentIndex}/{data.navigation.totalCount}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Folder className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {item.folderName}
              </span>
              <span
                className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${
                  item.isDone === 1
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25"
                }`}
              >
                {item.isDone === 1 ? "Published (-Done)" : "Pending"}
              </span>
              <span className="text-[10px] text-zinc-400 sm:hidden">
                (Swipe left/right to move posts)
              </span>
            </div>
            {/* Title with OneDrive Icon Button right beside it */}
            <div className="flex items-center gap-2 mt-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                {item.title || item.originalFolderName}
              </h1>
              {item.folderPath && (
                <a
                  href={item.folderPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 border border-zinc-200 dark:border-zinc-800 transition-colors shadow-2xs shrink-0 flex items-center justify-center"
                  title="Open folder in OneDrive"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Action Buttons Aligned Together */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap justify-start sm:justify-end">
            {item.isDone === 0 && (
              <>
                <button
                  onClick={() => {
                    const confirmMsg =
                      pendingCount < totalChannels && pendingCount > 0
                        ? `Publish the remaining ${pendingCount} pending channel${pendingCount > 1 ? "s" : ""} (${posts.filter(p => p.status !== "published" && p.status !== "scheduled").map(p => p.channel).join(", ")})?`
                        : `Publish this content across all configured social channels?`;
                    if (confirm(confirmMsg)) {
                      handlePublishAll();
                    }
                  }}
                  disabled={publishProgress.isActive || pendingCount === 0}
                  className={`flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50 whitespace-nowrap shrink-0 ${
                    pendingCount === 0
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 cursor-default"
                      : "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900"
                  }`}
                >
                  {publishProgress.isActive ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : pendingCount === 0 ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {publishProgress.isActive
                      ? `Publishing (${publishProgress.step}/${publishProgress.total})...`
                      : pendingCount === 0
                      ? "All Channels Published"
                      : pendingCount < totalChannels
                      ? `Publish Pending (${pendingCount})`
                      : "Publish All Channels"}
                  </span>
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
                  disabled={markDoneMutation.isPending || publishProgress.isActive}
                  className="flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {markDoneMutation.isPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
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
                className="flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium border border-zinc-200 dark:border-zinc-800 transition-all disabled:opacity-50 shadow-xs whitespace-nowrap shrink-0"
              >
                {unmarkDoneMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>Revert to Unpublished</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Channel Publishing Status Tracker & Checklist Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Publish Status
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                  publishedCount === totalChannels
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                    : publishedCount > 0
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                }`}
              >
                {publishedCount === totalChannels ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>All Channels Done (7/7)</span>
                  </>
                ) : (
                  <span>{publishedCount} of {totalChannels} Published</span>
                )}
              </span>
            </div>
            {scheduledCount > 0 && (
              <span className="text-[11px] font-medium text-sky-700 dark:text-sky-300 bg-sky-500/10 border border-sky-500/25 px-2 py-0.5 rounded-full">
                {scheduledCount} Queued
              </span>
            )}
            {failedCount > 0 && (
              <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 rounded-full">
                {failedCount} Failed
              </span>
            )}
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {pendingCount > 0 ? (
              <span>
                <strong className="text-amber-600 dark:text-amber-400 font-semibold">{pendingCount}</strong> channel{pendingCount > 1 ? "s" : ""} pending publish
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> All channels completed
              </span>
            )}
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-zinc-100 dark:bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-800/80">
          <div
            className={`h-full transition-all duration-500 ${
              publishedCount === totalChannels
                ? "bg-emerald-500"
                : publishedCount > 0
                ? "bg-zinc-900 dark:bg-zinc-100"
                : "bg-zinc-300 dark:bg-zinc-700"
            }`}
            style={{ width: `${Math.round((publishedCount / totalChannels) * 100)}%` }}
          />
        </div>

        {/* Channel Switcher & Progress Checklist Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
          {channelList.map((ch) => {
            const post = posts.find((p) => p.channel === ch.id);
            const isPub = post?.status === "published";
            const isSched = post?.status === "scheduled";
            const isFail = post?.status === "failed";
            const isActive = activeChannel === ch.id;

            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveChannel(ch.id)}
                className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between min-h-[52px] ${
                  isActive
                    ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-900 dark:border-zinc-100 ring-2 ring-zinc-900/15 dark:ring-white/20 shadow-xs"
                    : isPub
                    ? "bg-white dark:bg-zinc-900/80 border-emerald-500/30 hover:border-emerald-500/50"
                    : isFail
                    ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50"
                    : isSched
                    ? "bg-sky-50/50 dark:bg-sky-950/20 border-sky-500/30 hover:border-sky-500/50"
                    : "bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {ch.shortName}
                  </span>
                  {isPub ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : isSched ? (
                    <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                  ) : isFail ? (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full border border-zinc-300 dark:border-zinc-600 bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] gap-1">
                  <span
                    className={`font-semibold ${
                      isPub
                        ? "text-emerald-600 dark:text-emerald-400"
                        : isSched
                        ? "text-sky-600 dark:text-sky-400"
                        : isFail
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {isPub ? "Done" : isSched ? "Queued" : isFail ? "Failed" : "Pending"}
                  </span>
                  <span className="text-zinc-400 dark:text-zinc-500 font-mono text-[9px] truncate" title={ch.badge}>
                    {ch.badge}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split Layout: Media Preview & Post Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Media Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              <span className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-zinc-500" />
                Folder Media Assets
              </span>
              <span className="text-zinc-500 text-[11px]">
                {slides.length} slides • {allVideos.length} videos • {assets.pdfs.length} pdfs
              </span>
            </div>

            {/* Media Type Tabs Switcher */}
            <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
              {slides.length > 0 && (
                <button
                  id="media-tab-slides"
                  type="button"
                  onClick={() => setActiveMediaTab("slides")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all min-h-[36px] ${
                    activeMediaTab === "slides"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Slides</span>
                  <span className="text-[10px] opacity-75 font-mono">({slides.length})</span>
                </button>
              )}
              {allVideos.length > 0 && (
                <button
                  id="media-tab-video"
                  type="button"
                  onClick={() => setActiveMediaTab("video")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all min-h-[36px] ${
                    activeMediaTab === "video"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Video</span>
                  <span className="text-[10px] opacity-75 font-mono">({allVideos.length})</span>
                </button>
              )}
              {pdfFile && (
                <button
                  id="media-tab-pdf"
                  type="button"
                  onClick={() => setActiveMediaTab("pdf")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all min-h-[36px] ${
                    activeMediaTab === "pdf"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
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
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all min-h-[36px] ${
                    activeMediaTab === "cover"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
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
                <div className="relative aspect-[4/5] sm:aspect-square bg-zinc-100 dark:bg-zinc-950 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shadow-inner">
                  {slides[currentSlideIndex]?.downloadUrl ? (
                    <img
                      id="slide-preview-image"
                      src={slides[currentSlideIndex].downloadUrl}
                      alt={`Slide ${currentSlideIndex + 1}`}
                      className="w-full h-full object-contain p-2 select-none"
                    />
                  ) : (
                    <div className="text-center p-6 text-zinc-400">
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
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-900 text-white backdrop-blur transition-all shadow-lg min-h-[36px] min-w-[36px] flex items-center justify-center"
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-900 text-white backdrop-blur transition-all shadow-lg min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="Next Slide"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="absolute bottom-2 left-1/2 -translate-y-1/2 px-2.5 py-1 rounded-full bg-zinc-900/80 backdrop-blur text-[10px] text-white font-mono shadow">
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
                          ? "border-zinc-900 dark:border-zinc-100 ring-2 ring-zinc-900/20 dark:ring-zinc-100/20 scale-105"
                          : "border-zinc-200 dark:border-zinc-800 opacity-60 hover:opacity-100"
                      }`}
                    >
                      {s.downloadUrl ? (
                        <img
                          src={s.downloadUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500">
                          {idx + 1}
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Slide Info & Quick Actions */}
                <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-1 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="font-mono truncate max-w-[200px]">
                    {slides[currentSlideIndex]?.name}
                  </span>
                  {slides[currentSlideIndex]?.downloadUrl && (
                    <a
                      href={slides[currentSlideIndex].downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-700 dark:text-zinc-300 hover:underline flex items-center gap-1"
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
                        className={`px-2.5 py-1 min-h-[32px] rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 shrink-0 ${
                          activeVideo.id === v.id
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs"
                            : "bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200"
                        }`}
                      >
                        <Play className="w-3 h-3" />
                        <span className="truncate max-w-[140px]">{v.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Video Player */}
                <div className="aspect-[9/16] max-h-[440px] mx-auto bg-black rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative flex items-center justify-center shadow-md">
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
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 p-6 text-center">
                      <Play className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-xs">Video preview loading...</p>
                    </div>
                  )}
                </div>

                {/* Video Info & Download */}
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate font-mono">
                      {activeVideo.name}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {activeVideo.name.includes("-hyperframes") ? "Hyperframes Vertical Video" : "Video Asset"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={`${activeVideo.downloadUrl}&download=1`}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium flex items-center gap-1 shadow-xs"
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
                <div className="relative aspect-[4/5] sm:aspect-square bg-zinc-100 dark:bg-zinc-950 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col shadow-inner">
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
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-zinc-500">
                      <FileText className="w-10 h-10 mb-2 opacity-50 text-sky-500" />
                      <p className="text-xs">PDF preview not available</p>
                    </div>
                  )}
                </div>

                {/* PDF Info & Download Bar */}
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate font-mono">
                      {pdfFile.name}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      LinkedIn Native Document Carousel
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {slides.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveMediaTab("slides")}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium border border-zinc-200 dark:border-zinc-700 flex items-center gap-1"
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
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium border border-zinc-200 dark:border-zinc-700 flex items-center gap-1"
                      title="Open in new window"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={`${pdfFile.downloadUrl}&download=1`}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium flex items-center gap-1 shadow-xs"
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
                <div className="relative aspect-[16/9] sm:aspect-square bg-zinc-100 dark:bg-zinc-950 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shadow-inner">
                  {coverFile.downloadUrl ? (
                    <img
                      src={coverFile.downloadUrl}
                      alt={coverFile.name}
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <div className="text-center p-6 text-zinc-400">
                      <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Cover preview not available</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate font-mono">
                      {coverFile.name}
                    </p>
                    <p className="text-[11px] text-zinc-500">Cover Graphic</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={coverFile.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium border border-zinc-200 dark:border-zinc-700 flex items-center gap-1"
                      title="Open in new window"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={`${coverFile.downloadUrl}&download=1`}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium flex items-center gap-1 shadow-xs"
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
              <div className="p-8 text-center text-zinc-400 text-xs">
                No media files (slides, video, pdf, or cover) found in this folder.
              </div>
            )}
          </div>
        </div>


        {/* Right Column: Per-Channel Post Editor (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 space-y-5 shadow-xs">
            {/* Channel header & status badge */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {activeChannel === "linkedin_page"
                    ? "LinkedIn Business Page"
                    : activeChannel === "threads"
                    ? "Threads"
                    : activeChannel === "linkedin"
                    ? "LinkedIn Personal"
                    : activeChannel.charAt(0).toUpperCase() + activeChannel.slice(1)}{" "}
                  Post Configuration
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    currentPost?.status === "published"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                      : currentPost?.status === "scheduled"
                      ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25"
                      : currentPost?.status === "failed"
                      ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25"
                      : currentPost?.status === "publishing"
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25 animate-pulse"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  {currentPost?.status === "scheduled"
                    ? currentPost.scheduledFor
                      ? `Queued (${new Date(currentPost.scheduledFor).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })})`
                      : "Queued"
                    : currentPost?.status || "draft"}
                </span>
              </div>

              {/* Skool manual actions */}
              {activeChannel === "skool" && (
                <a
                  href="https://www.skool.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
                >
                  <span>Open Skool</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Prominent Channel Status & Action Banner */}
            {currentPost?.status === "published" ? (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-xs shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                      <span>
                        Published to{" "}
                        {activeChannel === "linkedin_page"
                          ? "LinkedIn Business Page"
                          : activeChannel === "threads"
                          ? "Threads"
                          : activeChannel === "linkedin"
                          ? "LinkedIn Personal"
                          : activeChannel.charAt(0).toUpperCase() + activeChannel.slice(1)}
                      </span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                        DONE
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400/90 truncate">
                      {currentPost.publishedAt
                        ? `Published on ${new Date(currentPost.publishedAt).toLocaleString()}`
                        : "Marked as published"}
                      {currentPost.zernioPostId ? ` • Zernio ID: ${currentPost.zernioPostId}` : ""}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateStatusMutation.mutate({ postId: currentPost.id, status: "draft" })}
                  disabled={updateStatusMutation.isPending}
                  className="px-2.5 py-1.5 min-h-[36px] rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-[11px] font-medium border border-emerald-500/40 transition-colors shrink-0 ml-2"
                  title="Reset status back to Pending"
                >
                  {updateStatusMutation.isPending ? "Updating..." : "Mark as Pending"}
                </button>
              </div>
            ) : currentPost?.status === "scheduled" ? (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-900 dark:text-sky-200 text-xs shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sky-900 dark:text-sky-200 flex items-center gap-2">
                      <span>Queued in Zernio</span>
                      <span className="text-[10px] bg-sky-500/20 text-sky-800 dark:text-sky-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                        QUEUED
                      </span>
                    </div>
                    <div className="text-[11px] text-sky-700 dark:text-sky-400/90 truncate">
                      {currentPost.scheduledFor
                        ? `Scheduled for ${new Date(currentPost.scheduledFor).toLocaleString()}`
                        : "Queued for automatic publishing"}
                      {currentPost.zernioPostId ? ` • Zernio ID: ${currentPost.zernioPostId}` : ""}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateStatusMutation.mutate({ postId: currentPost.id, status: "draft" })}
                  disabled={updateStatusMutation.isPending}
                  className="px-2.5 py-1.5 min-h-[36px] rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-800 dark:text-sky-200 text-[11px] font-medium border border-sky-500/40 transition-colors shrink-0 ml-2"
                >
                  {updateStatusMutation.isPending ? "Updating..." : "Reset to Draft"}
                </button>
              </div>
            ) : currentPost?.status === "failed" ? (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 text-xs shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-rose-900 dark:text-rose-200 flex items-center gap-2">
                      <span>Publishing Failed</span>
                      <span className="text-[10px] bg-rose-500/20 text-rose-800 dark:text-rose-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                        ERROR
                      </span>
                    </div>
                    <div className="text-[11px] text-rose-700 dark:text-rose-300 truncate">
                      {currentPost.errorMessage || "Unknown error occurred"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateStatusMutation.mutate({ postId: currentPost.id, status: "draft" })}
                  disabled={updateStatusMutation.isPending}
                  className="px-2.5 py-1.5 min-h-[36px] rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-800 dark:text-rose-200 text-[11px] font-medium border border-rose-500/40 transition-colors shrink-0 ml-2"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="font-medium">Pending: Not published yet on this channel.</span>
                </div>
                {currentPost && (
                  <button
                    type="button"
                    onClick={() => updateStatusMutation.mutate({ postId: currentPost.id, status: "published" })}
                    disabled={updateStatusMutation.isPending}
                    className="px-2.5 py-1 min-h-[32px] rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-emerald-500/20 text-zinc-800 dark:text-zinc-300 hover:text-emerald-700 dark:hover:text-emerald-300 text-[11px] font-medium border border-zinc-300 dark:border-zinc-700 hover:border-emerald-500/30 transition-colors"
                    title="Mark this channel as published if completed elsewhere"
                  >
                    {updateStatusMutation.isPending ? "Updating..." : "Mark as Done"}
                  </button>
                )}
              </div>
            )}

            {/* LinkedIn Shared Content Indicators */}
            {activeChannel === "linkedin_page" && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-900 dark:text-sky-200 text-xs">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>
                    <strong>LinkedIn Sync:</strong> Business Page automatically uses the same title, body, and media format as your LinkedIn Personal post.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const li = formState.linkedin;
                    if (li) {
                      setFormState((prev) => ({
                        ...prev,
                        linkedin_page: {
                          title: li.title,
                          body: li.body,
                          postType: li.postType,
                          zernioProfileId: prev.linkedin_page?.zernioProfileId || "",
                        },
                      }));
                      setToastMessage({ text: "Content synced from LinkedIn Personal!", type: "success" });
                      setTimeout(() => setToastMessage(null), 3000);
                    }
                  }}
                  className="px-2.5 py-1 min-h-[32px] rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-800 dark:text-sky-200 hover:underline font-medium transition-colors shrink-0"
                >
                  Copy from LinkedIn
                </button>
              </div>
            )}
            {activeChannel === "linkedin" && (
              <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 -mt-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                <span>Content edits here are automatically shared with your <strong>LinkedIn Business Page</strong></span>
              </div>
            )}

            {/* Error banner if previous publish failed */}
            {currentPost?.errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{currentPost.errorMessage}</span>
              </div>
            )}

            {/* Title field (where applicable) */}
            {activeChannel !== "instagram" &&
              activeChannel !== "facebook" &&
              activeChannel !== "threads" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      {activeChannel === "youtube" ? "Video Title" : "Post Title / Heading"}
                    </label>
                    {activeChannel === "youtube" && (
                      <span
                        className={`text-[10px] font-mono ${
                          currentForm.title.length > 100
                            ? "text-rose-600 dark:text-rose-400 font-semibold"
                            : currentForm.title.length > 90
                            ? "text-amber-600 dark:text-amber-300"
                            : "text-zinc-400"
                        }`}
                      >
                        {currentForm.title.length}/100
                      </span>
                    )}
                    {activeChannel === "youtube" && sourceFileBadge && (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 font-mono border border-zinc-200 dark:border-zinc-800 flex items-center gap-1">
                        <FileText className="w-2.5 h-2.5" />
                        {sourceFileBadge}
                      </span>
                    )}
                  </div>
                  {activeChannel === "skool" && (
                    <button
                      onClick={() =>
                        copyToClipboard(currentForm.title, "title")
                      }
                      className="flex items-center gap-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:underline min-h-[32px]"
                    >
                      {copiedField === "title" ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
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
                  className="w-full px-3.5 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                />

                {/* Alternative YouTube Title Options */}
                {activeChannel === "youtube" &&
                  assets.youtubeData?.titleOptions &&
                  assets.youtubeData.titleOptions.length > 1 && (
                    <div className="mt-2 space-y-1.5">
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                        <span>💡</span>
                        <span>Alternative Title Options (Click to apply):</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {assets.youtubeData.titleOptions.map((opt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleFormChange("title", opt)}
                            className={`text-left text-[11px] px-2.5 py-1.5 rounded-lg border transition-all flex items-start gap-2 ${
                              currentForm.title === opt
                                ? "bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/40 font-medium"
                                : "bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200"
                            }`}
                          >
                            <span className="font-semibold text-zinc-400 shrink-0">{idx + 1}.</span>
                            <span className="truncate">{opt}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* Post Type Selector (Instagram / Facebook / LinkedIn / LinkedIn Page / Threads) */}
            {(activeChannel === "instagram" ||
              activeChannel === "facebook" ||
              activeChannel === "linkedin" ||
              activeChannel === "linkedin_page" ||
              activeChannel === "threads") && (
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Media / Publication Format
                </label>
                <div className={`grid gap-2 ${activeChannel === "threads" ? "grid-cols-2" : "grid-cols-3"}`}>
                  {activeChannel === "linkedin" || activeChannel === "linkedin_page" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleFormChange("postType", "document")}
                        className={`py-2 px-3 min-h-[40px] rounded-xl text-xs font-medium border text-center transition-all ${
                          currentForm.postType === "document"
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs font-semibold"
                            : "bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                        }`}
                      >
                        📄 Document (PDF)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormChange("postType", "video")}
                        className={`py-2 px-3 min-h-[40px] rounded-xl text-xs font-medium border text-center transition-all ${
                          currentForm.postType === "video"
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs font-semibold"
                            : "bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                        }`}
                      >
                        📹 Video Post
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormChange("postType", "feed")}
                        className={`py-2 px-3 min-h-[40px] rounded-xl text-xs font-medium border text-center transition-all ${
                          currentForm.postType === "feed"
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs font-semibold"
                            : "bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                        }`}
                      >
                        📝 Text Only
                      </button>
                    </>
                  ) : activeChannel === "threads" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          handleFormChange("postType", "video");
                          setActiveMediaTab("video");
                        }}
                        className={`py-2 px-3 min-h-[40px] rounded-xl text-xs font-medium border text-center transition-all ${
                          currentForm.postType === "video"
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs font-semibold"
                            : "bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                        }`}
                      >
                        📹 Video Post
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormChange("postType", "feed")}
                        className={`py-2 px-3 min-h-[40px] rounded-xl text-xs font-medium border text-center transition-all ${
                          currentForm.postType === "feed"
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs font-semibold"
                            : "bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
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
                        className={`py-2 px-3 min-h-[40px] rounded-xl text-xs font-medium border text-center transition-all ${
                          currentForm.postType === "reel"
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs font-semibold"
                            : "bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                        }`}
                      >
                        ⚡ Video Reel
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleFormChange("postType", "carousel")
                        }
                        className={`py-2 px-3 min-h-[40px] rounded-xl text-xs font-medium border text-center transition-all ${
                          currentForm.postType === "carousel"
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs font-semibold"
                            : "bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                        }`}
                      >
                        🖼️ Slide Carousel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormChange("postType", "feed")}
                        className={`py-2 px-3 min-h-[40px] rounded-xl text-xs font-medium border text-center transition-all ${
                          currentForm.postType === "feed"
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs font-semibold"
                            : "bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                        }`}
                      >
                        📰 Standard Feed
                      </button>
                    </>
                  )}
                </div>

                {/* Helpful Threads media badge */}
                {activeChannel === "threads" && (
                  <div className="text-[11px] mt-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                    {currentForm.postType === "video" ? (
                      <span className="text-sky-700 dark:text-sky-300 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-sky-600" />
                        <span><strong>Video Active:</strong> MP4 video will be attached to your first post.</span>
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                        <span><strong>Text Only:</strong> No media will be attached. Choose <em>Video Post</em> above if you want your video attached.</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Body / Description Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {activeChannel === "youtube"
                      ? "Video Description"
                      : activeChannel === "threads"
                      ? "Threads Post Content"
                      : "Post Content / Caption"}
                  </label>
                  {sourceFileBadge && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 font-mono border border-zinc-200 dark:border-zinc-800 flex items-center gap-1">
                      <FileText className="w-2.5 h-2.5" />
                      {sourceFileBadge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {activeChannel === "threads" ? (
                    (() => {
                      const threadParts = parseThreadItems(currentForm.body);
                      const isThread = threadParts.length > 1;
                      const anyItemTooLong = isThread
                        ? threadParts.some((p) => p.length > 500)
                        : currentForm.body.length > 500;

                      if (isThread) {
                        return (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[11px] font-mono font-medium ${
                                anyItemTooLong ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              🧵 {threadParts.length} Thread Posts
                            </span>
                            {anyItemTooLong ? (
                              <span
                                className="text-[10px] text-rose-600 dark:text-rose-400 cursor-help"
                                title="At least one post in the thread exceeds 500 characters."
                              >
                                (Item &gt; 500 chars)
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-500 font-mono">
                                (Max {Math.max(...threadParts.map((p) => p.length))}/500 chars)
                              </span>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[11px] font-mono font-medium ${
                              currentForm.body.length > 500
                                ? "text-rose-600 dark:text-rose-400 font-semibold"
                                : currentForm.body.length > 450
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-zinc-500"
                            }`}
                          >
                            {currentForm.body.length}/500 chars
                          </span>
                          {currentForm.body.length > 500 && (
                            <span
                              className="text-[10px] text-rose-600 dark:text-rose-400 cursor-help"
                              title="Threads post limit is 500 characters."
                            >
                              (Exceeds limit)
                            </span>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <span className="text-[11px] text-zinc-500">
                      {currentForm.body.length} characters
                    </span>
                  )}
                  {activeChannel === "skool" && (
                    <button
                      onClick={() => copyToClipboard(currentForm.body, "body")}
                      className="flex items-center gap-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:underline min-h-[32px]"
                    >
                      {copiedField === "body" ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
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
                placeholder={
                  activeChannel === "threads"
                    ? "Write your Threads post (up to 500 characters)..."
                    : "Write post content..."
                }
                className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 leading-relaxed font-sans resize-y"
              />

              {/* YouTube SEO Tags Display */}
              {activeChannel === "youtube" &&
                assets.youtubeData?.tags &&
                assets.youtubeData.tags.length > 0 && (
                  <div className="mt-2.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                        <span>🏷️</span>
                        <span>YouTube SEO Tags ({assets.youtubeData.tags.length})</span>
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                        Sent with video metadata
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
                      {assets.youtubeData.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[10px] bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 font-sans"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Target Zernio Social Profile (except Skool) */}
            {activeChannel !== "skool" && (
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Publishing As Profile
                </label>
                {matchingProfiles.length > 0 ? (
                  <select
                    value={currentForm.zernioProfileId}
                    onChange={(e) =>
                      handleFormChange("zernioProfileId", e.target.value)
                    }
                    className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 cursor-pointer min-h-[40px]"
                  >
                    <option value="">
                      Default ({matchingProfiles[0].profileName}
                      {matchingProfiles[0].handle ? ` - @${matchingProfiles[0].handle.replace(/^@/, "")}` : ""}
                      {matchingProfiles[0].isBusinessPage ? " • Business Page" : ""})
                    </option>
                    {matchingProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.accountName} → {p.profileName}
                        {p.handle ? ` (@${p.handle.replace(/^@/, "")})` : ""}
                        {p.isBusinessPage ? " [Business Page]" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between">
                    <span>No active connected {activeChannel === "linkedin_page" ? "LinkedIn Page" : activeChannel === "threads" ? "Threads" : activeChannel} channel found in Zernio</span>
                    <Link
                      href="/settings/zernio"
                      className="text-xs underline font-medium hover:text-amber-900 dark:hover:text-white"
                    >
                      Connect Channel in Settings
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Actions Bar */}
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                disabled={savePostMutation.isPending}
                onClick={() => savePostMutation.mutate()}
                className="flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium border border-zinc-200 dark:border-zinc-700 transition-colors disabled:opacity-50"
              >
                {savePostMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 text-zinc-500" />
                )}
                <span>Save Draft</span>
              </button>

              {activeChannel !== "skool" ? (
                <button
                  type="button"
                  disabled={publishMutation.isPending}
                  onClick={() => publishMutation.mutate()}
                  className={`flex items-center justify-center gap-2 px-5 py-2 min-h-[44px] rounded-xl text-xs font-semibold shadow-xs transition-all disabled:opacity-50 ${
                    currentPost?.status === "published"
                      ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700"
                      : "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900"
                  }`}
                >
                  {publishMutation.isPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : currentPost?.status === "published" ? (
                    <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {currentPost?.status === "published"
                      ? "Re-publish to"
                      : currentPost?.status === "scheduled"
                      ? "Re-queue to"
                      : "Queue to"}{" "}
                    {activeChannel === "linkedin_page"
                      ? "LinkedIn Page"
                      : activeChannel === "threads"
                      ? "Threads"
                      : activeChannel}
                  </span>
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
                    className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold border border-amber-500/30 transition-all"
                  >
                    {copiedField === "all" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
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
