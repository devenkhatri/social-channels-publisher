import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { listFolderChildren, renameFolder, getFileContentAsText } from "@/services/onedrive";
import { sortSlidesNaturally, extractYouTubeContent, extractTwitterContent } from "@/services/extractor";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const items = await db
      .select()
      .from(schema.contentItems)
      .where(eq(schema.contentItems.id, id));

    if (items.length === 0) {
      return NextResponse.json({ error: "Content item not found" }, { status: 404 });
    }

    const item = items[0];

    // Fetch channel posts and ensure all supported channels exist
    const requiredChannels = [
      "linkedin",
      "linkedin_page",
      "threads",
      "youtube",
      "instagram",
      "facebook",
      "skool",
    ] as const;

    let posts = await db
      .select()
      .from(schema.channelPosts)
      .where(eq(schema.channelPosts.contentItemId, item.id));

    const existingChannelSet = new Set(posts.map((p) => p.channel));
    const missingChannels = requiredChannels.filter((c) => !existingChannelSet.has(c));

    if (missingChannels.length > 0) {
      const liPost = posts.find((p) => p.channel === "linkedin");
      for (const ch of missingChannels) {
        const postTitle = liPost?.title || item.title || "";
        const postBody = liPost?.body || "";
        let mediaType = liPost?.mediaType || null;
        let postType = liPost?.postType || "feed";

        if (ch === "linkedin" || ch === "linkedin_page") {
          postType = "document";
          mediaType = "pdf";
        } else if (ch === "youtube" || ch === "instagram" || ch === "facebook") {
          postType = "reel";
          mediaType = "video_reel";
        } else if (ch === "threads") {
          postType = "feed";
          mediaType = null;
        }

        await db.insert(schema.channelPosts).values({
          id: crypto.randomUUID(),
          contentItemId: item.id,
          channel: ch,
          title: postTitle,
          body: postBody,
          mediaType,
          postType,
          status: "draft",
        });
      }

      posts = await db
        .select()
        .from(schema.channelPosts)
        .where(eq(schema.channelPosts.contentItemId, item.id));
    }

    // Try to fetch live OneDrive assets
    let assets: any = {
      facebookFile: null,
      youtubeFile: null,
      instagramFile: null,
      twitterFile: null,
      threadsFile: null,
      captionFile: null,
      linkedinFile: null,
      skoolFile: null,
      coverPromptFile: null,
      coverFile: null,
      hyperframesVideo: null,
      videos: [],
      pdfs: [],
      slides: [],
    };

    try {
      const children = await listFolderChildren(item.driveItemId);

      assets.facebookFile = children.find((c) => !c.isFolder && /^(facebook|fb)(-post)?\.md$/i.test(c.name)) || null;
      assets.youtubeFile = children.find((c) => !c.isFolder && /^(youtube|yt)(-post)?\.md$/i.test(c.name)) || null;
      assets.instagramFile = children.find((c) => !c.isFolder && /^(instagram|ig)(-post)?\.md$/i.test(c.name)) || null;
      assets.twitterFile = children.find((c) => !c.isFolder && /^(twitter|tweet|threads|thread|x)(-post)?\.md$/i.test(c.name)) || null;
      assets.threadsFile = assets.twitterFile;
      assets.linkedinFile = children.find((c) => !c.isFolder && /^linkedin(-post)?\.md$/i.test(c.name)) || null;
      assets.skoolFile = children.find((c) => !c.isFolder && /^skool(-post)?\.md$/i.test(c.name)) || null;
      assets.captionFile = children.find((c) => !c.isFolder && /^caption\.md$/i.test(c.name)) || null;
      assets.coverPromptFile = children.find((c) => !c.isFolder && /^cover-prompt\.md$/i.test(c.name)) || null;
      assets.coverFile = children.find((c) => !c.isFolder && /^cover\.(svg|png|jpg|webp)$/i.test(c.name)) || null;
      assets.hyperframesVideo = children.find((c) => !c.isFolder && /-hyperframes\.mp4$/i.test(c.name)) || null;
      assets.videos = children.filter((c) => !c.isFolder && /\.mp4$/i.test(c.name));
      assets.pdfs = children.filter((c) => !c.isFolder && /\.pdf$/i.test(c.name));

      const slidesFolder = children.find((c) => c.isFolder && /^slides$/i.test(c.name));
      if (slidesFolder) {
        const slideFiles = await listFolderChildren(slidesFolder.id);
        const imageSlides = slideFiles.filter(
          (f) => !f.isFolder && /\.(svg|png|jpg|jpeg|webp)$/i.test(f.name)
        );
        assets.slides = sortSlidesNaturally(imageSlides);
      }

      if (assets.youtubeFile) {
        try {
          const ytText = await getFileContentAsText(assets.youtubeFile.id, assets.youtubeFile.downloadUrl);
          const ytExt = extractYouTubeContent(ytText);
          assets.youtubeData = {
            titleOptions: ytExt.titleOptions || [],
            tags: ytExt.tags || [],
          };
        } catch (ytErr) {
          console.warn("Could not extract youtube.md metadata:", ytErr);
        }
      }

      if (assets.twitterFile) {
        try {
          const twText = await getFileContentAsText(assets.twitterFile.id, assets.twitterFile.downloadUrl);
          const twExt = extractTwitterContent(twText);
          const targetThreadsBody = twExt.threadVariant || twExt.singleTweetVariant || twExt.body || "";

          const threadsPost = posts.find((p) => p.channel === "threads");
          if (threadsPost && threadsPost.status === "draft") {
            const updates: any = {};
            if (targetThreadsBody && threadsPost.body !== targetThreadsBody) {
              updates.body = targetThreadsBody;
              threadsPost.body = targetThreadsBody;
            }
            if (threadsPost.postType === "carousel" || threadsPost.mediaType === "carousel" || threadsPost.mediaType === "cover") {
              updates.postType = "feed";
              updates.mediaType = null;
              threadsPost.postType = "feed";
              threadsPost.mediaType = null;
            }
            if (Object.keys(updates).length > 0) {
              updates.updatedAt = new Date().toISOString();
              await db
                .update(schema.channelPosts)
                .set(updates)
                .where(eq(schema.channelPosts.id, threadsPost.id));
            }
          }
        } catch (twErr) {
          console.warn("Could not extract twitter/threads content:", twErr);
        }
      }
    } catch (graphError) {
      console.warn("Could not fetch live OneDrive assets for item:", graphError);
    }

    // Fetch all content items ordered identically to dashboard to determine prev/next record
    const allItems = await db
      .select({
        id: schema.contentItems.id,
        title: schema.contentItems.title,
        folderName: schema.contentItems.folderName,
        isDone: schema.contentItems.isDone,
      })
      .from(schema.contentItems)
      .orderBy(desc(schema.contentItems.createdAt));

    const currentIndex = allItems.findIndex((it) => it.id === item.id);
    const prevItem = currentIndex > 0 ? allItems[currentIndex - 1] : null;
    const nextItem = currentIndex !== -1 && currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null;

    const navigation = {
      prevId: prevItem ? prevItem.id : null,
      prevTitle: prevItem ? (prevItem.title || prevItem.folderName) : null,
      nextId: nextItem ? nextItem.id : null,
      nextTitle: nextItem ? (nextItem.title || nextItem.folderName) : null,
      currentIndex: currentIndex !== -1 ? currentIndex + 1 : 1,
      totalCount: allItems.length,
    };

    return NextResponse.json({
      item,
      posts,
      assets,
      navigation,
    });
  } catch (error: any) {
    if (error?.digest) {
      throw error;
    }
    console.error("Error fetching content item:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch content item" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const items = await db
      .select()
      .from(schema.contentItems)
      .where(eq(schema.contentItems.id, id));

    if (items.length === 0) {
      return NextResponse.json({ error: "Content item not found" }, { status: 404 });
    }

    const item = items[0];
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (body.title !== undefined) {
      updateData.title = body.title;
    }

    // Handle marking as done and OneDrive folder rename
    if (body.isDone !== undefined) {
      const isDone = Boolean(body.isDone);
      updateData.isDone = isDone ? 1 : 0;

      if (isDone && item.isDone === 0) {
        // Renaming on OneDrive if requested
        if (body.renameOnOneDrive) {
          try {
            const newName = `${item.originalFolderName}-Done`;
            await renameFolder(item.driveItemId, newName);
            updateData.folderName = newName;
            updateData.renamedAt = new Date().toISOString();
          } catch (renameErr: any) {
            console.error("Failed to rename folder on OneDrive:", renameErr);
            // We can still proceed with DB update but log warning
          }
        }
      } else if (!isDone && item.isDone === 1) {
        // Unmarking done
        if (body.renameOnOneDrive) {
          try {
            const newName = item.originalFolderName;
            await renameFolder(item.driveItemId, newName);
            updateData.folderName = newName;
            updateData.renamedAt = null;
          } catch (renameErr: any) {
            console.error("Failed to remove -Done on OneDrive:", renameErr);
          }
        }
      }
    }

    await db
      .update(schema.contentItems)
      .set(updateData)
      .where(eq(schema.contentItems.id, id));

    const updated = await db
      .select()
      .from(schema.contentItems)
      .where(eq(schema.contentItems.id, id));

    return NextResponse.json({ success: true, item: updated[0] });
  } catch (error: any) {
    if (error?.digest) {
      throw error;
    }
    console.error("Error updating content item:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update content item" },
      { status: 500 }
    );
  }
}
