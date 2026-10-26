import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db
      .select()
      .from(schema.channelPosts)
      .where(eq(schema.channelPosts.id, id));

    if (existing.length === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.body !== undefined) updateData.body = body.body;
    if (body.postType !== undefined) updateData.postType = body.postType;
    if (body.mediaType !== undefined) updateData.mediaType = body.mediaType;
    if (body.zernioAccountId !== undefined) updateData.zernioAccountId = body.zernioAccountId;
    if (body.zernioProfileId !== undefined) updateData.zernioProfileId = body.zernioProfileId;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.scheduledFor !== undefined) updateData.scheduledFor = body.scheduledFor;

    await db
      .update(schema.channelPosts)
      .set(updateData)
      .where(eq(schema.channelPosts.id, id));

    const updated = await db
      .select()
      .from(schema.channelPosts)
      .where(eq(schema.channelPosts.id, id));

    return NextResponse.json({ success: true, post: updated[0] });
  } catch (error: any) {
    if (error?.digest) {
      throw error;
    }
    console.error("Error updating channel post:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update channel post" },
      { status: 500 }
    );
  }
}
