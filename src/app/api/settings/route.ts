import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const allSettings = await db.select().from(schema.settings);
    const settingsMap: Record<string, string> = {};

    for (const s of allSettings) {
      // Mask client secrets for safety
      if (s.key.includes("secret") || s.key.includes("password")) {
        settingsMap[s.key] = "********";
      } else {
        settingsMap[s.key] = s.value;
      }
    }

    return NextResponse.json({ settings: settingsMap });
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const nowIso = new Date().toISOString();

    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") {
        const existing = await db
          .select()
          .from(schema.settings)
          .where(eq(schema.settings.key, key));

        if (existing.length > 0) {
          await db
            .update(schema.settings)
            .set({ value, updatedAt: nowIso })
            .where(eq(schema.settings.key, key));
        } else {
          await db.insert(schema.settings).values({
            key,
            value,
            updatedAt: nowIso,
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: "Settings updated successfully" });
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}
