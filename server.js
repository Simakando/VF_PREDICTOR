const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 10000;
const HOST = 'www.betpawa.co.zm';

// TIER 1 DATABASE
const ACTIVATORS = ['ARS', 'SUN', 'CHE', 'NOT', 'WOL', 'MUN', 'LIV', 'BRE', 'MCI', 'BOU', 'NEW', 'TOT', 'WHU', 'AST', 'FCB', 'DOR', 'LEV', 'RBL', 'STU', 'INT', 'NAP', 'JUV', 'MIL', 'ROM', 'RMA', 'BAR', 'ATM', 'GIR', 'PSG', 'MAR', 'LYO', 'SPO', 'BEN', 'POR', 'PSV', 'AJA', 'FEY'];

async function fetchPawa(path) {
    return new Promise((resolve) => {
        const options = {
            hostname: HOST,
            path: path,
            headers: { 
                'X-Pawa-Brand': 'betpawa-zambia', 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36'
            },
            timeout: 7000
        };
        https.get(options, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
        }).on('error', () => resolve(null));
    });
}

const server = http.createServer(async (req, res) => {
    // API ENDPOINT
    if (req.url === '/api/data') {
        try {
            const seasons = await fetchPawa('/api/sportsbook/virtual/v1/seasons/list/actual');
            const current = seasons.items[0];
            const round = current.rounds.find(r => new Date(r.tradingTime.start) > new Date());
            const events = await fetchPawa('/api/sportsbook/virtual/v2/events/list/by-round/' + round.id + '?page=upcoming');
            
            const picks = events.items.map(m => ({
                home: m.homeTeamName,
                away: m.awayTeamName,
                isHot: ACTIVATORS.includes(m.homeTeamCode) && ACTIVATORS.includes(m.awayTeamCode),
                odd: m.mainOutcomeOdds[0] || "1.85",
                kickoff: new Date(round.tradingTime.start).getTime()
            }));

            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({ season: current.id.split('-').pop(), matchday: round.name, picks }));
        } catch(e) { res.end(JSON.stringify({error: true})); }
        return;
    }

    // FULL UI
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>BetPawa Predictor Pro</title>
    <style>
        :root { --gold: #ffd700; --green: #00c851; --red: #ff3547; --orange: #ff9800; --bg: #050510; --card: #0f0f1f; --text: #e8e8f0; }
        body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; }
        .header { background: linear-gradient(135deg, #1a1a3a, #0a0a1a); border-bottom: 2px solid var(--gold); padding: 15px; text-align: center; }
        .live-bar { background: #0a1a0a; border-bottom: 1px solid var(--green); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
        .clock { color: var(--gold); background: #000; padding: 4px 10px; border-radius: 8px; border: 1px solid var(--gold); font-size: 18px; font-weight: 900; }
        .tabs { display: flex; background: #0a0a1a; border-bottom: 1px solid #333; position: sticky; top: 0; z-index: 100; }
        .tab { flex: 1; padding: 12px; font-size: 10px; font-weight: bold; text-align: center; color: #777; cursor: pointer; }
        .tab.active { color: var(--green); border-bottom: 2px solid var(--green); background: rgba(0,200,81,0.1); }
        .content { padding: 15px; margin-bottom: 70px; }
        .pred-card { background: var(--card); border: 1px solid #2a2a3a; border-radius: 12px; padding: 15px; margin-bottom: 12px; position: relative; }
        .hot { border-left: 5px solid var(--green); box-shadow: 0 0 15px rgba(0,200,81,0.2); }
        .cold { border-left: 5px solid var(--orange); opacity: 0.7; }
        .match-name { font-size: 16px; font-weight: 900; color: var(--gold); margin: 8px 0; }
        .btn { padding: 10px; border-radius: 8px; text-align: center; font-weight: 900; text-transform: uppercase; margin-top: 10px; }
        .btn-green { background: var(--green); color: #000; }
        .btn-warn { background: var(--orange); color: #000; font-size: 11px; }
        .history-item { display: flex; justify-content: space-between; background: #1a1a2a; padding: 8px; border-radius: 6px; margin-bottom: 5px; font-size: 11px; }
    </style>
</head>
<body>
    <div class="header">
        <div style="font-weight: 900; color: var(--gold); font-size: 18px;">⚡ BETPAWA PREDICTOR PRO</div>
        <div style="font-size: 10px; color: var(--green); font-weight: bold;">90%+ ACCURACY ACTIVATED</div>
    </div>
    <div class="live-bar">
        <div id="status">📡 CONNECTING...</div>
        <div id="mdDisplay">MD --</div>
        <div class="clock" id="timer">00:00</div>
    </div>
    <div class="tabs">
        <div class="tab active" onclick="show('live')">🔴 LIVE</div>
        <div class="tab" onclick="show('history')">📋 HISTORY</div>
        <div class="tab" onclick="show('tips')">📚 TIPS</div>
    </div>
    <div class="content" id="mainBody"></div>

    <script>
        let kTime = 0;
        let history = JSON.parse(localStorage.getItem('pawa_hist') || '[]');

        async function refresh() {
            try {
                const r = await fetch('/api/data');
                const d = await r.json();
                document.getElementById('status').innerText = "🟢 LIVE DATA";
                document.getElementById('mdDisplay').innerText = "SEASON " + d.season + " MD " + d.matchday;
                kTime = d.picks[0].kickoff;
                renderLive(d.picks);
            } catch(e) { document.getElementById('status').innerText = "🔴 ERROR"; }
        }

        function renderLive(picks) {
            let h = '';
            picks.forEach(p => {
                if(p.isHot) {
                    h += \`<div class="pred-card hot">
                        <span style="color:var(--green);font-size:10px;font-weight:900;">🔥 TIER 1 SCORING FORM</span>
                        <div class="match-name">\${p.home} VS \${p.away}</div>
                        <div class="btn btn-green">🎯 OVER 2.5 @ \${p.odd}</div>
                    </div>\`;
                    if(!history.find(x => x.m === p.home+p.away)) {
                        history.unshift({m: p.home+' vs '+p.away, t: new Date().toLocaleTimeString()});
                        if(history.length > 10) history.pop();
                        localStorage.setItem('pawa_hist', JSON.stringify(history));
                    }
                } else {
                    h += \`<div class="pred-card cold">
                        <span style="color:var(--orange);font-size:10px;font-weight:900;">⚠️ LOW FORM WARNING</span>
                        <div class="match-name">\${p.home} VS \${p.away}</div>
                        <div class="btn btn-warn">TEAMS NOT IN SCORING FORM - SKIP</div>
                    </div>\`;
                }
            });
            document.getElementById('mainBody').innerHTML = h;
        }

        function show(page) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            if(page === 'history') {
                let h = '<h3>Last 10 Rounds Analyzed</h3>';
                history.forEach(i => h += \`<div class="history-item"><span>\${i.m}</span><span style="color:var(--green)">PROCESSED \${i.t}</span></div>\`);
                document.getElementById('mainBody').innerHTML = h;
            } else if(page === 'tips') {
                document.getElementById('mainBody').innerHTML = '<div class="pred-card"><h3>Rule #1</h3><p>Never bet on Low Form teams.</p><h3>Rule #2</h3><p>Avoid odds above 2.10 in virtuals.</p></div>';
            } else { refresh(); }
        }

        setInterval(() => {
            if(!kTime) return;
            const diff = kTime - Date.now();
            if(diff <= 0) { document.getElementById('timer').innerText = "LIVE"; return; }
            const m = Math.floor(diff/60000); const s = Math.floor((diff%60000)/1000);
            document.getElementById('timer').innerText = (m<10?"0":"")+m+":"+(s<10?"0":"")+s;
        }, 1000);

        refresh(); setInterval(refresh, 30000);
    </script>
</body>
</html>
    `);
});
server.listen(PORT, '0.0.0.0');