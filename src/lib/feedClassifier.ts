import type { FeedEntry } from './feedTypes'

export interface FeedClassification {
  type: string
  label: string
  icon: string
  color: string
}

/**
 * Classify a FeedEntry into a card type based on eventType + dataKey.
 * Much simpler than classifyTransaction — the Feed API already provides classification.
 */
export function classifyFeedEntry(entry: FeedEntry): FeedClassification {
  switch (entry.eventType) {
    case 'lyx_sent':
    case 'lyx_received':
      return {
        type: 'value_transfer',
        label: 'LYX Transfer',
        icon: '💎',
        color: 'text-lukso-pink',
      }

    case 'lsp7_transfer':
      return {
        type: 'token_transfer',
        label: 'Token Transfer',
        icon: '🪙',
        color: 'text-yellow-500',
      }

    case 'lsp8_transfer':
      return {
        type: 'nft_transfer',
        label: 'NFT Transfer',
        icon: '🖼️',
        color: 'text-purple-500',
      }

    case 'follow':
      return {
        type: 'follow',
        label: 'Followed',
        icon: '👤',
        color: 'text-blue-500',
      }

    case 'unfollow':
      return {
        type: 'unfollow',
        label: 'Unfollowed',
        icon: '👋',
        color: 'text-orange-500',
      }

    case 'data_changed':
      return classifyDataChanged(entry.dataKey)

    case 'action_executed':
      return {
        type: 'contract_execution',
        label: 'Execute',
        icon: '⚡',
        color: 'text-indigo-500',
      }

    default:
      return {
        type: 'unknown',
        label: 'Transaction',
        icon: '📄',
        color: 'text-gray-500',
      }
  }
}

function classifyDataChanged(dataKey?: string): FeedClassification {
  switch (dataKey) {
    case 'lsp3Profile':
      return {
        type: 'profile_update',
        label: 'Profile Update',
        icon: '✏️',
        color: 'text-green-500',
      }

    case 'lsp28TheGrid':
      return {
        type: 'profile_update',
        label: 'Grid Edit',
        icon: '✏️',
        color: 'text-green-500',
      }

    case 'lsp4Metadata':
      return {
        type: 'token_metadata_update',
        label: 'Token Metadata Update',
        icon: '🪙',
        color: 'text-amber-500',
      }

    case 'addressPermissions':
    case 'addressPermissionsPermissions':
      return {
        type: 'permission_change',
        label: 'Permission Change',
        icon: '🔐',
        color: 'text-red-500',
      }

    case 'lsp5ReceivedAssets':
    case 'lsp5ReceivedAssetsMap':
      // Asset tracking updates — treat as generic data change
      return {
        type: 'unknown',
        label: 'Data Update',
        icon: '📄',
        color: 'text-gray-500',
      }

    default:
      return {
        type: 'profile_update',
        label: 'Data Update',
        icon: '✏️',
        color: 'text-green-500',
      }
  }
}
