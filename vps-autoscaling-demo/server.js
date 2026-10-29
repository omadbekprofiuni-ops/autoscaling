const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const START_CAPACITY = 5;
const MAX_INSTANCES = 2;
const SLOT_PER_INSTANCE = 5;
const ACTIVE_TTL_MS = 15_000;
const users = new Map();
let instanceCount = 1;
let roundRobin = 0;
let lastEvent = 'Demo tayyor. Birinchi instance 5 ta faol foydalanuvchiga xizmat qiladi.';

function cleanUsers() {
  const cutoff = Date.now() - ACTIVE_TTL_MS;
  for (const [id, user] of users) {
    if (user.lastSeen < cutoff) users.delete(id);
  }
}

function state() {
  cleanUsers();
  const active = users.size;
  const capacity = instanceCount * SLOT_PER_INSTANCE;
  const instances = Array.from({ length: instanceCount }, (_, index) => ({
    id: `app-0${index + 1}`,
    status: 'Faol',
    users: Math.min(SLOT_PER_INSTANCE, Math.max(0, active - index * SLOT_PER_INSTANCE)),
    capacity: SLOT_PER_INSTANCE,
  }));
  return {
    activeUsers: active,
    capacity,
    instanceCount,
    instances,
    lastEvent,
    loadBalancer: 'round-robin',
    scaleThreshold: START_CAPACITY,
    updatedAt: new Date().toISOString(),
  };
}

function emit(message) {
  lastEvent = message;
  console.log(`[AUTOSCALER] ${message}`);
}

function checkScale() {
  const active = users.size;
  if (active > START_CAPACITY && instanceCount === 1) {
    instanceCount = MAX_INSTANCES;
    emit(`Faol foydalanuvchi ${active} ta bo‘ldi. Sig‘im 5 → 10, instance 1 → 2.`);
  }
}

function routeRequest() {
  const target = `app-0${(roundRobin++ % instanceCount) + 1}`;
  return target;
}

function sendJson(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(value));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 16_384) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const publicDir = path.join(__dirname, 'public');
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname.startsWith('/api/')) {
    const routedTo = routeRequest();
    if (req.method === 'GET' && url.pathname === '/api/state') {
      return sendJson(res, 200, { ...state(), routedTo });
    }
    if (req.method === 'POST' && url.pathname === '/api/join') {
      try {
        const { id, label = 'Brauzer foydalanuvchisi', kind = 'browser' } = await readBody(req);
        const userId = String(id || randomUUID()).slice(0, 100);
        users.set(userId, { label: String(label).slice(0, 60), kind, lastSeen: Date.now() });
        checkScale();
        console.log(`[LOAD BALANCER] So‘rov ${routedTo} ga yuborildi; faol: ${users.size}/${instanceCount * SLOT_PER_INSTANCE}`);
        return sendJson(res, 200, { ...state(), userId, routedTo });
      } catch (error) {
        return sendJson(res, 400, { error: error.message });
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/heartbeat') {
      try {
        const { id, label = 'Brauzer foydalanuvchisi' } = await readBody(req);
        const userId = String(id).slice(0, 100);
        const user = users.get(userId);
        if (user) user.lastSeen = Date.now();
        else users.set(userId, { label: String(label).slice(0, 60), kind: 'browser', lastSeen: Date.now() });
        checkScale();
        return sendJson(res, 200, { ...state(), routedTo });
      } catch (error) {
        return sendJson(res, 400, { error: error.message });
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/leave') {
      try {
        const { id } = await readBody(req);
        users.delete(String(id));
        console.log(`[LOAD BALANCER] Foydalanuvchi chiqdi; faol: ${users.size}/${instanceCount * SLOT_PER_INSTANCE}`);
        return sendJson(res, 200, state());
      } catch (error) {
        return sendJson(res, 400, { error: error.message });
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/demo/add') {
      try {
        const { label } = await readBody(req);
        const id = `demo-${randomUUID()}`;
        users.set(id, { label: String(label || `Sinov foydalanuvchisi ${users.size + 1}`).slice(0, 60), kind: 'demo', lastSeen: Date.now() });
        checkScale();
        console.log(`[LOAD BALANCER] ${label || id} → ${routedTo}; faol: ${users.size}/${instanceCount * SLOT_PER_INSTANCE}`);
        return sendJson(res, 200, { ...state(), userId: id, routedTo });
      } catch (error) {
        return sendJson(res, 400, { error: error.message });
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/demo/reset') {
      users.clear();
      instanceCount = 1;
      roundRobin = 0;
      emit('Demo qayta tiklandi. 1 instance, 5 slot.');
      return sendJson(res, 200, state());
    }
    return sendJson(res, 404, { error: 'API topilmadi' });
  }

  const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const file = path.resolve(publicDir, requested);
  if (!file.startsWith(`${publicDir}${path.sep}`)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404).end('Not found');
      return;
    }
    const type = file.endsWith('.css') ? 'text/css; charset=utf-8'
      : file.endsWith('.js') ? 'text/javascript; charset=utf-8'
        : 'text/html; charset=utf-8';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Demo server http://0.0.0.0:${PORT} da ishga tushdi`);
  console.log('[LOAD BALANCER] Round-robin so‘rov taqsimoti yoqildi.');
  console.log('[AUTOSCALER] Boshlang‘ich holat: 1 instance × 5 slot = 5 faol foydalanuvchi.');
});
