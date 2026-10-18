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
