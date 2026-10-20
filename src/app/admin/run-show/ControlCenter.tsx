"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Submission } from "@/lib/types";
import type { LiveSelection } from "@/lib/live-selection";
import { DEFAULT_MARQUEE, type MarqueeChange, type MenuStyle } from "@/lib/drink-menu";
import CustomMenuCard, { type CustomMenuInput } from "./CustomMenuCard";
import DrinkListCard from "./DrinkListCard";
import MarqueeCard from "./MarqueeCard";
import { parseDrinkList, type DrinkList } from "@/lib/drink-list";
import { EXPLAINER_MS } from "@/lib/explainer";
import { NAME_MAX, PRELOAD_MAX } from "@/lib/decisions";
import { clockText, durationWords, parseLineup, slottedIds, timingOf, type Lineup, type SegmentStatus } from "@/lib/segment";
import LineupPanel, { applyDrop, clockFor, firstEmptySlot, type Drag, type LineupInput } from "./LineupPanel";
import { useWakeLock } from "@/lib/use-wake-lock";
import { fetchWithin } from "@/lib/fetch-within";
import { isNewerBuild } from "@/lib/build";
import LiveMirror from "./LiveMirror";
import MessageCard from "./MessageCard";
import ScreenSettingsCard from "./ScreenSettingsCard";
import TestSoundButton from "./TestSoundButton";
import { parseScreenSettings, type ScreenSettings } from "@/lib/screen-settings";
import { parseMessage, type MessageChange, type ScreenMessage } from "@/lib/screen-message";
import { screenStatus } from "@/lib/screen-status";
import QuestionEditor from "./QuestionEditor";
import QuestionSearch from "./QuestionSearch";
import { matchesSearch, onScreenQuestion, withEdit, type QuestionChange } from "@/lib/questions";

type State = {
  /** The performers' cards: names and questions, filled in ahead. */
  lineup: Lineup;
  /** The set running now, as of `segmentAt`. */
  segment: SegmentStatus;
  /** When this page received `segment`, so the clock can keep ticking between polls. */
  segmentAt: number;
  submissions: Submission[];
  shown: Submission[];
  archived: Submission[];
  selected: LiveSelection | null;
  /** The drink menu is up on the live screen, over any question. */
  menu: boolean;
  /** Which drink menu: the standard one, or the custom one with its colour and line above the QR. */
  menuStyle: MenuStyle;
  /** The custom menu's saved text colour and line above the QR; "" for the defaults. */
  menuColor: string;
  menuHeadline: string;
  /** The custom menu's note in the empty space ("" for none) and its colour ("" to follow the text colour). */
  menuNote: string;
  menuNoteColor: string;
  /** The custom menu's font, and tonight's bartender in a script font and colour ("" for the defaults, or no bartender). */
  menuFont: string;
  menuBartender: string;
  menuBartenderFont: string;
  menuBartenderColor: string;
  /** Text running around the edge while the drink menu is up; empty for none. */
  marquee: string;
  truncated: boolean;
  questionsOpen: boolean;
  manualOpen: boolean;
  pageLive: boolean;
  /** How the live screen behaves and what it says ("" words are the defaults). Missing from an older server. */
  screen?: ScreenSettings;
  /** The host's own message for the live screen, up or saved for later. */
  message?: ScreenMessage;
  /** The TV said it runs an older version of the site and could not reload itself; null when it is up to date. */
  staleScreen?: { at: string } | null;
  /** The host pressed "Close questions now" and it still holds. */
  manualClosed: boolean;
  /** The marquee on or off, its speed ("" for Normal) and its own colour ("" to follow the menu's text colour). */
  marqueeOn: boolean;
  marqueeSpeed: string;
  marqueeColor: string;
  /** The custom menu's wording under the QR code and over the bartender; "" for the printed wording. */
  menuQrCaption: string;
  menuQrTitle: string;
  menuQrLink: string;
  menuBartenderLabel: string;
  /** The host's drink list, shown by both menus; null while it is the printed menu. */
  drinks: DrinkList | null;
};
/** The one open editor: which question, and where it was opened (the waiting list, the shown list, or the "On screen" box). */
type Editing = { at: "pile" | "shown" | "screen"; id: string };
type Change = Partial<Pick<State, "selected" | "menu" | "menuStyle" | "menuColor" | "menuHeadline" | "menuNote" | "menuNoteColor" | "menuFont" | "menuBartender" | "menuBartenderFont" | "menuBartenderColor" | "marquee" | "questionsOpen" | "manualOpen" | "pageLive" | "segment" | "lineup">> & { drawn?: Submission; submission?: Submission };

const API = "/api/admin/run-show";
const PILE_API = "/api/admin/decisions";
/** How often the pile is checked. New questions show up within this. */
const POLL_MS = 4_000;
/** Forwarded texts are collected on the way past, but not on every poll. */
const INGEST_EVERY_MS = 30_000;
const PING_KEY = "pnc-control-center-ping";
/** A poll still unanswered after this is given up, so one stalled request never freezes the page. */
const POLL_TIMEOUT_MS = 15_000;
/**
 * A press is given up after this: just past the longest the server lets an
 * action run, so a slow one (archiving a big pile, adding many questions)
 * still lands, and only a request that will never answer frees the buttons.
 */
const CHANGE_TIMEOUT_MS = 65_000;
/** Given up on a press: the server may still have done it, so the host checks before pressing again. */
const NO_ANSWER = "No answer from the server yet. It may still have gone through: check the screen and the lists before trying again.";
/** A saved notice is news for a moment: it goes after this, or longer for a long one, so it can be read. */
const NOTICE_MS = 6_000;
/** Why Draw, Clear and Show are greyed out during a set. */
const SET_OWNS_SCREEN = "A set is running and owns the screen. Press Stop in Sets first.";
/** Why "+ Set" is greyed out: it only fills the set on stage and cards that haven't run, and none has a slot free. */
const NO_OPEN_SLOT = "Every card has run or is full. Add a performer in Sets, or empty a slot on a card that hasn't run.";

/**
 * A poll answer with the menu fields this version added filled in when they
 * are missing, as they are from an older deployment after a rollback: the
 * cards read them as given, and one missing would take the page down mid-show.
 */
function withDefaults(data: State): State {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return {
    ...data,
    marqueeOn: data.marqueeOn !== false,
    marqueeSpeed: text(data.marqueeSpeed),
    marqueeColor: text(data.marqueeColor),
    menuQrCaption: text(data.menuQrCaption),
    menuQrTitle: text(data.menuQrTitle),
    menuQrLink: text(data.menuQrLink),
    menuBartenderLabel: text(data.menuBartenderLabel),
    drinks: parseDrinkList(data.drinks),
  };
}

/**
 * The show-night control center: the questions as they arrive, a mirror of
 * the live screen, and every control for the pile. Only reachable signed in.
 */
