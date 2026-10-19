# hypnovember site

Live at https://slipperyyslope.github.io/ (GitHub Pages, no build step).
Run locally with `start-server.bat`, then open http://localhost:8000.

## Layout

| path | what |
| --- | --- |
| `index.html`, `all.html` | current year (calendar + one entries page) |
| `config.js` | **the only file to edit each year**: year, prompts, characters, sheet tab |
| `common.js`, `script.js`, `entries.js`, `styles.css` | shared code for the current year |
| `cards/dayNfront.png`, `cards/dayNback.png` | card art (missing cards show a plain "TBD" placeholder) |
| `tools/cards.html` | card maker (not linked anywhere): open `/tools/cards.html` |
| `2024/`, `2025/` | frozen archives, left exactly as they looked |
| `404.html` | also redirects old 2025 links like `/5.html` to `/2025/5.html` |

## Entries page

`all.html` loads the sheet once and sorts and filters in the browser. Every view has its own link:

- `all.html?day=5`: day 5 (replaces the old `5.html` pages)
- `all.html?type=art&sort=oldest`
- `all.html?artist=Moonatik`
- `index.html#5` opens day 5's card on the calendar

Art thumbnails are loaded small and cached through [wsrv.nl](https://wsrv.nl) (a free image CDN),
then shown full size when clicked. If wsrv ever fails, the page falls back to the original catbox link.

## Sheet format

The site reads columns **by header name**, so column order doesn't matter and extra columns are ignored.

| column | required | notes |
| --- | --- | --- |
| Username | yes | display name |
| Account | | link to their profile |
| Day | | 1–30, blank = "any day" |
| Link | yes | story URL or image/video URL. Several image links separated by spaces or new lines = one multi-image entry |
| Type | | `Art` or `Story` (image links count as art automatically) |
| Title | | story title, optional caption for art |

Entries are ordered by their row in the sheet: add new ones at the bottom. Optional: add a dropdown (Data → Data validation) on Type with Art / Story so typos can't happen.
Then put the tab's `gid` (the number after `#gid=` in the URL) into `config.js`.

## New year checklist

1. Copy the current site into a `YYYY/` folder: `index.html all.html config.js common.js script.js entries.js styles.css favicon.png cards/`.
2. In the copy, save the sheet as `submissions.json` if you want it frozen (see `2025/` for how), or just leave it reading the old sheet tab.
3. At the root: bump `year`, clear `prompts`/`characters`, set `gid: null`, add the old year to `archives`, delete `cards/`.
4. Make cards with `tools/cards.html` and use its "copy prompts/characters for config.js" button.
