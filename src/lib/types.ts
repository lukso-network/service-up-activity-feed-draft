export interface TransactionArg {
  name: string
  internalType: string
  type: string
  value: unknown
  indexed?: boolean
}

export interface TransactionLog {
  address: string
  topics: string[]
  data: string
  eventName?: string
  args?: TransactionArg[]
}

export interface Transaction {
  blockHash: string
  blockNumber: string
  blockTimestamp: number
  transactionIndex: number
  transactionHash: string
  status: number
  gasUsed: string
  gasPrice: string
  to: string
  from: string
  value: string
  input: string
  isDecoded?: boolean
  resultType?: string
  functionName?: string
  sig?: string
  __decoder?: string
  standard?: string
  args?: TransactionArg[]
  phase?: string
  logs: TransactionLog[]
  // Enhanced fields added by finishDecoding
  fromName?: string
  fromImage?: string
  toName?: string
  toImage?: string
}

export interface ActivityResponse {
  data: Transaction[]
  totalCount?: number
  pagination: {
    nextToBlock: number | null
    hasMore: boolean
  }
  query?: {
    to: string[]
    from: string[]
  }
}

export interface ProfileImage {
  width: number
  height: number
  src: string
  verified?: string
}

export interface AddressIdentity {
  address: string
  __gqltype?: string
  name?: string
  fullName?: string
  standard?: string
  tags?: string[]
  description?: string
  profileImages?: ProfileImage[]
  backgroundImages?: ProfileImage[]
  // Token/Asset fields
  icons?: ProfileImage[]
  images?: ProfileImage[]
  decimals?: number
  lsp4TokenName?: string
  lsp4TokenSymbol?: string
  lsp4TokenType?: number
  isLSP7?: boolean
  isCollection?: boolean
  isUnknown?: boolean
}

export interface ResolveAddressesResponse {
  success: boolean
  addressIdentities: Record<string, AddressIdentity>
}
