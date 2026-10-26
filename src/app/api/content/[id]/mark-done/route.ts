import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { renameFolder } from "@/services/onedrive";
import { logActivity } from "@/services/activity";

export async function POST(
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
      .where(eq(schema.contentItems.id, id));

    // Mark all channel posts as published
    await db
      .update(schema.channelPosts)
      .set({
        status: "published",
        publishedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(schema.channelPosts.contentItemId, id));

    await logActivity({
      type: "rename",
      title: "Folder Marked Done & Renamed",
      description: `Renamed "${item.originalFolderName}" to "${newName}" on OneDrive`,
      contentItemId: id,
      status: "success",
    });

    return NextResponse.json({
      success: true,
      message: `Marked as done and renamed folder to ${newName} on OneDrive`,
      newName,
    });
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Error marking as done:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to mark as done" },
      { status: 500 }
    );
  }
}
