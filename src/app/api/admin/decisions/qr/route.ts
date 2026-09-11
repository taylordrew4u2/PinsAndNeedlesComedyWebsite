import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { decisionQrResponse } from "@/lib/decision-qr-response";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return decisionQrResponse();
}
