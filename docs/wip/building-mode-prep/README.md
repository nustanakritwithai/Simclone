# Building Mode prep (WIP, ห้าม merge)

โฟลเดอร์นี้เก็บงานเตรียม Building Mode ที่ยังไม่ขึ้น `main` เพื่อให้ทีมอื่นทำต่อได้ ไม่มีไฟล์ใน `src/`

- `SPEC_building_sockets_v1.md` สเปก building sockets ฉบับล่าสุด (base `main` `3044698`) รวมการแก้หลังรีวิว PR #67 และ §10 visual decisions (Roblox Dev)
- `SPEC_building_sockets_v1.before-pr67.md` ฉบับก่อนแก้หลังรีวิว PR #67 เก็บไว้เทียบ
- `visuals/` ชุด visuals ฉบับร่างของสกา (จะเพิ่มเมื่อสกายืนยันว่าเป็นฉบับล่าสุด)

ลำดับเฟส: (a) PR #67 Shelter removal + RP1 modular house, (b) Building Mode ghost + rotate, (c) Structural Snap, (d) P3 HP/repair/delete/refund
สเปก Building Mode (b) จะเขียนต่อจาก §10 หลัง #67 merge และจะอัปเดต base SHA ตอนนั้น
