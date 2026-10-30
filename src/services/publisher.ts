import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import {
  getDecryptedApiKey,
  uploadMediaToZernio,
  publishPostToZernio,
  constructPlatformPostUrl,
  ZernioPublishPayload,
  ZernioMediaItem,
} from "./zernio";
import {
  listFolderChildren,
  getFileBuffer,
  getFileContentAsText,
  renameFolder,
} from "./onedrive";
import { rasterizeSvgToPng } from "./rasterizer";
import { sortSlidesNaturally, stripMarkdown, parseThreadItems, extractYouTubeContent } from "./extractor";
import { logActivity } from "./activity";

export interface PublishResult {
  success: boolean;
  postId?: string;
  zernioPostId?: string;
  platformPostUrl?: string | null;
  channel: string;
  folderRenamed: boolean;
  message: string;
}

/**
 * Publishes a specific channel post to its social channel via Zernio,
 * handling media downloading from OneDrive, SVG rasterization, and automated
 * post-publish renaming of the folder to "-Done" if all channels are completed.
 */
export async function publishChannelPost(channelPostId: string): Promise<PublishResult> {
  const posts = await db
    .select()
    .from(schema.channelPosts)
    .where(eq(schema.channelPosts.id, channelPostId));

  if (posts.length === 0) {
    throw new Error("Channel post not found");
  }

  const post = posts[0];

  const contentItems = await db
    .select()
    .from(schema.contentItems)
    .where(eq(schema.contentItems.id, post.contentItemId));

  if (contentItems.length === 0) {
    throw new Error("Parent content folder item not found");
  }

  const contentItem = contentItems[0];

  // Skool is manual copy-paste
  if (post.channel === "skool") {
    const nowIso = new Date().toISOString();
    await db
      .update(schema.channelPosts)
      .set({
        status: "published",
        publishedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(schema.channelPosts.id, post.id));

    const renamed = await checkAndRenameFolderIfDone(contentItem.id);
    return {
      success: true,
      postId: post.id,
      channel: "skool",
      folderRenamed: renamed,
      message: "Marked Skool post as published (manual distribution).",
    };
  }

  // 1. Resolve Zernio Account, Profile & Connection
  let zernioAccountId = post.zernioAccountId;
  let zernioProfileId = post.zernioProfileId;
  let zernioConnectionId = post.zernioConnectionId;

  const allConnections = await db.select().from(schema.zernioConnections);
  const allProfiles = await db.select().from(schema.zernioProfiles);
  const allAccounts = await db.select().from(schema.zernioAccounts);

  const matchingConnections = allConnections.filter((c) => {
    const connPlatform = c.platform.toLowerCase();
    if (post.channel === "linkedin_page") {
      return (connPlatform === "linkedin_page" || connPlatform === "linkedin") && c.isActive === 1;
    }
    if (post.channel === "threads") {
      return connPlatform === "threads" && c.isActive === 1;
    }
    if (post.channel === "twitter" || post.channel === "x") {
      return (connPlatform === "twitter" || connPlatform === "x") && c.isActive === 1;
    }
    if (post.channel === "linkedin") {
      return (connPlatform === "linkedin" || connPlatform === "linkedin_page") && c.isActive === 1;
    }
    return connPlatform === post.channel.toLowerCase() && c.isActive === 1;
  });

  // Prioritize connections according to channel intent
  if (post.channel === "linkedin_page") {
    matchingConnections.sort((a, b) => {
      const aAcc = allAccounts.find((acc) => acc.id === a.zernioAccountId);
      const bAcc = allAccounts.find((acc) => acc.id === b.zernioAccountId);
      const aIsBiz =
        a.platform.toLowerCase() === "linkedin_page" ||
        a.connectionId.includes("::") ||
        (aAcc?.name || "").toLowerCase().includes("biz") ||
        (aAcc?.name || "").toLowerCase().includes("page") ||
        (aAcc?.name || "").toLowerCase().includes("company") ||
        (a.displayName || "").toLowerCase().includes("page") ||
        (a.displayName || "").toLowerCase().includes("technolabs") ||
        (a.displayName || "").toLowerCase().includes("company");
      const bIsBiz =
        b.platform.toLowerCase() === "linkedin_page" ||
        b.connectionId.includes("::") ||
        (bAcc?.name || "").toLowerCase().includes("biz") ||
        (bAcc?.name || "").toLowerCase().includes("page") ||
        (bAcc?.name || "").toLowerCase().includes("company") ||
        (b.displayName || "").toLowerCase().includes("page") ||
        (b.displayName || "").toLowerCase().includes("technolabs") ||
        (b.displayName || "").toLowerCase().includes("company");

      if (aIsBiz && !bIsBiz) return -1;
      if (!aIsBiz && bIsBiz) return 1;
      return 0;
    });
  } else if (post.channel === "linkedin") {
    matchingConnections.sort((a, b) => {
      const aAcc = allAccounts.find((acc) => acc.id === a.zernioAccountId);
      const bAcc = allAccounts.find((acc) => acc.id === b.zernioAccountId);
      const aIsBiz =
        a.platform.toLowerCase() === "linkedin_page" ||
        a.connectionId.includes("::") ||
        (aAcc?.name || "").toLowerCase().includes("biz") ||
        (aAcc?.name || "").toLowerCase().includes("page") ||
        (aAcc?.name || "").toLowerCase().includes("company");
      const bIsBiz =
        b.platform.toLowerCase() === "linkedin_page" ||
        b.connectionId.includes("::") ||
        (bAcc?.name || "").toLowerCase().includes("biz") ||
        (bAcc?.name || "").toLowerCase().includes("page") ||
        (bAcc?.name || "").toLowerCase().includes("company");

      if (!aIsBiz && bIsBiz) return -1;
      if (aIsBiz && !bIsBiz) return 1;
      return 0;
    });
  }

  let targetConnection: (typeof schema.zernioConnections.$inferSelect) | undefined;

  // 1a. Try finding by explicit connection ID
  if (zernioConnectionId) {
    targetConnection = allConnections.find((c) => c.id === zernioConnectionId);
  }

  // 1b. Check if zernioProfileId directly matched a connection (from form selection)
  if (!targetConnection && zernioProfileId) {
    targetConnection = allConnections.find((c) => c.id === zernioProfileId);
  }

  // 1c. If zernioProfileId is a profile, find matching connection in that profile
  if (!targetConnection && zernioProfileId) {
    targetConnection = matchingConnections.find((c) => c.zernioProfileId === zernioProfileId);
  }

  // 1d. If account is selected, find matching connection in that account
  if (!targetConnection && zernioAccountId) {
    targetConnection = matchingConnections.find((c) => c.zernioAccountId === zernioAccountId);
  }

  // 1e. Fallback to first active matching connection (already sorted by channel suitability)
  if (!targetConnection && matchingConnections.length > 0) {
    targetConnection = matchingConnections[0];
  }

  let targetAccountId: string;
  let zernioApiProfileId: string | undefined;
  const platformSpecificData: Record<string, any> = {};

  if (targetConnection) {
    targetAccountId = targetConnection.connectionId;
    zernioAccountId = targetConnection.zernioAccountId;
    zernioProfileId = targetConnection.zernioProfileId;
    zernioConnectionId = targetConnection.id;

    if (targetAccountId.includes("::")) {
      const [baseId, orgUrn] = targetAccountId.split("::");
      targetAccountId = baseId;
      platformSpecificData.organizationUrn = orgUrn;
    }

    const matchingProfile = allProfiles.find((p) => p.id === targetConnection!.zernioProfileId);
    zernioApiProfileId = matchingProfile?.profileId;
  } else {
    // Fallback to legacy zernioProfiles if any
    const legacyProfile = allProfiles.find(
      (p) =>
        p.id === zernioProfileId ||
        p.platform.toLowerCase() === post.channel.toLowerCase() ||
        (post.channel === "linkedin_page" && p.platform.toLowerCase() === "linkedin")
    );
    if (!legacyProfile) {
      throw new Error(
        `No active connected ${post.channel} channel found. Please add a Zernio account and connect ${post.channel} in Settings.`
      );
    }
    targetAccountId = legacyProfile.profileId;
    zernioAccountId = legacyProfile.zernioAccountId;
    zernioProfileId = legacyProfile.id;
    zernioApiProfileId = legacyProfile.profileId;
  }

  // Ensure zernioApiProfileId is resolved from profiles for queue assignment
  if (!zernioApiProfileId && zernioProfileId) {
    const prof = allProfiles.find((p) => p.id === zernioProfileId || p.profileId === zernioProfileId);
    zernioApiProfileId = prof?.profileId;
  }
  if (!zernioApiProfileId && allProfiles.length > 0) {
    const defProf = allProfiles.find((p) => p.isDefault === 1) || allProfiles[0];
    zernioApiProfileId = defProf.profileId;
  }

  if (!zernioAccountId) {
    throw new Error(`Could not determine Zernio account for ${post.channel}.`);
  }

  const apiKey = await getDecryptedApiKey(zernioAccountId);

  // Mark post status as 'publishing' in DB
  await db
    .update(schema.channelPosts)
    .set({
      status: "publishing",
      zernioAccountId,
      zernioProfileId,
      zernioConnectionId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.channelPosts.id, post.id));

  // 2. Discover children inside the OneDrive folder
  const children = await listFolderChildren(contentItem.driveItemId);
  const hyperframesVideo = children.find(
    (c) => !c.isFolder && /-hyperframes\.mp4$/i.test(c.name)
  );
  const regularVideo = children.find(
    (c) => !c.isFolder && /\.mp4$/i.test(c.name) && !/-hyperframes\.mp4$/i.test(c.name)
  );
  const pdfFile = children.find((c) => !c.isFolder && /\.pdf$/i.test(c.name));
  const slidesFolder = children.find((c) => c.isFolder && /^slides$/i.test(c.name));
  const coverFile = children.find(
    (c) => !c.isFolder && /^cover\.(svg|png|jpg|webp)$/i.test(c.name)
  );

  const uploadedMediaUrls: string[] = [];
  const mediaItems: ZernioMediaItem[] = [];

  // Update status to publishing
  await db
    .update(schema.channelPosts)
    .set({ status: "publishing", updatedAt: new Date().toISOString() })
    .where(eq(schema.channelPosts.id, post.id));

  try {
    // 3. Media processing based on platform and post type
    if (post.channel === "linkedin" || post.channel === "linkedin_page") {
      if (post.postType === "document" || pdfFile) {
        const targetPdf = pdfFile;
        if (targetPdf) {
          const buffer = await getFileBuffer(targetPdf.id, targetPdf.downloadUrl);
          const { publicUrl } = await uploadMediaToZernio(
            apiKey,
            buffer,
            targetPdf.name,
            "application/pdf"
          );
          uploadedMediaUrls.push(publicUrl);
          mediaItems.push({ type: "document", url: publicUrl });
        }
      } else if (post.postType === "video" || regularVideo || hyperframesVideo) {
        const video = hyperframesVideo || regularVideo;
        if (video) {
          const buffer = await getFileBuffer(video.id, video.downloadUrl);
          const { publicUrl } = await uploadMediaToZernio(
            apiKey,
            buffer,
            video.name,
            "video/mp4"
          );
          uploadedMediaUrls.push(publicUrl);
          mediaItems.push({ type: "video", url: publicUrl });
        }
      } else if (post.postType === "carousel" && slidesFolder) {
        const slideFiles = await listFolderChildren(slidesFolder.id);
        const imageSlides = slideFiles.filter(
          (f) => !f.isFolder && /\.(svg|png|jpg|jpeg|webp)$/i.test(f.name)
        );
        const sorted = sortSlidesNaturally(imageSlides);
        for (const slide of sorted) {
          if (slide.name.endsWith(".svg")) {
            const svgText = await getFileContentAsText(slide.id, slide.downloadUrl);
            const pngBuffer = rasterizeSvgToPng(svgText, { width: 1080 });
            const { publicUrl } = await uploadMediaToZernio(
              apiKey,
              pngBuffer,
              `${slide.name.replace(/\.svg$/, "")}.png`,
              "image/png"
            );
            uploadedMediaUrls.push(publicUrl);
            mediaItems.push({ type: "image", url: publicUrl });
          } else {
            const buffer = await getFileBuffer(slide.id, slide.downloadUrl);
            const { publicUrl } = await uploadMediaToZernio(
              apiKey,
              buffer,
              slide.name,
              "image/png"
            );
            uploadedMediaUrls.push(publicUrl);
            mediaItems.push({ type: "image", url: publicUrl });
          }
        }
      }
    } else if (post.channel === "threads" || post.channel === "twitter" || post.channel === "x") {
      if (post.postType === "feed") {
        // Pure text post / thread — do not attach media
      } else if (
        post.postType === "video" ||
        (!post.postType && post.channel === "threads" && (hyperframesVideo || regularVideo)) ||
        (!post.postType && !slidesFolder && (hyperframesVideo || regularVideo))
      ) {
        const video = hyperframesVideo || regularVideo;
        if (video) {
          const buffer = await getFileBuffer(video.id, video.downloadUrl);
          const { publicUrl } = await uploadMediaToZernio(
            apiKey,
            buffer,
            video.name,
            "video/mp4"
          );
          uploadedMediaUrls.push(publicUrl);
          mediaItems.push({ type: "video", url: publicUrl });
        }
      } else if (post.channel !== "threads" && (post.postType === "carousel" || slidesFolder || (!post.postType && slidesFolder))) {
        // Twitter allows up to 4 images
        const maxImages = 4;
        let candidateFiles: Array<{ id: string; name: string; downloadUrl?: string; size?: number }> = [];

        if (slidesFolder) {
          const slideFiles = await listFolderChildren(slidesFolder.id);
          candidateFiles = slideFiles.filter(
            (f) => !f.isFolder && /\.(svg|png|jpg|jpeg|webp)$/i.test(f.name)
          );
        } else if (coverFile) {
          candidateFiles = [coverFile];
        }

        const sorted = sortSlidesNaturally(candidateFiles).slice(0, maxImages);
        for (const slide of sorted) {
          if (slide.name.endsWith(".svg")) {
            const svgText = await getFileContentAsText(slide.id, slide.downloadUrl);
            const pngBuffer = rasterizeSvgToPng(svgText, { width: 1080 });
            const { publicUrl } = await uploadMediaToZernio(
              apiKey,
              pngBuffer,
              `${slide.name.replace(/\.svg$/, "")}.png`,
              "image/png"
            );
            uploadedMediaUrls.push(publicUrl);
            mediaItems.push({ type: "image", url: publicUrl });
          } else {
            const buffer = await getFileBuffer(slide.id, slide.downloadUrl);
            let contentType = "image/png";
            if (/\.jpe?g$/i.test(slide.name)) {
              contentType = "image/jpeg";
            } else if (/\.webp$/i.test(slide.name)) {
              contentType = "image/webp";
            }
            const { publicUrl } = await uploadMediaToZernio(
              apiKey,
              buffer,
              slide.name,
              contentType
            );
            uploadedMediaUrls.push(publicUrl);
            mediaItems.push({ type: "image", url: publicUrl });
          }
        }
      } else if (coverFile) {
        if (coverFile.name.endsWith(".svg")) {
          const svgText = await getFileContentAsText(coverFile.id, coverFile.downloadUrl);
          const pngBuffer = rasterizeSvgToPng(svgText, { width: 1080 });
          const { publicUrl } = await uploadMediaToZernio(
            apiKey,
            pngBuffer,
            "cover.png",
            "image/png"
          );
          uploadedMediaUrls.push(publicUrl);
          mediaItems.push({ type: "image", url: publicUrl });
        } else {
          const buffer = await getFileBuffer(coverFile.id, coverFile.downloadUrl);
          let contentType = "image/png";
          if (/\.jpe?g$/i.test(coverFile.name)) {
            contentType = "image/jpeg";
          } else if (/\.webp$/i.test(coverFile.name)) {
            contentType = "image/webp";
          }
          const { publicUrl } = await uploadMediaToZernio(
            apiKey,
            buffer,
            coverFile.name,
            contentType
          );
          uploadedMediaUrls.push(publicUrl);
          mediaItems.push({ type: "image", url: publicUrl });
        }
      }
    } else if (post.channel === "youtube") {
      // Find video: check if post.mediaType specifies a video name or ID, else use hyperframesVideo or regularVideo
      let video = children.find(
        (c) => !c.isFolder && (c.id === post.mediaType || c.name === post.mediaType)
      );
      if (!video) {
        video = hyperframesVideo || regularVideo;
      }
      if (!video) {
        throw new Error("No MP4 video file found in this content folder. YouTube posts require video content.");
      }
      const buffer = await getFileBuffer(video.id, video.downloadUrl);
      const { publicUrl } = await uploadMediaToZernio(
        apiKey,
        buffer,
        video.name,
        "video/mp4"
      );
      uploadedMediaUrls.push(publicUrl);
      mediaItems.push({ type: "video", url: publicUrl });
    } else if (post.channel === "instagram" || post.channel === "facebook") {
      const isCarousel = post.postType === "carousel";
      const isReel = post.postType === "reel" || (!isCarousel && Boolean(hyperframesVideo));

      if (isCarousel && slidesFolder) {
        // Enumerate slides naturally
        const slideFiles = await listFolderChildren(slidesFolder.id);
        const imageSlides = slideFiles.filter(
          (f) => !f.isFolder && /\.(svg|png|jpg|jpeg|webp)$/i.test(f.name)
        );
        const sorted = sortSlidesNaturally(imageSlides);

        for (const slide of sorted) {
          if (slide.name.endsWith(".svg")) {
            // Fetch SVG text and rasterize to PNG buffer on-the-fly
            const svgText = await getFileContentAsText(slide.id, slide.downloadUrl);
            const pngBuffer = rasterizeSvgToPng(svgText, { width: 1080 });
            const { publicUrl } = await uploadMediaToZernio(
              apiKey,
              pngBuffer,
              `${slide.name.replace(/\.svg$/, "")}.png`,
              "image/png"
            );
            uploadedMediaUrls.push(publicUrl);
            mediaItems.push({ type: "image", url: publicUrl });
          } else {
            // Already a raster image
            const buffer = await getFileBuffer(slide.id, slide.downloadUrl);
            const { publicUrl } = await uploadMediaToZernio(
              apiKey,
              buffer,
              slide.name,
              "image/png"
            );
            uploadedMediaUrls.push(publicUrl);
            mediaItems.push({ type: "image", url: publicUrl });
          }
        }
      } else if (isReel || hyperframesVideo || regularVideo) {
        const video = hyperframesVideo || regularVideo;
        if (video) {
          const buffer = await getFileBuffer(video.id, video.downloadUrl);
          const { publicUrl } = await uploadMediaToZernio(
            apiKey,
            buffer,
            video.name,
            "video/mp4"
          );
          uploadedMediaUrls.push(publicUrl);
          mediaItems.push({ type: "video", url: publicUrl });
        }
      }
    }

    // 4. Construct payload and queue to Zernio
    let postBody = post.body || "";
    let postTitle = post.title;
    let postType = post.postType;

    // LinkedIn Business Page should use the same content as LinkedIn Personal
    if (post.channel === "linkedin_page") {
      const liPost = await db
        .select()
        .from(schema.channelPosts)
        .where(
          and(
            eq(schema.channelPosts.contentItemId, post.contentItemId),
            eq(schema.channelPosts.channel, "linkedin")
          )
        );
      if (liPost.length > 0) {
        if (liPost[0].body) {
          postBody = liPost[0].body;
        }
        if (liPost[0].title) {
          postTitle = liPost[0].title;
        }
        if (liPost[0].postType) {
          postType = liPost[0].postType;
        }
      }
    }

    // For Threads (and Twitter/X), support multithread publishing via Zernio platformSpecificData.threadItems
    let postContentToSend = stripMarkdown(postBody);
    if (post.channel === "threads" || post.channel === "twitter" || post.channel === "x") {
      const threadItems = parseThreadItems(postBody);
      if (threadItems.length > 1) {
        // In Zernio's API for threads and twitter:
        // - 'content' is the root post (threadItems[0])
        // - 'mediaItems' on root payload attaches carousel to the root post (where Meta Threads supports carousels)
        // - 'platformSpecificData.threadItems' contains only the SUBSEQUENT reply posts (threadItems.slice(1))
        postContentToSend = stripMarkdown(threadItems[0]);
        platformSpecificData.threadItems = threadItems.slice(1).map((item) => {
          return { content: stripMarkdown(item) };
        });
      }
    }

    // For YouTube, extract video title, tags, category, and metadata from youtube.md if available
    if (post.channel === "youtube") {
      const cleanTitle = (postTitle || postBody.split("\n")[0] || "Video").trim();
      platformSpecificData.title = cleanTitle.substring(0, 100);
      if (platformSpecificData.visibility === undefined) {
        platformSpecificData.visibility = "public";
      }
      if (platformSpecificData.madeForKids === undefined) {
        platformSpecificData.madeForKids = false;
      }
      if (platformSpecificData.categoryId === undefined) {
        platformSpecificData.categoryId = "28"; // Science & Technology
      }

      // Check for youtube.md to pull all SEO tags
      const ytFile = children.find((c) => !c.isFolder && /^(youtube|yt)(-post)?\.md$/i.test(c.name));
      if (ytFile) {
        try {
          const ytText = await getFileContentAsText(ytFile.id, ytFile.downloadUrl);
          const ytExt = extractYouTubeContent(ytText);
          if (ytExt.tags && ytExt.tags.length > 0) {
            // YouTube allows max 500 characters total across tags, and 100 chars per tag
            const validTags: string[] = [];
            let totalTagChars = 0;
            for (const t of ytExt.tags) {
              const cleanTag = t.substring(0, 100).trim();
              if (cleanTag && totalTagChars + cleanTag.length + 1 <= 500) {
                validTags.push(cleanTag);
                totalTagChars += cleanTag.length + 1;
              }
            }
            if (validTags.length > 0) {
              platformSpecificData.tags = validTags;
            }
          }
        } catch (err) {
          console.warn("[Publisher] Could not parse youtube.md tags:", err);
        }
      }
    }

    const payload: ZernioPublishPayload = {
      platform: post.channel as any,
      accountId: targetAccountId,
      content: postContentToSend,
      title: postTitle ? stripMarkdown(postTitle) : undefined,
      mediaItems: mediaItems.length > 0 ? mediaItems : undefined,
      mediaUrls: uploadedMediaUrls.length > 0 ? uploadedMediaUrls : undefined,
      postType: postType as any,
      queuedFromProfile: zernioApiProfileId,
      platformSpecificData:
        Object.keys(platformSpecificData).length > 0 ? platformSpecificData : undefined,
    };

    console.log("[Publisher] Sending payload to Zernio (queuing):", JSON.stringify(payload, null, 2));
    const zernioRes = await publishPostToZernio(apiKey, payload);
    console.log("[Publisher] Zernio queue result:", JSON.stringify(zernioRes, null, 2));

    // 5. Update post in DB
    const nowIso = new Date().toISOString();
    const isScheduled = zernioRes.status === "scheduled" || Boolean(payload.queuedFromProfile);
    const assignedSlot = zernioRes.scheduledFor || post.scheduledFor || null;

    // Resolve post URL from zernio response if available
    const rawPostObj = zernioRes.rawResponse?.post || zernioRes.rawResponse?.data || zernioRes.rawResponse;
    const plObj = rawPostObj?.platforms?.[0];
    let resolvedPostUrl = plObj?.platformPostUrl || rawPostObj?.platformPostUrl || null;
    const resolvedPostId = plObj?.platformPostId || rawPostObj?.platformPostId || null;
    if (!resolvedPostUrl && resolvedPostId) {
      resolvedPostUrl = constructPlatformPostUrl(post.channel, String(resolvedPostId), plObj?.accountId?.username);
    }

    await db
      .update(schema.channelPosts)
      .set({
        status: isScheduled ? "scheduled" : "published",
        zernioPostId: zernioRes.id,
        zernioAccountId,
        zernioProfileId,
        zernioConnectionId,
        scheduledFor: assignedSlot,
        publishedAt: isScheduled ? null : nowIso,
        platformPostUrl: resolvedPostUrl,
        platformPostId: resolvedPostId ? String(resolvedPostId) : null,
        errorMessage: null,
        updatedAt: nowIso,
      })
      .where(eq(schema.channelPosts.id, post.id));

    // 6. Check if all posts are completed and rename folder to "-Done"
    const folderRenamed = await checkAndRenameFolderIfDone(contentItem.id);

    const formattedSlot = assignedSlot ? new Date(assignedSlot).toLocaleString() : null;

    await logActivity({
      type: "publish",
      title: isScheduled ? `Queued for ${post.channel}` : `Published to ${post.channel}`,
      description: isScheduled && formattedSlot
        ? `Added to default queue. Next slot: ${formattedSlot} (Post ID: ${zernioRes.id})`
        : `Post ID: ${zernioRes.id}${resolvedPostUrl ? ` (${resolvedPostUrl})` : ""}`,
      contentItemId: contentItem.id,
      channel: post.channel,
      status: "success",
    });

    return {
      success: true,
      postId: post.id,
      zernioPostId: zernioRes.id,
      platformPostUrl: resolvedPostUrl,
      channel: post.channel,
      folderRenamed,
      message: isScheduled && formattedSlot
        ? `Successfully added to ${post.channel} queue (scheduled for ${formattedSlot})!`
        : `Successfully added to ${post.channel} queue!`,
    };
  } catch (publishErr: any) {
    const errorMsg = publishErr?.message || "Publishing failed";
    await db
      .update(schema.channelPosts)
      .set({
        status: "failed",
        errorMessage: errorMsg,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.channelPosts.id, post.id));

    await logActivity({
      type: "error",
      title: `Publish failed on ${post.channel}`,
      description: errorMsg,
      contentItemId: contentItem.id,
      channel: post.channel,
      status: "error",
    });

    throw publishErr;
  }

}

/**
 * Checks if all channel posts for a content item are published, and if so,
 * renames the OneDrive folder to append "-Done" and updates database.
 */
export async function checkAndRenameFolderIfDone(contentItemId: string): Promise<boolean> {
  const contentItems = await db
    .select()
    .from(schema.contentItems)
    .where(eq(schema.contentItems.id, contentItemId));

  if (contentItems.length === 0) return false;
  const item = contentItems[0];

  // If already marked isDone, nothing to rename
  if (item.isDone === 1) return false;

  const posts = await db
    .select()
    .from(schema.channelPosts)
    .where(eq(schema.channelPosts.contentItemId, contentItemId));

  // Consider all published if no non-draft / failed posts remain
  // Or if at least YouTube, LinkedIn, Instagram, Facebook are published (or draft is ignored)
  const allPublished = posts.every(
    (p) => p.status === "published" || p.status === "scheduled"
  );

  if (allPublished && posts.length > 0) {
    try {
      const newFolderName = `${item.originalFolderName}-Done`;
      await renameFolder(item.driveItemId, newFolderName);

      const nowIso = new Date().toISOString();
      await db
        .update(schema.contentItems)
        .set({
          isDone: 1,
          folderName: newFolderName,
          renamedAt: nowIso,
          updatedAt: nowIso,
        })
        .where(eq(schema.contentItems.id, contentItemId));

      await logActivity({
        type: "rename",
        title: "Folder Published & Renamed on OneDrive",
        description: `All channels published. Renamed ${item.originalFolderName} to ${newFolderName}`,
        contentItemId,
        status: "success",
      });

      return true;
    } catch (renameErr) {
      console.error("Failed to rename OneDrive folder to -Done:", renameErr);
      return false;
    }
  }

  return false;
}
