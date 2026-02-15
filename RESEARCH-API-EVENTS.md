# Activity Feed API — Transaction Structure Research

> Generated 2026-02-15 from real API responses for `0xdE0Da643...` and global feed.

## TL;DR — The API Does The Hard Work

The API at `https://auth-simple.pages.dev/api/activity` **already unwraps** Key Manager / UP wrappers and returns the **innermost decoded call** as the top-level transaction object. The `wrappers` array contains the outer layers (KM → UP → target) for reference only.

**This means `tx.args` is the source of truth for most data.** But `tx.from` and `tx.to` mean different things depending on the transaction type.

---

## Top-Level Transaction Fields

| Field | Type | Meaning |
|---|---|---|
| `blockHash` | string | Block hash |
| `blockNumber` | string | Block number (has trailing `n` for BigInt) |
| `blockTimestamp` | number | Unix timestamp (seconds) |
| `transactionIndex` | number | Index within block |
| `transactionHash` | string | Tx hash |
| `status` | number | 1 = success, 0 = reverted |
| `gasUsed` | string | Gas used (BigInt) |
| `gasPrice` | string | Gas price (BigInt) |
| `to` | string | **Target contract address** (NOT the receiver of the action) |
| `from` | string | **The UP address** that initiated the action (for unwrapped txs) OR the EOA (for raw LYX transfers) |
| `value` | string | LYX value in wei (BigInt) |
| `input` | string | Raw calldata |
| `isDecoded` | boolean | Whether the API successfully decoded the tx |
| `resultType` | string | `"execute"` for final decoded calls, `"wrapper"` for outer layers |
| `functionName` | string | Decoded function name (e.g. `"transfer"`, `"follow"`, `"setData"`) |
| `sig` | string | 4-byte function selector |
| `__decoder` | string | Which decoder was used (e.g. `"@lukso/lsp-smart-contracts"`) |
| `standard` | string | Which LSP standard (e.g. `"LSP7DigitalAsset"`, `"LSP26FollowerSystem"`, `"LSP0ERC725Account"`) |
| `args` | array | **Decoded function arguments** — the most important field |
| `logs` | array | Decoded event logs emitted during execution |
| `wrappers` | array | Outer transaction layers (KM/UP calls) that were unwrapped |
| `addresses` | array | All addresses involved in the tx |
| `children` | array | For LSP26 follow: contains the resolved follow target |
| `phase` | string | Always `"enhanced"` for decoded txs |
| `timeTaken` | number | API processing time |

### `args` Array Structure

Each arg is an object:
```json
{
  "name": "from",
  "internalType": "address",
  "type": "address",
  "value": "0xdE0Da643..."
}
```

### `logs` Array Structure

Each log:
```json
{
  "topics": ["0x...", ...],
  "data": "0x...",
  "address": "0x...",       // Contract that emitted the event
  "eventName": "Transfer",  // Decoded event name
  "args": [...]             // Same format as tx.args, with `indexed: true/false`
}
```

### `wrappers` Array Structure

Each wrapper is a full transaction object (same fields as top-level) but with `resultType: "wrapper"`. They're ordered outermost-first:
- `wrappers[0]`: LSP6 KeyManager `executeRelayCall` or direct EOA → KM call
- `wrappers[1]`: LSP0 `execute` call (UP calling the target)
- Top-level tx: The final decoded call (e.g., LSP7 `transfer`)

---

## Transaction Types — Source of Truth for Each

### 1. LSP7 Token Transfer

**Identification:** `standard === "LSP7DigitalAsset"` AND `functionName === "transfer"`

**Top-level fields:**
- `tx.to` = **Token contract address** (e.g., `0x403BfD...` = LIKES)
- `tx.from` = **Sender UP address** (the UP that owns the tokens)
- `tx.value` = `"0"` (no LYX value)

**Args (source of truth):**
- `args[0]` name=`from` → Sender UP
- `args[1]` name=`to` → Receiver address (UP, EOA, or asset contract)
- `args[2]` name=`amount` → Amount in token's smallest unit (BigInt with trailing `n`)
- `args[3]` name=`force` → Whether to force-send
- `args[4]` name=`data` → Extra data bytes

**For the UI card:**
- **Sender:** `args.from` (= `tx.from` for unwrapped txs)
- **Receiver:** `args.to`
- **Amount:** `args.amount`
- **Token contract:** `tx.to`
- **Token contract (robust):** Find `Executed` log → `args.target` gives the token contract

**Wrappers confirm:** `wrappers[last].standard === "LSP0ERC725Account"`, `wrappers[last].args.target` = token contract

### 2. LSP7 Batch Transfer (`transferBatch`)

**Identification:** `standard === "LSP7DigitalAsset"` AND `functionName === "transferBatch"`

