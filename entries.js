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
};
const POSITIONAL = ['username', 'account', 'day', 'link', 'type', 'title']; // old layout fallback

let entries = [];
const state = { sort: 'newest', type: 'all', day: '', artist: '' };
let lightboxItems = [];
let firstRender = true;
let loaded = false;

// ---------- animation ----------
// Uses the browser's View Transitions: each visible box gets a name, the browser
// then slides/zooms every box from its old spot to its new one and fades the rest.
// Browsers without it (or with reduced motion on) get simple CSS fades instead.
const canAnimate = !!document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!canAnimate) document.documentElement.classList.add('no-vt');

function nearViewport(el) {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
}

// name only boxes on screen (plus ones that were on screen before) to keep it fast
function nameBoxes(keep) {
    const named = new Set();
    document.querySelectorAll('#results [data-key]').forEach(el => {
        if (keep?.has(el.dataset.key) || nearViewport(el)) {
            el.style.viewTransitionName = el.dataset.key;
            named.add(el.dataset.key);
        }
    });
    return named;
}

function clearNames() {
    document.querySelectorAll('[style*="view-transition-name"]').forEach(el => el.style.viewTransitionName = '');
}

let active = null; // the animation currently playing, if any
function transition(update) {
    if (!canAnimate) { update(); return Promise.resolve(); }
    const t = document.startViewTransition(update);
    active = t;
    // safety net: never let an animation hold the page for more than a second
    setTimeout(() => { if (active === t) t.skipTransition(); }, 1000);
    t.ready.catch(() => {}); // a skipped animation is fine, the update still happens
    return t.finished.finally(() => {
        if (active === t) active = null;
        clearNames();
    });
}

// Rapid clicks: rather than cutting the running animation short (which makes
// boxes jump), let it finish, then animate once straight to the latest choice.
let renderQueued = false;
function animatedRender() {
    if (!canAnimate) { render(); return; }
    if (active) {
        if (!renderQueued) {
            renderQueued = true;
            active.finished.finally(() => { renderQueued = false; animatedRender(); });
        }
        return;
    }
    const before = nameBoxes();
    transition(() => { render(); nameBoxes(before); });
}
let lightboxIndex = 0;

// ---------- loading ----------
function sheetUrl() {
    return `https://docs.google.com/spreadsheets/d/${H.sheetId}/gviz/tq?tqx=out:json&headers=1&gid=${H.gid}`;
}

const cellValue = cell => cell?.v ?? '';

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
        return {
            order,
            username,
            account: safeUrl(get('account')),
            day,
            links,
            type,
            title: String(get('title')).trim(),
        };
    }).filter(Boolean);
}

