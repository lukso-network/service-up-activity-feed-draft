# UP Activity Feed Mini-App — Build Task

## Overview
Build a Universal Profile activity feed mini-app that displays decoded blockchain transactions for any LUKSO Universal Profile. It will be embedded as an iframe on universaleverything.io.

## URL Routing
Path-based routing: `/{chainId}/{address}`
- Example: `/42/0xcdec110f9c255357e37f46cd2687be1f7e9b02f7`
- chainId 42 = LUKSO Mainnet, 4201 = LUKSO Testnet

## Tech Stack
- **Vue 3** with Vite (SPA, static build for GitHub Pages)
- **Vue Router** for path-based routing
- **Tailwind CSS** for styling
- **TypeScript**

## API Backend (Already Exists — DO NOT BUILD)
Use Andreas's API at `https://auth-simple.pages.dev`

### Main Endpoint: `POST /api/activity`

**Request:**
```json
{
  "chainId": 42,
  "address": "0xcdec110f9c255357e37f46cd2687be1f7e9b02f7"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "blockNumber": "6901346n",
      "blockTimestamp": 1770545268,
      "transactionHash": "0x...",
      "status": 1,
      "gasUsed": "150755n",
      "to": "0x...",
      "from": "0x...",
      "value": "0n",
      "input": "0x...",
      "logs": [...],
      "functionName": "execute",
      "resultType": "transaction"
    }
  ],
  "totalCount": 50,
  "pagination": {
    "nextToBlock": 6850000,
    "hasMore": true
  },
  "query": { "to": [...], "from": [...] }
}
```

**Pagination:** Pass `toBlock` from `pagination.nextToBlock` for next page.
**Polling:** Pass `fromBlock` (last seen block + 1) for new transactions.
**BigInt:** Numbers like blockNumber come as strings with "n" suffix (e.g., "6901346n"). Parse them.

### Enhanced Decoding: `POST /api/finishDecoding`
```json
{
  "chainId": 42,
  "transaction": { /* DecoderResult */ },
  "timeoutMs": 5000
}
```
Returns enhanced transaction with resolved address names, profile images, etc.

### Address Resolution: `POST /api/resolveAddresses`
Resolves addresses to profile metadata.

## UI Requirements

### Design
- **Beautiful, modern, clean** — this is a showcase for LUKSO
- Use Tailwind CSS utility classes
- Smooth animations and transitions
- Loading skeletons while data loads
- Responsive (works in iframe on mobile and desktop)
- Dark mode support (detect from parent or system preference)
- Color scheme: Use LUKSO's aesthetic — clean whites, subtle grays, pink/magenta accents

### Transaction List
- Scrollable feed of transactions, newest first
- Each transaction card shows:
  - Relative timestamp ("2 min ago", "3 hours ago")
  - From → To with profile names if available (use /api/finishDecoding or /api/resolveAddresses)
  - Transaction type/function name in a readable format
  - Value transferred (if any), formatted in LYX
  - Status indicator (success/failed)
  - Link to explorer: `https://explorer.lukso.network/tx/{hash}`
- Infinite scroll or "Load more" button for pagination
- Pull-to-refresh or auto-polling for new transactions

### Transaction Types to Handle
- **Token transfers** (LSP7): Show token name, amount, from/to
- **NFT transfers** (LSP8): Show NFT name, token ID
- **Profile updates** (ERC725Y setData): Show "Updated profile"  
- **Follow/Unfollow** (LSP26): Show "Followed/Unfollowed [profile]"
- **Permission changes** (LSP6): Show "Updated permissions for [address]"
- **Contract execution** (execute): Show function called
- **Value transfers**: Show LYX amount
- **Unknown**: Show raw function selector + "Contract interaction"

### Profile Header (Optional but nice)
- Show the UP's profile picture and name at the top
- Use Envio GraphQL or the resolve endpoint to fetch this

## File Structure
```
service-up-activity-feed-draft/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── router/
│   │   └── index.ts
│   ├── views/
│   │   └── ActivityFeed.vue
│   ├── components/
│   │   ├── TransactionCard.vue
│   │   ├── TransactionList.vue
│   │   ├── ProfileHeader.vue
│   │   ├── LoadingSkeleton.vue
│   │   └── ErrorState.vue
│   ├── composables/
│   │   ├── useActivity.ts        (fetch + pagination + polling)
│   │   └── useAddressResolver.ts (resolve addresses to names)
│   ├── lib/
│   │   ├── api.ts                (API client with BigInt handling)
│   │   ├── formatters.ts         (time, values, addresses)
│   │   └── types.ts              (TypeScript types)
│   └── assets/
│       └── main.css              (Tailwind imports)
├── .github/
│   └── workflows/
│       └── deploy.yml            (GitHub Pages deploy)
└── public/
    └── CNAME                     (if custom domain needed later)
```

## Deployment
- Static SPA built with Vite
- Deploy to GitHub Pages via GitHub Actions
- The Vue Router must use hash mode OR configure 404.html fallback for path-based routing on GH Pages

## Repository
- Push to: `https://github.com/lukso-network/service-up-activity-feed-draft`
- Branch: `main`
- Make it buildable and deployable immediately

## Reference
- Live demo of Andreas's app: https://auth-simple.pages.dev/activity/42/0xcdec110f9c255357e37f46cd2687be1f7e9b02f7
- Research gist: https://gist.github.com/emmet-bot/bcdc7cd67cee66a2861a6dfac393d41f
