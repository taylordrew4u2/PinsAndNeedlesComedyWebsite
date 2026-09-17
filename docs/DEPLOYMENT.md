# Deployment

The site runs on Vercel. Nothing here needs a paid plan.

## 1. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**, for
Production and Preview.

| Variable | Required | What it does |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | yes | Canonical origin. Drives canonical tags, sitemap, RSS, and the indexing gate. |
| `ADMIN_PASSWORD` | yes | Password for `/admin`. |
| `ADMIN_SECRET` | yes | Signs the admin cookie. `openssl rand -hex 32`. |
| `DECISIONS_INBOUND_SECRET` | no | Lets a relay post a texted decision to `/api/decisions/inbound`. Unset, that endpoint refuses everything. |
| `DECISIONS_INBOUND_FROM` | no | Comma-separated senders the endpoint accepts. Unset, it accepts anything with the secret. Note this cannot filter text spam — see section 6. |
| `ANTHROPIC_API_KEY` | no | Turns on the admin's AI helpers — the Write buttons, reading a flyer, writing a whole news post. |
| `OLLAMA_URL` | no | Runs those helpers on an Ollama server you host instead of the Anthropic API. See section 4. |

**`/admin` refuses every login unless both admin variables are set.** There is
no production fallback — see [ARCHITECTURE.md](./ARCHITECTURE.md#the-admin-fails-closed).
If logins start failing after a deploy, check these first.

## 2. Storage

Vercel's filesystem is read-only, so the `fs` driver cannot be used in
production. Pick one of the two:

### GitHub (free, no card)

Create a **second, private** repository to hold the content — not the one the
site deploys from, or every autosave would trigger a deployment. Keep it
private: `content.json` holds the Instagram token.

Create a fine-grained personal access token
([github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta))
scoped to that one repository, with **Contents: Read and write**. Then set:

```
CONTENT_GITHUB_TOKEN=github_pat_...
CONTENT_GITHUB_REPO=your-username/your-content-repo
CONTENT_GITHUB_BRANCH=main
```

Every save becomes a commit, so the content has a full history you can read back
and revert.

### Vercel Blob

Add a Blob store to the project. Vercel sets `BLOB_READ_WRITE_TOKEN` itself, and
the driver switches on automatically.

The driver is chosen from whichever secrets exist — GitHub wins over Blob,
because configuring it is the deliberate act. `CONTENT_DRIVER` overrides that if
you ever need it to.

## 3. Verify the deployment can actually save

This is the step worth not skipping, because everything looks fine until someone
tries to edit.

1. Open `/admin` and log in.
2. Change one visible piece of copy.
3. Wait for the status to read **Saved**.
4. Hard-reload the public page and confirm the change survived.

If it says **Save failed**, the message carries the store's own error. The usual
causes are a missing token, a token scoped to the wrong repository, or a content
repo that does not exist yet.

## 4. The AI helpers (optional)

Three things in `/admin` ask a model to write: the ✦ Write buttons on every
copy field, "Fill in from poster" on a show, and "Write a whole post for me" in
the News tab. All three go through `src/lib/ai.ts`, which can talk to either
provider. Nothing above that file knows which one answered.

### Anthropic (hosted)

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-5        # optional
```

Works on Vercel with nothing else to run. One model reads pictures and writes
prose.

### Ollama (a model you host)

```
OLLAMA_URL=http://your-host:11434
OLLAMA_MODEL=llama3.1:8b             # optional, the default
OLLAMA_VISION_MODEL=llama3.2-vision  # optional, only for reading flyers
OLLAMA_CONTEXT=16384                 # optional, tokens of context to load
OLLAMA_TIMEOUT_MS=180000             # optional, how long to wait for an answer
```

Setting `OLLAMA_URL` is taken as meaning it, so it wins over an Anthropic key
that is also set. `AI_PROVIDER=anthropic` or `AI_PROVIDER=ollama` overrides that
if you want to be explicit.

Four things worth knowing before you point production at it:

- **A deployed site cannot reach your laptop.** `OLLAMA_URL` has to be a host
  Vercel can open — a box with a public address, or a tunnel. `localhost` only
  works when the site is running on the same machine, which in practice means
  `npm run dev`.
- **Reading a flyer needs a vision model.** Most text models will refuse the
  image or quietly ignore it. Set `OLLAMA_VISION_MODEL` to something that can
  see (`llama3.2-vision`, `qwen2.5vl`, `llava`) and pull it first. If you skip
  this, the flyer button tells you which variable to set.
- **Context, not just the model, decides quality.** A whole news post plus the
  brand brief plus a flyer runs past a small window, and the model silently
  loses the beginning. 16k is the floor; give it more if the machine can.
- **Small models ignore the schema.** Ollama constrains the *shape* of the JSON
  but throws away the `description` on each field, and ours carry most of the
  instructions — so they are repeated in the prompt. Even then, an 8B model
  writes a thinner article than a frontier one. It works; it is not the same.

To check a server is reachable and has the model:

```
curl http://your-host:11434/api/tags
ollama pull llama3.1:8b
```

Whichever provider answered, the News tab's writer names the model in the note
above the draft, so you can tell at a glance which one you got.

## 5. Instagram sync (optional)

Only needed for pulling reels in automatically. Create an app at
developers.facebook.com, add the Instagram product, and set its OAuth redirect
URI to `<NEXT_PUBLIC_SITE_URL>/api/admin/instagram/callback`. Then set
`INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET`.

The token is stored in `content.json` and refreshes itself before its ~60-day
expiry — which is why the content repository must be private.

## 6. Texting a decision in (optional, free)

Some people will never scan a QR code. This gets their texts into the same
pile the host draws from, without paying anyone.

Google Voice is the only way to get a phone number for nothing. It cannot call
a webhook, but it will forward every text it receives to an email address — so
the job is getting that mail to the site.

There are two ways in. **The delivery endpoint is the one to prefer:** it holds
no mailbox password, and it works on mail plans that do not open IMAP at all —
including Zoho's free plan, which opens neither IMAP nor POP.

### a. A relay posts to the site (free, no mailbox password)

`POST /api/decisions/inbound` takes a decision from anything that knows the
secret. Set `DECISIONS_INBOUND_SECRET` in Vercel to a long random string
(`openssl rand -hex 32`); until it is set the endpoint refuses everything.

**The free way to feed it** is [`relay/gmail-apps-script.gs`](./relay/gmail-apps-script.gs).
Google Voice will not call a webhook — the one thing it does is email every text
to its own Google account — so something has to carry that last hop. That script
runs on the account the number already forwards to, reads the forwards, and
posts them here. It costs nothing, has no monthly task cap, and **the site never
gets a password to that or any other mailbox**: it holds one secret, scoped to
one endpoint, and the script is the only other thing that knows it.

Setting it up is four steps and takes a few minutes; they are written at the top
of the script. Run its `checkSetup` first — it posts nothing and tells you
whether the secret matches.

Anything else that can make an HTTP request works too: a mail relay with
webhooks, an automation (Zapier, Make, Zoho Flow), a shortcut on a phone.

The secret goes in a header or the URL, whichever the relay can manage:

```
x-inbound-secret: <secret>
Authorization: Bearer <secret>
POST /api/decisions/inbound?key=<secret>
```

The body can be JSON, a form post, or plain text. It reads `raw` (a whole MIME
message) in preference to `text`, `body`, `body-plain`, `html` and the rest, so
handing it the untouched forward gives the best result — that is the one the
parser can take apart properly. A relay's own idea of "the body" is often the
HTML part with the footer still attached.

Optionally set `DECISIONS_INBOUND_FROM` to one or more addresses (comma
separated). Only mail from those is accepted, everything else is ignored
quietly. Set it if the relay watches a whole inbox and delivers more than
forwarded texts.

**It does not filter text spam, and cannot.** Every Google Voice forward is
from `voice-noreply@google.com` whether a person or a marketer sent the text,
so the sender address says nothing. What separates them is the subject Voice
writes — "New text message from *sender*" — where marketing is a bare five- or
six-digit short code and a person is a full number or a name. The relay script
filters on that, before anything is posted.

### b. The site reads a mailbox (needs IMAP, so needs a paid mail plan)

1. **Get a number** at [voice.google.com](https://voice.google.com).
2. In Voice, **Settings → Messages → Forward messages to email**.
3. On the receiving account, turn on 2-step verification and create an
   **app password**. A normal account password will not work for IMAP.
4. Set `INBOX_IMAP_USER` and `INBOX_IMAP_PASSWORD` in Vercel.
   `INBOX_IMAP_HOST` defaults to Gmail's; set it for any other provider
   (Zoho's is `imappro.zoho.com`, port 993). Redeploy afterwards — a running
   deployment does not pick up new variables.
5. Put the number in **Admin → Bad Decisions → Text-in number** so it appears
   on the page.

Note that a free mail plan usually does not include IMAP. Zoho's free plan
opens neither IMAP nor POP —
[their docs](https://www.zoho.com/mail/help/imap-access.html) say so outright —
so a mailbox on it can only be reached through (a) above. Zoho Mail Lite, about
a dollar a month, turns IMAP on if you would rather run no relay at all.

**What arrives.** Voice sends `multipart/alternative` mail — a plain-text part
and an HTML one, each separately encoded. The site picks the plain part and
decodes it before reading a word of it, so the boundary markers and MIME headers
never reach the stage. Long texts are hard-wrapped by Voice at about 75
characters; those breaks are rejoined, and only a blank line starts a new
paragraph. Both ways in share that parsing.

**When the mailbox reader runs.** The admin's *Tonight* panel checks the
mailbox each time it polls, which is every fifteen seconds while it is open —
the hour of the show, and no other time. That is deliberate: a scheduler is the
part that costs money, since Vercel's hobby plan allows a cron job once a day,
which is no use to a live show. The delivery endpoint has no such constraint,
since the relay pushes rather than being polled.

The panel says whether the mailbox is answering. Mail that does not look like a
forwarded text is left alone, every message is marked read so nothing is added
twice, and texts outside the open window are skipped like any other late
submission.

**Both ways in enforce the submission window, and neither stores the sender's
number or address.**

### The paid alternative

A carrier number that can POST to a webhook removes the mailbox from the
middle. Twilio charges roughly $1.15/month plus a fraction of a cent per
message. Point its **A message comes in** webhook at
`<NEXT_PUBLIC_SITE_URL>/api/decisions/sms` and set `TWILIO_AUTH_TOKEN`. That
route verifies Twilio's signature and refuses every message while the token is
unset, so leaving it unconfigured is safe.

## 7. Moving the domain

Do this last. Until `NEXT_PUBLIC_SITE_URL` matches the host actually serving
traffic, the site refuses to let search engines index it — that gate is
deliberate, so a preview deployment can never outrank the real site.

1. Add the domain in **Vercel → Settings → Domains** and follow its DNS
   instructions.
2. Confirm `NEXT_PUBLIC_SITE_URL` is set to the final `https://` origin, with no
   trailing slash.
3. Redeploy, then check `/robots.txt` and `/sitemap.xml` on the real domain.
4. Submit the sitemap in Google Search Console.

## Rollback

Content and code roll back separately:

- **Code:** redeploy a previous deployment from the Vercel dashboard.
- **Content:** on the GitHub driver, revert the commit in the content repo.
