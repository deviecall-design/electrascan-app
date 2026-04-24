import { NextResponse } from "next/server";

// Telegram webhook stub. Wire to real handlers (/signal, /positions, /pnl,
// /approve, /close) in the next iteration — this route just acks for now so
// the bot can be registered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const text: string | undefined = body?.message?.text;
  return NextResponse.json({ ok: true, received: text ?? null });
}
