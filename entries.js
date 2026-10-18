// All-entries page: loads the sheet once, then sorts/filters in the browser.
// URL keeps the current view, e.g. all.html?day=5&type=art&sort=oldest

const MEDIA_RE = /\.(png|jpe?g|gif|webp|avif|bmp|mp4|webm|mov)(\?|$)/i;
const VIDEO_RE = /\.(mp4|webm|mov)(\?|$)/i;

// Column names the sheet can use (case-insensitive). Order doesn't matter, extra columns are ignored.
const COLUMNS = {
    username: ['username', 'name', 'artist', 'author'],
    account: ['account', 'profile', 'account link', 'artist link'],
    day: ['day'],
    link: ['link', 'links', 'url'],
    type: ['type'],
    title: ['title'],
    added: ['added', 'date', 'date added', 'timestamp', 'submitted'],
    thumb: ['thumbnail', 'thumb'],
};
const POSITIONAL = ['username', 'account', 'day', 'link', 'type', 'title']; // old layout fallback

let entries = [];
const state = { sort: 'newest', type: 'all', day: '', artist: '' };
let lightboxItems = [];
let lightboxIndex = 0;

// ---------- loading ----------
function sheetUrl() {
    return `https://docs.google.com/spreadsheets/d/${H.sheetId}/gviz/tq?tqx=out:json&headers=1&gid=${H.gid}`;
}

function cellValue(cell) {
    if (!cell) return '';
    const v = cell.v;
    if (typeof v === 'string' && v.startsWith('Date(')) {
        const p = v.slice(5, -1).split(',').map(Number);
        return new Date(p[0], p[1], p[2] || 1, p[3] || 0, p[4] || 0, p[5] || 0);
    }
    return v ?? '';
}

function parseSheet(text) {
    const json = JSON.parse(text.slice(text.indexOf('(') + 1, text.lastIndexOf(')')));
    const labels = json.table.cols.map(c => (c.label || '').trim().toLowerCase());
    const index = {};
    for (const [key, names] of Object.entries(COLUMNS)) {
        const i = labels.findIndex(l => names.includes(l));
        if (i >= 0) index[key] = i;
    }
    if (index.link === undefined) POSITIONAL.forEach((k, i) => index[k] = i);

    return json.table.rows.map((row, order) => {
        const get = k => index[k] === undefined ? '' : cellValue(row.c[index[k]]);
        const username = String(get('username')).trim();
        if (!username || username.toLowerCase() === 'username') return null;
        const links = String(get('link')).split(/\s+/).map(safeUrl).filter(Boolean);
        if (!links.length) return null;
        let type = String(get('type')).trim().toLowerCase();
        if (type !== 'story' && links.every(l => MEDIA_RE.test(l) || /wixmp|catbox|imgur|derpicdn/i.test(l))) type = 'art';
        if (!type) type = 'story';
        const day = parseInt(get('day')) || 0;
        const added = get('added');
        return {
            order,
            username,
            account: safeUrl(get('account')),
            day,
            links,
            type,
            title: String(get('title')).trim(),
            added: added instanceof Date ? added.getTime() : (Date.parse(added) || 0),
            thumb: safeUrl(get('thumb')),
        };
    }).filter(Boolean);
}

async function load() {
    if (!H.gid) {
        document.getElementById('stats').textContent = 'no entries yet. check back on november 1!';
        return;
    }
    try {
        const res = await fetch(sheetUrl());
        entries = parseSheet(await res.text());
    } catch (err) {
        console.error('Error fetching data:', err);
        document.getElementById('stats').textContent = "couldn't load entries right now, try refreshing";
        return;
    }
    setupControls();
    render();
}

