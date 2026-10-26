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
    const originalName = item.originalFolderName;

    try {
      await renameFolder(item.driveItemId, originalName);
    } catch (err: any) {
      console.error("OneDrive revert rename error:", err);
    }

    const nowIso = new Date().toISOString();
    await db
      .update(schema.contentItems)
      .set({
        isDone: 0,
        folderName: originalName,
        renamedAt: null,
        updatedAt: nowIso,
      })
      .where(eq(schema.contentItems.id, id));

    await logActivity({
      type: "rename",
      title: "Folder Reverted to Unpublished",
      description: `Reverted folder name to "${originalName}" on OneDrive`,
      contentItemId: id,
      status: "info",
    });

    return NextResponse.json({
      success: true,
      message: `Reverted folder name to ${originalName} on OneDrive and marked as Unpublished`,
      originalName,
    });
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Error unmarking as done:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to revert to unpublished" },
      { status: 500 }
    );
  }
}
