import { NextRequest, NextResponse } from "next/server";
import { getZernioAccounts, addZernioAccount, deleteZernioAccount } from "@/services/zernio";

export async function GET(request: NextRequest) {
  try {
    const accounts = await getZernioAccounts();
    return NextResponse.json({ accounts });
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Failed to get Zernio accounts:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, apiKey } = body;

    if (!name || !apiKey) {
      return NextResponse.json(
        { error: "Account name and API key are required." },
        { status: 400 }
      );
    }

    const result = await addZernioAccount(name, apiKey);
    return NextResponse.json({ success: true, account: result });
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Failed to add Zernio account:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to add account" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Account ID is required" }, { status: 400 });
    }

    await deleteZernioAccount(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Failed to delete Zernio account:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete account" },
      { status: 500 }
    );
  }
}
