# Feed API Research — Envio Feed Table

## API Endpoint
`https://envio.lukso-mainnet.universal.tech/v1/graphql`

Supports both queries and **subscriptions** (GraphQL over WebSocket for real-time updates).

## Feed Table Schema

| Column | Type | Description |
|---|---|---|
| `id` | String | Unique feed entry ID (txHash-logIndex format) |
| `blockNumber` | Int | Block number |
| `transactionHash` | String | Transaction hash |
| `logIndex` | Int | Log index within transaction |
| `transactionIndex` | Int | Transaction index within block |
| `address` | String | Contract address that emitted the event |
| `eventType` | String | Event classification (see below) |
| `dataKey` | String | LSP data key name (for data_changed events) |
| `decoded` | jsonb | **Pre-decoded event data** (JSON with all relevant fields) |
| `timestamp` | Int | Unix timestamp |

### Relation Tables (for filtering)
- **`profiles`** → `FeedProfile` (profile_id, feed_id) — filter feed by profile address
- **`profileArgs`** → `FeedProfileArg` — profiles mentioned in event args
- **`assetArgs`** → `FeedAssetArg` — assets mentioned in event args
- **`tokenArgs`** → `FeedTokenArg` — tokens mentioned in event args

## Event Types

| eventType | Description | Decoded Fields |
|---|---|---|
| `lsp7_transfer` | LSP7 token transfer | from, to, fromName, toName, tokenName, tokenSymbol, formattedAmount, amount, decimals |
| `lsp8_transfer` | LSP8 NFT transfer | from, to, fromName, toName, tokenName, tokenSymbol, tokenId |
| `lyx_sent` | Native LYX sent | from, to, amount, receiverName |
| `lyx_received` | Native LYX received | from, to, amount, senderName |
| `follow` | LSP26 follow | follower, followee, followerName, followeeName |
| `unfollow` | LSP26 unfollow | follower, followee |
| `data_changed` | Profile/asset data update | name, key, value, subtype, profile_id |
| `action_executed` | UP execute action | profile, target, selector, value, transaction (full decoded tx) |

### data_changed dataKey values
- `lsp3Profile` — profile metadata update (name, description, images)
- `lsp28TheGrid` — grid edit
- `lsp5ReceivedAssets` / `lsp5ReceivedAssetsMap` — received asset tracking
- `addressPermissions` / `addressPermissionsPermissions` — permission changes
- `lsp4Metadata` — token/asset metadata update
- `lsp8ReferenceContract` — LSP8 reference contract
- `lsp1UniversalReceiverDelegate` — URD setup

## Key Advantages Over Current @lukso/activity-sdk Approach

### 1. Pre-decoded Data
The `decoded` field contains **already-parsed** event data with human-readable names, formatted amounts, and profile names. No need for:
- `@lukso/lsp-smart-contracts` decoder
- Manual BigInt → formatted amount conversion
- Separate profile name resolution for sender/receiver

### 2. Profile Filtering Built-in
`where: {profiles: {profile_id: {_eq: "0x..."}}}` — no need to fetch all transactions and filter client-side.

### 3. Real-time Subscriptions
GraphQL subscriptions for live feed updates instead of polling.

### 4. Simpler Event Classification
`eventType` directly maps to card types — no need for `classifyTransaction()` logic.

### 5. Pagination
Cursor-based pagination with `blockNumber`, `logIndex`, `transactionIndex` ordering.

## Mapping to Current Card Types

| Current Card | Feed eventType | Notes |
|---|---|---|
| TransferCard (LYX) | `lyx_sent` / `lyx_received` | Amount already formatted |
| TransferCard (LSP7) | `lsp7_transfer` | Has tokenName, tokenSymbol, formattedAmount |
| TransferCard (NFT/LSP8) | `lsp8_transfer` | Has tokenName, tokenId |
| FollowCard | `follow` | Has follower/followee names |
| FollowCard (unfollow) | `unfollow` | |
| ProfileUpdateCard | `data_changed` (lsp3Profile) | |
| TokenUpdateCard | `data_changed` (lsp4Metadata) | |
| PermissionCard | `data_changed` (addressPermissions) | |
| MomentCard | Need to check — may be lsp8_transfer to FM contract | |
| BridgeCard | Need to check — may be action_executed with bridge selector | |

### What `action_executed` Contains
This is the richest event — it contains the FULL decoded transaction including:
- Function name, args, standard
- This is equivalent to what the SDK's decoder returns
- Could be used as fallback for any event not covered by specific types

## Proposed Architecture Simplification

### Current Flow
```
SDK.useTransactionList() → DecoderResult[] → mapDecoderResultToTransaction() 
→ flattenedTransactions (LIKES splitting) → classifyTransaction() → displayItems (grouping)
→ Card components (TransferCard, FollowCard, etc.)
```

### Proposed Flow  
```
Feed API query/subscription → FeedEntry[] → classifyFeedEntry(eventType, dataKey)
→ displayItems (grouping, much simpler) → Card components (reuse existing, adapt props)
```

### What Can Be Removed
- `@lukso/activity-sdk` dependency (the decoder, WebSocket transaction stream)
- `mapDecoderResultToTransaction()` mapping function
- `classifyTransaction()` — replaced by `eventType` field
- Most of `TransferCard` amount formatting — `decoded.formattedAmount` is pre-formatted
- Profile name resolution for sender/receiver — already in `decoded`
- `transferBatch` splitting — Feed API may already emit individual entries

### What Stays
- Card components (visual rendering) — just adapt props
- Grouping logic in TransactionList (follow groups, airdrop groups, etc.)
- NftPreview, ProfileBadge, TimeStamp shared components
- Address resolution for icons/images (Feed API has names but not images)

## Example Queries

### Per-profile feed (paginated)
```graphql
query ProfileFeed($profileId: String!, $beforeBlock: Int) {
  Feed(
    limit: 20,
    where: {
      profiles: { profile_id: { _eq: $profileId } },
      blockNumber: { _lt: $beforeBlock }
    },
    order_by: { blockNumber: desc, logIndex: desc }
  ) {
    id eventType decoded address timestamp
    blockNumber logIndex transactionHash dataKey
  }
}
```

### Real-time subscription
```graphql
subscription LiveFeed($profileId: String!) {
  Feed(
    where: { profiles: { profile_id: { _eq: $profileId } } },
    order_by: { blockNumber: desc, logIndex: desc },
    limit: 20
  ) {
    id eventType decoded address timestamp
    blockNumber logIndex transactionHash
  }
}
```

### Global feed (all activity)
```graphql
query GlobalFeed {
  Feed(limit: 20, order_by: { blockNumber: desc, logIndex: desc }) {
    id eventType decoded address timestamp
    blockNumber logIndex transactionHash dataKey
  }
}
```

## Open Questions
1. Does the Feed API emit individual entries for `transferBatch`, or do we still need splitting?
2. How does the `action_executed` event relate to other events (duplicate entries)?
3. Are bridge transactions (Hyperlane) captured? What eventType?
4. Is there a `moment_created` event or is it an `lsp8_transfer` from 0x0?
5. Does the subscription support cursor-based resumption (reconnect without missing events)?
6. What's the retention period / how far back does the Feed go?