// ---------- images ----------
// Small, cached copies via wsrv.nl (free image CDN) so the page loads fast;
// falls back to the original file if the proxy fails. Full size opens in the viewer.
function thumbUrl(url) {
    if (VIDEO_RE.test(url)) return url;
    const anim = /\.gif(\?|$)/i.test(url) ? '&n=-1' : '';
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=480&we&output=webp&q=80${anim}`;
}

function mediaTag(url, { thumb = '', full = false, alt = '' } = {}) {
    if (VIDEO_RE.test(url)) {
        return full
            ? `<video src="${esc(url)}" controls autoplay loop playsinline></video>`
            : `<video src="${esc(url)}#t=0.1" muted loop playsinline preload="metadata"></video>`;
    }
    const src = full ? url : (thumb || thumbUrl(url));
    return `<img src="${esc(src)}" data-original="${esc(url)}" alt="${esc(alt)}" loading="${full ? 'eager' : 'lazy'}" decoding="async">`;
}

// ---------- controls ----------
function readUrl() {
    const p = new URLSearchParams(location.search);
    if (['newest', 'oldest', 'day', 'artist'].includes(p.get('sort'))) state.sort = p.get('sort');
    if (['all', 'art', 'story'].includes(p.get('type'))) state.type = p.get('type');
    state.day = p.get('day') || '';
    state.artist = p.get('artist') || '';
}

function writeUrl() {
    const p = new URLSearchParams();
    if (state.sort !== 'newest') p.set('sort', state.sort);
    if (state.type !== 'all') p.set('type', state.type);
    if (state.day) p.set('day', state.day);
    if (state.artist) p.set('artist', state.artist);
    const qs = p.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
}

function setupControls() {
    const daySel = document.getElementById('day');
    for (let d = 1; d <= DAYS; d++) {
        const info = dayInfo(d);
        const n = entries.filter(e => e.day === d).length;
        daySel.insertAdjacentHTML('beforeend', `<option value="${d}">day ${d} · ${esc(info.prompt)} / ${esc(info.character)} (${n})</option>`);
    }
    const counts = new Map();
    entries.forEach(e => counts.set(e.username, (counts.get(e.username) || 0) + 1));
    const artistSel = document.getElementById('artist');
    [...counts.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })).forEach(a => {
        artistSel.insertAdjacentHTML('beforeend', `<option value="${esc(a)}">${esc(a)} (${counts.get(a)})</option>`);
    });

    const sortSel = document.getElementById('sort');
    sortSel.value = state.sort;
    daySel.value = state.day;
    artistSel.value = state.artist;
    sortSel.onchange = () => { state.sort = sortSel.value; update(); };
    daySel.onchange = () => { state.day = daySel.value; update(); };
    artistSel.onchange = () => { state.artist = artistSel.value; update(); };
    document.querySelectorAll('.toggle button').forEach(b => b.onclick = () => { state.type = b.dataset.type; update(); });
    document.getElementById('clear').onclick = () => {
        Object.assign(state, { type: 'all', day: '', artist: '' });
        daySel.value = artistSel.value = '';
        update();
    };
    document.getElementById('controls').hidden = false;
}

function update() { writeUrl(); render(); }

// ---------- rendering ----------
function filtered() {
    return entries.filter(e =>
        (state.type === 'all' || e.type === state.type) &&
        (!state.day || e.day === +state.day) &&
        (!state.artist || e.username === state.artist));
}

const byTime = (a, b) => (a.added - b.added) || (a.order - b.order);

function groups(list) {
    switch (state.sort) {
        case 'oldest': return [{ items: list.sort(byTime) }];
        case 'day': {
            const map = new Map();
            list.sort((a, b) => ((a.day || 99) - (b.day || 99)) || byTime(a, b))
                .forEach(e => { if (!map.has(e.day)) map.set(e.day, []); map.get(e.day).push(e); });
            return [...map].map(([day, items]) => ({ heading: dayHeading(day), count: items.length, items }));
        }
        case 'artist': {
            const map = new Map();
            list.sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }) || byTime(a, b))
                .forEach(e => { if (!map.has(e.username)) map.set(e.username, []); map.get(e.username).push(e); });
            return [...map].map(([name, items]) => ({ heading: esc(name), count: items.length, items }));
        }
        default: return [{ items: list.sort(byTime).reverse() }];
    }
}

function dayHeading(day) {
    if (!day) return 'any day';
    const d = dayInfo(day);
    return `day ${day} · ${esc(d.prompt)} / ${esc(d.character)}`;
}

function entryHtml(e) {
    const by = e.account
        ? `<a href="${esc(e.account)}" target="_blank" rel="noopener">${esc(e.username)}</a>`
        : esc(e.username);
    const dayLink = e.day ? `<span>day ${e.day}</span>` : '';
    const meta = `<div class="entry-meta"><span>by ${by}</span>${dayLink}</div>`;
    if (e.type === 'art') {
        const alt = `${e.title || 'art'} by ${e.username}`;
        const count = e.links.length > 1 ? `<span class="count">1/${e.links.length}</span>` : '';
        return `<div class="entry"><button class="entry-art" data-lb="${e.lbStart}" aria-label="view ${esc(alt)}">${mediaTag(e.links[0], { thumb: e.thumb, alt })}${count}</button>${meta}</div>`;
    }
    const kind = e.type === 'story' ? 'story' : esc(e.type);
    return `<div class="entry"><div class="entry-story"><span class="kind">${kind}</span><h3><a href="${esc(e.links[0])}" target="_blank" rel="noopener">${esc(e.title || e.links[0])}</a></h3></div>${meta}</div>`;
}

function render() {
    document.querySelectorAll('.toggle button').forEach(b => b.setAttribute('aria-pressed', b.dataset.type === state.type));
    document.getElementById('clear').hidden = state.type === 'all' && !state.day && !state.artist;

    const users = new Set(entries.map(e => e.username.toLowerCase()));
    const list = filtered();
    let stats = `${entries.length} entries · ${users.size} participants`;
    if (list.length !== entries.length) stats += ` · showing ${list.length}`;
    document.getElementById('stats').textContent = stats;

    const gs = groups(list);
    lightboxItems = [];
    gs.forEach(g => g.items.forEach(e => {
        if (e.type !== 'art') return;
        e.lbStart = lightboxItems.length;
        e.links.forEach((url, i) => lightboxItems.push({ url, e, i }));
    }));

    // a single day reads like the old per-day page
    const dayTitle = state.day && state.sort !== 'day' ? `<h2 class="group-heading">${dayHeading(+state.day)}</h2>` : '';
    const html = gs.map(g => `
        ${g.heading ? `<h2 class="group-heading">${g.heading}<span>${g.count} ${g.count === 1 ? 'entry' : 'entries'}</span></h2>` : ''}
        <div class="entries">${g.items.map(entryHtml).join('')}</div>`).join('');
    document.getElementById('results').innerHTML = dayTitle + (list.length ? html : '<p class="empty">nothing here yet</p>');

    document.title = state.day ? `Day ${state.day} · Hypnovember ${H.year}` : `Hypnovember ${H.year} · entries`;

    // thumbnail proxy failed → use the original image
    document.querySelectorAll('#results img').forEach(img => {
        img.onerror = () => { img.onerror = null; img.src = img.dataset.original; };
    });
}

// ---------- lightbox ----------
const lb = document.getElementById('lightbox');

function openLightbox(i) {
    lightboxIndex = (i + lightboxItems.length) % lightboxItems.length;
    const { url, e, i: n } = lightboxItems[lightboxIndex];
    const alt = `${e.title || 'art'} by ${e.username}`;
    const media = lb.querySelector('.lb-media');
    media.innerHTML = mediaTag(url, { full: true, alt });
    // show the (already cached) thumbnail right away, swap in full size once it arrives
    const img = media.querySelector('img');
    if (img) {
        img.onerror = () => { img.onerror = null; img.src = url; };
        img.src = e.thumb && n === 0 ? e.thumb : thumbUrl(url);
        const full = new Image();
        full.onload = () => { if (img.isConnected) img.src = url; };
        full.src = url;
    }
    const by = e.account ? `<a href="${esc(e.account)}" target="_blank" rel="noopener">${esc(e.username)}</a>` : esc(e.username);
    const part = e.links.length > 1 ? ` · ${n + 1}/${e.links.length}` : '';
    lb.querySelector('.lb-caption').innerHTML =
        `${e.title ? esc(e.title) + ' · ' : ''}by ${by}${e.day ? ' · ' + dayHeading(e.day) : ''}${part} · <a href="${esc(url)}" target="_blank" rel="noopener">original</a>`;
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lb.classList.remove('open');
    lb.querySelector('.lb-media').innerHTML = '';
    document.body.style.overflow = '';
}

document.getElementById('results').addEventListener('click', ev => {
    const btn = ev.target.closest('[data-lb]');
    if (btn) openLightbox(+btn.dataset.lb);
});
lb.querySelector('.lb-close').onclick = closeLightbox;
lb.querySelector('.lb-prev').onclick = () => openLightbox(lightboxIndex - 1);
lb.querySelector('.lb-next').onclick = () => openLightbox(lightboxIndex + 1);
lb.addEventListener('click', ev => { if (ev.target === lb || ev.target.classList.contains('lb-media')) closeLightbox(); });
document.addEventListener('keydown', ev => {
    if (!lb.classList.contains('open')) return;
    if (ev.key === 'Escape') closeLightbox();
    if (ev.key === 'ArrowLeft') openLightbox(lightboxIndex - 1);
    if (ev.key === 'ArrowRight') openLightbox(lightboxIndex + 1);
});
// swipe on phones
let touchX = null;
lb.addEventListener('touchstart', ev => { touchX = ev.touches[0].clientX; }, { passive: true });
lb.addEventListener('touchend', ev => {
    if (touchX === null) return;
    const dx = ev.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) openLightbox(lightboxIndex + (dx < 0 ? 1 : -1));
    touchX = null;
});

readUrl();
load();
