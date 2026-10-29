# VPS autoscaling: sinf uchun mini demo

Bu demo bir VPS ichida ishlaydi. Brauzerda faol ulanishlar va sig‘im ko‘rinadi: boshlanishida **1 app instance × 5 slot = 5**. Oltinchi faol foydalanuvchi qo‘shilganda autoscaler **2 instance × 5 slot = 10** holatiga o‘tadi. Terminal demo skripti shu jarayonni bosqichma-bosqich ko‘rsatadi.

## Ubuntu VPS’da ishga tushirish

VPS’da Ubuntu 22.04 yoki 24.04 va ochiq TCP `8080` porti kerak. SSH orqali ulaning. Docker o‘rnatilmagan bo‘lsa, rasmiy qulay o‘rnatish skriptidan foydalaning:

```bash
sudo apt update
sudo apt install -y curl
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

Guruh ruxsati yangilanishi uchun SSH’dan chiqib qayta kiring, so‘ng tekshiring:

```bash
docker --version
docker compose version
```

Loyihani VPS’ga olib boring. O‘zingizning Git repozitoriyingiz bo‘lsa, clone qiling:

```bash
git clone <REPO_URL> vps-autoscaling-demo
cd vps-autoscaling-demo
```

Yoki loyiha fayllarini `scp` bilan yuboring. Kompyuteringizdagi loyiha papkasidan:

```bash
scp -r . <VPS_USER>@<VPS_IP>:~/vps-autoscaling-demo
```

VPS’da konteynerni qurib ishga tushiring:

```bash
cd ~/vps-autoscaling-demo
docker compose up -d --build
docker compose ps
```

VPS firewall’da TCP `8080` portini ruxsatlayın (cloud provider security group/firewall’da ham):

```bash
sudo ufw allow 8080/tcp
```

Brauzerda oching: `http://<VPS_IP>:8080`

## Dars paytidagi terminal demo

Ikkinchi terminal oynasida VPS’ga SSH qiling va loyiha papkasida bajaring:

```bash
cd ~/vps-autoscaling-demo
docker compose exec -e DEMO_URL=http://localhost:3000 demo node demo.js
```

Terminal har bir ulanishni ko‘rsatadi. Oltinchi ulanishda `sig‘im 5 → 10, instance 1 → 2` xabari chiqadi. Brauzer sahifasi avtomatik yangilanib, ikkinchi app instance’ni ko‘rsatadi. Terminalda server jurnalini ko‘rish:

```bash
docker compose logs -f demo
```

Demo holatini tozalab, 1 instance / 5 slot holatidan boshlash:

```bash
docker compose exec demo node -e "fetch('http://localhost:3000/api/demo/reset',{method:'POST'}).then(r=>r.json()).then(console.log)"
```

Brauzer boshqaruvlari bilan sinash uchun faol foydalanuvchi sonini 6 taga yetkazing. Saytni ochgan har bir brauzerning o‘zi ham 1 faol ulanish hisoblanadi, shuning uchun demo tugmasini 6 marta emas, kerakli umumiy songacha bosing. “Bittasini chiqarish” shu brauzer qo‘shgan demo ulanishlarini olib tashlaydi. Har bir ulanish 15 soniyada yangilanmasa faol hisobdan chiqadi.

## Ishni to‘xtatish va yangilash

```bash
docker compose down
```

Kod o‘zgargandan so‘ng qayta qurish:

```bash
docker compose up -d --build
```

## Bu demo nimani isbotlaydi (va nimani isbotlamaydi)

- Bu o‘quv simulyatsiyasi: foydalanuvchi ulanishlari hisoblanadi; 5 yoki 10 — o‘rnatilgan haqiqiy limit emas, demo sig‘im modeli.
- Load balancer app instance’lar orasida round-robin usulida so‘rovni yo‘naltiradi. Autoscaler 6-ulanishda ikkinchi **mantiqiy app instance**-ni faollashtiradi.
- App instance/VPS konteyneri — ilovaning nusxasi. Bu demo ikkinchi nusxani mantiqan ko‘rsatadi; u alohida VPS resurslarini (CPU, RAM) avtomatik ko‘paytirmaydi. Ikkala instance bitta VPS va bitta konteyner jarayoni ichida modellashtirilgan.
- Production muhitida bir nechta serverga haqiqiy autoscaling uchun tashqi load balancer, har bir serverda alohida app process/container, umumiy session/storage, health check va cloud API yoki orchestration platformasi kerak. CPU/RAM ko‘payishi uchun VPS planini oshirish yoki qo‘shimcha VPS yaratish kerak.
- `docker compose exec demo node demo.js` buyrug‘ini bir marta bajaring: demo foydalanuvchilari tugagach o‘zi avtomatik chiqib ketmaydi; holatni reset buyrug‘i bilan tozalang.
