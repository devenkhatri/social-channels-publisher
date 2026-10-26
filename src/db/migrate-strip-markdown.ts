import { db, schema } from "./index";
import { stripMarkdown } from "@/services/extractor";
import { eq } from "drizzle-orm";

async function runMigration() {
  console.log("[Migration] Starting markdown stripping on existing database records...");

  const posts = await db.select().from(schema.channelPosts);
  let updatedPosts = 0;

  for (const post of posts) {
    const strippedTitle = post.title ? stripMarkdown(post.title) : null;
    const strippedBody = post.body ? stripMarkdown(post.body) : null;

    if (strippedTitle !== post.title || strippedBody !== post.body) {
      await db
        .update(schema.channelPosts)
        .set({
          title: strippedTitle,
          body: strippedBody,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.channelPosts.id, post.id));
      updatedPosts++;
    }
  }

  const items = await db.select().from(schema.contentItems);
  let updatedItems = 0;

  for (const item of items) {
    const strippedTitle = item.title ? stripMarkdown(item.title) : item.title;
    if (strippedTitle !== item.title) {
      await db
        .update(schema.contentItems)
        .set({
          title: strippedTitle,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.contentItems.id, item.id));
      updatedItems++;
    }
  }

  console.log(
    `[Migration] Completed! Updated ${updatedPosts} / ${posts.length} posts, and ${updatedItems} / ${items.length} content items.`
  );
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[Migration] Error running migration:", err);
    process.exit(1);
  });
