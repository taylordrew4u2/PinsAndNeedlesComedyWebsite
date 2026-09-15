"use client";

import { useRef, useState } from "react";
import type { Show } from "@/lib/types";
import { applyFlyer, describeFlyer, type FlyerRead } from "@/lib/flyer";
import Cropper from "./Cropper";
import { upload } from "./MediaField";
import { readFlyer } from "./flyer-client";
import { Button } from "./ui";
import type { Update } from "./types";

const message = (error: unknown) =>
  error instanceof Error ? error.message : "Could not read the flyer";

/**
 * "New show from flyer": pick the poster once and get a show with the bill,
 * date, time and venue already typed in. The flyer is read while the poster
 * is being cropped, so the wait is mostly the crop.
 */
export default function FlyerIntake({
  aspect,
  create,
  update,
  onCreated,
}: {
  /** width / height the poster is cropped to */
  aspect: number;
  create: () => Show;
  update: Update;
  onCreated: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const readRef = useRef<Promise<FlyerRead> | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const pick = (file: File | undefined) => {
    if (!file) return;
    setNote("");
    readRef.current = readFlyer(file);
    // A rejection is surfaced when the crop finishes, not here.
    readRef.current.catch(() => {});
    setPending(file);
  };

  const finish = async (blob: Blob, filename: string) => {
    setPending(null);
    setBusy(true);
    let posterUrl = "";
    let flyer: FlyerRead | null = null;
    const problems: string[] = [];
    try {
      posterUrl = await upload(blob, filename);
    } catch (error) {
      problems.push(`Poster upload failed: ${message(error)}`);
    }
    try {
      flyer = (await readRef.current) ?? null;
    } catch (error) {
      problems.push(message(error));
    }
    readRef.current = null;

    const show = create();
    show.posterUrl = posterUrl;
    const filled = flyer ? applyFlyer(show, flyer) : show;
    update((draft) => void draft.shows.unshift(filled));
    onCreated(filled.id);
    setNote([flyer ? describeFlyer(flyer) : "", ...problems].filter(Boolean).join(" "));
    setBusy(false);
  };

  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button tone="primary" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? "Reading flyer…" : "New show from flyer"}
        </Button>
        <span className="text-[12px] text-neutral-500">
          Pick the poster — the bill, date, time and venue get filled in for you.
        </span>
      </div>
      {note ? <p className="text-[12px] text-neutral-400">{note}</p> : null}

      {pending ? (
        <Cropper
          file={pending}
          aspect={aspect}
          onCancel={() => {
            setPending(null);
            readRef.current = null;
          }}
          onDone={(blob, filename) => void finish(blob, filename)}
        />
      ) : null}
    </div>
  );
}

/** Re-read a show's poster and write what it says onto that show. */
export function ReadFlyerButton({
  posterUrl,
  onRead,
}: {
  posterUrl: string;
  onRead: (flyer: FlyerRead) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const run = async () => {
    setBusy(true);
    setNote("");
    try {
      const flyer = await readFlyer(posterUrl);
      onRead(flyer);
      setNote(describeFlyer(flyer));
    } catch (error) {
      setNote(message(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => void run()} disabled={busy || !posterUrl}>
        {busy ? "Reading flyer…" : "Fill in from poster"}
      </Button>
      <span className="text-[12px] text-neutral-500">
        {note || "reads the bill, date, time and venue off the poster above"}
      </span>
    </div>
  );
}
