import { NextRequest, NextResponse } from "next/server";
import { listFolders } from "@/services/onedrive";

export async function GET(request: NextRequest) {
  try {
    const parentId = request.nextUrl.searchParams.get("parentId") || undefined;
    const folders = await listFolders(parentId);
    return NextResponse.json({ folders });
  } catch (error: any) {
    if ((error as any)?.digest) throw error;
    console.error("Error listing OneDrive folders:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to list folders" },
      { status: 500 }
    );
  }
}
