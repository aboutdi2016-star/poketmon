const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { collect } = require('./integrations.cjs');
function startServer({port = 3000, host = '127.0.0.1', getCredentials = () => process.env} = {}) {
  let inFlight;
  const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/expressions.js': ['expressions.js', 'text/javascript; charset=utf-8'] };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (url.pathname === '/api/sync' && req.method === 'POST') {
      const origin = req.headers.origin;
      if ((origin && origin !== `http://${req.headers.host}`) || req.headers['content-type'] !== 'application/json') { res.writeHead(403).end(); return; }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      try { if (!inFlight) inFlight = collect(getCredentials()).finally(() => { inFlight = null; }); res.end(JSON.stringify(await inFlight)); }
      catch { res.writeHead(500).end(JSON.stringify({ error: '수집 오류가 발생했어요.' })); }
      return;
    }
    if (req.method === 'GET' && files[url.pathname]) {
      const [file, type] = files[url.pathname];
      res.setHeader('Content-Type', type);
      fs.createReadStream(path.join(__dirname, file)).pipe(res);
    } else res.writeHead(404).end('Not found');
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => resolve(server)); });
}
if (require.main === module) startServer({host: process.env.PIKA_BIND || '127.0.0.1', port: Number(process.env.PORT || 3000)}).then(() => console.log('Pika Day server started')).catch(() => { console.error('서버 시작 실패: 포트 사용 여부를 확인하세요.'); process.exitCode = 1; });
module.exports = { startServer };
