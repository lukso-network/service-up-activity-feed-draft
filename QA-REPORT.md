# UP Activity Feed - QA Audit Report

**Audit Date:** March 18, 2026  
**URL Tested:** http://localhost:5173/#/42/0x6bdAC8caA6e98E5beCF22BC0f8C395074FB23A713  
**Total Cards Inspected:** ~150+ cards  
**Time Range Covered:** Last 8+ hours of activity

---

## Summary

The feed displays activity correctly overall, but there are several inconsistencies in language, formatting, and display that should be addressed for a polished production experience.

### Card Types Observed

| Card Type | Count (approx) | Notes |
|-----------|----------------|-------|
| Token Transfer (Sent) | 35+ | LYX, WLYX1, STL, POTATO, LIKES |
| NFT Transfer (sent BPIX) | 8+ | Burnt Pix NFTs |
| Minted | 20+ | Mostly STL minting |
| Liked with | 15+ | Forever Moments likes |
| Followed | 10+ | User follow actions |
| Updated profile data | 12+ | Profile data updates |
| Edited grid | 10+ | Grid edits |
| Edited profile | 5+ | Profile edits |
| Bridged | 2+ | Hyperlane bridge to Ethereum |
| Group Transfer | 6+ | "X users transferred" |
| Unfollowed | 1 | User unfollow action |
| Created moment | 1 | Forever Moments creation |

---

## Issues

### Issue 1: Inconsistent Verb Capitalization - "Sent" vs "sent"

- **Type**: language
- **Location**: Token transfer and NFT transfer cards throughout the feed
- **Description**: The verb "Sent" is capitalized for LYX and token transfers, but lowercase "sent" is used for NFT transfers (e.g., BPIX). Both represent the same action.
- **Examples**:
  - ✅ `@kaliyuga #e119 Sent 10.8000 WLYX1 to PEPITO` (capitalized)
  - ❌ `0xC414eb19...Ee02bAa1 sent BPIX to 0x3983151E...D2535F82` (lowercase)
- **Expected**: Consistent capitalization. Recommend "Sent" for all transfer types.

---

### Issue 2: Typo in NFT Name - "Flowerimg Currant"

- **Type**: data
- **Location**: Forever Moments NFT card, appears multiple times in feed
- **Description**: The NFT name contains a typo: "Flowerimg" instead of "Flowering"
- **Current**: "Flowerimg Currant"
- **Expected**: "Flowering Currant"
- **Note**: This may be user-generated content stored on-chain, in which case it cannot be fixed by the app.

---

### Issue 3: Missing NFT Image for "HISTORY MAKERS 💫"

- **Type**: data / layout
- **Location**: Forever Moments NFT cards showing "HISTORY MAKERS 💫" 
- **Description**: The NFT card shows `0x73D2...adA7` with no image thumbnail visible. The image placeholder area appears empty/black.
- **Expected**: Either display a fallback placeholder image or handle the loading state gracefully.

---

### Issue 4: Inconsistent Profile Display - Address vs @username#hash

- **Type**: data / consistency
- **Location**: Throughout the feed
- **Description**: Some users show resolved profile names (e.g., `@kaliyuga #e119`, `@geotchief #dE0D`) while creators of the same NFTs sometimes show only addresses (e.g., `0xcC39Dbe9...022dC10D`).
- **Examples**:
  - José Alvalade NFT: "Created by 0xcC39Dbe9...022dC10D" (address only)
  - But @geotchief who liked it shows with username
- **Expected**: Consistent profile resolution. If a Universal Profile exists, it should resolve to @username#hash format.

---

### Issue 5: Duplicate Token Name Display

- **Type**: layout
- **Location**: Token cards with icons
- **Description**: When a token has both a name and symbol, sometimes the name appears twice.
- **Examples**:
  - `link "PEPITO PEPITO"` - token icon shows "PEPITO" then text says "PEPITO" again
  - `link "Just a Potato 🥔 Just a Potato 🥔"` - duplicated
- **Expected**: Show token icon + symbol once, not repeated.

---

### Issue 6: Decimal Precision Inconsistency

- **Type**: formatting
- **Location**: Token amounts throughout
- **Description**: Different tokens show different decimal precisions without clear rationale:
  - `10.8000 WLYX1` - 4 decimals
  - `6,539.8955 WLYX1` - 4 decimals
  - `582.613 LYX` - 3 decimals
  - `83 LYX` - 0 decimals
  - `1 LYX` - 0 decimals
- **Expected**: Consistent formatting rules:
  - Whole numbers: show no decimals (e.g., "83 LYX", "1,000 POTATO")
  - Fractional: show up to 4 significant decimals, trimming trailing zeros

---

### Issue 7: Action Verb Inconsistencies

- **Type**: language
- **Location**: Various action cards
- **Description**: Some actions use past tense, others present/imperative inconsistently:
  - `minted` (past tense) ✅
  - `Sent` (past tense) ✅
  - `bridged` (lowercase, past) 
  - `followed` (lowercase, past)
  - `liked with` (past) ✅
  - `updated profile data` (past) ✅
  - `edited their grid` (past) ✅
  - `unfollowed` (past) ✅
  - `created a new moment` (past) ✅
- **Issue**: "bridged" and "followed" are lowercase while "Sent" is capitalized
- **Expected**: All action verbs should follow consistent capitalization (recommend: capitalize first letter)

