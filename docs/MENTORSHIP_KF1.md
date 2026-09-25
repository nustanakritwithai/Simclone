# Knowledge Follow-through KF1 — Mentorship

KF1 adds a bounded, persistent Mentor → Student relationship on top of evidence-backed personal knowledge.

## Rules

- a living student can have at most one active Mentor
- a Mentor may have multiple students within the bounded link budget
- creating a relationship requires communication range
- the engine can select the nearest eligible student when the UI omits one
- every 120 ticks, at most one untaught confirmed claim may be taught across the active links
- manual teaching uses the same engine contract
- taught claims enter the student as UNVERIFIED
- teaching never grants Skill XP
- independent observation/work is still required for confirmation and XP
- death ends active links but keeps the historical relationship record

## Bounds

- 16 retained mentorship links
- 4 taught claim keys per link
- one automatic teaching operation per 120-tick boundary

The first slice deliberately does not infer trust, affection, respect or motives. Those belong to the later event-based social relationship gate.

## Persistence

`mentorship` is an optional 0.5.0 extension. Older valid 0.5.0 saves receive an empty mentorship state. Malformed present state fails validation.

Exact candidate CI and exact merged-main Pages remain release authority. UNKNOWN is not PASS.
