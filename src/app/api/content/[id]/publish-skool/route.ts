import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { publishPostToSkool } from "@/services/skool";
import { checkAndRenameFolderIfDone } from "@/services/publisher";
import { logActivity } from "@/services/activity";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // 1. Verify content item exists
    const items = await db
      .select()
      .from(schema.contentItems)
      .where(eq(schema.contentItems.id, id));

    if (items.length === 0) {
      return NextResponse.json({ error: "Content item not found" }, { status: 404 });
    }

    const item = items[0];

    // 2. Fetch all channel posts for this content item
    const posts = await db
      .select()
      .from(schema.channelPosts)
      .where(eq(schema.channelPosts.contentItemId, item.id));

    // 3. Verify YouTube post URL is available
    const youtubePost = posts.find((p) => p.channel === "youtube");
    const youtubeUrl = youtubePost?.platformPostUrl?.trim();

    if (!youtubeUrl) {
      return NextResponse.json(
        {
          error:
            "YouTube post URL is not available. Please publish to YouTube first or enter the YouTube live post URL.",
        },
        { status: 400 }
      );
    }

    // 4. Find Skool post or initialize it if missing
    let skoolPost = posts.find((p) => p.channel === "skool");
    if (!skoolPost) {
      const newSkoolId = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      await db.insert(schema.channelPosts).values({
        id: newSkoolId,
        contentItemId: item.id,
        channel: "skool",
        title: body.title || item.title || "Community Update",
        body: body.body || "",
        status: "draft",
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      const freshPosts = await db
        .select()
        .from(schema.channelPosts)
        .where(eq(schema.channelPosts.id, newSkoolId));
      skoolPost = freshPosts[0];
    }

    // 5. Determine title and body to publish
    const publishTitle = (body.title !== undefined ? body.title : skoolPost.title) || item.title || "";
    const publishBody = (body.body !== undefined ? body.body : skoolPost.body) || "";

    // 6. Execute publishing via Apify Skool Actor
    const result = await publishPostToSkool({
      title: publishTitle,
      body: publishBody,
      youtubeUrl,
      labelId: body.labelId || null,
    });

    // 7. Update database record with live post URL, status, and timestamp
    const nowIso = new Date().toISOString();
    await db
      .update(schema.channelPosts)
      .set({
        title: publishTitle,
        body: publishBody,
        status: "published",
        publishedAt: nowIso,
        platformPostUrl: result.url,
        platformPostId: result.postId,
        errorMessage: null,
        updatedAt: nowIso,
      })
      .where(eq(schema.channelPosts.id, skoolPost.id));

    // 8. Auto-rename OneDrive folder to "-Done" if all channels are now published
    const folderRenamed = await checkAndRenameFolderIfDone(item.id);

    // 9. Log activity
    await logActivity({
      type: "publish",
      title: "Published to Skool",
      description: `Post created on Skool with YouTube video: ${result.url}`,
      contentItemId: item.id,
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      postId: skoolPost.id,
      folderRenamed,
      message: "Successfully published to Skool community!",
    });
  } catch (error: any) {
    if (error?.digest) {
      throw error;
    }
    console.error("[Skool Publish API] Error:", error);

    // Record error in database if possible
    try {
      const { id } = await params;
      const skoolPosts = await db
        .select()
        .from(schema.channelPosts)
        .where(eq(schema.channelPosts.contentItemId, id));
      const skoolPost = skoolPosts.find((p) => p.channel === "skool");
      if (skoolPost) {
        await db
          .update(schema.channelPosts)
          .set({
            errorMessage: error?.message || "Failed to publish to Skool",
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.channelPosts.id, skoolPost.id));
      }
    } catch (dbErr) {
      console.warn("Could not record error in DB:", dbErr);
    }

    return NextResponse.json(
      { error: error?.message || "Failed to publish to Skool" },
      { status: 500 }
    );
  }
}

