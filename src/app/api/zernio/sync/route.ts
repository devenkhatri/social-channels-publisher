import { NextRequest, NextResponse } from "next/server";
import { syncZernioStatuses } from "@/services/zernio";

export async function POST(request: NextRequest) {
  try {
    let contentItemId: string | undefined;
    let postId: string | undefined;

    try {
      const body = await request.json();
      contentItemId = body?.contentItemId;
      postId = body?.postId;
    } catch {
      // Body is optional
    }

    const result = await syncZernioStatuses({ contentItemId, postId });

    let message = `Synchronized ${result.matchedPosts} Zernio posts (${result.scheduledCount} queued, ${result.publishedCount} published, ${result.updatedStatuses} updated).`;
    if (contentItemId) {
      message =
        result.contentItemUpdated && result.contentItemUpdated > 0
          ? `Synchronized live Zernio status (${result.contentItemUpdated} channel post${result.contentItemUpdated > 1 ? "s" : ""} updated).`
          : `Synchronized live Zernio status with opened post. All channel statuses are up to date.`;
    }

    return NextResponse.json({
      success: true,
      message,
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

