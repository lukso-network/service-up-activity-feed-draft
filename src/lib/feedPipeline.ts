import type { FeedEntry } from './feedTypes'
import type { Transaction } from './types'
import { dedupeFeedTransferWrappers } from './feedDedupe'
import { consolidatePhloxSwaps } from './phlox'
import { feedEntryToTransaction } from './feedAdapter'
import { classifyTransaction } from './formatters'

/** Transaction types that have a card; others only show in dev mode. */
export const KNOWN_TX_TYPES = new Set([
  'follow', 'unfollow',
  'token_transfer', 'nft_transfer', 'value_transfer',
  'token_mint', 'nft_mint',
  'token_burn', 'nft_burn',
  'profile_update', 'token_metadata_update',
  'permission_change',
  'create_moment',
  'contract_execution',
  'stakingverse_action',
  'phlox_swap',
])

/**
 * Adapt FeedEntry[] → Transaction[] for the card components.
 * Pipeline:
 *   dedupeFeedTransferWrappers   – drop action_executed wrappers whose transfers
 *                                  also exist as standalone lsp7/lsp8 rows.
 *   consolidatePhloxSwaps        – group swap legs (router/feeSplitter transfers
 *                                  + token authorize prep) into one annotated
 *                                  action_executed entry.
 *   classifyTransaction          – filter unknown types unless in dev mode.
 */
export function feedEntriesToTransactions(entries: readonly FeedEntry[], devMode: boolean): Transaction[] {
  const deduped = dedupeFeedTransferWrappers(entries)
  const { entries: consolidated } = consolidatePhloxSwaps(deduped)
  const adapted: Transaction[] = []
  for (const entry of consolidated) {
    const tx = feedEntryToTransaction(entry)
    if (!devMode) {
      const { type } = classifyTransaction(tx)
      if (!KNOWN_TX_TYPES.has(type)) continue
    }
    adapted.push(tx)
  }
  return adapted
}
