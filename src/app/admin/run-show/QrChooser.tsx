"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { upload } from "../MediaField";
import { uploadedFileName } from "@/lib/audio-upload";
import { JPEG_QUALITY, hasTransparency, pictureName, pictureProblem, pictureType, shrunkSize } from "@/lib/picture-upload";
import {
  DECISIONS_QR_SRC, DEFAULT_QR_SIZE, QR_BASE, QR_IMAGE_MAX_PX, QR_LINK_MAX, QR_SIZE_MAX, QR_SIZE_MIN, QR_SIZE_STEP, adminQrPreviewSrc, cleanAssetUrl, cleanQrLink,
  linkLabel, longLink, pictureLands, qrChoiceProblem, withHttps, type QrKind, type QrPlace,
} from "@/lib/screen-qr";

/** One QR choice as a card edits it: where it leads, the link and picture (kept while another is picked), and its size as a percentage. */
export type QrChoice = { kind: QrKind; to: string; image: string; size: number };

/** What each place is called, for the note on where a bigger size stops growing. */
const PLACE_NAMES: Record<QrPlace, string> = { corner: "The corner of the live screen", menu: "The drink menu", explainer: "The Intro" };

/** The preview's code at 100%, in CSS pixels: 200% is twice this, and still fits a phone beside nothing else. */
const PREVIEW_PX = 76;

/** A typed address waits this long after the last key before the preview draws it. */
const PREVIEW_WAIT_MS = 450;

/** A picture still going up after this is given up on, so a stalled connection can't hold the card's Save for minutes. */
const UPLOAD_WAIT_MS = 60_000;

/** Taller on a phone, so every button here is an easy 44px tap; back to its own size from a tablet up. */
const TAP = "min-h-11 sm:min-h-0";

/**
 * The picture drawn again at most QR_IMAGE_MAX_PX on its long side, as a
 * JPEG (or a PNG when it has see-through parts, so a logo keeps them): a
 * phone photo goes up as a few hundred KB that is still sharp on a TV, and
 * anything odd inside the file (a drawing's scripts, a photo's location) is
 * left behind. Throws with plain words when the browser can't open it.
 */
async function shrinkPicture(file: File): Promise<File> {
  const address = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = address;
    try {
      await image.decode();
    } catch {
      throw new Error("This browser can't open that picture. Try a JPEG or PNG, or a screenshot of it.");
    }
    const { width, height } = shrunkSize(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser can't make the picture smaller. Try another browser.");
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);
    let transparent = false;
    try {
      transparent = hasTransparency(context.getImageData(0, 0, width, height).data);
    } catch {
      throw new Error("This browser won't let that picture be made smaller. Try a JPEG or PNG.");
    }
    const type = pictureType(transparent);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, JPEG_QUALITY));
    if (!blob) throw new Error("Couldn't make the picture smaller. Try a JPEG or PNG.");
    return new File([blob], pictureName(file.name, type), { type });
  } finally {
    URL.revokeObjectURL(address);
  }
}

/** A picture's name for the host: the file name they uploaded or pasted, without the prefix the store adds. */
function pictureLabel(url: string): string {
  const name = uploadedFileName(url);
  return name === "your sound" ? "your picture" : name;
}

/** `value` once it has stayed the same for `ms`: typing an address asks for one preview when the typing stops, not one per letter. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * Picking a QR, shared by the show screens' QR card and the daytime custom
 * menu's card: where it leads, the host's link or picture, how big it is,
 * and a preview of what the screen will draw.
 *
 * `kinds` names the choices ("" first: the question form on the show
 * screens, no QR at all on the custom menu). `places` are where it will be
 * drawn, so the size note can say where a bigger size stops growing.
 * `blankIsNone` says "" is no QR at all, so there is no size to pick and
 * nothing to preview; otherwise `blankSrc` is the "" choice's code for the
 * preview (the question form's, by default), or null while there is none to
 * draw (the Bad Decisions page is off). `idPrefix` keeps two choosers'
 * boxes apart on one page. `onUploading` hears when a picture starts and
 * stops going up, so a card can hold its Save until the new address is in.
 *
 * Nothing here saves: every change goes to `onChange`, and the card saves.
 */
