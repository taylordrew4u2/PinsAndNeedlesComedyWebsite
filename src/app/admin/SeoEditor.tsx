"use client";

import { useState } from "react";
import { addSuggestedFaqs } from "@/lib/seo";
import type { Seo } from "@/lib/types";
import type { Suggestion } from "./suggest";
import { Area, Button, Label, More, Tags, Text, Toggle } from "./ui";
import MediaField from "./MediaField";
import { writeSeo } from "./write-client";

function Meter({ value, ideal, max }: { value: number; ideal: [number, number]; max: number }) {
  const ok = value >= ideal[0] && value <= ideal[1];
  return (
    <span className={`text-[12px] ${value === 0 ? "text-neutral-600" : ok ? "text-emerald-400" : "text-amber-400"}`}>
      {value}/{max} letters
      {value === 0 ? "" : ok ? " · good length" : value > ideal[1] ? " · a bit long, may get cut off" : " · could be longer"}
    </span>
  );
}

/**
 * Search and AI-answer settings for one page or item. Always tucked inside a
 * <More>: every field arrives prefilled, so most people never need to open it.
 */
export default function SeoEditor({
  seo,
  suggestion,
  onChange,
  title,
  hint,
  about,
}: {
  seo: Seo;
  suggestion: Suggestion;
  onChange: (next: Seo) => void;
  title?: string;
  hint?: string;
  /** Facts about the page, for the Write buttons. */
  about: Record<string, unknown>;
}) {
  const set = <K extends keyof Seo>(key: K, value: Seo[K]) => onChange({ ...seo, [key]: value });
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState("");

  const writeAll = async () => {
    setWriting(true);
    setWriteError("");
    try {
      const draft = await writeSeo(about, seo);
      onChange({
        ...seo,
        title: draft.title || seo.title,
        description: draft.description || seo.description,
        keywords: draft.keywords.length ? draft.keywords : seo.keywords,
        aiSummary: draft.aiSummary || seo.aiSummary,
        ogImage: seo.ogImage || suggestion.ogImage,
        canonical: seo.canonical || suggestion.canonical,
        faq: addSuggestedFaqs(seo.faq, draft.faq),
      });
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : "Could not write that");
    } finally {
      setWriting(false);
    }
  };

  const applyAll = () =>
    onChange({
      ...seo,
      title: suggestion.title,
      description: suggestion.description,
      keywords: suggestion.keywords,
      aiSummary: suggestion.aiSummary,
      ogImage: suggestion.ogImage,
      canonical: suggestion.canonical,
      faq: suggestion.faq.length ? suggestion.faq : seo.faq,
    });

  return (
    <More
      title={title ?? "Search & AI settings (Google, ChatGPT)"}
      hint={hint ?? "Already filled in for you. Only change these if you want to."}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button tone="primary" onClick={() => void writeAll()} disabled={writing}>
          {writing ? "Writing…" : "✦ Write all of this for me"}
        </Button>
        <Button onClick={applyAll}>Reset to the built-in suggestions</Button>
      </div>
      <p className="-mt-2 text-[13px] text-neutral-500">
        {writeError || "Writes the title, description, keywords, summary and questions below, tuned for search and AI answers."}
      </p>

      <div>
        <Text
          label="Title in search results"
          value={seo.title}
          onChange={(value) => set("title", value)}
          ai={{ what: "meta title", about }}
        />
        <div className="mt-1 flex items-center justify-between gap-3">
          <Meter value={seo.title.length} ideal={[30, 60]} max={60} />
          <Button tone="ghost" onClick={() => set("title", suggestion.title)}>
            Use suggestion
          </Button>
        </div>
      </div>

      <div>
        <Area
          label="Description in search results"
          rows={3}
          value={seo.description}
          onChange={(value) => set("description", value)}
          ai={{ what: "meta description", about }}
        />
        <div className="mt-1 flex items-center justify-between gap-3">
          <Meter value={seo.description.length} ideal={[120, 158]} max={158} />
          <Button tone="ghost" onClick={() => set("description", suggestion.description)}>
            Use suggestion
          </Button>
        </div>
      </div>

      <div>
        <Tags
          label="Keywords"
          hint="Words people might search for. Separate with commas."
          value={seo.keywords}
          onChange={(value) => set("keywords", value)}
          ai={{ what: "keywords", about }}
        />
        <div className="mt-1 flex justify-end">
          <Button tone="ghost" onClick={() => set("keywords", suggestion.keywords)}>
            Use suggestion
          </Button>
        </div>
      </div>

      <div>
        <Area
          label="Summary for AI assistants"
          hint="What ChatGPT, Claude, Perplexity and Google's AI read about this page"
          rows={4}
          value={seo.aiSummary}
          onChange={(value) => set("aiSummary", value)}
          ai={{ what: "AI summary", about }}
        />
        <div className="mt-1 flex items-center justify-between gap-3">
          <Meter value={seo.aiSummary.length} ideal={[150, 480]} max={480} />
          <Button tone="ghost" onClick={() => set("aiSummary", suggestion.aiSummary)}>
            Use suggestion
          </Button>
        </div>
      </div>

      <MediaField
        label="Picture when shared (Instagram, texts, Facebook)"
        hint="1200×630 works best"
        value={seo.ogImage}
        onChange={(value) => set("ogImage", value)}
        aspect={1200 / 630}
        previewHeight={80}
      />

      <div>
        <Text
          label="Canonical URL"
          hint="The one true address of this page. Leave it unless you know why."
          value={seo.canonical}
          onChange={(value) => set("canonical", value)}
          placeholder={suggestion.canonical}
        />
        <div className="mt-1 flex justify-end">
          <Button tone="ghost" onClick={() => set("canonical", suggestion.canonical)}>
            Use suggestion
          </Button>
        </div>
      </div>

      <div>
        <Label hint="Questions and answers about this page. Google and AI assistants can show these directly.">
          Questions people ask
        </Label>
        <div className="grid gap-3">
          {seo.faq.map((entry, index) => (
            <div key={index} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
              <input
                className="mb-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-[15px] text-neutral-50 outline-none focus:border-white"
                placeholder="Question"
                value={entry.q}
                onChange={(event) => {
                  const faq = [...seo.faq];
                  faq[index] = { ...entry, q: event.target.value };
                  set("faq", faq);
                }}
              />
              <textarea
                className="w-full resize-y rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-[15px] text-neutral-50 outline-none focus:border-white"
                placeholder="Answer"
                rows={2}
                value={entry.a}
                onChange={(event) => {
                  const faq = [...seo.faq];
                  faq[index] = { ...entry, a: event.target.value };
                  set("faq", faq);
                }}
              />
              <div className="mt-2 flex justify-end">
                <Button
                  tone="danger"
                  onClick={() => set("faq", seo.faq.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => set("faq", [...seo.faq, { q: "", a: "" }])}>Add a question</Button>
          {suggestion.faq.length ? (
            <Button tone="ghost" onClick={() => set("faq", addSuggestedFaqs(seo.faq, suggestion.faq))}>
              Add suggested questions
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-[13px] text-neutral-500">
          Suggested questions are added alongside yours — nothing you wrote gets replaced.
        </p>
      </div>

      <Toggle
        label="Hide this page from Google"
        hint="Leave off. Only for a page you are not ready to show anyone."
        value={seo.noindex}
        onChange={(value) => set("noindex", value)}
      />

      <div className="rounded-lg border border-neutral-800 bg-black p-4">
        <p className="mb-2 text-[12px] font-medium text-neutral-500">How it looks on Google</p>
        <p className="truncate text-[15px] text-[#8ab4f8]">{seo.title || suggestion.title}</p>
        <p className="truncate text-[13px] text-emerald-500">{seo.canonical || suggestion.canonical}</p>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-neutral-400">
          {seo.description || suggestion.description}
        </p>
      </div>
    </More>
  );
}
