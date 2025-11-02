document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const match = path.match(/(\d+)\.html/);
    const isAllPage = path.includes('all.html');
    
    if (match) {
        const day = match[1];
        document.querySelector('.whichday').textContent = 'day ' + day;
    }

    // Fetch Google Sheets data
    fetch('https://docs.google.com/spreadsheets/d/1gvU4YH6lKy1N8BE7RLRPIotoqyDikZ8x_28nuR3rGh0/gviz/tq?tqx=out:json&gid=1781203971')
        .then(res => res.text())
        .then(text => {
            const json = JSON.parse(text.substr(47).slice(0, -2));
            // console.log(json);
            const rows = json.table.rows;
            const container = document.querySelector('.content');
            let totalSubmissions = 0;
            const uniqueUsers = new Set();
            for (let i = rows.length - 1; i >= 0; i--) {
                const row = rows[i];
                const [username, account, dayValue, link, type, title] = row.c.map(cell => cell?.v || '');
                // Skip header row
                if (username === 'Username') continue;
                // Count for stats
                totalSubmissions++;
                uniqueUsers.add(username);
                // Filter by day if not all.html
                if (!isAllPage && parseInt(dayValue) !== (match ? parseInt(match[1]) : match[1])) continue;
                let htmlBlock;
                if (type === 'Story') {
                    htmlBlock = `
                        <div class="text-content-block">
                            <h2>Story: <a href="${link}" target="_blank">${title}</a></h2>
                            <p>by <a href="${account}" target="_blank">${username}</a></p>
                        </div>
                    `;
                } else if (type === 'Art') {
                    htmlBlock = `
                        <div class="image-content-block">
                            <img src="${link}">
                            <p>by <a href="${account}" target="_blank">${username}</a></p>
                        </div>
                    `;
                } else {
                    htmlBlock = ''
                }
                if (htmlBlock) {
                    if (isAllPage) {
                        container.insertAdjacentHTML('beforeend', htmlBlock);
                    } else {
                        container.insertAdjacentHTML('afterbegin', htmlBlock);
                    }
                }
            }
            // Add stats to all.html
            if (isAllPage) {
                const statsHTML = `
                    <div class="stats center-text">
                        Total Entries: ${totalSubmissions}<br>
                        Participants: ${uniqueUsers.size}
                    </div>
                `;
                document.querySelector('h1').insertAdjacentHTML('afterend', statsHTML);
            }
        })
        .catch(error => console.error('Error fetching data:', error));
});

document.querySelectorAll('.home').forEach(item => {
    item.addEventListener('click', function(event) {
        event.stopPropagation();
        window.open('index.html', '_self').focus();
    });
});
