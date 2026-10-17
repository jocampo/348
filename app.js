// 348: a homage to Sanzo Wada. Browse, copy and save his color combinations.

const CHAPTERS = ['Reds & pinks', 'Yellows, oranges & browns', 'Greens', 'Blues', 'Violets & purples', 'Neutrals'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const COUNT_WORDS = { 2: 'Two', 3: 'Three', 4: 'Four' };
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: '2', label: '2 colors' },
  { id: '3', label: '3 colors' },
  { id: '4', label: '4 colors' },
];
const STORE_KEY = '348:v1';

const icon = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7h3.2c2 0 3.2 1 4.3 2.7l2 3.1c1.1 1.7 2.3 2.7 4.3 2.7h3.2M17.5 12.5l3 3-3 3"/><path d="M3.5 17h3.2c1.2 0 2.1-.4 2.9-1.1M14.4 8.1c.8-.7 1.7-1.1 2.9-1.1h3.2M17.5 4l3 3-3 3"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
};

const main = document.getElementById('main');
const toastEl = document.querySelector('.toast');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const data = { colors: [], combos: [], comboById: new Map(), colorBySlug: new Map() };
const store = loadStore();
const scrollMemory = new Map();
const navStack = [];
let current = null;
let replacing = false;
let pendingDir = null;
let query = '';

// ---------- Storage ----------

function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    return {
      saved: Array.isArray(s.saved) ? s.saved.filter((k) => typeof k === 'string') : [],
      filter: FILTERS.some((f) => f.id === s.filter) ? s.filter : 'all',
    };
  } catch {
    return { saved: [], filter: 'all' };
  }
}

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Private mode or storage blocked: saving still works for this visit.
  }
}

const isSaved = (key) => store.saved.includes(key);

// ---------- Helpers ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const pad = (n) => String(n).padStart(3, '0');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const slugify = (s) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const isHex = (s) => /^#[0-9a-f]{6}$/i.test(s || '');

