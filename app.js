(() => {
  const JOURNAL_KEY = 'elena-journal-v1';
  const app = document.getElementById('app');
  const searchInput = document.getElementById('search');

  let lore = { title: '', subtitle: '', categories: [], entries: [] };
  let journal = loadJournal();
  let xrefRe = null;
  let xrefMap = new Map();

  // ---------- helpers ----------

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => new Date().toISOString().slice(0, 10);
  const entryById = (id) => lore.entries.find((e) => e.id === id);
  const catById = (id) => lore.categories.find((c) => c.id === id);
  const journalById = (id) => journal.find((j) => j.id === id);
  const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '');
  const tagsHtml = (tags) => (tags && tags.length ? `<span class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</span>` : '');

  function loadJournal() {
    try {
      const data = JSON.parse(localStorage.getItem(JOURNAL_KEY));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveJournal() {
    try {
      localStorage.setItem(JOURNAL_KEY, JSON.stringify(journal));
      return true;
    } catch {
      alert('Could not save to this browser. Use Export to keep a copy of your journal.');
      return false;
    }
  }

  // Build one regex over all lore titles so each mention links to its entry, longest title first.
  function buildXrefs() {
    const items = lore.entries
      .filter((e) => e.title)
      .map((e) => ({ text: esc(e.title), id: e.id }))
      .sort((a, b) => b.text.length - a.text.length);
    xrefMap = new Map(items.map((i) => [i.text.toLowerCase(), i.id]));
    xrefRe = items.length ? new RegExp(`\\b(${items.map((i) => escRe(i.text)).join('|')})\\b`, 'gi') : null;
  }

  function linkify(text) {
    const safe = esc(text);
    if (!xrefRe) return safe;
    return safe.replace(xrefRe, (m) => `<a class="xref" href="#/lore/${xrefMap.get(m.toLowerCase())}">${m}</a>`);
  }

  const paragraphs = (arr) => (arr || []).map((p) => `<p>${linkify(p)}</p>`).join('');
  const card = (href, title, sub, tags = []) => (
    `<a class="card" href="${href}"><h3>${esc(title)}</h3><p>${esc(sub || '')}</p>${tagsHtml(tags)}</a>`
  );
  const notFound = () => `<p class="empty">Nothing here. <a href="#/">Back to the start</a>.</p>`;

  function excerpt(text, max = 160) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  // ---------- views ----------

  function viewHome() {
    const cats = lore.categories.map((c) => {
      const n = lore.entries.filter((e) => e.category === c.id).length;
      return card(`#/lore?cat=${encodeURIComponent(c.id)}`, c.name, `${c.blurb || ''} (${n})`);
    }).join('');
    const recent = [...journal].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 3);
    const recentHtml = recent.length
      ? `<ul class="entry-list">${recent.map((j) => `
          <li><a href="#/journal/${j.id}"><strong>${esc(j.title)}</strong></a>
          <p class="sub">${esc(fmtDate(j.date))}</p></li>`).join('')}</ul>`
      : `<p class="empty">No journal entries yet.</p>`;

    return `
      <h1>${esc(lore.title)}</h1>
      <p class="lead">${esc(lore.subtitle)}</p>
      <div class="grid">${cats}</div>
      <div class="section-title"><h2>Your journal</h2><a href="#/journal/new">New entry →</a></div>
      ${recentHtml}`;
  }

  function viewLore(catId) {
    const chips = [{ id: '', name: 'All' }, ...lore.categories].map((c) => (
      `<a class="chip ${(catId || '') === c.id ? 'active' : ''}" href="#/lore${c.id ? `?cat=${encodeURIComponent(c.id)}` : ''}">${esc(c.name)}</a>`
    )).join('');

    const groups = lore.categories
      .filter((c) => !catId || c.id === catId)
      .map((c) => {
        const items = lore.entries.filter((e) => e.category === c.id);
        if (!items.length) return '';
        return `
          <div class="section-title"><h2>${esc(c.name)}</h2></div>
          <ul class="entry-list">${items.map((e) => `
            <li><a href="#/lore/${e.id}"><strong>${esc(e.title)}</strong></a>
            <p class="sub">${esc(excerpt(e.summary, 140))}</p></li>`).join('')}</ul>`;
      }).join('');

    return `
      <h1>The Lore</h1>
      <div class="chips">${chips}</div>
      ${groups || '<p class="empty">No entries in this category yet.</p>'}`;
  }

  function viewEntry(id) {
    const e = entryById(id);
    if (!e) return notFound();
    const cat = catById(e.category);
    const related = (e.related || []).map(entryById).filter(Boolean);
    const referencedBy = lore.entries.filter((x) => x.id !== e.id && (x.related || []).includes(e.id));
    const titleRe = new RegExp(`\\b${escRe(e.title)}\\b`, 'i');
    const journalRefs = journal.filter((j) => (j.links || []).includes(e.id) || titleRe.test(j.body || ''));

    const list = (items) => `<ul class="entry-list">${items.map((x) => `
      <li><a href="#/lore/${x.id}"><strong>${esc(x.title)}</strong></a>
      <p class="sub">${esc(excerpt(x.summary, 120))}</p></li>`).join('')}</ul>`;

    return `
      <p class="crumbs"><a href="#/lore">Lore</a> / ${cat ? `<a href="#/lore?cat=${cat.id}">${esc(cat.name)}</a> / ` : ''}${esc(e.title)}</p>
      <h1>${esc(e.title)}</h1>
      <div class="meta">
        ${cat ? `<span>${esc(cat.name)}</span>` : ''}
        ${e.year != null ? `<span>Year ${esc(e.year)}</span>` : ''}
        ${tagsHtml(e.tags)}
      </div>
      ${e.summary ? `<p class="summary">${esc(e.summary)}</p>` : ''}
      <div class="body">${paragraphs(e.body)}</div>

      ${related.length ? `<div class="side-section"><h2>Related</h2>${list(related)}</div>` : ''}
      ${referencedBy.length ? `<div class="side-section"><h2>Referenced by</h2>${list(referencedBy)}</div>` : ''}
      ${journalRefs.length ? `<div class="side-section"><h2>In your journal</h2><ul class="entry-list">${journalRefs.map((j) => `
        <li><a href="#/journal/${j.id}"><strong>${esc(j.title)}</strong></a>
        <p class="sub">${esc(fmtDate(j.date))}</p></li>`).join('')}</ul></div>` : ''}

      <div class="actions" style="margin-top:2rem">
        <a class="btn" href="#/journal/new?link=${encodeURIComponent(e.id)}">Write a journal entry about this</a>
      </div>`;
  }

  function viewTimeline(catId) {
    const chips = [{ id: '', name: 'All' }, ...lore.categories].map((c) => (
      `<a class="chip ${(catId || '') === c.id ? 'active' : ''}" href="#/timeline${c.id ? `?cat=${encodeURIComponent(c.id)}` : ''}">${esc(c.name)}</a>`
    )).join('');

    const items = lore.entries.filter((e) => !catId || e.category === catId);
    const dated = items.filter((e) => typeof e.year === 'number').sort((a, b) => a.year - b.year);
    const undated = items.filter((e) => typeof e.year !== 'number');

    let byYear = '';
    let lastYear = null;
    for (const e of dated) {
      if (e.year !== lastYear) {
        byYear += `<div class="timeline-year">${esc(e.year)}</div>`;
        lastYear = e.year;
      }
      byYear += `<a class="timeline-item" style="display:block;color:inherit" href="#/lore/${e.id}">
        <h3>${esc(e.title)}</h3><p>${esc(excerpt(e.summary, 140))}</p></a>`;
    }

    const undatedHtml = undated.length
      ? `<div class="side-section"><h2>Undated</h2>${undated.map((e) => `
          <a class="timeline-item" style="display:block;color:inherit" href="#/lore/${e.id}">
          <h3>${esc(e.title)}</h3><p>${esc(excerpt(e.summary, 140))}</p></a>`).join('')}</div>`
      : '';

    return `
      <h1>Timeline</h1>
      <div class="chips">${chips}</div>
      ${dated.length ? `<div class="timeline">${byYear}</div>` : '<p class="empty">No dated entries yet. Add a "year" to an entry in data/lore.json.</p>'}
      ${undatedHtml}`;
  }

  function viewJournal() {
    const items = [...journal].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.updated.localeCompare(a.updated));
    const list = items.length
      ? `<ul class="entry-list">${items.map((j) => `
          <li><a href="#/journal/${j.id}"><strong>${esc(j.title)}</strong></a>
          <p class="sub">${esc(fmtDate(j.date))}</p>
          <p>${esc(excerpt(j.body, 200))}</p>
          ${tagsHtml(j.tags)}</li>`).join('')}</ul>`
      : `<p class="empty">Your journal is empty. Write the first entry.</p>`;

    return `
      <h1>Journal</h1>
      <p class="lead">Private notes, scenes and thoughts. Saved in this browser.</p>
      <div class="toolbar">
        <a class="btn primary" href="#/journal/new">New entry</a>
        <button class="btn" data-action="export">Export JSON</button>
        <label class="btn" style="cursor:pointer">Import JSON<input id="import-file" type="file" accept="application/json,.json" hidden></label>
      </div>
      ${list}`;
  }

  function viewJournalEntry(id) {
    const j = journalById(id);
    if (!j) return notFound();
    const links = (j.links || []).map(entryById).filter(Boolean);
    return `
      <p class="crumbs"><a href="#/journal">Journal</a> / ${esc(j.title)}</p>
      <article class="journal-entry">
        <p class="date">${esc(fmtDate(j.date))}</p>
        <h1>${esc(j.title)}</h1>
        ${tagsHtml(j.tags)}
        <div class="body" style="margin-top:1rem">${linkify(j.body)}</div>
        ${links.length ? `<div class="side-section"><h2>About</h2><ul class="entry-list">${links.map((e) => `
          <li><a href="#/lore/${e.id}"><strong>${esc(e.title)}</strong></a></li>`).join('')}</ul></div>` : ''}
        <div class="actions">
          <a class="btn" href="#/journal/${j.id}/edit">Edit</a>
          <button class="btn danger" data-action="delete" data-id="${j.id}">Delete</button>
        </div>
      </article>`;
  }

  function viewEditor(id, linkId) {
    const j = id ? journalById(id) : null;
    if (id && !j) return notFound();
    const selected = new Set(j ? j.links || [] : linkId ? [linkId] : []);
    const options = lore.categories.map((c) => {
      const items = lore.entries.filter((e) => e.category === c.id);
      if (!items.length) return '';
      return `<optgroup label="${esc(c.name)}">${items.map((e) => (
        `<option value="${esc(e.id)}" ${selected.has(e.id) ? 'selected' : ''}>${esc(e.title)}</option>`
      )).join('')}</optgroup>`;
    }).join('');

    return `
      <p class="crumbs"><a href="#/journal">Journal</a> / ${j ? 'Edit' : 'New entry'}</p>
      <h1>${j ? 'Edit entry' : 'New entry'}</h1>
      <form id="journal-form" class="editor" data-id="${j ? j.id : ''}">
        <label>Title
          <input name="title" required value="${esc(j ? j.title : '')}" placeholder="What is this entry about?">
        </label>
        <div class="row">
          <label>Date
            <input name="date" type="date" required value="${esc(j ? j.date : today())}">
          </label>
          <label>Tags <span class="hint">comma separated</span>
            <input name="tags" value="${esc(j ? (j.tags || []).join(', ') : '')}" placeholder="scene, idea, dream">
          </label>
        </div>
        <label>Linked lore <span class="hint">hold Ctrl or Cmd to pick several</span>
          <select name="links" multiple>${options}</select>
        </label>
        <label>Entry
          <textarea name="body" placeholder="Write here. Mentions of lore titles will link automatically.">${esc(j ? j.body : '')}</textarea>
        </label>
        <div class="actions">
          <button class="btn primary" type="submit">${j ? 'Save changes' : 'Save entry'}</button>
          <a class="btn" href="${j ? `#/journal/${j.id}` : '#/journal'}">Cancel</a>
        </div>
      </form>`;
  }

  function viewSearch(q) {
    const term = q.trim().toLowerCase();
    if (!term) return `<h1>Search</h1><p class="empty">Type in the search box above.</p>`;

    const hit = (text) => String(text || '').toLowerCase().includes(term);
    const loreHits = lore.entries.filter((e) => hit(e.title) || hit(e.summary) || hit((e.body || []).join(' ')) || (e.tags || []).some(hit));
    const journalHits = journal.filter((j) => hit(j.title) || hit(j.body) || (j.tags || []).some(hit));

    const section = (title, rows) => `<div class="result-group"><div class="section-title"><h2>${title} (${rows.length})</h2></div>${rows.join('')}</div>`;
    const loreRows = loreHits.map((e) => `<li><a href="#/lore/${e.id}"><strong>${esc(e.title)}</strong></a>
      <p class="sub">${esc(excerpt(e.summary, 140))}</p></li>`);
    const journalRows = journalHits.map((j) => `<li><a href="#/journal/${j.id}"><strong>${esc(j.title)}</strong></a>
      <p class="sub">${esc(fmtDate(j.date))}</p></li>`);

    return `
      <h1>Search: “${esc(q)}”</h1>
      ${loreHits.length ? section('Lore', [`<ul class="entry-list">${loreRows.join('')}</ul>`]) : ''}
      ${journalHits.length ? section('Journal', [`<ul class="entry-list">${journalRows.join('')}</ul>`]) : ''}
      ${!loreHits.length && !journalHits.length ? '<p class="empty">No matches.</p>' : ''}`;
  }

  // ---------- routing ----------

  function route() {
    const [path, query = ''] = location.hash.slice(1).split('?');
    const params = new URLSearchParams(query);
    const [a, b, c] = path.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
    let html;

    switch (a) {
      case undefined: html = viewHome(); break;
      case 'lore': html = b ? viewEntry(b) : viewLore(params.get('cat')); break;
      case 'timeline': html = viewTimeline(params.get('cat')); break;
      case 'journal':
        if (b === 'new') html = viewEditor(null, params.get('link'));
        else if (b && c === 'edit') html = viewEditor(b);
        else if (b) html = viewJournalEntry(b);
        else html = viewJournal();
        break;
      case 'search': html = viewSearch(params.get('q') || ''); break;
      default: html = notFound();
    }

    app.innerHTML = html;
    window.scrollTo(0, 0);
  }

  // ---------- events ----------

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/';
  });

  app.addEventListener('submit', (ev) => {
    const form = ev.target;
    if (form.id !== 'journal-form') return;
    ev.preventDefault();
    const fd = new FormData(form);
    const existing = journalById(form.dataset.id);
    const now = new Date().toISOString();
    const entry = {
      id: existing ? existing.id : uid(),
      title: String(fd.get('title') || '').trim() || 'Untitled',
      date: String(fd.get('date') || today()),
      tags: String(fd.get('tags') || '').split(',').map((t) => t.trim()).filter(Boolean),
      links: [...form.querySelector('[name="links"]').selectedOptions].map((o) => o.value),
      body: String(fd.get('body') || ''),
      created: existing ? existing.created : now,
      updated: now,
    };

    if (existing) journal = journal.map((j) => (j.id === entry.id ? entry : j));
    else journal.push(entry);

    if (saveJournal()) location.hash = `#/journal/${entry.id}`;
  });

  app.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'delete') {
      const j = journalById(btn.dataset.id);
      if (j && confirm(`Delete “${j.title}”? This cannot be undone.`)) {
        journal = journal.filter((x) => x.id !== j.id);
        if (saveJournal()) location.hash = '#/journal';
      }
    } else if (action === 'export') {
      const blob = new Blob([JSON.stringify({ version: 1, exported: new Date().toISOString(), journal }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `elena-journal-${today()}.json` });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });

  app.addEventListener('change', (ev) => {
    if (ev.target.id !== 'import-file') return;
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const incoming = Array.isArray(data) ? data : data.journal;
        if (!Array.isArray(incoming)) throw new Error('No journal list found in file.');
        const valid = incoming.filter((j) => j && j.id && j.title && j.date && typeof j.body === 'string');
        const byId = new Map(journal.map((j) => [j.id, j]));
        valid.forEach((j) => byId.set(j.id, j));
        journal = [...byId.values()];
        if (saveJournal()) {
          alert(`Imported ${valid.length} entries.`);
          route();
        }
      } catch (err) {
        alert(`Could not import: ${err.message}`);
      }
    };
    reader.readAsText(file);
  });

  window.addEventListener('hashchange', route);

  // ---------- boot ----------

  fetch('data/lore.json')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      lore = data;
      document.title = `${lore.title}: Lore`;
      buildXrefs();
      route();
    })
    .catch((err) => {
      app.innerHTML = `<h1>Could not load the lore</h1><p class="empty">${esc(err.message)}. Serve the folder over HTTP (for example, <code>python3 -m http.server</code>) rather than opening index.html directly.</p>`;
    });
})();
