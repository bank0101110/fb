# IDScout — หาสินค้า + ติดตามความนิยมจากกลุ่ม Facebook

Next.js 16 · Prisma 7 · Supabase (Postgres) · deploy บน Vercel · ใช้ผ่านมือถือได้ (เพิ่มลงหน้าจอโฮมได้)

## ติดตั้งครั้งแรก

### 1. Supabase — สร้างฐานข้อมูล
1. supabase.com → New project (Region แนะนำ **Southeast Asia (Singapore)**) ตั้งรหัสผ่าน database แล้วจดไว้
2. หน้าโปรเจกต์ → ปุ่ม **Connect** → แท็บ ORMs เลือก **Prisma** จะได้ 2 ค่า
   - `DATABASE_URL` = Transaction pooler (port **6543**, มี `?pgbouncer=true`)
   - `DIRECT_URL` = Session pooler (port **5432**)
   แทน `[YOUR-PASSWORD]` ด้วยรหัสผ่านจากข้อ 1

### 2. ในเครื่อง — ย้ายข้อมูลเดิมขึ้นฐานข้อมูล
```bash
cp .env.example .env        # แล้วใส่ DATABASE_URL, DIRECT_URL ในไฟล์ .env
npm install                 # จะ prisma generate ให้เอง
npm run db:migrate          # สร้างตารางใน Supabase
npm run db:import           # ย้าย data/ (กลุ่ม สินค้า ผลค้นหา ฯลฯ) เข้า Supabase
npm run dev                 # ลองเปิด http://localhost:3000 (ในเครื่องไม่ตั้งรหัสผ่านก็เข้าได้)
```
`.env` ไม่ถูก commit (อยู่ใน .gitignore) ห้ามใส่รหัสลง git

### 3. GitHub
push โปรเจกต์นี้ขึ้น repo (แนะนำ **Private**) — `node_modules`, `.next`, `lib/generated`, `.env` ถูก ignore ไว้แล้ว

### 4. Vercel — deploy
1. vercel.com → Add New → Project → Import repo จากข้อ 3 (Framework: Next.js ค่าอื่นไม่ต้องแก้)
2. ก่อนกด Deploy เปิด **Environment Variables** ใส่ 4–5 ค่า:
   | ชื่อ | ค่า |
   |---|---|
   | `DATABASE_URL` | จาก Supabase (port 6543) |
   | `DIRECT_URL` | จาก Supabase (port 5432) |
   | `APP_PASSWORD` | รหัสผ่านเข้าเว็บ (ตั้งเอง) |
   | `AUTH_SECRET` | ข้อความสุ่มยาว ๆ เช่นจาก `openssl rand -hex 32` |
   | `INGEST_TOKEN` | (ไม่บังคับ) ใช้เรียก API จากสคริปต์ |
3. Deploy — ตอน build จะรัน `prisma migrate deploy` ให้เอง
4. เปิดเว็บบนมือถือ → login → เมนูเบราว์เซอร์ "เพิ่มลงหน้าจอโฮม" จะได้ไอคอนแบบแอป

เปลี่ยน `APP_PASSWORD` หรือ `AUTH_SECRET` เมื่อไหร่ ทุกเครื่องที่ login ไว้จะถูกออกจากระบบ

## โครงสร้าง
```
app/(main)/        หน้าเว็บหลัก: ภาพรวมตลาด, ผลค้นหา, สินค้า, กลุ่ม, รายการติดตาม, ตั้งค่า
app/login/         หน้า login (รหัสเดียว)
app/api/plan       GET  → กลุ่มที่ถึงรอบอ่าน, งบโพสต์, จุดหยุด
app/api/ingest     POST → รับผลอ่านกลุ่ม (JSON หรือ JSON Lines) บันทึก + คัดผล
proxy.ts           กันทุกหน้าด้วย login (API รับ Bearer INGEST_TOKEN ได้ด้วย)
lib/scan.ts        logic plan/ingest (แทน fbscan.py เดิม)
lib/stats.ts       ตัวเลข dashboard
lib/store.ts       อ่าน/เขียนฐานข้อมูลผ่าน Prisma
prisma/            schema + migration
scripts/import-local.ts   ย้าย data/ เดิมเข้าฐานข้อมูล
data/              ข้อมูลรุ่นไฟล์เดิม (ใช้แค่ตอน import)
```

## PLAYBOOK สำหรับ Claude ("รัน fb")
1. เปิดเว็บ IDScout (URL ของ Vercel) ในเบราว์เซอร์ของแอป Claude — ผู้ใช้ login ไว้แล้ว
2. `fetch('/api/plan').then(r=>r.json())` → run_id, due_groups (feed_url, max_posts, stop_at_post_ids), cutoff
3. เปิด Facebook ทีละกลุ่มใน due_groups (feed เรียงโพสต์ใหม่) อ่านด้วยสคริปต์ในหน้า ทำแค่อ่าน
   ต้องให้หน้าต่างแอปมองเห็นบนจอ ไม่งั้น Facebook ไม่โหลดโพสต์เพิ่ม
4. กลับมาหน้า IDScout แล้ว `fetch('/api/ingest',{method:'POST',body:JSON.stringify({run_id, posts, meta})})`
   - post: `{post_id, group, url, author, author_url, posted_at, kind: sell|buy|sold|other, game, items[], attrs[], price, comments, text, matches:[{product, fit, price?, has[], missing[], nice_found[], flags[], note}]}`
   - `matches[].price` ใช้เมื่อโพสต์เดียวมีหลายสินค้าคนละราคา
   - โพสต์เดิมที่ตอนนี้ขึ้นว่าขายแล้ว ส่ง `kind:"sold"` → บันทึกเวลาที่ขายออก
5. สรุปให้ผู้ใช้: ผลใหม่ต่อสินค้า + ลิงก์ (ดูได้ที่หน้า "ผลค้นหาสินค้า")