export default function ControlCenter({ build = "" }: { build?: string }) {
  const [state, setState] = useState<State | null>(null);
  // What went wrong with the host's last press. It stays up until they dismiss it or press again: a poll
  // that fails says so in `loadError` instead, so the next good poll can't wipe a press's error unseen.
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [authLost, setAuthLost] = useState(false);
  // The site was updated while this page was open; it says so rather than reloading over unsaved typing.
  const [updated, setUpdated] = useState(false);
  const [mirrorVersion, setMirrorVersion] = useState(0);
  // Ids that arrived while this page was open and have not been looked at yet.
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [texting, setTexting] = useState<{ on: boolean; error: string }>({ on: false, error: "" });
  // While the explainer is on the live screen, its button waits.
  const [explaining, setExplaining] = useState(false);
  // Questions the host is typing in ahead of time, one per line.
  const [preloadText, setPreloadText] = useState("");
  const [preloadName, setPreloadName] = useState("");
  const [dragging, setDragging] = useState<Drag | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  // What the host typed to find a waiting question; only narrows the list on this page.
  const [search, setSearch] = useState("");
  // Ticks while the segment runs, so its clock counts down between polls.
  const [now, setNow] = useState(() => Date.now());
  const ping = useSyncExternalStore(subscribePing, readPing, () => false);
  useWakeLock();
  const revision = useRef(0);
  // Changes go out one after another, each waiting for the one before: `queue` is the last one sent,
  // `pending` how many are queued or out, and `loud` how many of those grey out the buttons.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  const loud = useRef(0);
  const loading = useRef(false);
  // Every id seen so far; null until the first load, so nothing already in the pile counts as new.
  const known = useRef<Set<string> | null>(null);
  const lastIngest = useRef(0);
  const pingOn = useRef(ping);
  useEffect(() => { pingOn.current = ping; }, [ping]);

  const refresh = useCallback(async () => {
    if (loading.current || pending.current > 0) return;
    loading.current = true;
    const started = revision.current;
    try {
      if (Date.now() - lastIngest.current > INGEST_EVERY_MS) {
        lastIngest.current = Date.now();
        await collectTexts(setTexting);
      }
      const { response, text } = await fetchWithin(API, { cache: "no-store" }, POLL_TIMEOUT_MS);
      if (response.status === 401) { setAuthLost(true); return; }
      const data = JSON.parse(text) as State & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not load questions.");
      // A poll started before a host's change must not undo that change in the UI.
      if (started !== revision.current || pending.current > 0) return;
      const ids = [...data.submissions, ...data.shown, ...data.archived].map((item) => item.id);
      if (known.current) {
        const arrived = data.submissions.filter((item) => !known.current?.has(item.id)).map((item) => item.id);
        if (arrived.length) {
          setFresh((current) => new Set([...current, ...arrived]));
          if (pingOn.current) playPing();
        }
      }
      known.current = new Set([...(known.current ?? []), ...ids]);
      // Read the lineup as the server does, so one missing a newer field (say, from an older build) still draws.
      setState({ ...withDefaults(data), lineup: parseLineup(data.lineup), segmentAt: Date.now() });
      // An editor whose question has moved on (shown, put in a card, deleted on another device)
      // closes for good, rather than opening again wherever the question turns up next.
      setEditing((current) => (current && !stillThere(current, data) ? null : current));
      if (isNewerBuild(build, (data as { build?: unknown }).build)) setUpdated(true);
      setLoadError("");
    } catch (failure) {
      if (started === revision.current) setLoadError(plainError(failure, "Could not load questions."));
    } finally { loading.current = false; }
  }, [build]);

  useEffect(() => {
    // refresh reads external server state, rather than deriving state from props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    const resume = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [refresh]);

  // The tab shows how many new questions are waiting, even from another window.
  useEffect(() => {
    const base = "Control Center";
    document.title = fresh.size ? `(${fresh.size}) ${base}` : base;
    return () => { document.title = base; };
  }, [fresh]);

  // A notice floats over the page, so it goes once it has had time to be read. An error stays until it is
  // dismissed or the next press: a lost change must not slip by unseen.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), Math.max(NOTICE_MS, notice.length * 60));
    return () => clearTimeout(timer);
  }, [notice]);

  /**
   * One change at a time, and the poll waits until every one has landed. A
   * press made while another is out waits its turn rather than being dropped.
   * A `quiet` change (a performer's name, saved as its box loses focus) leaves
   * the buttons live, so the click that took the focus away still lands.
   */
  const change = (endpoint: string, body: object, done: (data: Change & Record<string, unknown>) => void, failed = "Could not update the screen.", { quiet = false } = {}): Promise<boolean> => {
    pending.current += 1;
    revision.current += 1;
    if (!quiet) {
      loud.current += 1;
      setBusy(true);
    }
    setError("");
    setNotice("");
    const send = async () => {
      try {
        // A change that never answers must not hold every button: give up, and the next poll shows what landed.
        const { response, text } = await fetchWithin(endpoint, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        }, CHANGE_TIMEOUT_MS);
        if (response.status === 401) { setAuthLost(true); return false; }
        // The server always answers in JSON. Anything else is the platform's own page (a gateway timeout, a crash):
        // the press may still have gone through, so the host checks before pressing again.
        if (!text.trimStart().startsWith("{")) { setError(response.status >= 500 ? NO_ANSWER : failed); return false; }
        const data = JSON.parse(text);
        if (!response.ok || data.ok === false) throw new Error(data.error || failed);
        done(data);
        return true;
      } catch (failure) {
        setError(gaveUp(failure) ? NO_ANSWER : plainError(failure, failed));
        return false;
      } finally {
        revision.current += 1;
        pending.current -= 1;
        if (!quiet) loud.current -= 1;
        if (!loud.current) setBusy(false);
      }
    };
    // send never rejects, so one failed change never stops the ones queued behind it.
    const sent = queue.current.then(send);
    queue.current = sent;
    return sent;
  };

  const forget = (id: string) => setFresh((current) => {
    if (!current.has(id)) return current;
    const next = new Set(current);
    next.delete(id);
    return next;
  });

  /** Move a question from the waiting list to the shown list, in the UI. */
  const moveToShown = (current: State, id: string, selected: LiveSelection | null): State => {
    const item = current.submissions.find((entry) => entry.id === id);
    return {
      ...current,
      selected,
      menu: selected ? false : current.menu,
      message: selected && current.message ? { ...current.message, on: false } : current.message,
      submissions: current.submissions.filter((entry) => entry.id !== id),
      shown: item ? [{ ...item, shownAt: new Date().toISOString() }, ...current.shown] : current.shown,
    };
  };

  const select = (submissionId: string | null) =>
    change(API, { submissionId }, (data) => {
      if (submissionId) forget(submissionId);
      setState((current) => current
        ? submissionId ? moveToShown(current, submissionId, data.selected ?? null) : { ...current, selected: data.selected ?? null }
        : current);
    });

  const draw = () =>
    // Never the question open in an editor: it waits until the edit is saved or cancelled.
    change(API, { draw: true, ...(editing?.at === "pile" ? { skip: editing.id } : {}) }, (data) => {
      const drawn = data.drawn;
      if (!drawn) return;
      forget(drawn.id);
      setState((current) => current ? moveToShown(current, drawn.id, data.selected ?? null) : current);
      setNotice(`Drawn: “${drawn.decision.slice(0, 60)}${drawn.decision.length > 60 ? "…" : ""}” is on screen.`);
    }, "Could not draw a question.");

  /** Take the server's word on the whole drink menu record after any change to it. */
  const takeMenu = (data: Change & Record<string, unknown>) =>
    setState((current) => current ? {
      ...current,
      menu: Boolean(data.menu),
      menuStyle: data.menuStyle === "custom" ? "custom" : "standard",
      marquee: typeof data.marquee === "string" ? data.marquee : current.marquee,
      menuColor: typeof data.menuColor === "string" ? data.menuColor : current.menuColor,
      menuHeadline: typeof data.menuHeadline === "string" ? data.menuHeadline : current.menuHeadline,
      menuNote: typeof data.menuNote === "string" ? data.menuNote : current.menuNote,
      menuNoteColor: typeof data.menuNoteColor === "string" ? data.menuNoteColor : current.menuNoteColor,
      menuFont: typeof data.menuFont === "string" ? data.menuFont : current.menuFont,
      menuBartender: typeof data.menuBartender === "string" ? data.menuBartender : current.menuBartender,
      menuBartenderFont: typeof data.menuBartenderFont === "string" ? data.menuBartenderFont : current.menuBartenderFont,
      menuBartenderColor: typeof data.menuBartenderColor === "string" ? data.menuBartenderColor : current.menuBartenderColor,
      marqueeOn: typeof data.marqueeOn === "boolean" ? data.marqueeOn : current.marqueeOn,
      marqueeSpeed: typeof data.marqueeSpeed === "string" ? data.marqueeSpeed : current.marqueeSpeed,
      marqueeColor: typeof data.marqueeColor === "string" ? data.marqueeColor : current.marqueeColor,
      menuQrCaption: typeof data.menuQrCaption === "string" ? data.menuQrCaption : current.menuQrCaption,
      menuQrTitle: typeof data.menuQrTitle === "string" ? data.menuQrTitle : current.menuQrTitle,
      menuQrLink: typeof data.menuQrLink === "string" ? data.menuQrLink : current.menuQrLink,
      menuBartenderLabel: typeof data.menuBartenderLabel === "string" ? data.menuBartenderLabel : current.menuBartenderLabel,
    } : current);

  /**
   * The marquee's one Save: its text, then how it runs, each only if it changed. The server takes them as
   * two changes, so the second waits for the first, and a refused text leaves the style unsent. True once
   * all of it is saved; otherwise the card keeps the typing for another try.
   */
  const saveMarquee = async ({ text, style }: MarqueeChange) => {
    if (text === undefined && !style) return true;
    let saved: Record<string, unknown> = {};
    const take = (data: Change & Record<string, unknown>) => { takeMenu(data); saved = data; };
    if (text !== undefined && !(await change(API, { marquee: text }, take, "Could not update the marquee."))) return false;
    if (style && !(await change(API, { marqueeStyle: style }, take, "Could not update the marquee."))) return false;
    // Switched off, the text is kept for when it comes back on: say so rather than that it runs.
    setNotice(saved.marqueeOn === false
      ? `Marquee off: the drink menu fills the screen.${text !== undefined ? " Its text is saved for when it comes back on." : ""}`
      : `${text === "" ? `Marquee back to “${DEFAULT_MARQUEE}”.` : "Marquee saved."} ${saved.menu ? "The live screen has it now." : "It runs when you show either drink menu."}`);
    return true;
  };

  const playExplainer = () =>
    change(API, { explainer: true }, () => {
      setExplaining(true);
      setTimeout(() => setExplaining(false), EXPLAINER_MS);
      setNotice(`The intro is playing on the live screen (about ${Math.round(EXPLAINER_MS / 1000)} seconds), then it goes back to what was up.`);
    }, "Could not start the intro.");

  /** Put one of the two menus up (switching straight from the other), or take the menu down. */
  const setMenu = (style: MenuStyle | null) =>
    change(API, style ? { menu: true, style } : { menu: false }, (data) => {
      takeMenu(data);
      // A menu going up takes the host's message down on the server too.
      if (style) setState((current) => current?.message?.on ? { ...current, message: { ...current.message, on: false } } : current);
    }, "Could not update the drink menu.");

  const saveCustomMenu = (look: CustomMenuInput) =>
    change(API, { customMenu: look }, (data) => {
      takeMenu(data);
      setNotice(data.menu && data.menuStyle === "custom" ? "Custom menu saved. The live screen has it now." : "Custom menu saved. It shows when you put the custom menu up.");
    }, "Could not save the custom menu.");

  /** The live screen's own cards (settings, message, test sound): one change, then the server's word on what is saved and, when a message went up, the drink menu. */
  const screenAction = (body: object, done: string, failed: string) =>
    change(API, body, (data) => {
      setState((current) => current ? {
        ...current,
        ...(data.screen ? { screen: parseScreenSettings(data.screen) } : {}),
        ...(data.message ? { message: parseMessage(data.message) } : {}),
        ...(typeof data.menu === "boolean" ? { menu: data.menu } : {}),
      } : current);
      setNotice(done);
    }, failed);
  const sendMessage = (message: MessageChange) =>
    screenAction({ message }, message.on ? "Your message is on the live screen." : "Message taken down.", "Could not update the message.");

  /** Take the server's word on the drink list after a change to it; `message` says what changed. */
  const takeDrinks = (message: string) => (data: Change & Record<string, unknown>) => {
    const saved = parseDrinkList(data.drinks);
    setState((current) => current ? { ...current, drinks: saved } : current);
    setNotice(message);
  };

  /**
   * The whole drink list (null for the printed menu). `from` is the saved
   * list the editor last saw: the server refuses the save if another screen
   * has changed it since, rather than quietly undoing that change.
   */
  const saveDrinks = (drinks: DrinkList | null, message: string, from?: DrinkList | null) =>
    change(API, from === undefined ? { drinks } : { drinks, from }, takeDrinks(message), "Could not save the drink list.");

  /** One drink sold out or back; the server changes just that drink on the list as saved now. */
  const markDrink = (id: string, on: boolean, message: string) =>
    change(API, { soldOut: { id, on } }, takeDrinks(message), "Could not save the drink list.");

  const putBack = (id: string) =>
    change(API, { putBack: id }, (data) => {
      const item = data.submission;
      setState((current) => current ? {
        ...current,
        shown: current.shown.filter((entry) => entry.id !== id),
        submissions: item ? [item, ...current.submissions] : current.submissions,
      } : current);
    }, "Could not put that question back.");

  const preload = async () => {
    let added: Submission[] = [];
    const ok = await change(API, { preload: { text: preloadText, name: preloadName } }, (data) => {
      added = Array.isArray(data.added) ? (data.added as Submission[]) : [];
      // The host typed these: they are not "new arrivals" and should not ping.
      known.current = new Set([...(known.current ?? []), ...added.map((item) => item.id)]);
      setState((current) => current ? { ...current, submissions: [...current.submissions, ...added] } : current);
    }, "Could not add those questions.");
    if (!ok) return;
    setPreloadText("");
    setNotice(added.length === 1 ? "1 question added to the pile." : `${added.length} questions added to the pile.`);
    await refresh();
  };

  const running = Boolean(state?.segment.running);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [running]);
  // The running set's clock right now, run forward from the last poll.
  const setClock = state ? clockFor(state.segment, state.segmentAt, now) : clockFor({ running: false, performerId: null, index: null, remainingMs: 0, nextSwitchMs: 0 }, 0, now);

  const takeLineup = (data: Change & Record<string, unknown>) => {
    if (!data.lineup || !data.segment) return;
    const lineup = parseLineup(data.lineup);
    const segment = data.segment;
    setState((current) => current ? { ...current, lineup, segment, segmentAt: Date.now() } : current);
  };

  /**
   * Save the lineup. It shows at once; the server's answer (and the next poll) settle it. `quiet` (a name
   * typed into a card) leaves the buttons live. True once the server has it.
   */
  const saveLineup = async (input: LineupInput, optimistic: Lineup, options?: { quiet?: boolean }) => {
    setState((current) => current ? { ...current, lineup: optimistic } : current);
    for (const entry of input) for (const id of entry.slots) if (id) forget(id);
    const ok = await change(API, { lineup: input }, takeLineup, "Could not save the lineup.", options);
    // Saved or not, the waiting list catches up with what moved in or out of the cards.
    await refresh();
    return ok;
  };

  /** "+ Set": into the first open slot of the set on stage, else the next card that has not run. */
  const addToSet = (item: Submission) => {
    if (!state) return;
    const to = firstEmptySlot(state.lineup, setClock);
    const input = to && applyDrop(state.lineup, to, { from: "pile", id: item.id }, setClock);
    if (!input || !to) return;
    const optimistic: Lineup = { ...state.lineup, performers: state.lineup.performers.map((performer) => performer.id !== to.performer ? performer : {
      ...performer, slots: performer.slots.map((slot, i) => (i === to.slot ? { submissionId: item.id, question: item.decision, name: item.name.trim() } : slot)),
    }) };
    void saveLineup(input, optimistic);
  };

  const startSet = async (performerId: string) => {
    if (!state) return;
    const performer = state.lineup.performers.find((entry) => entry.id === performerId);
    if (!performer) return;
    const who = performer.name || "this performer";
    const timing = timingOf(state.lineup, performer);
    const replacing = running && state.segment.performerId !== performerId;
    const warnings = [
      replacing ? "This stops the set that is running now." : "",
      !performer.name && timing.nameMs ? `There is no name on this card, so the screen stays blank for the first ${durationWords(timing.nameMs)}.` : "",
      performer.slots.every((slot) => !slot) ? "No questions are lined up." : "",
    ].filter(Boolean);
    if (warnings.length && !window.confirm(`Start ${who}'s ${durationWords(timing.setMs)}?\n\n${warnings.join("\n")}`)) return;
    const ok = await change(API, { segment: "start", performerId }, (data) => {
      takeLineup(data);
      // The set owns the screen: the server took the menu, the question and the host's message down.
      setState((current) => current ? { ...current, menu: false, selected: null, message: current.message ? { ...current.message, on: false } : current.message } : current);
      setNow(Date.now());
      setNotice(`${who === "this performer" ? "The set" : `${who}'s set`} has started. ${timing.nameMs ? `Their name is on screen; the first question goes up at ${clockText(timing.nameMs)}.` : "The first question is up now."}`);
    }, "Could not start the set.");
    if (ok) await refresh();
  };

  const stopSet = async () => {
    if (!window.confirm("Stop the set? The timer comes off the live screen and the screen clears.")) return;
    const ok = await change(API, { segment: "stop" }, (data) => {
      takeLineup(data);
      setNotice("Set stopped.");
    }, "Could not stop the set.");
    if (ok) await refresh();
  };

  /** Set timing and clearing finished cards: the server answers with the whole lineup. */
  const editLineup = async (body: object, done: string, failed: string) => {
    const ok = await change(API, body, (data) => {
      takeLineup(data);
      setNotice(done);
    }, failed);
    // Questions that came out of a card are back in the waiting list.
    if (ok) await refresh();
    return ok;
  };

  const setManualOpen = (manualOpen: boolean) =>
    change(API, { manualOpen }, (data) => {
      setState((current) => current ? {
        ...current, questionsOpen: Boolean(data.questionsOpen), manualOpen: Boolean(data.manualOpen), pageLive: Boolean(data.pageLive),
        manualClosed: Boolean(data.manualClosed),
      } : current);
      setNotice(manualOpen ? "Questions are open now and will stay open until you return to the schedule." : "Questions are following the schedule again.");
    }, "Could not update questions.");

  /** Stop new questions mid-show (the pile is full): the form says it is closed until you open it again or tonight's hours end. */
  const closeQuestionsNow = () =>
    change(API, { manualClosed: true }, (data) => {
      setState((current) => current ? {
        ...current, questionsOpen: Boolean(data.questionsOpen), manualOpen: Boolean(data.manualOpen), pageLive: Boolean(data.pageLive), manualClosed: Boolean(data.manualClosed),
      } : current);
      setNotice(data.manualClosed
        ? "Questions are closed. The form stays closed until you open it again or tonight's hours end; next week opens on schedule."
        : "Questions are closed. They open again at the scheduled time.");
    }, "Could not update questions.");

  /** Save a fix to a question's words or name (or put back what was sent), wherever it sits. */
  const editQuestion = (id: string, edit: QuestionChange) =>
    change(API, { editQuestion: { submissionId: id, ...edit } }, (data) => {
      const item = data.submission;
      if (!item) return;
      setState((current) => current ? withEdit(current, item) : current);
      setNotice(`${"revert" in edit ? "Back to what they sent." : "Saved."}${item.id === state?.selected?.submissionId ? " The live screen shows it within a few seconds." : ""}`);
    }, "Could not save that question.");

  /** An archived question back to the waiting list. */
  const restore = (id: string) =>
    change(API, { restore: id }, (data) => {
      const item = data.submission;
      setState((current) => current ? {
        ...current,
        archived: current.archived.filter((entry) => entry.id !== id),
        submissions: item ? [item, ...current.submissions] : current.submissions,
      } : current);
      setNotice("Back in the waiting list.");
    }, "Could not bring that question back.");

  const remove = async (item: Submission) => {
    if (!window.confirm(`Delete this question for good?\n\n${item.decision.slice(0, 120)}`)) return;
    forget(item.id);
    await change(PILE_API, { action: "delete", id: item.id }, () => {
      setState((current) => current ? {
        ...current,
        submissions: current.submissions.filter((entry) => entry.id !== item.id),
        shown: current.shown.filter((entry) => entry.id !== item.id),
        archived: current.archived.filter((entry) => entry.id !== item.id),
        // Deleting the question on screen clears the screen on the server too.
        selected: current.selected?.submissionId === item.id ? null : current.selected,
      } : current);
    }, "Could not delete that question.");
  };

  const archive = async () => {
    if (!window.confirm("Archive every question from tonight? The pile goes back to zero and the screen clears.")) return;
    // The server archives a batch at a time so a big pile cannot outlast one
    // request; keep asking until it says nothing is left. Bounded, so a server
    // that stopped making progress cannot spin here.
    let done = false;
    for (let pass = 0; pass < 40; pass += 1) {
      let remaining = 0;
      const ok = await change(PILE_API, { action: "archive-all" }, (data) => { remaining = Number(data.remaining) || 0; }, "Could not archive the pile.");
      if (!ok) break;
      if (!remaining) { done = true; break; }
    }
    // Only a finished archive says so; a failed pass leaves its own message up.
    if (done) {
      setFresh(new Set());
      setNotice("Tonight's pile is archived. The screen is clear.");
    }
    await refresh();
  };

  if (authLost) return (
    <main className="flex min-h-svh items-center justify-center px-5">
      <a href="/admin/run-show" className="underline">Sign in again to the Control Center</a>
    </main>
  );

  // Waiting: not in a card. Read against the lineup as it shows, so a question leaves the list the moment it
  // goes into a card, rather than when the server next answers, and "+ Set" can't put it in a second slot.
  const lined = state ? slottedIds(state.lineup) : new Set<string>();
  const waiting = (state?.submissions ?? []).filter((item) => !lined.has(item.id));
  const onScreenId = state?.selected?.submissionId ?? null;
  const screenSettings = parseScreenSettings(state?.screen);
  const screenMessage = parseMessage(state?.message);
  const isEditing = (at: Editing["at"], id: string) => editing?.at === at && editing.id === id;
  // A waiting question with its editor open stays put: listed whatever the search, and out of reach of
  // Show on screen, + Set, Draw one and Fill empty, so the typing is never thrown away under the host.
  const held = editing?.at === "pile" ? editing.id : null;
  const listed = waiting.filter((item) => item.id === held || matchesSearch(item, search));
  const onScreenItem = state ? onScreenQuestion(state.selected, [state.shown, state.submissions, state.archived]) : null;
  const onStage = running ? state?.lineup.performers.find((performer) => performer.id === setClock.performerId) : undefined;
  const status = !state ? "Connecting…" : screenStatus({
    menu: state.menu ? state.menuStyle : null,
    message: screenMessage.on,
    set: running ? { name: onStage?.name ?? "", index: setClock.index } : null,
    question: Boolean(state.selected),
  });
  // Where "+ Set" would put a question; null when no card has an open slot, and the button says why it waits.
  const openSlot = state ? firstEmptySlot(state.lineup, setClock) : null;

  return (
    <main className="min-h-svh bg-neutral-950 px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Control Center</h1>
            <p className="mt-1 text-sm text-neutral-400">Bad Decisions, show night. Questions land here as they come in; the live screen follows what you pick.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/admin" className="rounded-md border border-white/30 px-4 py-2 text-sm">Admin</a>
            <a href="/bad-decisions/live" target="_blank" rel="noopener noreferrer" className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black">
              Open live screen
            </a>
          </div>
        </header>

        {updated ? (
          <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-400/60 bg-sky-950/40 px-4 py-2 text-sm text-sky-100">
            <span>The site was just updated. Reload this page to get the newest Control Center (save anything you are typing first). The live screen updates itself when it can; if it can&rsquo;t, a note here says so.</span>
            <button type="button" onClick={() => window.location.reload()} className="rounded-md bg-sky-300 px-3 py-1.5 font-semibold text-black">Reload</button>
          </div>
        ) : null}
        {state?.staleScreen ? (
          <div role="status" className="mb-4 rounded-lg border border-amber-300/60 bg-amber-950/40 px-4 py-2 text-sm text-amber-100">
            The live screen (the TV) is running an older version of the site, so new features may not show. It couldn&rsquo;t update itself without interrupting the room (full screen, sound that needed a tap, or a reload that didn&rsquo;t take). Between sets, on the TV laptop press <kbd className="rounded border border-amber-200/40 px-1">F5</kbd> (<kbd className="rounded border border-amber-200/40 px-1">⌘R</kbd> on a Mac), then <kbd className="rounded border border-amber-200/40 px-1">F</kbd> for full screen and click once for sound.
          </div>
        ) : null}
        {/* Pinned to the window rather than the page, so a press far down (a sold-out tap, a settings save) still shows what happened. */}
        <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
          {error ? (
            <div role="alert" className="pointer-events-auto flex max-w-xl items-start gap-2 rounded-lg border border-red-400/60 bg-neutral-900/95 py-2 pl-4 pr-2 text-sm text-red-200 shadow-lg">
              <span className="min-w-0 flex-1 py-0.5">{error}</span>
              <button type="button" onClick={() => setError("")} aria-label="Dismiss the error" className="shrink-0 rounded px-2 py-0.5 text-red-200 hover:text-white">✕</button>
            </div>
          ) : null}
          {notice ? <p role="status" className="max-w-xl rounded-lg border border-emerald-400/50 bg-neutral-900/95 px-4 py-2 text-sm text-emerald-200 shadow-lg">{notice}</p> : null}
          {loadError ? <p role="status" className="max-w-xl rounded-lg border border-amber-300/60 bg-neutral-900/95 px-4 py-2 text-sm text-amber-100 shadow-lg">Not up to date: {loadError} It keeps trying every few seconds.</p> : null}
        </div>
        {state?.truncated ? <p className="mb-4 text-sm text-amber-200">Showing the newest available questions. There are more stored than can be listed at once; delete some archived ones to bring the rest into view.</p> : null}

        {/* Show-time controls first: the live screen, then Sets and Questions, with setup last. On a wide screen setup
            sits under the live screen; on a phone it comes after the questions, so mid-show taps are near the top. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-[auto_1fr]">
          <section aria-label="Live screen" className="min-w-0 lg:col-start-1 lg:row-start-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-neutral-400">Live screen</p>
                <p className="text-sm">{status}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {screenMessage.on ? (
                  // Always in reach, even with the message card folded away (say, after a reload mid-show).
                  <button type="button" onClick={() => void sendMessage({ on: false })} disabled={busy || !state} className="rounded-md bg-sky-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
                    Take message down
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void playExplainer()}
                  disabled={busy || !state || explaining}
                  title="Explains Bad Decisions to the room and plays an example with the sound"
                  className="rounded-md border border-[#ff2e4d] px-4 py-2 text-sm font-semibold text-[#ff8a9c] disabled:opacity-50"
                >
                  {explaining ? "Intro playing…" : "Intro"}
                </button>
                <TestSoundButton sound={screenSettings.sound} busy={busy || !state} test={() => screenAction({ soundTest: true }, "The projector is playing the sound. Nothing heard? Click the live screen once to turn its sound on, then test again.", "Could not test the sound.")} />
                {(["standard", "custom"] as const).map((style) => {
                  const up = Boolean(state?.menu) && state?.menuStyle === style;
                  const label = style === "custom" ? "custom menu" : "drink menu";
                  return (
                    <button
                      key={style}
                      type="button"
                      onClick={() => void setMenu(up ? null : style)}
                      disabled={busy || !state}
                      aria-pressed={up}
                      title={style === "custom" ? "The drink menu in your colour, with your line above the QR code" : "The standard drink menu"}
                      className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50 ${up ? "bg-amber-300 text-black" : "border border-amber-300/70 text-amber-200"}`}
                    >
                      {up ? `Hide ${label}` : `Show ${label}`}
                    </button>
                  );
                })}
                <button type="button" onClick={() => void draw()} disabled={busy || running || !waiting.some((item) => item.id !== held)} title={running ? SET_OWNS_SCREEN : undefined} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">🎲 Draw one</button>
                <button type="button" onClick={() => void select(null)} disabled={busy || running || !state?.selected} title={running ? SET_OWNS_SCREEN : undefined} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-40">Clear screen</button>
              </div>
            </div>
            <LiveMirror version={mirrorVersion} />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
              <span>A copy of what the projector shows. It checks for changes every few seconds, so it can trail the projector by a moment.</span>
              <button type="button" onClick={() => setMirrorVersion((value) => value + 1)} className="underline">Reload mirror</button>
            </div>
            <MessageCard
              message={screenMessage}
              menu={Boolean(state?.menu)}
              busy={busy || !state}
              send={sendMessage}
            />
            {state?.selected ? (
              <div className="mt-4 rounded-lg border border-white/20 p-4">
                <p className="whitespace-pre-wrap break-words text-lg">{state.selected.question}</p>
                {state.selected.name ? <p className="mt-1 text-sm text-neutral-300">— {state.selected.name} {screenSettings.names ? "(shown on screen)" : "(name hidden on screen)"}</p> : null}
                {onScreenItem && isEditing("screen", onScreenItem.id) ? (
                  <QuestionEditor question={onScreenItem} live busy={busy} save={(edit) => editQuestion(onScreenItem.id, edit)} close={() => setEditing(null)} />
                ) : onScreenItem ? (
                  <button type="button" onClick={() => setEditing({ at: "screen", id: onScreenItem.id })} disabled={busy} className="mt-3 rounded-md border border-white/30 px-3 py-1.5 text-sm disabled:opacity-50">Edit</button>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 rounded-lg border border-white/20 p-4">
              <p className="text-sm">{!state ? "Checking questions…" : state.questionsOpen ? "Questions are open" : state.manualClosed ? "Questions are closed (you closed them)" : "Questions are closed"}</p>
              <p className="mt-1 text-sm text-neutral-400">
                {state && !state.pageLive
                  ? "The Bad Decisions page is switched off, so the QR goes nowhere. Open questions now switches it on."
                  : "Open questions whenever you want. The live screen stays as it is."}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {/* Only greyed out when pressing it would change nothing: open by hand but closed by "Close questions now" still opens. */}
                <button type="button" onClick={() => void setManualOpen(true)} disabled={busy || !state || (state.manualOpen && state.questionsOpen)} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Open questions now</button>
                {state?.questionsOpen ? <button type="button" onClick={() => void closeQuestionsNow()} disabled={busy} title="Stops new questions, for example when the pile is full. The form says it is closed." className="rounded-md border border-red-500/60 px-4 py-2 text-sm text-red-200 disabled:opacity-50">Close questions now</button> : null}
                {state?.manualOpen || state?.manualClosed ? <button type="button" onClick={() => void setManualOpen(false)} disabled={busy} className="rounded-md border border-white/30 px-4 py-2 text-sm disabled:opacity-50">Use scheduled hours</button> : null}
              </div>
              {texting.on ? (
                <p className={`mt-3 text-xs ${texting.error ? "text-amber-200" : "text-neutral-500"}`}>
                  {texting.error ? `Texts aren't coming through: ${texting.error}. The form still works.` : "Collecting texts from the forwarding mailbox as well as the form."}
                </p>
              ) : null}
            </div>

            {state ? <DrinkListCard saved={state.drinks} live={state.menu} qr={state.pageLive} busy={busy} save={saveDrinks} mark={markDrink} /> : null}
          </section>

          <section aria-label="Question submissions" className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            {state ? (
              <LineupPanel
                lineup={state.lineup}
                clock={setClock}
                waiting={held ? waiting.filter((item) => item.id !== held) : waiting}
                busy={busy}
                dragging={dragging}
                setDragging={setDragging}
                save={saveLineup}
                start={startSet}
                stop={stopSet}
                edit={editLineup}
                editQuestion={editQuestion}
              />
            ) : null}

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base">Questions{state ? ` (${waiting.length})` : ""}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-400">
                  <input type="checkbox" className="h-4 w-4 accent-white" checked={ping} onChange={(event) => writePing(event.target.checked)} />
                  Ping when one arrives
                </label>
                <button type="button" onClick={() => void refresh()} disabled={busy} className="px-3 py-2 text-sm underline disabled:opacity-40">Refresh</button>
              </div>
            </div>
            <QuestionSearch value={search} onChange={setSearch} total={waiting.length} matching={listed.length} />
            {fresh.size ? (
              <div role="status" className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/50 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-200">
                <span>{fresh.size === 1 ? "1 new question" : `${fresh.size} new questions`} since you last looked</span>
                <button type="button" onClick={() => setFresh(new Set())} className="underline">Got it</button>
              </div>
            ) : null}
            {/* A greyed-out button's title only shows to a mouse, so a phone gets the reason in words too. */}
            {state && waiting.length > 0 && state.lineup.performers.length > 0 && !openSlot ? <p className="mb-3 text-xs text-neutral-500">“+ Set” is greyed out: no open slot. {NO_OPEN_SLOT}</p> : null}
            {!state ? <p role="status" className="text-neutral-400">Loading questions…</p> : waiting.length === 0 ? <p className="text-neutral-400">No questions waiting. New submissions appear here by themselves.</p> : (
              <ul className="space-y-3">
                {listed.map((item) => {
                  const isNew = fresh.has(item.id);
                  return (
                    <li
                      key={item.id}
                      draggable={!busy && item.id !== held}
                      onDragStart={(event) => { event.dataTransfer.setData("text/plain", item.decision); setDragging({ from: "pile", id: item.id }); }}
                      onDragEnd={() => setDragging(null)}
                      className={`cursor-grab rounded-lg border p-4 transition-colors ${isNew ? "border-emerald-400/70 bg-emerald-950/30" : "border-white/15"}`}
                    >
                      {isNew ? <span className="mb-2 inline-block rounded-full bg-emerald-400 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-black">New</span> : null}
                      <p className="whitespace-pre-wrap break-words text-lg leading-relaxed">{item.decision}</p>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm text-neutral-400">{item.name || "Anonymous"}{item.createdAt ? ` · ${timeOf(item.createdAt)}` : ""}</span>
                        <span className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => setEditing({ at: "pile", id: item.id })} disabled={busy || item.id === held} className="rounded-md px-3 py-2.5 text-sm text-neutral-400 hover:text-white disabled:opacity-50">Edit</button>
                          <button type="button" onClick={() => void remove(item)} disabled={busy} className="rounded-md px-3 py-2.5 text-sm text-neutral-400 hover:text-white disabled:opacity-50">Delete</button>
                          <button type="button" onClick={() => addToSet(item)} disabled={busy || !state || item.id === held || !openSlot} title={item.id === held ? "Save or cancel the edit first" : !openSlot ? `No open slot. ${NO_OPEN_SLOT}` : "Into the next empty slot: the set on stage first, then the next performer"} className="rounded-md border border-[#ff2e4d]/70 px-3 py-2.5 text-sm text-[#ff8a9c] disabled:opacity-40">+ Set</button>
                          <button type="button" disabled={busy || running || item.id === held} title={item.id === held ? "Save or cancel the edit first" : running ? SET_OWNS_SCREEN : undefined} onClick={() => void select(item.id)} className="shrink-0 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50">Show on screen</button>
                        </span>
                      </div>
                      {item.id === held ? <QuestionEditor question={item} busy={busy} save={(edit) => editQuestion(item.id, edit)} close={() => setEditing(null)} /> : null}
                    </li>
                  );
                })}
              </ul>
            )}

            <details className="mt-6 rounded-lg border border-white/20 p-4">
              <summary className="cursor-pointer text-sm">➕ Preload questions</summary>
              <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); void preload(); }}>
                <p className="text-sm text-neutral-400">Add your own questions to the pile, alongside the ones that come in from the QR code. One per line. They work the same: show them, draw them, delete them.</p>
                <label htmlFor="preload-text" className="sr-only">Questions, one per line</label>
                <textarea
                  id="preload-text"
                  value={preloadText}
                  onChange={(event) => setPreloadText(event.target.value)}
                  rows={5}
                  placeholder={"Should I text my ex back?\nShould I quit my job to sell hot sauce?"}
                  disabled={!state}
                  className="w-full rounded-md border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-500"
                />
                <div className="flex flex-wrap gap-2">
                  <label htmlFor="preload-name" className="sr-only">Name on screen (optional)</label>
                  <input
                    id="preload-name"
                    type="text"
                    value={preloadName}
                    onChange={(event) => setPreloadName(event.target.value)}
                    maxLength={NAME_MAX}
                    placeholder="Name on screen (optional)"
                    disabled={!state}
                    className="min-w-0 flex-1 basis-48 rounded-md border border-white/30 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-500"
                  />
                  <button type="submit" disabled={busy || !state || !preloadText.trim()} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">Add to pile</button>
                </div>
                <p className="text-xs text-neutral-500">Up to {PRELOAD_MAX} at a time. Leave the name blank to show them as anonymous.</p>
              </form>
            </details>

            <details className="mt-4 rounded-lg border border-white/20 p-4">
              <summary className="cursor-pointer text-sm">Already shown tonight{state ? ` (${state.shown.length})` : ""}</summary>
              {state?.shown.length ? (
                <div role="list" className="mt-3 space-y-2">
                  {state.shown.map((item) => isEditing("shown", item.id) ? (
                    <div role="listitem" key={item.id}><QuestionEditor question={item} live={item.id === onScreenId} busy={busy} save={(edit) => editQuestion(item.id, edit)} close={() => setEditing(null)} /></div>
                  ) : (
                    <div role="listitem" key={item.id} className={`flex flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-md border px-3 py-2 ${item.id === onScreenId ? "border-white bg-white/10" : "border-white/10"}`}>
                      <span className="min-w-0">
                        <span className="block whitespace-pre-wrap break-words text-sm">{item.decision}</span>
                        <span className="block text-xs text-neutral-500">{item.name || "Anonymous"}{item.id === onScreenId ? " · on screen now" : ""}</span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <button type="button" onClick={() => setEditing({ at: "shown", id: item.id })} disabled={busy} className="px-2 py-1.5 text-xs text-neutral-400 hover:text-white disabled:opacity-50">Edit</button>
                        {item.id === onScreenId ? null : (
                          <button type="button" onClick={() => void putBack(item.id)} disabled={busy} className="rounded-md border border-white/20 px-3 py-1.5 text-xs disabled:opacity-50">Put it back</button>
                        )}
                        <button type="button" onClick={() => void remove(item)} disabled={busy} className="px-2 py-1.5 text-xs text-neutral-400 hover:text-white disabled:opacity-50">Delete</button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-neutral-500">Nothing has been on screen yet.</p>}
            </details>

            <details className="mt-4 rounded-lg border border-white/20 p-4">
              <summary className="cursor-pointer text-sm">End of the night</summary>
              <p className="mt-3 text-sm text-neutral-400">Archive everything so next week starts at zero. Archived questions stay here until you delete them.</p>
              <button type="button" onClick={() => void archive()} disabled={busy || !state || (!waiting.length && !state.shown.length)} className="mt-3 rounded-md border border-red-500/60 bg-red-950/40 px-4 py-2 text-sm text-red-200 disabled:opacity-40">🧹 Archive everything from tonight</button>
              {state?.archived.length ? (
                <div role="list" className="mt-4 space-y-1">
                  <p className="text-xs uppercase tracking-widest text-neutral-500">Archived ({state.archived.length})</p>
                  {state.archived.map((item) => (
                    <div role="listitem" key={item.id} className="flex items-start justify-between gap-3 text-sm text-neutral-400">
                      <span className="whitespace-pre-wrap break-words">{item.decision}{item.name ? <span className="text-neutral-600"> — {item.name}</span> : null}</span>
                      <span className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => void restore(item.id)} disabled={busy} title="Back to the waiting list" className="shrink-0 px-2 py-1 text-xs hover:text-white disabled:opacity-50">Restore</button>
                      <button type="button" onClick={() => void remove(item)} disabled={busy} className="shrink-0 px-2 py-1 text-xs hover:text-white disabled:opacity-50">Delete</button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </details>
          </section>

          <section aria-labelledby="setup-heading" className="min-w-0 lg:col-start-1 lg:row-start-2">
            <h2 id="setup-heading" className="text-xs uppercase tracking-widest text-neutral-400">Setup</h2>
            <p className="mt-1 text-sm text-neutral-500">Best done before the show. Each card stays folded until you open it.</p>
            {state ? (
              <MarqueeCard
                text={state.marquee}
                on={state.marqueeOn}
                speed={state.marqueeSpeed}
                color={state.marqueeColor}
                live={state.menu}
                busy={busy}
                save={saveMarquee}
              />
            ) : null}

            {state ? (
              <CustomMenuCard
                color={state.menuColor}
                headline={state.menuHeadline}
                note={state.menuNote}
                noteColor={state.menuNoteColor}
                font={state.menuFont}
                bartender={state.menuBartender}
                bartenderFont={state.menuBartenderFont}
                bartenderColor={state.menuBartenderColor}
                marquee={state.marquee}
                live={state.menu && state.menuStyle === "custom"}
                qr={state.pageLive}
                busy={busy}
                save={saveCustomMenu}
                qrCaption={state.menuQrCaption}
                qrTitle={state.menuQrTitle}
                qrLink={state.menuQrLink}
                bartenderLabel={state.menuBartenderLabel}
                marqueeStyle={{ on: state.marqueeOn, speed: state.marqueeSpeed, color: state.marqueeColor }}
                drinks={state.drinks}
              />
            ) : null}

            {state ? (
              <ScreenSettingsCard
                saved={screenSettings}
                busy={busy}
                save={(screen) => screenAction({ screen }, "Live screen settings saved. The projector picks them up within a couple of seconds.", "Could not save the live screen settings.")}
              />
            ) : null}

            <details className="mt-4 rounded-lg border border-white/20 p-4">
              <summary className="cursor-pointer text-sm">🔊 Sound on the live screen</summary>
              <div className="mt-3 space-y-3 text-sm text-neutral-300">
                <p>Browsers block sound until someone taps the page, unless you allow it for this site. When sound is off, the live screen shows a red <strong>“Sound is off. Tap to turn it on”</strong> button in the corner. No button means sound is on.</p>
                <p className="font-semibold text-white">Every show (works on any browser)</p>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Open the live screen on the TV laptop.</li>
                  <li>Click anywhere on it once, or press <kbd className="rounded border border-white/30 px-1">F</kbd> to go full screen. Either one turns sound on.</li>
                  <li>Press <strong>🔊 Test sound</strong> here to hear it.</li>
                </ol>
                <p className="font-semibold text-white">Set it once so sound starts by itself</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li><strong>Microsoft Edge:</strong> on the live screen, click the lock icon in the address bar → Permissions for this site → Media autoplay → Allow. Reload.</li>
                  <li><strong>Firefox:</strong> click the permissions icon in the address bar → Autoplay → Allow Audio and Video. Reload.</li>
                  <li><strong>Safari (Mac):</strong> Safari menu → Settings for pinsandneedlescomedy.com → Auto-Play → Allow All Auto-Play. Reload.</li>
                  <li><strong>Chrome:</strong> Chrome has no autoplay setting. Quit Chrome fully, then start it with autoplay allowed. Mac: run <code className="rounded bg-white/10 px-1">open -a &quot;Google Chrome&quot; --args --autoplay-policy=no-user-gesture-required</code> in Terminal. Windows: add <code className="rounded bg-white/10 px-1">--autoplay-policy=no-user-gesture-required</code> to the end of the Chrome shortcut’s Target. Or use the every-show click above.</li>
                  <li><strong>iPad or iPhone:</strong> there is no setting. Tap the screen once before the show, and keep the screen from locking.</li>
                </ul>
                <p>If the red button is still there after reloading, the setting didn’t take: just click the screen once.</p>
              </div>
            </details>

            <details className="mt-4 rounded-lg border border-white/20 p-4">
              <summary className="cursor-pointer text-sm">📱 QR code for the tables</summary>
              <QrCode />
            </details>
          </section>
        </div>
      </div>
    </main>
  );
}

/** The table QR's image; the server sends it uncached, so the browser never shows an old code. */
const QR_SRC = "/api/admin/decisions/qr";

/**
 * The QR code for the flyer and the table tent. It always opens the one fixed
 * Bad Decisions address, and its address here is fixed too, so the page drawn
 * on the server and in the browser agree.
 */
function QrCode() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={QR_SRC} alt="QR code linking to /bad-decisions" width={128} height={128} className="h-32 w-32 shrink-0 rounded-lg bg-white p-2" />
      <div className="min-w-[200px] flex-1 text-sm leading-relaxed text-neutral-300">
        <p>People scan this to send a question in. It shows a countdown until the form opens, then the question. Print this exact code; older codes pointing to the plain page no longer work.</p>
        <a href={QR_SRC} target="_blank" rel="noreferrer" className="mt-2 inline-block underline">⬇️ Open full size to save</a>
      </div>
    </div>
  );
}

/** The question an editor was opened on is still where it was opened. */
function stillThere(editing: Editing, board: Pick<State, "submissions" | "shown" | "selected">): boolean {
  if (editing.at === "pile") return board.submissions.some((item) => item.id === editing.id);
  if (editing.at === "shown") return board.shown.some((item) => item.id === editing.id);
  return board.selected?.submissionId === editing.id;
}

/**
 * Pull forwarded texts from the mailbox. This page is only open during a show,
 * which is exactly when texts need collecting, so it stands in for a scheduler.
 * A mailbox that is not set up answers instantly and says so.
 */
async function collectTexts(setTexting: (value: { on: boolean; error: string }) => void) {
  try {
    const { text } = await fetchWithin("/api/admin/decisions/ingest", { method: "POST", cache: "no-store" }, POLL_TIMEOUT_MS);
    const result = (() => { try { return JSON.parse(text); } catch { return {}; } })();
    setTexting(result?.configured ? { on: true, error: result.ok ? "" : String(result.error || "Mailbox unreachable") } : { on: false, error: "" });
  } catch {
    // A failed pull must never stop the pile from loading.
    setTexting({ on: true, error: "Mailbox unreachable" });
  }
}

/** What to tell the host when a request fails: the server's own words, or a plain line for a timeout or a garbled answer. */
/** The request was given up on (or the page is leaving), not refused. */
function gaveUp(failure: unknown): boolean {
  return failure instanceof Error && (failure.name === "AbortError" || failure.name === "TimeoutError");
}

function plainError(failure: unknown, fallback: string): string {
  if (!(failure instanceof Error) || failure.name === "AbortError" || failure.name === "TimeoutError" || failure instanceof SyntaxError) return fallback;
  return failure.message;
}

function timeOf(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** A short, quiet tone. Nothing to load: the browser makes it. */
function playPing() {
  try {
    const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const context = new Context();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.4);
    oscillator.onended = () => void context.close().catch(() => {});
  } catch {
    // Audio blocked or unsupported: the "New" pill still shows.
  }
}

/**
 * The ping switch lives in this browser, not in the content: it is the
 * preference of whoever is holding this device. Read through
 * useSyncExternalStore so the server render (off) and the first client
 * render agree.
 */
function subscribePing(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(PING_KEY, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(PING_KEY, callback);
  };
}

function readPing(): boolean {
  try { return window.localStorage.getItem(PING_KEY) === "1"; } catch { return false; }
}

function writePing(value: boolean) {
  try { window.localStorage.setItem(PING_KEY, value ? "1" : "0"); } catch {
    // Private mode or blocked storage: the switch still works for this page load.
  }
  window.dispatchEvent(new Event(PING_KEY));
  if (value) playPing();
}
