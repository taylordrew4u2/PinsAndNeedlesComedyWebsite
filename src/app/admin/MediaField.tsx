"use client";

import { useRef, useState } from "react";
import Cropper from "./Cropper";
import { Button, Label } from "./ui";

/** Send a file to the content store and get back the URL it lives at. */
export async function upload(blob: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", new File([blob], filename, { type: blob.type }));
  const response = await fetch("/api/admin/upload", { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || "Upload failed");
  return data.url as string;
}

export default function MediaField({
  label,
  value,
  onChange,
  /** width / height. Omit to upload without cropping. */
  aspect,
  accept = "image/*",
  hint,
  previewHeight = 120,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  aspect?: number;
  accept?: string;
  hint?: string;
  previewHeight?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showUrl, setShowUrl] = useState(false);

  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(value);
  const wantsVideo = /^video/.test(accept);
  const noun = wantsVideo ? "video" : "picture";

  const send = async (blob: Blob, filename: string) => {
    setBusy(true);
    setError("");
    try {
      onChange(await upload(blob, filename));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    // Videos, SVGs and GIFs go up untouched — cropping them on a canvas would
    // flatten the animation or rasterise the vector.
    const croppable =
      aspect !== undefined && /^image\//.test(file.type) && !/svg|gif/.test(file.type);
    if (croppable) setPending(file);
    else await send(file, file.name);
  };

  return (
    <div className="min-w-0">
      <Label hint={hint}>{label}</Label>

      <div className="flex flex-wrap items-start gap-3">
        <div
          className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900"
          style={{ height: previewHeight, width: previewHeight * (aspect ?? 1) }}
        >
          {value ? (
            isVideo ? (
              <video src={value} className="h-full w-full object-cover" muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="" className="h-full w-full object-cover" />
            )
          ) : (
            <span className="px-2 text-center text-[12px] text-neutral-600">No {noun} yet</span>
          )}
        </div>

        <div className="flex min-w-[180px] flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(event) => {
              void onPick(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button tone={value ? "default" : "primary"} onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? "Uploading…" : value ? `Change ${noun}` : `${wantsVideo ? "🎬" : "📷"} Choose a ${noun}`}
            </Button>
            {value ? (
              <Button tone="danger" onClick={() => onChange("")}>
                Remove
              </Button>
            ) : null}
          </div>
          {showUrl || /^https?:\/\//i.test(value) ? (
            <input
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-[14px] text-neutral-300 outline-none focus:border-neutral-500"
              placeholder="Paste a link to a picture instead"
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowUrl(true)}
              className="self-start text-[13px] text-neutral-500 underline underline-offset-2 hover:text-neutral-300"
            >
              …or paste a link instead
            </button>
          )}
          {error ? <p className="text-[13px] text-red-400">{error}</p> : null}
        </div>
      </div>

      {pending && aspect !== undefined ? (
        <Cropper
          file={pending}
          aspect={aspect}
          onCancel={() => setPending(null)}
          onDone={(blob, filename) => void send(blob, filename)}
        />
      ) : null}
    </div>
  );
}
