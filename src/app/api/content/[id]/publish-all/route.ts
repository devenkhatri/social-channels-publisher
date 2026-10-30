import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { publishChannelPost } from "@/services/publisher";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const posts = await db
      .select()
      .from(schema.channelPosts)
      .where(eq(schema.channelPosts.contentItemId, id));

    if (posts.length === 0) {
      return NextResponse.json({ error: "No posts found for this content item" }, { status: 404 });
    }

    const results = [];
    for (const p of posts) {
      if (p.channel === "skool") {
        continue;
      }
      if (p.status !== "published") {
        try {
          const res = await publishChannelPost(p.id);
          results.push(res);
        } catch (err: any) {
          results.push({
            success: false,
            channel: p.channel,
            error: err?.message || "Failed to publish",
          });
        }
      } else {
        results.push({
          success: true,
          channel: p.channel,
          skipped: true,
          message: "Already published",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Publish all completed",
      results,
    });
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Error publishing all:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to publish all" },
      { status: 500 }
    );
  }
}
