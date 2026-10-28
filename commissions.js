// Commissions page: artists offering commissions / YCHs for specific days.
// Loads the sheet's commission tab once, groups offers by day, and opens a detail view on click.
// URL keeps the current view, e.g. commissions.html?type=ych&day=5
// commissions.html?demo shows made-up offers, for trying the page out before the sheet has any.

const COMM_COLUMNS = {
    username: ['username', 'name', 'artist'],
    account: ['account', 'profile', 'account link', 'artist link'],
    day: ['day'],
    link: ['link', 'links', 'url'],
    title: ['title'],
    type: ['type'],
    price: ['price', 'cost'],
    description: ['description', 'details', 'info'],
};

let offers = [];
let shown = []; // offers on screen, in order (for next/previous)
const state = { type: 'all', day: '' };
let loaded = false;
let firstRender = true;
let viewIndex = 0;

const canAnimate = !!document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!canAnimate) document.documentElement.classList.add('no-vt');

let active = null;
function transition(update) {
    if (!canAnimate) { update(); return Promise.resolve(); }
    const t = document.startViewTransition(update);
    active = t;
    setTimeout(() => { if (active === t) t.skipTransition(); }, 1000);
    t.ready.catch(() => {});
    return t.finished.finally(() => {
        if (active === t) active = null;
        document.querySelectorAll('[style*="view-transition-name"]').forEach(el => el.style.viewTransitionName = '');
    });
}

// ---------- loading ----------
function parseSheet(text) {
    const json = JSON.parse(text.slice(text.indexOf('(') + 1, text.lastIndexOf(')')));
    const labels = json.table.cols.map(c => (c.label || '').trim().toLowerCase());
    const index = {};
    for (const [key, names] of Object.entries(COMM_COLUMNS)) {
        const i = labels.findIndex(l => names.includes(l));
        if (i >= 0) index[key] = i;
    }
    return json.table.rows.map(row => {
        const get = k => index[k] === undefined ? '' : String(row.c[index[k]]?.v ?? '').trim();
        return Object.fromEntries(Object.keys(COMM_COLUMNS).map(k => [k, get(k)]));
    });
}

function toOffer(r, order) {
    const username = r.username;
    if (!username || username.toLowerCase() === 'username') return null;
    const image = String(r.link || '').split(/\s+/).map(safeUrl).find(Boolean); // Link is always a picture
    if (!image) return null;
    return {
        order,
        username,
        account: safeUrl(r.account),
        day: parseInt(r.day) || 0,
        image,
        title: r.title,
        type: /ych/i.test(r.type) ? 'ych' : 'commission',
        price: formatPrice(r.price),
        description: r.description,
    };
}

// "69420" -> "$69,420", "12.5" -> "$12.50"; anything with words in it ("from $50") is left alone
function formatPrice(p) {
    p = String(p ?? '').trim();
    const n = Number(p.replace(/[$,\s]/g, ''));
    if (!p || !/^\$?\s*[\d,]*\.?\d+$/.test(p) || !isFinite(n)) return p;
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });
}

function demoRows() {
    const img = n => `${location.origin}/cards/day${n}front.png`;
    return [
        { username: 'Moonatik', account: 'https://example.com', day: '3', link: img(3), title: 'Plant pet YCH', type: 'YCH', price: '$40 base / $15 per extra character', description: 'Your character tangled up in a hypnotic plant.\nFlat colour, simple background. Two slots left!' },
        { username: 'Starfall', day: '3', link: img(2), title: 'Sketch commissions', type: 'Commission', price: '25', description: 'Any day 3 prompt or character, black and white sketch.' },
        { username: 'Glimmerwing', account: 'https://example.com', day: '1', link: img(1), title: 'Screen-stare YCH', type: 'YCH', price: '1200.5', description: 'Full colour, comes with a looping gif version.' },
        { username: 'Quillpoint', day: '8', link: img(8), title: 'Hacking headshots', type: 'Commission', price: '$30 each', description: 'Headshots with glowing code eyes.' },
        { username: 'Velvet Dusk', day: '', link: img(20), title: 'Open all month', type: 'Commission', price: 'from $50', description: 'Taking any prompt, any day. DM me with a reference.' },
        { username: 'Moonatik', day: '14', link: img(14), title: 'Before/after YCH', type: 'YCH', price: '$45', description: '' },
    ];
}

