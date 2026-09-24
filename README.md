# Taylor Drew

### iOS & Full-Stack Developer · New York City

I build production software for creative work that happens in real time —
native iOS apps, full-stack web products, and tools that run live comedy shows
and film shoots while they are happening.

[Email](mailto:taylordrew4u@gmail.com) ·
[The Bit Binder on the App Store](https://apps.apple.com/us/app/the-bitbinder/id6756085897) ·
[Role-Call](https://rolecall.space) ·
[Bill Spilt](https://billspilt.com) ·
[Showrunner](https://icanrunashow.com)

---

## The code in this repository

[![CI](https://github.com/taylordrew4u2/taylordrew4u2/actions/workflows/ci.yml/badge.svg)](https://github.com/taylordrew4u2/taylordrew4u2/actions/workflows/ci.yml)

This repo is both my profile and a working product:
**[pinsandneedlescomedy.com](https://pinsandneedlescomedy.com)**, the site for a
live stand-up show in Ridgewood, Queens, and the admin its producers use to run
it. Next.js 16, React 19, TypeScript, Tailwind 4 — **and no database.**

<p align="center">
  <img src="docs/images/home.png" alt="The Pins &amp; Needles Comedy home page: the line-art logo, the section nav, and a strip announcing the weekly show — an accent rule, the night in red, one line of copy, and a button reading Send yours in." width="860">
</p>

It is worth a look because the constraints are real rather than illustrative:
the people editing it are comedians on a phone, the audience hits it forty at a
time during one bar hour, and it has to cost nothing to run.

### The show page, and the panel that runs the show

<table>
<tr>
<td width="50%" valign="top">
<img src="docs/images/bad-decisions.png" alt="The private Bad Decisions QR entry: a countdown until submissions open." width="100%">
<br><em>The QR entry shows only a countdown, then switches to the submission prompt during the configured opening window.</em>
</td>
<td width="50%" valign="top">
<img src="docs/images/admin.png" alt="The admin's Bad Decisions tab: a Run tonight's show button, the page-is-live switch, and the Tonight's pile panel with a live count and a Draw one button. The page's own settings wait under More options." width="100%">
<br><em>What the host has open on stage. Draw one picks at random on the server, so two phones can never pull the same submission.</em>
</td>
</tr>
</table>

### How a decision gets from the room to the stage

```mermaid
flowchart LR
  QR["QR code on the table"] --> Access{"Valid QR entry key?"}
  Access -->|yes| Form["Countdown then submission prompt"]
  SMS["Text message"] --> Voice["Google Voice"]
  Voice -->|forwards by email| Relay["Apps Script relay"]

  Form --> Public["POST /api/decisions"]
  Relay -->|POST with shared secret| Inbound["POST /api/decisions/inbound"]

  Public --> Gate{"Inside the submission window?"}
  Inbound --> Gate
  Gate -->|no| Closed["Refused, and told when it opens"]
  Gate -->|yes| Store[("One file per submission")]

  Store --> Panel["Admin, Tonight panel"]
  Panel --> Draw["Draw one at random"]
```
Every way in enforces the same window and the same sanitising, because the
server checks the submission window independently of the form. The web page
and its GET/POST submission API also require the signed QR entry key. Texting in needs no mailbox password anywhere: the site holds one
secret scoped to one endpoint, and a
[small relay script](docs/relay/gmail-apps-script.gs) posts to it.

### Run Show

- **Audience:** scan the existing signed QR to open the submission countdown/form.
- **Host:** `/admin/run-show` uses the existing admin password and shows only the
  question list, the current selection, and controls to show or clear a question.
- **Display:** `/bad-decisions/live` is a separate public URL for the projector.
  It shows the selected question and a small audience submission QR in the bottom
  corner. Clearing the question keeps the QR visible. Names, other submissions,
  and admin controls never appear on this screen.

Open **Run Show** from admin, then **Open live screen** on the display computer.
Choose **Show on screen** for any question. The live display checks for changes
about every two seconds; the admin question list refreshes every ten seconds.
Use **Clear screen** when finished. Deleting the selected submission or archiving
the pile also clears the display. No selection produces a blank screen with the QR.

**Dress rehearsal.** Before doors, tap **Start rehearsal** in Run Show. The QR
form opens for 30 minutes, never past the real opening. Send a test from your
phone with the printed QR, put it on the projector, then tap **Finish**. Anything
sent during the rehearsal is tagged TEST, and Finish deletes those and nothing
else. A rehearsal cannot start while the real window is open, and nothing sent
during the real window is ever tagged as a test.

Selection persists in `live-show/selection.json` on the configured content storage
driver (local filesystem, private GitHub content repo, or private Blob storage).
The public endpoint `/api/decisions/live` returns only the chosen question text.
The corner QR uses the same signed audience entry as the admin's downloadable QR;
its public image endpoint intentionally makes that audience entry available from
the live display, without publishing the question list.

### Printing the submission QR

Download the QR from **Admin → Bad Decisions** after deploying this version.
Older QR codes that contain only `/bad-decisions` now return 404. The new code
contains a stable entry key derived from `ADMIN_SECRET`; keep that secret stable
or reprint the QR after rotating it. Missing configuration fails closed.

The submission entry has no public menu or button, is excluded from the sitemap
and AI page list, and is marked noindex. A visitor with the QR link sees only the
countdown until the configured opening time, then the prompt and submission
controls. A shared copy of the QR link also grants access: browsers cannot prove
that a URL was opened by a camera scan.

### What is actually interesting here

- **Content is one JSON document merged over compiled-in defaults**, so a new
  field ships without a migration and a fresh deploy is already a finished site.
  Three interchangeable storage drivers — local filesystem, a private GitHub
  repo via the Contents API, or Vercel Blob — selected by which secrets exist.
- **Audience submissions are one file each.** Forty people scanning the same QR
  code in the same minute would lose writes against a shared array, so there is
  nothing to contend over.
- **Reads are driven by what a listing already tells you.** The admin polls
  every fifteen seconds for the length of a show; re-reading every file was
  measured at **14,640 GitHub API requests an hour against a 5,000 limit**, so
  the panel would have started failing mid-show. Each listing entry carries a
  content hash, so only files that actually changed are read — **240 an hour**,
  at any pile size.
- **Show times are New York wall-clock**, resolved against the zone's real
  offset for the date, so the DST changeover needs no maintenance.
- **The admin fails closed.** Credential policy lives in a module with no
  framework imports — so it is tested directly — and without both secrets set in
  production, every login is refused and every cookie stops verifying.
- **194 tests on the Node test runner.** No test framework and no transpile
  step, because the logic worth testing lives in plain modules. CI runs lint,
  typecheck, tests and a production build on every pull request.

**→ [Read the architecture notes](docs/ARCHITECTURE.md)** for the decisions and
what each one cost. [Deployment guide](docs/DEPLOYMENT.md).

---

## Other work

### [The Bit Binder](https://github.com/taylordrew4u2/The-Bit-Binder) · [App Store](https://apps.apple.com/us/app/the-bitbinder/id6756085897)

Native iOS app for stand-up comedians to capture, organize, record, transcribe
and refine material. SwiftUI, SwiftData, CloudKit, on-device transcription.

### [Showrunner](https://github.com/taylordrew4u2/Showrunner-ICanRunAShow)

Production tool used during live shows: builds lineups, imports schedules from
photos with AI, and runs a full-screen show mode with cue timers and walk-on
music. React and TypeScript.

### [Role-Call](https://github.com/taylordrew4u2/Role-Call)

End-to-end film-production planner for crew roles, cast, scripts, shot lists and
schedules. Next.js, TypeScript, Clerk, Drizzle.

### [The Trip Handler](https://github.com/taylordrew4u2/the-trip-handler)

Group-trip organizer with private invites, applications and approvals, shared
itineraries, expense tracking and Stripe payments.

### [Bill Spilt](https://github.com/taylordrew4u2/Bill-Spilt)

Full-stack tool for splitting household bills and keeping shared expenses
organized.

---

## Stack

- **iOS** — Swift, SwiftUI, SwiftData, CloudKit, on-device transcription and AI
- **Web** — Next.js, React, TypeScript, Tailwind CSS, PWAs
- **Backend** — Node.js, REST APIs, PostgreSQL, Turso, Prisma, Drizzle
- **Engineering** — authentication and session security, client-side encryption,
  offline sync, payments, testing, CI/CD, technical writing

## How I work

I try to write software that is still legible a year after launch, and to be
specific in the code about *why* something is the way it is — the storage
layout, the failure direction of an auth check, the option that was rejected and
what it would have cost. Most of the work I enjoy is turning a messy operational
process into a tool someone can trust while they are in the middle of using it.

---

Open to iOS and full-stack engineering roles, contract work, and interesting
product problems — New York City or remote.

**[taylordrew4u@gmail.com](mailto:taylordrew4u@gmail.com)**
