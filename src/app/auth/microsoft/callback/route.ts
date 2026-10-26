import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/services/onedrive";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const errorDescription = request.nextUrl.searchParams.get("error_description");

  const baseUrl = new URL("/settings/onedrive", request.url);

  if (error || !code) {
    baseUrl.searchParams.set("error", errorDescription || error || "No authorization code received");
    return NextResponse.redirect(baseUrl);
  }

  try {
    await exchangeCodeForTokens(code);
    baseUrl.searchParams.set("connected", "true");
    return NextResponse.redirect(baseUrl);
  } catch (err: any) {
    console.error("Microsoft OAuth callback failed:", err);
    baseUrl.searchParams.set("error", err?.message || "Failed to complete authentication with Microsoft");
    return NextResponse.redirect(baseUrl);
  }
}
