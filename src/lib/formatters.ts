import type { Transaction } from './types'

/**
 * Add width parameter to universalprofile.cloud image URLs for optimized loading.
 * @param url - The image URL
 * @param renderedWidth - The rendered width in CSS pixels (will be doubled for retina)
 */
export function optimizeImageUrl(url: string, renderedWidth: number): string {
  if (!url) return url
  // Only optimize universalprofile.cloud/image URLs
  if (!url.includes('api.universalprofile.cloud/image')) return url
  const width = renderedWidth * 2 // 2x for retina displays
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}width=${width}`
}

export function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp

  if (diff < 60) return 'just now'
  if (diff < 3600) {
    const mins = Math.floor(diff / 60)
    return `${mins} min${mins > 1 ? 's' : ''} ago`
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  }
  if (diff < 604800) {
    const days = Math.floor(diff / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }

  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}

export function formatFullTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const day = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
  return `${time} \u00B7 ${day}`
}

export function formatLYX(value: string): string {
  try {
    const num = BigInt(value)
    if (num === 0n) return ''

  const whole = num / 10n ** 18n
  const fraction = num % 10n ** 18n

  if (fraction === 0n) {
    return `${whole} LYX`
  }

  const fractionStr = fraction.toString().padStart(18, '0').replace(/0+$/, '')
  const displayFraction = fractionStr.slice(0, 4)
  return `${whole}.${displayFraction} LYX`
  } catch {
    return value
  }
}

export function shortenAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatFunctionName(name?: string): string {
  if (!name) return 'Contract Interaction'
  // Convert camelCase to readable: "setDataBatch" -> "Set Data Batch"
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

export function getExplorerUrl(hash: string, chainId: number): string {
  const base = chainId === 4201
    ? 'https://explorer.execution.testnet.lukso.network'
    : 'https://explorer.lukso.network'
  return `${base}/tx/${hash}`
}

export function getExplorerAddressUrl(address: string, chainId: number): string {
  const base = chainId === 4201
    ? 'https://explorer.execution.testnet.lukso.network'
    : 'https://explorer.lukso.network'
  return `${base}/address/${address}`
}

export function classifyTransaction(tx: Transaction): {
  type: string
  label: string
  icon: string
  color: string
} {
  const fn = tx.functionName?.toLowerCase() ?? ''
  const standard = tx.standard?.toLowerCase() ?? ''
  const input = tx.input?.toLowerCase() ?? '0x'
  const value = BigInt(tx.value || '0')

  // LSP26 Follow/Unfollow — use standard field first, then fallback to function name
  if (standard.includes('lsp26') || fn.includes('follow')) {
    const isUnfollow = fn.includes('unfollow')
    return {
      type: isUnfollow ? 'unfollow' : 'follow',
      label: isUnfollow ? 'Unfollowed' : 'Followed',
      icon: isUnfollow ? '👋' : '👤',
      color: isUnfollow ? 'text-orange-500' : 'text-blue-500',
    }
  }

  // LSP7 Token transfers
  if (standard.includes('lsp7') || (standard.includes('digitalasset') && !standard.includes('identifiable'))) {
    return {
      type: 'token_transfer',
      label: 'Token Transfer',
      icon: '🪙',
      color: 'text-yellow-500',
    }
  }

  // LSP8 NFT transfers
  if (standard.includes('lsp8') || standard.includes('identifiabledigitalasset')) {
    return {
      type: 'nft_transfer',
      label: 'NFT Transfer',
      icon: '🖼️',
      color: 'text-purple-500',
    }
  }

  // Profile update (ERC725Y setData)
  if (fn.includes('setdata') || fn.includes('setdatabatch')) {
    return {
      type: 'profile_update',
      label: 'Profile Update',
      icon: '✏️',
      color: 'text-green-500',
    }
  }

  // Permission changes (LSP6)
  if (standard.includes('lsp6') || fn.includes('setallowedcalls') || fn.includes('setpermissions')) {
    return {
      type: 'permission_change',
      label: 'Permission Change',
      icon: '🔐',
      color: 'text-red-500',
    }
  }

  // Pure value transfer (no calldata)
  if (value > 0n && (input === '0x' || input.length <= 10)) {
    return {
      type: 'value_transfer',
      label: 'LYX Transfer',
      icon: '💎',
      color: 'text-lukso-pink',
    }
  }

  // Execute call on a Key Manager / UP
  if (fn === 'execute' || fn === 'executebatch') {
    // If there's value, it's a transfer via execute
    if (value > 0n) {
      return {
        type: 'value_transfer',
        label: 'LYX Transfer',
        icon: '💎',
        color: 'text-lukso-pink',
      }
    }
    return {
      type: 'contract_execution',
      label: 'Execute',
      icon: '⚡',
      color: 'text-indigo-500',
    }
  }

  // Has value attached
  if (value > 0n) {
    return {
      type: 'value_transfer',
      label: 'LYX Transfer',
      icon: '💎',
      color: 'text-lukso-pink',
    }
  }

  // Unknown / generic
  return {
    type: 'unknown',
    label: fn ? formatFunctionName(fn) : 'Contract Interaction',
    icon: '📄',
    color: 'text-gray-500',
  }
}
