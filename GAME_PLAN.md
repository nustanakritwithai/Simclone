# Autonomous Clone World — Master Game Plan

> **Repository:** Simclone  
> **Target:** Autonomous Society Simulation + Survival + Automation + Colony Sim + Emergent Narrative  
> **Core rule:** โลกต้องเดินต่อได้เมื่อผู้เล่นหยุดออกคำสั่ง

---

## 1. Vision

ผู้เล่นคือ **Original** คนแรกของโลก สร้าง Clone และเฝ้าดูสิ่งมีชีวิตที่เริ่มจากต้นแบบเดียวกันค่อย ๆ แตกต่างจากประสบการณ์ ความรู้ ความสัมพันธ์ สังคม และการตัดสินใจ จนเกิดเป็นอารยธรรมที่ดำเนินต่อได้เอง

จุดขายไม่ใช่จำนวน NPC แต่คือ **ความต่อเนื่องของเหตุและผลข้ามคนและข้าม Generation**

### Game Pillars

- **Autonomy** — Clone เลือกและลงมือเอง
- **Learning** — ประสบการณ์กลายเป็น Skill และ Knowledge
- **Emergence** — เรื่องราวเกิดจากระบบ
- **Legibility** — ผู้เล่นเห็นว่าใครทำอะไรและทำไม
- **Continuity** — ความรู้และประวัติศาสตร์ข้าม Generation
- **Scalability** — CPU ทำ known path; AI ใช้กับ novelty

---

## 2. Core Game Loop

```text
PLAY
→ OBSERVE
→ TEACH / INFLUENCE
→ CLONE
→ LEARN
→ AUTOMATE
→ SPECIALIZE
→ FORM SOCIETY
→ EVOLVE
→ HISTORY
→ CONTINUE
```

### Progression

**Early**
- เก็บ Food / Wood / Stone
- สร้าง Shelter
- สร้าง Clone
- ดู Needs และ Skill แรก

**Mid**
- อาชีพ
- Mentor / Student
- Relationship
- Knowledge transfer
- Faction

**Late**
- หลาย Generation
- เมือง
- Economy
- Conflict
- Culture
- Technology

**Endless**
- โลกสร้างประวัติศาสตร์ต่อเอง
- ผู้เล่นกลับมาแล้วพบการเปลี่ยนแปลงที่ไม่ได้ script ไว้

---

# 3. Development Roadmap

## V0.1 — Simulation Skeleton

### Goal
ทำให้มีโลกที่ tick ได้อย่าง deterministic

### Systems
- Tick scheduler
- World state
- Agent entity
- Resource node
- Basic renderer
- Pause / Speed / Reset
- Seed

### Definition of Done
- รัน 10,000 ticks โดย state ไม่เสีย
- Reset ด้วย seed เดิมได้ผลเหมือนเดิม
- UI ไม่มี simulation rule

---

## V0.2 — Survival Loop

### Systems
- Food / Wood / Stone
- Hunger
- Energy
- Health
- Forage
- Rest
- Inventory
- Shelter

### Rules
- Hunger ต่ำ → EAT / FORAGE priority สูง
- Energy ต่ำ → REST
- starvation ลด Health
- Shelter มีผลต่อ population growth

### Definition of Done
- Agent หาอาหารและพักได้โดยไม่ต้องสั่งทุก tick
- Resource ไม่ติดลบ
- ไม่มี infinite resource loop

---

## V0.3 — Clone + Lifecycle

Current lifecycle-history contract: [V0.3.5](docs/LIFECYCLE_0.3.5.md). Current next steps: [NEXT_STEPS](docs/NEXT_STEPS.md). V0.3.4 generation continuity is the retained baseline; earlier release descriptions below are historical.

Concrete lifecycle/save contract: [docs/LIFECYCLE_0.3.0.md](docs/LIFECYCLE_0.3.0.md)

Current clock contract: **360 ticks = 1 simulated day = 1 biological year**; CHILD 0–15, ADULT 16–54, ELDER 55+, DEAD overrides age. V0.3.1 stage effects, V0.3.2 autonomous birth, V0.3.3 deterministic lifespan/age death and V0.3.4 generation continuity are retained. V0.3.5 adds evidence-based stable death history; retained-history limits and bounded performance remain follow-up gates before skill provenance.

### Agent Identity
- id
- name
- generation
- parent
- appearance

### Life
- age
- child / adult / elder
- hp
- hunger
- energy
- death

### Rules
- Child → Adult → Elder → Death
- Elder ผลิตงานลดลง แต่มีค่าด้าน teaching / experience
- Character appearance เป็น identity ถาวร
- Role icon แยกจาก identity

