import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import {
  getDecryptedApiKey,
  uploadMediaToZernio,
  publishPostToZernio,
  ZernioPublishPayload,
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

  // 1. Resolve Zernio Account & Profile
  let zernioAccountId = post.zernioAccountId;
  let zernioProfileId = post.zernioProfileId;

  const allProfiles = await db.select().from(schema.zernioProfiles);
  const matchingProfiles = allProfiles.filter(
    (p) => p.platform.toLowerCase() === post.channel.toLowerCase()
  );

  if (!zernioProfileId) {
    if (matchingProfiles.length === 0) {
      throw new Error(
        `No connected ${post.channel} profile found. Please add a Zernio account and connect ${post.channel} in Settings.`
      );
    }
    const defaultProfile = matchingProfiles[0];
    zernioProfileId = defaultProfile.id;
    zernioAccountId = defaultProfile.zernioAccountId;
  }

  const profile = allProfiles.find((p) => p.id === zernioProfileId);
  if (!profile) {
    throw new Error(`Configured profile for ${post.channel} was not found.`);
  }

  if (!zernioAccountId) {
    zernioAccountId = profile.zernioAccountId;
  }

  const apiKey = await getDecryptedApiKey(zernioAccountId);

  // Mark post status as 'publishing' in DB
  await db
    .update(schema.channelPosts)
    .set({
      status: "publishing",
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
        }
      }
    } else if (post.channel === "youtube") {
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
      }
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
        }
      }
    }

    // 4. Construct payload and send to Zernio
    const payload: ZernioPublishPayload = {
      platform: post.channel as any,
      accountId: profile.profileId,
      content: post.body || "",
      title: post.title || undefined,
      mediaUrls: uploadedMediaUrls.length > 0 ? uploadedMediaUrls : undefined,
      postType: post.postType as any,
      publishNow: !post.scheduledFor,
      scheduledFor: post.scheduledFor || undefined,
    };

    const zernioRes = await publishPostToZernio(apiKey, payload);

    // 5. Update post in DB
    const nowIso = new Date().toISOString();
    await db
      .update(schema.channelPosts)
      .set({
        status: post.scheduledFor ? "scheduled" : "published",
        zernioPostId: zernioRes.id,
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
