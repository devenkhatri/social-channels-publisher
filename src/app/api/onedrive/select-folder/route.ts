import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

async function saveSetting(key: string, value: string) {
  const existing = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, key));

  if (existing.length > 0) {
    await db
      .update(schema.settings)
      .set({ value, updatedAt: new Date().toISOString() })
      .where(eq(schema.settings.key, key));
  } else {
    await db.insert(schema.settings).values({
      key,
      value,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { folderId, folderName, folderPath, autoRename } = body;

    if (!folderId) {
      return NextResponse.json({ error: "Folder ID is required" }, { status: 400 });
    }

    await saveSetting("onedrive_parent_folder_id", folderId);
    if (folderName) await saveSetting("onedrive_parent_folder_name", folderName);
    if (folderPath) await saveSetting("onedrive_parent_folder_path", folderPath);
    if (autoRename !== undefined) {
      await saveSetting("auto_rename_onedrive_on_publish", autoRename ? "true" : "false");
    }

    return NextResponse.json({
      success: true,
      selectedFolder: {
        id: folderId,
        name: folderName || "Selected Folder",
        path: folderPath || "/",
      },
    });
  } catch (error: any) {
    console.error("Error saving parent folder:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save selected folder" },
      { status: 500 }
    );
  }
}
