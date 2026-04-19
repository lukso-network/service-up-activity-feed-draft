// Feed API types — matches Envio Feed table schema

export type FeedEventType =
  | 'lsp7_transfer'
  | 'lsp8_transfer'
  | 'lyx_sent'
  | 'lyx_received'
  | 'follow'
  | 'unfollow'
  | 'data_changed'
  | 'action_executed'

// --- Enriched relationship data from expanded feed query ---

export interface FeedProfileInfo {
  id: string
  name?: string | null
  profileImages?: Array<{ src: string; width: number; height: number }>
}

export interface FeedAssetInfo {
  id: string
  name?: string | null
  lsp4TokenName?: string | null
  lsp4TokenSymbol?: string | null
  lsp4TokenType?: number | null
  decimals?: number | null
  owner_id?: string | null
  icons?: Array<{ src: string; width: number; height: number }>
  images?: Array<{ src: string; width: number; height: number }>
  lsp4Creators?: Array<{ profile_id: string }>
}

// --- Decoded sub-types per eventType ---

export interface Lsp7TransferDecoded {
  from: string
  to: string
  fromName?: string
  toName?: string
  tokenName?: string
  tokenSymbol?: string
  formattedAmount?: string
  amount?: string
  decimals?: number
}

export interface Lsp8TransferDecoded {
  from: string
  to: string
  fromName?: string
  toName?: string
  tokenName?: string
  tokenSymbol?: string
  tokenId?: string
}

export interface LyxSentDecoded {
  from: string
  to: string
  amount: string
  receiverName?: string
}

export interface LyxReceivedDecoded {
  from: string
  to: string
  amount: string
  senderName?: string
}

export interface FollowDecoded {
  follower: string
  followee: string
  followerName?: string
  followeeName?: string
}

export interface UnfollowDecoded {
  follower: string
  followee: string
}

export interface DataChangedDecoded {
  name?: string
  key?: string
  value?: string
  subtype?: string
  profile_id?: string
}

export interface ActionExecutedDecoded {
  profile?: string
  target?: string
  selector?: string
  value?: string
  transaction?: Record<string, unknown>
}

export type FeedDecoded =
  | Lsp7TransferDecoded
  | Lsp8TransferDecoded
  | LyxSentDecoded
  | LyxReceivedDecoded
  | FollowDecoded
  | UnfollowDecoded
  | DataChangedDecoded
  | ActionExecutedDecoded
  | Record<string, unknown>

// --- Main Feed entry ---

export interface FeedEntry {
  id: string
  blockNumber: number
  transactionHash: string
  logIndex: number
  transactionIndex?: number
  address: string
  eventType: FeedEventType
  dataKey?: string
  decoded: FeedDecoded
  timestamp: number
  // Enriched relationship data from expanded query
  profileArgs?: Array<{ profile: FeedProfileInfo }>
  assetArgs?: Array<{ asset: FeedAssetInfo }>
}
