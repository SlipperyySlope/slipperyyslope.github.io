// View and heart counts for the entries page. Each entry is keyed by its first link.
//   GET  /counts            -> { "<key>": [views, hearts], ... }
//   POST /view   { key }    -> +1 view
//   POST /heart  { key, on } -> +1 heart (on: true) or -1 (on: false)
const ORIGINS = ['https://slipperyyslope.github.io', 'http://localhost:8000', 'http://127.0.0.1:8000'];

function cors(req) {
    const origin = req.headers.get('Origin');
    return {
        'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
    };
}

const json = (req, data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors(req) } });

export default {
    async fetch(req, env) {
        const { pathname } = new URL(req.url);
        if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });

        if (req.method === 'GET' && pathname === '/counts') {
            const { results } = await env.DB.prepare('SELECT key, views, hearts FROM counts').all();
            return json(req, Object.fromEntries(results.map(r => [r.key, [r.views, r.hearts]])));
        }

        if (req.method === 'POST' && (pathname === '/view' || pathname === '/heart')) {
            let body;
            try { body = await req.json(); } catch { return json(req, { error: 'bad json' }, 400); }
            const key = String(body?.key || '');
            if (!/^https?:\/\//i.test(key) || key.length > 4000) return json(req, { error: 'bad key' }, 400);

            if (pathname === '/view') {
                await env.DB.prepare('INSERT INTO counts (key, views) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET views = views + 1').bind(key).run();
            } else if (body.on) {
                await env.DB.prepare('INSERT INTO counts (key, hearts) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET hearts = hearts + 1').bind(key).run();
            } else {
                await env.DB.prepare('UPDATE counts SET hearts = MAX(hearts - 1, 0) WHERE key = ?').bind(key).run();
            }
            return json(req, { ok: true });
        }

        return json(req, { error: 'not found' }, 404);
    },
};