async function load() {
    if (new URLSearchParams(location.search).has('demo')) {
        offers = demoRows().map(toOffer).filter(Boolean);
    } else if (!H.commissionGid) {
        document.getElementById('stats').textContent = 'no commissions yet. check back soon!';
        document.getElementById('controls').hidden = true;
        return;
    } else {
        try {
            const res = await fetch(`https://docs.google.com/spreadsheets/d/${H.sheetId}/gviz/tq?tqx=out:json&headers=1&gid=${H.commissionGid}`);
            offers = parseSheet(await res.text()).map(toOffer).filter(Boolean);
        } catch (err) {
            console.error('Error fetching data:', err);
            document.getElementById('stats').textContent = "couldn't load commissions right now, try refreshing";
            return;
        }
    }
    loaded = true;
    fillControls();
    render();
}

// ---------- controls ----------
function readUrl() {
    const p = new URLSearchParams(location.search);
    if (['all', 'commission', 'ych'].includes(p.get('type'))) state.type = p.get('type');
    state.day = p.get('day') || '';
}

function writeUrl() {
    const p = new URLSearchParams(location.search);
    state.type === 'all' ? p.delete('type') : p.set('type', state.type);
    state.day ? p.set('day', state.day) : p.delete('day');
    const qs = p.toString().replace(/=(&|$)/g, '$1'); // keeps "?demo" tidy
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
}

function setupControls() {
    const daySel = document.getElementById('day');
    for (let d = 1; d <= DAYS; d++) {
        const info = dayInfo(d);
        daySel.insertAdjacentHTML('beforeend', `<option value="${d}">day ${d} · ${esc(info.prompt)} / ${esc(info.character)}</option>`);
    }
    daySel.insertAdjacentHTML('beforeend', '<option value="any">any day</option>');
    daySel.value = state.day;
    daySel.onchange = () => { state.day = daySel.value; update(); };
    document.querySelectorAll('.toggle button').forEach(b => b.onclick = () => { state.type = b.dataset.type; update(); });
    document.getElementById('clear').onclick = () => {
        Object.assign(state, { type: 'all', day: '' });
        daySel.value = '';
        update();
    };
    syncControls();
}

function syncControls() {
    document.querySelectorAll('.toggle button').forEach(b => b.setAttribute('aria-pressed', b.dataset.type === state.type));
    document.getElementById('clear').hidden = state.type === 'all' && !state.day;
}

function fillControls() {
    const daySel = document.getElementById('day');
    for (let d = 1; d <= DAYS; d++) {
        daySel.options[d].textContent += ` (${offers.filter(o => o.day === d).length})`;
    }
    daySel.options[DAYS + 1].textContent += ` (${offers.filter(o => !o.day).length})`;
}

function update() {
    writeUrl();
    syncControls();
    if (!loaded) return;
    // boxes on screen glide to their new spots
    document.querySelectorAll('#results [data-key]').forEach(el => el.style.viewTransitionName = el.dataset.key);
    transition(() => {
        render();
        document.querySelectorAll('#results [data-key]').forEach(el => el.style.viewTransitionName = el.dataset.key);
    });
}

// ---------- rendering ----------
const typeLabel = t => t === 'ych' ? 'YCH' : 'commission';

function dayHeading(day) {
    if (!day) return 'any day';
    const d = dayInfo(day);
    return `day ${day} · ${esc(d.prompt)} / ${esc(d.character)}`;
}

function artistLink(o) {
    return o.account
        ? `<a href="${esc(o.account)}" target="_blank" rel="noopener">${esc(o.username)}</a>`
        : esc(o.username);
}

function offerHtml(o, i) {
    const meta = `<div class="entry-meta"><span>by ${artistLink(o)}</span>${o.price ? `<span class="price">${esc(o.price)}</span>` : ''}</div>`;
    const label = `${o.title || typeLabel(o.type)} by ${o.username}`;
    const badge = `<span class="comm-badge ${o.type}">${typeLabel(o.type)}</span>`;
    return `<div class="entry" data-key="c${o.order}"><button class="entry-art" data-open="${i}" aria-label="details for ${esc(label)}">${mediaTag(o.image, { alt: label })}${badge}</button>${meta}</div>`;
}

