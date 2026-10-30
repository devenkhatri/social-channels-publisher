import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, inArray, and, ne } from "drizzle-orm";
import { renameFolder } from "@/services/onedrive";
import { publishChannelPost } from "@/services/publisher";
import { logActivity } from "@/services/activity";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemIds, action } = body as {
      itemIds: string[];
      action: "mark-done" | "publish-all" | "skip-skool" | "unskip-skool";
    };

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: "itemIds array must contain at least one ID" },
        { status: 400 }
      );
    }

    if (action === "skip-skool") {
      const nowIso = new Date().toISOString();
      await db
        .update(schema.channelPosts)
        .set({
          status: "skipped",
          publishedAt: null,
          scheduledFor: null,
          updatedAt: nowIso,
        })
        .where(
          and(
            inArray(schema.channelPosts.contentItemId, itemIds),
            eq(schema.channelPosts.channel, "skool")
          )
        );

      return NextResponse.json({
        success: true,
        message: `Marked Skool as skipped for ${itemIds.length} items`,
      });
    }

    if (action === "unskip-skool") {
      const nowIso = new Date().toISOString();
      await db
        .update(schema.channelPosts)
        .set({
          status: "draft",
          publishedAt: null,
          scheduledFor: null,
          updatedAt: nowIso,
        })
        .where(
          and(
            inArray(schema.channelPosts.contentItemId, itemIds),
            eq(schema.channelPosts.channel, "skool")
          )
        );

      return NextResponse.json({
        success: true,
        message: `Reset Skool to unpublished (draft) for ${itemIds.length} items`,
      });
    }

    if (action === "mark-done") {
      const items = await db
        .select()
        .from(schema.contentItems)
        .where(inArray(schema.contentItems.id, itemIds));

      const results = [];
      const nowIso = new Date().toISOString();

      for (const item of items) {
        if (item.isDone === 1) {
          results.push({ id: item.id, folder: item.folderName, skipped: true, reason: "Already marked done" });
          continue;
        }

        const newName = `${item.originalFolderName}-Done`;
        let renameSuccess = true;

        try {
          await renameFolder(item.driveItemId, newName);
        } catch (err: any) {
          console.error(`Batch rename failed for ${item.folderName}:`, err);
          renameSuccess = false;
        }

        await db
          .update(schema.contentItems)
          .set({
            isDone: 1,
            folderName: newName,
            renamedAt: nowIso,
            updatedAt: nowIso,
          })
          .where(eq(schema.contentItems.id, item.id));

        // Mark associated posts as published (except Skool)
        await db
          .update(schema.channelPosts)
          .set({
            status: "published",
            publishedAt: nowIso,
            updatedAt: nowIso,
          })
          .where(
            and(
              eq(schema.channelPosts.contentItemId, item.id),
              ne(schema.channelPosts.channel, "skool")
            )
          );

        await logActivity({
          type: "rename",
          title: "Batch Marked Done & Renamed",
          description: `Renamed "${item.originalFolderName}" to "${newName}" on OneDrive (Batch Action)`,
          contentItemId: item.id,
          status: renameSuccess ? "success" : "warning",
        });

        results.push({
          id: item.id,
          folder: newName,
          renameSuccess,
        });
      }

      return NextResponse.json({
        success: true,
        message: `Successfully marked ${results.length} folders as Done!`,
        results,
      });
    }

    if (action === "publish-all") {
      const results = [];

      for (const itemId of itemIds) {
        const posts = await db
          .select()
          .from(schema.channelPosts)
          .where(eq(schema.channelPosts.contentItemId, itemId));

        const itemResults = [];
        for (const p of posts) {
          if (p.channel === "skool") continue;
          if (p.status !== "published") {
            try {
              const res = await publishChannelPost(p.id);
              itemResults.push(res);
            } catch (err: any) {
              itemResults.push({
                success: false,
                channel: p.channel,
                error: err?.message || "Failed to publish",
              });
            }
          }
        }
        results.push({ itemId, postsProcessed: itemResults });
      }

      return NextResponse.json({
        success: true,
        message: `Batch publish executed for ${itemIds.length} items`,
        results,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Supported actions: mark-done, publish-all" },
      { status: 400 }
    );
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Batch operation error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to execute batch operation" },
      { status: 500 }
    );
  }
}
