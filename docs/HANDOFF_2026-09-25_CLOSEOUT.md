# SIMCLONE — PROJECT HANDOFF / CLOSEOUT
## Knowledge → Rust Survival → Production Planning → Mentorship

วันที่ส่งต่อ: 25 กันยายน 2026  
บทบาทแชทถัดไป: **Project Brain + Lead Developer**

Repo: https://github.com/nustanakritwithai/Simclone  
Live: https://nustanakritwithai.github.io/Simclone/

---

## 1. กฎก่อนเริ่มงาน

อย่าเชื่อ handoff นี้แทน source จริง

เริ่มทุกครั้งด้วย:

1. ตรวจ `main` ล่าสุด
2. ตรวจ GitHub Actions / Pages ล่าสุด
3. ตรวจ PR ที่เปิดอยู่
4. อ่าน:
   - `AGENTS.md`
   - `GAME_PLAN.md`
   - `docs/STATUS.md`
   - `docs/NEXT_STEPS.md`
   - handoff นี้
5. ใช้ VIP:
   - Verify
   - Improve
   - Prove
6. UNKNOWN ห้ามนับเป็น PASS
7. ห้าม force push หรือ merge stale branch เข้า main โดยตรง

Simulation authority ต้อง deterministic:

- ห้าม `Math.random` ใน simulation
- ห้าม wall-clock / Date เป็นกฎเกม
- ห้าม DOM ใน engine
- UI ส่ง validated command เท่านั้น
- ไม่สร้าง ledger / writer / executor ตัวที่สองเมื่อมี authority เดิมอยู่แล้ว

---

## 2. Runtime baseline ที่ส่งต่อ

Runtime main หลังงานชุดนี้:

`f51138d149ed1dab1f3507bf5dbe52412322dfaf`

ลำดับ merge สำคัญ:

- Knowledge Continuity 1 → `09260a3`
- Rust Survival RS1–RS4 → `769e684`
- Production Planning RP1 → `48722b7`
- WM4.4 reference evidence → `8bd13ec`
- Mentorship KF1 → `f51138d`

Closeout docs ถูกทำบน branch:

`docs/final-closeout-20260925`

ก่อนเริ่มงานใหม่ ให้ตรวจว่า closeout docs ถูก merge เข้า main แล้วหรือยัง และตรวจ Pages ของ exact main ล่าสุดอีกครั้ง

---

## 3. ระบบที่ถือว่า IMPLEMENTED

### 3.1 Survival / Lifecycle / Generations

มีแล้ว:

- fixed-step deterministic simulation
- routing จริง
- task-derived reservations
- shared stock
- hunger / energy / HP
- autonomous work
- housing
- manual clone
- autonomous birth
- child / adult / elder
- deterministic lifespan
- starvation death / age death
- generation continuity
- bounded historical identity archive

กฎ lineage / age / history ที่ผ่านแล้วห้าม rewrite เพื่อแก้ feature ใหม่

---

### 3.2 Skill Provenance

มี:

- XP 4 สายเดิม:
  - FORAGE
  - WOODCUT
  - MINE
  - BUILD
- inheritance = `floor(parent XP × 0.35)`
- initial / inherited / earned / legacy-unattributed provenance
- work XP เกิดหลังมีผลผลิตจริงเท่านั้น

Mentorship **ไม่ใช่ Skill XP inheritance** และห้ามเพิ่ม XP จากการสอน

---

### 3.3 Knowledge Continuity 1

มี:

- personal knowledge
- direct observation evidence
- explicit knowledge sharing
- `UNVERIFIED / CONFIRMED / STALE / REFUTED`
- local verification
- no hidden remote resource truth
- opt-in personal resource planner
- visit-and-verify goal phase
- bounded goal outcomes
- Cultural Archive
- publication / reading provenance
- knowledge surviving author death

Cultural Archive และ personal planner เป็น bounded extensions ไม่ใช่ omniscient world knowledge

---

### 3.4 Rust Survival RS1–RS4

**Released**

มี physical crafting:

- Stone Axe
- Stone Pickaxe
- Hammer
- Crafting Table Lv1
- Furnace

มี:

- physical item instance IDs
- personal bag
- equipment
- placed physical stations
- timed crafting
- station requirement
- save/load
- death drop
- exact-once material commitment
- UI control
- world rendering ของ station

สำคัญ:

วัสดุถูก commit ออกจาก shared stock **ตอนรับ order ครั้งเดียว**

completion ห้ามหักวัสดุซ้ำ

unfinished order ที่โดน hunger/energy interrupt ยังอยู่

death ยกเลิก unfinished order โดยไม่ refund แบบสร้างวัตถุดิบซ้ำ

