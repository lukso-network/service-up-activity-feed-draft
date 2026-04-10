import type { Transaction, TransactionArg } from './types'
import type { FeedEntry, Lsp7TransferDecoded, Lsp8TransferDecoded, LyxSentDecoded, LyxReceivedDecoded, FollowDecoded, UnfollowDecoded, DataChangedDecoded, ActionExecutedDecoded } from './feedTypes'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const LSP26_CONTRACT = '0xf01103e5a9909fc0dbe8166da7085e0c86ba0296'

/**
 * Adapt a FeedEntry to the existing Transaction interface so all existing
 * card components work without modification. This is the bridge layer.
 */
export function feedEntryToTransaction(entry: FeedEntry): Transaction {
  const base: Transaction = {
    blockHash: '',
    blockNumber: String(entry.blockNumber),
    blockTimestamp: entry.timestamp,
    transactionIndex: entry.transactionIndex ?? 0,
    transactionHash: entry.transactionHash,
    status: 1, // Feed API only indexes successful events
    gasUsed: '0',
    gasPrice: '0',
    to: entry.address,
    from: '',
    value: '0',
    input: '0x',
    isDecoded: true,
    logs: [],
  }

  const decoded = entry.decoded

  switch (entry.eventType) {
    case 'lyx_sent':
    case 'lyx_received': {
      const d = decoded as LyxSentDecoded & LyxReceivedDecoded
      return {
        ...base,
        from: d.from || '',
        to: d.to || '',
        value: d.amount || '0',
        fromName: (d as LyxReceivedDecoded).senderName,
        toName: (d as LyxSentDecoded).receiverName,
      }
    }

    case 'lsp7_transfer': {
      const d = decoded as Lsp7TransferDecoded
      const isMint = d.from === ZERO_ADDRESS
      const args: TransactionArg[] = [
        { name: 'from', internalType: 'address', type: 'address', value: d.from || '' },
        { name: 'to', internalType: 'address', type: 'address', value: d.to || '' },
        { name: 'amount', internalType: 'uint256', type: 'uint256', value: d.amount || '0' },
        { name: 'force', internalType: 'bool', type: 'bool', value: true },
        { name: 'data', internalType: 'bytes', type: 'bytes', value: '0x' },
      ]
      return {
        ...base,
        from: d.from || '',
        to: entry.address, // token contract
        functionName: isMint ? 'mint' : 'transfer',
        standard: 'LSP7DigitalAsset',
        args,
        fromName: d.fromName,
        toName: d.toName,
        feedTokenName: d.tokenName,
        feedTokenSymbol: d.tokenSymbol,
        feedFormattedAmount: d.formattedAmount,
        feedTokenDecimals: d.decimals,
      }
    }

    case 'lsp8_transfer': {
      const d = decoded as Lsp8TransferDecoded
      const isMint = d.from === ZERO_ADDRESS
      const args: TransactionArg[] = [
        { name: 'from', internalType: 'address', type: 'address', value: d.from || '' },
        { name: 'to', internalType: 'address', type: 'address', value: d.to || '' },
        { name: 'tokenId', internalType: 'bytes32', type: 'bytes32', value: d.tokenId || '' },
        { name: 'force', internalType: 'bool', type: 'bool', value: true },
        { name: 'data', internalType: 'bytes', type: 'bytes', value: '0x' },
      ]
      return {
        ...base,
        from: d.from || '',
        to: entry.address, // token contract
        functionName: isMint ? 'mint' : 'transfer',
        standard: 'LSP8IdentifiableDigitalAsset',
        args,
        fromName: d.fromName,
        toName: d.toName,
        feedTokenName: d.tokenName,
        feedTokenSymbol: d.tokenSymbol,
      }
    }

    case 'follow': {
      const d = decoded as FollowDecoded
      return {
        ...base,
        from: d.follower || '',
        to: LSP26_CONTRACT,
        functionName: 'follow',
        standard: 'LSP26',
        args: [
          { name: 'addr', internalType: 'address', type: 'address', value: d.followee || '' },
        ],
        fromName: d.followerName,
        toName: d.followeeName,
      }
    }

    case 'unfollow': {
      const d = decoded as UnfollowDecoded
      return {
        ...base,
        from: d.follower || '',
        to: LSP26_CONTRACT,
        functionName: 'unfollow',
        standard: 'LSP26',
        args: [
          { name: 'addr', internalType: 'address', type: 'address', value: d.followee || '' },
        ],
      }
    }

    case 'data_changed': {
      const d = decoded as DataChangedDecoded
      const dataKeyHex = d.key || ''
      return {
        ...base,
        from: d.profile_id || entry.address || '',
        to: d.profile_id || entry.address || '',
        functionName: 'setData',
        args: [
          { name: 'dataKey', internalType: 'bytes32', type: 'bytes32', value: dataKeyHex },
          { name: 'dataValue', internalType: 'bytes', type: 'bytes', value: d.value || '0x' },
        ],
        // Map known dataKeys to standard field for classifyTransaction compatibility
        standard: dataKeyToStandard(entry.dataKey),
      }
    }

    case 'action_executed': {
      const d = decoded as ActionExecutedDecoded
      return {
        ...base,
        from: d.profile || entry.address || '',
        to: d.target || '',
        value: d.value || '0',
        functionName: 'execute',
      }
    }

    default:
      return base
  }
}

function dataKeyToStandard(dataKey?: string): string | undefined {
  switch (dataKey) {
    case 'lsp4Metadata':
      return 'LSP7DigitalAsset' // triggers token_metadata_update classification
    case 'addressPermissions':
    case 'addressPermissionsPermissions':
      return 'LSP6'
    default:
      return undefined
  }
}
