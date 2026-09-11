"use client";

import { addSuggestedFaqs } from "@/lib/seo";
import type { Seo } from "@/lib/types";
import type { Suggestion } from "./suggest";
import { Area, Button, Label, Tags, Text, Toggle } from "./ui";
import MediaField from "./MediaField";

function Meter({ value, ideal, max }: { value: number; ideal: [number, number]; max: number }) {
  const ok = value >= ideal[0] && value <= ideal[1];
  return (
    <span className={`text-[11px] ${value === 0 ? "text-neutral-600" : ok ? "text-emerald-400" : "text-amber-400"}`}>
      {value}/{max} chars
      {value === 0 ? "" : ok ? " · good length" : value > ideal[1] ? " · may be truncated" : " · could be longer"}
    </span>
  );
}

export default function SeoEditor({
  seo,
  suggestion,
  onChange,
  title,
  hint,
}: {
  seo: Seo;
  suggestion: Suggestion;
  onChange: (next: Seo) => void;
  title?: string;
  hint?: string;
}) {
  const set = <K extends keyof Seo>(key: K, value: Seo[K]) => onChange({ ...seo, [key]: value });

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
    <details className="mb-8 rounded-lg border border-neutral-800">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-neutral-200">{title ?? "SEO & AI SEO"}</summary>
      <div className="grid gap-4 border-t border-neutral-800 p-4">
        <p className="text-xs text-neutral-500">{hint ?? "Edit search titles, descriptions and FAQs here. Changes save automatically."}</p>
      <div className="flex flex-wrap gap-2">
        <Button tone="primary" onClick={applyAll}>
          Regenerate all suggestions
        </Button>
      </div>

      <div>
        <Text label="Meta title" value={seo.title} onChange={(value) => set("title", value)} />
        <div className="mt-1 flex items-center justify-between gap-3">
          <Meter value={seo.title.length} ideal={[30, 60]} max={60} />
          <Button tone="ghost" onClick={() => set("title", suggestion.title)}>
            Use suggestion
          </Button>
        </div>
      </div>

      <div>
        <Area
          label="Meta description"
          rows={3}
          value={seo.description}
          onChange={(value) => set("description", value)}
        />
        <div className="mt-1 flex items-center justify-between gap-3">
          <Meter value={seo.description.length} ideal={[120, 158]} max={158} />
          <Button tone="ghost" onClick={() => set("description", suggestion.description)}>
            Use suggestion
          </Button>
        </div>
      </div>

      <div>
        <Tags label="Keywords" value={seo.keywords} onChange={(value) => set("keywords", value)} />
        <div className="mt-1 flex justify-end">
          <Button tone="ghost" onClick={() => set("keywords", suggestion.keywords)}>
            Use suggestion
          </Button>
        </div>
      </div>

      <div>
        <Area
          label="AI summary"
          hint="read by ChatGPT, Claude, Perplexity & Google AI Overviews"
          rows={4}
          value={seo.aiSummary}
          onChange={(value) => set("aiSummary", value)}
        />
        <div className="mt-1 flex items-center justify-between gap-3">
          <Meter value={seo.aiSummary.length} ideal={[150, 480]} max={480} />
          <Button tone="ghost" onClick={() => set("aiSummary", suggestion.aiSummary)}>
            Use suggestion
          </Button>
        </div>
      </div>

      <MediaField
        label="Share image (Open Graph)"
        hint="1200×630 works best"
        value={seo.ogImage}
        onChange={(value) => set("ogImage", value)}
        aspect={1200 / 630}
        previewHeight={80}
      />

      <div>
        <Text
          label="Canonical URL"
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
        <Label hint="Generate questions and answers for this page, then edit them as needed.">
          FAQ
        </Label>
        <p className="mb-3 text-xs text-neutral-500">Generated FAQs are added without replacing your existing answers or duplicating questions.</p>
        <div className="grid gap-3">
          {seo.faq.map((entry, index) => (
            <div key={index} className="rounded-md border border-neutral-800 bg-neutral-900 p-3">
              <input
                className="mb-2 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-[13px] text-neutral-100 outline-none focus:border-neutral-400"
                placeholder="Question"
                value={entry.q}
                onChange={(event) => {
                  const faq = [...seo.faq];
                  faq[index] = { ...entry, q: event.target.value };
                  set("faq", faq);
                }}
              />
              <textarea
                className="w-full resize-y rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-[13px] text-neutral-100 outline-none focus:border-neutral-400"
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
          <Button onClick={() => set("faq", [...seo.faq, { q: "", a: "" }])}>Add question</Button>
          {suggestion.faq.length ? (
            <Button tone="ghost" onClick={() => set("faq", addSuggestedFaqs(seo.faq, suggestion.faq))}>
              Generate FAQs
            </Button>
          ) : null}
        </div>
      </div>

      <Toggle
        label="Hide from search engines"
        hint="Adds noindex. Leave off unless you are staging this page."
        value={seo.noindex}
        onChange={(value) => set("noindex", value)}
      />

      <div className="rounded-md border border-neutral-800 bg-black p-4">
        <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-neutral-600">
          Google preview
        </p>
        <p className="truncate text-[13px] text-[#8ab4f8]">
          {seo.title || suggestion.title}
        </p>
        <p className="truncate text-[12px] text-emerald-500">
          {seo.canonical || suggestion.canonical}
        </p>
        <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-neutral-400">
          {seo.description || suggestion.description}
        </p>
      </div>
      </div>
    </details>
  );
}