function render() {
    syncControls();
    const list = offers
        .filter(o => (state.type === 'all' || o.type === state.type) &&
            (!state.day || (state.day === 'any' ? !o.day : o.day === +state.day)))
        .sort((a, b) => ((a.day || 99) - (b.day || 99)) || a.order - b.order);
    shown = list;

    const artists = new Set(offers.map(o => o.username.toLowerCase()));
    let stats = `${offers.length} ${offers.length === 1 ? 'offer' : 'offers'} · ${artists.size} ${artists.size === 1 ? 'artist' : 'artists'}`;
    if (list.length !== offers.length) stats += ` · showing ${list.length}`;
    document.getElementById('stats').textContent = stats;

    const groups = new Map();
    list.forEach((o, i) => {
        if (!groups.has(o.day)) groups.set(o.day, []);
        groups.get(o.day).push(offerHtml(o, i));
    });
    const html = [...groups].map(([day, items]) => `
        <h2 class="group-heading" data-key="d${day}">${dayHeading(day)}<span>${items.length} ${items.length === 1 ? 'offer' : 'offers'}</span></h2>
        <div class="entries${firstRender ? ' intro' : ''}">${items.join('')}</div>`).join('');
    firstRender = false;
    const results = document.getElementById('results');
    results.innerHTML = list.length ? html : `<p class="empty">${offers.length ? 'nothing matches these filters' : 'no commissions posted yet'}</p>`;
    // thumbnail proxy failed → use the original image
    results.querySelectorAll('img').forEach(img => {
        img.onerror = () => { img.onerror = null; img.src = img.dataset.original; };
    });
}

// ---------- detail view ----------
const lb = document.getElementById('lightbox');
let lbOpen = false;
const lbMedia = () => lb.querySelector('.lb-media img, .lb-media video');
const thumbOf = i => document.querySelector(`[data-open="${i}"] img, [data-open="${i}"] video`);
const setAnim = a => document.documentElement.dataset.lbAnim = a;

// picture gets a fixed size up front so swapping in the sharp copy doesn't move anything
function fitImage(img, ratio) {
    if (!ratio) return;
    const narrow = innerWidth <= 768;
    const maxW = narrow ? innerWidth - 32 : innerWidth - 32 - 420;
    const maxH = narrow ? innerHeight * 0.5 : innerHeight - 64;
    let w = maxW, h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    img.style.width = Math.round(w) + 'px';
    img.style.height = Math.round(h) + 'px';
}

function infoHtml(o) {
    const d = o.day ? dayInfo(o.day) : null;
    const rows = [
        `<p class="comm-by">by ${artistLink(o)}</p>`,
        `<p class="comm-day">${d ? `day ${o.day} · ${esc(d.prompt)} / ${esc(d.character)}` : 'any day'}</p>`,
        o.price ? `<p class="comm-price">${esc(o.price)}</p>` : '',
        o.description ? `<p class="comm-desc">${esc(o.description)}</p>` : '',
        `<p><a class="comm-link" href="${esc(o.image)}" target="_blank" rel="noopener">view original</a></p>`,
        o.account ? `<p><a class="comm-link" href="${esc(o.account)}" target="_blank" rel="noopener">contact ${esc(o.username)}</a></p>` : '',
    ];
    return `<span class="comm-badge ${o.type}">${typeLabel(o.type)}</span><h2>${esc(o.title || typeLabel(o.type))}</h2>${rows.join('')}`;
}

// builds the next view off-screen; the returned function swaps it in instantly
async function prepare(i) {
    const index = (i + shown.length) % shown.length;
    const o = shown[index];
    let node = null;
    if (!VIDEO_RE.test(o.image)) {
        node = new Image();
        node.alt = `${o.title || typeLabel(o.type)} by ${o.username}`;
        node.decoding = 'sync';
        node.src = thumbUrl(o.image); // cached from the grid
        node.onerror = () => { node.onerror = null; node.src = o.image; };
        await Promise.race([node.decode().catch(() => {}), new Promise(r => setTimeout(r, 400))]);
        if (node.naturalWidth) fitImage(node, node.naturalWidth / node.naturalHeight);
    }
    return () => {
        lbMedia()?.cancelFull?.();
        lb.classList.remove('loading');
        viewIndex = index;
        const media = lb.querySelector('.lb-media');
        if (node) media.replaceChildren(node);
        else media.innerHTML = mediaTag(o.image, { full: true });
        lb.querySelector('.comm-info').innerHTML = infoHtml(o);
        lb.querySelector('.comm-info').scrollTop = 0;
    };
}

