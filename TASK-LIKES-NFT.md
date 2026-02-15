# Task: Display "Liking an NFT" as Extended Card

## Problem
When someone sends LIKES tokens to an NFT/asset contract address (not a profile), it's actually a "like" action on that NFT. Currently it shows as a generic transfer card: "@feindura Sent 25 LIKES to 0xd9a9...c59"

## Goal
Display this as an extended card showing:
- "@feindura liked [NFT image] [NFT name]" 
- Show the NFT using `<lukso-card>` web component (variant="basic", with backgroundUrl for the NFT image)
- Link the NFT to `universaleverything.io/asset/{nft-contract-address}`

## Detection Logic
A "like" transaction is when:
1. `tx.standard === 'LSP7DigitalAsset'` AND `tx.functionName === 'transfer'`
2. The token contract (`tx.to`) is the LIKES token (`0x403BfD53617555295347e0F7725CfdA480AB801e`)
3. The receiver address (`args[1].to`) resolves to an Asset (`__gqltype === 'Asset'`) — NOT a profile

## Resolve API Response for Assets
When resolving an NFT/asset address, the response includes:
- `__gqltype: "Asset"`
- `isLSP7: true/false`
- `isCollection: true/false`  
- `lsp4TokenName: "Token Name"`
- `icons: [{src, width, height}]` — token icon
- `images: [{src, width, height}]` — NFT artwork/image
- `standard: "LSP7DigitalAsset" | "LSP8IdentifiableDigitalAsset" | "UnknownContract"`

Some NFT addresses may NOT resolve (return empty). In that case, fall back to showing the address as-is.

## LUKSO Web Components
- `<lukso-card variant="basic" background-url="..." width="200" height="200" border-radius="medium" shadow="small">` — for NFT image display
- Already installed: `@lukso/web-components` v1.178.0
- Vue config already has `isCustomElement: (tag) => tag.startsWith('lukso-')`

## Implementation

### 1. Update `classifyTransaction` in `src/lib/formatters.ts`
Cannot detect "like" at classification time since we need the resolved identity of the receiver. Keep classification as `token_transfer`.

### 2. Create `src/components/cards/LikeCard.vue` (Extended Card)
Layout:
```
┌──────────────────────────────────────┐
│ 👤 @feindura liked                   │
│ ┌────────┐                           │
│ │  NFT   │  NFT Name                 │
│ │ image  │  Collection/details        │
│ │        │                           │
│ └────────┘                   2h ago  │
└──────────────────────────────────────┘
```

- Use `<lukso-card variant="basic" :background-url="nftImageUrl" width="120" height="120" border-radius="medium" shadow="small">`
- Show sender with ProfileBadge
- Action text: "liked" (not "Sent X LIKES to")
- Show LIKES amount subtly (e.g., "25 LIKES" in smaller text)
- NFT name links to `universaleverything.io/asset/{receiver-address}`
- Timestamp in corner

### 3. Update `TransferCard.vue`
Add detection: if this is a LIKES transfer and receiver is an Asset, render LikeCard instead.

OR better: Update `TransactionList.vue` to check if a token_transfer is actually a "like" and use LikeCard.

### 4. Update `TransactionList.vue` / card selection
The `getCardComponent` function needs to be reactive to resolved identities. Since identities load async, we might need to:
- Keep it in TransferCard and conditionally render LikeCard layout when we detect a like
- This avoids the async card-switching problem

## Approach: Keep in TransferCard, add like mode
In TransferCard, add a computed `isLikeAction`:
```ts
const isLikeAction = computed(() => {
  // Must be LIKES token transfer
  if (tx.to.toLowerCase() !== '0x403bfd53617555295347e0f7725cfda480ab801e') return false
  // Receiver must be an asset, not a profile
  const receiverIdentity = getIdentity(receiver.value)
  if (!receiverIdentity) return false
  return receiverIdentity.__gqltype === 'Asset' || 
    receiverIdentity.isLSP7 || 
    receiverIdentity.standard?.includes('LSP7') ||
    receiverIdentity.standard?.includes('LSP8')
})
```

When `isLikeAction` is true, render extended card layout with NFT display instead of compact transfer.

## NFT Image Source
From resolved identity of receiver:
- `images[0].src` — the NFT artwork (preferred)
- `icons[0].src` — fallback icon

## Important
- Test with address `0xdE0Da643334b4f0722f45baA9b1f7B7C71C82976` on chainId 42
- Some receiver addresses won't resolve — fall back gracefully to compact transfer card
- Don't hardcode LIKES address — make it configurable or detect by token symbol
