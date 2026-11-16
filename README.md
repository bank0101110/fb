# IDScout — หาสินค้า + ติดตามความนิยมจากกลุ่ม Facebook

เว็บ Next.js ที่รันบนเครื่องตัวเอง ไม่มีฐานข้อมูล ข้อมูลทั้งหมดเป็นไฟล์ใน `data/` (commit ขึ้น git ได้ ย้ายเครื่องแล้วข้อมูลตามไปด้วย)

## เริ่มใช้

```bash
npm install
npm run dev        # http://localhost:3000
# หรือ production: npm run build && npm start
```

ต้องการ Node 20+ · ใช้โฟลเดอร์ข้อมูลอื่นได้ด้วย `FB_DATA_DIR=/path/to/data npm run dev`

## หน้าเว็บ
| หน้า | ทำอะไร | ไฟล์ |
|---|---|---|
| ภาพรวมตลาด `/` | dashboard แยกตามเกม: ตามหา vs ขาย, ราคากลาง, อันดับสินค้า, รายละเอียดสินค้า | อ่าน `log/`, `state/`, `results/` |
| ผลค้นหาสินค้า `/results` | โพสต์ที่ตรงกับสินค้าที่ต้องการ แยกตามรอบ | `results/*_matches.json` |
| สินค้าที่ต้องการ `/wanted` | เพิ่ม/แก้สินค้า + อัปโหลดรูปอ้างอิง | `wanted.json`, `images/<id>/` |
| กลุ่ม Facebook `/groups` | ลิงก์กลุ่ม + สถานะ tier | `groups.json` |
| รายการติดตาม `/market` | ของที่ติดตามความนิยม + ของที่ Claude เจอเอง | `market.json` |
| ตั้งค่า `/settings` | งบโพสต์, อายุโพสต์, tier ฯลฯ | `config.json` |

## โครงสร้าง data/
```
data/
  config.json  groups.json  wanted.json  market.json   ← แก้ผ่านเว็บ
  images/<product_id>/                                  ← รูปอ้างอิง
  state/groups_state.json  state/seen_posts.json        ← สคริปต์เขียน
  log/market_log.jsonl                                  ← ทุกโพสต์ที่อ่าน (append-only)
  runs/<run_id>/posts.jsonl                             ← ที่ Claude สกัดแต่ละรอบ
  results/<run_id>_matches.{csv,json}  market_*.csv     ← ผลลัพธ์
```

## PLAYBOOK สำหรับ Claude ("รัน fb")
1. stage `data/` (ยกเว้น images ถ้าไม่จำเป็น) + `scripts/fbscan.py` เข้า workspace
2. `python3 -I scripts/fbscan.py --root <data> plan` → run_id, due_groups, stop_at_post_ids, cutoff
3. เบราว์เซอร์ในแอป: ต่อกลุ่มเปิด `feed_url` อ่านด้วย get_page_text ก่อน แคปจอเมื่อจำเป็น
   ทำแค่อ่าน ห้ามไลก์ คอมเมนต์ ทักแชท หรือ join กลุ่ม · เปิดรูปตาม `view_images` / `max_images_per_post`
   หยุดเมื่อ: เจอ stop_at_post_ids ติดกัน `stop_after_consecutive_seen` โพสต์ / เก่ากว่า cutoff / ครบ max_posts / ฟีดหมด
4. เขียน `runs/<run_id>/posts.jsonl` ทุกโพสต์ที่อ่าน (1 บรรทัด 1 โพสต์):
   ```json
   {"post_id":"<จาก URL>","group":"rov1","url":"https://www.facebook.com/groups/.../posts/<id>",
    "author":"ชื่อ","author_url":"...","posted_at":"2026-11-16T10:00:00+07:00","posted_at_raw":"3 ชม.",
    "kind":"sell|buy|sold|other","game":"ROV","items":["rov:conqueror-id"],
    "attrs":["สกิน SS","เปลี่ยนอีเมลได้"],
    "price":1800,"comments":4,"reactions":12,"text":"ข้อความย่อ ≤300 ตัวอักษร",
    "matches":[{"product":"rov-conq","fit":85,"has":[],"missing":[],"nice_found":[],"flags":[],"note":""}]}
   ```
   - `game`: ชื่อเดียวกับใน groups/wanted (dashboard แยกเกมด้วยค่านี้)
   - `items`: key จาก market.json ถ้าตรง ไม่งั้นตั้งใหม่ `game:slug` (เมื่อ discover=true)
   - `attrs`: จุดเด่นสั้น ๆ ที่เป็นมาตรฐาน (ใช้คำเดิมซ้ำทุกรอบ) — ใช้ในหัวข้อ "จุดเด่นที่ขายออก"
   - `kind:"sold"` เมื่อเห็นโพสต์เดิมขึ้นว่าขายแล้ว → สคริปต์บันทึก sold_at
   - `fit` 0-100 (must ครบ = ฐาน 70, +nice, -ข้อมูลไม่ชัด) · เจอ exclude = ไม่ใส่ match
5. `python3 -I scripts/fbscan.py --root <data> ingest runs/<run_id>/posts.jsonl [--meta runs/<run_id>/meta.json]`
6. commit กลับ: `state/*`, `log/market_log.jsonl`, `runs/<run_id>/*`, `results/*`
7. สรุปให้ผู้ใช้: ผลใหม่ต่อสินค้า + ลิงก์อันดับต้น ๆ + ธงเตือน

## สูตร
- tier กลุ่ม: hit = (matches+1)/(posts_read+20) → A ทุกรอบ / B ทุก 48 ชม. / C ทุก 72 ชม. (แก้ได้ในตั้งค่า)
- คะแนนสินค้า = ตามหา×3 + ขายออก×2 + โพสต์ขาย×0.5 · ความต้องการ/ของ = ตามหา ÷ (ขาย+1)
- แนวโน้มราคา = มัธยฐานครึ่งหลังของช่วง เทียบครึ่งแรก
