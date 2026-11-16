# fb — หาสินค้า + เก็บข้อมูลตลาดจากกลุ่ม Facebook

Claude อ่านโพสต์และตัดสินว่าตรงไหม / `scripts/fbscan.py` ทำงานบัญชีข้อมูลที่เหลือทั้งหมด (stdlib only)

```
fb/
  config.json          ค่าตั้งรวม
  groups.json          รายการกลุ่ม
  wanted.json          สินค้าที่ต้องการหา (array)
  market.json          รายการที่ติดตามความนิยม + เปิด/ปิด discover
  images/<product_id>/ รูปอ้างอิงของสินค้า (ไม่บังคับ)
  scripts/fbscan.py    plan | ingest | report
  state/               สถานะ (สคริปต์เขียน ห้ามแก้มือถ้าไม่จำเป็น)
    groups_state.json    ต่อกลุ่ม: runs, posts_read, matches, posts_per_day, recent_post_ids
    seen_posts.json      ทุกโพสต์ที่เคยเห็น: reported (ส่งผลแล้วให้สินค้าไหน), sold_at
  data/market_log.jsonl ทุกโพสต์ที่อ่าน (append-only) ใช้ทำรายงานความนิยม
  runs/<run_id>/       posts.jsonl ที่ Claude สกัดในแต่ละรอบ (+ meta.json)
  results/             <run_id>_matches.csv, market_<date>_<N>d.csv
```

## Input ที่คุณแก้

### groups.json
| field | ความหมาย |
|---|---|
| id | ชื่อสั้น ใช้อ้างใน wanted.groups |
| url | ลิงก์กลุ่ม (บัญชีต้องเป็นสมาชิก) |
| games | เกมหลักของกลุ่ม (ช่วย Claude จัด items) |
| mode | `feed` (เลื่อนอ่านฟีดเรียงใหม่สุด) หรือ `search` (ใช้ค้นหาในกลุ่มด้วย keywords — ยังเป็นการทดลอง) |
| enabled | false = ข้าม |

### wanted.json (1 object = 1 สินค้า)
| field | ความหมาย |
|---|---|
| id | ใช้เป็นชื่อโฟลเดอร์ images/ และคอลัมน์ product ในผล |
| enabled | false = ไม่หา (ซื้อได้แล้วก็ปิด) |
| game, name | |
| keywords | คำที่ผู้ขายใช้ (ใช้ใน mode=search และช่วย Claude กรอง) |
| must / nice / exclude | ต้องมี / มีแล้วดี (ใช้จัดอันดับ) / เจอแล้วตัดทิ้ง |
| transfer | เงื่อนไขการโอนไอดี |
| price.min / max / market | ช่วงราคา; market ใช้คำนวณ % ถูกกว่าตลาด + ธง "ถูกผิดปกติ" |
| max_post_age_days | null = ใช้ config |
| groups | `"all"` หรือ `["rov1","rov2"]` |

### market.json
- `discover: true` → Claude ตั้ง item key ใหม่เองเมื่อเจอของที่ไม่อยู่ใน track
- `track[]` → `{key, game, name, aliases}` key รูปแบบ `game:slug` เช่น `rov:conqueror-id`

### config.json (ค่าที่น่าปรับ)
- `max_post_age_days`, `run_post_budget` (โพสต์รวมต่อรอบ), `per_group_min/max_posts`
- `min_fit` (0-100) ต่ำกว่านี้ไม่ส่งผล, `max_results_per_product`
- `group_tiers` hit_rate = (matches+1)/(posts_read+20); A ทุกรอบ, B ทุก 48 ชม., C ทุก 72 ชม.; กลุ่มใหม่ได้ A ฟรี `new_group_free_runs` รอบ

