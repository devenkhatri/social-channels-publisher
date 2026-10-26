import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/services/onedrive";

export async function GET() {
  try {
    const url = await getAuthorizationUrl();
    return NextResponse.json({ url });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to generate authorization URL" },
      { status: 400 }
    );
  }
}
