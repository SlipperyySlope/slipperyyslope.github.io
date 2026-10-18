// Calendar / card page
const calendar = document.getElementById('calendar');
const cardsContainer = document.getElementById('cards-container');

// Blank boxes for the end of October so day 1 lands on the right weekday
const firstWeekday = new Date(H.year, 10, 1).getDay(); // 0 = Sunday
for (let i = firstWeekday; i > 0; i--) {
    const d = document.createElement('div');
    d.className = 'dummy-grid-item';
    d.textContent = 'oct ' + (32 - i);
    calendar.appendChild(d);
}

function placeholderFace(day, side) {
    const info = dayInfo(day);
    const label = side === 'front' ? info.prompt : info.character;
    return `<div class="card-placeholder"><span>day ${day}</span><strong>${esc(label)}</strong><span>${side === 'front' ? 'prompt' : 'character'}</span></div>`;
}

for (let i = 1; i <= DAYS; i++) {
    const gridItem = document.createElement('button');
    gridItem.className = 'grid-item';
    gridItem.dataset.day = i;
    gridItem.textContent = i;
    gridItem.setAttribute('aria-label', 'day ' + i);
    calendar.appendChild(gridItem);

    const display = document.createElement('div');
    display.className = 'card-display';
    display.id = 'card' + i;
    display.innerHTML = `
        <div class="card" role="button" tabindex="0" aria-label="flip card for day ${i}">
            <div class="card-face card-front"><img src="cards/day${i}front.png" alt="day ${i} prompt: ${esc(dayInfo(i).prompt)}"></div>
            <div class="card-face card-back"><img src="cards/day${i}back.png" alt="day ${i} character: ${esc(dayInfo(i).character)}"></div>
        </div>
        <a href="all.html?day=${i}" class="card-url"><span class="url-text">submissions</span></a>`;
    // No card art yet: draw a plain placeholder instead of a broken image
    display.querySelectorAll('img').forEach((img, idx) => {
        img.onerror = () => { img.parentElement.innerHTML = placeholderFace(i, idx ? 'back' : 'front'); };
    });
    const card = display.querySelector('.card');
    const flip = () => card.classList.toggle('is-flipped');
    card.addEventListener('click', flip);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
    cardsContainer.appendChild(display);
}

function openDay(day) {
    const display = document.getElementById('card' + day);
    if (!display) return;
    document.querySelectorAll('.grid-item').forEach(g => g.classList.toggle('clicked', g.dataset.day == day));
    hideAllPanels(display);
    showPanel(display);
}

calendar.addEventListener('click', e => {
    const item = e.target.closest('.grid-item');
    if (!item) return;
    e.stopPropagation();
    openDay(item.dataset.day);
});

document.addEventListener('click', e => {
    if (e.target.closest('.card-display')) return;
    document.querySelectorAll('.grid-item').forEach(g => g.classList.remove('clicked'));
    document.querySelectorAll('.card-display.open').forEach(hidePanel);
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.grid-item').forEach(g => g.classList.remove('clicked'));
});

// Text-only list
document.getElementById('textonly-list').innerHTML = Array.from({ length: DAYS }, (_, k) => {
    const d = dayInfo(k + 1);
    const ch = d.characterLink ? `<a href="${esc(d.characterLink)}" target="_blank" rel="noopener">${esc(d.character)}</a>` : esc(d.character);
    return `<p><a href="all.html?day=${d.day}">${d.day}</a> / ${esc(d.prompt)} / ${ch}</p>`;
}).join('');

// Past years
document.getElementById('archive-list').innerHTML = H.archives
    .map(y => `<p><a href="/${y}/index.html">hypnovember ${y}</a></p>`).join('');

// index.html#5 opens day 5's card directly (handy for sharing)
const hashDay = parseInt(location.hash.slice(1));
if (hashDay >= 1 && hashDay <= DAYS) openDay(hashDay);
