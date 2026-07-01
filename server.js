const http = require('http');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const PORT = parseInt(process.env.PORT || process.argv[2]) || 3000;
const DB_PATH = path.join(__dirname, 'data', 'une.db');

// Ensure data dir exists
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS readings (
    id TEXT PRIMARY KEY,
    reading REAL NOT NULL,
    date TEXT NOT NULL,
    time TEXT DEFAULT '',
    photo TEXT,
    meter INTEGER DEFAULT 0,
    tariffs TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );
  CREATE TABLE IF NOT EXISTS equipment (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    watts REAL NOT NULL,
    hours REAL NOT NULL,
    meter INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS blackouts (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    metroId INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Prepared statements
const stmts = {
  getAll: (table) => db.prepare(`SELECT * FROM ${table}`),
  upsertReading: db.prepare(`INSERT OR REPLACE INTO readings (id,reading,date,time,photo,meter,tariffs,createdAt,updatedAt) VALUES (@id,@reading,@date,@time,@photo,@meter,@tariffs,@createdAt,@updatedAt)`),
  upsertEquipment: db.prepare(`INSERT OR REPLACE INTO equipment (id,name,watts,hours,meter) VALUES (@id,@name,@watts,@hours,@meter)`),
  upsertBlackout: db.prepare(`INSERT OR REPLACE INTO blackouts (id,tipo,timestamp,metroId) VALUES (@id,@tipo,@timestamp,@metroId)`),
  upsertConfig: db.prepare(`INSERT OR REPLACE INTO config (key,value) VALUES (@key,@value)`),
  deleteFrom: (table) => db.prepare(`DELETE FROM ${table} WHERE id = ?`),
};

// MIME types
const MIME = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.ico':'image/x-icon' };

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const TABLES = ['readings', 'equipment', 'blackouts', 'config'];

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end(); return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // API routes: /api/{table}
  const apiMatch = url.pathname.match(/^\/api\/(readings|equipment|blackouts|config)(?:\/(.+))?$/);
  if (apiMatch) {
    const [, table, id] = apiMatch;

    if (req.method === 'GET') {
      const rows = stmts.getAll(table).all();
      const data = table === 'config'
        ? rows.map(r => ({ key: r.key, value: JSON.parse(r.value) }))
        : rows.map(r => table === 'readings' && r.tariffs ? { ...r, tariffs: JSON.parse(r.tariffs) } : r);
      return json(res, data);
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      if (!body) return json(res, { error: 'Invalid JSON' }, 400);

      // Bulk sync support
      const items = Array.isArray(body) ? body : [body];
      const upsert = db.transaction((rows) => {
        for (const row of rows) {
          if (table === 'config') {
            stmts.upsertConfig.run({ key: row.key, value: JSON.stringify(row.value) });
          } else if (table === 'readings') {
            stmts.upsertReading.run({ ...row, id: String(row.id), tariffs: row.tariffs ? JSON.stringify(row.tariffs) : null });
          } else if (table === 'equipment') {
            stmts.upsertEquipment.run({ ...row, id: String(row.id) });
          } else if (table === 'blackouts') {
            stmts.upsertBlackout.run({ ...row, id: String(row.id) });
          }
        }
      });
      upsert(items);
      return json(res, { ok: true, count: items.length });
    }

    if (req.method === 'DELETE' && id) {
      stmts.deleteFrom(table).run(id);
      return json(res, { ok: true });
    }
  }

  // Full sync endpoint
  if (url.pathname === '/api/sync' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body) return json(res, { error: 'Invalid JSON' }, 400);
    const sync = db.transaction(() => {
      if (body.readings) for (const r of body.readings) stmts.upsertReading.run({ ...r, id: String(r.id), tariffs: r.tariffs ? JSON.stringify(r.tariffs) : null });
      if (body.equipment) for (const e of body.equipment) stmts.upsertEquipment.run({ ...e, id: String(e.id) });
      if (body.blackouts) for (const b of body.blackouts) stmts.upsertBlackout.run({ ...b, id: String(b.id) });
      if (body.config) for (const c of body.config) stmts.upsertConfig.run({ key: c.key, value: JSON.stringify(c.value) });
    });
    sync();
    return json(res, { ok: true });
  }

  if (url.pathname === '/api/sync' && req.method === 'GET') {
    const data = {
      readings: stmts.getAll('readings').all().map(r => ({ ...r, tariffs: r.tariffs ? JSON.parse(r.tariffs) : null })),
      equipment: stmts.getAll('equipment').all(),
      blackouts: stmts.getAll('blackouts').all(),
      config: stmts.getAll('config').all().map(r => ({ key: r.key, value: JSON.parse(r.value) })),
    };
    return json(res, data);
  }

  // Static files
  serveStatic(req, res);
});

server.listen(PORT, () => console.log(`UNE server running at http://localhost:${PORT}`));

// Graceful shutdown: checkpoint WAL so data persists
function shutdown() {
  console.log('Cerrando servidor y guardando datos...');
  try { db.pragma('wal_checkpoint(TRUNCATE)'); db.close(); } catch (e) {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);
