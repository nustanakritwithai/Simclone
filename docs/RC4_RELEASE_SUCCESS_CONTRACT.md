# RC4 Merchant Economy — production release contract

Status vocabulary: SAT / VIOL / UNKNOWN. UNKNOWN never passes a release gate.
This contract records the integrated behavior under PR #194; it does not reuse donor CI as production evidence.

## Visible player path

Choose an adult Clone with a completed personal home. Open **ตลาด** (desktop tool, or mobile Menu → ตลาด RC4). Prepare a CLOSED Home Market, create an actual Buy Offer, qualify Merchant through the profession authority, then OPEN the market. A Producer answers the Buy Offer using a real crafted Rust instance. The Merchant walks to the storefront and buys that instance. The Merchant lists the acquired instance; a Customer with a genuine missing work-tool need, who has locally observed this market/listing, walks there and buys it.

Reference proof uses A=Producer, B=Merchant, C=Customer. A produces STONE_PICKAXE; C's existing productive preference is MINE. B pays A 70, C pays B 100. The same physical item moves A → B → C. B's ledger is Revenue 100 / COGS 70 / Realized Profit 30. Initial canonical Wallet policy grants 100 once to initial living accounts; later Clone admission creates a zero balance, not a new grant.

Listing/BuyOffer prices in this first UI are 100/70 respectively. Production cost is not guessed as zero. An item without an acquisition cost or approved production-cost evidence must fail accounting instead of silently inventing profit. The UI remains an input/read surface; it does not mint items, money, receipts, homes or progression.

## Authority and evidence

- Existing Rust crafting produces the sale item; its identity, createdBy and createdTick remain unchanged in transfers.
- Existing housing construction provenance owns the home. Home Market is only a component; it adds no capacity, wallet or inventory.
- Listing collection version 2 persists immutable creation-request receipts, in addition to mutable Listing revision/status/quantity. Reusing an ID with a different create payload fails. Replaying the original create remains a no-op even after update/close/save/load. A new explicit request ID allows relisting an instance after genuine reacquisition without cloning it.
- BuyOffer matching binds the generated procurement Listing to the exact offer ID and intended Merchant. Another buyer cannot take over that procurement commitment.
- Home Market owns its reference arrays and doorway/tradeRange projection. Reservation owns global ACTIVE locks and terminal receipts. Trade Kernel owns transaction replay. Wallet owns all money. Ledger alone owns accounting. Career alone owns progression.
- Personal market observations use the existing local knowledge-range predicate. World tick and successful canonical commands may record observations; UI getters cannot. A Clone may not travel to a never-observed remote market. Stale local claims do not override current market/listing validation.
- A Customer's need is derived from the current productive goal and physical possessions; caller-provided need flags are not authority. A Merchant's procurement need comes from its actual OPEN Buy Offer.

## Navigation and commit provenance

Navigation retains a private journey record bound to the exact world, actor, task, original path, start tick and consumed steps. The existing engine executor consumes one validated step at the existing movement cadence and remains the sole coordinate writer. Merely possessing a branded task, emptying its path, moving its coordinates, borrowing it for another Clone, or copying it to another world is not arrival evidence. JSON-restored tasks have no runtime provenance and are cleared; normal travel must be requested again. Unaffected genuine journeys may retain their existing task identity across an approved synchronous root commit.

Trade execution contexts are private, bound to their exact staged root, and revoked in a finally block on success, rejection or exception. Ledger ingestion accepts only a currently active matching context. Career consumes a single-use Ledger projection from that same execution and actor. Plain VERIFIED/COMMITTED objects, matching forged replay graphs, recomputed hashes, copied projections, escaped contexts and failed-settlement contexts cannot grant accounting or progression.

The live root is replaced only after staged Wallet, Rust item, Trade replay, Listing, Reservation, BuyOffer, Ledger and Career postconditions succeed. Failed wallet credit/item transfer/accounting/progression/postcondition injections leave the source authoritative root byte-identical. Compensation after a partial live commit is not accepted.

## Persistence and replay

A wholly pre-RC4 save may initialize the missing economy roots deterministically once. Once any RC4 root or version marker exists, every required root must exist with valid shape; deleting or nulling a root is corruption, not a request to bootstrap again.

Wallet trade receipts, Trade replay, committed Reservations, Listing identity/revision, Merchant ledger entries and Career counters cross-check each other on restore. A present-but-empty reset of one history cannot silently erase replay protection. Existing dead/archive identities remain valid account/ledger owners; their money is not removed or reminted.

Immediate replay, same-ID same-payload replay, same-ID conflicting-payload rejection, replay after 33 real committed transactions, and replay after engine save/load must leave all authoritative roots unchanged. Trade replay capacity is 512 and must fail closed without eviction. Persistent replay is separate from the intentionally ephemeral Navigation/Trade execution capabilities.

## Executable gate inventory

- `npm test`: all retained suites, donor-domain tests on the assembled tree, actual A→B→C integration, production-boundary attacks, release attacks and source hash/import-map invariants.
- `tests/rc4-production-boundary.test.mjs`: modern-root deletion/null attacks; real old-save one-shot migration; path/actor/world provenance attacks; genuine engine movement.
- `tests/rc4-release-attacks.test.mjs`: immutable Listing request replay/conflict; 33 real transactions and reload replay; receipt/payload tampering; cross-domain history reset; staged failures; context lifetime/actor-bound progression; stale UI revision; intended procurement buyer; local knowledge and genuine need.
- `tests/rc4-market-smoke.py`: desktop 1440×1000 and mobile 390×844, canonical sale-item fixture, real clicks/commands/walking/transactions, visible identity/OPEN/CLOSED/stock/wallet/100-70-30, and real UI save/reload.
- Existing Active Observation, Adventure Hunt/Combat, Independent gameplay, RC2 crafting, RC3.1 Blueprint, RC3.2 metal and SWA7 gates remain mandatory and unchanged in scope.

Fixture disclosure: browser prerequisites may include raw initial materials and completed home setup. The traded item itself must be canonically crafted by A. Business mutations in the browser are performed only by real UI clicks and engine execution; snapshots are read-only evidence. The complete production-world fixture used by long replay attacks also crafts its traded instance canonically.

## Publication protocol

1. Freeze and verify the exact integration head; no VIOL or UNKNOWN mandatory gate may be promoted.
2. Confirm current main, no head drift, and mergeability; merge only that frozen head.
3. Capture the new exact merged-main SHA. Rerun main Verify and Pages prepublication tests; candidate evidence is not substituted.
4. Pages must deploy that exact SHA and the public RC4 proof must fetch index and every pinned runtime module, byte-compare them to the checkout, then run real desktop/mobile interaction against PAGE_URL.
5. Record public evidence and real production verdict. A code implementation, green donor test, artifact-upload step or matching index alone is not release proof.

The accepted initial UI is command-driven market gameplay. No claim of autonomous Merchant procurement/restocking is made merely because policy modules are present. The policies remain proposal-only and must never bypass the same command validators.
