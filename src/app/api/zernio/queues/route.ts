import { NextRequest, NextResponse } from "next/server";
import { getZernioQueues, deleteZernioQueuedPost } from "@/services/zernio";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") || undefined;
    const status = searchParams.get("status") || "scheduled";

    const data = await getZernioQueues({ accountId, status });
    return NextResponse.json(data);
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Zernio queues API error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch Zernio queues" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");
    const accountId = searchParams.get("accountId");

    if (!postId || !accountId) {
      return NextResponse.json(
        { error: "postId and accountId are required to delete a queued post" },
        { status: 400 }
      );
    }

    await deleteZernioQueuedPost(postId, accountId);
    return NextResponse.json({
      success: true,
      message: "Queued post removed from Zernio schedule",
    });
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Zernio delete queued post API error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to remove post from queue" },
      { status: 500 }
    );
  }
}
