import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { listFolderChildren, renameFolder } from "@/services/onedrive";
import { sortSlidesNaturally } from "@/services/extractor";

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
        const mediaType = liPost?.mediaType || null;
        const postType = liPost?.postType || "feed";

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

      assets.captionFile = children.find((c) => !c.isFolder && /^caption\.md$/i.test(c.name)) || null;
      assets.linkedinFile = children.find((c) => !c.isFolder && /^linkedin(-post)?\.md$/i.test(c.name)) || null;
      assets.skoolFile = children.find((c) => !c.isFolder && /^skool(-post)?\.md$/i.test(c.name)) || null;
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
    } catch (graphError) {
      console.warn("Could not fetch live OneDrive assets for item:", graphError);
    }

    return NextResponse.json({
      item,
      posts,
      assets,
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
