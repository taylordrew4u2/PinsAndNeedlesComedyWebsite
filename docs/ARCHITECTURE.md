# Architecture

The site for [Pins & Needles Comedy](https://pinsandneedlescomedy.com) — a live
stand-up show in Ridgewood, Queens — plus the admin its producers use to run it.
Next.js 16 (App Router), React 19, TypeScript, Tailwind 4. No database.

The interesting parts are not the pages. They are the constraints: the people
editing this site are comedians on a phone, the audience hits it forty at a time
during one bar hour, and the whole thing has to cost nothing to run.

---

## Content lives in one JSON document

Every editable thing on the site — copy, shows, posts, reels, SEO fields — is one
`Content` object, stored as a single JSON document and edited through `/admin`.

`getContent()` merges the stored document **over** compiled-in defaults
(`src/lib/defaults.ts`) on every read. That one decision buys a lot:

- **A new field needs no migration.** Add it to the defaults and every existing
  document has it on the next read.
- **A fresh deployment is already a finished site.** The defaults are real copy,
  not placeholders, so the site is never half-built in public.
- **A storage outage degrades to the defaults** rather than to an error page —
  and `getContentStrict()` exists precisely so that code about to *write* a full
  snapshot refuses to start from that fallback and overwrite real content.

Its cost is worth naming: stored values win, so changing a default does nothing
for a site that has already been saved. That bit us once, when the shipped
artwork moved to SVG and every saved path still pointed at a deleted PNG.
`healAssetPaths()` in `src/lib/assets.ts` rewrites those paths on read, so an
existing document repairs itself instead of needing every image re-picked by
hand.

## Three storage drivers, chosen by which secrets exist

`src/lib/store.ts` writes that document to one of three places, picked from the
environment rather than from a config flag:

| Driver | Where | For |
| --- | --- | --- |
| `fs` | `./data/content.json` | local, a Codespace, any VPS |
| `github` | a private repo via the Contents API | free hosting with no card, and every save is a commit you can read back |
| `blob` | Vercel Blob | when the project already has a Blob store |

Vercel's filesystem is read-only, so `fs` is not an option in production — hence
GitHub as a first-class store rather than a curiosity. Writes there are
sha-guarded, so a concurrent save conflicts loudly instead of silently losing an
edit.

## The admin saves itself

There is no Save button. `AdminApp` debounces edits and `PATCH`es a partial
document; the store deep-merges it. A failed save retries rather than dropping
an edit, and the error surfaces the store's own words instead of a generic
"Save failed" — whoever sees it is already logged in, and the alternative is
sending them hunting through deployment logs they may not be able to reach.

## The admin shows the few things first

Every tab follows one rule: the handful of fields someone touches every week
sit in the open, and everything else waits behind a "More options" panel. A
show is a name, a date, a venue, a ticket link and an on/off switch; its
address, price, photos, slug and search settings are all still there, one tap
down. Nothing was removed to get there — the tabs were reorganised, not cut.

The first screen after login is not a form. It is the jobs people come to do
("Add a show", "Run tonight's show", "Write a news post"), what is coming up,
and a short list of things that look half-finished — a draft with a date next
week, a live show with no ticket link. Each one opens the exact card to fix.

Two things make that safe for someone who is not a developer. Every delete
asks first, because autosave would make it final within a second. And the
"Show everything" switch lives in the browser's own storage rather than in the
content, so one producer flipping it never rearranges the other's phone.

## Bad Decisions: the part with real load

The weekly show takes written submissions from the room. A QR code points at
`/bad-decisions`; at the end of the night the host draws a few at random and the
comedians talk the sender into or out of it. Two problems fall out of that, and
they pull in opposite directions.

**Writes collide.** Forty people scan the same code within the same minute. A
shared JSON array — even with retry-on-conflict — loses some of them. So each
submission is its own file (`submissions/<id>.json`) with nothing to conflict
over, on every driver.

**Reads amplify.** The page shows a live count, polled by every open phone. The
first version answered it by reading all of those files — on the GitHub driver,
forty phones would have exhausted the hourly API limit inside the first minute
of a show. Submission ids begin with a fixed-width UTC timestamp, so the count
is now a directory listing plus a string compare: one call regardless of pile
size, with a short cache in front of it.

A counter file would have made the read O(1) too, and was rejected: it puts every
submission back into read-modify-write contention on one object, which is the
exact collision the file-per-submission layout exists to avoid.

**The form is only open around the show**, from an hour before the start time to
four hours after, so a submission belongs to somebody actually in the room. The
window is enforced in the route, not just the form — `/api/decisions` is what the
QR code points at, and anyone can hold that URL. Times are New York wall-clock:
`nyInstant()` reads the zone's real offset for the date in question, so 9 PM in
September and 9 PM in January are correctly an hour apart in UTC and the DST
changeover needs no maintenance.

The draw is server-side and atomic, so two phones backstage cannot pull the same
submission.

## The admin fails closed

`src/lib/session.ts` holds the credential policy and imports nothing from
Next.js, so it is testable directly rather than only through a running server.
`auth.ts` is the thin layer that binds it to the request.

In production there is no fallback: without `ADMIN_PASSWORD` and `ADMIN_SECRET`,
every login is refused and every cookie stops verifying. The signing secret is
independent of the password, so knowing one does not let anyone forge the other.
Off production both have working defaults, so a fresh checkout runs with no
setup.

## Images are vector, and the social card is generated

Everything in `public/` is an SVG. The brand marks were traced from the original
line art, which is what tracing is for: `public/brand` went from 2.6MB of PNG to
320KB, resolution-independent.

`public/posts` is photographs and printed flyers rather than line art, and a
single tracing recipe does not serve both. One pass — potrace's usual
advice — median-filters the source to kill paper grain and photo noise, picks
a small palette, and traces each colour as its own layer. Run on a photo of
skin and fabric, or a flyer with fine print, that reproduces the picture. Run
on real black-ink line art, the same median filter erodes the strokes it was
meant to protect, and where two close paper-texture shades get split into
separate colours, the boundary between them — jagged at the pixel level over
what should read as one flat area — traces as thousands of disconnected
paths. One flyer showed exactly this on the home page: a clean cream-and-red
poster came out as a tile of pure static — 1.3MB for what should be a few
tens of kilobytes of flat colour.

So which recipe runs is decided per image rather than fixed: sample the
source at low resolution, and if fewer than 5% of pixels carry any real
saturation, it is ink on paper — trace it as a plain two-colour threshold at
full resolution, no denoising, because there is no grain to protect against
and the whole point is the strokes. Otherwise denoise first and trace an
eight-colour palette, because that is a photograph or a flat-colour graphic,
and the noise is real. Checked against the outlier along with the rest of the
batch: 29 images, 27MB of bloated or broken traces down to 5.7MB of
smaller **and** cleaner ones.

That breaks link previews, because no social platform renders an SVG. Rather
than put a raster file back in the repository, `/api/og` draws a 1200×630 PNG at
request time from the site's own content. It takes a **path**, never free text —
free text would let anyone render arbitrary words in the brand's colours on the
brand's domain, which is a forgery with nothing to author but a URL.

## SEO, including for machines

Every page carries hand-editable metadata plus generated JSON-LD
(`src/lib/schema.ts`): `Event` and `EventSeries` for shows, `Article` for posts,
`BreadcrumbList`, `FAQPage`. There is an `/llms.txt` route and an RSS feed.
Indexing is gated on serving from the canonical host, so preview deployments
cannot outrank the real site.

## Testing

194 tests on the Node test runner with `--experimental-strip-types`. No test
framework, no transpile step, no watch process.

That is possible because the logic worth testing lives in plain modules — dates,
sanitising, merging, schema shapes, session policy — rather than inside
components. The tests cover the things that would be expensive to get wrong: the
DST-aware clock, the submission window rolling to next week, control characters
in user input, the merge semantics that let arrays delete, and the admin failing
closed.

CI runs lint, typecheck, tests and a production build on every pull request.

---

## Layout

```
src/app/           routes: public pages, /admin, /api
src/components/    presentational pieces shared across pages
src/lib/           the parts worth testing
  defaults.ts      the site as shipped
  store.ts         load/save, driver selection, caching
  session.ts       credential policy (no framework imports)
  decisions.ts     submission window, sanitising, the draw
  submissions.ts   per-submission storage across all three drivers
  schema.ts        JSON-LD
  assets.ts        asset-path healing, social-image selection
tests/             plain Node tests
docs/              this file, and DEPLOYMENT.md
```

## Running it

```bash
npm install
npm run dev          # http://localhost:3000, /admin password "dev"
npm run lint
npm run typecheck
npm test
npm run build
```

Copy `.env.example` to `.env.local` to point it at real storage. See
[DEPLOYMENT.md](./DEPLOYMENT.md).
