// Shared helpers for every 2026-style page. Expects config.js loaded first.
const H = HYPNOVEMBER;
const DAYS = 30;

function dayInfo(day) {
    const prompt = H.prompts[day - 1] || 'TBD';
    const character = H.characters[day - 1] || 'TBD';
    return { day, prompt, character, characterLink: H.characterLinks[character] || '' };
}

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Only allow http(s) links from the sheet
function safeUrl(u) {
    u = String(u || '').trim();
    return /^https?:\/\//i.test(u) ? u : '';
}

const MEDIA_RE = /\.(png|jpe?g|gif|webp|avif|bmp|mp4|webm|mov)(\?|$)/i;
const VIDEO_RE = /\.(mp4|webm|mov)(\?|$)/i;

// ---------- images ----------
// Small, cached copies via wsrv.nl (free image CDN) so the page loads fast;
// falls back to the original file if the proxy fails. Full size opens in the viewer.
function thumbUrl(url, w = 480) {
    if (VIDEO_RE.test(url)) return url;
    const anim = /\.gif(\?|$)/i.test(url) ? '&n=-1' : '';
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${w}&we&output=webp&q=85${anim}`;
}

// First frame only. wsrv.nl refuses animated gifs over about 71 megapixels
// (all frames added up), but it can still make a still of their first frame.
function stillUrl(url, w = 480) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${w}&we&output=webp&q=85`;
}

// thumbnail proxy failed: a gif tries a still first frame (and calls onStill),
// anything else (or a still that fails too) loads the original file
function proxyFallback(img, url, onStill) {
    img.onerror = () => {
        if (/\.gif(\?|$)/i.test(url) && !img.dataset.still) {
            img.dataset.still = '1';
            img.src = stillUrl(url);
            onStill?.();
        } else {
            img.onerror = null;
            img.src = url;
        }
    };
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

// ---------- sheet tabs ----------
// The entries and commissions pages each read both tabs: an entry is tied to a
// commission/YCH by putting the offer's title in the entries tab's "Commission?" column.
function sheetUrl(gid) {
    return `https://docs.google.com/spreadsheets/d/${H.sheetId}/gviz/tq?tqx=out:json&headers=1&gid=${gid}`;
}

// rows as { key: trimmed text } using the first column whose header matches one of the names
function readSheet(text, columns, positional) {
    const json = JSON.parse(text.slice(text.indexOf('(') + 1, text.lastIndexOf(')')));
    const labels = json.table.cols.map(c => (c.label || '').trim().toLowerCase());
    const index = {};
    for (const [key, names] of Object.entries(columns)) {
        const i = labels.findIndex(l => names.includes(l));
        if (i >= 0) index[key] = i;
    }
    if (positional && index.link === undefined) positional.forEach((k, i) => index[k] = i);
    return json.table.rows.map(row =>
        Object.fromEntries(Object.keys(columns).map(k => [k, index[k] === undefined ? '' : String(row.c[index[k]]?.v ?? '').trim()])));
}

// Column names the sheet can use (case-insensitive). Order doesn't matter, extra columns are ignored.
const ENTRY_COLUMNS = {
    username: ['username', 'name', 'artist', 'author'],
    account: ['account', 'profile', 'account link', 'artist link'],
    day: ['day'],
    link: ['link', 'links', 'url'],
    type: ['type'],
    title: ['title'],
    commission: ['commission?', 'commission', 'commission/ych', 'ych'],
};
const ENTRY_POSITIONAL = ['username', 'account', 'day', 'link', 'type', 'title']; // old layout fallback

function toEntry(r, order) {
    const username = r.username;
    if (!username || username.toLowerCase() === 'username') return null;
    const links = r.link.split(/\s+/).map(safeUrl).filter(Boolean);
    if (!links.length) return null;
    let type = r.type.toLowerCase();
    if (type !== 'story' && links.every(l => MEDIA_RE.test(l) || /wixmp|catbox|imgur|derpicdn/i.test(l))) type = 'art';
    if (!type) type = 'story';
    return { order, username, account: safeUrl(r.account), day: parseInt(r.day) || 0, links, type, title: r.title, commission: r.commission };
}

const parseEntries = text => readSheet(text, ENTRY_COLUMNS, ENTRY_POSITIONAL).map(toEntry).filter(Boolean);

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

const parseOffers = text => readSheet(text, COMM_COLUMNS).map(toOffer).filter(Boolean);

// "69420" -> "$69,420", "12.5" -> "$12.50"; anything with words in it ("from $50") is left alone
function formatPrice(p) {
    p = String(p ?? '').trim();
    const n = Number(p.replace(/[$,\s]/g, ''));
    if (!p || !/^\$?\s*[\d,]*\.?\d+$/.test(p) || !isFinite(n)) return p;
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });
}

const typeLabel = t => t === 'ych' ? 'YCH' : 'commission';

// The offer an entry names in its "Commission?" column (matched by title, ignoring case).
// Two offers with the same title: the one by the same artist wins, then the same day.
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
function offerFor(e, offers) {
    if (!e.commission) return null;
    const named = offers.filter(o => sameText(o.title, e.commission));
    return named.find(o => sameText(o.username, e.username)) || named.find(o => o.day === e.day) || named[0] || null;
}

// commissions page link that opens straight to this offer
const offerUrl = o => `commissions.html?offer=${encodeURIComponent(o.title)}&by=${encodeURIComponent(o.username)}`;

// ---- popups: same slide in / slide out as previous years ----
function showPanel(el) {
    el.style.display = 'block';
    el.style.animationName = 'slideInLeft';
    el.classList.add('open');
}

function hidePanel(el) {
    if (!el.classList.contains('open')) return;
    el.classList.remove('open');
    el.style.animationName = 'slideOutRight';
    el.addEventListener('animationend', () => {
        if (!el.classList.contains('open')) el.style.display = 'none';
    }, { once: true });
}

function hideAllPanels(except) {
    document.querySelectorAll('.popup.open, .card-display.open').forEach(p => {
        if (p !== except) hidePanel(p);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.year').forEach(e => e.textContent = H.year);
    const submit = document.getElementById('submit-link');
    if (submit) submit.href = H.submitForm;

    document.querySelectorAll('[data-popup]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const p = document.getElementById(btn.dataset.popup);
            hideAllPanels(p);
            p.classList.contains('open') ? hidePanel(p) : showPanel(p);
        });
    });
    // click outside or Escape closes popups
    document.addEventListener('click', e => {
        document.querySelectorAll('.popup.open').forEach(p => {
            if (!p.contains(e.target)) hidePanel(p);
        });
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') hideAllPanels();
    });
});
