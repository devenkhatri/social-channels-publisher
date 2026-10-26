import { NextRequest, NextResponse } from "next/server";
import { publishChannelPost, checkAndRenameFolderIfDone } from "@/services/publisher";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { renameFolder } from "@/services/onedrive";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId, contentItemId, markDoneOnly } = body;

    // Direct Mark as Done & Rename on OneDrive
    if (markDoneOnly && contentItemId) {
      const items = await db
        .select()
        .from(schema.contentItems)
        .where(eq(schema.contentItems.id, contentItemId));

      if (items.length === 0) {
        return NextResponse.json({ error: "Content item not found" }, { status: 404 });
      }

      const item = items[0];
      const newName = `${item.originalFolderName}-Done`;

      try {
        await renameFolder(item.driveItemId, newName);
      } catch (err: any) {
        console.error("OneDrive rename error:", err);
      }

      const nowIso = new Date().toISOString();
      await db
        .update(schema.contentItems)
        .set({
          isDone: 1,
          folderName: newName,
          renamedAt: nowIso,
          updatedAt: nowIso,
        })
        .where(eq(schema.contentItems.id, contentItemId));

      // Mark all posts as published
      await db
        .update(schema.channelPosts)
        .set({
          status: "published",
          publishedAt: nowIso,
          updatedAt: nowIso,
        })
        .where(eq(schema.channelPosts.contentItemId, contentItemId));

      return NextResponse.json({
        success: true,
        message: `Marked as done and renamed folder to ${newName} on OneDrive`,
        newName,
      });
    }

    // Publish single post
    if (postId) {
      const result = await publishChannelPost(postId);
      return NextResponse.json(result);
    }

    // Publish all posts for a content item
    if (contentItemId) {
      const posts = await db
        .select()
        .from(schema.channelPosts)
        .where(eq(schema.channelPosts.contentItemId, contentItemId));

      const results = [];
      for (const p of posts) {
        if (p.status !== "published") {
          try {
            const res = await publishChannelPost(p.id);
            results.push(res);
          } catch (err: any) {
            results.push({
              success: false,
              channel: p.channel,
              error: err?.message || "Failed to publish",
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        results,
      });
    }

    return NextResponse.json(
      { error: "postId or contentItemId is required." },
      { status: 400 }
    );
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Publishing API error:", error);
    return NextResponse.json(
      { error: error?.message || "Publishing failed" },
      { status: 500 }
    );
  }
}
