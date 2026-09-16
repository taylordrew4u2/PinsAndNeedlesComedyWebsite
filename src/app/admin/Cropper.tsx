"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Num } from "./ui";

type Point = { x: number; y: number };

/** Longest edge of the exported image. Big enough for retina, small enough to stay fast. */
const OUTPUT_LONG_EDGE = 1600;

function frameSize(aspect: number) {
  const maxWidth = 360;
  const maxHeight = 460;
  const width = Math.min(maxWidth, maxHeight * aspect);
  return { width, height: width / aspect };
}

export default function Cropper({
  file,
  aspect,
  onCancel,
  onDone,
}: {
  file: File;
  /** width / height */
  aspect: number;
  onCancel: () => void;
  onDone: (blob: Blob, filename: string) => void;
}) {
  const [src, setSrc] = useState("");
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(100);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ start: Point; origin: Point } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const frame = frameSize(aspect);

  // Syncing with an external resource: the object URL has to be created for
  // this file and revoked when it changes, which is exactly what an effect is
  // for. There is no render-time equivalent.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale =
    natural.w && natural.h ? Math.max(frame.width / natural.w, frame.height / natural.h) : 1;
  const scale = baseScale * (zoom / 100);
  const drawn = { w: natural.w * scale, h: natural.h * scale };

  const clamp = useCallback(
    (point: Point): Point => ({
      x: Math.min(0, Math.max(frame.width - drawn.w, point.x)),
      y: Math.min(0, Math.max(frame.height - drawn.h, point.y)),
    }),
    [frame.width, frame.height, drawn.w, drawn.h]
  );

  // Re-centre whenever the zoom or the image changes so the frame stays covered.
  // The new offset depends on the image's decoded dimensions, which are only
  // known after it has loaded, so this cannot be derived during render.
  useEffect(() => {
    if (!natural.w) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffset((current) =>
      current.x === 0 && current.y === 0
        ? { x: (frame.width - drawn.w) / 2, y: (frame.height - drawn.h) / 2 }
        : clamp(current)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural.w, natural.h, zoom]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { start: { x: event.clientX, y: event.clientY }, origin: offset };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setOffset(
      clamp({
        x: drag.origin.x + (event.clientX - drag.start.x),
        y: drag.origin.y + (event.clientY - drag.start.y),
      })
    );
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const exportCrop = async () => {
    const image = imgRef.current;
    if (!image || !natural.w) return;
    setBusy(true);
    try {
      const outWidth = aspect >= 1 ? OUTPUT_LONG_EDGE : Math.round(OUTPUT_LONG_EDGE * aspect);
      const outHeight = Math.round(outWidth / aspect);

      const canvas = document.createElement("canvas");
      canvas.width = outWidth;
      canvas.height = outHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.imageSmoothingQuality = "high";

      // Map the visible frame back into the source image's own pixels.
      const sx = -offset.x / scale;
      const sy = -offset.y / scale;
      const sw = frame.width / scale;
      const sh = frame.height / scale;
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outWidth, outHeight);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.92)
      );
      const finalBlob =
        blob ??
        (await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92)));
      if (!finalBlob) throw new Error("Could not export the crop");

      const base = file.name.replace(/\.[^.]+$/, "") || "image";
      onDone(finalBlob, `${base}.${finalBlob.type === "image/webp" ? "webp" : "jpg"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-md rounded-lg border border-neutral-700 bg-neutral-950 p-4">
        <h3 className="mb-1 text-[17px] font-semibold text-neutral-50">
          Crop image
        </h3>
        <p className="mb-4 text-[14px] text-neutral-400">Drag the picture to move it, slide to zoom. Then tap the white button.</p>

        <div
          className="relative mx-auto touch-none overflow-hidden bg-neutral-900"
          style={{ width: frame.width, height: frame.height, cursor: "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(event) =>
                setNatural({
                  w: event.currentTarget.naturalWidth,
                  h: event.currentTarget.naturalHeight,
                })
              }
              style={{
                position: "absolute",
                left: offset.x,
                top: offset.y,
                width: drawn.w || undefined,
                height: drawn.h || undefined,
                maxWidth: "none",
                userSelect: "none",
              }}
            />
          ) : null}
          <div className="pointer-events-none absolute inset-0 border border-white/30" />
        </div>

        <div className="mt-4">
          <Num label="Zoom" value={zoom} onChange={setZoom} min={100} max={400} suffix="%" />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button tone="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button tone="primary" onClick={exportCrop} disabled={busy || !natural.w}>
            {busy ? "Working…" : "Use this crop"}
          </Button>
        </div>
      </div>
    </div>
  );
}