function luminance([r, g, b]) {
  const lin = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Pick whichever of near-black or white text has more contrast on the swatch.
function inkFor(rgb) {
  const l = luminance(rgb);
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? 'ink-dark' : 'ink-light';
}

const formats = (c) => [
  { k: 'HEX', shown: c.hex.toUpperCase(), copy: c.hex.toUpperCase() },
  { k: 'RGB', shown: c.rgb.join(' '), copy: `rgb(${c.rgb.join(', ')})` },
  { k: 'CMYK', shown: c.cmyk.join(' '), copy: `C${c.cmyk[0]} M${c.cmyk[1]} Y${c.cmyk[2]} K${c.cmyk[3]}` },
];

// ---------- Data ----------

async function loadData() {
  const res = await fetch('data/colors.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.json();

  data.colors = raw.map((c, index) => ({ ...c, index, slug: slugify(c.name), ink: inkFor(c.rgb) }));
  data.colorBySlug = new Map(data.colors.map((c) => [c.slug, c]));

  const byId = new Map();
  for (const color of data.colors) {
    for (const id of color.combinations) {
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push(color);
    }
  }
  data.combos = [...byId.entries()].sort((a, b) => a[0] - b[0]).map(([id, colors]) => ({ id, colors }));
  data.comboById = new Map(data.combos.map((c) => [c.id, c]));
}

// ---------- Components ----------

function valueChips(c) {
  return `<div class="values">${formats(c)
    .map(
      (f) => `<button class="value" type="button" data-copy="${esc(f.copy)}" data-hex="${c.hex}" aria-label="Copy ${f.k} ${esc(f.shown)}">
        <span class="value-k" aria-hidden="true">${f.k}</span><span class="value-v" aria-hidden="true">${esc(f.shown)}</span>
      </button>`,
    )
    .join('')}</div>`;
}

function comboCard(combo) {
  const names = combo.colors.map((c) => c.name).join(', ');
  const saved = isSaved(`c:${combo.id}`);
  return `<li><a class="combo-card" href="#/c/${combo.id}" aria-label="Combination ${combo.id}: ${esc(names)}${saved ? ' (saved)' : ''}">
    <span class="strip" aria-hidden="true">${combo.colors.map((c) => `<span style="background:${c.hex}"></span>`).join('')}</span>
    <span class="card-meta" aria-hidden="true"><span>${pad(combo.id)}</span>${saved ? icon.bookmark : ''}</span>
  </a></li>`;
}

function colorTile(c) {
  return `<li data-name="${esc(c.name.toLowerCase())}" data-hex="${c.hex}">
    <a class="color-tile" href="#/color/${c.slug}">
      <span class="tile-chip" style="background:${c.hex}" aria-hidden="true"></span>
      <span class="tile-name">${esc(c.name)}</span>
      <span class="tile-hex">${c.hex.toUpperCase()}</span>
    </a>
  </li>`;
}

function detailBar({ back, title, sub, saveKey, saveLabel }) {
  const saved = isSaved(saveKey);
  return `<header class="detail-bar">
    <a class="icon-btn" href="${back}" data-back aria-label="Back">${icon.back}</a>
    <div class="detail-title"><span class="detail-main">${title}</span>${sub ? `<span class="detail-sub">${sub}</span>` : ''}</div>
    <button class="icon-btn" type="button" data-save="${saveKey}" aria-pressed="${saved}" aria-label="Save ${saveLabel}">${icon.bookmark}</button>
    <button class="icon-btn" type="button" data-share aria-label="Share">${icon.share}</button>
  </header>`;
}

// ---------- Views ----------

function viewCombos() {
  const groups = [2, 3, 4].filter((n) => store.filter === 'all' || String(n) === store.filter);
  const sections = groups
    .map((n) => {
      const list = data.combos.filter((c) => c.colors.length === n);
      return `<section class="group" aria-labelledby="g${n}">
        <h2 class="group-title" id="g${n}">${COUNT_WORDS[n]} colors<span class="group-meta">${list[0].id}–${list.at(-1).id}</span></h2>
        <ol class="combo-grid">${list.map(comboCard).join('')}</ol>
      </section>`;
    })
    .join('');

  return {
    tab: 'combos',
    title: 'Combinations',
    html: `<section class="view">
      <div class="view-head">
        <h1 class="view-title">Combinations <span class="view-count">${data.combos.length}</span></h1>
        <p class="view-intro">From Sanzo Wada’s <em>A Dictionary of Color Combinations</em>, compiled in the 1930s. Tap one to see its colors and copy them.</p>
        <div class="toolbar">
          <div class="seg" role="group" aria-label="Filter by number of colors">
            ${FILTERS.map((f) => `<button type="button" data-filter="${f.id}" aria-pressed="${store.filter === f.id}">${f.label}</button>`).join('')}
          </div>
          <button class="round-btn" type="button" data-random aria-label="Show a random combination">${icon.shuffle}</button>
        </div>
      </div>
      ${sections}
    </section>`,
  };
}

function viewCombo(id) {
  const combo = data.comboById.get(id);
  if (!combo) return viewNotFound();
  const total = data.combos.length;
  const prevId = id === 1 ? total : id - 1;
  const nextId = id === total ? 1 : id + 1;
  const n = combo.colors.length;
  const hexes = combo.colors.map((c) => c.hex.toUpperCase()).join(', ');

  return {
    tab: 'combos',
    detail: true,
    title: `No. ${pad(id)}`,
    prev: `#/c/${prevId}`,
    next: `#/c/${nextId}`,
    html: `<article class="view view-detail view-combo" data-swipe>
      ${detailBar({ back: '#/', title: `No. ${pad(id)}`, sub: `${COUNT_WORDS[n]} colors`, saveKey: `c:${id}`, saveLabel: 'combination' })}
      <div class="bands">
        ${combo.colors
          .map(
            (c) => `<section class="band ${c.ink}" style="--swatch:${c.hex}" aria-label="${esc(c.name)}">
              <a class="band-name" href="#/color/${c.slug}">${esc(c.name)}<span aria-hidden="true"> →</span></a>
              ${valueChips(c)}
            </section>`,
          )
          .join('')}
      </div>
      <footer class="detail-foot">
        <a class="pager" href="#/c/${prevId}" data-dir="prev" aria-label="Previous combination, ${prevId}">${icon.left}<span>${pad(prevId)}</span></a>
        <button class="btn" type="button" data-copy="${hexes}" data-hex="${combo.colors[0].hex}" data-label="Copied ${n} colors">${icon.copy}Copy all</button>
        <a class="pager" href="#/c/${nextId}" data-dir="next" aria-label="Next combination, ${nextId}"><span>${pad(nextId)}</span>${icon.right}</a>
      </footer>
    </article>`,
  };
}

function viewColors() {
  const chapters = CHAPTERS.map((label, s) => {
    const colors = data.colors.filter((c) => c.swatch === s);
    return `<section class="group" data-chapter>
      <h2 class="group-title"><span class="chapter-no">${ROMAN[s]}</span>${esc(label)}<span class="group-meta">${colors.length}</span></h2>
      <ul class="color-grid">${colors.map(colorTile).join('')}</ul>
    </section>`;
  }).join('');

  return {
    tab: 'colors',
    title: 'Colors',
    after: applySearch,
    html: `<section class="view view-colors">
      <div class="view-head">
        <h1 class="view-title">Colors <span class="view-count">${data.colors.length}</span></h1>
        <label class="search">${icon.search}<span class="sr-only">Search colors</span>
          <input id="q" type="search" placeholder="Search names or hex" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${esc(query)}">
        </label>
      </div>
      ${chapters}
      <p class="empty" hidden>No colors match “<span></span>”.</p>
    </section>`,
  };
}

function viewColor(slug) {
  const c = data.colorBySlug.get(slug);
  if (!c) return viewNotFound();
  const total = data.colors.length;
  const prev = data.colors[(c.index - 1 + total) % total];
  const next = data.colors[(c.index + 1) % total];
  const combos = c.combinations.map((id) => data.comboById.get(id));

  return {
    tab: 'colors',
    detail: true,
    title: c.name,
    prev: `#/color/${prev.slug}`,
    next: `#/color/${next.slug}`,
    html: `<article class="view view-detail view-color" data-swipe>
      ${detailBar({ back: '#/colors', title: `No. ${pad(c.index + 1)}`, sub: `${ROMAN[c.swatch]} · ${esc(CHAPTERS[c.swatch])}`, saveKey: `k:${c.slug}`, saveLabel: 'color' })}
      <div class="hero ${c.ink}" style="--swatch:${c.hex}">
        <h1 class="hero-name">${esc(c.name)}</h1>
        ${valueChips(c)}
      </div>
      <section class="group">
        <h2 class="group-title">Appears in<span class="group-meta">${plural(combos.length, 'combination')}</span></h2>
        <ol class="combo-grid">${combos.map(comboCard).join('')}</ol>
      </section>
      <footer class="detail-foot">
        <a class="pager" href="#/color/${prev.slug}" data-dir="prev" aria-label="Previous color, ${esc(prev.name)}">${icon.left}<span class="pager-name">${esc(prev.name)}</span></a>
        <a class="pager" href="#/color/${next.slug}" data-dir="next" aria-label="Next color, ${esc(next.name)}"><span class="pager-name">${esc(next.name)}</span>${icon.right}</a>
      </footer>
    </article>`,
  };
}

function viewSaved() {
  const combos = store.saved.filter((k) => k.startsWith('c:')).map((k) => data.comboById.get(Number(k.slice(2)))).filter(Boolean);
  const colors = store.saved.filter((k) => k.startsWith('k:')).map((k) => data.colorBySlug.get(k.slice(2))).filter(Boolean);
  const empty = !combos.length && !colors.length;

  return {
    tab: 'saved',
    title: 'Saved',
    html: `<section class="view">
      <div class="view-head">
        <h1 class="view-title">Saved <span class="view-count">${combos.length + colors.length}</span></h1>
      </div>
      ${
        empty
          ? `<div class="empty-block">${icon.bookmark}<p>Nothing saved yet. Tap the bookmark on any combination or color to keep it here.</p><p><a href="#/">Browse combinations</a></p></div>`
          : `${combos.length ? `<section class="group"><h2 class="group-title">Combinations<span class="group-meta">${combos.length}</span></h2><ol class="combo-grid">${combos.map(comboCard).join('')}</ol></section>` : ''}
             ${colors.length ? `<section class="group"><h2 class="group-title">Colors<span class="group-meta">${colors.length}</span></h2><ul class="color-grid">${colors.map(colorTile).join('')}</ul></section>` : ''}`
      }
    </section>`,
  };
}

function viewAbout() {
  return {
    tab: null,
    title: 'About',
    html: `<section class="view"><div class="prose">
      <h1>About</h1>
      <p>348 is a homage to Sanzo Wada and the 348 color combinations he collected.</p>
      <p>Wada (1883–1967) was a Japanese painter, costume designer and color researcher. He won an Academy Award for the costumes of <em>Gate of Hell</em> (1953).</p>
      <p>In the 1930s he published a six-volume study of color combinations. It is in print today as <em>A Dictionary of Color Combinations</em> from Seigensha. The printed book is the real reference, and it’s worth owning.</p>
      <h2>The colors</h2>
      <p>The book gives each color in CMYK, for print. The screen colors here were converted with ICC color profiles (U.S. Web Coated SWOP v2 to sRGB), so they are close but not exact. Screens vary too.</p>
      <h2>Credits</h2>
      <p>Color data compiled by <a href="https://github.com/dblodorn/sanzo-wada" rel="noopener">Dain M. Blodorn Kim</a> and revised by <a href="https://github.com/mattdesl/dictionary-of-colour-combinations" rel="noopener">Matt DesLauriers</a> (MIT license).</p>
      <p class="fine">348 is an independent project. It is not affiliated with Seigensha or the Wada estate.</p>
    </div></section>`,
  };
}

function viewNotFound() {
  return {
    tab: null,
    title: 'Not found',
    html: `<section class="view"><div class="empty-block"><p>That page doesn’t exist.</p><p><a href="#/">Back to combinations</a></p></div></section>`,
  };
}

// ---------- Router ----------

function resolve(key) {
  const path = key.replace(/^#/, '') || '/';
  let m;
  if (path === '/') return viewCombos();
  if (path === '/colors') return viewColors();
  if (path === '/saved') return viewSaved();
  if (path === '/about') return viewAbout();
  if ((m = path.match(/^\/c\/(\d+)$/))) return viewCombo(Number(m[1]));
  if ((m = path.match(/^\/color\/([a-z0-9-]+)$/))) return viewColor(m[1]);
  return viewNotFound();
}

function currentKey() {
  return location.hash || '#/';
}

// Track our own history so the back button can tell "came from inside the app" from "opened a shared link".
function recordNavigation(key) {
  if (replacing) {
    navStack[navStack.length - 1] = key;
    replacing = false;
  } else if (navStack.length > 1 && navStack[navStack.length - 2] === key) {
    navStack.pop();
  } else if (navStack.at(-1) !== key) {
    navStack.push(key);
  }
}

function route() {
  const key = currentKey();
  recordNavigation(key);
  if (current) scrollMemory.set(current.key, window.scrollY);
  render(key, { restoreScroll: true });
}

function render(key, { restoreScroll = false } = {}) {
  const view = resolve(key);
  const dir = pendingDir;
  pendingDir = null;
  // Set right away, not inside the transition callback, so quick repeat swipes see the new page.
  const isFirstRender = !current;
  current = { key, ...view };

  const update = () => {
    main.innerHTML = view.html;
    document.body.dataset.detail = String(Boolean(view.detail));
    document.title = view.title ? `${view.title} · 348` : '348 · A homage to Sanzo Wada';
    for (const tab of document.querySelectorAll('.tab')) {
      if (tab.dataset.tab === view.tab) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    view.after?.();
    const y = restoreScroll && !view.detail ? (scrollMemory.get(key) ?? 0) : 0;
    window.scrollTo(0, y);
  };

  if (isFirstRender || !document.startViewTransition || reduceMotion.matches) {
    update();
    return;
  }
  document.documentElement.dataset.nav = dir || 'fade';
  const transition = document.startViewTransition(update);
  // A newer navigation can interrupt this one; that's expected, not an error.
  transition.ready.catch(() => {});
  transition.finished.catch(() => {}).finally(() => delete document.documentElement.dataset.nav);
}

function go(dir) {
  const target = current?.[dir];
  if (!target) return;
  pendingDir = dir;
  replacing = true;
  location.replace(target);
}

// ---------- Actions ----------

let toastTimer;
function toast(message, hex) {
  toastEl.innerHTML = `${isHex(hex) ? `<span class="toast-dot" style="background:${hex}"></span>` : ''}<span>${esc(message)}</span>`;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

async function copy(text, hex, label) {
  if (await copyText(text)) {
    navigator.vibrate?.(8);
    toast(label || `Copied ${text}`, hex);
  } else {
    toast('Couldn’t copy. Try long-pressing the value.');
  }
}

function toggleSave(button) {
  const key = button.dataset.save;
  const i = store.saved.indexOf(key);
  if (i >= 0) store.saved.splice(i, 1);
  else store.saved.unshift(key);
  persist();
  button.setAttribute('aria-pressed', String(i < 0));
  toast(i < 0 ? 'Saved' : 'Removed from saved');
}

async function share() {
  const url = location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title: document.title, url });
    } catch {
      // The person closed the share sheet.
    }
    return;
  }
  copy(url, null, 'Link copied');
}

function applySearch() {
  const view = main.querySelector('.view-colors');
  if (!view) return;
  const q = query.trim().toLowerCase();
  const hexQ = q.replace(/^#/, '');
  let total = 0;
  for (const chapter of view.querySelectorAll('[data-chapter]')) {
    let shown = 0;
    for (const li of chapter.querySelectorAll('li')) {
      const hit = !q || li.dataset.name.includes(q) || (hexQ && li.dataset.hex.slice(1).startsWith(hexQ));
      li.hidden = !hit;
      if (hit) shown++;
    }
    chapter.hidden = shown === 0;
    total += shown;
  }
  const empty = view.querySelector('.empty');
  empty.hidden = total > 0;
  empty.querySelector('span').textContent = query.trim();
}

// ---------- Events ----------

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-copy], [data-save], [data-share], [data-filter], [data-random], [data-back], [data-dir], .tab');
  if (!el) return;
  const ds = el.dataset;

  if (ds.copy !== undefined) {
    copy(ds.copy, ds.hex, ds.label);
  } else if (ds.save) {
    toggleSave(el);
  } else if (ds.share !== undefined) {
    share();
  } else if (ds.filter) {
    store.filter = ds.filter;
    persist();
    render(currentKey());
  } else if (ds.random !== undefined) {
    location.hash = `#/c/${1 + Math.floor(Math.random() * data.combos.length)}`;
  } else if (ds.back !== undefined) {
    if (navStack.length > 1) {
      e.preventDefault();
      history.back();
    }
  } else if (ds.dir) {
    e.preventDefault();
    go(ds.dir);
  } else if (el.classList.contains('tab') && el.getAttribute('href') === currentKey()) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id !== 'q') return;
  query = e.target.value;
  applySearch();
});

document.addEventListener('keydown', (e) => {
  if (!current?.detail || e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input, textarea')) return;
  if (e.key === 'ArrowRight') go('next');
  else if (e.key === 'ArrowLeft') go('prev');
});

// Horizontal swipes on detail views flip to the previous or next item, like turning pages.
let swipe = null;
main.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' || !e.isPrimary || !e.target.closest('[data-swipe]')) return;
  // Leave the screen edges to the system back gesture.
  if (e.clientX < 24 || e.clientX > window.innerWidth - 24) return;
  swipe = { x: e.clientX, y: e.clientY, t: performance.now() };
});
main.addEventListener('pointerup', (e) => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x;
  const dy = e.clientY - swipe.y;
  const fast = performance.now() - swipe.t < 700;
  swipe = null;
  if (fast && Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? 'next' : 'prev');
});
main.addEventListener('pointercancel', () => {
  swipe = null;
});

window.addEventListener('hashchange', route);

// ---------- Start ----------

async function start() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  try {
    await loadData();
  } catch {
    main.innerHTML = '<p class="loading">Couldn’t load the colors. Check your connection and reload.</p>';
    return;
  }
  route();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Offline support is a bonus; the site works without it.
    });
  }
}

start();
