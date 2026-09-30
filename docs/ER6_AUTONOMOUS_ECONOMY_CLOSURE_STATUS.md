# ER6 Autonomous Economy Closure — Current Evidence / Blockers

Date: 2026-09-30  
PR: #225  
Status: **DRAFT / NOT CANDIDATE SAT**

Exact branch head when this note was first written is not a release claim. Always use the current PR head for evidence.

## Closed candidate slices

### Consumer integration

The released economy already contained:
- ER1 actor-observed item demand;
- work-tool needs from canonical profession/preference + Rust ownership;
- Adventurer WEAPON/ARMOR needs from released Adventure equipment state;
- RC4 customer policy;
- canonical Navigation, Wallet, Trade, Listing and Rust equipment commands.

The missing piece was normal-world coordination.

ER6 now adds a proposal-only bridge that:
- reads only ER1 `PERSONAL_ITEM_NEED` evidence;
- filters supply to fresh/current actor-observed Listings;
- uses canonical market travel;
- buys through `RC4_BUY_LISTING`;
- equips purchased work tools / Adventure gear through `EQUIP_ITEM`;
- does not change profession;
- does not create a new inventory, Wallet, Ledger, Trade Kernel or Navigation authority.

### Crafter output → Merchant integration

Released ER3 ended at production and released ER5 could create funded BuyOffers, but no autonomous Crafter policy answered a physical-item BuyOffer after craft completion.

The mutation authority already existed: `RC4_ACCEPT_BUY_OFFER`.

ER6 now adds bounded Crafter market-supply coordination that:
- is limited to released Crafter profession;
- considers only canonical tradable physical items crafted by that Crafter;
- considers only fresh/current actor-observed physical BuyOffers from ER1;
- walks to the exact Home Market through canonical Navigation;
- calls `RC4_ACCEPT_BUY_OFFER` only after Navigation-owned arrival;
- leaves settlement to released ER5/Trade Kernel;
- creates no new market or item authority.

## Remaining closure blocker: autonomous raw-material brokerage

**Verdict: BLOCKED / UNKNOWN for full ER6 closed-loop proof.**

The required loop needs Producer-origin bulk resource to reach the Crafter without player trade commands:

```text
Producer A → Merchant C → Crafter B
```

The mutation path already exists:
- Merchant funded bulk BuyOffer;
- Raw Producer autonomous gather/reserve/respond;
- canonical bulk settlement;
- Merchant bulk resale Listing;
- ER4 Crafter canonical procurement.

The unresolved problem is the **legal demand observation that should cause Merchant C to start that chain**.

At current released ER1:
- local physical-item needs of nearby actors are projected as `LOCAL_ITEM_NEED`;
- bulk `HOUSEHOLD_SHORTAGE` is projected only for the actor whose demand projection is being computed;
- a nearby Crafter's recipe/material shortage is not published into another actor's ER1 projection;
- ER4 knows the Crafter is missing material, but ER4 is the Crafter's procurement policy and is not a Merchant demand oracle.

Therefore a Merchant cannot currently infer “Crafter B needs wood/stone for this demanded recipe” from the released legal observation surface.

A fixture could manually create a bulk BuyOffer or pre-seed a bulk Listing, but that would not prove:

```text
real Crafter shortage → legal Merchant observation → autonomous funded BuyOffer
```

and therefore cannot be used to declare ER6 Candidate SAT.

## Why ER6 does not silently patch this

The ER6 Success Contract forbids:
- hidden/global demand;
- private economy transaction state;
- parallel demand/market authorities;
- fixture-only demand after simulation start.

Reading another actor's private material plan directly from world truth inside Merchant policy would be a new information authority unless that observation is explicitly made canonical.

So the current branch stops at classification rather than hiding this gap behind an adapter.

## Required architecture decision to unblock

A future repair must choose one canonical route and prove it independently. Examples of acceptable shapes include:

1. Extend the existing actor-observed demand authority so a nearby Crafter can expose a bounded, deterministic, non-private **material demand signal** derived from an already-authoritative craft/procurement plan; or
2. Add a canonical Crafter market-request projection owned by an existing released authority, with explicit visibility/range/freshness rules, that ER1 can consume.

Whichever route is chosen must:
- be actor-scoped, not global;
- be deterministic;
- carry source actor + itemKind + quantity + freshness evidence;
- revalidate the live Crafter shortage before Merchant commitment;
- never mint material;
- never write Wallet/Trade/Inventory directly;
- preserve ER1/ER3/ER4/ER5 behavior and tests.

Until such an authority is specified and accepted:

**Producer → Crafter autonomous material closure = UNKNOWN/BLOCKED.**

Therefore:

**ER6 FOUR-ROLE AUTONOMOUS ECONOMY = NOT CANDIDATE SAT.**

## Evidence still required after the blocker is repaired

- assembled Producer → Crafter → Merchant → Consumer proof;
- exact Producer-origin material provenance through the Merchant;
- autonomous product BuyOffer + Crafter response + Merchant settlement;
- Merchant resale;
- real consumer purchase + equip/use;
- second economic cycle;
- conservation totals;
- save/load at all eight required checkpoints;
- replay/death/stale/closed-market/competition attacks;
- deterministic long-horizon run;
- complete retained regression/browser gates.
