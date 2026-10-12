(() => {
  const JOURNAL_KEY = 'elena-journal-v1';
  const CLEARANCE_KEY = 'elena-clearance-v1';
  const MAX_LEVEL = 5;
  const app = document.getElementById('app');
  const searchInput = document.getElementById('search');
  const clearanceSelect = document.getElementById('clearance');

  let lore = { title: '', subtitle: '', categories: [], entries: [] };
  let journal = loadJournal();
  let clearance = loadClearance();
  let xrefRe = null;
  let xrefMap = new Map();

  // ---------- helpers ----------

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => new Date().toISOString().slice(0, 10);
  const asArr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const entryById = (id) => lore.entries.find((e) => e.id === id);
  const catById = (id) => lore.categories.find((c) => c.id === id);
  const journalById = (id) => journal.find((j) => j.id === id);
  const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '');
  const tagsHtml = (tags) => (tags && tags.length ? `<span class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</span>` : '');
  const levelOf = (x) => Math.min(MAX_LEVEL, Math.max(1, Number(x.clearance) || 1));
  const canRead = (x) => levelOf(x) <= clearance;
  const logLabel = (j) => `LOG-${j.logNo ? String(j.logNo).padStart(4, '0') : '????'}`;
  const classSlug = (c) => String(c || 'unclassified').toLowerCase().replace(/[^a-z]+/g, '-');
  const restrictedLabel = (x) => `Restricted file · Level ${levelOf(x)}`;
  // Plain text with redactions masked. Used for excerpts and search so hidden text never leaks.
  const plain = (t) => String(t ?? '').replace(/\[\[(.+?)\]\]/g, '[REDACTED]');
  const excerpt = (text, max = 160) => {
    const t = plain(text).replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  };

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

  function loadClearance() {
    try {
      const n = parseInt(localStorage.getItem(CLEARANCE_KEY), 10);
      return n >= 1 && n <= MAX_LEVEL ? n : MAX_LEVEL;
    } catch {
      return MAX_LEVEL;
    }
  }

  function saveClearance(n) {
    try {
      localStorage.setItem(CLEARANCE_KEY, String(n));
    } catch {
      // Clearance still applies for this page view.
    }
  }

  // One regex over all lore titles, longest first, so each mention links to its entry.
  function buildXrefs() {
    const items = lore.entries
      .filter((e) => e.title)
      .map((e) => ({ text: esc(e.title), id: e.id }))
      .sort((a, b) => b.text.length - a.text.length);
    xrefMap = new Map(items.map((i) => [i.text.toLowerCase(), i.id]));
    xrefRe = items.length ? new RegExp(`\\b(${items.map((i) => escRe(i.text)).join('|')})\\b`, 'gi') : null;
  }

  function xref(safe) {
    if (!xrefRe) return safe;
    return safe.replace(xrefRe, (m) => `<a class="xref" href="#/lore/${xrefMap.get(m.toLowerCase())}">${m}</a>`);
  }

  // Escape, link lore titles, and turn [[text]] into click-to-reveal redactions.
  function fmt(text) {
    return esc(text).split(/\[\[(.+?)\]\]/).map((part, i) => (
      i % 2
        ? `<span class="redact" role="button" tabindex="0" title="Redacted. Click to reveal.">${xref(part)}</span>`
        : xref(part)
    )).join('');
  }

  const paragraphs = (arr) => asArr(arr).map((p) => `<p>${fmt(p)}</p>`).join('');
  const card = (href, title, sub, tags = []) => (
    `<a class="card" href="${href}"><h3>${esc(title)}</h3><p>${esc(sub || '')}</p>${tagsHtml(tags)}</a>`
  );
  const notFound = () => `<p class="empty">No such file. <a href="#/">Return to the archive</a>.</p>`;
  const denied = (x, what) => `
    <div class="dossier denied">
      <div class="stamp">ACCESS DENIED</div>
      <p>This ${what} requires <strong>Level ${levelOf(x)}</strong> clearance. Your clearance is <strong>Level ${clearance}</strong>. Change it in the header to review the file.</p>
    </div>`;

  // ---------- views ----------

  function viewHome() {
    const cats = lore.categories.map((c) => {
      const n = lore.entries.filter((e) => e.category === c.id).length;
      return card(`#/lore?cat=${encodeURIComponent(c.id)}`, c.name, `${c.blurb || ''} · ${n} file${n === 1 ? '' : 's'}`);
    }).join('');
    const recent = [...journal].filter(canRead).sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 3);
    const recentHtml = recent.length
      ? `<ul class="entry-list">${recent.map((j) => `
          <li><a href="#/journal/${j.id}"><strong>${esc(j.title)}</strong></a>
          <p class="sub">${logLabel(j)} · ${esc(fmtDate(j.date))}</p></li>`).join('')}</ul>`
      : `<p class="empty">No personal logs on file.</p>`;

    return `
      <div class="stamp-line">Foundation Archive · Access Level ${clearance}</div>
      <h1>${esc(lore.title)}</h1>
      <p class="lead">${esc(lore.subtitle)}</p>
      <div class="grid">${cats}</div>
      <div class="section-title"><h2>Personal logs</h2><a href="#/journal/new">New log →</a></div>
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
          <ul class="entry-list">${items.map((e) => (canRead(e)
            ? `<li><a href="#/lore/${e.id}"><strong>${esc(e.title)}</strong></a>
                <p class="sub">${esc(e.file?.designation || e.id.toUpperCase())} · ${esc(excerpt(e.summary, 140))}</p></li>`
            : `<li><span class="locked"><strong>${esc(e.file?.designation || e.id.toUpperCase())}</strong></span>
                <p class="sub">${esc(restrictedLabel(e))}</p></li>`)).join('')}</ul>`;
      }).join('');

    return `
      <h1>Document Index</h1>
      <div class="chips">${chips}</div>
      ${groups || '<p class="empty">No files in this category.</p>'}`;
  }

  function dossierHeader(e, cat) {
    const f = e.file || {};
    return `
      <div class="dossier">
        <div class="dossier-top">
          <span class="doc-no">${esc(f.designation || e.id.toUpperCase())}</span>
          ${f.objectClass ? `<span class="object-class cls-${classSlug(f.objectClass)}">${esc(f.objectClass)}</span>` : ''}
        </div>
        <dl class="file-meta">
          ${cat ? `<div><dt>Category</dt><dd>${esc(cat.name)}</dd></div>` : ''}
          ${e.year != null ? `<div><dt>Year</dt><dd>${esc(e.year)}</dd></div>` : ''}
          <div><dt>Required clearance</dt><dd>Level ${levelOf(e)}</dd></div>
          ${e.tags && e.tags.length ? `<div><dt>Tags</dt><dd>${tagsHtml(e.tags)}</dd></div>` : ''}
        </dl>
      </div>`;
  }

  function viewEntry(id) {
    const e = entryById(id);
    if (!e) return notFound();
    const cat = catById(e.category);
    const crumbs = `<p class="crumbs"><a href="#/lore">Archive</a> / ${cat ? `<a href="#/lore?cat=${cat.id}">${esc(cat.name)}</a> / ` : ''}${esc(canRead(e) ? e.title : (e.file?.designation || 'Restricted'))}</p>`;

    if (!canRead(e)) {
      return `${crumbs}<h1>${esc(e.file?.designation || 'Restricted file')}</h1>${denied(e, 'file')}`;
    }

    const f = e.file || {};
    const related = (e.related || []).map(entryById).filter((x) => x && canRead(x));
    const referencedBy = lore.entries.filter((x) => x.id !== e.id && canRead(x) && (x.related || []).includes(e.id));
    const titleRe = new RegExp(`\\b${escRe(e.title)}\\b`, 'i');
    const journalRefs = journal.filter((j) => canRead(j) && ((j.links || []).includes(e.id) || titleRe.test(plain(j.body))));

    const list = (items) => `<ul class="entry-list">${items.map((x) => `
      <li><a href="#/lore/${x.id}"><strong>${esc(x.title)}</strong></a>
      <p class="sub">${esc(excerpt(x.summary, 120))}</p></li>`).join('')}</ul>`;

    return `
      ${crumbs}
      ${dossierHeader(e, cat)}
      <h1>${esc(e.title)}</h1>
      ${e.summary ? `<p class="summary">${fmt(e.summary)}</p>` : ''}
      ${asArr(f.containment).length ? `<section class="proc"><h2>Special Containment Procedures</h2>${paragraphs(f.containment)}</section>` : ''}
      <section class="body"><h2>${asArr(f.containment).length ? 'Description' : 'Entry'}</h2>${paragraphs(e.body)}</section>
      ${asArr(f.addenda).map((a, i) => `<section class="addendum"><h2>Addendum ${i + 1}</h2>${paragraphs(a)}</section>`).join('')}

      ${related.length ? `<div class="side-section"><h2>Related files</h2>${list(related)}</div>` : ''}
      ${referencedBy.length ? `<div class="side-section"><h2>Referenced by</h2>${list(referencedBy)}</div>` : ''}
      ${journalRefs.length ? `<div class="side-section"><h2>Personal logs mentioning this file</h2><ul class="entry-list">${journalRefs.map((j) => `
        <li><a href="#/journal/${j.id}"><strong>${esc(j.title)}</strong></a>
        <p class="sub">${logLabel(j)} · ${esc(fmtDate(j.date))}</p></li>`).join('')}</ul></div>` : ''}

      <div class="actions" style="margin-top:2rem">
        <a class="btn" href="#/journal/new?link=${encodeURIComponent(e.id)}">File a personal log on this</a>
      </div>`;
  }

  function viewTimeline(catId) {
    const chips = [{ id: '', name: 'All' }, ...lore.categories].map((c) => (
      `<a class="chip ${(catId || '') === c.id ? 'active' : ''}" href="#/timeline${c.id ? `?cat=${encodeURIComponent(c.id)}` : ''}">${esc(c.name)}</a>`
    )).join('');

    const items = lore.entries.filter((e) => !catId || e.category === catId);
    const dated = items.filter((e) => typeof e.year === 'number').sort((a, b) => a.year - b.year);
    const undated = items.filter((e) => typeof e.year !== 'number');

    const row = (e) => `<a class="timeline-item" href="#/lore/${e.id}">
      <h3>${canRead(e) ? esc(e.title) : esc(e.file?.designation || 'Restricted file')}</h3>
      <p>${canRead(e) ? esc(excerpt(e.summary, 140)) : esc(restrictedLabel(e))}</p></a>`;

    let byYear = '';
    let lastYear = null;
    for (const e of dated) {
      if (e.year !== lastYear) {
        byYear += `<div class="timeline-year">${esc(e.year)}</div>`;
        lastYear = e.year;
      }
      byYear += row(e);
    }

    const undatedHtml = undated.length
      ? `<div class="side-section"><h2>Undated</h2>${undated.map(row).join('')}</div>`
      : '';

    return `
      <h1>Chronology</h1>
      <div class="chips">${chips}</div>
      ${dated.length ? `<div class="timeline">${byYear}</div>` : '<p class="empty">No dated files. Add a "year" to an entry in data/lore.json.</p>'}
      ${undatedHtml}`;
  }

  function viewJournal() {
    const items = [...journal].sort((a, b) => (b.logNo || 0) - (a.logNo || 0));
    const list = items.length
      ? `<ul class="entry-list">${items.map((j) => (canRead(j)
        ? `<li><a href="#/journal/${j.id}"><strong>${esc(j.title)}</strong></a>
            <p class="sub">${logLabel(j)} · ${esc(fmtDate(j.date))} · ${esc(j.author || 'Unknown author')}</p>
            <p>${esc(excerpt(j.body, 200))}</p>
            ${tagsHtml(j.tags)}</li>`
        : `<li><span class="locked"><strong>${logLabel(j)}</strong></span>
            <p class="sub">${esc(restrictedLabel(j))}</p></li>`)).join('')}</ul>`
      : `<p class="empty">No personal logs on file. File the first one.</p>`;

    return `
      <h1>Personal Logs</h1>
      <p class="lead">Field notes, incident reports and personal logs. Stored in this browser.</p>
      <div class="toolbar">
        <a class="btn primary" href="#/journal/new">New log</a>
        <button class="btn" data-action="export">Export JSON</button>
        <label class="btn" style="cursor:pointer">Import JSON<input id="import-file" type="file" accept="application/json,.json" hidden></label>
      </div>
      ${list}`;
  }

  function viewJournalEntry(id) {
    const j = journalById(id);
    if (!j) return notFound();
    if (!canRead(j)) {
      return `<p class="crumbs"><a href="#/journal">Personal logs</a> / Restricted</p><h1>${logLabel(j)}</h1>${denied(j, 'log')}`;
    }
    const links = (j.links || []).map(entryById).filter((e) => e && canRead(e));
    return `
      <p class="crumbs"><a href="#/journal">Personal logs</a> / ${logLabel(j)}</p>
      <article class="journal-entry">
        <div class="dossier">
          <div class="dossier-top">
            <span class="doc-no">${logLabel(j)}</span>
            <span class="object-class cls-personal-log">Personal Log</span>
          </div>
          <dl class="file-meta">
            <div><dt>Date</dt><dd>${esc(fmtDate(j.date))}</dd></div>
            <div><dt>Author</dt><dd>${esc(j.author || 'Unknown')}</dd></div>
            <div><dt>Location</dt><dd>${esc(j.location || 'Unspecified')}</dd></div>
            <div><dt>Required clearance</dt><dd>Level ${levelOf(j)}</dd></div>
          </dl>
        </div>
        <h1>${esc(j.title)}</h1>
        ${tagsHtml(j.tags)}
        <div class="body log-body" style="margin-top:1rem">${fmt(j.body)}</div>
        ${links.length ? `<div class="side-section"><h2>Referenced files</h2><ul class="entry-list">${links.map((e) => `
          <li><a href="#/lore/${e.id}"><strong>${esc(e.title)}</strong></a></li>`).join('')}</ul></div>` : ''}
        <div class="actions">
          <a class="btn" href="#/journal/${j.id}/edit">Amend</a>
          <button class="btn danger" data-action="delete" data-id="${j.id}">Expunge</button>
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
        `<option value="${esc(e.id)}" ${selected.has(e.id) ? 'selected' : ''}>${esc(e.file?.designation || e.id.toUpperCase())}: ${esc(e.title)}</option>`
      )).join('')}</optgroup>`;
    }).join('');
    const levels = [1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${(j ? levelOf(j) : 1) === n ? 'selected' : ''}>Level ${n}</option>`).join('');

    return `
      <p class="crumbs"><a href="#/journal">Personal logs</a> / ${j ? `Amend ${logLabel(j)}` : 'New log'}</p>
      <h1>${j ? 'Amend personal log' : 'File personal log'}</h1>
      <form id="journal-form" class="editor" data-id="${j ? j.id : ''}">
        <label>Subject
          <input name="title" required value="${esc(j ? j.title : '')}" placeholder="What is this log about?">
        </label>
        <div class="row">
          <label>Date
            <input name="date" type="date" required value="${esc(j ? j.date : today())}">
          </label>
          <label>Author
            <input name="author" value="${esc(j ? j.author || '' : '')}" placeholder="Agent / Researcher name">
          </label>
        </div>
        <div class="row">
          <label>Location
            <input name="location" value="${esc(j ? j.location || '' : '')}" placeholder="Site, room or field">
          </label>
          <label>Clearance required
            <select name="clearance">${levels}</select>
          </label>
        </div>
        <label>Tags <span class="hint">comma separated</span>
          <input name="tags" value="${esc(j ? (j.tags || []).join(', ') : '')}" placeholder="incident, anomaly, interview">
        </label>
        <label>Referenced files <span class="hint">hold Ctrl or Cmd to pick several</span>
          <select name="links" multiple>${options}</select>
        </label>
        <label>Log body <span class="hint">Wrap text in [[double brackets]] to redact it. Readers click to reveal. File titles link automatically.</span>
          <textarea name="body" placeholder="Write the log here.">${esc(j ? j.body : '')}</textarea>
        </label>
        <div class="actions">
          <button class="btn primary" type="submit">${j ? 'Save amendment' : 'File log'}</button>
          <a class="btn" href="${j ? `#/journal/${j.id}` : '#/journal'}">Cancel</a>
        </div>
      </form>`;
  }

  function viewSearch(q) {
    const term = q.trim().toLowerCase();
    if (!term) return `<h1>Search</h1><p class="empty">Type in the search box above.</p>`;

    const hit = (text) => String(text || '').toLowerCase().includes(term);
    const loreText = (e) => plain([
      e.title, e.summary, e.file?.designation, ...asArr(e.body), ...asArr(e.file?.containment),
      ...asArr(e.file?.addenda).flat(), ...(e.tags || []),
    ].join(' '));
    const loreHits = lore.entries.filter((e) => hit(loreText(e)));
    const withheld = loreHits.filter((e) => !canRead(e)).length;
    const visibleLore = loreHits.filter(canRead);

    const journalHits = journal.filter((j) => hit(j.title) || hit(plain(j.body)) || (j.tags || []).some(hit));
    const journalWithheld = journalHits.filter((j) => !canRead(j)).length;
    const visibleJournal = journalHits.filter(canRead);

    const loreRows = visibleLore.map((e) => `<li><a href="#/lore/${e.id}"><strong>${esc(e.title)}</strong></a>
      <p class="sub">${esc(excerpt(e.summary, 140))}</p></li>`);
    const journalRows = visibleJournal.map((j) => `<li><a href="#/journal/${j.id}"><strong>${esc(j.title)}</strong></a>
      <p class="sub">${logLabel(j)} · ${esc(fmtDate(j.date))}</p></li>`);
    const withheldNote = (n) => (n ? `<p class="sub withheld">${n} result${n === 1 ? '' : 's'} withheld above your clearance level.</p>` : '');

    return `
      <h1>Search: “${esc(q)}”</h1>
      ${visibleLore.length ? `<div class="result-group"><div class="section-title"><h2>Archive (${visibleLore.length})</h2></div><ul class="entry-list">${loreRows.join('')}</ul></div>` : ''}
      ${visibleJournal.length ? `<div class="result-group"><div class="section-title"><h2>Personal logs (${visibleJournal.length})</h2></div><ul class="entry-list">${journalRows.join('')}</ul></div>` : ''}
      ${withheldNote(withheld + journalWithheld)}
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

  clearanceSelect.addEventListener('change', () => {
    clearance = parseInt(clearanceSelect.value, 10);
    saveClearance(clearance);
    route();
  });

  app.addEventListener('submit', (ev) => {
    const form = ev.target;
    if (form.id !== 'journal-form') return;
    ev.preventDefault();
    const fd = new FormData(form);
    const existing = journalById(form.dataset.id);
    const now = new Date().toISOString();
    const level = Math.min(MAX_LEVEL, Math.max(1, parseInt(fd.get('clearance'), 10) || 1));
    const entry = {
      id: existing ? existing.id : uid(),
      logNo: existing ? existing.logNo : Math.max(0, ...journal.map((j) => j.logNo || 0)) + 1,
      title: String(fd.get('title') || '').trim() || 'Untitled',
      date: String(fd.get('date') || today()),
      author: String(fd.get('author') || '').trim(),
      location: String(fd.get('location') || '').trim(),
      clearance: level,
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

  // Redactions: first click or Enter reveals; links inside a revealed redaction still work.
  function reveal(red) {
    if (red && !red.classList.contains('revealed')) {
      red.classList.add('revealed');
      return true;
    }
    return false;
  }

  app.addEventListener('click', (ev) => {
    const red = ev.target.closest('.redact');
    if (red && !red.classList.contains('revealed')) {
      ev.preventDefault();
      reveal(red);
      return;
    }

    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'delete') {
      const j = journalById(btn.dataset.id);
      if (j && confirm(`Expunge “${j.title}”? This cannot be undone.`)) {
        journal = journal.filter((x) => x.id !== j.id);
        if (saveJournal()) location.hash = '#/journal';
      }
    } else if (action === 'export') {
      const blob = new Blob([JSON.stringify({ version: 2, exported: new Date().toISOString(), journal }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `elena-logs-${today()}.json` });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });

  app.addEventListener('keydown', (ev) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList.contains('redact')) {
      ev.preventDefault();
      reveal(ev.target);
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
        if (!Array.isArray(incoming)) throw new Error('No log list found in file.');
        const valid = incoming.filter((j) => j && j.id && j.title && j.date && typeof j.body === 'string');
        const byId = new Map(journal.map((j) => [j.id, j]));
        valid.forEach((j) => byId.set(j.id, j));
        journal = [...byId.values()];
        if (saveJournal()) {
          alert(`Imported ${valid.length} logs.`);
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

  clearanceSelect.value = String(clearance);

  fetch('data/lore.json')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      lore = data;
      document.title = `${lore.title}: Foundation Archive`;
      buildXrefs();
      route();
    })
    .catch((err) => {
      app.innerHTML = `<h1>Archive offline</h1><p class="empty">${esc(err.message)}. Serve the folder over HTTP (for example, <code>python3 -m http.server</code>) rather than opening index.html directly.</p>`;
    });
})();