// once the zoom is done, fetch the original file and swap it in when decoded (same as the entries viewer)
function loadFull() {
    const img = lbMedia();
    if (!lbOpen || !img || img.tagName !== 'IMG' || img.dataset.full) return;
    const url = shown[viewIndex].image;
    img.dataset.full = 'loading';
    lb.classList.add('loading');
    const hi = new Image();
    hi.alt = img.alt;
    hi.decoding = 'async';
    const done = () => { if (img.isConnected || hi.isConnected) lb.classList.remove('loading'); };
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
}

let busy = false;
async function openView(i) {
    if (busy || lbOpen) return;
    busy = lbOpen = true;
    const show = await prepare(i);
    busy = false;
    const thumb = thumbOf(i);
    if (thumb) thumb.style.viewTransitionName = 'lb-media';
    setAnim('open');
    transition(() => {
        show();
        if (thumb) { thumb.style.viewTransitionName = ''; lbMedia().style.viewTransitionName = 'lb-media'; }
        lb.classList.add('open');
        document.body.style.overflow = 'hidden';
    }).then(loadFull);
}

function closeView() {
    if (!lbOpen) return;
    lbOpen = false;
    setAnim('close');
    const current = lbMedia();
    const thumb = thumbOf(viewIndex);
    if (current && thumb) current.style.viewTransitionName = 'lb-media';
    transition(() => {
        lbMedia()?.cancelFull?.();
        lb.classList.remove('open', 'loading');
        lb.querySelector('.lb-media').innerHTML = '';
        document.body.style.overflow = '';
        if (thumb) {
            const r = thumb.getBoundingClientRect();
            if (r.bottom < 0 || r.top > innerHeight) thumb.scrollIntoView({ block: 'center' });
            if (current) thumb.style.viewTransitionName = 'lb-media';
        }
    });
}

async function step(dir) {
    if (!lbOpen || busy || active || shown.length < 2) return;
    busy = true;
    const show = await prepare(viewIndex + dir);
    busy = false;
    if (!lbOpen) return;
    setAnim('step');
    document.documentElement.dataset.lbDir = dir > 0 ? 'next' : 'prev';
    const body = lb.querySelector('.comm-body');
    body.style.viewTransitionName = 'lb-slide';
    transition(() => {
        show();
        body.style.viewTransitionName = 'lb-slide';
        if (!canAnimate) { body.classList.remove('from-right', 'from-left'); void body.offsetWidth; body.classList.add(dir > 0 ? 'from-right' : 'from-left'); }
    }).then(loadFull);
}

document.getElementById('results').addEventListener('click', ev => {
    if (ev.target.closest('a')) return; // artist links work as normal links
    const btn = ev.target.closest('[data-open]');
    if (btn) openView(+btn.dataset.open);
});
lb.querySelector('.lb-close').onclick = closeView;
lb.querySelector('.lb-prev').onclick = () => step(-1);
lb.querySelector('.lb-next').onclick = () => step(1);
lb.addEventListener('click', ev => {
    if (ev.target === lb || ev.target.classList.contains('comm-body') || ev.target.classList.contains('lb-media')) closeView();
});
document.addEventListener('keydown', ev => {
    if (!lbOpen) return;
    if (ev.key === 'Escape') closeView();
    if (ev.key === 'ArrowLeft') step(-1);
    if (ev.key === 'ArrowRight') step(1);
});
addEventListener('resize', () => {
    const img = lbMedia();
    if (lbOpen && img?.naturalWidth) fitImage(img, img.naturalWidth / img.naturalHeight);
});
let touchX = null;
lb.addEventListener('touchstart', ev => { touchX = ev.touches[0].clientX; }, { passive: true });
lb.addEventListener('touchend', ev => {
    if (touchX === null) return;
    const dx = ev.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    touchX = null;
});

readUrl();
setupControls();
load();
