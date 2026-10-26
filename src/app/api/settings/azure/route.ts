import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

async function saveSetting(key: string, value: string) {
  const existing = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, key));

  if (existing.length > 0) {
    await db
      .update(schema.settings)
      .set({ value, updatedAt: new Date().toISOString() })
      .where(eq(schema.settings.key, key));
  } else {
    await db.insert(schema.settings).values({
      key,
      value,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, clientSecret, tenantId, redirectUri } = body;

    if (clientId !== undefined) await saveSetting("azure_client_id", clientId.trim());
    if (clientSecret !== undefined && clientSecret.trim()) await saveSetting("azure_client_secret", clientSecret.trim());
    if (tenantId !== undefined) await saveSetting("azure_tenant_id", tenantId.trim() || "common");
    if (redirectUri !== undefined) await saveSetting("azure_redirect_uri", redirectUri.trim());

    return NextResponse.json({ success: true, message: "Azure credentials saved" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save Azure credentials" },
      { status: 500 }
    );
  }
}
