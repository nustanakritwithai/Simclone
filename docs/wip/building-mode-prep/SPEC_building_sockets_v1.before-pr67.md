# SPEC — Building Sockets v1 (Modular House เป็นระบบก่อสร้างเดียว)

- Repo: `github.com/nustanakritwithai/Simclone`
- Base: `main` @ `304469895e69124c18a086c4989366e821b825f7` (ตรวจซ้ำ 25 ก.ย. 2026 19:24 น. เวลาไทย หลัง merge PR #65 WM4.6; merge commit คือ SHA นี้)
- สถานะเอกสาร: **DESIGN SPEC เท่านั้น** ยังไม่มีโค้ด ไม่มี branch และไม่มี PR ทุกเลขบรรทัดอ้างอิงที่ `30446989` ยกเว้นที่ระบุชัดว่าเป็น baseline เก่า
- งานนี้อ่านอย่างเดียว: อ่านไฟล์ผ่าน `gh api .../contents?ref=30446989` แล้วเทียบกับ draft ที่อ้าง `9799a6ac` ไม่ได้ clone และไม่ได้เขียนอะไรกลับ repo
- สิ่งที่ขยับจาก `9799a6ac` → `30446989` ในไฟล์ที่สเปกอ้าง: เปลี่ยนแค่ `src/engine.mjs` (บรรทัดเดียว ส่ง `woodMode` เข้า regen, จำนวนบรรทัดเดิม 474 จึงเลขอ้างอิงอื่นในไฟล์นี้ยังตรง) และ `src/worldsim-resource-authority.mjs` (WM4.6 wood ecology ทำให้ `ecologySignature` เลื่อนจาก 31–37 เป็น 39–44) ไฟล์อื่นที่สเปกอ้าง blob เดิมทั้งหมด
- กติกาที่ต้องรักษา (AGENTS.md): engine ห้ามใช้ `Math.random`/`Date` ห้ามแตะ DOM, UI ส่งได้แค่ command ที่ผ่าน validate, แต่ละ state มี writer/executor เดียว, **ห้ามเพิ่ม material ledger ซ้ำ**, material ถูก commit ครั้งเดียวตอน accept, save เดิมต้องเปิดได้ (เปลี่ยน version ต้องมี migration หรือปฏิเสธอย่างชัดเจน) และ UNKNOWN ไม่นับเป็น PASS

การตัดสินใจของผู้ใช้: **Modular (WOOD_FOUNDATION/WALL/DOORWAY/ROOF) จะเป็นระบบก่อสร้างเดียว และระบบ Shelter/`BUILD` เดิมจะถูกถอดออก**
ข้อจำกัดของทีม: (1) การถอด Shelter กับการให้ RP1 วางแผนบ้าน modular **ต้องอยู่ใน PR เดียวกัน** ไม่อย่างนั้นประชากรจะหยุดโต (2) นิยาม "บ้าน modular ที่สมบูรณ์" และ capacity ต้องอยู่ใน engine **ที่เดียว** ส่วน RP1/UI เรียกใช้เท่านั้น ห้ามคำนวณเอง

---

## 0. สิ่งที่พบในโค้ด (อ้างอิงที่ 30446989)

### 0.1 จุด validate และ execute การวางชิ้น modular
| สิ่งที่ดู | ที่อยู่ในโค้ด |
|---|---|
| Catalog ของชิ้นส่วน | `src/crafting-catalog.mjs` บรรทัด 10 `PLACEABLE_KINDS`; บรรทัด 17–20 `ITEM_CATALOG.WOOD_*` (`structurePiece:true`, `placementRule:'ground'` สำหรับ foundation และ `'supported'` สำหรับ wall/doorway/roof); บรรทัด 28–31 `RECIPE_CATALOG.WOOD_*` (ใช้ไม้อย่างเดียว: foundation 8, wall 5, doorway 5, roof 6; `station:'HAND'`) |
| Validator แบบอ่านอย่างเดียว (มีอยู่แล้ว) | `src/rust-stations.mjs` บรรทัด 25–38 `canPlaceStation(s,{agentId,itemInstanceId,x,y},isWalkable)` คืน `{ok:false,reason}` ด้วย reason `actor-or-item`/`position`/`range`/`terrain`/`hammer`/`foundation-ground`/`support`/`occupied`/`capacity` และไม่เขียน state |
| Executor (writer เดียวของ structure) | `src/rust-stations.mjs` บรรทัด 39–45 `placeStationFromItem()` เรียก `canPlaceStation` ซ้ำ แล้วค่อยลบ item ออกจาก `rustPossessions.items`/`equipment` และ push record ลง `rustStations.stations` ทั้งหมดอยู่ในฟังก์ชัน sync เดียว จึง atomic |
| Command routing | `src/rust-runtime.mjs` บรรทัด 18–31 `rustCommand()` ส่ง `'PLACE_STATION'` ไป `placeStationFromItem`; ข้อความ reason อยู่บรรทัด 12–17; `src/engine.mjs` บรรทัด 106 `command()` ส่งต่อให้ `rustCommand(s,type,data,walkable)` |
| ต้องสวม Hammer | `src/rust-stations.mjs` บรรทัด 20–23 `equippedHammer()` และบรรทัด 32 |
| UI ปุ่มวางชิ้น | `src/ux.mjs` บรรทัด 146–150 วนเพื่อนบ้าน 4 ทิศ เรียก `api.preview('PLACE_STATION',…)` แล้วเลือกช่องแรกที่ `ok` จากนั้นเรียก `api.execute` ตอนนี้**ยังไม่มี ghost สำหรับชิ้น modular** |
| `api.preview` / `api.execute` | `src/app.mjs` บรรทัด 268: `preview` ทำ `JSON.parse(serialize(state))` แล้วรัน `command()` ตัวจริงบนสำเนา; บรรทัด 269: `execute` รันบน state จริง |
| Ghost ของ BUILD shelter | `src/app.mjs` บรรทัด 170 ถ้า ok ใช้สีทอง `#ecdb9b70`/`#f0d895` ถ้าไม่ ok ใช้สีแดง `#d47f7f70`/`#efb6a6`; `src/ux.mjs` บรรทัด 163–170 `choosePlacement`/`refreshPlacement` ใช้ `api.preview('BUILD',candidate)` และมี cache key `[candidate,s.stock,s.buildings.length]` |
| Test เดิมของ modular | `tests/rust-survival-integration.test.mjs` บรรทัด 135–167: wall วางบน**ช่องข้างเคียง**ของ foundation (`adjacentFree`) |

### 0.2 วิธีเช็ค structural support ตอนนี้
- `src/rust-stations.mjs` บรรทัด 18 `STRUCTURE_KINDS`, บรรทัด 19 `SUPPORT_KINDS = {WOOD_FOUNDATION, WOOD_WALL, WOOD_DOORWAY}`
- บรรทัด 24 `hasSupport(s,x,y)` = มี support piece ใดก็ได้ที่ Manhattan distance == 1 ซึ่งแปลว่า
  - ไม่มี edge ไม่มีทิศ และไม่มีความสูง/ชั้น **ชิ้นหนึ่งกินเต็มหนึ่งช่อง** และวางซ้อนไม่ได้ (บรรทัด 35 ช่องที่มี station อยู่ = `occupied`)
  - roof วางที่**ช่องข้างเคียง**ของ support ไม่ได้วางบนหัว
  - wall ต่อจาก wall ได้เรื่อยๆ เป็นโซ่ ไม่ต้องมี foundation ใกล้
- foundation (`placementRule:'ground'`) ต้องอยู่บน tile `'grass'` (บรรทัด 33)

### 0.3 ตำแหน่ง / grid / tiles
- `src/engine.mjs` บรรทัด 29 `SIZE={w:30,h:26}`; `src/survival.mjs` บรรทัด 11 `RULES.width/height`, บรรทัด 17 `tileAt = s.tiles[y*30+x]`
- tile มี `'grass'|'water'|'path'|'bridge'` (validate อยู่ที่ `engine.mjs` บรรทัด 334); สร้างใน `createWorld` บรรทัด 83–93
- walkable: `src/worldsim-map.mjs` บรรทัด 88–93 `worldPathWalkable` (เดินได้ทุก tile ที่ไม่ใช่น้ำ) **structure/station ไม่บังทางเดิน** เพราะ route อยู่ที่ `survival.mjs` บรรทัด 21–34 และดูแค่ tile
- `rust-stations.mjs` บรรทัด 29 hard-code ขอบเขต `x>=30||y>=26` และบรรทัด 33 hard-code `y*30+x` (ควรเปลี่ยนไปใช้ `SIZE`/`RULES`)
- **ไม่มีข้อมูลความสูงในเกมเพลย์** `elevation` ใน `worldsim-map.mjs` บรรทัด 49 ใช้แค่วาดภาพ ในเอกสารนี้ "ความสูง" จึงหมายถึง `level` ของ socket ที่จะเพิ่มใหม่
- Render: Canvas 2D isometric ทั้งหมด ไม่มีไฟล์ภาพ `src/app.mjs` บรรทัด 13 `hw=27,hh=13.5` (tile 54×27 px) บรรทัด 14 `proj(x,y)=((x-y)*hw,(x+y)*hh)` ซึ่งพิกัดจำนวนเต็มคือ**กลางช่อง** บรรทัด 157 `worldPoint()` ปัด `Math.round` เป็น cell จำนวนเต็ม (เศษทศนิยมที่ต้องใช้หา edge หายไปตรงนี้) บรรทัด 167 sort วาดตาม depth `x+y+.15` สำหรับ station ชิ้น modular วาดใน `rustStation()` บรรทัด 101–126 (WOOD_* อยู่บรรทัด 113–124) ส่วน Shelter วาดใน `building()` บรรทัด 76+

### 0.4 structure เก็บใน state อย่างไร
- `s.rustStations = {version:'RS3-0.2', nextStation, stations:[]}` (`rust-stations.mjs` บรรทัด 2, 5)
- record แต่ละชิ้น (บรรทัด 43): `{id, kind, buildingType, x, y, complete:true, placedBy, placedTick, structurePiece}`
- limit (บรรทัด 3): `STATION_LIMITS={maxStations:32, interactionRange:1}` นับรวม CRAFTING_TABLE/FURNACE ด้วย
- ตรวจตอนโหลดที่ `rust-runtime.mjs` บรรทัด 69–70 `validateRustState`: version ต้องเท่ากันเป๊ะ, `stations.length<=maxStations`, kind ต้องอยู่ใน `PLACEABLE_KINDS`, x/y เป็นจำนวนเต็ม, `placedBy` ต้องเป็นคนที่มีอยู่จริง (เช็คแค่นี้ **ไม่เช็ค support หรือการซ้อน**)
- Shelter/camp อยู่อีก collection คือ `s.buildings` (`engine.mjs` บรรทัด 80: camp id1 ที่ (11,12) และ **shelter id2 ที่ (8,9) complete ตั้งแต่เริ่มโลก**) validate อยู่บรรทัด 385: type ต้องเป็น `'camp'|'shelter'`, จำนวน 1..12, `progress` 0..30

### 0.5 capacity คำนวณจาก shelter อย่างไร (ตอนนี้ซ้ำกัน 4 ที่)
| ที่ | โค้ด |
|---|---|
| `src/engine.mjs` บรรทัด 100 | `export const capacity = s => s.buildings.filter(b=>b.complete).length*6` (**camp ก็ได้ 6 ด้วย**) |
| `src/reproduction.mjs` บรรทัด 18 | `const capacity=` สูตรเดียวกัน ใช้ใน `autonomousBirthFoodTarget` (บรรทัด 39–44) และ `birthPlan` (บรรทัด 46–62) |
| `src/production-planning.mjs` บรรทัด 25 | `completedHousing` สูตรเดียวกัน ใช้ใน `needsHouse` บรรทัด 26 |
| `src/survival.mjs` บรรทัด 126 | `capacity:s.buildings.filter(b=>b.complete).length*6` ส่งเข้า `kingdomProductionSnapshot` |
| คนที่อ่าน | `engine.mjs` บรรทัด 112 (`CLONE`), `app.mjs` บรรทัด 181 (HUD `pop / capacity`), `scripts/birth-proof.mjs` บรรทัด 16/24, `scripts/continuity-proof.mjs` บรรทัด 18, `tests/engine.test.mjs` บรรทัด 18–21 |

### 0.6 จุดที่ RP1 ส่ง BUILD
- `src/production-planning.mjs` บรรทัด 10 `PRODUCTION_RULES` (`housePopulationBuffer:6, houseWood:12, houseStone:6, maxBuildings:12`)
- บรรทัด 26 `needsHouse` = ทุก building สร้างเสร็จแล้ว, จำนวน < 12 และ `capacity - eligible(s).length <= 6`
- บรรทัด 27–37 `settlementCell()` สแกนเป็นวงแหวนจาก camp รัศมี 2..8 (วน dy แล้วค่อย dx) หาช่อง grass ที่ไม่ occupied ซึ่งเป็นการเลือกตำแหน่งแบบ deterministic
- บรรทัด 38–46 `queueHouse()` เรียก `dispatch('BUILD',cell)`
- บรรทัด 105–111 ใน `stepProductionPlanning`: บล็อก `needsHouse` อยู่**ก่อน** `equipForWork` และก่อน tool chain ทั้งหมด (record `'build-shelter'`) ส่วน tool chain อยู่บรรทัด 124–133 (AXE→PICKAXE→TABLE→HAMMER→FURNACE) และ charcoal อยู่บรรทัด 134–136
- บรรทัด 105 `if(activeOrders(s)>0)return null`: ถ้ามี order ค้าง RP1 จะไม่ทำอะไรเลย
- engine เรียก RP1 ที่ `engine.mjs` บรรทัด 298 `stepProductionPlanning(s,walkable,(type,data)=>command(s,type,data))`

### 0.7 Shelter `BUILD` (สิ่งที่จะถูกถอด)
- command: `engine.mjs` บรรทัด 145–155 (ไม้ 12 + หิน 6 หักตอน accept, push `{type:'shelter',complete:false,progress:0}`)
- candidate: `engine.mjs` บรรทัด 199–203 (base 56, จำกัด builder 2 คน) execute อยู่บรรทัด 251–255 (progress 30 → `complete=true`, `stats.built++`, `gain(BUILD)`, `recordPlanProduction`)
- taskValid/claim: `survival.mjs` บรรทัด 66 และ 88–91, 100
- EAT/REST ใช้ building ที่ complete เป็น "home" (`engine.mjs` บรรทัด 164–165, `survival.mjs` บรรทัด 78–79)
- จุดอื่นที่อ่าน `unfinished`: `engine.mjs` บรรทัด 194, 201 (`laborAuthoritySignal`), `kingdom-labor-authority.mjs` บรรทัด 23–25, `kingdom-economy.mjs` บรรทัด 69, 76 และ `survival.mjs` บรรทัด 125, 134
- UI: `ux.mjs` บรรทัด 94–108 (panel "บ้านพักใหม่" และ confirm `api.execute('BUILD')`), `app.mjs` บรรทัด 247 (tap ใน build mode)
- personal planning: `personal-planning.mjs` บรรทัด 10 `BUILD→'finish-shelter'` บรรทัด 105–106 validate enum นี้ใน save

### 0.8 birth / การเติบโตของประชากรอ่าน capacity ที่ไหน
- `engine.mjs` บรรทัด 314–316: ทุก `DAY_TICKS` เรียก `attemptAutonomousBirth` (บรรทัด 60–67) → `birthPlan` (`reproduction.mjs` บรรทัด 46) → `pop>=min(36,capacity)` ถือเป็น `'housing'`
- ผลของโลกเริ่มต้น: camp + shelter = capacity 12 **proof birth/continuity ทั้งหมดรันแบบ RP1 ปิด** (`scripts/birth-proof.mjs`, `continuity-proof.mjs`) จึงพึ่ง capacity 12 จาก shelter เริ่มต้น

### 0.9 load/migrate save และฟิลด์ version
- `engine.mjs` บรรทัด 20–26: `VERSION='0.5.0'`, `SAVE_VERSION='0.5.0'`, `PREVIOUS_SAVE_VERSION='0.4.0'`, `HISTORY_ARCHIVE_SAVE_VERSION='0.3.0'`, `DEATH_HISTORY_SAVE_VERSION='0.2.0'`, `LEGACY_SAVE_VERSION='0.1.0'`
- `migrateSave` บรรทัด 443–469 มีกิ่งดังนี้: `0.5.0` → `ensureRustState/ensureProductionPlan/ensureMentorshipState` (บรรทัด 447), `0.4.0` บรรทัด 448–451, `0.3.0` บรรทัด 452–455, `0.1.0/0.2.0` บรรทัด 456–468
- `restore` บรรทัด 470–474 ทำ `migrateSave` → `validate` และถ้ามี error ใดๆ จะ throw (`storage.mjs` บรรทัด 10–11 ป้องกันไม่ให้เขียนทับ save ที่เสีย)
- extension มี version ของตัวเองและ validate แบบต้องตรงเป๊ะ: `rustStations.version==='RS3-0.2'`, `productionPlan.version==='RP1-0.2'` (มีแบบอย่าง migration ที่ `production-planning.mjs` บรรทัด 15: `RP1-0.1→RP1-0.2`)
- fixture เก่า: `tests/fixtures/legacy-0.3.3-save.json` (version `0.2.0`) มี camp + shelter complete

### 0.10 จุดอื่นที่พึ่ง `s.buildings` (เสี่ยงเรื่อง determinism)
- `src/worldsim-resource-authority.mjs` บรรทัด 39–44 `ecologySignature` ใส่ `buildings` (id/type/x/y/complete) ลงใน key (เลื่อนจาก 31–37 เพราะ WM4.6 เพิ่ม `WOOD_ECOLOGY_POLICY` ด้านบน) และ `worldsim-soil-shadow.mjs` บรรทัด 76 ใช้ช่องที่มี building เป็น `occupied` เวลาคำนวณดิน **ผลคือการงอกใหม่ของอาหารและไม้ (WM4.6 ecology writer) ขึ้นกับ `s.buildings`** ถ้าลบหรือย้าย shelter ออกจาก `buildings` วิถีของ seed จะเปลี่ยน
- `worldsim-map.mjs` บรรทัด 60 เปลี่ยน terrain ใต้บ้านเป็น grass (ภาพนี้ส่งต่อไปถึง soil ด้วย)
- `cultural-archive.mjs` บรรทัด 14, 25 ผูกกับ `camp` (ไม่กระทบ ถ้าเก็บ camp ไว้)
- `navigation.mjs` บรรทัด 57 minimap วาดเฉพาะ `buildings` ไม่วาด station

### 0.11 baseline ที่วัดได้ (probe บนสำเนา `9799a6ac` ก่อน #65, seed 230926, เปิด RP1 ตอน tick 0, รัน 3200 tick)
Shelter RP1 ถูกวางตอน tick 1 และเสร็จ tick 37 จากนั้น STONE_AXE 48, PICKAXE 73, TABLE 120, **HAMMER 190**, FURNACE 231, **charcoal≥4 ที่ 334** สุดท้าย pop 6, capacity 18, stock คงที่ประมาณ food 36 / wood 38 / stone 25 ตั้งแต่ tick 400 และไม่มีการเกิดภายใน 3200 tick
**หมายเหตุหลัง #65:** ยังไม่ได้รัน probe ซ้ำบน `30446989` ลำดับ tool/shelter อาจใกล้เคียง แต่สต็อกไม้และจังหวะหลัง charcoal อาจเพี้ยนเพราะ wood ecology ใหม่ — ตัวเลข tick ในข้อนี้ใช้เป็นแนวเท่านั้น และ UNKNOWN ข้อ 1 ยังบังคับให้วัดบน `30446989`

---

## 1. Sockets: data model และกติกา support

### 1.1 หลักการ
- ใช้ grid 30×26 เดิม **ห้ามมีพิกัดทศนิยมใน state**
- socket มี 3 ชั้น (`level`) ซึ่ง derive จาก kind ของชิ้นเสมอ client ส่ง level เองไม่ได้

| kind | socket type | level | อยู่ที่ |
|---|---|---|---|
| `WOOD_FOUNDATION` | `cell` | 0 | ช่อง (x,y) |
| `WOOD_WALL`, `WOOD_DOORWAY` | `edge` | 1 | ขอบของช่อง foundation |
| `WOOD_ROOF` | `cell` | 2 | **บนหัว**ช่อง foundation เดียวกัน |

### 1.2 edge แบบ canonical (ขอบหนึ่งเส้นมีชื่อเดียว)
- edge เก็บเป็น `{type:'edge', x, y, side:'N'|'W'}` เท่านั้น
  - `N` ของ (x,y) คือขอบบนของช่อง (x,y) ช่วงค่าที่ถูก: `x∈[0,29]`, `y∈[0,26]`
  - `W` ของ (x,y) คือขอบซ้ายของช่อง (x,y) ช่วงค่าที่ถูก: `x∈[0,30]`, `y∈[0,25]`
  - S ของ (x,y) แปลงเป็น `N` ของ (x,y+1) และ E ของ (x,y) แปลงเป็น `W` ของ (x+1,y)
- helper แบบ pure (ใส่ใน `src/rust-stations.mjs`):
  - `canonicalEdge(x,y,side)` รับ side N/E/S/W แล้วคืน N/W
  - `edgeCells(edge)` คืน 2 ช่องที่ติดกับ edge (อาจมีช่องหนึ่งอยู่นอก grid ที่ขอบแผนที่)
  - `cellEdges(x,y)` คืน 4 edge แบบ canonical เรียงตามลำดับ N,E,S,W
  - `socketKey(socket)` ให้ key เป็น string เช่น `c0:8:9`, `e1:8:9:N`, `c2:8:9`
- executor **ปฏิเสธ** socket ที่ไม่ canonical (`reason:'socket-shape'`) คือไม่แก้ให้เองเงียบๆ เพื่อไม่ให้สิ่งที่ preview เห็นกับสิ่งที่ถูกวางจริงต่างกัน

### 1.3 structure record ใหม่ (`RUST_STATIONS_VERSION` เปลี่ยนจาก `'RS3-0.2'` เป็น `'RS3-0.3'`)
```js
{
  id, kind, buildingType, complete:true, placedBy, placedTick, structurePiece:true,
  x, y,               // anchor cell: foundation/roof = ช่องของตัวเอง; wall/doorway = ช่อง foundation ที่รองรับ
                      // ถ้ามี foundation ทั้งสองฝั่ง ให้ใช้ foundation ที่ station id ต่ำกว่า เพื่อให้ deterministic
  socket:{type:'cell'|'edge', x, y, side?:'N'|'W', level:0|1|2},
  sourceItemId,       // item instance ที่ถูกใช้ไป (เอาไว้กันการใช้ซ้ำอย่างถาวร)
  placementId         // command id (ดูข้อ 4)
}
```
- station ที่ไม่ใช่ structure (CRAFTING_TABLE_LV1/FURNACE) ใช้ shape เดิมได้ และจะเพิ่ม `socket:{type:'cell',x,y,level:0}` ตอน migrate ก็ได้ถ้าอยากให้ lookup เป็นแบบเดียวกัน
- เหตุที่ anchor `x,y` ของ edge ชี้ไปที่ช่อง foundation: โค้ดหลายที่เช็ค occupancy ด้วย `x===x&&y===y` (`rust-stations.mjs` บรรทัด 35, `production-planning.mjs` บรรทัด 29, 59, `tests/rust-survival-integration.test.mjs` บรรทัด 13) ถ้าทุกชิ้นของบ้านมี anchor อยู่บนช่อง foundation ของบ้าน เช็คพวกนั้นยังถูกต้อง ช่องนอกบ้านจะไม่ถูกมองว่าไม่ว่าง
- `validateRustState` (`rust-runtime.mjs` บรรทัด 69–70) ต้องเพิ่มการเช็คว่า structure piece มี `socket` ที่ canonical ตรงกับ kind/level, ไม่มี 2 ชิ้นอยู่ใน `socketKey` เดียวกัน, anchor สอดคล้องกับ socket และ `sourceItemId` ไม่ซ้ำ ถ้าผิดถือว่า save เสีย (reject) ตามแนว "Malformed new metadata is rejected"
- `STATION_LIMITS.maxStations` 32 → **64** (ข้อเสนอ): บ้าน 1×1 ใช้ 6 records และ table+furnace ใช้ 2 ที่ 32 จะได้แค่ 5 บ้านพอดี ซึ่งตึงเกินไป ถ้ามีชิ้นกำพร้าหรือชิ้น legacy แค่ชิ้นเดียวก็เต็ม การขยาย limit ไม่ทำให้ save เก่าเสีย (เช็คแค่ `<=`)

### 1.4 ชิ้นไหนเกาะ socket ไหนได้ และกติกา support
ให้ `F(x,y)` = มี `WOOD_FOUNDATION` ที่ `c0:x:y`
| ชิ้น | socket ที่อนุญาต | support ที่ต้องมี |
|---|---|---|
| FOUNDATION | `cell` level 0 | tile `'grass'` + walkable + ไม่มี `buildings`/`nodes`/station ใดๆ ที่ anchor ตรงช่องนี้ (ยกกติกาเดิมบรรทัด 31, 33, 35 มา) |
| WALL / DOORWAY | `edge` level 1 | อย่างน้อยหนึ่งใน `edgeCells(edge)` ต้องมี `F` และ edge นี้ต้องว่าง (wall กับ doorway ใช้ slot เดียวกัน) **เลิกให้ wall ต่อจาก wall** |
| ROOF | `cell` level 2 ที่ (x,y) | ต้องมี `F(x,y)` และมี WALL/DOORWAY **อย่างน้อย 1** ชิ้นบน `cellEdges(x,y)` และ roof slot ต้องว่าง |

- กฎ "roof ≥1 ผนังบนขอบของช่องตัวเอง" ใช้ได้กับบ้านทุกรูปทรงที่มี ≤4 ช่อง (ทุกช่องของ polyomino ขนาด ≤4 มี perimeter edge อย่างน้อย 1)
- ยกเลิก `hasSupport` แบบ Manhattan distance 1 (บรรทัด 24) สำหรับ structure piece
- ลำดับแบบ deterministic:
  - socket เรียงตาม `(level, y, x, side N<W)`
  - ชิ้นที่ยังขาด (`missing`) เรียงตาม: foundation → wall ตามลำดับ N,E,S,W ของแต่ละช่อง (ข้ามด้าน doorway) → doorway → roof และภายในกลุ่มเรียงตาม `(y,x)`
  - component ของ foundation (4-neighbour) เรียงตาม station id ต่ำสุดใน component
- การชน (collision): v1 **ยังไม่ให้ structure บังทางเดิน** เพราะ route ดูแค่ tile (`survival.mjs` บรรทัด 21–34) ถ้าจะให้ผนังบังทางต้องเปลี่ยน `routeField` ซึ่งอยู่นอก scope และต้องมี proof แยก

---

## 2. Validator เดียว (ต่อยอดจาก `canPlaceStation` ไม่เขียนใหม่)

### 2.1 Signature
ใน `src/rust-stations.mjs` ขยาย `canPlaceStation` และ export alias ชื่อ `validatePlacement`
```js
// Pure: อ่าน state อย่างเดียว ห้ามเขียน state, ห้ามใช้ item, ห้ามใช้ Math.random/Date
export function canPlaceStation(s, {agentId=null, itemInstanceId=null, pieceKind=null, socket=null, x, y, placementId=null}={}, isWalkable=()=>true, {actor=true}={})
  // → {ok:true, kind, socket, anchor:{x,y}, level, agentId, itemInstanceId, completesHouse?:houseId}
  // → {ok:false, reason, stage:'shape'|'structure'|'actor'}
export const validatePlacement = canPlaceStation;
```
- ลำดับการเช็ค (หยุดที่ข้อแรกที่ fail เพื่อให้ reason deterministic):
  1. `shape` ตรวจชนิดชิ้นกับ socket: `pieceKind` หรือ kind จาก item ต้องเป็นชนิดที่วางได้ ถ้าเป็น structure piece ต้องมี `socket` ที่ canonical ถ้าไม่ผ่านคืน `socket-required`/`socket-shape`/`position` (สำหรับ foundation จะรับ `{x,y}` แบบเก่าแล้วแปลงเป็น `cell` ให้ เพื่อให้ caller เดิมใช้ต่อได้ แต่ wall/doorway/roof **ต้อง**ส่ง socket)
  2. `structure` เช็ค terrain/ground/support/occupied(socketKey)/capacity ตามข้อ 1.4 reason ใหม่: `socket-occupied`, `support-foundation` (wall/doorway), `support-roof`
  3. `actor` ทำเฉพาะตอน `actor:true`: คนต้องมีชีวิต, item ต้องอยู่ในกระเป๋าคนนั้นและ kind ตรง, ต้องสวม Hammer, ระยะ (`interactionRange` 1 วัดจากคนไปหา anchor cell และสำหรับ edge ใช้ระยะที่ใกล้สุดไปหาช่องใดช่องหนึ่งของ `edgeCells`), เช็ค `placementId` ซ้ำ (ข้อ 4)
- `actor:false` ใช้เฉพาะเวลาวางแผน (RP1 เลือก site/ตรวจ socket และ engine candidate) และ ghost ตอนที่ยังไม่ได้เลือกคน **ผลแบบ `actor:false` ห้ามนำไปวางจริง**
- ห้ามใช้ `JSON` clone หรือ mutate ใน validator test ต้องรันบน `deepFreeze(structuredClone(state))` แล้วไม่ throw

### 2.2 executor ต้องเรียก validator ซ้ำ
`placeStationFromItem(s,data,isWalkable)` (บรรทัด 39) ยังเป็น writer เดียวของ `rustStations.stations` ลำดับคือ
1. ถ้า `placementId` เคยประมวลผลแล้ว ให้คืนผลเดิมตามข้อ 4
2. `check = canPlaceStation(s,data,isWalkable,{actor:true})` แล้วค่อยใช้ `check.socket`/`check.anchor` ที่ validator คืนมา (**ห้ามคำนวณตำแหน่งใหม่**)
3. ใช้ item แล้วสร้าง record ใน tick/call เดียวกัน (atomic)
4. บันทึก `placementId` และถ้าการวางครั้งนี้ทำให้บ้าน "เสร็จ" (ข้อ 5) ให้ `stats.built++` ครั้งเดียว

### 2.3 UI: `api.preview` ใช้ validator ตัวเดียวกัน
- ขยาย `api.preview` (`app.mjs` บรรทัด 268): ถ้า `type==='PLACE_STATION'` ให้เรียก export ใหม่ `previewPlacement(state,data)` = `canPlaceStation(state,data,walkable,{actor:true})` **ตรงๆ บน state โดยไม่ clone** (เร็วกว่าและรับประกันว่าไม่เขียน) command อื่นยังใช้วิธี clone เหมือนเดิม
- สี ghost ของชิ้น modular: **เขียว = `ok:true`, แดง = `ok:false`** ตัดสินจาก validator อย่างเดียว (แทนทอง/แดงที่ `app.mjs` บรรทัด 170) ป้ายเหตุผลใช้ `message` จาก `rust-runtime.mjs` บรรทัด 12–17 โดยเพิ่ม reason ใหม่เป็นภาษาไทย
- cache key ของ preview ใน `ux.mjs` บรรทัด 166 ต้องรวม `rustStations.nextStation`, `stations.length`, bag/equipment ของคนที่เลือก, `a.x,a.y` และ `tick` ไม่อย่างนั้นสี ghost จะค้างผิด
- ปุ่ม `place-station` (`ux.mjs` บรรทัด 146–150) ที่เลือกช่องข้างตัวเองแบบอัตโนมัติ: สำหรับ structure piece ให้เปลี่ยนเป็นโหมด "วางชิ้น" ที่มี ghost แล้ว tap เพื่อ snap (ข้อ 3) ส่วน table/furnace ใช้แบบเดิมต่อได้

---

## 3. ลำดับการ snap: snap ก่อน แล้วค่อยคำนวณ support/level

1. UI แปลงจุดที่ pointer ชี้เป็นพิกัด grid **แบบทศนิยม** โดยเพิ่ม `worldPointExact()` ข้าง `worldPoint()` (`app.mjs` บรรทัด 157) ที่ไม่ปัดเศษ
2. เรียก `snapSocket(pieceKind, {fx,fy})` เป็น pure export จาก engine (`rust-stations.mjs`)
   - foundation/roof: ใช้ `cell = (round(fx), round(fy))`
   - wall/doorway: หา cell ก่อน แล้วเลือกขอบที่ใกล้ที่สุดจากค่า `dx=fx-cx`, `dy=fy-cy` (|dy|≥|dx| เลือก N/S ไม่งั้นเลือก W/E เสมอกันให้ N/S) แล้ว `canonicalEdge`
   - ผลลัพธ์เป็นจำนวนเต็มเสมอ (float หยุดอยู่ที่ UI ไม่ลงไปถึง state หรือ command)
3. คำนวณ `level`/support/anchor **จาก socket ที่ snap แล้วเท่านั้น** (ข้อ 2.1 ขั้น 2)
4. ghost วาดที่ socket ที่ snap แล้ว (edge วาดเป็นเส้น iso ระหว่างมุม `(x-.5,y-.5)→(x+.5,y-.5)` สำหรับ N และ `(x-.5,y-.5)→(x-.5,y+.5)` สำหรับ W; roof วาดยกขึ้นเหนือผนัง) ใช้สีจาก `api.preview` ของ **socket เดียวกันนั้น**
5. confirm ส่ง `PLACE_STATION` พร้อม socket ตัวเดียวกับที่ preview เป๊ะ (ห้ามส่งพิกัดดิบ) และ executor เรียก validator ซ้ำตามข้อ 2.2

ข้อห้าม: ห้ามเช็ค support ที่ตำแหน่งหนึ่งแล้วไปวางอีกตำแหน่ง ห้ามให้ executor "หาช่องใกล้เคียงที่ใช้ได้" เอง (ต่างจากที่ `ux.mjs` บรรทัด 148 และ `production-planning.mjs` บรรทัด 55–62 `freeNeighbor` ทำอยู่ตอนนี้กับ station ทั่วไป)

---

## 4. Placement command id: idempotent และห้ามใช้ item ซ้ำ

- ทุก `PLACE_STATION` ของ structure piece ต้องมี `placementId` แบบ string deterministic รูปแบบ `pl:<tick>:<agentId>:<itemInstanceId>`
  - UI ใช้ `state.tick` ขณะ confirm, engine BUILD task ใช้ `s.tick` (ข้อ 6.3)
  - `itemInstanceId` เป็นตัวเลขเพิ่มขึ้นอย่างเดียว (`rust-possessions.mjs` บรรทัด 33 `nextItem++`) จึงใช้แทน sequence ได้ ห้ามใช้ `Math.random`/`Date`/UUID
- log การประมวลผลเป็นของ writer เดิม (`rustStations`) ไม่ใช่ ledger ใหม่: `rustStations.placements: [{id, tick, stationId, itemInstanceId}]` จำกัด **64** แถว (FIFO)
- กติกาของ executor:
  1. ถ้า `placementId` อยู่ใน log และ payload ตรงกัน ให้คืน `{ok:true, duplicate:true, stationId}` **โดยไม่ mutate** ถ้า payload ต่าง ให้คืน `reason:'placement-id-conflict'`
  2. กันถาวรที่ไม่พึ่ง log: ถ้ามี station ที่ `sourceItemId===itemInstanceId` อยู่แล้ว ให้คืน `reason:'duplicate-item'` (ยังกันได้แม้แถวใน log จะหลุดไปแล้ว)
  3. ถ้าไม่มี `placementId` ให้คืน `reason:'placement-id'` (ใช้เฉพาะ structure piece; table/furnace จะใช้บังคับด้วยหรือไม่เป็น open question)
- refund ในอนาคต (ถอดหรือพังแล้วคืนของ): **ต้องสร้าง item id ใหม่** (`nextItem++`) ห้ามนำ id เก่ากลับมาใช้ command เก่าที่ retry จึงไม่มีทางจับคู่กับ item ในกระเป๋าได้ และไม่มีทางได้ชิ้นฟรี **วันนี้ยังไม่มี command ถอดหรือ refund ในโค้ด** (ค้น `REMOVE|DEMOLISH|destroy|salvage` ใน `src/` ไม่เจอ)

---

## 5. บ้าน modular ที่สมบูรณ์: นิยามเดียวใน engine

### 5.1 โมดูลและ API
ไฟล์ใหม่ `src/housing.mjs` (หรือจะรวมไว้ท้าย `rust-stations.mjs` ก็ได้ แต่ต้องมีที่เดียว):
```js
export const MODULAR_HOUSE_RULES = Object.freeze({
  minFoundations:1, maxFoundations:4,   // component ของ foundation แบบ 4-neighbour ขนาด 1..4 ช่อง
  doorways:1,                            // perimeter edge ต้องมี DOORWAY พอดี 1 ชิ้น ที่เหลือเป็น WALL ทั้งหมด
  roofOnEveryCell:true,
  capacityPerHouse:6,                    // เท่ากับ Shelter เดิม เพื่อไม่ให้สมดุลประชากรเปลี่ยน
  campCapacity:6                         // camp ยังให้ 6 เหมือนเดิม (engine.mjs บรรทัด 100)
});
export function evaluateModularHouses(s)  // pure, deterministic
  // → {houses:[{houseId:'H'+minFoundationStationId, cells:[{x,y}], complete, doorways, missing:[{pieceKind, socket}], capacity}], capacity}
export function housingCapacity(s)        // pure: campCapacity*campที่complete + legacyShelterCapacity(s) + evaluateModularHouses(s).capacity
export function nextHousePiece(s, site)   // pure: ชิ้นแรกที่ยังขาดตามลำดับข้อ 1.4 สำหรับแผนบ้านที่ site
```
- **เงื่อนไขบ้านสมบูรณ์** (ข้อเสนอ): component มี foundation 1..4 ช่อง, perimeter edge **ทุกเส้น**มี WALL หรือ DOORWAY, มี DOORWAY **พอดี 1**, ทุกช่องมี ROOF และทุกชิ้นผ่าน support ข้อ 1.4 จาก state ปัจจุบัน edge ภายใน component ไม่นับ
  - ขนาดเล็กสุด 1×1 = foundation 1 + wall 3 + doorway 1 + roof 1 = **6 ชิ้น ไม้ 34** (สูตรที่ `crafting-catalog.mjs` บรรทัด 28–31) เทียบ Shelter ที่ใช้ไม้ 12 + หิน 6
  - 2×1 = 11 ชิ้น ไม้ 58, 2×2 = 16 ชิ้น ไม้ 96 ขนาดใหญ่กว่า **ไม่ได้ capacity เพิ่ม** ใน v1 เพื่อกันการ exploit
  - component ที่มีเกิน 4 ช่อง ไม่นับเป็นบ้าน (`complete:false`, `reason:'too-large'`)
- capacity **derive เสมอ ไม่เก็บลง state** (ไม่มี flag `complete` ของบ้าน) ถ้าชิ้นหายหรือถูกถอด เรียกครั้งถัดไป capacity จะลดเอง ไม่มีค่าเก่าค้าง
- ถ้า capacity ลดจน `< living` ห้ามฆ่าหรือไล่คนออก ที่เกิดคือ `CLONE`/birth ถูกบล็อกด้วยเงื่อนไข `pop>=cap` ที่มีอยู่แล้ว (`engine.mjs` บรรทัด 112, `reproduction.mjs` บรรทัด 50)
- การถอด/พังในอนาคต (ยังไม่มีในโค้ด): ข้อเสนอคือ**ปฏิเสธการถอดชิ้นที่ยังมีชิ้นอื่นพึ่งอยู่** (foundation ที่มี wall/roof, wall ที่เป็น support เดียวของ roof) ไม่ทำ cascade เงียบๆ refund ใช้ item id ใหม่ (ข้อ 4)
- performance: เรียกบ่อย (HUD ทุก frame ที่ `app.mjs` บรรทัด 181, birth วันละครั้ง) station ≤64 ชิ้นจึงถือว่าเบา ถ้าจำเป็นให้ memo ด้วย key `(rustStations.nextStation, stations.length)` เป็น cache ที่อยู่นอก state

### 5.2 ทุกคนต้องเรียกฟังก์ชันเดียวนี้ (ลบสูตรซ้ำทั้ง 4 ที่)
| เดิม | ใหม่ |
|---|---|
| `engine.mjs` บรรทัด 100 `capacity` | `export const capacity = housingCapacity` (เก็บชื่อ `capacity` ไว้ให้ `app.mjs`, scripts และ tests ใช้ต่อ) |
| `reproduction.mjs` บรรทัด 18 | `import {housingCapacity}` (ไม่มี import วน: `housing.mjs` import แค่ `rust-stations.mjs`/`crafting-catalog.mjs`) |
| `production-planning.mjs` บรรทัด 25 `completedHousing` | ลบ แล้วใช้ `housingCapacity` |
| `survival.mjs` บรรทัด 126 | `capacity:housingCapacity(s)` |
| UI | อ่านผ่าน `capacity(state)` หรือ `evaluateModularHouses(state)` ที่ export จาก engine เท่านั้น |
เพิ่ม test ที่ grep ว่าไม่มี `*6` หรือ `.length*6` ที่คำนวณ capacity หลงเหลือใน `src/` นอก `housing.mjs`

---

## 6. การเปลี่ยน RP1

### 6.1 จุดที่แทนใน `stepProductionPlanning` (`production-planning.mjs`)
- **ลบ** บรรทัด 106–111 (บล็อก `needsHouse` → `queueHouse` → `'build-shelter'` ที่อยู่ก่อน tool chain) และลบ `queueHouse` (บรรทัด 38–46) กับ `houseWood/houseStone/maxBuildings` ใน `PRODUCTION_RULES` บรรทัด 10
- **เพิ่ม** ขั้น `stepHousePlan(s,isWalkable)` **หลังบล็อก charcoal** (บรรทัด 134–136) และก่อน `'stable'` (บรรทัด 137) โดยต้องผ่าน `attemptPeriod` (บรรทัด 123) และ `activeOrders==0` (บรรทัด 105) ก่อน `'stable'` ใช้ได้เมื่อ charcoal ถึงเป้า**และ**ไม่ต้องการบ้านเพิ่มแล้วเท่านั้น
- ผลต่อลำดับ tool chain: การวางชิ้น modular ต้องสวม Hammer ตอนนี้ HAMMER ได้ที่ tick ~190 (ข้อ 0.11) บ้านจึง**ต้องมาหลัง HAMMER** ข้อเสนอคือให้มาหลัง charcoal ≥4 (~tick 334) ด้วย เหตุผลคือ
  - (ก) goal ของ tool chain และ test `shared Axe/Hammer…` (`tests/production-liveness.test.mjs` บรรทัด 32–44) ยังตรงตามลำดับเดิม
  - (ข) births ต้องห่างกัน 4 ปีอยู่แล้ว (`BIRTH_RULES.globalIntervalYears`) ความล่าช้า ~150 tick จึงแทบไม่มีผล
  - ทางเลือกคือวางไว้ระหว่าง HAMMER กับ FURNACE (ดู Open questions)
- เปลี่ยนชื่อ goal ใน history: `house-site`, `craft-WOOD_FOUNDATION|WALL|DOORWAY|ROOF`, `equip-HAMMER`, `house-complete` (validator รับ string อะไรก็ได้ ตาม `production-planning.mjs` บรรทัด 143)

### 6.2 ตรรกะของ `stepHousePlan` (ใช้ authority เดิมเท่านั้น)
```
needsHouse(s) := housingCapacity(s) < BIRTH_RULES.maxPopulation(36)
              && housingCapacity(s) - eligible(s).length <= housePopulationBuffer(6)
              && ไม่มีบ้าน modular ที่ยังสร้างค้าง (evaluateModularHouses: component ที่ complete:false)
builder := คนที่มีชีวิต ทำงาน productive ได้ และมี HAMMER ในกระเป๋า (ถ้ามีหลายคนเลือก id ต่ำสุด)
1) ถ้าไม่มี productionPlan.house → site = selectHouseSite(s,isWalkable)
      (ต่อยอดจาก settlementCell บรรทัด 27–37 ที่ใช้ลำดับวงแหวนเดิม และเพิ่มเงื่อนไขว่า
       validatePlacement(s,{pieceKind:'WOOD_FOUNDATION',socket:cell},walkable,{actor:false}).ok
       และ pathTo(camp,cell)!==null)
      doorSide = ด้านที่ midpoint ใกล้ camp ที่สุด (เสมอกันให้ N<E<S<W)
      บันทึก productionPlan.house={origin:{x,y},footprint:'1x1',doorSide,startedTick}
2) piece = nextHousePiece(s, house)   // มาจาก housing.mjs ห้ามคำนวณเองใน RP1
3) ถ้า builder ไม่ได้สวม HAMMER → rustCommand('EQUIP_ITEM')          (authority เดิม)
4) ถ้ากระเป๋าของ builder ยังไม่มี piece.kind และ stock.wood >= recipe.wood + BIRTH_RULES.woodSafetyFloor(12)
      → rustCommand('CRAFT_ITEM',{agentId:builder.id, recipeId:piece.kind})   (commit ไม้ครั้งเดียวตอน accept)
5) การวางจริงไม่ใช่งานของ RP1 แต่เป็นงานของ BUILD task ใน scheduler (ข้อ 6.3)
6) ถ้าบ้านเสร็จ (evaluate แล้ว complete) → record 'house-complete' และล้าง productionPlan.house
7) ถ้า site ใช้ไม่ได้แล้ว (มีของมาวางทับ foundation socket ก่อน) → ล้าง house แล้วเลือก site ใหม่ในรอบถัดไป
```
- `productionPlan` เปลี่ยนจาก `RP1-0.2` เป็น **`RP1-0.3`** เพิ่ม `house: null | {origin:{x,y}, footprint:'1x1', doorSide:'N'|'E'|'S'|'W', startedTick}` (มีขนาดจำกัด) migration ทำใน `ensureProductionPlan` เหมือนแบบอย่างที่บรรทัด 15 (`RP1-0.2 → RP1-0.3` แล้วใส่ `house:null`) และ `validateProductionPlan` ต้องตรวจ shape ของ `house`
- ข้อจำกัดกระเป๋า: `RUST_POSSESSION_LIMITS.bag=4` (`rust-possessions.mjs` บรรทัด 4) และ Hammer ใช้ 1 ช่อง RP1 จึงคราฟต์ครั้งละ 1 ชิ้นแล้วรอวางก่อนค่อยคราฟต์ชิ้นถัดไป (ขั้น 4 เช็คแค่ `piece.kind` ตัวถัดไป) กระเป๋าจึงไม่เต็ม
- ปิด RP1 (disabled) แล้วต้องได้ผลเหมือน baseline: ไม่วางแผนบ้าน ไม่คราฟต์ และไม่มี BUILD candidate จากแผน RP1

### 6.3 การเดินไปวางชิ้น: เปลี่ยนเป้าหมายของ `BUILD` task แทนการเพิ่ม executor ใหม่
ปัญหาคือตอนนี้ไม่มีใครพาคนเดินไปที่ site (`placeOwnedStation` บรรทัด 80–85 วางข้างตัวเท่านั้น) แต่การวางต้องอยู่ในระยะ 1
- `engine.mjs` บรรทัด 199–203: ลูปเดิมที่วน `buildings.filter(!complete)` ให้เปลี่ยนเป็น `for (const p of pendingPlacements(s,a))` จาก `housing.mjs` โดยอ่าน `productionPlan.house` + `nextHousePiece` + กระเป๋าของ `a` แล้วเพิ่ม candidate `'BUILD'` ที่ anchor cell ของ socket (base 56 เท่าเดิม) มีเฉพาะคนที่ถือชิ้นนั้นเท่านั้น
- `execute` บรรทัด 251–255: เมื่อถึงที่ ให้เรียก `command(s,'PLACE_STATION',{agentId,itemInstanceId,socket,placementId:'pl:'+s.tick+':'+a.id+':'+itemId})` **ผ่าน command() → rustCommand → placeStationFromItem** (executor เดียว) และถ้า `reason==='hammer'` ให้เรียก `command('EQUIP_ITEM')` ก่อนหนึ่งครั้ง (authority เดิม ไม่เขียน equipment เอง)
- `taskValid` (`survival.mjs` บรรทัด 66): BUILD ใช้ได้เมื่อ item ยังอยู่ในกระเป๋า และ `validatePlacement(...,{actor:false}).ok` ของ socket นั้น `claim`/`release` บรรทัด 88–91 และ 100 เปลี่ยน key จาก `targetId` เป็น `'piece:'+itemInstanceId` (คนเดียวต่อชิ้นอยู่แล้ว)
- XP/สถิติ (ข้อเสนอ): `gain(s,a,'BUILD')` + `recordPlanProduction(...,1)` + `stats.built++` + event "สร้างบ้านสำเร็จ · ที่พักเพิ่ม 6 คน" **เฉพาะตอนที่การวางชิ้นนั้นทำให้บ้านเปลี่ยนจาก incomplete เป็น complete** (1 ครั้งต่อบ้าน เท่ากับ Shelter เดิม) การวางชิ้นย่อยไม่ได้ XP (ดู Open question)
- `personal-planning.mjs` บรรทัด 10 และ 105: **คง enum `'finish-shelter'` ไว้** เพื่อให้ save เก่ายังผ่าน validate (label UI `ux.mjs` บรรทัด 238 'สร้างที่พัก' ใช้ได้)
- `unfinished` ที่ส่งให้ `laborAuthoritySignal`/`kingdomEconomySnapshot` (`engine.mjs` บรรทัด 194, 201; `survival.mjs` บรรทัด 125, 134) เปลี่ยนเป็น `evaluateModularHouses(s).houses.filter(h=>!h.complete).length` (+ จำนวน legacy shelter ที่ยังไม่เสร็จ ถ้ามี ตามข้อ 7) **K5 เป็น authority จริงอยู่แล้ว** จึงต้องมีการเทียบ baseline

### 6.4 ถอด Shelter (อยู่ใน PR เดียวกัน)
- `command 'BUILD'` (`engine.mjs` บรรทัด 145–155): การสร้าง shelter ใหม่ต้องคืน `{ok:false,reason:'shelter-removed'}` โดยไม่มี mutation (ดูข้อ 7.2)
- execute branch ที่ใช้ progress ของ shelter (บรรทัด 251–255): คงไว้**เฉพาะ**ให้ shelter `complete:false` ที่มีอยู่ใน save เก่าทำต่อจนเสร็จ (ข้อ 7.2 ข้อ 3) ส่วนการวางชิ้น modular ใช้ตามข้อ 6.3
- UI: ลบ panel "บ้านพักใหม่" (`ux.mjs` บรรทัด 94–108, 163–170) และ tap-to-BUILD (`app.mjs` บรรทัด 247) แล้วแทนด้วยโหมดวางชิ้นตามข้อ 2.3/3
- `validate` ของ `buildings` (`engine.mjs` บรรทัด 385) ขึ้นกับข้อ 7

---

## 7. Save compatibility

### 7.1 สิ่งที่ spec นี้กำหนดแล้ว
- `rustStations`: `RS3-0.2 → RS3-0.3` ทำ migration ในกิ่ง `sourceVersion===SAVE_VERSION` (`engine.mjs` บรรทัด 447) ผ่าน `ensureRustState`/`migrateRustStations` เป็นฟังก์ชันที่ deterministic และ idempotent (ถ้า version เป็น `RS3-0.3` แล้ว ไม่แตะ)
  - CRAFTING_TABLE_LV1/FURNACE: คงไว้ (อาจเพิ่ม `socket` cell level 0)
  - **WOOD_FOUNDATION เก่า** ที่ (x,y): แปลงเป็น `socket:{type:'cell',x,y,level:0}` ความหมายเดิมทุกอย่าง `sourceItemId:null` และ `placementId:'legacy:'+id`
  - **WOOD_WALL / WOOD_DOORWAY / WOOD_ROOF เก่า** (ที่กินช่องเต็มอยู่ข้างๆ support): ข้อเสนอคือตั้ง `socket:{type:'legacy',x,y,level:null}` ให้เป็น **legacy-inert** คือยังแสดงผลที่ช่องเดิมและยังกันช่องนั้น (occupancy เหมือนเดิม) แต่**ไม่นับเป็น support ไม่นับเป็นบ้าน และไม่คืนของ** เหตุผลคือ mapping ไปเป็น edge นั้นกำกวม และการย้ายชิ้นหรือเสกของคืนเสี่ยงต่อ conservation ทางเลือกที่ map ให้เองเมื่อไม่กำกวมอยู่ใน Open questions
  - `rustStations.placements=[]`
- `productionPlan`: `RP1-0.2 → RP1-0.3` (`house:null`) และ goal `'build-shelter'` ใน history เดิมเก็บไว้ได้ (เป็น string)
- save ที่มี `placementId` ซ้ำ, socket ไม่ canonical หรือสองชิ้นอยู่ socket เดียวกัน ใน `RS3-0.3` ถือว่า**เสีย** ให้ reject (`storage.mjs` จะป้องกัน save เดิมไว้ให้)
- `SAVE_VERSION`: ถ้า New Bot เลือกทางเลือก A (เปลี่ยน/ลบ record `shelter` ใน `buildings`) **ต้อง** bump เป็น `0.6.0` และเพิ่มกิ่ง `0.5.0→0.6.0` ใน `migrateSave` (และให้กิ่ง 0.1.0–0.4.0 ต่อเนื่องไปถึง 0.6.0) ถ้าเลือกทางเลือก B schema ของ `buildings` ไม่เปลี่ยน อาจคง `0.5.0` แล้วใช้แค่ extension version ได้ แต่ยังควร bump เพื่อบอกว่า command `BUILD` หายไปแล้ว (ให้ทีมตัดสิน) storage key `simclone:world:v1` คงเดิม

### 7.2 Shelter ใน save เก่า และ Shelter เริ่มต้นใน `createWorld` — **ตัดสินแล้ว (ข้อเสนอ New Bot, aaa01 อนุมัติ, 2026-09-25)**

เลือกทาง **B (legacy capacity record)** โดยมีรายละเอียดดังนี้ ทั้งหมดอยู่ในจุด migration เดียว `RS3-0.2 → RS3-0.3`
1. **Shelter ที่ complete แล้ว** รวมถึง shelter เริ่มต้นใน `createWorld` (id2 ที่ (8,9)) ให้คงไว้ใน `s.buildings` ตามเดิม ไม่ย้าย ไม่ลบ และ `housingCapacity(s)` ใน `src/housing.mjs` นับเป็น +6 ต่อหลัง เท่ากับบ้าน modular ที่ complete ผลคือ capacity ยังเริ่มที่ 12 และ `ecologySignature`/soil ของ seed เดิมไม่เปลี่ยน
2. **ห้ามสร้าง Shelter ใหม่ โดยบังคับที่ engine** ไม่ใช่แค่ซ่อนปุ่มใน UI หรือให้ RP1 เลิกสั่ง ถ้า command `BUILD` ขอสร้าง shelter ใหม่ engine ต้องคืน `{ok:false,reason:'shelter-removed'}` โดยไม่มี mutation ส่วน RP1 และ UI เลิกส่ง `BUILD` สร้าง shelter ทั้งหมด
3. **Shelter ที่ยังไม่เสร็จ (`complete:false`) ใน save เก่า** ที่หักไม้ 12 + หิน 6 ไปแล้ว ให้ BUILD task ยังรับงานต่อได้**เฉพาะ shelter ที่มีอยู่ใน save** จนเสร็จ ไม่คืนวัสดุและไม่หักซ้ำ ตามกติกา atomic เดิม เมื่อเสร็จก็นับ +6 ผ่าน `housingCapacity`
4. `SAVE_VERSION`: schema ของ `buildings` ไม่เปลี่ยน แต่ให้ bump เพื่อบอกว่าสร้าง shelter ใหม่ไม่ได้แล้ว (ทีมเลือกเลขตอน implement)

ข้อกำหนดเรื่องลำดับงาน (aaa01): PR ถอด Shelter **ต้องแตกจาก `main` ที่รวม #65 (WM4.6) แล้วเท่านั้น** — ตอนนี้คือ `304469895e69124c18a086c4989366e821b825f7` เพราะกฎไม้ใหม่ทำให้ไม้บางจุดไม่งอก ตัวเลขว่าบ้าน 1×1 (6 ชิ้น ไม้ 34) เสร็จทันใน 3200 tick หรือไม่ ต้องวัดบน SHA นี้ ห้ามวัดบน `9799a6ac`

---

## 8. Test / verify checklist

### 8.1 test ใหม่ (node --test)
1. **Liveness เดิม** `tests/production-liveness.test.mjs` บรรทัด 57–65 (seed 230926, enable ที่ delay 0/1/2/5/12/30, 3200 tick): ยังต้องได้ `completedChain` (charcoal ≥4) **และ** บ้าน modular complete ≥1 (`evaluateModularHouses(s).houses.some(h=>h.complete)`) **และ** `capacity(s) > capacityก่อนเปิด` (คาดว่า 12 → 18) **และ** `stats.built>=1` **และ** `validate(s)=[]` ต้องยืนยันว่าเสร็จภายใน 3200 tick จริง (ตอนนี้ยังเป็น UNKNOWN เพราะยังไม่มีโค้ด)
2. **Validator/preview parity**: สุ่มแบบ deterministic (loop ตาม seed ห้าม `Math.random`) ครอบคลุม pieceKind × socket × สถานะคน ให้ `previewPlacement(state,d)` กับ `command(copy,'PLACE_STATION',d)` ได้ `ok/reason` ตรงกันทุกกรณี และ `serialize(state)` เท่าเดิมหลัง preview และ validator รันบน state ที่ deep-freeze ได้โดยไม่ throw
3. **Snap-then-support**: pointer ที่ทศนิยมต่างกันแต่ snap ลง socket เดียวกัน ต้องได้ผลเหมือนกัน และ executor ปฏิเสธ socket ที่ไม่ canonical (`'socket-shape'`) โดยไม่มี mutation
4. **Retry-no-double-consume**: ส่ง `PLACE_STATION` ด้วย `placementId` เดิมซ้ำ 2 ครั้ง ไม้/ไอเท็มต้องลดครั้งเดียว มี station 1 ชิ้น ครั้งที่สองได้ `duplicate:true` เพิ่มกรณีที่ log หลุดไปแล้ว (วางเกิน 64 ครั้ง) ต้องได้ `'duplicate-item'` และกรณี refund จำลองต้องได้ item id ใหม่ ส่วน command เก่าได้ `'actor-or-item'`
5. **Support rules**: wall ที่ไม่มี foundation ข้างๆ → `support-foundation`; roof บนช่องที่ไม่มี foundation หรือไม่มีผนัง → `support-roof`; wall ต่อจาก wall (ไม่มี foundation) ถูกปฏิเสธ; wall กับ doorway ใส่ edge เดียวกันไม่ได้
6. **House evaluation**: 1×1 ครบ = complete (+6); ขาด roof หรือผนังหนึ่งด้าน = ไม่ complete; doorway 0 หรือ 2 ชิ้น = ไม่ complete; component 5 ช่อง = ไม่ complete; ลบชิ้นใน test fixture แล้ว capacity ลดทันที
7. **Old save loads**: `tests/fixtures/legacy-0.3.3-save.json` และ save 0.5.0 ที่มี `RS3-0.2` พร้อม wall/roof แบบกินช่อง ต้อง `restore` ผ่าน, foundation กลายเป็น cell socket, wall/roof กลายเป็น legacy-inert, capacity ตรงกับการตัดสินใจในข้อ 7.2 และ restore→serialize→restore ต้อง stable
8. **Single-source capacity**: ไม่มีสูตร `*6` หลงเหลือนอก `housing.mjs` และ `birthPlan().capacity === capacity(s) === survivalSummary(s).kingdomProduction.capacity`
9. **RP1 disabled = baseline**: ไม่มีแผนบ้าน ไม่มีคราฟต์ชิ้นบ้าน และ `serialize` ของ RP1-off ต้องตรงกับ baseline ในขอบเขตที่ spec กำหนด (7.2 เลือก B แล้ว จึงควรตรงกับ baseline ทุก tick)
10. **Save/load กลางการสร้างบ้าน**: ทำแบบ `tests/production-liveness.test.mjs` บรรทัด 67–77 คือกลางแผน `house` ต้อง resume ได้ ไม่มีชิ้นซ้ำ ไม้ไม่ถูกหักซ้ำ และ `serialize(continuous)===serialize(resumed)`

11. **ห้ามสร้าง Shelter ใหม่ที่ engine**: ส่ง `BUILD` สร้าง shelter ใหม่ ต้องได้ `reason:'shelter-removed'` และ `serialize` ก่อนกับหลังเท่ากัน
12. **Shelter ค้างใน save เก่ายังทำต่อได้**: fixture ที่มี shelter `complete:false` ต้องมีคนรับ BUILD task จนเสร็จ ไม้/หินไม่ถูกหักซ้ำและไม่ถูกคืน แล้ว capacity เพิ่ม 6
13. **Capacity เริ่มต้นไม่เปลี่ยน**: `createWorld(seed)` ยังได้ capacity 12 และข้อความที่ `ecologySignature(s)` คืนมาตอน tick 0 ต้องตรงกับข้อความที่ได้จาก `main` `30446989` บน seed เดียวกัน (เทียบทั้งข้อความ หรือเทียบ sha256 ของข้อความก็ได้ `30446989` คือ SHA ของ commit baseline ไม่ใช่ค่าที่คาดไว้) (โครงสร้าง buildings เดิม + WM4.6 ไม่แตะ createWorld)

### 8.2 test เดิมที่ต้องแก้หรือแทน (ห้ามลบทิ้งเฉยๆ ต้องแทนด้วยสัญญาใหม่ที่เทียบเท่า)
- `tests/engine.test.mjs` บรรทัด 19–21 (BUILD shelter) และบรรทัด 23 (water placement ผ่าน BUILD) → เปลี่ยนเป็น PLACE foundation บนน้ำแล้วต้องถูกปฏิเสธโดยไม่มี mutation
- `tests/production-planning.test.mjs` บรรทัด 68–83 (`build-shelter` ที่ tick 1) และบรรทัด 85–94 (ตำแหน่งบ้าน deterministic) → เปลี่ยนเป็นแผนบ้าน modular หลัง HAMMER และ `selectHouseSite` ต้อง deterministic
- `tests/rust-survival-integration.test.mjs` บรรทัด 135–167 (wall วางบนช่องข้างๆ) → เปลี่ยนเป็น edge socket
- `tests/survival.test.mjs` บรรทัด 56, 81, 174 (builder ≤2 คน, hunger interrupt ตอน build, elder build rate) และ `tests/personal-planning.test.mjs` บรรทัด 76–82 (`finish-shelter` completion) → เปลี่ยนมาใช้ BUILD-placement task
- `tests/production-liveness.test.mjs` บรรทัด 7–13 fixture ใส่ `type:'shelter'` ตรงๆ ใช้ต่อได้ เพราะ 7.2 เลือก B (shelter complete ยังนับ +6)
- `tests/ui-smoke.py` บรรทัด 92–101 (panel/confirm BUILD หักไม้ 12 หิน 6) → เปลี่ยนเป็นโหมดวางชิ้น: ghost เขียว/แดงตาม engine, confirm ใช้ item ครั้งเดียว, cancel แล้ว state ไม่เปลี่ยน

### 8.3 checklist ตอน implement / verify
- [ ] แก้ `src/*.mjs` แล้วต้องรัน **`node scripts/pin-assets.mjs`** (บังคับโดย `tests/cache-pins.test.mjs` ซึ่งนับไฟล์ `src/*.mjs` ทั้งหมด ถ้าเพิ่ม `src/housing.mjs` ต้อง pin ใหม่ด้วย) ส่วน `tests/runtime-link.test.mjs` จะตรวจ named export ของโมดูลใหม่ให้เอง
- [ ] `npm test`, `npm run test:survival`, `npm run test:lifecycle`, `npm run test:death`, `npm run test:continuity`, **`npm run test:ecology`** และ `python tests/ui-smoke.py`, `tests/navigation-smoke.py`, `tests/survival-smoke.py`
- [ ] **ตัวที่เป็น gate คือ Verify ของ candidate PR**: `.github/workflows/verify.yml` รันเฉพาะตอน push ไป `feature/**`/`fix/**` และตอนเปิด `pull_request` เข้า `main` เท่านั้น **ไม่รันบน main** ส่วน `.github/workflows/pages.yml` (push main) **ไม่รัน `npm run test:ecology`** ดังนั้น ecology A/B proof มีหลักฐานเฉพาะจาก Verify ของ PR
- [ ] ตรวจ Pages deploy ของ main ที่ merge แล้วแยกต่างหาก (UNKNOWN ไม่ใช่ PASS)
- [ ] อัปเดต `docs/STATUS.md`, `docs/PRODUCTION_PLANNING_RP1.md`, `AGENTS.md` (หัวข้อใหม่), `GAME_PLAN.md` (บรรทัด 46, 104, 110, 310 ยังพูดถึง Shelter) และเพิ่ม doc สัญญา socket (ตอนนี้ระบบ modular **ยังไม่มีเอกสารใน `docs/`**)
- [ ] render: `rustStation()` (`app.mjs` บรรทัด 101–126) วาด edge ตาม side, roof ยกบน foundation cell, depth ของ edge = ผลรวม midpoint และ roof = +0.3 (`app.mjs` บรรทัด 167) เพิ่ม ghost เขียว/แดงสำหรับ cell/edge และเพิ่ม minimap ของ structure ถ้าต้องการ (`navigation.mjs` บรรทัด 57)

---

## 9. ความเสี่ยงและคำถามที่ยังเปิดอยู่

### ความเสี่ยง
1. **สมดุลวัสดุเปลี่ยน**: บ้าน 1×1 ใช้ไม้ 34 (ไม่ใช้หิน) ส่วน Shelter ใช้ไม้ 12 + หิน 6 ไม้เริ่มตึงขึ้นซึ่งไปแข่งกับ `BIRTH_RULES.woodCost`/`woodSafetyFloor` (ต้องมีไม้ 16) spec ให้ RP1 คราฟต์เฉพาะตอน `wood >= recipe + 12` แต่อาจทำให้บ้านช้าลง
2. **Ecology/determinism**: ถ้าบ้าน modular ไม่อยู่ใน `buildings` จะไม่เข้า `ecologySignature`/soil `occupied` บ้านใหม่จึงไม่ส่งผลต่อดินเหมือน Shelter เดิม ถ้าตัดสินใจรวมเข้าไป ต้องเปลี่ยน WM4.6 ซึ่งเป็นงานของ ecology authority และต้องมี proof A/B
3. **ลำดับ RP1**: การย้ายบ้านจาก "ก่อน tool chain" ไปเป็น "หลัง charcoal" ทำให้ `buildings.length`/capacity ช่วงต้นเกมเปลี่ยน (probe เดิมได้ capacity 18 ที่ tick 37) test ที่ผูกกับ tick ต้องแก้
4. **K5 labor authority** ใช้ `unfinished` อยู่ การเปลี่ยนนิยามทำให้คะแนนงาน BUILD และสัญญาณ builder เปลี่ยน จึงต้องเทียบ baseline
5. **Station limit**: ถ้าไม่ขยาย `maxStations` 32 บ้านจะได้ไม่เกิน 5 หลังและตันเร็ว ถ้าขยายเป็น 64 ขนาด save จะโตขึ้น (มี `HISTORY_LIMITS.maxSaveCharacters` คุมอยู่แล้ว)
6. **ชิ้น legacy แบบกินช่อง** ใน save เก่ากลายเป็นชิ้นตกแต่งที่ใช้อะไรไม่ได้ ผู้เล่นอาจรู้สึกว่า "ของหาย"
7. **Hammer ต้องสวมตอนวาง** แต่ `equipForWork` ไม่ทำงานตอนมี order ค้าง (`production-planning.mjs` บรรทัด 105) spec จึงให้ BUILD task เรียก `EQUIP_ITEM` เองหนึ่งครั้ง ต้องมี test กันไม่ให้สลับ Axe↔Hammer ไปมา
8. **ผู้เล่นวางชิ้นเองต้องอยู่ในระยะ 1** เพราะยังไม่มี command สั่งคนให้เดินไป UX จึงยากกว่า BUILD เดิม
9. การรวมทุกอย่างใน PR เดียว (ตามข้อจำกัดของทีม) ทำให้ PR ใหญ่และ review ยาก ควรแบ่งเป็น commit ย่อยใน PR เดียว

### คำถามที่ยังเปิดอยู่
1. ~~ข้อ 7.2~~ ตัดสินแล้ว: ทาง B ตามข้อ 7.2
2. บ้าน modular ที่ complete ควรเป็น home ของ EAT/REST ด้วยไหม (กระทบ routing/survival proofs)
3. XP ของ BUILD: ให้ครั้งเดียวตอนบ้านเสร็จ (ข้อเสนอ) หรือให้ทุกชิ้น (XP พอง)
4. บ้านต้องมี doorway **พอดี 1** หรือ **≥1**; ขนาดสูงสุด 4 ช่องเหมาะไหม; บ้านใหญ่ควรได้ capacity มากกว่า 6 ไหม
5. แผนบ้านใน RP1 ควรอยู่หลัง HAMMER แต่ก่อน FURNACE หรือหลัง charcoal (ข้อเสนอ)
6. ชิ้น legacy แบบกินช่อง: ใช้ inert (ข้อเสนอ) หรือ map ไปเป็น edge ให้เองเมื่อมี foundation ข้างๆ พอดี 1 อัน หรือเพิ่ม command salvage ภายหลัง
7. ควรบังคับ `placementId` กับ CRAFTING_TABLE/FURNACE ด้วยไหม
8. ผนังควรบังทางเดินในอนาคตไหม (ต้องเปลี่ยน `routeField`)
9. ควร bump `SAVE_VERSION` เป็น 0.6.0 แม้จะเลือกทางเลือก B ไหม

---

## UNKNOWN (ยืนยันจากโค้ดไม่ได้)
1. **ไม่รู้ว่าบ้าน 1×1 จะเสร็จภายใน 3200 tick บน seed 230926 จริงหรือไม่** ยังไม่มีโค้ด และยังไม่ได้ probe ซ้ำบน `30446989` (probe เก่าบน `9799a6ac` ได้แค่ HAMMER ที่ 190 และ charcoal ที่ 334)
2. ไม่รู้ว่าการถอดหรือเปลี่ยน shelter จะกระทบ WM4.6 ecology proof (อาหาร+ไม้) และ continuity 120/1800 ปีเป็นตัวเลขเท่าไร (รู้แค่ว่า `buildings` ยังอยู่ใน `ecologySignature` บรรทัด 39–44)
3. ไม่พบเอกสารหรือ PR ที่อธิบายเจตนาของระบบ modular (ไม่มีใน `docs/`, STATUS และ RUST_SURVIVAL doc) ข้อมูลที่รู้จึงมาจากโค้ดและ test บรรทัด 135–167 เท่านั้น
4. ไม่พบกลไกถอด/พัง/refund structure ในโค้ด พฤติกรรม capacity ตอนชิ้นถูกถอดในข้อ 5.1 จึงเป็นสัญญาสำหรับอนาคต
5. ใน `src/` ไม่มีข้อมูลความสูงหรือ elevation ที่ใช้ในเกมเพลย์ ("height" ใน spec นี้คือ `level` ที่จะเพิ่มใหม่) ส่วน `elevation` ใน `worldsim-map.mjs` ใช้แค่วาดภาพ
6. ไม่รู้ว่ามี save จริงของผู้เล่นที่มีชิ้น WOOD_* วางอยู่แล้วกี่ไฟล์ และมี shelter ที่ยังไม่เสร็จหรือไม่
7. ไม่ได้รัน suite Python/Chromium ในงานนี้ ผลของ UI smoke ทั้งหมดจึงเป็น UNKNOWN
8. ต้นทุน performance ของการเรียก `evaluateModularHouses` ทุก frame ใน browser จริง (มือถือ Android)

## 10. ภาพและ UI ของชิ้นส่วน — **ตัดสินแล้ว (2026-09-25 ตอบ UNKNOWN ของสกา)**

ทั้งหมดเป็นเรื่องการวาด ไม่แตะ engine และไม่เปลี่ยน save

ลำดับงาน: (a) PR เอา Shelter ออก + RP1 วางบ้าน modular (ไม่มี ghost, หมุน, ลบ; engine รับ `edge` ได้) แล้ว (b) Building Mode = ghost + หมุน แล้ว (c) Structural Snap แล้ว (d) P3 = HP/ซ่อม/ลบ

1. **ขนาดพิกเซล** ใช้ค่าของสกา: ฐานหนา 3 px, ผนังสูง 28 px, หลังคาชัน 16 px เก็บเป็นค่าคงที่ใน renderer ที่เดียว
2. **หลังคาหลายช่อง** engine ยังเก็บหลังคา 1 ชิ้นต่อ 1 ช่องเหมือนเดิม ตอนวาด ถ้าช่องข้างๆ ที่อยู่ในบ้านหลังเดียวกัน (ตาม `evaluateModularHouses`) มีหลังคาด้วย ให้ข้ามการวาดจั่วด้านที่ติดกัน หลังคาจะดูต่อกันโดยไม่มีร่อง
3. **ประตูขอบ N/W ถูกหลังคาบัง** ไม่จำกัดขอบประตูใน engine แต่ตอนอยู่ในโหมดสร้าง (Building Mode ที่มี ghost) หรือเมื่อเมาส์ชี้บ้าน ให้วาดหลังคาด้วย alpha 0.35 เพื่อให้เห็นประตูและผนังด้านหลัง
4. **ghost ที่ไม่มี `ok`** ให้เป็นสีแดง (fail-closed) ทั้ง ghost ใหม่และ ghost เดิม ต้องมีเทสต์กรณีนี้ใน P2
5. **หมุน** เป็นเรื่อง UI อย่างเดียว คือเลือกว่า ghost จะใช้ขอบ N/E/S/W ไหนก่อนกดวาง คำสั่งวางยังส่ง socket ที่ snap แล้วตามข้อ 3 เหมือนเดิม ไม่ต้องมีคำสั่งใหม่ใน engine ทำพร้อม ghost ใน Building Mode ไม่อยู่ใน PR เอา Shelter ออก
6. **ลบ** ไม่อยู่ทั้งใน PR เอา Shelter ออก, Building Mode และ Structural Snap ไปทำใน P3 พร้อม HP/ซ่อม (ตามข้อเสนอ aaa01) เพราะต้องกำหนดกฎคืนวัสดุและกฎลบฐานที่มีชิ้นอื่นตั้งอยู่ก่อน ไอคอนลบเก็บไว้แต่ยังไม่ผูกคำสั่ง ถ้ามีคำสั่งลบโผล่ในงานก่อน P3 ถือว่าหลุดขอบเขต
7. **ตำแหน่งวาดชิ้นบนขอบ** ใช้ `x`/`y`/`side` ของ socket ที่เก็บไว้ (ชื่อฟิลด์คือ `side` ตามข้อ 1.2 ส่วน `'edge'` เป็นค่าของ `type`) ไม่ใช้ anchor ของฐาน `side` ใน save มีแค่ N/W การตัดสินว่าผนังอยู่หน้าหรือหลังบ้าน ให้ดูว่าฐานของบ้านอยู่ช่องไหนในสองช่องที่ขอบนั้นคั่น (ฐานอยู่ช่อง (x,y) = ขอบหลังของบ้าน, ฐานอยู่ช่อง (x−1,y) หรือ (x,y−1) = ขอบหน้า) ทุกทางที่รับ E/S (RP1, ghost, หมุน) ต้องเรียก `canonicalEdge` ก่อนเช็กว่าง และ executor ปฏิเสธ socket ที่ไม่ canonical อยู่แล้ว (ข้อ 1.2) `placementId` ไม่มี side อยู่ในนั้น จึงไม่เกิด id สองตัวจากชื่อขอบ
8. **ผนังหน้าบังประตูขอบหลัง** `{xray:true}` ให้วาดทั้งหลังคาและผนัง/ประตูที่อยู่ขอบหน้าของบ้าน (S/E เมื่อมองจากบ้าน) ที่ alpha 0.35 ผนังขอบหลังยังทึบ ใช้ค่าคงที่ alpha ตัวเดียวกัน
9. **รูปหลังคาตามรูปบ้าน** renderer เลือกรูปหลังคาจาก mask ของช่องข้างๆ ที่อยู่ในบ้านหลังเดียวกันได้เอง รับแบบของสกา: 2×2 เป็นยอดแบน และมุมในของรูปตัว L เป็นร่องรับน้ำ เป็นเรื่องภาพอย่างเดียว engine ยังเก็บหลังคาช่องละหนึ่งชิ้น
