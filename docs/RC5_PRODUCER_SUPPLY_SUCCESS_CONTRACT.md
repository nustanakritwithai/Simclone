# RC5 Producer Supply — Role-aligned supply policy

Status: **STACKED DRAFT / DESIGN+TEST ONLY** on the repaired RC5.1 Crafter career branch.
UNKNOWN never passes a release gate.

## Product rule

Simclone economy has four distinct economic roles:

1. **Gatherer / ordinary worker** — gathers food, wood, stone, ore and other raw inputs.
2. **Producer / Crafter** — converts owned inputs into physical goods.
3. **Merchant** — owns market procurement, BuyOffers/Listings, pricing, trade and accounting.
4. **Adventurer** — is a major equipment/material consumer and returns loot to the economy.

This slice implements only the Producer decision boundary. It does not make Crafter
a Merchant.

## Canonical supply loop

```text
Observed Merchant BuyOffer
→ Crafter decides whether to supply
→ existing CRAFT_ITEM authority
→ physical item with createdBy / craft outcome
→ RC4_ACCEPT_BUY_OFFER intent
→ existing RC4 procurement Listing at Merchant market
→ Merchant performs purchase through existing travel/trade authority
```

The Producer never creates a price. `unitPrice` remains the Merchant's canonical
BuyOffer value. The Producer's accepted command payload contains only the exact
offer ID and exact physical item ID.

## Knowledge lock

Producer decisions may use only `knownRc4BuyOffers(agent)`. A globally open offer
that this person has never observed must not trigger production.

Observed knowledge is only the discovery gate. Before acting, the policy re-reads
the current canonical BuyOffer and current Home Market projection. Closed/stale
offers are ignored.

## Bounded behavior

The policy requires the existing RP1 opt-in. It is blocked by:
- non-Crafter profession;
- nonproductive life stage;
- survival danger;
- manual craft training;
- Adventure/encounter;
- current task, craft order or process order;
- invalid market knowledge;
- existing pending Producer procurement Listing;
- unavailable materials/station/bag/career permission;
- food/wood/stone reserve floors.

If the Crafter already owns a tradable matching item, supplying that physical item
comes before making another one.

If production is needed, a generic itemKind BuyOffer chooses the **lowest-tier
currently valid known recipe** that produces that item. This is deliberate:
current RC4 BuyOffer does not express tier or quality. A generic 70-coin axe demand
must not silently burn T5 Steel. High-tier mastery progression and future
quality-aware demand remain separate policies.

When market schema later supports explicit tier/quality requirements, this rule may
be extended under a new versioned contract.

## Authority locks

Producer Supply may:
- read personal market observations;
- read current BuyOffers/Home Markets;
- read existing possessions;
- ask `craftPreview` whether the existing craft authority would accept;
- propose `CRAFT_ITEM` or `RC4_ACCEPT_BUY_OFFER`.

Producer Supply may NOT:
- mint/move items;
- write recipe mastery/profession;
- create/update Listings directly;
- create/price BuyOffers;
- write Wallet/Ledger/Trade/Reservation;
- inspect unobserved global demand;
- bypass Crafter tier gates;
- consume materials during policy evaluation.

## Acceptance

Must prove:
- policy OFF creates no intent;
- unobserved global demand creates no intent;
- observed live demand creates a read-only craft intent;
- higher observed bid wins deterministically;
- intent payload cannot alter Merchant price;
- real CRAFT_ITEM creates the physical requested item;
- next intent answers the exact BuyOffer with that exact item;
- dispatch goes through existing RC4 acceptance and produces one bound procurement Listing;
- pending Listing suppresses overproduction;
- stale/closed offer is ignored;
- Builder/Merchant/Adventurer cannot use Producer policy;
- survival/manual/adventure/task constraints win;
- generic demand uses the lowest valid tier, not scarce high-tier inputs;
- policy source contains no item/profession/market/accounting writer.

## Integration gate

This candidate stays in `docs/wip` until parent RC5.1 exact-head Verify is SAT.
After that, promote the same policy into `src/**`, pin it, and wire it into the
existing production coordinator with the existing `dispatch(type,data)` callback.

The integration must be rebuilt on current main, which now also contains the RC4
autonomous Merchant-entry hotfix. Do not merge this stacked branch directly to main.
