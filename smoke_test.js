const { spawn } = require('child_process');
const http = require('http');

async function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log("Starting agent...");
  const agent = spawn('npm', ['run', 'start'], {
    cwd: './agent',
    env: { ...process.env, PORT: '3001' },
    detached: true
  });

  const cleanup = () => {
    console.log("Cleaning up...");
    try { process.kill(-agent.pid); } catch (e) {}
  };

  try {
    // Wait for health check
    let healthy = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await request('http://localhost:3001/api/health');
        if (res.statusCode === 200) { healthy = true; break; }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!healthy) throw new Error("Agent health check failed");

    const samples = [
      { lat: 10, lon: 10, sogKnots: 10, cogDeg: 90, satelliteCount: 10, source: 'gnss', timestamp: Date.now() - 2000 },
      { lat: 10.001, lon: 10.001, sogKnots: 10, cogDeg: 90, satelliteCount: 2, source: 'gnss', timestamp: Date.now() - 1000 }, // Sat drop
      { lat: 20, lon: 20, sogKnots: 10, cogDeg: 270, satelliteCount: 10, source: 'gnss', timestamp: Date.now() } // Jump + Heading mismatch
    ];

    console.log("Sending samples...");
    for (const s of samples) {
      await request('http://localhost:3001/api/maritime/gnss-sample', { method: 'POST', headers: { 'Content-Type': 'application/json' } }, s);
    }

    console.log("Refreshing risk...");
    const riskRes = await request('http://localhost:3001/api/maritime/risk?refresh=1');
    
    console.log("Fetching alerts...");
    const alertsRes = await request('http://localhost:3001/api/alerts');
    const alerts = JSON.parse(alertsRes.body);
    const filtered = alerts.filter(a => a.title.includes('GNSS') || a.title.includes('Edge'));

    const summary = {
      healthStatus: 200,
      riskStatusCode: riskRes.statusCode,
      alertsCount: alerts.length,
      filteredAlerts: filtered.map(a => a.title),
      anomalyKindsCount: filtered.length
    };
    console.log(JSON.stringify(summary, null, 2));

  } catch (err) {
    console.error("Test failed:", err.message);
  } finally {
    cleanup();
  }
}

run();
