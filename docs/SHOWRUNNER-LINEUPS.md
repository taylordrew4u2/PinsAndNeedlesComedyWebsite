# Current show lineups

The public shows pages can read current billed performers from the existing
I Can Run A Show API. Set these server environment variables on this website:

- `SHOWRUNNER_LINEUP_FEED_URL`: `https://icanrunashow.com/api/website-lineups`.
- `SHOWRUNNER_LINEUP_FEED_TOKEN`: the source feed's separate read-only token.
- `SHOWRUNNER_SHOW_LINKS`: a JSON array of approved source mappings such as
  `[{"id":"approved-source-id","date":"2027-01-01","series":"bad-decisions"}]`.

The IDs and dates above are examples. Configure the exact approved records,
excluding recovered copies and undated records. Keep tokens in server settings;
never use a `NEXT_PUBLIC_` variable or a producer OAuth credential.

The source app must have its matching allowlist and public projection feed
configured and seeded. Its `docs/WEBSITE-LINEUPS.md` documents that setup. The
feed returns only approved public fields and excludes surprise guests, contacts,
private production notes, media and signing keys.

Public page renders fetch the feed without caching it. An open shows index or
detail page refreshes every 30 seconds while visible and online, and refreshes
when the tab regains focus or connectivity. This is polling; visitors do not
need to reload the page themselves, and runtime updates do not depend on a Mac.

The live result is a public read overlay. It is never saved into the admin's
editable content. Existing manual descriptions, tickets, artwork and unrelated
shows remain intact. Generated show routes use stable source IDs; an adopted
manual show keeps its existing route. Successful empty lineups show the normal
unannounced message. Unavailable or invalid feed data clears managed performer
names and displays a temporary availability message rather than stale names.

New fields on the source follow its normal save transaction, including edits
made through MCP. Reload an older I Can Run A Show browser before editing: old
clients cannot supply the public projection, so their encrypted saves clear the
affected public lineup until a current client or MCP edit refreshes it.

With no integration settings, the site's existing content behavior is unchanged.
To stop the integration, remove its three environment variables and redeploy;
this does not delete or rewrite stored website content or source shows.
