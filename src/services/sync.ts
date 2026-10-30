import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import {
  listFolders,
  listFolderChildren,
  getFileContentAsText,
  DriveChildItem,
} from "./onedrive";
import {
  extractTitleAndBody,
  extractYouTubeContent,
  extractFacebookContent,
  extractInstagramContent,
  extractTwitterContent,
  extractLinkedInContent,
  extractSkoolContent,
  sortSlidesNaturally,
  parseFolderStatus,
  shouldSkipFolder,
  SlideItem,
} from "./extractor";
import { logActivity } from "./activity";
import { syncZernioStatuses, ZernioSyncResult } from "./zernio";

export interface SyncResult {
  success: boolean;
  message: string;
  syncedFolders: number;
  newItems: number;
  updatedItems: number;
  skippedFolders: number;
  lastSyncedAt: string;
  zernioSync?: ZernioSyncResult | null;
}

/**
 * Performs full content sync from the configured OneDrive parent folder
 */
export async function syncFromOneDrive(): Promise<SyncResult> {
  // 1. Get configured parent folder ID
  const allSettings = await db.select().from(schema.settings);
  const parentFolderSetting = allSettings.find(
    (s) => s.key === "onedrive_parent_folder_id"
  );

  if (!parentFolderSetting || !parentFolderSetting.value) {
    throw new Error(
      "OneDrive parent folder is not configured. Please select your content folder in Settings."
    );
  }

  const parentFolderId = parentFolderSetting.value;

  // 2. Fetch all child folders inside the parent folder
  const folders = await listFolders(parentFolderId);

  let newCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const folder of folders) {
    // Check skip rules:
    // 1. Skip if folder name does not start with a number (0-9)
    // 2. Skip if folder name ends with "Skip" or "Skipped" (case-insensitive)
    if (shouldSkipFolder(folder.name)) {
      skippedCount++;
      // If folder was previously tracked in database, clean it up since it is marked to skip
      await db
        .delete(schema.contentItems)
        .where(eq(schema.contentItems.driveItemId, folder.id));
      continue;
    }

    const { isDone, originalName } = parseFolderStatus(folder.name);

    // Check if content item already exists by driveItemId (immutable)
    const existing = await db
      .select()
      .from(schema.contentItems)
      .where(eq(schema.contentItems.driveItemId, folder.id));

    // If folder was already synced as -Done and folder name hasn't changed, skip heavy file inspection
    if (
      existing.length > 0 &&
      existing[0].isDone === 1 &&
      isDone &&
      existing[0].folderName === folder.name
    ) {
      continue;
    }

    // 3. List children inside this content folder
    let children: DriveChildItem[] = [];
    try {
      children = await listFolderChildren(folder.id);
    } catch (err) {
      console.error(`Failed to list children for folder ${folder.name}:`, err);
      continue;
    }

    // Categorize files: separate markdown file per channel with caption.md fallback
    const facebookFile = children.find(
      (c) => !c.isFolder && /^(facebook|fb)(-post)?\.md$/i.test(c.name)
    );
    const youtubeFile = children.find(
      (c) => !c.isFolder && /^(youtube|yt)(-post)?\.md$/i.test(c.name)
    );
    const instagramFile = children.find(
      (c) => !c.isFolder && /^(instagram|ig)(-post)?\.md$/i.test(c.name)
    );
    const twitterFile = children.find(
      (c) => !c.isFolder && /^(twitter|tweet|threads|thread|x)(-post)?\.md$/i.test(c.name)
    );
    const linkedinFile = children.find(
      (c) => !c.isFolder && /^linkedin(-post)?\.md$/i.test(c.name)
    );
    const skoolFile = children.find(
      (c) => !c.isFolder && /^skool(-post)?\.md$/i.test(c.name)
    );
    const captionFile = children.find(
      (c) => !c.isFolder && /^caption\.md$/i.test(c.name)
    );
    const coverFile = children.find(
      (c) => !c.isFolder && /^cover\.(svg|png|jpg|webp)$/i.test(c.name)
    );
    const hyperframesVideo = children.find(
      (c) => !c.isFolder && /-hyperframes\.mp4$/i.test(c.name)
    );
    const regularVideo = children.find(
      (c) => !c.isFolder && /\.mp4$/i.test(c.name) && !/-hyperframes\.mp4$/i.test(c.name)
    );
    const pdfFile = children.find((c) => !c.isFolder && /\.pdf$/i.test(c.name));
    const slidesFolder = children.find((c) => c.isFolder && /^slides$/i.test(c.name));

    // Discover and sort slides naturally if slides/ exists
    let sortedSlides: SlideItem[] = [];
    if (slidesFolder) {
      try {
        const slideFiles = await listFolderChildren(slidesFolder.id);
        const imageSlides = slideFiles.filter(
          (f) => !f.isFolder && /\.(svg|png|jpg|jpeg|webp)$/i.test(f.name)
        );
        sortedSlides = sortSlidesNaturally(imageSlides);
      } catch (err) {
        console.error(`Failed to list slides in ${folder.name}:`, err);
      }
    }

    // Read channel markdown files
    let facebookText = "";
    let youtubeText = "";
    let instagramText = "";
    let twitterText = "";
    let linkedinText = "";
    let skoolText = "";
    let captionText = "";

    try {
      if (facebookFile) {
        facebookText = await getFileContentAsText(facebookFile.id, facebookFile.downloadUrl);
      }
    } catch (err) {
      console.warn(`Could not read facebook post for ${folder.name}:`, err);
    }

    try {
      if (youtubeFile) {
        youtubeText = await getFileContentAsText(youtubeFile.id, youtubeFile.downloadUrl);
      }
    } catch (err) {
      console.warn(`Could not read youtube post for ${folder.name}:`, err);
    }

    try {
      if (instagramFile) {
        instagramText = await getFileContentAsText(instagramFile.id, instagramFile.downloadUrl);
      }
    } catch (err) {
      console.warn(`Could not read instagram post for ${folder.name}:`, err);
    }

    try {
      if (twitterFile) {
        twitterText = await getFileContentAsText(twitterFile.id, twitterFile.downloadUrl);
      }
    } catch (err) {
      console.warn(`Could not read twitter/threads post for ${folder.name}:`, err);
    }

    try {
      if (linkedinFile) {
        linkedinText = await getFileContentAsText(linkedinFile.id, linkedinFile.downloadUrl);
      }
    } catch (err) {
      console.warn(`Could not read linkedin-post.md for ${folder.name}:`, err);
    }

    try {
      if (skoolFile) {
        skoolText = await getFileContentAsText(skoolFile.id, skoolFile.downloadUrl);
      }
    } catch (err) {
      console.warn(`Could not read skool-post.md for ${folder.name}:`, err);
    }

    try {
      if (captionFile) {
        captionText = await getFileContentAsText(captionFile.id, captionFile.downloadUrl);
      }
    } catch (err) {
      console.warn(`Could not read caption.md for ${folder.name}:`, err);
    }

    // Channel-specific extracted content with caption.md fallback
    const captionExtract = extractTitleAndBody(captionText);
    const facebookExtract = extractFacebookContent(facebookText, captionText);
    const youtubeExtract = extractYouTubeContent(youtubeText, captionText);
    const instagramExtract = extractInstagramContent(instagramText, captionText);
    const twitterExtract = extractTwitterContent(twitterText, captionText);
    const linkedinExtract = extractLinkedInContent(linkedinText, captionText);
    const skoolExtract = extractSkoolContent(skoolText, captionText);

    // Primary title for the content item
    const primaryTitle =
      youtubeExtract.title ||
      linkedinExtract.title ||
      captionExtract.title ||
      skoolExtract.title ||
      originalName;

    // Cover image URL or Item ID
    const coverImage = coverFile?.downloadUrl || coverFile?.id || sortedSlides[0]?.downloadUrl || null;

    // Reuse existing query result
    let contentItemId: string;
    const nowIso = new Date().toISOString();

    if (existing.length > 0) {
      contentItemId = existing[0].id;
      const wasDone = existing[0].isDone === 1;
      const isNowDone = isDone;

      // Update title if primaryTitle has a good extracted title
      const newTitle =
        primaryTitle && primaryTitle !== originalName
          ? primaryTitle
          : existing[0].title || primaryTitle;

      await db
        .update(schema.contentItems)
        .set({
          folderName: folder.name,
          originalFolderName: originalName,
          folderPath: folder.webUrl || folder.name,
          isDone: isNowDone ? 1 : 0,
          title: newTitle,
          coverImage: coverImage || existing[0].coverImage,
          slideCount: sortedSlides.length,
          syncedAt: nowIso,
          renamedAt: isNowDone && !wasDone ? nowIso : existing[0].renamedAt,
          updatedAt: nowIso,
        })
        .where(eq(schema.contentItems.id, contentItemId));

      updatedCount++;
    } else {
      contentItemId = crypto.randomUUID();
      await db.insert(schema.contentItems).values({
        id: contentItemId,
        folderName: folder.name,
        originalFolderName: originalName,
        folderPath: folder.webUrl || folder.name,
        driveItemId: folder.id,
        isDone: isDone ? 1 : 0,
        title: primaryTitle,
        coverImage,
        slideCount: sortedSlides.length,
        syncedAt: nowIso,
        renamedAt: isDone ? nowIso : null,
      });

      newCount++;
    }

    // Populate / update 7 channel posts
    const channels = [
      "linkedin",
      "linkedin_page",
      "threads",
      "youtube",
      "instagram",
      "facebook",
      "skool",
    ] as const;

    for (const channel of channels) {
      const existingPosts = await db
        .select()
        .from(schema.channelPosts)
        .where(
          and(
            eq(schema.channelPosts.contentItemId, contentItemId),
            eq(schema.channelPosts.channel, channel)
          )
        );

      // Compute initial draft content for this channel
      let postTitle: string | null = null;
      let postBody: string | null = null;
      let mediaType: string | null = null;
      let postType: string | null = "feed";

      if (channel === "linkedin") {
        postTitle = linkedinExtract.title || captionExtract.title || primaryTitle;
        postBody = linkedinExtract.body || captionExtract.body || "";
        if (pdfFile) {
          mediaType = "pdf";
          postType = "document";
        } else if (hyperframesVideo || regularVideo) {
          mediaType = "video";
          postType = "video";
        } else if (sortedSlides.length > 0) {
          mediaType = "carousel";
          postType = "carousel";
        }
      } else if (channel === "linkedin_page") {
        // LinkedIn Business Page mirrors LinkedIn Personal
        postTitle = linkedinExtract.title || captionExtract.title || primaryTitle;
        postBody = linkedinExtract.body || captionExtract.body || "";
        if (pdfFile) {
          mediaType = "pdf";
          postType = "document";
        } else if (hyperframesVideo || regularVideo) {
          mediaType = "video";
          postType = "video";
        } else if (sortedSlides.length > 0) {
          mediaType = "carousel";
          postType = "carousel";
        }
      } else if (channel === "threads") {
        postTitle = null;
        // Zernio supports multithreaded sequences on Threads via platformSpecificData.threadItems!
        // Use multithreaded variant if available; otherwise fallback to single tweet variant or caption.
        postBody = twitterExtract.threadVariant || twitterExtract.singleTweetVariant || captionExtract.body || "";
        mediaType = null;
        postType = "feed";
      } else if (channel === "youtube") {
        postTitle = youtubeExtract.title || captionExtract.title || primaryTitle;
        postBody = youtubeExtract.body || captionExtract.body || "";
        if (hyperframesVideo) {
          mediaType = "video_reel";
          postType = "reel";
        } else if (regularVideo) {
          mediaType = "video";
          postType = "video";
        }
      } else if (channel === "instagram") {
        postTitle = null;
        postBody = instagramExtract.body || captionExtract.body || "";
        if (hyperframesVideo) {
          mediaType = "video_reel";
          postType = "reel";
        } else if (regularVideo) {
          mediaType = "video";
          postType = "reel";
        } else if (sortedSlides.length > 0) {
          mediaType = "carousel";
          postType = "carousel";
        }
      } else if (channel === "facebook") {
        postTitle = null;
        postBody = facebookExtract.body || captionExtract.body || "";
        if (hyperframesVideo) {
          mediaType = "video_reel";
          postType = "reel";
        } else if (regularVideo) {
          mediaType = "video";
          postType = "reel";
        } else if (sortedSlides.length > 0) {
          mediaType = "carousel";
          postType = "carousel";
        }
      } else if (channel === "skool") {
        postTitle = skoolExtract.title || captionExtract.title || primaryTitle;
        postBody = skoolExtract.body || captionExtract.body || "";
        mediaType = null;
        postType = "feed";
      }

      if (existingPosts.length === 0) {
        await db.insert(schema.channelPosts).values({
          id: crypto.randomUUID(),
          contentItemId,
          channel,
          title: postTitle,
          body: postBody,
          mediaType,
          postType,
          status: (isDone && channel !== "skool") ? "published" : "draft",
          publishedAt: (isDone && channel !== "skool") ? nowIso : null,
        });
      } else {
        // If folder is marked isDone, reflect published status (except Skool which is published manually)
        const post = existingPosts[0];
        if (isDone && post.status === "draft" && channel !== "skool") {
          await db
            .update(schema.channelPosts)
            .set({
              status: "published",
              publishedAt: nowIso,
              updatedAt: nowIso,
            })
            .where(eq(schema.channelPosts.id, post.id));
        } else if (post.status === "draft") {
          // If post is still in draft:
          // Check if we have newly available dedicated content or updated text
          const hasDedicatedFile =
            (channel === "facebook" && Boolean(facebookFile)) ||
            (channel === "youtube" && Boolean(youtubeFile)) ||
            (channel === "instagram" && Boolean(instagramFile)) ||
            (channel === "threads" && Boolean(twitterFile)) ||
            (channel === "linkedin" && Boolean(linkedinFile)) ||
            (channel === "skool" && Boolean(skoolFile));

          const contentChanged =
            (postTitle !== null && postTitle !== post.title) ||
            (Boolean(postBody) && postBody !== post.body);

          if (hasDedicatedFile || contentChanged || channel === "linkedin_page") {
            let updateTitle = postTitle;
            let updateBody = postBody;
            let updateMediaType: string | null = post.mediaType || mediaType;
            let updatePostType: string | null = post.postType || postType;

            if (channel === "linkedin_page") {
              const liPost = await db
                .select()
                .from(schema.channelPosts)
                .where(
                  and(
                    eq(schema.channelPosts.contentItemId, contentItemId),
                    eq(schema.channelPosts.channel, "linkedin")
                  )
                );
              if (liPost.length > 0) {
                updateTitle = liPost[0].title;
                updateBody = liPost[0].body;
                updateMediaType = liPost[0].mediaType;
                updatePostType = liPost[0].postType;
              }
            }

            await db
              .update(schema.channelPosts)
              .set({
                title: updateTitle,
                body: updateBody,
                mediaType: updateMediaType,
                postType: updatePostType,
                updatedAt: nowIso,
              })
              .where(eq(schema.channelPosts.id, post.id));
          }
        }
      }
    }
  }

  // 4. Update last_synced_at in settings
  const lastSyncedAt = new Date().toISOString();
  const existingSyncSetting = allSettings.find((s) => s.key === "last_synced_at");

  if (existingSyncSetting) {
    await db
      .update(schema.settings)
      .set({ value: lastSyncedAt, updatedAt: lastSyncedAt })
      .where(eq(schema.settings.key, "last_synced_at"));
  } else {
    await db.insert(schema.settings).values({
      key: "last_synced_at",
      value: lastSyncedAt,
    });
  }

  // 4. Fetch the latest live status (queue / published / failed) from Zernio and sync statuses
  let zernioSyncResult: ZernioSyncResult | null = null;
  try {
    zernioSyncResult = await syncZernioStatuses();
  } catch (zernioErr) {
    console.warn("Failed to sync Zernio statuses during content sync:", zernioErr);
  }

  const processedCount = folders.length - skippedCount;
  const skipMessage = skippedCount > 0 ? ` (${skippedCount} skipped)` : "";
  const zernioMessage = zernioSyncResult
    ? ` • Synced ${zernioSyncResult.matchedPosts} Zernio posts (${zernioSyncResult.scheduledCount} queued, ${zernioSyncResult.publishedCount} published)`
    : "";

  await logActivity({
    type: "sync",
    title: "OneDrive & Zernio Sync",
    description: `Processed ${processedCount} folders${skipMessage} (${newCount} new, ${updatedCount} updated)${zernioMessage}`,
    status: "success",
  });

  return {
    success: true,
    message: `Processed ${processedCount} folders${skipMessage}${zernioMessage}`,
    syncedFolders: processedCount,
    newItems: newCount,
    updatedItems: updatedCount,
    skippedFolders: skippedCount,
    lastSyncedAt,
    zernioSync: zernioSyncResult,
  };
}