### Definition of Done
- เกิด Generation ใหม่จากระบบ
- parent link ถูกต้อง
- aging/death reproduce ได้ด้วย seed

---

## V0.4 — Skill System

### Initial Skill Families
- FORAGE
- WOODCUT
- MINE
- BUILD
- EXPLORE
- SOCIAL

ภายหลัง:
- COMBAT
- RESEARCH

### Skill Model
- XP
- Level
- V1 → V2 → V3
- Source
- Preconditions
- Effects

### Requirement
Skill level ต้องมีผลต่อ gameplay จริง เช่น:
- เวลา
- output
- failure rate
- resource efficiency
- risk

---

## V0.5 — Memory + Cultural Knowledge

### Memory Types
- Episodic Memory
- Social Memory
- Knowledge provenance
- Belief

### Knowledge Transfer
- Parent inheritance
- Mentor teaching
- Faction knowledge
- Cultural Archive
- Personal discovery

### Critical Rule
คนตายได้ แต่ความรู้ที่บันทึกใน Cultural Archive แล้วต้องไม่หายตามคน

---

## V0.6.4 — Stabilized Baseline

ล็อก baseline ของ:
- population
- lifecycle
- resources
- buildings
- skills
- inheritance
- archive
- save/load
- pause/speed/reset
- inspector

### Regression Rule
Feature ใหม่เพิ่มเป็น module  
ห้าม rewrite ของเดิมโดยไม่จำเป็น

---

# 4. V0.7 — Decision Brain

เปลี่ยนแกนการตัดสินใจจาก random เป็น **Candidate Scoring ที่อธิบายได้**

```text
World State
→ Perception
→ Needs
→ Goals
→ Memory
→ Candidate Actions
→ Score
→ Validate
→ Execute
→ Outcome
→ Learn
```

## Score Factors

- Need
- Goal
- Skill
- Social
- Expected Value
- Distance
- Risk
- Cost

ตัวอย่าง:

```text
Score(action)
= Need
+ Goal
+ Skill
+ Social
+ Expected Value
- Distance
- Risk
- Cost
```

## Hard Validation
ถ้า precondition ไม่ผ่าน action ใช้ไม่ได้ ไม่ว่าคะแนนสูงแค่ไหน

## Decision Trace
ทุกการตัดสินใจสำคัญต้องบันทึก:
- candidates
- score breakdown
- selected action
- rejected actions
- validation result

---

# 5. V0.8 — Perception + Local Knowledge

Agent ต้องไม่รู้ทุกอย่างในโลก

### Sources of Knowledge
- เห็นเอง
- ได้ยิน
- ถูกบอก
- เรียนจาก mentor
- faction
- archive

### Requirements
- แต่ละ Agent มี knowledge map ต่างกัน
- ข่าวสารเดินทางผ่าน social interaction
- belief อาจไม่ตรงกับ truth
- provenance ต้องรู้ว่า “รู้จากไหน”

---

# 6. V0.9 — Spatial World + Pathfinding

### World Objects
- Agent
- Resource
- Shelter
- Building
- Enemy
- Event

ทุกอย่างมีตำแหน่งจริง

### Action Contract
```text
Choose target
→ Plan path
→ Move
→ Reach target
→ Validate again
→ Execute
```

### Distance
ระยะทางต้องมีผลต่อ decision cost

---

# 7. V1.0 — 100-Day Autonomous Proof

นี่คือ milestone สำคัญที่สุดก่อนขยายระบบสังคมใหญ่

## Test Setup
- Original + Clone จำนวนน้อย
- ปล่อย simulation 100 วัน
- ห้ามผู้เล่นแก้ปัญหาด้วย micromanagement

## PASS Conditions
- population ไม่ล่มจาก bug
- เกิดอย่างน้อย 2 Generation
- Agent มี Skill / Memory / อาชีพแตกต่างกัน
- knowledge ส่งต่อข้ามรุ่นจริง
- มี social relationship
- เกิด emergent group
- วิกฤตทำให้ priority เปลี่ยนอย่างมีเหตุผล
- Inspector อธิบาย action ได้
- Chronicle สรุป 100 วันได้
- seed + event log replay bug ได้

ถ้า V1.0 ยังไม่ผ่าน **ห้ามแก้ด้วยการเพิ่มระบบใหญ่ขึ้น**

---

# 8. Social Brain — V1.1

### Relationship State
- Trust
- Affinity
- Respect
- Fear
- Debt

### Relationship Types
- Friend
- Rival
- Family
- Mentor
- Student

### Rule
ความสัมพันธ์เปลี่ยนจากเหตุการณ์จริง และต้องมีผลต่อ:
- teaching
- trade
- faction
- conflict
- leadership

