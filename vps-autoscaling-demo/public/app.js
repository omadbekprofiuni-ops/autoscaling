const $ = (id) => document.getElementById(id);
const logList = $('log-list');
let snapshot = null;
let demoIds = [];
let firstSync = true;
const browserId = sessionStorage.getItem('infralab-browser-id') || `browser-${crypto.randomUUID()}`;
sessionStorage.setItem('infralab-browser-id', browserId);

function addLog(type, message, time = new Date()) {
  const empty = logList.querySelector('.log-empty');
  if (empty) empty.remove();
  const row = document.createElement('div');
  row.className = `log-row ${type}`;
  const icon = type === 'scale' ? '↗' : type === 'route' ? '⇄' : '•';
  row.innerHTML = `<span class="log-icon">${icon}</span><span class="log-message"></span><time></time>`;
  row.querySelector('.log-message').textContent = message;
  row.querySelector('time').textContent = time.toLocaleTimeString('uz-UZ', { hour12: false });
  logList.prepend(row);
  while (logList.children.length > 7) logList.lastElementChild.remove();
}

function percent(n) { return Math.max(0, Math.min(100, Math.round((n / 5) * 100))); }

function render(data) {
  const oldInstances = snapshot?.instanceCount ?? 1;
  const oldCount = snapshot?.activeUsers ?? 0;
  snapshot = data;
  const active = data.activeUsers;
  $('active').textContent = active;
  $('capacity-label').textContent = `/ ${data.capacity}`;
  $('top-user-count').textContent = active;
  $('instance-count').textContent = data.instanceCount;
  $('control-count').innerHTML = `${active} <small>/ ${data.capacity}</small>`;
  $('meter-fill').style.width = `${data.capacity ? Math.min(100, active / data.capacity * 100) : 0}%`;
  $('percent').textContent = `${data.capacity ? Math.round(active / data.capacity * 100) : 0}%`;
  $('load-text').textContent = active >= data.capacity ? 'Sig‘im to‘ldi' : 'Sig‘im ichida';
  const twoOn = data.instanceCount > 1;
  $('pip-two').classList.toggle('on', twoOn);
  $('instance-state').textContent = twoOn ? 'Kengaytirilgan holat' : 'Minimal holat';
  $('scale-state').textContent = twoOn ? 'Kengaydi' : 'Faol';
  $('instance-two').classList.toggle('sleeping', !twoOn);
  $('status-two').textContent = twoOn ? 'Faol' : 'Kutilmoqda';
  $('branch-two').classList.toggle('branch-on', twoOn);
  const one = data.instances[0]?.users || 0;
  const two = data.instances[1]?.users || 0;
  $('users-one').textContent = one;
  $('users-two').textContent = two;
  $('bar-one').style.width = `${percent(one)}%`;
  $('bar-two').style.width = `${percent(two)}%`;
  $('percent-one').textContent = `${percent(one)}%`;
  $('percent-two').textContent = twoOn ? `${percent(two)}%` : '—';
  $('control-count').querySelector('small').textContent = `/ ${data.capacity}`;
  if (!firstSync && oldInstances === 1 && twoOn) addLog('scale', 'Autoscaler: 2-instance rejimi yoqildi · sig‘im 5 → 10');
  if (!firstSync && active > oldCount && data.routedTo) addLog('route', `Load balancer → ${data.routedTo} · faol ulanish ${active}/${data.capacity}`);
  firstSync = false;
}

async function api(path, body) {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(`Server javobi: ${response.status}`);
  return response.json();
}

async function refresh() {
  try { render(await api('/api/state')); }
  catch { $('load-text').textContent = 'Server bilan aloqa uzildi'; }
}

async function heartbeat() {
  try {
    const data = await api('/api/heartbeat', { id: browserId, label: 'Brauzer tashrifchisi' });
    render(data);
  } catch { /* The next heartbeat retries after a temporary connection problem. */ }
}

$('add-user').addEventListener('click', async () => {
  $('add-user').disabled = true;
  try {
    const data = await api('/api/demo/add', { label: `Brauzer demo ${Date.now().toString().slice(-4)}` });
    demoIds.push(data.userId);
    render(data);
    addLog('route', `Yangi demo ulanishi → ${data.routedTo} · jami ${data.activeUsers} foydalanuvchi`);
  } catch { addLog('error', 'Serverga ulanib bo‘lmadi. Sahifani yangilang.'); }
  finally { $('add-user').disabled = false; }
});

$('remove-user').addEventListener('click', async () => {
  const id = demoIds.pop();
  if (!id) return addLog('info', 'O‘chirish uchun shu brauzerdan qo‘shilgan demo foydalanuvchi yo‘q.');
  try { render(await api('/api/leave', { id })); }
  catch { addLog('error', 'Foydalanuvchini chiqarib bo‘lmadi.'); }
});

$('reset-demo').addEventListener('click', async () => {
  try {
    demoIds = [];
    firstSync = true;
    render(await api('/api/demo/reset', {}));
    logList.innerHTML = '<div class="log-empty">Demo qayta boshlandi. Birinchi foydalanuvchini qo‘shing.</div>';
    firstSync = false;
    addLog('info', 'Demo qayta boshlandi · 1 instance · sig‘im 5');
  } catch { addLog('error', 'Demoni qayta boshlash amalga oshmadi.'); }
});

$('clear-log').addEventListener('click', () => { logList.innerHTML = '<div class="log-empty">Jurnal tozalandi.</div>'; });
setInterval(() => { $('clock').textContent = new Date().toLocaleTimeString('uz-UZ', { hour12: false }); }, 1000);
heartbeat();
setInterval(heartbeat, 4000);
setInterval(refresh, 1200);
window.addEventListener('pagehide', () => {
  navigator.sendBeacon('/api/leave', new Blob([JSON.stringify({ id: browserId })], { type: 'application/json' }));
});