**Args:**
- `args[0]` name=`from` → **Array** of sender addresses
- `args[1]` name=`to` → **Array** of receiver addresses
- `args[2]` name=`amount` → **Array** of amounts
- `args[3]` name=`force` → **Array** of force booleans
- `args[4]` name=`data` → **Array** of data bytes

**For UI:** This is a batch tx — show as "Sent [token] to N recipients" or expand to individual rows. Each index `i` represents one transfer: `from[i] → to[i]` of `amount[i]`.

**Token contract:** Same as single transfer — `tx.to`.

### 3. LSP26 Follow / Unfollow

**Identification:** `standard === "LSP26FollowerSystem"` AND `functionName === "follow"` or `"unfollow"`

**Top-level fields:**
- `tx.to` = **LSP26 contract address** (`0xf01103E5...`)
- `tx.from` = **Follower's UP address**

**Args:**
- `args[0]` name=`addr` → **The address being followed/unfollowed**

**Children (bonus):**
- `tx.children[0]` has `resultType: "followProfile"` and `address` = the followed address

**Wrappers:**
- For relay calls: `wrappers[0]` is `LSP6KeyManager.executeRelayCall`, `wrappers[1]` is `LSP0.execute`
- The UP address is in `wrappers[1].from` (= `tx.from` after unwrapping)

**For the UI card:**
- **Follower:** `tx.from` (the UP)
- **Followed:** `args[0].value` (name=`addr`)

### 4. LYX Value Transfer (Native Currency)

**Identification:** `tx.value > 0` AND (`tx.input === "0x"` OR no meaningful calldata) AND no `standard`/`functionName`

**Top-level fields:**
- `tx.to` = **Receiver address**
- `tx.from` = **Sender address** (often an EOA, NOT a UP!)
- `tx.value` = Amount in wei
- `tx.input` = `"0x"` (empty)
- `tx.args` = `[]` (empty)
- `tx.sig` = `"0x"`

**WARNING:** For raw LYX transfers, `tx.from` is typically the **EOA** that sent the transaction, NOT a Universal Profile. There are no wrappers for these.

