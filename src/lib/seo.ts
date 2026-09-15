import type { Seo } from "./types";

export function emptySeo(): Seo {
  return {
    title: "",
    description: "",
    keywords: [],
    ogImage: "",
    canonical: "",
    aiSummary: "",
    faq: [],
    noindex: false,
  };
}

export function seo(partial: Partial<Seo>): Seo {
  return { ...emptySeo(), ...partial };
}

/** Trim a string to a length that search engines actually render. */
export function clamp(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export function stripMarkdown(body: string): string {
  return body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set(
  ("a an and are as at be but by for from has have how in is it its of on or that the this to was were what when where which who will with you your not now new").split(" ")
);

/** Pull the most repeated meaningful words out of a body of text. */
export function suggestKeywords(source: string, extra: string[] = [], max = 10): string[] {
  const counts = new Map<string, number>();
  for (const raw of stripMarkdown(source).toLowerCase().split(/[^a-z0-9&'-]+/)) {
    const word = raw.replace(/^[-']+|[-']+$/g, "");
    if (word.length < 4 || STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([word]) => word);
  const merged: string[] = [];
  for (const candidate of [...extra, ...ranked]) {
    const value = candidate.trim();
    if (value && !merged.some((m) => m.toLowerCase() === value.toLowerCase())) merged.push(value);
    if (merged.length >= max) break;
  }
  return merged;
}

export function slugify(value: string, max = 80): string {
  const slug = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\u2018\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= max) return slug;
  // Cut on a word boundary so a slug never ends mid-word or on a stray dash.
  const cut = slug.slice(0, max);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > max * 0.5 ? cut.slice(0, lastDash) : cut).replace(/-+$/, "");
}

/** The site URL without its trailing slash, so `${siteBase(url)}/shows` never doubles up. */
export function siteBase(url: string): string {
  return (url || "").replace(/\/+$/, "");
}

export function absoluteUrl(base: string, path: string): string {
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteBase(base)}/${path.replace(/^\/+/, "")}`;
}

/** SEO lengths are targets: preserve a complete sentence instead of cutting prose mid-thought. */
export function sentenceSummary(text: string, target: number): string {
  const clean = stripMarkdown(text).replace(/\s+([,.!?;:])/g, "$1").trim();
  if (!clean) return "";
  const sentences = [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(clean)]
    .map(({ segment }) => segment.trim()).filter(Boolean);
  let result = sentences[0] || clean;
  for (const sentence of sentences.slice(1)) {
    if (result.length + sentence.length + 1 > target) break;
    result += ` ${sentence}`;
  }
  return /[.!?][”"')]*$/.test(result) ? result : `${result.replace(/[,;:–—-]+$/, "").trim()}.`;
}

/** Keep free admission grammatical and avoid "Tickets are Free entry". */
export function admissionSentence(price: string): string {
  const clean = price.trim().replace(/[.!]+$/, "");
  if (!clean) return "";
  if (/^free(?:\s+(?:entry|admission))?$/i.test(clean)) return "Admission is free.";
  return `Admission: ${clean}.`;
}

/** Add generated FAQs once, preserving answers the editor has already written. */
export function addSuggestedFaqs(current: Seo["faq"], suggested: Seo["faq"]): Seo["faq"] {
  const normalize = (question: string) => question.trim().toLowerCase().replace(/[?!.]+$/, "").replace(/\s+/g, " ");
  const result = current.map((entry) => ({ ...entry }));
  const seen = new Set(current.map((entry) => normalize(entry.q)));
  for (const entry of suggested) {
    const key = normalize(entry.q);
    if (key && entry.a.trim() && !seen.has(key)) {
      result.push({ ...entry });
      seen.add(key);
    }
  }
  return result;
}
