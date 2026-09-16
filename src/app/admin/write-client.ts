"use client";

import type { AiHint, SeoDraft } from "@/lib/writer";
import type { Seo } from "@/lib/types";

async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/write", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || "Could not write that");
  return data;
}

/** Ask the server to write (or rewrite) one field. */
export async function writeField(hint: AiHint, current: string): Promise<string> {
  const data = await post({ kind: "text", ...hint, current });
  return String(data.text || "");
}

/** Ask the server for a whole SEO block for a page. */
export async function writeSeo(about: Record<string, unknown>, seo: Seo): Promise<SeoDraft> {
  const data = await post({ kind: "seo", about, seo });
  return data.seo as SeoDraft;
}