Leader ควรเกิดจาก skill + respect + support ไม่ใช่ random ล้วน

---

# 9. Faction — V1.2

- สร้าง / ยุบ / แตก / รวม
- Leader succession
- member join / leave / exile
- faction goals
- rules
- resources
- knowledge
- settlement
- territory
- alliance
- trade
- rivalry
- conflict

---

# 10. Economy — V1.3

### Layer 1
Shared Food / Wood / Stone

### Layer 2
Specialization
- Forager
- Builder
- Miner
- Explorer
- Researcher
- Guard

### Layer 3
Production
- tools
- buildings
- processing

### Layer 4
Exchange
- barter
- faction trade

### Advanced
scarcity + demand + logistics → value

---

# 11. Conflict — V1.4

เริ่มจาก:
- environmental threat
- animal threat

ก่อน:
- war

### Conflict Causes
- scarcity
- territory
- relationship
- faction goal

### Behaviors
- defend
- guard
- retreat
- negotiate
- alliance

ผล combat ต้องเขียนลง:
- Memory
- Relationship
- Chronicle

---

# 12. Culture + Discovery — V1.5–V1.6

```text
Experience
→ Hypothesis
→ Experiment
→ Outcome
→ Verification
→ Cultural Knowledge
```

### Properties
- ความรู้ผิดสามารถแพร่ได้
- ความรู้ผิดสามารถถูกพิสูจน์ผิด
- เมืองต่างกันมี technology ต่างกัน
- วัฒนธรรมพบกัน → knowledge transfer
- รุ่นหลังสร้างสิ่งที่ Original ไม่เคยรู้

---

# 13. Evolution — V1.7

เป้าหมายไม่ใช่แค่ stat mutation แต่เป็นการเปลี่ยนแปลงระยะยาวจาก:
- culture
- environment
- specialization
- technology
- social pressure
- historical accidents

---

# 14. AI Brain — V1.8

LLM ไม่ควรอยู่ในทุก tick

ใช้สำหรับ:
- novelty
- ambiguity
- reflection
- new hypothesis
- proposing new behavior/skill
- summarizing major history

ต้องมี:
- budget
- cooldown
- trigger condition
- deterministic fallback
- verification

---

# 15. AI CPU / Reasoning Compilation — V1.9

## System 0
Deterministic execution
- movement
- inventory
- skills
- state transitions

## System 1
CPU decision
- scoring
- planning
- search
- candidate selection

## System 2
LLM
- novelty
- ambiguity
- reflection

## Learning Flow

```text
LLM Proposal
→ Validate Preconditions
→ Execute in controlled path
→ Verify Outcome
→ Store Evidence
→ Promote to Knowledge
→ Compile into deterministic Skill/Rule
```

### Core Principle

> อย่า generate ถ้าเลือกได้  
> อย่า reasoning ถ้าคำนวณได้  
> สิ่งที่เรียนรู้แล้วควรไหลจาก AI → verified knowledge → deterministic skill

---

# 16. UX/UI — World Observation UI

## Primary UX

```text
OBSERVE
→ UNDERSTAND
→ INFLUENCE
```

## Main Screen

### Center
World

### Left
- Observe
- Influence
- Build
- Zones
- Map

### Right
Selected Clone Inspector

### Bottom
Timeline + Chronicle events

---

## Clone Inspector

### Identity
- Portrait
- Name
- Generation
- Parent
- Role

### State
- Hunger
- Energy
- Health

### Mind
- Goal
- Thought
- Memory

### Capability
- Skills
- knowledge source

### Social
- faction
- relationships

### Decision Trace
- candidates
- scores
- selected action
- why

---

## Thought Bubble

แสดงเฉพาะข้อมูลสำคัญ:
- Need
- Discovery
- Social event
- Conflict
- Emergency

ห้าม spam ทุก action

---

## Timeline / Chronicle

Track:
- Birth
- Death
- Discovery
- Faction
- Leader
- Disaster
- Conflict

รองรับ:
- event selection
- replay
- jump to agent
- jump to place
- generation view

---

## Knowledge View

แสดงเส้นทางความรู้:
- discoverer
- mentor
- parent
- faction
- cultural archive
- learner
- version

---

## Relationship View

เลือก Agent หนึ่งคน แล้วแสดง graph รอบตัว:
- family
- friend
- rival
- mentor
- faction

ห้ามวาด social graph ทั้งโลกพร้อมกันจนอ่านไม่ได้

---

## Mobile UX

- World เต็มจอ
- Inspector → Bottom Sheet
- Main nav → Bottom Bar
- Thought bubble → icon first
- Timeline → horizontal scroll

---

# 17. Technical Modules