async function load() {
    if (!H.gid) {
        document.getElementById('stats').textContent = 'no entries yet. check back on november 1!';
        document.getElementById('controls').hidden = true;
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
    loaded = true;
    fillControls();
    render();
}

// ---------- images ----------
// Small, cached copies via wsrv.nl (free image CDN) so the page loads fast;
// falls back to the original file if the proxy fails. Full size opens in the viewer.
function thumbUrl(url, w = 480) {
    if (VIDEO_RE.test(url)) return url;
    const anim = /\.gif(\?|$)/i.test(url) ? '&n=-1' : '';
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${w}&we&output=webp&q=85${anim}`;
}

// screen-sized copy for the viewer: sharp, but far smaller than the original file
function viewerUrl(url, cssWidth) {
    const w = Math.min(4000, Math.max(800, Math.ceil(cssWidth * (devicePixelRatio || 1) / 400) * 400));
    return thumbUrl(url, w);
}

function mediaTag(url, { full = false, alt = '' } = {}) {
    if (VIDEO_RE.test(url)) {
        return full
            ? `<video src="${esc(url)}" controls autoplay loop playsinline></video>`
            : `<video src="${esc(url)}#t=0.1" muted loop playsinline preload="metadata"></video>`;
    }
    const src = full ? url : thumbUrl(url);
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

// controls work right away, even before the sheet has loaded
function setupControls() {
    const daySel = document.getElementById('day');
    for (let d = 1; d <= DAYS; d++) {
        const info = dayInfo(d);
        daySel.insertAdjacentHTML('beforeend', `<option value="${d}">day ${d} · ${esc(info.prompt)} / ${esc(info.character)}</option>`);
    }
    const artistSel = document.getElementById('artist');
    if (state.artist) artistSel.insertAdjacentHTML('beforeend', `<option value="${esc(state.artist)}">${esc(state.artist)}</option>`);
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
    syncControls();
}

function syncControls() {
    document.querySelectorAll('.toggle button').forEach(b => b.setAttribute('aria-pressed', b.dataset.type === state.type));
    document.getElementById('clear').hidden = state.type === 'all' && !state.day && !state.artist;
}

// add entry counts and the artist list once the sheet is in
function fillControls() {
    const daySel = document.getElementById('day');
    for (let d = 1; d <= DAYS; d++) {
        const n = entries.filter(e => e.day === d).length;
        daySel.options[d].textContent += ` (${n})`;
    }
    const counts = new Map();
    entries.forEach(e => counts.set(e.username, (counts.get(e.username) || 0) + 1));
    const artistSel = document.getElementById('artist');
    [...counts.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })).forEach(a => {
        artistSel.insertAdjacentHTML('beforeend', `<option value="${esc(a)}">${esc(a)} (${counts.get(a)})</option>`);
    });
    // drop the placeholder added for an ?artist= link
    if (state.artist && artistSel.options[1]?.value === state.artist && !/\(\d+\)$/.test(artistSel.options[1].textContent)) artistSel.remove(1);
    artistSel.value = state.artist;
}

function update() {
    writeUrl();
    syncControls();
    if (loaded) animatedRender();
}

// ---------- rendering ----------
function filtered() {
    return entries.filter(e =>
        (state.type === 'all' || e.type === state.type) &&
        (!state.day || e.day === +state.day) &&
        (!state.artist || e.username === state.artist));
}

const byTime = (a, b) => a.order - b.order; // sheet row order

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

const headingIds = new Map();
const headingKey = text => {
    if (!headingIds.has(text)) headingIds.set(text, 'h' + headingIds.size);
    return headingIds.get(text);
};

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
        return `<div class="entry" data-key="e${e.order}"><button class="entry-art" data-lb="${e.lbStart}" aria-label="view ${esc(alt)}">${mediaTag(e.links[0], { alt })}${count}</button>${meta}</div>`;
    }
    const kind = e.type === 'story' ? 'story' : esc(e.type);
    return `<div class="entry" data-key="e${e.order}"><div class="entry-story"><span class="kind">${kind}</span><h3><a href="${esc(e.links[0])}" target="_blank" rel="noopener">${esc(e.title || e.links[0])}</a></h3></div>${meta}</div>`;
}

// Each entry's box is built once and moved around afterwards, so images that
// already loaded never reload or flash while boxes slide to new spots.
const boxes = new Map();
function boxFor(e) {
    let el = boxes.get(e.order);
    if (!el) {
        const t = document.createElement('template');
        t.innerHTML = entryHtml(e);
        el = t.content.firstElementChild;
        // thumbnail proxy failed → use the original image
        el.querySelectorAll('img').forEach(img => {
            img.onerror = () => { img.onerror = null; img.src = img.dataset.original; };
        });
        boxes.set(e.order, el);
    }
    const btn = el.querySelector('[data-lb]');
    if (btn) btn.dataset.lb = e.lbStart;
    return el;
}

function render() {
    syncControls();

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
    const dayTitle = state.day && state.sort !== 'day' ? `<h2 class="group-heading" data-key="${headingKey(dayHeading(+state.day))}">${dayHeading(+state.day)}</h2>` : '';
    const html = gs.map(g => `
        ${g.heading ? `<h2 class="group-heading" data-key="${headingKey(g.heading)}">${g.heading}<span>${g.count} ${g.count === 1 ? 'entry' : 'entries'}</span></h2>` : ''}
        <div class="entries${firstRender ? ' intro' : ''}">${g.items.map(e => `<i data-slot="${e.order}"></i>`).join('')}</div>`).join('');
    firstRender = false;
    const results = document.getElementById('results');
    results.innerHTML = dayTitle + (list.length ? html : '<p class="empty">nothing here yet</p>');
    const byOrder = new Map(list.map(e => [e.order, e]));
    results.querySelectorAll('[data-slot]').forEach(slot => slot.replaceWith(boxFor(byOrder.get(+slot.dataset.slot))));

    document.title = state.day ? `Day ${state.day} · Hypnovember ${H.year}` : `Hypnovember ${H.year} · entries`;
}

// ---------- lightbox ----------
const lb = document.getElementById('lightbox');

// The viewer image gets a fixed size from the picture's shape before it's shown,
// so swapping the small thumbnail for the full file never changes its size.
const ratios = new Map(); // url -> width / height
function knownRatio(url) {
    if (ratios.has(url)) return Promise.resolve(ratios.get(url));
    const grid = [...document.querySelectorAll('#results img')].find(i => i.dataset.original === url && i.naturalWidth);
    if (grid) { ratios.set(url, grid.naturalWidth / grid.naturalHeight); return Promise.resolve(ratios.get(url)); }
    return new Promise(res => {
        const probe = new Image();
        probe.onload = () => { ratios.set(url, probe.naturalWidth / probe.naturalHeight); res(ratios.get(url)); };
        probe.onerror = () => res(null);
        probe.src = thumbUrl(url);
        setTimeout(() => res(null), 600);
    });
}

function fitViewer(img, ratio) {
    if (!ratio) return;
    const maxW = innerWidth - 32, maxH = innerHeight - 110;
    let w = maxW, h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    img.style.width = Math.round(w) + 'px';
    img.style.height = Math.round(h) + 'px';
}

// Loads and sizes the next picture off-screen first; the returned function
// then swaps it in instantly, so the animation starts from a real, painted image.
async function prepareItem(i) {
    const index = (i + lightboxItems.length) % lightboxItems.length;
    const { url, e, i: n } = lightboxItems[index];
    const alt = `${e.title || 'art'} by ${e.username}`;
    const by = e.account ? `<a href="${esc(e.account)}" target="_blank" rel="noopener">${esc(e.username)}</a>` : esc(e.username);
    const part = e.links.length > 1 ? ` · ${n + 1}/${e.links.length}` : '';
    const caption = `${e.title ? esc(e.title) + ' · ' : ''}by ${by}${e.day ? ' · ' + dayHeading(e.day) : ''}${part} · <a href="${esc(url)}" target="_blank" rel="noopener">original</a>`;
    const media = lb.querySelector('.lb-media');
    const apply = node => () => {
        lbMedia()?.cancelFull?.();
        lb.classList.remove('loading');
        lightboxIndex = index;
        lb.querySelector('.lb-caption').innerHTML = caption;
        node ? media.replaceChildren(node) : (media.innerHTML = mediaTag(url, { full: true, alt }));
    };
    if (VIDEO_RE.test(url)) return apply(null);

    const img = new Image();
    img.alt = alt;
    img.decoding = 'sync';
    fitViewer(img, await knownRatio(url));
    img.src = thumbUrl(url); // already cached from the grid
    img.onerror = () => { img.onerror = null; img.src = url; };
    await Promise.race([img.decode().catch(() => {}), new Promise(r => setTimeout(r, 400))]);
    if (!img.style.width && img.naturalWidth) fitViewer(img, img.naturalWidth / img.naturalHeight);

    // called once the zoom has finished: fetch the original file and swap it in when decoded
    img.loadFull = () => {
        if (img.dataset.full) return;
        img.dataset.full = 'loading';
        lb.classList.add('loading');
        const hi = new Image();
        hi.alt = img.alt;
        hi.decoding = 'async';
        // stop the loading line if this picture (or its full-size replacement) is still the one showing
        const done = () => { if (img.isConnected || hi.isConnected) lb.classList.remove('loading'); };
        // decode off the main thread first, then swap the whole element in
        // (changing img.src instead would make Chrome decode the big file in one blocking go)
        hi.onload = () => hi.decode().then(() => {
            if (!img.isConnected) return;
            hi.style.width = img.style.width;
            hi.style.height = img.style.height;
            hi.dataset.full = 'done';
            img.replaceWith(hi);
            done();
        }, done);
        hi.onerror = done;
        img.cancelFull = () => { hi.onload = hi.onerror = null; hi.src = ''; };
        hi.src = url;
    };
    return apply(img);
}

addEventListener('resize', () => {
    const img = lb.querySelector('.lb-media img');
    if (img && lbOpen) fitViewer(img, ratios.get(lightboxItems[lightboxIndex].url));
});

let lbOpen = false; // set right away; the class changes a frame later inside the transition
const lbMedia = () => lb.querySelector('.lb-media img, .lb-media video');
const thumbOf = item => document.querySelector(`[data-lb="${item.e.lbStart}"] img, [data-lb="${item.e.lbStart}"] video`);

// thumbnail zooms up into the viewer
let busy = false;
const setZoom = dir => document.documentElement.dataset.lbAnim = dir;
async function openLightbox(i) {
    if (busy || lbOpen) return;
    busy = true;
    lbOpen = true;
    const show = await prepareItem(i);
    busy = false;
    const thumb = thumbOf(lightboxItems[i]);
    if (thumb) thumb.style.viewTransitionName = 'lb-media';
    setZoom('open');
    transition(() => {
        show();
        if (thumb) thumb.style.viewTransitionName = '';
        lb.classList.add('open');
        document.body.style.overflow = 'hidden';
        if (thumb) lbMedia().style.viewTransitionName = 'lb-media';
    }).then(loadFullNow);
}

// only start the big download once the picture has finished popping out
function loadFullNow() {
    if (lbOpen) lbMedia()?.loadFull?.();
}

// viewer shrinks back into the thumbnail of whatever piece is showing
function closeLightbox() {
    if (!lbOpen) return;
    lbOpen = false;
    pendingSteps = 0;
    setZoom('close');
    const current = lbMedia();
    if (current) current.style.viewTransitionName = 'lb-media';
    transition(() => {
        lbMedia()?.cancelFull?.();
        lb.classList.remove('open', 'loading');
        lb.querySelector('.lb-media').innerHTML = '';
        document.body.style.overflow = '';
        const thumb = thumbOf(lightboxItems[lightboxIndex]);
        if (thumb) {
            if (!nearViewport(thumb)) thumb.scrollIntoView({ block: 'center' });
            thumb.style.viewTransitionName = 'lb-media';
        }
    });
}

// next/previous slide sideways
// Clicking next quickly: the slide that's playing finishes, then one more slide
// jumps by however many clicks came in meanwhile (no stuttering restarts).
let pendingSteps = 0;
async function stepLightbox(dir) {
    if (!lbOpen) return;
    if (busy || active) {
        if (!pendingSteps) waitThenStep();
        pendingSteps += dir;
        return;
    }
    busy = true;
    const show = await prepareItem(lightboxIndex + dir);
    busy = false;
    if (!lbOpen) return;
    setZoom('step');
    document.documentElement.dataset.lbDir = dir > 0 ? 'next' : 'prev';
    const old = lbMedia();
    if (old) old.style.viewTransitionName = 'lb-slide';
    transition(() => {
        show();
        lbMedia().style.viewTransitionName = 'lb-slide';
        if (!canAnimate) lbMedia().classList.add(dir > 0 ? 'from-right' : 'from-left');
    }).then(loadFullNow);
}

async function waitThenStep() {
    while (busy || active) await (active ? active.finished.catch(() => {}) : new Promise(r => setTimeout(r, 30)));
    const n = pendingSteps;
    pendingSteps = 0;
    if (n) stepLightbox(n);
}

document.getElementById('results').addEventListener('click', ev => {
    const btn = ev.target.closest('[data-lb]');
    if (btn) openLightbox(+btn.dataset.lb);
});
lb.querySelector('.lb-close').onclick = closeLightbox;
lb.querySelector('.lb-prev').onclick = () => stepLightbox(-1);
lb.querySelector('.lb-next').onclick = () => stepLightbox(1);
lb.addEventListener('click', ev => { if (ev.target === lb || ev.target.classList.contains('lb-media')) closeLightbox(); });
document.addEventListener('keydown', ev => {
    if (!lbOpen) return;
    if (ev.key === 'Escape') closeLightbox();
    if (ev.key === 'ArrowLeft') stepLightbox(-1);
    if (ev.key === 'ArrowRight') stepLightbox(1);
});
// swipe on phones
let touchX = null;
lb.addEventListener('touchstart', ev => { touchX = ev.touches[0].clientX; }, { passive: true });
lb.addEventListener('touchend', ev => {
    if (touchX === null) return;
    const dx = ev.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) stepLightbox(dx < 0 ? 1 : -1);
    touchX = null;
});

readUrl();
setupControls();
load();
