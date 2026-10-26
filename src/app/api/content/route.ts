import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { desc, eq } from "drizzle-orm";


export async function GET(request: NextRequest) {
  try {
    const filter = request.nextUrl.searchParams.get("filter") || "unpublished"; // 'unpublished' | 'published' | 'all'

    let items;
    if (filter === "unpublished") {
      items = await db
        .select()
        .from(schema.contentItems)
        .where(eq(schema.contentItems.isDone, 0))
        .orderBy(desc(schema.contentItems.createdAt));
    } else if (filter === "published") {
      items = await db
        .select()
        .from(schema.contentItems)
        .where(eq(schema.contentItems.isDone, 1))
        .orderBy(desc(schema.contentItems.createdAt));
    } else {
      items = await db
        .select()
        .from(schema.contentItems)
        .orderBy(desc(schema.contentItems.createdAt));
    }

    // Fetch channel posts for each item
    const itemsWithPosts = await Promise.all(
      items.map(async (item) => {
        const posts = await db
          .select()
          .from(schema.channelPosts)
          .where(eq(schema.channelPosts.contentItemId, item.id));

        return {
          ...item,
          posts,
        };
      })
    );

    // Get summary counts
    const allItems = await db.select().from(schema.contentItems);
    const unpublishedCount = allItems.filter((i) => i.isDone === 0).length;
    const publishedCount = allItems.filter((i) => i.isDone === 1).length;

    return NextResponse.json({
      items: itemsWithPosts,
      counts: {
        total: allItems.length,
        unpublished: unpublishedCount,
        published: publishedCount,
      },
    });
  } catch (error) {
    // Re-throw Next.js internal prerender interruption digests
    if ((error as any)?.digest) {
      throw error;
    }
    console.error("Error fetching content items:", error);
    return NextResponse.json(
      { error: "Failed to fetch content items" },
      { status: 500 }
    );
  }
}