```text
world/
agents/
decision/
skills/
knowledge/
society/
simulation/
ai/
verification/
ui/
persistence/
```

## Tick Pipeline

```text
Tick
→ World Update
→ Perception
→ Needs
→ Decision
→ Validate
→ Execute
→ Outcome
→ Memory
→ Learning
→ Society/Event
→ Snapshot
→ UI Render
```

### Critical Rule
UI อ่าน state จาก Engine เท่านั้น  
UI ห้ามเป็นเจ้าของกฎ simulation

---

# 18. Minimum Data Model

## Agent
- id
- name
- generation
- parent
- appearance
- life
- needs
- goal
- faction

## Skill
- id
- level
- xp
- source
- preconditions
- effects

## Memory
- agent
- event
- time
- perception
- valence
- provenance

## Knowledge
- id
- version
- discoverer
- evidence
- visibility

## Relationship
- a
- b
- trust
- affinity
- respect
- fear
- debt

## Faction
- id
- leader
- members
- goals
- rules
- resources

## WorldEvent
- id
- type
- position
- participants
- effects
- time

## Chronicle
- event
- significance
- narrative
- provenance

---

# 19. Verification / Regression

ต้องตรวจอย่างน้อย:

- Population และ life stages
- Generation เกิดเองได้
- Parent inheritance
- Cultural Archive
- Skill V1 → V2 → V3
- Needs / resources / building
- Relationship / Faction persistence
- Aging / Death
- Pause / Speed / Reset
- Inspector ตรงกับ simulation state
- seed + event log reproduce bug

---

# 20. VIP Development Rule

ทุก milestone ใช้:

```text
Verify
→ Improve
→ Prove
```

## Before Coding
กำหนด:
- Success Contract
- Definition of Done
- Verification Plan

## After First Result
ผลแรก = candidate

## Verification State
- SAT
- VIOL
- UNKNOWN

**UNKNOWN ห้ามนับเป็น PASS**

---

# 21. Performance Strategy

- Agent ไกลใช้ simulation fidelity ต่ำลง
- Known skills ใช้ deterministic code
- Decision scoring ทำ batch / CPU
- Perception จำกัดพื้นที่
- Memory retrieval เฉพาะที่เกี่ยวข้อง
- LLM มี budget / cooldown
- Full fidelity เฉพาะพื้นที่สำคัญ

---

# 22. MVP Content Scope

- 1 main biome
- forest / ore / water / base
- 3–5 resources
- 6–8 jobs
- 5–8 buildings
- 6–10 skill families
- 3 natural disasters
- 2–3 basic animals/enemies
- 3 initial faction archetypes

---

# 23. Do Not Build Before V1.0

- ไม่ทำ 3D ใหญ่ก่อน Decision / Perception ผ่าน
- ไม่เพิ่มหลายเมืองก่อนโลกเดียวอยู่รอด 100 วัน
- ไม่เรียก LLM ทุก Agent ทุก tick
- ไม่ทำสงครามซับซ้อนก่อน Social/Faction เสถียร
- ไม่ rewrite engine เพื่อแก้ UI
- UI แสดงค่าได้ไม่ถือว่าระบบผ่าน ต้องมี test

---

# 24. Next Build Order

1. Simulation Skeleton
2. Survival loop
3. Lifecycle
4. Skill system
5. Memory / Knowledge
6. Stabilized baseline
7. V0.7 Decision Brain + Decision Trace
8. V0.8 Perception + Local Knowledge
9. V0.9 Spatial + Pathfinding
10. V1.0 100-Day Autonomous Proof
11. Social
12. Faction
13. Economy
14. Conflict
15. Culture
16. Discovery
17. Evolution
18. AI Brain
19. AI CPU / Reasoning Compilation
20. V2.0 Living World

---

# 25. Final Product Vision

ผู้เล่นสามารถกลับมาเปิดโลกหลังปล่อย simulation ไปหลายร้อยปี แล้วพบว่า Clone รุ่นหลังสร้างเมือง กลุ่ม ความรู้ เทคโนโลยี และเรื่องเล่าที่ไม่ได้ถูก script ตายตัวตั้งแต่แรก

ผู้เล่นเลือกเป็น:
- ผู้สร้าง
- ผู้สอน
- นักสำรวจ
- ผู้สังเกต
- ผู้แทรกแซง

แต่โลกต้องมีแรงขับของตัวเอง

## Heart of the Game

```text
คนหนึ่งพบสิ่งใหม่
→ เรียนรู้
→ ถ่ายทอด
→ คนรุ่นหลังดัดแปลง
→ สังคมเปลี่ยน
→ เหตุการณ์กลายเป็นประวัติศาสตร์
```
