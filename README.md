# UP Activity Feed

A Vue 3 activity feed for [LUKSO Universal Profiles](https://universalprofile.cloud), showing on-chain transactions like follows, token transfers, NFT transfers, profile updates, and more.

Built with Vue 3, TypeScript, Tailwind CSS, and the [`@lukso/activity-sdk`](https://www.npmjs.com/package/@lukso/activity-sdk).

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

You need a read token for private `@lukso` npm packages. Set it in your environment:

```bash
export LUKSO_NPM_TOKEN=<your-token>
```

And make sure your `.npmrc` includes:

```
//registry.npmjs.org/:_authToken=${LUKSO_NPM_TOKEN}
@lukso:registry=https://registry.npmjs.org/
```

## Setup

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

The dev server runs on `http://localhost:5173` by default.

To make it accessible over the network (e.g. via Tailscale):

```bash
npx vite --host 0.0.0.0 --port 5173
```

## Routes

| Route | Description |
|---|---|
| `/` | Global activity feed (all network transactions) |
| `/:chainId/:address` | Activity feed for a specific Universal Profile |
| `/:chainId/:address?devmode` | Dev mode — shows all transaction types including raw/aggregate |

**Examples:**
- `http://localhost:5173/42/0x1089E1c613Db8Cb91db72be4818632153E62557a` — Emmet's UP on LUKSO mainnet
- `http://localhost:5173/` — Global LUKSO feed

## API Proxy

The Vite dev server proxies `/api` requests to `https://dev.auth-simple.pages.dev` to avoid CORS issues. This is configured in `vite.config.ts`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |

## Branches

| Branch | Description |
|---|---|
| `main` | Currently deployed / stable version |
| `activity-sdk` | Refactor to use `@lukso/activity-sdk` (active development) |

## Tech Stack

- **Vue 3** + Composition API (`<script setup>`)
- **TypeScript**
- **Tailwind CSS**
- **Vite**
- **@lukso/activity-sdk** — transaction fetching, decoding, address resolution, polling