Tool multiplier:

- Stone Axe → WOODCUT ×1.25
- Stone Pickaxe → MINE ×1.25
- Hammer → BUILD ×1.0 ณ ตอนนี้

Furnace authority ที่เปิดแล้ว:

`Wood 2 → Charcoal 1`

ยังไม่เปิด:

- meat processing
- water processing
- rope/fiber
- durability
- repair

---

### 3.5 Production Planning RP1

**Released / opt-in**

RP1 เป็น deterministic coordinator เท่านั้น

มันไม่ craft เองและไม่เขียน stock เอง

มันออก command เข้า Rust authority เดิมเพื่อทำ bounded chain:

`Stone Axe → Stone Pickaxe → Crafting Table → Hammer → Furnace → Charcoal`

เป้าถ่านปัจจุบัน bounded

สิ่งที่พิสูจน์แล้ว:

- disabled baseline ไม่เปลี่ยน deterministic world
- save/load กลาง chain ได้
- ไม่สร้าง station ซ้ำ
- ไม่สร้าง recipe output ซ้ำ
- hunger / energy / lifecycle ยัง interrupt ได้
- existing Rust scheduler เป็นคนทำงานจริง

ห้ามสร้าง production executor ตัวใหม่ขนานกับ RP1/Rust

---

### 3.6 Mentorship KF1

**Released in runtime main**

มี persistent Mentor → Student link

กฎ:

- Student มี active Mentor ได้สูงสุด 1 คน
- สร้าง link ต้องอยู่ใน communication range
- Mentor สอนได้เฉพาะ CONFIRMED personal knowledge
- Student รับเป็น UNVERIFIED
- Student ต้อง verify เอง
- teaching ไม่เพิ่ม Skill XP
- Mentor-link + knowledge key เดิมเป็น idempotent
- auto teaching สูงสุดหนึ่ง **new** claim ต่อ 120-tick boundary
- death ปิด active link แต่ historical relationship ยังอยู่
- Social tab แสดง relation จริงจาก state

Bound:

- links 16
- taught keys retained ต่อ link 4

ยัง **ไม่มี** trust / love / respect / fear / debt inference ใน KF1

---

## 4. WorldSim / Ecology authority

ปัจจุบัน:

- WM4.1 = single authoritative resource-regeneration writer
- behavior food/wood ยังรักษากฎเดิม
- WM4.2 impact = read-only
- WM4.3 calibration / Formula Lab = read-only
- WM4.4 = absolute reference evidence + controlled-depletion comparison

WM4.4 แก้ proof bug สำคัญ:

fresh world food nodes เต็ม ทำให้ candidate formula ทุกสูตรให้ 0 เพราะ missing capacity = 0

จึงแยก:

1. untouched world → วัด ecology จริง
2. controlled-depletion copy → ตั้ง food missing 3 units ต่อ node เพื่อเปรียบเทียบสูตร

**ยังไม่มี ecology-dependent food amount formula ที่ active ใน gameplay**

ห้ามเปิดสูตรเพียงเพราะ Formula Lab ดูดี

ก่อนเปิด authority ต้องพิสูจน์:

- survival baseline
- food crisis
- population continuity
- long-run generation
- no second writer
- deterministic replay / save compatibility

---

## 5. Kingdom status

Authority ที่ active:

- K1 profession/career history จาก winning productive work
- K5 labor-choice bonus ภายใต้ Survival eligibility

ยังเป็น shadow/evidence:

- K2 demand/scarcity
- K3 production projection
- K4 labor offers
- K6 market price projection

ยังไม่มี:

-เงินจริง
- wallet
- wage
- tax
- trade
- treasury
- merchant
- full production economy

อย่าเปิด Kingdom shadow ทั้งชุดพร้อมกัน

---

## 6. PR cleanup ที่ทำแล้ว

PR stale/superseded ถูกปิดโดยไม่ลบ branch:

- #49 old WM4.3 formula shadow
- #28 RS4 stale
- #27 RS3 stale
- #26 RS2 stale
- #25 RS1 stale
- #21 old G1 crafting catalog
- #9 old possession core
- #8 old gameplay-first roadmap
- #24 old K7 multi-settlement experiment
- #17 old K6 storage/spoilage shadow
- #5 temporal command bridge experiment
- #4 temporal history adapter experiment
- #55 old KF1 branch ที่ fail duplicate-teaching proof

หลัก:

**อย่า reopen แล้ว merge stale branch**

ถ้าจะเอาแนวคิดจาก branch เก่ากลับมา ให้ใช้เป็น donor/reference แล้ว re-port จาก verified current main

---

