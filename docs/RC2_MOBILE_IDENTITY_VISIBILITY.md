# RC2 mobile item identity — post-merge visual repair

Base: `9849420b184b38ffc13abe1844ae87bb1f36e93d` (PR #171).

## Failure and success contract

A second inspection of native Chromium mobile screenshots exposed a legacy rule in `src/ux.css`: `.ux-v2 .visual-inventory-slot b { display:none }` inside the narrow-screen media query. It also hides new RC2 item names and the stored tier badge, although quality and abilities remain visible and existing DOM/value checks pass.

Name and tier must be visually rendered on both desktop and mobile, alongside the existing creator, quality and abilities. Use a narrowly scoped CSS override for physical item cards and RC2 tier badges; do not unhide unrelated icon-only labels. Refresh the crafting stylesheet URL to `rc2.5.2`. No simulation, save, recipe, item, training, equipment or authority logic changes.

## Reproduction and repair evidence

The strengthened real-button smoke checks `is_visible()` and exact name/tier text before equipping gear. With only those checks added and the original CSS retained, mobile fails with `AssertionError: 390: item name is visually rendered`. After the scoped CSS repair, the same full desktop/mobile offline lifecycle passes 48/48 checks; screenshots include a cropped actual gear card and scroll to completed practice before capturing that state.

Offline proof is not native or public proof. Existing Verify and Pages workflows automatically run this same strengthened script in native/public modes, retaining all prior gates. Expected native/public total is 70 checks across both viewports (48 lifecycle/visibility + 22 HTTP/source-byte checks). Require exact-head Verify before merge and exact-main Pages/public SWA7/public RC2 after merge. UNKNOWN is not PASS. Final SHAs and run evidence are recorded on the hotfix PR, not pre-approved by this document.
