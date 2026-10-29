const BASE = process.env.DEMO_URL || 'http://localhost:8080';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(path, body = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

async function main() {
  console.log(`VPS demo: ${BASE}`);
  const state = await post('/api/demo/reset');
  console.log(`Boshlanish: ${state.activeUsers} foydalanuvchi | ${state.instanceCount} instance | sig‘im ${state.capacity}`);
  for (let i = 1; i <= 6; i += 1) {
    const current = await post('/api/demo/add', { label: `Terminal sinovi ${i}` });
    console.log(`${i}-foydalanuvchi: ${current.activeUsers}/${current.capacity} | ${current.instanceCount} instance${i === 6 ? '  ← AUTOSCALE!' : ''}`);
    if (i === 5) console.log('Chegara: keyingi (6-) foydalanuvchi kelganda ikkinchi instance yoqiladi.');
    await pause(450);
  }
  console.log('\nTayyor. Brauzerda ham 6 foydalanuvchi va 10 sig‘im ko‘rinadi.');
  console.log('Demo holatini tozalash: curl -X POST ' + BASE + '/api/demo/reset');
  console.log('Sinov foydalanuvchilari faol holda qoladi; dars tugagach yuqoridagi tozalash buyrug‘ini bajaring.');
}

main().catch((error) => {
  console.error(`Demo ulan olmadi: ${error.message}`);
  console.error('Avval saytni ishga tushiring. Masalan: docker compose up -d --build');
  process.exitCode = 1;
});