## 7. Verification evidence ที่สำคัญ

ผ่านแล้ว:

- Rust candidate exact head `235200d...` → Verify #293 SUCCESS
- Rust main `769e684...` → Pages #36 SUCCESS
- RP1 exact head `5127931...` → Verify #296 SUCCESS
- RP1 main `48722b7...` → Pages #37 SUCCESS
- WM4.4 evidence exact head `fca1ec3...` → Verify #302 SUCCESS
- KF1 exact head `b7413d9...` → Verify #303 SUCCESS

หลัง KF1 merge มี Pages #39 บน runtime main `f51138d...`

**แชทถัดไปต้องตรวจผล exact Pages ของ main ล่าสุดอีกครั้ง**  
ถ้า closeout docs ถูก merge หลังจากนี้ ให้ใช้ Pages ของ closeout commit เป็น release evidence สุดท้ายแทน

---

## 8. สิ่งที่ยังไม่ควรเรียกว่าเสร็จทั้งเกม

งานชุดนี้ปิดแล้ว แต่ master game ยังมี backlog:

### P1 — Ecology gameplay authority
เลือก food regeneration formula จาก WM4.4 evidence แล้วทำ behavioral proof ก่อนเปิด writer behavior ใหม่

### P2 — Knowledge goals
- richer information goals
- cultural retrieval
- intentional teaching target selection
- better observation boundary
- private terrain/location memory

### P3 — Social state
ต่อจาก KF1:

- trust
- affinity
- respect
- fear
- debt
- family links

ต้อง derive จาก event/evidence จริง ห้าม generate ค่า relation ลอย ๆ

### P4 — Faction / Governance
- membership
- leader / collective goals
- norms / rules
- shared ownership
- split / change conditions

### P5 — Economy authority
- wallet
- material ownership
- wages
- atomic trade
- price authority
- treasury

ต้องรักษา conservation

### P6 — Cooperation / Conflict
- joint work
- disputes
- mediation
- territorial pressure
- combat ค่อยตามหลัง social/economy authority

### P7 — Culture / Technology
`Discovery → Evidence → Publication → Teaching → Adoption → Production change`

ต้อง version technique และ prove output change จริง

### P8 — Spatial maturity
- route memory
- local exploration
- danger/risk
- travel cost
- settlement placement

### P9 — Optional novelty reasoning
LLM ใช้เฉพาะ novelty/proposal path

`Proposal → Validate → Execute → VIP Verify → Store Evidence`

ห้าม LLM per-agent per-tick

### P10 — V1.0 acceptance
ต้องมี proof แยก:

- Original-only fresh start
- autonomous survival
- autonomous building/production
- multiple generations
- knowledge continuity
- social continuity
- save/load continuation
- 100-day proof
- long-run generation proof

---

## 9. ลำดับที่แนะนำให้แชทใหม่ทำ

1. Verify current main + exact Pages
2. อ่าน STATUS / NEXT_STEPS
3. ห้าม revive stale PR
4. เลือก **หนึ่ง authority gate**
5. ทำ Success Contract
6. candidate branch
7. deterministic tests
8. exact candidate CI
9. merge
10. exact main Pages
11. update STATUS/HANDOFF

ลำดับ feature ที่แนะนำ:

`Ecology authority → richer information goals → Social state → Faction → Economy → Cooperation/Conflict → Technology → Spatial maturity → V1.0 proof`

---

## 10. Definition of Done สำหรับทุก milestone

ถือว่า DONE เมื่อ:

- behavior จริงอยู่ใน authoritative path
- single writer / single executor ชัดเจน
- deterministic
- bounded state
- save/load ทำงาน
- migration ชัดเจน
- no duplication / conservation ผ่าน
- unit/regression tests ผ่าน
- long-run tests ที่เกี่ยวข้องผ่าน
- browser test ที่เกี่ยวข้องผ่าน
- exact candidate CI ผ่าน
- exact merged-main Pages ผ่าน
- docs ตรงกับ code

ถ้าข้อใดไม่มี evidence ให้ถือเป็น **UNKNOWN ไม่ใช่ PASS**

---

## 11. สรุปสั้นที่สุด

SIM Clone ตอนส่งต่อไม่ใช่แค่ survival prototype แล้ว

มันมีวงจรจริง:

`Survive → Work → Learn → Verify → Preserve knowledge → Craft → Build production chain → Teach → Age → Die → Continue across generations`

สิ่งที่ควรทำต่อไม่ใช่เพิ่มระบบสุ่มจำนวนมาก แต่ค่อย ๆ เปิด authority ชั้นถัดไปโดยรักษา deterministic single-source-of-truth เดิม
