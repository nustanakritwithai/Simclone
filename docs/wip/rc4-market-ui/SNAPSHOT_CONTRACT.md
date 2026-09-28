# RC4 Market UI — Read Model Contract

This is a presentation contract, not a new authority schema. Field names should be mapped to the canonical RC4 structures selected by Integration Lead.

```js
{
  market: {
    marketId,
    homeId,
    ownerAgentId,
    ownerDisplayName,
    status,                 // OPEN | CLOSED | UNKNOWN
    homeValid,
    listingIds,
    buyOfferIds
  },
  listings: [{
    listingId,
    itemKind,
    itemDisplayName,
    quantity,
    unitPrice,
    revision,                 // canonical Listing.revision
    stockAvailable,
    status                    // OPEN | CLOSED | CANCELED | FILLED
  }],
  buyOffers: [{
    offerId,
    itemKind,
    itemDisplayName,
    quantityWanted,
    unitPrice,
    status
  }],
  merchant: {
    agentId,
    profession,
    transactionCount,
    currentStockSummary,
    currentMerchantGoal
  },
  ledger: {
    revenue,
    costOfGoodsSold,
    realizedProfit
  },
  latestVerifiedTransaction: {
    transactionId,
    buyerDisplayName,
    sellerDisplayName,
    itemDisplayName,
    quantity,
    totalPrice,
    verificationStatus,      // VERIFIED
    commitStatus,            // COMMITTED
    duplicate                // false
  }
}
```

## Critical notes

- `stockAvailable` is a projection of canonical item ownership/reservation truth, not UI-owned stock.
- Ledger values are read-only projections from Merchant Ledger authority.
- Profession is read-only from profession authority.
- Market status is read-only from Home Market authority.
- Listing presentation maps canonical Pricing/Listing authority `Listing.id` to display/read-model `listingId`; `revision` is retained unchanged and must accompany a purchase intent.
- Canonical purchasable Listing state is `OPEN`; UI must not invent an `ACTIVE` status vocabulary.
- `latestVerifiedTransaction` must not be populated from a local optimistic click result.
- Transaction success presentation requires `verificationStatus === 'VERIFIED'`, `commitStatus === 'COMMITTED'`, and `duplicate === false`.
- Quantity and total price shown as committed trade facts must be positive safe integers.
- Missing or stale evidence maps to `UNKNOWN`; UNKNOWN never enables a purchase action.
