import { NextRequest, NextResponse } from "next/server";
import { publishChannelPost, checkAndRenameFolderIfDone } from "@/services/publisher";
import { db, schema } from "@/db";
import { eq, and, ne } from "drizzle-orm";
import { renameFolder } from "@/services/onedrive";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[Publish API] Received body:", JSON.stringify(body));
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

      // Mark all Zernio posts as published (keep Skool as draft)
      await db
        .update(schema.channelPosts)
        .set({
          status: "published",
          publishedAt: nowIso,
          updatedAt: nowIso,
        })
        .where(
          and(
            eq(schema.channelPosts.contentItemId, contentItemId),
            ne(schema.channelPosts.channel, "skool")
          )
        );

      return NextResponse.json({
        success: true,
        message: `Marked as done and renamed folder to ${newName} on OneDrive`,
        newName,
      });
    }

    // Publish single post
    if (postId) {
      console.log("[Publish API] Publishing single post:", postId);
      const result = await publishChannelPost(postId);
      console.log("[Publish API] Publish single post result:", JSON.stringify(result));
      return NextResponse.json(result);
    }

    // Publish all pending posts for a content item
    if (contentItemId) {
      const posts = await db
        .select()
        .from(schema.channelPosts)
        .where(eq(schema.channelPosts.contentItemId, contentItemId));

      const pendingPosts = posts.filter(
        (p) => p.channel !== "skool" && p.status !== "published" && p.status !== "scheduled"
      );

      if (pendingPosts.length === 0) {
        const renamed = await checkAndRenameFolderIfDone(contentItemId);
        return NextResponse.json({
          success: true,
          message: "All channels are already published or queued.",
          folderRenamed: renamed,
          results: [],
        });
      }

      const results = [];
      for (const p of pendingPosts) {
        try {
          const res = await publishChannelPost(p.id);
          results.push(res);
        } catch (err: any) {
          console.error(`[Publish API] Error publishing channel ${p.channel}:`, err);
          results.push({
            success: false,
            channel: p.channel,
            error: err?.message || "Failed to publish",
          });
        }
      }

      const failed = results.filter((r) => !r.success) as Array<{
        success: boolean;
        channel: string;
        error?: string;
      }>;
      const successful = results.filter((r) => r.success);
      const renamed = await checkAndRenameFolderIfDone(contentItemId);

      if (failed.length > 0 && successful.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to publish: ${failed.map((f) => `${f.channel} (${f.error || "unknown"})`).join(", ")}`,
            results,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        folderRenamed: renamed,
        results,
        message:
          failed.length > 0
            ? `Published ${successful.length} channels, but ${failed.length} failed (${failed.map((f) => f.channel).join(", ")})`
            : `Successfully published all ${results.length} channels!`,
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
