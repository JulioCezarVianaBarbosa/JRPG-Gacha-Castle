import { db } from "@/db";
import { highscores } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

async function top() {
  const rows = await db.select().from(highscores).orderBy(desc(highscores.score)).limit(10);
  return rows.map((r) => ({ id: r.id, name: r.name, score: r.score, day: r.day, stage: r.stage }));
}

export async function GET() {
  try {
    return NextResponse.json({ rows: await top() });
  } catch {
    return NextResponse.json({ rows: [] });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string; score?: number; day?: number; stage?: number };
    const name = (body.name ?? "Governor").slice(0, 16);
    const score = Math.max(0, Math.floor(body.score ?? 0));
    await db.insert(highscores).values({
      name: name || "Governor",
      score,
      day: Math.max(1, Math.floor(body.day ?? 1)),
      stage: Math.max(1, Math.floor(body.stage ?? 1)),
    });
    return NextResponse.json({ rows: await top() });
  } catch {
    return NextResponse.json({ rows: [] });
  }
}
