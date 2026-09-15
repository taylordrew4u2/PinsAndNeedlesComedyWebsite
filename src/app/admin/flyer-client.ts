"use client";

import type { FlyerRead } from "@/lib/flyer";

/** Longest edge sent for reading. Plenty for printed text, small enough to stay under the API's 5MB. */
const LONG_EDGE = 1568;

/**
 * Decode a picture in the browser and hand back a JPEG the reader accepts,
 * whatever the original was (AVIF, HEIC, a 20MB PNG). Returns null when the
 * browser cannot draw it — a cross-origin URL, or a format it cannot decode.
 */
async function shrink(source: File | string): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(
      typeof source === "string" ? await (await fetch(source)).blob() : source
    );
    const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  } catch {
    return null;
  }
}

/** Ask the server to read a flyer: a picked file, or the URL of a poster already uploaded. */
export async function readFlyer(source: File | string): Promise<FlyerRead> {
  const blob = await shrink(source);
  let response: Response;
  if (blob) {
    const form = new FormData();
    form.append("file", new File([blob], "flyer.jpg", { type: "image/jpeg" }));
    response = await fetch("/api/admin/flyer", { method: "POST", body: form });
  } else if (typeof source === "string") {
    response = await fetch("/api/admin/flyer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: source }),
    });
  } else {
    throw new Error("Couldn’t open that image");
  }
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || "Could not read the flyer");
  return data.flyer as FlyerRead;
}
