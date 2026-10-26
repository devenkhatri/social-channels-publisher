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
    if (body.status !== undefined) updateData.status = body.status;
    if (body.scheduledFor !== undefined) updateData.scheduledFor = body.scheduledFor;

    // Handle account, profile, and connection gracefully to avoid FK constraints
    if (body.zernioConnectionId !== undefined) {
      updateData.zernioConnectionId = body.zernioConnectionId || null;
    }
    if (body.zernioAccountId !== undefined) {
      updateData.zernioAccountId = body.zernioAccountId || null;
    }

    if (body.zernioProfileId !== undefined) {
      const profileVal = body.zernioProfileId;
      if (!profileVal) {
        updateData.zernioProfileId = null;
      } else {
        // Check if value is a connection ID
        const conn = await db
          .select()
          .from(schema.zernioConnections)
          .where(eq(schema.zernioConnections.id, profileVal));

        if (conn.length > 0) {
          updateData.zernioConnectionId = conn[0].id;
          updateData.zernioProfileId = conn[0].zernioProfileId || null;
          updateData.zernioAccountId = conn[0].zernioAccountId || updateData.zernioAccountId;
        } else {
          // Check if value is a profile ID
          const prof = await db
            .select()
            .from(schema.zernioProfiles)
            .where(eq(schema.zernioProfiles.id, profileVal));

          if (prof.length > 0) {
            updateData.zernioProfileId = prof[0].id;
            updateData.zernioAccountId = prof[0].zernioAccountId || updateData.zernioAccountId;
          } else {
            // Neither found, clear to avoid foreign key failure
            updateData.zernioProfileId = null;
          }
        }
      }
    }

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
