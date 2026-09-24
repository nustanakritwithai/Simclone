# RS4 — First authoritative Furnace processing

Stack:
`K6 -> RS1 crafting -> RS2 possessions -> RS3 stations -> RS4 materials`.

RS4 activates exactly one Rust Island furnace process:

```
Wood 2 -> Charcoal 1
```

Why charcoal first:
- Wood already has one authoritative Simclone stock owner.
- Furnace authority exists from RS3.
- Output gets a bounded dedicated Rust survival material ledger.
- No animal/water acquisition rules need to be invented.

Still blocked:
- Raw Meat -> Cooked Meat
- Dirty Water -> Clean Water

Those remain non-authoritative until acquisition and storage ownership exist.

RS4 also makes processing reservations visible to RS2 tool crafting so one pile of wood cannot be promised to both a Furnace order and a tool order.
