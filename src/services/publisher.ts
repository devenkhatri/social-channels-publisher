import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import {
  getDecryptedApiKey,
  uploadMediaToZernio,
  publishPostToZernio,
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
import { sortSlidesNaturally } from "./extractor";
import { logActivity } from "./activity";

export interface PublishResult {
  success: boolean;
  postId?: string;
  zernioPostId?: string;
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
  const matchingConnections = allConnections.filter(
    (c) => c.platform.toLowerCase() === post.channel.toLowerCase() && c.isActive === 1
  );

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

  // 1e. Fallback to first active matching connection
  if (!targetConnection && matchingConnections.length > 0) {
    targetConnection = matchingConnections[0];
  }

  let targetAccountId: string;

  if (targetConnection) {
    targetAccountId = targetConnection.connectionId;
    zernioAccountId = targetConnection.zernioAccountId;
    zernioProfileId = targetConnection.zernioProfileId;
    zernioConnectionId = targetConnection.id;
  } else {
    // Fallback to legacy zernioProfiles if any
    const allProfiles = await db.select().from(schema.zernioProfiles);
    const legacyProfile = allProfiles.find(
      (p) => p.id === zernioProfileId || p.platform.toLowerCase() === post.channel.toLowerCase()
    );
    if (!legacyProfile) {
      throw new Error(
        `No active connected ${post.channel} channel found. Please add a Zernio account and connect ${post.channel} in Settings.`
      );
    }
    targetAccountId = legacyProfile.profileId;
    zernioAccountId = legacyProfile.zernioAccountId;
    zernioProfileId = legacyProfile.id;
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

  const uploadedMediaUrls: string[] = [];
  const mediaItems: ZernioMediaItem[] = [];

  // Update status to publishing
  await db
    .update(schema.channelPosts)
    .set({ status: "publishing", updatedAt: new Date().toISOString() })
    .where(eq(schema.channelPosts.id, post.id));

  try {
    // 3. Media processing based on platform and post type
    if (post.channel === "linkedin") {
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

    // 4. Construct payload and send to Zernio
    const payload: ZernioPublishPayload = {
      platform: post.channel as any,
      accountId: targetAccountId,
      content: post.body || "",
      title: post.title || undefined,
      mediaItems: mediaItems.length > 0 ? mediaItems : undefined,
      mediaUrls: uploadedMediaUrls.length > 0 ? uploadedMediaUrls : undefined,
      postType: post.postType as any,
      publishNow: !post.scheduledFor,
      scheduledFor: post.scheduledFor || undefined,
    };

    console.log("[Publisher] Sending payload to Zernio:", JSON.stringify(payload, null, 2));
    const zernioRes = await publishPostToZernio(apiKey, payload);
    console.log("[Publisher] Zernio publish result:", JSON.stringify(zernioRes, null, 2));

    // 5. Update post in DB
    const nowIso = new Date().toISOString();
    await db
      .update(schema.channelPosts)
      .set({
        status: post.scheduledFor ? "scheduled" : "published",
        zernioPostId: zernioRes.id,
        zernioAccountId,
        zernioProfileId,
        zernioConnectionId,
        publishedAt: post.scheduledFor ? null : nowIso,
        errorMessage: null,
        updatedAt: nowIso,
      })
      .where(eq(schema.channelPosts.id, post.id));

    // 6. Check if all posts are completed and rename folder to "-Done"
    const folderRenamed = await checkAndRenameFolderIfDone(contentItem.id);

    await logActivity({
      type: "publish",
      title: `Published to ${post.channel}`,
      description: `Post ID: ${zernioRes.id}`,
      contentItemId: contentItem.id,
      channel: post.channel,
      status: "success",
    });

    return {
      success: true,
      postId: post.id,
      zernioPostId: zernioRes.id,
      channel: post.channel,
      folderRenamed,
      message: `Successfully published to ${post.channel}!`,
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