**For the UI card:**
- **Sender:** `tx.from` (may be EOA — resolve to check if it's a UP)
- **Receiver:** `tx.to`
- **Amount:** `tx.value`

### 5. Profile Update (`setData` / `setDataBatch`)

**Identification:** `functionName === "setData"` or `"setDataBatch"`, usually `standard === "LSP0ERC725Account"`

**Not seen in the dumps for this address**, but expected structure:
- `tx.to` = UP address being updated
- `tx.from` = UP address (same as `tx.to` for self-updates)
- `args` has `dataKey(s)` and `dataValue(s)`

### 6. Contract Execution (generic `execute` / `executeBatch`)

**Identification:** `functionName === "execute"` AND `resultType !== "wrapper"` AND `standard === "LSP0ERC725Account"`

This happens when the API can't further decode the inner call. The UP is calling a contract but the API doesn't recognize the function.

- `tx.args.executeType` = operation type (0=CALL, 1=CREATE, etc.)
- `tx.args.target` = target contract
- `tx.args.value` = LYX value sent
- `tx.args.data` = raw calldata of inner call

---

## The `wrappers` Field Explained

On LUKSO, a typical transaction flow is:
```
EOA → KeyManager.execute(payload) → UP.execute(0, target, value, calldata) → Target.method(...)
```

The API unwraps this chain and presents the **innermost decoded call** as the top-level object. The `wrappers` array preserves the outer layers:

```
wrappers[0] = LSP6 KeyManager call (executeRelayCall or execute)
wrappers[1] = LSP0 UP call (execute)
top-level tx = The actual decoded target call (e.g., LSP7 transfer)
```

**Key relationship:**
- `wrappers[last].from` = The UP address (same as top-level `tx.from` after unwrapping)
- `wrappers[last].args.target` = The contract being called (same as top-level `tx.to`)
- `wrappers[0].from` = The EOA/Key Manager controller that signed the tx

**When there are NO wrappers** (e.g., raw LYX transfer from EOA), the top-level tx IS the raw transaction.

---

## Event Logs Reference

### `Executed` (LSP0 — emitted by the UP)
```
Executed(uint256 indexed operationType, address indexed target, uint256 value, bytes4 indexed selector)
```
- `target` = The contract called by the UP (e.g., token contract)
- `selector` = Function selector of the call
- Emitted by: The UP contract (`address` field = UP address)

### `UniversalReceiver` (LSP1 — emitted by receiver UP)
```
UniversalReceiver(address indexed from, uint256 indexed value, bytes32 indexed typeId, bytes receivedData, bytes returnedValue)
```
- `from` = The contract notifying (e.g., token contract)
- `typeId` = Type of notification:
  - `0x429ac7a0...` = LSP7 tokens sent (sender side)
  - `0x20804611...` = LSP7 tokens received (receiver side)
  - `0x71e02f9f...` = LSP26 follow notification
- `receivedData` = Encoded transfer params (from, operator, to, amount, data)
- Emitted by: The UP that received the notification

### `PermissionsVerified` (LSP6 — emitted by Key Manager)
```
PermissionsVerified(address indexed signer, uint256 indexed value, bytes4 indexed selector)
```
- `signer` = The EOA/controller that signed
- Not useful for UI display

### `Transfer` (LSP7 — NOT present in logs!)
**Important:** The LSP7 `Transfer` event is NOT in the decoded logs from this API. The API strips it or doesn't include it. The transfer data comes from `tx.args` instead.

---

## Recommendations for Codebase Changes

### `classifyTransaction()` in formatters.ts

**Current approach is mostly correct.** Classification via `tx.standard` and `tx.functionName` works well because the API pre-decodes these. Minor fixes:

1. Check `tx.standard` first (most reliable), then `tx.functionName`
2. Handle `transferBatch` as a token transfer variant
3. For LYX transfers: check `tx.value > 0` AND `tx.input === "0x"` (or empty args)

### TransferCard.vue

**Current `senderAddress` logic is correct:**
```js
const senderAddress = computed(() => {
  const args = props.tx.args
  if (args) {
    const from = args.find(a => a.name === 'from')
    if (from && typeof from.value === 'string') return from.value
  }
  return props.tx.from
})
```
This correctly uses `args.from` for LSP7 transfers and falls back to `tx.from`.

**Current `receiver` logic is correct:**
```js
const receiver = computed(() => {
  const args = props.tx.args
  if (args) {
    const to = args.find(a => a.name === 'to')
    if (to && typeof to.value === 'string') return to.value
  }
  return props.tx.to
})
```

**Token contract address:** Currently uses `tx.to` with a fallback to Transfer log. Since this API doesn't include LSP7 Transfer events in logs, **`tx.to` IS the token contract** for LSP7 transactions. The `getAmountFromTransferLog()` function won't find anything — amount should come from `tx.args` directly.

**Recommended fix for `tokenAmount`:** Instead of looking for Transfer event logs (which don't exist in this API), get amount directly from `tx.args`:
```js
const tokenAmount = computed(() => {
  const args = props.tx.args
  if (!args) return ''
  const amountArg = args.find(a => a.name === 'amount')
  if (!amountArg) return ''
  // ... format the BigInt value
})
```

**Recommended fix for `tokenContractAddress`:** Just use `tx.to` directly (it's always the token contract for LSP7 calls):
```js
const tokenContractAddress = computed(() => {
  return props.tx.to
})
```

### FollowCard.vue

**Current approach is correct but fragile:**
```js
const targetAddress = computed(() => {
  const args = props.tx.args
  if (args) {
    const addr = args.find(a => a.type === 'address')
    if (addr && typeof addr.value === 'string') return addr.value
  }
  return props.tx.to
})
```

**Better:** Use `name === 'addr'` instead of `type === 'address'` for specificity:
```js
const addr = args.find(a => a.name === 'addr')
```

**Follower address:** Currently uses `tx.from` directly — this is correct because the API unwraps to show the UP as `tx.from`.

### ActivityFeed.vue — Address Resolution

**Current approach is good** — it collects addresses from `tx.from`, `tx.to`, `tx.args`, and `tx.logs` for batch resolution. No changes needed.

### Batch Transfers

The first tx in the dump is a `transferBatch` with 30 recipients. Currently this would be classified as `token_transfer` but the args contain arrays instead of single values. **Either:**
1. Filter out batch txs (they're rare and complex to display)
2. Show a simplified "Sent [token] to 30 addresses" card
3. Explode into individual transfer cards (complex)

Recommendation: Option 2 — simple summary card.

---

## Summary: What To Use Where

| Card Type | Sender | Receiver | Amount | Token/Contract |
|---|---|---|---|---|
| **LSP7 Transfer** | `args.from` | `args.to` | `args.amount` | `tx.to` |
| **LSP7 Batch** | `args.from[0]` | N addresses | `args.amount[i]` | `tx.to` |
| **LSP26 Follow** | `tx.from` | `args.addr` | N/A | N/A |
| **LYX Transfer** | `tx.from` ⚠️ | `tx.to` | `tx.value` | N/A |
| **Profile Update** | `tx.from` | N/A | N/A | N/A |

⚠️ For LYX transfers, `tx.from` may be an EOA, not a UP.

### The ONLY Special Case: FM Moments (LIKES → Asset)

When someone sends LIKES tokens to an NFT/asset address (not a profile), show the "liked with" card. Detection:
1. It's an LSP7 transfer (`standard === "LSP7DigitalAsset"`)
2. The receiver (`args.to`) resolves to an asset (LSP7/LSP8), not a profile
3. Optionally: the token is LIKES (`tx.to === "0x403bfd..."`)

Everything else uses the standard card layout. No other special cases needed.
