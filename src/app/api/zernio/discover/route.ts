import { NextRequest, NextResponse } from "next/server";
import { discoverProfiles } from "@/services/zernio";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required." }, { status: 400 });
    }

    const result = await discoverProfiles(accountId);
    const channelsList = result.availableChannels
      .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
      .join(", ");
    const channelSuffix = channelsList ? ` (${channelsList})` : "";

    return NextResponse.json({
      success: true,
      message: `Synchronized ${result.profilesCount} profile(s) and ${result.connectionsCount} active connection(s)${channelSuffix}.`,
      ...result,
    });
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Zernio profile discovery error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to discover profiles" },
      { status: 500 }
    );
  }
}
