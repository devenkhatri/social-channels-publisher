import { NextRequest, NextResponse } from "next/server";
import { syncZernioStatuses } from "@/services/zernio";

export async function POST(request: NextRequest) {
  try {
    const result = await syncZernioStatuses();
    return NextResponse.json({
      success: true,
      message: `Synchronized ${result.matchedPosts} Zernio posts (${result.scheduledCount} queued, ${result.publishedCount} published, ${result.updatedStatuses} updated).`,
      result,
    });
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Zernio status sync error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to sync Zernio statuses" },
      { status: 500 }
    );
  }
}

