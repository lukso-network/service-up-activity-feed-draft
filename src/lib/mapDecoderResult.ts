import type { Transaction, TransactionArg, TransactionLog } from './types'

/**
 * Maps a DecoderResult (from @lukso/transaction-decoder) to our local Transaction type.
 * DecoderResult extends Partial<viem.Transaction> + decoder-specific fields,
 * so most fields map directly.
 */
export function mapDecoderResultToTransaction(dr: any): Transaction {
  // Map args from the decoder's ArrayArgs format to our TransactionArg[]
  const args: TransactionArg[] = []
  if (dr.args && Array.isArray(dr.args)) {
    for (const arg of dr.args) {
      args.push({
        name: arg.name ?? '',
        internalType: arg.internalType ?? arg.type ?? '',
        type: arg.type ?? '',
        value: arg.value,
        indexed: arg.indexed,
      })
    }
  }
  // Also check namedArgs (some decoder results use this)
  if (dr.namedArgs && typeof dr.namedArgs === 'object') {
    for (const [name, arg] of Object.entries(dr.namedArgs as Record<string, any>)) {
      if (!args.find(a => a.name === name)) {
        args.push({
          name,
          internalType: arg.internalType ?? arg.type ?? '',
          type: arg.type ?? '',
          value: arg.value,
          indexed: arg.indexed,
        })
      }
    }
  }

  // Map logs
  const logs: TransactionLog[] = []
  if (dr.logs && Array.isArray(dr.logs)) {
    for (const log of dr.logs) {
      const logArgs: TransactionArg[] = []
      if (log.args && Array.isArray(log.args)) {
        for (const arg of log.args) {
          logArgs.push({
            name: arg.name ?? '',
            internalType: arg.internalType ?? arg.type ?? '',
            type: arg.type ?? '',
            value: arg.value,
            indexed: arg.indexed,
          })
        }
      }
      logs.push({
        address: log.address ?? '',
        topics: log.topics ?? [],
        data: log.data ?? '',
        eventName: log.eventName,
        args: logArgs.length > 0 ? logArgs : undefined,
      })
    }
  }

  return {
    blockHash: dr.blockHash ?? '',
    blockNumber: String(dr.blockNumber ?? '0'),
    blockTimestamp: dr.blockTimestamp ?? 0,
    transactionIndex: dr.transactionIndex ?? 0,
    transactionHash: dr.transactionHash ?? dr.hash ?? '',
    status: dr.status !== undefined ? (typeof dr.status === 'string' ? (dr.status === 'success' ? 1 : 0) : Number(dr.status)) : 1,
    gasUsed: String(dr.gasUsed ?? '0'),
    gasPrice: String(dr.gasPrice ?? '0'),
    to: dr.to ?? '',
    from: dr.from ?? '',
    value: String(dr.value ?? '0'),
    input: dr.input ?? '',
    isDecoded: dr.isDecoded ?? false,
    resultType: dr.resultType,
    functionName: dr.functionName,
    sig: dr.sig,
    __decoder: dr.__decoder,
    standard: dr.standard,
    args: args.length > 0 ? args : undefined,
    phase: dr.phase,
    logs,
    children: dr.wrappers ?? dr.children,
    wrappers: dr.wrappers,
  }
}
