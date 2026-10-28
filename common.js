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
