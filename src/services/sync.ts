import { db, schema, checkpointDb } from "@/db";
import { eq, and } from "drizzle-orm";
import {
  listFolders,
  listFolderChildren,
  getFileContentAsText,
  DriveChildItem,
  OneDriveFolderItem,
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
 * Processes a single folder: discovers files, downloads markdown/slides in parallel,
 * extracts titles/bodies, and persists contentItems and channelPosts into the database.
 */
async function processSingleFolder(
  folder: OneDriveFolderItem,
  existing?: any
): Promise<{ isNew: boolean; isUpdated: boolean }> {
  const { isDone, originalName } = parseFolderStatus(folder.name);
  const nowIso = new Date().toISOString();

  // 1. List children inside this content folder
  let children: DriveChildItem[] = [];
  try {
    children = await listFolderChildren(folder.id);
  } catch (err) {
    console.error(`Failed to list children for folder ${folder.name}:`, err);
    return { isNew: false, isUpdated: false };
  }

  // 2. Categorize files
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

  // 3. Parallel fetch: Slides and all 7 markdown files downloaded simultaneously
  const slidesPromise = slidesFolder
    ? listFolderChildren(slidesFolder.id)
        .then((files) =>
          sortSlidesNaturally(
            files.filter((f) => !f.isFolder && /\.(svg|png|jpg|jpeg|webp)$/i.test(f.name))
          )
        )
        .catch((err) => {
          console.error(`Failed to list slides in ${folder.name}:`, err);
          return [] as SlideItem[];
        })
    : Promise.resolve([] as SlideItem[]);

  const [
    sortedSlides,
    facebookText,
    youtubeText,
    instagramText,
    twitterText,
    linkedinText,
    skoolText,
    captionText,
  ] = await Promise.all([
    slidesPromise,
    facebookFile
      ? getFileContentAsText(facebookFile.id, facebookFile.downloadUrl).catch((err) => {
          console.warn(`Could not read facebook post for ${folder.name}:`, err);
          return "";
        })
      : Promise.resolve(""),
    youtubeFile
      ? getFileContentAsText(youtubeFile.id, youtubeFile.downloadUrl).catch((err) => {
          console.warn(`Could not read youtube post for ${folder.name}:`, err);
          return "";
        })
      : Promise.resolve(""),
    instagramFile
      ? getFileContentAsText(instagramFile.id, instagramFile.downloadUrl).catch((err) => {
          console.warn(`Could not read instagram post for ${folder.name}:`, err);
          return "";
        })
      : Promise.resolve(""),
    twitterFile
      ? getFileContentAsText(twitterFile.id, twitterFile.downloadUrl).catch((err) => {
          console.warn(`Could not read twitter/threads post for ${folder.name}:`, err);
          return "";
        })
      : Promise.resolve(""),
    linkedinFile
      ? getFileContentAsText(linkedinFile.id, linkedinFile.downloadUrl).catch((err) => {
          console.warn(`Could not read linkedin-post.md for ${folder.name}:`, err);
          return "";
        })
      : Promise.resolve(""),
    skoolFile
      ? getFileContentAsText(skoolFile.id, skoolFile.downloadUrl).catch((err) => {
          console.warn(`Could not read skool-post.md for ${folder.name}:`, err);
          return "";
        })
      : Promise.resolve(""),
    captionFile
      ? getFileContentAsText(captionFile.id, captionFile.downloadUrl).catch((err) => {
          console.warn(`Could not read caption.md for ${folder.name}:`, err);
          return "";
        })
      : Promise.resolve(""),
  ]);

  // 4. Extract content
  const captionExtract = extractTitleAndBody(captionText);
  const facebookExtract = extractFacebookContent(facebookText, captionText);
  const youtubeExtract = extractYouTubeContent(youtubeText, captionText);
  const instagramExtract = extractInstagramContent(instagramText, captionText);
  const twitterExtract = extractTwitterContent(twitterText, captionText);
  const linkedinExtract = extractLinkedInContent(linkedinText, captionText);
  const skoolExtract = extractSkoolContent(skoolText, captionText);

  const primaryTitle =
    youtubeExtract.title ||
    linkedinExtract.title ||
    captionExtract.title ||
    skoolExtract.title ||
    originalName;

  const coverImage = coverFile?.downloadUrl || coverFile?.id || sortedSlides[0]?.downloadUrl || null;

  let contentItemId: string;
  let isNew = false;
  let isUpdated = false;

  if (existing) {
    contentItemId = existing.id;
    const wasDone = existing.isDone === 1;
    const isNowDone = isDone;

    const newTitle =
      primaryTitle && primaryTitle !== originalName
        ? primaryTitle
        : existing.title || primaryTitle;

    await db
      .update(schema.contentItems)
      .set({
        folderName: folder.name,
        originalFolderName: originalName,
        folderPath: folder.webUrl || folder.name,
        isDone: isNowDone ? 1 : 0,
        title: newTitle,
        coverImage: coverImage || existing.coverImage,
        slideCount: sortedSlides.length,
        syncedAt: nowIso,
        renamedAt: isNowDone && !wasDone ? nowIso : existing.renamedAt,
        updatedAt: nowIso,
      })
      .where(eq(schema.contentItems.id, contentItemId));

    isUpdated = true;
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

    isNew = true;
  }

  // 5. Populate / update 7 channel posts (linkedin before linkedin_page for mirroring)
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

  return { isNew, isUpdated };
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

  // 2. Fetch all child folders inside the parent folder (with lastModifiedDateTime & cTag)
  const folders = await listFolders(parentFolderId);

  // 3. Pre-load all content items from SQLite into memory Map for fast O(1) lookups
  const allExistingItems = await db.select().from(schema.contentItems);
  const existingMap = new Map(allExistingItems.map((i) => [i.driveItemId, i]));

  let newCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const nowIso = new Date().toISOString();

  const foldersToProcess: Array<{ folder: OneDriveFolderItem; existing?: any }> = [];

  for (const folder of folders) {
    // Check skip rules:
    // 1. Skip if folder name does not start with a number (0-9)
    // 2. Skip if folder name ends with "Skip" or "Skipped" (case-insensitive)
    if (shouldSkipFolder(folder.name)) {
      skippedCount++;
      if (existingMap.has(folder.id)) {
        await db
          .delete(schema.contentItems)
          .where(eq(schema.contentItems.driveItemId, folder.id));
      }
      continue;
    }

    const { isDone, originalName } = parseFolderStatus(folder.name);
    const existing = existingMap.get(folder.id);

    if (existing) {
      // If folder was already synced as -Done and folder name hasn't changed, fast skip
      if (
        existing.isDone === 1 &&
        isDone &&
        existing.folderName === folder.name
      ) {
        continue;
      }

      // Check if folder content has NOT been modified since our last sync
      if (folder.lastModifiedDateTime && existing.syncedAt) {
        const driveMod = new Date(folder.lastModifiedDateTime).getTime();
        const syncedTime = new Date(existing.syncedAt).getTime();
        if (driveMod <= syncedTime) {
          // Content inside folder hasn't changed.
          // If folder name or isDone status changed (e.g. renamed to -Done), update lightweight DB metadata only
          if (existing.isDone !== (isDone ? 1 : 0) || existing.folderName !== folder.name) {
            await db
              .update(schema.contentItems)
              .set({
                folderName: folder.name,
                originalFolderName: originalName,
                isDone: isDone ? 1 : 0,
                updatedAt: nowIso,
              })
              .where(eq(schema.contentItems.id, existing.id));
            updatedCount++;
          }
          continue; // Fast skip: content is up to date!
        }
      }
    }

    // Queue for parallel inspection
    foldersToProcess.push({ folder, existing });
  }

  // 4. Process folders that need full inspection with controlled concurrency (4 at a time)
  const CONCURRENCY = 4;
  for (let i = 0; i < foldersToProcess.length; i += CONCURRENCY) {
    const chunk = foldersToProcess.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(({ folder, existing }) => processSingleFolder(folder, existing))
    );
    for (const res of results) {
      if (res.isNew) newCount++;
      else if (res.isUpdated) updatedCount++;
    }
  }

  checkpointDb();

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


