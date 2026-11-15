"use client";

import { useEffect, useRef, useState } from "react";
import { savePhase, type SavePhase } from "@/lib/save-state";
import { DEFAULT_QR_SIZE, DECISIONS_QR_SRC, cleanAssetUrl, cleanQrLink, linkLabel, qrChoiceProblem, withHttps } from "@/lib/screen-qr";
import { QR_KEYS, screenChanges, type ScreenSettings } from "@/lib/screen-settings";
import { openCard } from "./open-card";
import QrChooser, { type QrChoice } from "./QrChooser";
import { SaveBadge, SaveButton, useSaveTracker } from "./SaveBadge";

/** The show screens' choices: "" is the Bad Decisions question form, as the QR always was. */
const SHOW_CHOICES = [{ id: "", label: "Bad Decisions form" }, { id: "link", label: "My link" }, { id: "picture", label: "My picture" }] as const;

/** Where the show QR is drawn, so the size note can say the Intro stops at 140%. */
const SHOW_PLACES = ["corner", "menu", "explainer"] as const;

/** The QR settings as the card's draft would save them. */
function choiceOf(settings: Pick<ScreenSettings, "qrKind" | "qrTo" | "qrImage" | "qrSize">): QrChoice {
  return { kind: settings.qrKind, to: settings.qrTo, image: settings.qrImage, size: settings.qrSize };
}

/**
 * The settings the draft would save. The picked choice goes as typed (a bare
 * address with https:// in front), so a link or picture that can't be used
 * is turned away with a reason rather than quietly dropped. A half-typed one
 * behind another choice waits in its box, unsent, so it never stops the
 * form's QR or a new size from saving.
 */
function settingsOf(saved: ScreenSettings, choice: QrChoice): ScreenSettings {
  const to = withHttps(choice.to);
  const image = choice.image.trim();
  return {
    ...saved,
    qrKind: choice.kind,
    qrTo: choice.kind === "link" || !to || cleanQrLink(to) ? to : saved.qrTo,
    qrImage: choice.kind === "picture" || !image || cleanAssetUrl(image) ? image : saved.qrImage,
    qrSize: choice.size,
  };
}

/** The saved choice in a few words, for the card's folded line. */
function savedWords(saved: ScreenSettings): string {
  const size = saved.qrSize === DEFAULT_QR_SIZE ? "" : `, ${saved.qrSize}%`;
  if (saved.qrKind === "link" && cleanQrLink(saved.qrTo)) return `your link (${linkLabel(saved.qrTo, 28)})${size}`;
  if (saved.qrKind === "picture" && cleanAssetUrl(saved.qrImage)) return `your picture${size}`;
  return `the Bad Decisions form${size}`;
}

/**
 * "🔳 QR code on the show screens": the code in the live screen's corner, on
 * the show-night drink menu and in the Intro. It leads to the Bad Decisions
 * question form (as it always has), the host's own link, or it is their own
 * picture instead; and it can be made bigger or smaller. Saves only the QR's
 * own settings that changed, so it never writes over a word or switch saved
 * from another card. The daytime custom menu has its own QR, in its card.
 */
export default function ShowQrCard({ saved, busy, pageLive, save, onPhase }: {
  /** What is saved now. */
  saved: ScreenSettings;
  busy: boolean;
  /** The Bad Decisions page is on, so the show screens draw their QR. */
  pageLive: boolean;
  /** Only the QR settings that changed. True once saved. */
  save: (change: Partial<ScreenSettings>) => Promise<boolean>;
  /** Hears where the card's saving stands, for a sign at the top of the page. */
  onPhase?: (phase: SavePhase) => void;
}) {
  // Only what the host has touched; everything else shows the saved value.
  const [draft, setDraft] = useState<Partial<QrChoice>>({});
  const [uploading, setUploading] = useState(false);
  const { memo, fresh, track } = useSaveTracker();
  const value: QrChoice = { ...choiceOf(saved), ...draft };
  // Cleaned the way the server cleans it, so "changed" means something would really change, and only that is sent.
  const pending = screenChanges(saved, settingsOf(saved, value), QR_KEYS);
  const dirty = Object.keys(pending).length > 0;
  const problem = qrChoiceProblem({ kind: value.kind, to: withHttps(value.to), image: value.image });
  // The form's QR at its usual size; the saved link and picture stay, ready to pick again.
  const defaults = screenChanges(saved, { ...saved, qrKind: "", qrSize: DEFAULT_QR_SIZE }, QR_KEYS);

  // Where saving stands, told to the page only when it changes.
  const phase = savePhase(dirty, memo);
  const report = useRef(onPhase);
  useEffect(() => { report.current = onPhase; });
  useEffect(() => { report.current?.(phase); }, [phase]);

  const submit = async (change: Partial<ScreenSettings>) => {
    // Only what was sent is cleared: anything changed while it saves stays, ready for the next Save.
    const sent = draft;
    if (await track(() => save(change))) {
      setDraft((current) => Object.fromEntries(Object.entries(current).filter(([key, entry]) => sent[key as keyof QrChoice] !== entry)));
    }
  };

  return (
    <details id="show-qr-card" className="mt-4 rounded-lg border border-white/20 p-4">
      <summary className="cursor-pointer text-sm">
        🔳 QR code on the show screens
        <span className="ml-1 text-xs text-neutral-400">({savedWords(saved)})</span>
        <SaveBadge dirty={dirty} memo={memo} fresh={fresh} />
      </summary>
      <form className="mt-3 space-y-4" onSubmit={(event) => { event.preventDefault(); if (!problem && !uploading) void submit(pending); }}>
        <p className="text-sm text-neutral-400">
          The code in the corner of the live screen, on the show-night drink menu and in the Intro. Nothing changes on screen until you press Save. The daytime custom menu has its own QR, in 🌞 Custom menu.
        </p>
        {pageLive ? null : (
          <p className="rounded-md border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-xs text-amber-200">
            The Bad Decisions page is switched off, so the show screens draw no QR right now. What you pick here is kept for when it&rsquo;s back on.
          </p>
        )}

        <QrChooser
          value={value}
          onChange={(change) => setDraft((current) => ({ ...current, ...change }))}
          kinds={SHOW_CHOICES}
          places={SHOW_PLACES}
          busy={busy}
          idPrefix="show"
          blankSrc={pageLive ? DECISIONS_QR_SRC : null}
          onUploading={setUploading}
        />

        {value.kind ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 basis-56 text-xs text-neutral-500">
              With your own {value.kind === "link" ? "link" : "picture"}, the show-night menu leaves off the Bad Decisions lines under the code, unless you write your own.
            </p>
            <button type="button" onClick={() => openCard("screen-words-card")} className="min-h-11 rounded-md border border-white/20 px-3 py-1 text-xs text-neutral-200 sm:min-h-0">✏️ Words on the screen</button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 [&>button]:min-h-11 sm:[&>button]:min-h-0">
          <SaveButton type="submit" dirty={dirty} memo={memo} fresh={fresh} busy={busy} blocked={Boolean(problem) || uploading} />
          {Object.keys(draft).length ? (
            <button type="button" onClick={() => setDraft({})} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Undo changes</button>
          ) : null}
          <button
            type="button"
            onClick={() => { if (window.confirm("Put the show screens' QR back to the Bad Decisions form at its usual size? Your link and picture are kept here for next time.")) void submit(defaults); }}
            disabled={busy || uploading || !Object.keys(defaults).length}
            className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40"
          >
            Use defaults
          </button>
        </div>
        {uploading ? <p className="text-xs text-neutral-500">Save waits until the picture is in.</p> : null}
      </form>
    </details>
  );
}
