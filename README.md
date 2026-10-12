# Elena Vance: Foundation Archive

A static, dependency-free archive styled as a Foundation file system, with personal logs.

## Run it

Serve the folder over HTTP (the site loads `data/lore.json`, so opening `index.html` directly won't work):

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000, or publish the repo with GitHub Pages.

## Edit the archive

All documents live in `data/lore.json`.

- `categories`: the sections of the archive.
- `entries`: one object per document.
  - `id`: unique, URL-safe. Used in links.
  - `category`: one of the category ids.
  - `title`, `summary`, `body` (array of paragraphs), `tags`, `related` (ids of linked files).
  - `year`: a number places the file on the chronology. `null` leaves it undated.
  - `clearance`: 1 to 5. Readers below this level see only a restricted notice.
  - `file` (optional): the dossier block.
    - `designation`: document number, e.g. `PERS-E-01`.
    - `objectClass`: `Safe`, `Euclid`, `Keter`, `Thaumiel`, `Neutralized`, or any label (colours are set for the first five).
    - `containment`: array of paragraphs, shown as Special Containment Procedures.
    - `addenda`: array of addenda. Each addendum is a paragraph or an array of paragraphs.

Formatting in any text field:
- A mention of a file's title links to it automatically.
- `[[text]]` is redacted. Readers click it to reveal it. Search and excerpts never show redacted text.

## Clearance

The header's **Clearance** selector sets the reader's level (default 5, so you see everything). Lower it to test what other readers see. The setting is kept in the browser.

## Personal logs

- File, amend and expunge logs from the **Personal Logs** page. Logs have an author, location, clearance and linked files, and are numbered `LOG-0001` onward.
- Logs are saved in the browser's local storage, on that browser and profile only.
- **Export JSON** backs them up. **Import JSON** restores or moves them, merging by log id.
