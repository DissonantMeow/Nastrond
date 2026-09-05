# Náströnd — website

Three static pages. No build step, no framework, no dependencies. Open
`index.html` in a browser to preview it exactly as it will ship.

```
index.html      home — hero, status badge, realm facts, news
install.html    downloads + per-platform steps
faq.html        help / troubleshooting
styles.css      shared stylesheet (palette mirrors the launcher, §8.4)
status.js       status badge logic, shared by all three pages
status.json     realm status — the file you hand-edit (tier 1)
news.json       news feed — shared with the launcher's feedUrl
art/            optional: hero-bg.jpg, crest.png
```

---

## Before you share this with anyone

**Fill in the two download links.** Search `install.html` for `REPLACE_ME` —
there are two, one per platform. Each needs a URL, a version, a file size and a
SHA-256. The page will look finished without them, which is exactly why this is
first on the list.

Generate the hashes with:

```bash
sha256sum ~/Documents/eq2-launcher-Win/dist/EQ2Launcher.exe
sha256sum ~/Documents/eq2-launcher-linux/dist/*.AppImage
```

The binaries are too large for GitHub Pages, which caps individual files at
100 MB. Attach them to a **GitHub Release** instead (2 GB per file, versioned)
and point the links at the release asset URLs.

**Optional art.** The hero falls back to a gradient if `art/hero-bg.jpg` is
missing, so the page is never broken by an absent file. To use the real art:

```bash
mkdir -p art
cp ~/Documents/eq2-launcher-linux/src/renderer/art/hero-bg.jpg art/
```

Then in `styles.css`, add the image as the first layer of the `.hero`
background, above the two gradients:

```css
  background:
    linear-gradient(180deg, rgba(8,11,8,.45) 0%, rgba(8,11,8,.92) 100%),
    url("art/hero-bg.jpg"),
    radial-gradient(120% 90% at 50% 0%, rgba(69,194,47,.10), transparent 62%),
    linear-gradient(180deg, #0b0f0a 0%, var(--bg) 100%);
```

Keep the dark overlay. The wordmark is a light stone gradient and will vanish
against a busy photograph without it.

---

## Updating the status badge

Edit `status.json` and push. Four fields:

| Field | Values |
|---|---|
| `state` | `online`, `offline`, or `maintenance` |
| `checked` | ISO 8601 in UTC, e.g. `2026-09-05T14:32:00Z` |
| `message` | optional line shown under the badge on the home page |
| `players` | leave `null` — reserved for later |

`checked` is not decoration. `status.js` compares it against a staleness
threshold and falls back to **Unknown** if the file has not been touched in
seven days, so a status you forgot about degrades honestly instead of lying.

The badge also renders as Unknown before the fetch resolves and if anything
fails, which means a script error or a bad JSON file can never leave a stale
green pill claiming the realm is up.

A quick way to set it from the host:

```bash
# mark it up
printf '{\n  "state": "online",\n  "checked": "%s",\n  "message": "",\n  "players": null\n}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > status.json
```

---

## Updating news

`news.json` is an array of `{ date, title, body, url }`. `url` is optional;
`title` is required and entries without one are skipped. The home page shows
the newest five, in file order — put new items at the top.

This is the **same shape the launcher's `feedUrl` reads**, so once you repoint
`news.feedUrl` at this file, one edit updates both the website and everyone's
launcher. Because `news.feedUrl` is on the remote-config allowlist (§11.3), you
can make that switch without shipping a new build.

All feed text is inserted with `textContent`, never `innerHTML`, so a stray
angle bracket in a news post cannot break or inject into the page.

---

## Deploying

Cloudflare Pages or GitHub Pages both work; drop these files at the repo root
and point the project at it with no build command.

The pages carry `noindex, nofollow`. That discourages search engines but does
not stop anyone with the link. If you would rather the realm not be publicly
discoverable at all, prefer **Cloudflare Pages** — it supports access rules and
does not require the source repository to be public.

### Caching

Status and news are fetched with a cache-busting timestamp and `no-store`,
which handles the browser. The CDN is separate. On Cloudflare Pages, add a
`_headers` file if you find the badge going stale:

```
/status.json
  Cache-Control: no-store
/news.json
  Cache-Control: max-age=60
```

---

## Later: the heartbeat (tier 2)

The contract in `status.json` is fixed so a script can take over writing it
with no change to the markup or `status.js`. A systemd user timer alongside the
existing DuckDNS one, probing port 9001 the way the hairpin test does, then
writing the file with a current timestamp.

Two things to know before you build it:

**Mixed content.** An HTTPS page cannot fetch
`http://nastrond.duckdns.org:9200/status.json` — browsers block it silently,
and you would see a permanent Unknown with nothing in the UI explaining why.
Either give Caddy a real certificate via the DNS-01 challenge, or have the
heartbeat commit the file to this repo instead.

**Drop the threshold.** `STALE_AFTER_MS` at the top of `status.js` is set to
seven days because a human is editing the file. With a 15-minute timer, set it
to roughly `45 * 60 * 1000`.

Serving `status.json` from the Caddy container has one nice property: when the
machine is off, the fetch itself fails and the badge falls to Unknown without
anyone deciding anything. Note that `build-assets.py` regenerates `dist/`, so
the status file would need to live in the source tree and be copied by the
generator rather than dropped into `dist/` by hand.