---

### Issue 8: Timestamp Format Consistency

- **Type**: formatting
- **Location**: All cards
- **Description**: Timestamps use relative time (good), but the format varies:
  - "3 mins ago"
  - "52 mins ago"
  - "1 hour ago"
  - "2 hours ago"
  - "8 hours ago"
- **Observation**: Format is consistent. No issues found here.
- **Status**: ✅ PASS

---

### Issue 9: "AI Agent" Badge Display

- **Type**: layout / functionality
- **Location**: Cards involving AI agents (@luksoagent, @ito, @leo)
- **Description**: AI Agent badge shows correctly with icon + "AI Agent" text. Works as expected.
- **Status**: ✅ PASS

---

### Issue 10: Group Transfer Cards - Grammar

- **Type**: language
- **Location**: Group transfer cards
- **Description**: The text "3 users transferred" / "2 users transferred" is grammatically functional but could be more descriptive.
- **Current**: "3 users transferred 🔵 2,189.9087 LYX"
- **Suggestion**: Consider "3 transfers totaling 2,189.9087 LYX" or keep current if intentional.
- **Status**: Minor / Style preference

---

### Issue 11: Missing NFT Image - "NEW LUKSO BANDIT"

- **Type**: data
- **Location**: Forever Moments card
- **Description**: Similar to Issue 3, the NFT "NEW LUKSO BANDIT" by @yoruba #E32c shows with token ID `0x71c1...c6d9` but no visible image thumbnail.
- **Expected**: Either load the image or show a placeholder.

---

### Issue 12: Profile Hash Case Inconsistency

- **Type**: formatting
- **Location**: Profile links throughout
- **Description**: The hash portion of profile identifiers shows mixed case:
  - `#e119` (lowercase)
  - `#dE0D` (mixed case)
  - `#Eb2C` (mixed case)
  - `#00ea` (lowercase)
  - `#8AdC` (mixed case)
- **Technical Note**: These are address checksums, so mixed case is correct (EIP-55). Not an issue.
- **Status**: ✅ PASS - This is correct behavior

---

### Issue 13: Action Multiplier Display

- **Type**: layout
- **Location**: Cards with multiple actions
- **Description**: When a user performs multiple actions, it shows as "2x", "3x", etc.:
  - "updated profile data 2x"
  - "edited their grid 3x"
  - "edited their profile 3x"
  - "updated profile data 11x"
- **Observation**: This is helpful for batching. Works correctly.
- **Status**: ✅ PASS

---

### Issue 14: Emoji Placement Consistency

- **Type**: layout
- **Location**: Action cards
- **Description**: Action emojis appear after the action text:
  - "updated profile data ✏️"
  - "edited their grid 🧩"
  - "edited their profile ✨"
  - "followed 👤"
  - "unfollowed 👋"
  - "bridged ... 🌉 to Ethereum"
  - "created a new moment 📸"
- **Observation**: Consistent placement. Good UX.
- **Status**: ✅ PASS

---

### Issue 15: Token Transfer Linking

- **Type**: functionality
- **Location**: Token transfer cards
- **Description**: Token amounts link to the asset page, which is correct behavior.
- **Example**: "12 STL" links to `/asset/0x4beD66BA55006f81dBc53C094A0ec09f5fD1Ff2F`
- **Status**: ✅ PASS

---

## High Priority Issues (Should Fix)

1. **Issue 1**: Inconsistent "Sent" vs "sent" capitalization
2. **Issue 4**: Inconsistent profile resolution (addresses vs @usernames)
3. **Issue 5**: Duplicate token name display
4. **Issue 6**: Inconsistent decimal precision
5. **Issue 7**: Inconsistent action verb capitalization

## Medium Priority Issues (Consider Fixing)

6. **Issue 3 & 11**: Missing NFT images - need fallback/placeholder
7. **Issue 2**: Typo in NFT name (may be on-chain data)

## Low Priority / Informational

8. **Issue 10**: Group transfer grammar is acceptable

---

## Test Coverage Notes

### Functionality Tested
- ✅ Token transfers (LYX, WLYX1, STL, POTATO, LIKES)
- ✅ NFT transfers (BPIX - Burnt Pix)
- ✅ Minting actions
- ✅ Like actions (Forever Moments)
- ✅ Follow/Unfollow actions
- ✅ Profile updates
- ✅ Grid edits
- ✅ Profile edits
- ✅ Bridge transactions (Hyperlane)
- ✅ Group/batched transfers
- ✅ Moment creation (Forever Moments)
- ✅ AI Agent badge display
- ✅ Relative timestamps
- ✅ Profile link resolution
- ✅ Token icon display
- ✅ NFT card expansion (expanded cards show correctly)

### Not Tested (Out of Scope)
- Mobile responsiveness
- Dark/light theme
- Performance under load
- Error states (network failures)
- Empty feed state
- Infinite scroll pagination edge cases

---

## Recommendations

1. **Create a style guide** for action verbs (capitalize first letter, use past tense consistently)
2. **Implement token display component** that doesn't duplicate icon+name
3. **Add number formatting utility** with consistent decimal rules
4. **Improve profile resolution** to always show @username when available
5. **Add fallback images** for NFTs that fail to load

---

*Report generated by QA audit on March 18, 2026*
