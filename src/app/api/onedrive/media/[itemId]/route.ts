import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/services/onedrive";

interface CachedUrl {
  location: string;
  expiresAt: number;
}

const urlCache = new Map<string, CachedUrl>();

function getMimeType(fileName?: string | null, upstreamType?: string | null): string {
  if (fileName) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".svg")) return "image/svg+xml";
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".mp4")) return "video/mp4";
    if (lower.endsWith(".webm")) return "video/webm";
    if (lower.endsWith(".mov")) return "video/quicktime";
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (lower.endsWith(".md") || lower.endsWith(".txt")) return "text/plain; charset=utf-8";
    if (lower.endsWith(".json")) return "application/json";
  }
  return upstreamType || "application/octet-stream";
}

async function getDirectUrl(itemId: string): Promise<string> {
  const cached = urlCache.get(itemId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.location;
  }

  const token = await getValidAccessToken();
  if (!token) {
    throw new Error("No active Microsoft OneDrive token. Please reconnect in Settings.");
  }

  const contentRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/content`,
    {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "manual",
    }
  );

  let location = contentRes.headers.get("Location") || contentRes.headers.get("location");

  if (!location) {
    if (contentRes.ok) {
      // If Graph API returned the body directly without a redirect
      return `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/content`;
    }
    throw new Error(`Failed to resolve download location for OneDrive item ${itemId}`);
  }

  // Cache pre-authenticated SharePoint URL for 45 minutes (SAS token is valid ~60 min)
  urlCache.set(itemId, {
    location,
    expiresAt: Date.now() + 45 * 60 * 1000,
  });

  return location;
}

async function handleMediaRequest(
  request: NextRequest,
  params: Promise<{ itemId: string }>,
  isHead: boolean = false
) {
  try {
    const { itemId } = await params;
    const { searchParams } = request.nextUrl;
    const fileName = searchParams.get("name") || "";
    const isDownload = searchParams.get("download") === "1";

    let directUrl = await getDirectUrl(itemId);

    const range = request.headers.get("range");
    const forwardHeaders: Record<string, string> = {};
    if (range) {
      forwardHeaders["Range"] = range;
    }

    let upstreamRes = await fetch(directUrl, {
      method: isHead ? "HEAD" : "GET",
      headers: forwardHeaders,
    });

    // If 401/403 or failed, the cached SAS token may have expired early; clear and retry once
    if ((upstreamRes.status === 401 || upstreamRes.status === 403) && urlCache.has(itemId)) {
      urlCache.delete(itemId);
      directUrl = await getDirectUrl(itemId);
      upstreamRes = await fetch(directUrl, {
        method: isHead ? "HEAD" : "GET",
        headers: forwardHeaders,
      });
    }

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return NextResponse.json(
        { error: `Upstream media fetch failed with status ${upstreamRes.status}` },
        { status: upstreamRes.status }
      );
    }

    const responseHeaders = new Headers();
    const contentType = getMimeType(fileName, upstreamRes.headers.get("content-type"));
    responseHeaders.set("Content-Type", contentType);

    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) {
      responseHeaders.set("Content-Range", contentRange);
    }

    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    const acceptRanges = upstreamRes.headers.get("accept-ranges");
    if (acceptRanges) {
      responseHeaders.set("Accept-Ranges", acceptRanges);
    } else if (contentType.startsWith("video/") || contentType === "application/pdf") {
      responseHeaders.set("Accept-Ranges", "bytes");
    }

    responseHeaders.set("Cache-Control", "public, max-age=3600");

    const safeName = fileName || `file-${itemId}`;
    responseHeaders.set(
      "Content-Disposition",
      `${isDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(safeName)}"`
    );

    if (isHead) {
      return new NextResponse(null, {
        status: upstreamRes.status,
        headers: responseHeaders,
      });
    }

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    if (error?.digest) {
      throw error;
    }
    console.error("Error in OneDrive media streaming proxy:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to stream media" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  return handleMediaRequest(request, params, false);
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  return handleMediaRequest(request, params, true);
}
