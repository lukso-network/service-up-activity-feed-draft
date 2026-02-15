# Activity Feed — UI Redesign Plan

> **Research Gist:** https://gist.github.com/emmet-bot/bcdc7cd67cee66a2861a6dfac393d41f
> **Repo:** https://github.com/lukso-network/service-up-activity-feed-draft
> **API:** https://auth-simple.pages.dev/api/activity (Andreas's backend)
> **Web Components Storybook:** https://tools-web-components.pages.dev/

## Design References
- **Compact card** (Image 1): Single-row white card, profile avatar + @name#HASH on left, action text center, target profile on right
- **Extended card** (Image 2): Profile avatar + @name#HASH top-left with timestamp, action description below, optional content preview area

## Core Principles

1. **Every profile shown MUST use `<lukso-profile>` + `<lukso-username>` web components** from `@lukso/web-components`
   - Format: `@Name#7A3A` (name + first 4 bytes of address)
   - `<lukso-profile>` for avatar (with `profile-url` and `profile-address`)
   - `<lukso-username>` for name display (with `name`, `address`, `prefix="@"`)

2. **Two card styles:**
   - **Compact**: Single horizontal row — actor profile | action text | target profile (if applicable)
   - **Extended**: Multi-row — actor profile + timestamp top-left, action description, optional content area below

3. **Card styling (both styles):**
   - White background
   - `border-radius: 16px`
   - Very subtle smooth drop shadow (like `shadow-sm` or `0 1px 3px rgba(0,0,0,0.08)`)
   - **No border**
   - Clean spacing/padding

4. **Actor is always the one performing the action** — shown on the left (compact) or top-left (extended)

5. **Neutral language** — no "you" or "your". The feed should work in any context:
   - ✅ "follows" (not "follows you")
   - ✅ "sent 4,000 LYX to" (not "sent you 4,000 LYX")
   - ✅ "Edited profile metadata"

## Card Types & Style Assignment

### Compact Cards (single row)
| Transaction Type | Layout |
|---|---|
| **LYX Transfer** | `[Actor] Sent 🔴 {amount} LYX to [Target]` |
| **LSP7 Token Transfer** | `[Actor] Sent {amount} {TOKEN} to [Target]` |
| **LSP8 NFT Transfer** | `[Actor] Sent {tokenName} #{id} to [Target]` |
| **Follow** | `[Actor] follows [Target]` |
| **Unfollow** | `[Actor] unfollowed [Target]` |
| **Unknown/Raw Transaction** | `[Actor] Contract interaction → {functionName or selector}` with expandable arrow ▶ |

### Extended Cards (multi-row with content area)
| Transaction Type | Content Area |
|---|---|
| **Profile Update (setData)** | Show what changed — new profile image preview, background image, description snippet |
| **Permission Change** | Show which address got what permissions |
| **Contract Deployment** | Show deployed contract address |
| **Token/NFT Creation** | Show token metadata if available |

### Unknown/Raw Transaction (Expandable)
- Default: Compact card with `[Actor] Contract interaction` + chevron ▼
- On click: Expands to show raw transaction data:
  - `transactionHash` (linked to explorer)
  - `from` → `to`
  - `value` (if non-zero)
  - `functionName` / `input` (first 10 chars of selector)
  - `gasUsed`
  - `status` (success/failed)
  - `logs` summary

## Component Architecture

```
src/components/
├── cards/
│   ├── CompactCard.vue          — Single-row card shell (white, rounded, shadow)
│   ├── ExtendedCard.vue         — Multi-row card shell with header + content area
│   ├── RawTransactionCard.vue   — Expandable compact card for unknown txs
│   ├── TransferCard.vue         — LYX/LSP7/LSP8 transfer (compact)
│   ├── FollowCard.vue           — Follow/unfollow (compact)
│   ├── ProfileUpdateCard.vue    — Profile metadata edit (extended)
│   ├── PermissionCard.vue       — Permission changes (extended)
│   └── GenericCard.vue          — Fallback for any other known type (extended)
├── shared/
│   ├── ProfileBadge.vue         — Wraps <lukso-profile> + <lukso-username> together
│   ├── TransactionExpander.vue  — Raw data expandable section
│   └── TimeStamp.vue            — Formatted timestamp ("2:57PM · Dec 20, 2024")
├── TransactionList.vue          — Main scrollable feed container
├── ProfileHeader.vue            — Optional header showing whose feed this is
├── LoadingSkeleton.vue          — Loading placeholders
└── ErrorState.vue               — Error display
```

