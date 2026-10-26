import { NextResponse } from "next/server";
import { disconnectOneDrive } from "@/services/onedrive";

export async function POST() {
  try {
    await disconnectOneDrive();
    return NextResponse.json({ success: true, message: "OneDrive disconnected" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to disconnect OneDrive" },
      { status: 500 }
    );
  }
}
