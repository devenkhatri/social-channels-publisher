import { db, schema } from "@/db";
import { desc, eq } from "drizzle-orm";

export interface LogActivityOptions {
  type: "sync" | "publish" | "rename" | "error";
  title: string;
  description?: string;
  contentItemId?: string;
  channel?: string;
  status?: "success" | "warning" | "error" | "info";
  metadata?: Record<string, any>;
}

export async function logActivity(opts: LogActivityOptions): Promise<void> {
  try {
    await db.insert(schema.activityLogs).values({
      id: crypto.randomUUID(),
      type: opts.type,
      title: opts.title,
      description: opts.description || null,
      contentItemId: opts.contentItemId || null,
      channel: opts.channel || null,
      status: opts.status || "info",
      metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Failed to write activity log:", err);
  }
}

export async function getRecentActivities(limit: number = 50, type?: string) {
  if (type && type !== "all") {
    return await db
      .select()
      .from(schema.activityLogs)
      .where(eq(schema.activityLogs.type, type))
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(limit);
  }
  return await db
    .select()
    .from(schema.activityLogs)
    .orderBy(desc(schema.activityLogs.createdAt))
    .limit(limit);
}

export async function clearActivities(): Promise<void> {
  await db.delete(schema.activityLogs);
}
