import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { syncInstagram } from "@/lib/instagram-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncInstagram();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
