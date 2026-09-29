# ER2 — Raw Producer Reserve, Surplus and Observed BuyOffer Success Contract

Status vocabulary: SAT / VIOL / UNKNOWN. UNKNOWN never passes.

Base: main@5dc8f89413ff5aa8bf8f78e2e046ba5ed2093156 after ER0B Production SAT.

## Goal

Make the existing Forager, Woodcutter and Miner careers respond to ER1 actor-observed bulk demand without creating another resource, market, money, task or career authority.

Canonical loop:

Observe ER1 demand
→ gather through the existing world node authority
→ preserve personal/household reserve
→ compute tradable surplus
→ use only an observed BuyOffer
→ canonical market travel
→ accept BuyOffer into the existing procurement Listing
→ buyer later settles through canonical arrival + Trade Kernel
→ Wallet income and resource transfer are committed atomically by ER0B

ER2 does not implement full Merchant autonomy. That remains a later gate.

## Career capability

- Forager: food
- Woodcutter: wood
- Miner: stone and ironOre

The professions remain the existing kingdom career vocabulary. ER2 adds no producer profession, producer XP or quota allocator.

## Reserve authority

ER2 derives reserve from the existing personalTargets() and canonical resource account.

For food, any currently accepted meal reservation is protected in addition to the floor.

For wood and stone, the existing personal/household target is the protected floor.

For ironOre there is no invented numeric floor. Its base reserve is zero because no current canonical personalTargets rule owns such a floor; materials already escrowed into accepted crafting/processing work are already absent from the available stock.

Cohabitants sharing one household account raise the same canonical target. ER2 does not create a second household balance.

Core accounting:

gross surplus = owned - protected reserve

tradable surplus = gross surplus - active canonical reservations - already-open procurement commitments

Values are clamped at zero.

## Knowledge lock

A producer may react only to projectActorObservedDemand() SAT output.

The BuyOffer must be:

- actually observed by that actor;
- still fresh under ER1 TTL;
- still the same canonical OPEN BuyOffer;
- attached to a currently valid/open known Home Market;
- funded under ER1;
- explicit BULK_RESOURCE;
- compatible with the producer career.

A hidden global BuyOffer never becomes producer demand.

UNKNOWN demand never becomes an empty SAT.

## Production truth

Demand may raise the utility of the existing FORAGE, WOODCUT or MINE action above the normal reserve target.

Extraction still uses the existing node executor:

- node amount decreases;
- canonical resourceStock/material authority increases;
- Miner ironOre still comes only from the existing deterministic ironOreYieldForMining route;
- no synthetic stock is created by ER2.

Survival and an accepted current task remain higher priority than starting market work.

## Market travel and sale intent

Having surplus does not authorize remote sale.

The producer must use RC4_TRAVEL_TO_MARKET and the existing canonical navigation journey. Only NAVIGATION_VERIFIED arrival permits the autonomous policy to call RC4_ACCEPT_BUY_OFFER.

Accepting the BuyOffer is not payment. It creates the existing procurement Listing only.

Wallet/resource settlement remains buyer-side RC4_BUY_LISTING → Reservation → Trade Kernel.

ER2 adds no teleport and no direct wallet/resource writer.

## Competing commitments

Before accepting a BuyOffer, ER2 subtracts:

- active bulk Reservations from the same canonical resource account and resource key;
- open BuyOffer-bound procurement Listings from the same account and resource key.

This accounting spans members sharing one household resource account.

Replaying the same producer/offer match remains idempotent and does not count the same deterministic Listing twice.

## Commit-time revalidation

Reserve is re-read immediately before a bulk BuyOffer-bound Listing creates its settlement Reservation.

A trade is rejected when current owned quantity minus other active reservations minus this sale would fall below the current protected reserve.

This protects against stock changing after the Listing was created.

Rejected reserve validation occurs before wallet/resource mutation. Atomic ER0B settlement remains unchanged.

## Persistence

ER2 stores no new authoritative state.

Market knowledge, Listing, Reservation, Wallet and resources persist through their existing owners. Reserve/surplus is derived again after load.

An ephemeral canonical navigation proof is never serialized into authority; existing RC4 migration rules remain unchanged.

## Acceptance attacks

1. Hidden global BuyOffer does not affect producer policy.
2. Household membership raises protected reserve through the existing target authority.
3. At reserve, observed demand creates gather pressure instead of selling reserve.
4. Real Woodcutter extraction decreases a world node before market supply exists.
5. Producer uses canonical market travel before autonomous BuyOffer acceptance.
6. BuyOffer acceptance alone does not move money.
7. Canonical buyer settlement pays the Producer and conserves total currency/resource quantity.
8. Competing procurement Listings cannot over-commit one account surplus.
9. Same offer replay is idempotent.
10. Intervening consumption that would cross reserve rejects settlement without mutation.
11. Save/load preserves derived saleability without an ER2 save root.
12. Corrupt ER1/RC4 authority returns UNKNOWN.
13. Legacy physical-item trade remains unaffected.
14. Full RC2/RC3/RC4/RC5/Adventure regression gates remain required.

## Release rule

Candidate tests and exact-head Verify may establish CANDIDATE SAT only.

Production SAT requires merge of the exact accepted head followed by exact-main Verify, Pages success, public HTTP/exact-byte proof and retained browser regressions.

UNKNOWN never passes.
