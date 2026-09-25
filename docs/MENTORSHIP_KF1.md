# Knowledge Follow-through KF1 — Mentorship

KF1 adds a bounded persistent Mentor → Student relationship on top of
evidence-backed personal knowledge.

- one living student has at most one active Mentor
- relationship creation requires communication range
- confirmed Mentor claims transfer as UNVERIFIED
- teaching never grants Skill XP
- independent observation/work is still required for confirmation and XP
- the same Mentor-link + knowledge key is idempotent and is never resent
- every 120 ticks at most one new untaught confirmed claim is transferred
- death closes active links but preserves historical relationship records
- 16 retained links, 4 remembered taught keys per link

The slice deliberately does not infer trust, affection, respect or motives.
Those belong to the later event-based social gate.

Persistence stays in the 0.5.0 save family as a bounded optional extension.
Older valid 0.5.0 saves receive an empty mentorship state.

UNKNOWN is not PASS; exact candidate CI and exact merged-main Pages are release
authority.
