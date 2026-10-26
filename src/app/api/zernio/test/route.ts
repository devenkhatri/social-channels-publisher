import { NextRequest, NextResponse } from "next/server";
import { testZernioConnection, getDecryptedApiKey } from "@/services/zernio";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let apiKey = body.apiKey;

    if (!apiKey && body.accountId) {
      apiKey = await getDecryptedApiKey(body.accountId);
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key or Account ID is required to test connection." },
        { status: 400 }
      );
    }

    const result = await testZernioConnection(apiKey);
    return NextResponse.json(result);
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Zernio test error:", error);
    return NextResponse.json(
      { valid: false, message: error?.message || "Connection test failed" },
      { status: 500 }
    );
  }
}
