# Elena Vance: Lore

A static, dependency-free lore site with a built-in journal.

## Run it

Serve the folder over HTTP (the site loads `data/lore.json`, so opening `index.html` directly won't work):

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. Or publish the repo with GitHub Pages.

## Edit the lore

All canon lives in `data/lore.json`:

- `categories`: the sections shown on the site.
- `entries`: one object per lore entry. Fields:
  - `id`: unique, URL-safe (used in links).
  - `category`: one of the category ids.
  - `title`, `summary`, `body` (array of paragraphs), `tags`.
  - `year`: a number places the entry on the timeline. Use `null` for undated.
  - `related`: ids of other entries to show as related.

Any mention of an entry's title inside another entry or journal entry is linked automatically.

## Journal

- Write, edit and delete entries from the **Journal** page. Entries can link to lore and carry tags.
- Entries are saved in the browser's local storage. They stay on that browser and profile only.
- Use **Export JSON** to back up, and **Import JSON** to restore or move to another browser. Import merges by entry id.
