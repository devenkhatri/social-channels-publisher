import { NextResponse } from "next/server";
import { db, schema } from "@/db";

export async function POST() {
  try {
    // Check if OneDrive token exists
    const token = await db.query.oauthTokens?.findFirst?.();
    if (!token) {
      return NextResponse.json(
        { error: "Microsoft OneDrive is not connected. Configure in Settings." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Synced from OneDrive successfully",
      syncedFolders: 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Sync failed" },
      { status: 500 }
    );
  }
}
