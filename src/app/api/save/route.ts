import { db } from "@/db";
import { saves } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rows = await db.select().from(saves).where(eq(saves.slot, 1));
    return NextResponse.json({ data: rows[0]?.data ?? null });
  } catch {
    return NextResponse.json({ data: null });
  }
}

export async function PUT(req: Request) {
  try {
    const { data } = (await req.json()) as { data: unknown };
    const now = new Date();
    await db
      .insert(saves)
      .values({ slot: 1, data, updatedAt: now })
      .onConflictDoUpdate({ target: saves.slot, set: { data, updatedAt: now } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await db.delete(saves).where(eq(saves.slot, 1));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