## Algorithm สรุป
1. **plan**: เลือกกลุ่มที่ถึงรอบตาม tier, แบ่ง `run_post_budget` ตามน้ำหนัก (A3/B2/C1), ส่ง `stop_at_post_ids` + `cutoff`
2. **อ่าน**: เปิด `feed_url` (เรียงใหม่สุด) เลื่อนลงจนเจอเงื่อนไขหยุดอย่างใดอย่างหนึ่ง:
   เจอโพสต์ใน stop_at_post_ids ติดกัน `stop_after_consecutive_seen` โพสต์ (กันโพสต์ปักหมุด) /
   โพสต์เก่ากว่า cutoff / ครบ max_posts / ฟีดหมด
3. **ingest**: กันซ้ำด้วย post_id, อัปเดตสถิติกลุ่ม, ถ้าโพสต์เดิมกลายเป็น "ขายแล้ว" บันทึก sold_at,
   คัดผล (fit ≥ min_fit, อายุ, ราคา, ยังไม่เคยส่งให้สินค้านี้) → เรียง fit มาก→ราคาน้อย
4. **report**: ต่อ item ในช่วง N วัน → score = buy×3 + sold×2 + sell×0.5 + avg_comments×0.2,
   demand_ratio = buy/(sell+1), median price, price trend (ครึ่งหลังเทียบครึ่งแรก), ชั่วโมงเฉลี่ยจนขายออก

## PLAYBOOK สำหรับ Claude (ทำตามทุกรอบ)
1. stage ทั้งโฟลเดอร์ fb (config/groups/wanted/market/state/scripts) เข้า workspace
2. `python3 -I scripts/fbscan.py --root <fb> plan` → ได้ run_id และ due_groups
3. เปิดเบราว์เซอร์ในแอป ต่อกลุ่มใน due_groups: ไป feed_url, อ่านด้วย get_page_text/read_page ก่อน (ไม่แคปจอถ้าไม่จำเป็น)
   - ทำแค่อ่าน: ห้ามกดไลก์ คอมเมนต์ ทักแชท หรือ join กลุ่ม
   - เปิดดูรูปเฉพาะโพสต์ที่ผ่านเงื่อนไขข้อความแล้ว ไม่เกิน `max_images_per_post`
4. เขียน `runs/<run_id>/posts.jsonl` ทุกโพสต์ที่อ่าน (รวมโพสต์ซื้อ/ขายแล้ว เพื่อข้อมูลตลาด):
   ```json
   {"post_id":"<จาก URL>","group":"rov1","url":"https://www.facebook.com/groups/.../posts/<id>",
    "author":"ชื่อ","author_url":"...","posted_at":"2026-11-16T10:00:00+07:00","posted_at_raw":"3 ชม.",
    "kind":"sell|buy|sold|other","game":"ROV","items":["rov:conqueror-id"],
    "price":1800,"comments":4,"reactions":12,"text":"ข้อความย่อ ≤300 ตัวอักษร","images_viewed":0,
    "matches":[{"product":"example-rov","fit":85,"has":[],"missing":[],"nice_found":[],"flags":[],"note":""}]}
   ```
   - price: ตัวเลขบาท หรือ null ถ้าไม่ระบุ / หลายราคาให้ใช้ราคาของชิ้นที่ match
   - fit: 0-100 (must ครบ = ฐาน 70, +nice, -ถ้าข้อมูลไม่ชัด); เจอ exclude = ไม่ใส่ match
   - items: ใช้ key จาก market.json ถ้าตรง ไม่งั้นตั้งใหม่ `game:slug` (ถ้า discover=true)
   - meta.json (ไม่บังคับ): `{"rov1":"seen","rov2":"age"}` เหตุผลที่หยุด
5. `python3 -I scripts/fbscan.py --root <fb> ingest runs/<run_id>/posts.jsonl --meta runs/<run_id>/meta.json`
6. (ถ้าขอ หรือทุกรอบที่ข้อมูล ≥ 2 วัน) `python3 -I scripts/fbscan.py --root <fb> report`
7. commit กลับ: state/*, data/market_log.jsonl, runs/<run_id>/*, results/*
8. สรุปให้ผู้ใช้: จำนวนผลใหม่ต่อสินค้า + ลิงก์อันดับต้น ๆ + ธงเตือนที่สำคัญ