## ProfileBadge Component (CRITICAL)

This is the most important shared component — used everywhere:

```html
<ProfileBadge :address="0x..." :name="Joshkizzz" :profile-url="https://..." :size="small|medium" />
```

Renders:
```html
<div class="flex items-center gap-2">
  <lukso-profile 
    profile-url="..." 
    profile-address="0x..." 
    size="small"
    has-identicon>
  </lukso-profile>
  <lukso-username 
    name="Joshkizzz" 
    address="0x..." 
    prefix="@"
    size="small">
  </lukso-username>
</div>
```

## Data Flow

1. Fetch from `POST /api/activity` → get `DecoderResult[]`
2. For each transaction, classify type based on `functionName`, `logs`, decoded data
3. Call `POST /api/resolveAddresses` for all unique addresses in batch → get names, profile images
4. Render appropriate card type per transaction
5. For transactions needing enhanced decoding → lazy call `POST /api/finishDecoding`

## Transaction Type Classification Logic

```
if logs contain Transfer event (LSP7/LSP8/ERC20):
  → TransferCard (compact)
if functionName == "follow" or logs contain follow event:
  → FollowCard (compact)  
if functionName == "setData" or "setDataBatch":
  → ProfileUpdateCard (extended)
if functionName matches permission operations:
  → PermissionCard (extended)
if decoded and known type:
  → GenericCard (extended)
else:
  → RawTransactionCard (compact, expandable)
```

## Package Dependencies

```json
{
  "@lukso/web-components": "^1.178.0"
}
```

Web components need to be imported in `main.ts`:
```ts
import '@lukso/web-components/components/lukso-profile'
import '@lukso/web-components/components/lukso-username'
```

Vue must be configured to recognize custom elements:
```ts
// vite.config.ts
vue({
  template: {
    compilerOptions: {
      isCustomElement: (tag) => tag.startsWith('lukso-')
    }
  }
})
```

Tailwind preset from web-components:
```js
// tailwind.config.ts
presets: [require('@lukso/web-components/tailwind.config')]
```

## Color Tokens (from LUKSO web-components)
```css
--neutral-100: #FFFFFF;
--neutral-97: #F7F7F7;
--neutral-90: #E5E5E5;
--neutral-60: #999999;
--neutral-40: #666666;
--neutral-20: #333333;
```

## Formatting Rules
| Raw Value | Display |
|---|---|
| `1000000000000000000` (18 decimals) | `1.00 LYX` |
| `0xDE0dA643334B4F0722F45BaA9b1f7B7c71C82976` | `@fabian#DE0d` via lukso-username |
| `1771066716` (Unix timestamp) | `2:57PM · Dec 20, 2024` (extended) or `2h ago` (compact) |

## Implementation Order

1. Install `@lukso/web-components`, configure Vue for custom elements (`lukso-*`)
2. Build `ProfileBadge.vue` — the foundation component
3. Build `CompactCard.vue` and `ExtendedCard.vue` shells
4. Build `TransferCard.vue` (most common, compact)
5. Build `FollowCard.vue` (compact)
6. Build `RawTransactionCard.vue` with expand/collapse
7. Build `ProfileUpdateCard.vue` (extended)
8. Build `PermissionCard.vue` (extended)
9. Update `TransactionList.vue` to use card type routing
10. Update address resolution to feed profile data to components
11. Test with live API data, push to GitHub
