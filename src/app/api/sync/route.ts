import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { syncFromOneDrive } from "@/services/sync";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const result = await syncFromOneDrive();
    return NextResponse.json(result);
  } catch (error: any) {
    if (error?.digest) {
      throw error;
    }
    console.error("Sync API error:", error);
    return NextResponse.json(
      { error: error?.message || "Sync failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const settings = await db.select().from(schema.settings);
    const lastSynced = settings.find((s) => s.key === "last_synced_at")?.value || null;
    const parentFolder = settings.find((s) => s.key === "onedrive_parent_folder_path")?.value || null;

    const allItems = await db.select().from(schema.contentItems);
    const unpublished = allItems.filter((i) => i.isDone === 0).length;
    const published = allItems.filter((i) => i.isDone === 1).length;

    return NextResponse.json({
      lastSyncedAt: lastSynced,
      parentFolderPath: parentFolder,
      counts: {
        total: allItems.length,
        unpublished,
        published,
      },
    });
  } catch (error: any) {
    if (error?.digest) {
      throw error;
    }
    console.error("Sync status API error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch sync status" },
      { status: 500 }
    );
  }
}
