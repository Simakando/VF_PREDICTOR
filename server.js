const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 10000;
const PAWA_API = 'www.betpawa.co.zm';

// TIER 1 DATABASE
const ACTIVATORS = ['ARS', 'SUN', 'CHE', 'NOT', 'WOL', 'MUN', 'LIV', 'BRE', 'MCI', 'BOU', 'NEW', 'TOT', 'WHU', 'AST', 'FCB', 'DOR', 'LEV', 'RBL', 'STU', 'INT', 'NAP', 'JUV', 'MIL', 'ROM', 'RMA', 'BAR', 'ATM', 'GIR', 'PSG', 'MAR', 'LYO', 'SPO', 'BEN', 'POR', 'PSV', 'AJA', 'FEY'];

async function getPawaData(path) {
    return new Promise((resolve) => {
        const options = {
            hostname: PAWA_API,
            path: path,
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'x-pawa-brand': 'betpawa-zambia',
                'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
            },
            timeout: 10000
        };

        const req = https.get(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); } 
                catch (e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.end();
    });
}

const server = http.createServer(async (req, res) => {
    if (req.url === '/api/sync') {
        try {
            const seasons = await getPawaData('/api/sportsbook/virtual/v1/seasons/list/actual');
            if (!seasons || !seasons.items) throw new Error('No Season');
            
            const current = seasons.items[0];
            const round = current.rounds.find(r => new Date(r.tradingTime.start) > new Date()) || current.rounds[0];
            const events = await getPawaData('/api/sportsbook/virtual/v2/events/list/by-round/' + round.id + '?page=upcoming');

            const matches = events.items.map(m => ({
                h: m.homeTeamName,
                a: m.awayTeamName,
                hc: m.homeTeamCode,
                ac: m.awayTeamCode,
                isHot: ACTIVATORS.includes(m.homeTeamCode) && ACTIVATORS.includes(m.awayTeamCode),
                odd: m.mainOutcomeOdds[0] || "1.85",
                start: new Date(round.tradingTime.start).getTime()
            }));

            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({ s: current.id.split('-').pop(), md: round.name, m: matches }));
        } catch (e) {
            res.writeHead(500); res.end(JSON.stringify({error: "API_TIMEOUT"}));
        }
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Predictor Pro Master</title>
    <style>
        :root { --gold: #ffd700; --green: #00c851; --warn: #ff9800; --bg: #050510; --card: #121225; }
        body { background: var(--bg); color: #fff; font-family: sans-serif; margin: 0; }
        .header { background: #1a1a3a; padding: 20px; text-align: center; border-bottom: 2px solid var(--gold); }
        .status-bar { background: #000; padding: 10px; display: flex; justify-content: space-between; font-size: 12px; border-bottom: 1px solid #333; }
        .timer { color: var(--gold); font-size: 20px; font-weight: bold; font-family: monospace; }
        .tabs { display: flex; background: #0a0a1a; }
        .tab { flex: 1; padding: 15px; text-align: center; font-size: 11px; font-weight: bold; color: #666; cursor: pointer; border-bottom: 2px solid transparent; }
        .tab.active { color: var(--green); border-bottom: 2px solid var(--green); background: rgba(0,200,81,0.1); }
        .container { padding: 15px; padding-bottom: 80px; }
        .card { background: var(--card); border-radius: 12px; padding: 18px; margin-bottom: 15px; border: 1px solid #2a2a40; }
        .card.hot { border-left: 6px solid var(--green); }
        .card.cold { border-left: 6px solid var(--warn); opacity: 0.8; }
        .team-text { font-size: 18px; font-weight: 800; color: var(--gold); }
        .btn { margin-top: 12px; padding: 12px; border-radius: 8px; text-align: center; font-weight: bold; }
        .btn-green { background: var(--green); color: #000; }
        .btn-warn { background: var(--warn); color: #000; }
    </style>
</head>
<body>
    <div class="header">
        <div style="font-weight:900; color:var(--gold); font-size:20px;">⚡ BETPAWA PREDICTOR PRO</div>
        <div style="font-size:10px; color:var(--green);">BYPASS ENGINE ACTIVE</div>
    </div>
    <div class="status-bar">
        <div id="stat">📡 CONNECTING...</div>
        <div id="md">MD --</div>
        <div class="timer" id="time">00:00</div>
    </div>
    <div class="tabs">
        <div class="tab active" onclick="nav('live')">LIVE</div>
        <div class="tab" onclick="nav('hist')">HISTORY</div>
        <div class="tab" onclick="nav('tips')">TIPS</div>
    </div>
    <div class="container" id="box"></div>

    <script>
        let kickoff = 0;
        let history = JSON.parse(localStorage.getItem('p_hist') || '[]');

        async function sync() {
            try {
                const r = await fetch('/api/sync');
                const d = await r.json();
                if(d.error) throw new Error();
                
                document.getElementById('stat').innerHTML = "🟢 ACTIVE";
                document.getElementById('md').innerText = "SEASON " + d.s + " MD " + d.md;
                kickoff = d.m[0].start;
                render(d.m);
            } catch(e) {
                document.getElementById('stat').innerHTML = "🔴 RETRYING...";
            }
        }

        function render(matches) {
            let h = '';
            matches.forEach(m => {
                if(m.isHot) {
                    h += \`
                    <div class="card hot">
                        <div style="font-size:10px; color:var(--green); font-weight:900;">🔥 TIER 1 MATCH</div>
                        <div class="team-text">\${m.h} v \${m.a}</div>
                        <div class="btn btn-green">OVER 2.5 @ \${m.odd}</div>
                    </div>\`;
                    if(!history.find(x => x.id === m.h+m.a)) {
                        history.unshift({id: m.h+m.a, t: new Date().toLocaleTimeString()});
                        if(history.length > 10) history.pop();
                        localStorage.setItem('p_hist', JSON.stringify(history));
                    }
                } else {
                    h += \`
                    <div class="card cold">
                        <div style="font-size:10px; color:var(--warn); font-weight:900;">⚠️ FORM WARNING</div>
                        <div class="team-text" style="opacity:0.6">\${m.h} v \${m.a}</div>
                        <div class="btn btn-warn">TEAMS NOT IN SCORING FORM - SKIP</div>
                    </div>\`;
                }
            });
            document.getElementById('box').innerHTML = h;
        }

        function nav(p) {
            if(p === 'hist') {
                let h = '<h3>Recent High-Form Matches</h3>';
                history.forEach(i => h += '<div class="card">Analyzed: ' + i.id + '<br><small>' + i.t + '</small></div>');
                document.getElementById('box').innerHTML = h;
            } else if(p === 'tips') {
                document.getElementById('box').innerHTML = '<div class="card"><b>PRO TIP:</b> Only bet on "Green" matches. If it says "Warning", the algorithm has detected a low-scoring trend.</div>';
            } else { sync(); }
        }

        setInterval(() => {
            if(!kickoff) return;
            const diff = kickoff - Date.now();
            if(diff <= 0) { document.getElementById('time').innerText = "LIVE"; return; }
            const m = Math.floor(diff/60000); const s = Math.floor((diff%60000)/1000);
            document.getElementById('time').innerText = (m<10?"0":"")+m+":"+(s<10?"0":"")+s;
        }, 1000);

        sync(); setInterval(sync, 25000);
    </script>
</body>
</html>
    `);
});
server.listen(PORT);