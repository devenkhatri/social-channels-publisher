import { NextRequest, NextResponse } from "next/server";
import { getRecentActivities, clearActivities } from "@/services/activity";

export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);
    const type = request.nextUrl.searchParams.get("type") || undefined;
    const activities = await getRecentActivities(limit, type);
    return NextResponse.json({ activities });
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Failed to fetch activity logs:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch activities" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await clearActivities();
    return NextResponse.json({ success: true, message: "Activity logs cleared" });
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Failed to clear activity logs:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to clear activities" },
      { status: 500 }
    );
  }
}
