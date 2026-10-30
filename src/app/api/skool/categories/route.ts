import { NextResponse } from "next/server";
import { getSkoolCategories } from "@/services/skool";

export async function GET() {
  try {
    const categories = await getSkoolCategories();
    return NextResponse.json({ categories });
  } catch (err: any) {
    console.error("[Skool Categories API] Error fetching categories:", err);
    return NextResponse.json(
      { categories: [], error: err?.message || "Failed to fetch Skool categories" },
      { status: 200 } // return 200 with empty array so UI doesn't crash if unconfigured
    );
  }
}