export default function QrChooser({ value, onChange, kinds, places, busy, idPrefix, blankIsNone, blankSrc = DECISIONS_QR_SRC, onUploading }: {
  value: QrChoice;
  onChange: (change: Partial<QrChoice>) => void;
  kinds: readonly { id: QrKind; label: string }[];
  places: readonly QrPlace[];
  busy: boolean;
  idPrefix: string;
  blankIsNone?: boolean;
  blankSrc?: string | null;
  onUploading?: (uploading: boolean) => void;
}): ReactElement {
  const fileInput = useRef<HTMLInputElement>(null);
  // What is picked now, for a picture landing: it goes in only while "My picture" is (pictureLands). The picture can't
  // change under an upload any other way: the paste box, and the card's Undo, Use defaults and Save, wait for it.
  const kindNow = useRef(value.kind);
  useEffect(() => { kindNow.current = value.kind; }, [value.kind]);
  const [uploading, setUploading] = useState(false);
  const [uploadProblem, setUploadProblem] = useState("");
  // The paste box is for a picture already online; most hosts upload one, so it starts folded unless a pasted address is in use.
  const [pasting, setPasting] = useState(() => /^https:/i.test(value.image));
  // The picture the preview couldn't load, so it can say so rather than show a broken image.
  const [broken, setBroken] = useState("");

  // The link as it will be saved (a bare address gets https:// in front), and the code for it once typing stops.
  const typedLink = withHttps(value.to);
  const link = cleanQrLink(typedLink);
  const previewLink = useSettled(link, PREVIEW_WAIT_MS);

  const problem = qrChoiceProblem({ kind: value.kind, to: typedLink, image: value.image });
  const image = cleanAssetUrl(value.image);
  const previewImage = useSettled(image, PREVIEW_WAIT_MS);
  const sized = !(blankIsNone && value.kind === "");
  const chip = (picked: boolean) => `${TAP} rounded-md border px-3 py-1.5 text-sm disabled:opacity-50 ${picked ? "border-amber-300 bg-amber-300/15 text-white" : "border-white/25 text-neutral-200"}`;
  // Where a bigger size stops showing bigger, said once for every place that stops short of the most.
  const stops = places.filter((place) => QR_BASE[place].maxPercent < QR_SIZE_MAX);

  const pick = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    const wrong = pictureProblem(file);
    setUploadProblem(wrong);
    if (wrong) return;
    setUploading(true);
    onUploading?.(true);
    try {
      const small = await shrinkPicture(file);
      const address = cleanAssetUrl(await upload(small, small.name, UPLOAD_WAIT_MS));
      // The host picked something else while it went up ("No QR code", say): their choice stands, and a later Save
      // never puts this picture up. Back on "My picture" by now, it goes in as if they had never left.
      if (!pictureLands(kindNow.current)) return;
      if (!address) throw new Error("The picture went up, but its address can't be used on the screen. Try again.");
      onChange({ kind: "picture", image: address });
      setPasting(false);
    } catch (error) {
      if (!pictureLands(kindNow.current)) return;
      // The server's own words when it answered; a dropped connection or a garbled answer gets a plain line, not the browser's ("Failed to fetch").
      const plain = error instanceof Error && error.message && !(error instanceof TypeError) && !(error instanceof SyntaxError);
      setUploadProblem(plain ? error.message : "The picture didn't upload. Check this phone's connection, then try again.");
    } finally {
      setUploading(false);
      onUploading?.(false);
    }
  };

  // What the screen will draw, at the size picked: a code in its white frame, or the picture as it is.
  const side = Math.round((PREVIEW_PX * value.size) / 100);
  const code = (src: string, alt: string) => (
    <span className="block bg-white p-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={side} height={side} className="block" style={{ width: side, height: side }} />
    </span>
  );
  const preview = value.kind === "link"
    ? (previewLink && previewLink === link
      ? { art: code(adminQrPreviewSrc(previewLink), `QR code for ${linkLabel(previewLink)}`), words: `Opens ${linkLabel(previewLink)}. Point your phone at it here to check.` }
      : { art: null, words: link ? "Drawing the code…" : "The code shows here once the address works." })
    : value.kind === "picture"
      ? (previewImage && previewImage === image && broken !== image
        ? {
          art: (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Your picture, as the screen will show it" onError={() => setBroken(image)} className="block object-contain" style={{ width: side, height: side }} />
          ),
          words: `Your picture: ${pictureLabel(image)}. It shows as it is, with no white frame.`,
        }
        : { art: null, words: !image ? "Your picture shows here once it is in." : broken === image ? "That picture didn't load. Upload it again, or check its address." : "Loading the picture…" })
      : blankIsNone
        ? null
        : blankSrc
          ? { art: code(blankSrc, "QR code for the Bad Decisions question form"), words: "The Bad Decisions question form: the room scans it to send a question." }
          : { art: null, words: "The question form’s code shows here once the Bad Decisions page is switched on." };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Where the QR code leads">
        {kinds.map((kind) => (
          <button key={kind.id || "blank"} type="button" aria-pressed={value.kind === kind.id} disabled={busy} onClick={() => { setUploadProblem(""); onChange({ kind: kind.id }); }} className={chip(value.kind === kind.id)}>
            {kind.label}
          </button>
        ))}
      </div>

      {value.kind === "link" ? (
        <div>
          <label htmlFor={`${idPrefix}-qr-link`} className="block text-xs text-neutral-400">Web address the code opens</label>
          <input
            id={`${idPrefix}-qr-link`}
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={value.to}
            disabled={busy}
            onChange={(event) => onChange({ to: event.target.value })}
            onBlur={(event) => { if (event.target.value !== withHttps(event.target.value)) onChange({ to: withHttps(event.target.value) }); }}
            maxLength={QR_LINK_MAX + 20}
            placeholder="instagram.com/yourbar"
            aria-invalid={Boolean(problem) && Boolean(value.to.trim())}
            aria-describedby={`${idPrefix}-qr-note`}
            className={`${TAP} mt-1 w-full rounded-md border border-white/30 bg-black px-3 py-2 text-base text-white placeholder:text-neutral-500 sm:text-sm`}
          />
          {!problem && longLink(typedLink) ? <p className="mt-1 text-xs text-amber-200">A long link makes a dense code that&rsquo;s hard to scan from across the room. A short link works better.</p> : null}
        </div>
      ) : null}

      {value.kind === "picture" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || uploading} className={`${TAP} rounded-md border border-white/30 px-3 py-1.5 text-sm disabled:opacity-50`}>
              {uploading ? "Uploading…" : image ? "Replace the picture" : "Upload a picture"}
            </button>
            <button type="button" aria-expanded={pasting} aria-controls={`${idPrefix}-qr-paste`} onClick={() => setPasting((open) => !open)} className={`${TAP} rounded-md px-2 py-1.5 text-xs text-neutral-400 underline underline-offset-2`}>
              {pasting ? "Hide the address box" : "Or paste a picture’s address"}
            </button>
            <input ref={fileInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label="Upload a picture for the QR code" onChange={(event) => void pick(event.target.files?.[0])} />
          </div>
          <p className="text-xs text-neutral-500">A photo, screenshot or logo. It&rsquo;s made {QR_IMAGE_MAX_PX}px on its longest side before it goes up, so it loads fast on the screen.</p>
          {pasting ? (
            <div id={`${idPrefix}-qr-paste`}>
              <label htmlFor={`${idPrefix}-qr-image`} className="block text-xs text-neutral-400">Picture&rsquo;s address</label>
              <input
                id={`${idPrefix}-qr-image`}
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={value.image}
                disabled={busy || uploading}
                onChange={(event) => { setUploadProblem(""); onChange({ image: event.target.value }); }}
                placeholder="https://…"
                aria-describedby={`${idPrefix}-qr-note`}
                className={`${TAP} mt-1 w-full rounded-md border border-white/30 bg-black px-3 py-2 text-base text-white placeholder:text-neutral-500 sm:text-sm`}
              />
            </div>
          ) : null}
          {uploadProblem ? <p role="alert" className="text-xs text-red-300">{uploadProblem}</p> : null}
        </div>
      ) : null}

      {/* What stops this saving, said as it changes; empty while nothing does. */}
      <p id={`${idPrefix}-qr-note`} aria-live="polite" className={problem ? "text-xs text-amber-200" : "sr-only"}>{problem}</p>

      {preview ? (
        <figure className="flex flex-wrap items-center gap-3">
          {/* As big as the code at its most, so the card doesn't jump as the size changes. Black, like the screens. */}
          <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/15 bg-black" style={{ width: PREVIEW_PX * 2 + 16, height: PREVIEW_PX * 2 + 16 }}>
            {preview.art ?? <span aria-hidden="true" className="text-3xl text-neutral-700">▢</span>}
          </div>
          <figcaption className="min-w-0 flex-1 basis-40 text-xs text-neutral-400">
            <span className="block font-semibold uppercase tracking-wider text-neutral-500">Preview</span>
            {preview.words}
          </figcaption>
        </figure>
      ) : (
        <p className="text-xs text-neutral-500">{places.includes("menu") ? "No QR code: the menu uses that space for drinks." : "No QR code on the screen."}</p>
      )}

      {sized ? (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <label htmlFor={`${idPrefix}-qr-size`} className="text-sm">Size</label>
            <input
              id={`${idPrefix}-qr-size`}
              type="range"
              min={QR_SIZE_MIN}
              max={QR_SIZE_MAX}
              step={QR_SIZE_STEP}
              value={value.size}
              disabled={busy}
              aria-valuetext={`${value.size}%`}
              aria-describedby={`${idPrefix}-qr-size-note`}
              onChange={(event) => onChange({ size: Number(event.target.value) })}
              className="h-11 min-w-0 flex-1 basis-32 accent-amber-300 sm:h-6"
            />
            <output htmlFor={`${idPrefix}-qr-size`} className="w-12 text-right text-sm tabular-nums text-neutral-300">{value.size}%</output>
            <button type="button" onClick={() => onChange({ size: DEFAULT_QR_SIZE })} disabled={busy || value.size === DEFAULT_QR_SIZE} className={`${TAP} rounded-md border border-white/30 px-3 py-1 text-xs disabled:opacity-40`}>
              Usual size (100%)
            </button>
          </div>
          <p id={`${idPrefix}-qr-size-note`} className="text-xs text-neutral-500">
            From {QR_SIZE_MIN}% to {QR_SIZE_MAX}% of its usual size.{" "}
            {stops.map((place) => `${PLACE_NAMES[place]} stops at ${QR_BASE[place].maxPercent}%.`).join(" ")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
