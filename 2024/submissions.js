document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const match = path.match(/(\d+)\.html/);

    if (match) {
        const day = match[1];
        document.querySelector('.whichday').textContent = 'day ' + day;
    }
});

document.querySelectorAll('.home').forEach(item => {
    item.addEventListener('click', function(event) {
        event.stopPropagation();
        window.open('index.html', '_self').focus();
    });
});
