import { NextResponse } from "next/server";
import { renameFolder } from "@/services/onedrive";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { itemId, newName } = body;

    if (!itemId || !newName) {
      return NextResponse.json(
        { error: "Both itemId and newName are required" },
        { status: 400 }
      );
    }

    const renamed = await renameFolder(itemId, newName);

    // Update local database record if present
    const isDone = newName.toLowerCase().endsWith("-done") ? 1 : 0;
    await db
      .update(schema.contentItems)
      .set({
        folderName: newName,
        isDone,
        renamedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.contentItems.driveItemId, itemId));

    return NextResponse.json({
      success: true,
      folder: renamed,
      isDone,
    });
  } catch (error: any) {
    console.error("Error renaming folder in OneDrive:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to rename folder on OneDrive" },
      { status: 500 }
    );
  }
}
