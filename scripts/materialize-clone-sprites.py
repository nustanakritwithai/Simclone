#!/usr/bin/env python3
"""Decode art/**/*.b64 into the sibling binary image. Leaves the .b64 files in place."""
import base64
from pathlib import Path

root = Path(__file__).resolve().parents[1]
count = 0
for src in root.rglob("*.b64"):
    dest = src.with_suffix("")
    dest.write_bytes(base64.b64decode(src.read_text(encoding="ascii"), validate=True))
    count += 1
print(f"wrote {count} files under {root}")
