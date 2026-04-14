import type { Transaction, TransactionArg } from './types'
import type { FeedEntry, Lsp7TransferDecoded, Lsp8TransferDecoded, LyxSentDecoded, LyxReceivedDecoded, FollowDecoded, UnfollowDecoded, DataChangedDecoded, ActionExecutedDecoded } from './feedTypes'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const LSP26_CONTRACT = '0xf01103e5a9909fc0dbe8166da7085e0c86ba0296'

/**
 * Adapt a FeedEntry to the existing Transaction interface so all existing
 * card components work without modification. This is the bridge layer.
 */
function parseDecimalToWei(str: string | undefined): string {
  if (!str) return '0'
  let clean = str.replace(/n$/, '')
  if (clean.includes('.')) {
    let [whole, frac] = clean.split('.')
    whole = whole || '0'
    frac = frac || ''
    if (frac.length > 18) frac = frac.slice(0, 18)
    frac = frac.padEnd(18, '0')
    return whole + frac
  }
  return clean + '000000000000000000'
}

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
        value: parseDecimalToWei(d.amount),
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
      const innerTx = (d.transaction || {}) as Record<string, unknown>
      const innerFn = String(innerTx.functionName || '')
      const innerStd = String(innerTx.standard || '')
      const innerArgsRaw: unknown = innerTx.args
      const innerArgs: Array<Record<string, unknown>> = Array.isArray(innerArgsRaw)
        ? (innerArgsRaw as Array<Record<string, unknown>>)
        : []
      const profile = d.profile || entry.address || ''
      const target = d.target || ''
      const outerValueRaw = String(d.value || '0').replace(/n$/, '')

      const findArg = (name: string): unknown =>
        innerArgs.find((a) => a?.name === name)?.value

      const passThroughArgs: TransactionArg[] = innerArgs.map((a) => ({
        name: String(a?.name || ''),
        internalType: String(a?.internalType || a?.type || ''),
        type: String(a?.type || ''),
        value: a?.value,
        indexed: typeof a?.indexed === 'boolean' ? (a.indexed as boolean) : undefined,
      }))

      // Follow / Unfollow via LSP26 — show as a follow/unfollow card
      if (innerFn === 'follow' || innerFn === 'unfollow') {
        const isUnfollow = innerFn === 'unfollow'
        const followee = String(findArg('addr') ?? innerArgs[0]?.value ?? '')
        return {
          ...base,
          from: profile,
          to: LSP26_CONTRACT,
          functionName: isUnfollow ? 'unfollow' : 'follow',
          standard: 'LSP26',
          args: [
            { name: 'addr', internalType: 'address', type: 'address', value: followee },
          ],
        }
      }

      // LSP7 token transfer / mint — single
      if (innerStd === 'LSP7DigitalAsset' && (innerFn === 'transfer' || innerFn === 'mint')) {
        const fromVal = findArg('from')
        const from = typeof fromVal === 'string' ? fromVal : profile
        return {
          ...base,
          from,
          to: target, // token contract
          functionName: innerFn,
          standard: 'LSP7DigitalAsset',
          args: passThroughArgs,
        }
      }

      // LSP7 transferBatch — TransactionList.vue splits this into individual transfers
      if (innerStd === 'LSP7DigitalAsset' && innerFn === 'transferBatch') {
        const fromArg = findArg('from')
        const from = Array.isArray(fromArg) && typeof fromArg[0] === 'string'
          ? (fromArg[0] as string)
          : profile
        return {
          ...base,
          from,
          to: target,
          functionName: 'transferBatch',
          standard: 'LSP7DigitalAsset',
          args: passThroughArgs,
        }
      }

      // LSP8 NFT transfer / mint
      if (innerStd === 'LSP8IdentifiableDigitalAsset' && (innerFn === 'transfer' || innerFn === 'mint')) {
        const fromVal = findArg('from')
        const from = typeof fromVal === 'string' ? fromVal : profile
        return {
          ...base,
          from,
          to: target,
          functionName: innerFn,
          standard: 'LSP8IdentifiableDigitalAsset',
          args: passThroughArgs,
        }
      }

      // Plain LYX send via execute — no matching standard above, but outer value > 0
      try {
        if (BigInt(outerValueRaw || '0') > 0n) {
          return {
            ...base,
            from: profile,
            to: target,
            value: outerValueRaw,
            // intentionally no functionName/standard → classifyTransaction picks value_transfer
          }
        }
      } catch {
        // ignore BigInt parse errors
      }

      // Unknown / unmappable (executeBatch on UP, authorizeOperator, transferOwnership,
      // undecoded execute, followBatch, etc.) → return base so filter drops it as 'unknown'
      return base
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
