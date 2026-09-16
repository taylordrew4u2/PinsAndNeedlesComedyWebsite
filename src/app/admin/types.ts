import type { Content } from "@/lib/types";

/** Mutate a structured clone of the content; the app re-renders and auto-saves. */
export type Update = (mutate: (draft: Content) => void) => void;

export type { Go, TabId } from "./tabs";
