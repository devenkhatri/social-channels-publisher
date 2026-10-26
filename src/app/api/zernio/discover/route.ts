import { NextRequest, NextResponse } from "next/server";
import { discoverProfiles } from "@/services/zernio";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required." }, { status: 400 });
    }

    const count = await discoverProfiles(accountId);
    return NextResponse.json({
      success: true,
      message: `Discovered and synchronized ${count} profile(s).`,
      count,
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
