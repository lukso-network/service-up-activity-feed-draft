# action_executed Card Mapping — Analysis & Fix

## Problem

The Envio Feed API's `action_executed` eventType was being rendered as generic
"Execute" cards (via `GenericCard`). The inner `decoded.transaction` object is
already fully decoded by the indexer and contains enough information to map
most of these events to proper domain cards (follow, LSP7 transfer, LSP8
transfer, LYX send, etc.), but the adapter was discarding that data.

## API Shape

Each row of `Feed` where `eventType = "action_executed"` has a `decoded` JSON
string of this form:

```jsonc
{
  "profile": "0x...",        // UP address that called execute()
  "target":  "0x...",        // Final contract being called (after LSP6 hop)
  "selector": "0xa07e80c6",  // 4-byte selector of the outer call
  "value":    "0",           // LYX value forwarded to the target
  "transaction": {
    "hash": "0x...",
    "to":   "0x...",         // Same as outer.target (cased)
    "from": "0x...",         // Usually the UP (outer.profile)
    "value": "0n",
    "input": "0x...",
    "resultType":   "execute",
    "functionName": "follow", // ← already decoded for known standards
    "standard":     "LSP26FollowerSystem",
    "sig": "0x...",
    "args": [ { "name": "...", "type": "...", "value": ... }, ... ]
  }
}
```

Notably, `decoded` is a JSON **string** — `feedApi.ts → parseFeedEntries`
parses it and strips BigInt `n` suffixes before the adapter sees it.

## Sample Distribution (150 most-recent events)

| `transaction.functionName` | `transaction.standard`        | Count | Mapping      |
|----------------------------|-------------------------------|------:|--------------|
| `executeBatch`             | `LSP0ERC725Account`           |    67 | **hidden**   |
| `execute`                  | _(null)_                      |    48 | **hidden**   |
| `authorizeOperator`        | `LSP7DigitalAsset`            |    10 | **hidden**   |
| `follow`                   | `LSP26FollowerSystem`         |     7 | → `follow`   |
| _(null)_                   | _(null)_                      |     6 | **hidden**   |
| `followBatch`              | `LSP26FollowerSystem`         |     5 | **hidden**   |
| `transfer`                 | `LSP7DigitalAsset`            |     2 | → `token_transfer` |
| `transferBatch`            | `LSP7DigitalAsset`            |     2 | → `transferBatch` (flattened by `TransactionList`) |
| `transfer`                 | `LSP8IdentifiableDigitalAsset`|     1 | → `nft_transfer`   |
| `transferOwnership`        | `LSP7DigitalAsset`            |     1 | **hidden**   |
| `unfollow`                 | `LSP26FollowerSystem`         |     1 | → `unfollow` |

Notes on the "hidden" rows:

- **`executeBatch` + LSP0ERC725Account** — a Universal Profile calling its own
  `executeBatch` with arrays of `(operationsType, targets, values, datas)`.
  These are meta-ops (e.g. a dApp orchestrating multiple calls through the
  UP). There is no sensible single-card representation, and the useful
  sub-events are already emitted as their own `Feed` rows (`lsp7_transfer`,
  `follow`, etc.). Showing them as a card would double-count.
- **Plain `execute` with no `standard`** — the indexer could not decode the
  inner call (selector not recognized). Typically custom dApp calls; showing
  them as generic "Execute" cards adds noise.
- **`authorizeOperator`, `transferOwnership`** — admin/approval actions. Not
  user-visible activity.
- **`followBatch`** — batch follows through LSP26. Could in principle be
  expanded into multiple follow cards, but the adapter only returns a single
  `Transaction`, so it's dropped for now.

## Fix

### `src/lib/feedAdapter.ts`

Rewrote the `action_executed` case to drill into `decoded.transaction` and
remap as if the event were the inner type:

1. `innerFn === 'follow' | 'unfollow'` → set `functionName`/`standard = LSP26`
   + `args = [{ name: 'addr', value: followee }]`. `classifyTransaction`
   returns `follow`/`unfollow`.
2. `innerStd === 'LSP7DigitalAsset'` + `fn ∈ {transfer, mint}` → pass
   `functionName` through and forward the pre-decoded `args`. Card resolves
   via LSP7 branch → `token_transfer` / `token_mint`.
3. `innerStd === 'LSP7DigitalAsset'` + `fn === 'transferBatch'` → pass through
   as-is. `TransactionList.flattenedTransactions` already splits this into
   per-recipient virtual transactions (the existing LIKES/FM-moments logic).
4. `innerStd === 'LSP8IdentifiableDigitalAsset'` + `fn ∈ {transfer, mint}` →
   analogous to LSP7.
5. Outer `decoded.value > 0` with no other match → treat as a LYX send:
   return a bare `Transaction` with `value = outerValueRaw`, no
   `functionName`/`standard`, which `classifyTransaction` routes to
   `value_transfer` via its `value > 0 && input === '0x'` branch.
6. Anything else → return `base` (no `functionName`, no `standard`, value `0`)
   so that `classifyTransaction` returns `'unknown'` and the entry is dropped
   by the filter.

### `src/views/ActivityFeed.vue`

Switched `filteredTransactions` from the FeedEntry-level
`classifyFeedEntry(entry)` to `classifyTransaction(adaptedTx)`. The old
classifier always returned `'contract_execution'` for every `action_executed`
row regardless of adapter output, so unmapped events would slip through the
`KNOWN_TX_TYPES` filter and still render as generic Execute cards. Using the
adapted `Transaction`'s classification makes the filter respect the adapter's
decisions: entries the adapter couldn't remap return `base`, classify as
`'unknown'`, and get dropped.

## Verification

- `npm run build` passes with no type errors.
- Estimated card coverage on the 150-sample set:
  - Rendered as proper cards: **13** (7 follow, 1 unfollow, 2 LSP7 transfer,
    2 LSP7 transferBatch, 1 LSP8 transfer) — up from **0**.
  - Hidden (previously shown as generic Execute): **137** — these were noise.

## Files Changed

- `src/lib/feedAdapter.ts` — rewrote `action_executed` case
- `src/views/ActivityFeed.vue` — filter now uses `classifyTransaction` on the
  adapted `Transaction` instead of `classifyFeedEntry` on the raw `FeedEntry`
