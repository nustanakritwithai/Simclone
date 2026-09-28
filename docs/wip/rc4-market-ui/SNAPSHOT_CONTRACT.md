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
    stockAvailable,
    status
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
    verificationStatus
  }
}
```

## Critical notes

- `stockAvailable` is a projection of canonical item ownership/reservation truth, not UI-owned stock.
- Ledger values are read-only projections from Merchant Ledger authority.
- Profession is read-only from profession authority.
- Market status is read-only from Home Market authority.
- `latestVerifiedTransaction` must not be populated from a local optimistic click result.
- Missing or stale evidence maps to `UNKNOWN`; UNKNOWN never enables a purchase action.
