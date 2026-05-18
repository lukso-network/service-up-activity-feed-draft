export type StakingverseContractKind = 'vault' | 'slyx'

export interface StakingverseAction {
  contract: StakingverseContractKind
  functionName: string
  selector: string
  standard: 'StakingverseVault' | 'StakingverseSLYX'
}

const STAKINGVERSE_CONTRACTS: Record<string, StakingverseContractKind> = {
  // LUKSO mainnet
  '0x9f49a95b0c3c9e2a6c77a16c177928294c0f6f04': 'vault',
  '0x2cb02ef26addab15686ed634d70699ab64f195f4': 'vault',
  '0x1711b2e1b64f38ca33e51b717cfd27acd1bd2e2d': 'vault',
  '0x8a3982f0a7d154d11a5f43eec7f50e52ebbc8f7d': 'slyx',
  '0x08b28405a11348745a3187de2a29c730c53eb29b': 'slyx',

  // LUKSO testnet
  '0x420458294fc1adada36773866a33bc2c8e8e68ef': 'vault',
  '0xb5a696855897726fd62db29779c1658bd3e4115c': 'vault',
  '0x0d2a54fb503ba6a6d9c4eb18303a0da4cbe63e77': 'vault',
  '0x796b1fdcde61280ef51b94f5a68132941856ec0c': 'slyx',
}

const SELECTOR_TO_FUNCTION: Record<string, string> = {
  // StakingverseVault.sol / IVault
  '0xc0c53b8b': 'initialize',
  '0xb3ab15fb': 'setOperator',
  '0x8456cb59': 'pause',
  '0x3f4ba83a': 'unpause',
  '0x1ab971ab': 'setFee',
  '0xe74b981b': 'setFeeRecipient',
  '0xbdc8144b': 'setDepositLimit',
  '0xaca756ad': 'enableOracle',
  '0xa8593a42': 'allowlist',
  '0x24daddc5': 'setRestricted',
  '0xf340fa01': 'deposit',
  '0x00f714ce': 'withdraw',
  '0xddd5e1b2': 'claim',
  '0xfc4db323': 'claimFees',
  '0x7d7c2a1c': 'rebalance',
  '0x68f8b928': 'registerValidator',
  '0xa5ea2d7a': 'registerValidators',
  '0xf2f1042f': 'transferStake',
  '0xa97e5c93': 'isOracle',
  '0x05a3b809': 'isAllowlisted',
  '0xf5eb42dc': 'sharesOf',
  '0x70a08231': 'balanceOf',
  '0x59b8c763': 'pendingBalanceOf',
  '0x9c3ee244': 'claimableBalanceOf',
  '0x01e1d114': 'totalAssets',
  '0x0c5642d3': 'isValidatorRegistered',

  // SLYXToken.sol / ISLYX
  '0xe33c3595': 'onVaultStakeReceived',
  '0x44d17187': 'burn',
  '0x3cff79f7': 'getNativeTokenValue',
  '0x660aeffc': 'getSLYXTokenValue',
  '0xe6aa216c': 'getExchangeRate',
}

const KNOWN_FUNCTIONS = new Set(Object.values(SELECTOR_TO_FUNCTION))

export function getStakingverseAction(
  target: unknown,
  selector: unknown,
  fallbackFunctionName?: string,
): StakingverseAction | null {
  const contract = getStakingverseContract(target)
  if (!contract) return null

  const normalizedSelector = normalizeSelector(selector)
  let functionName = normalizedSelector ? SELECTOR_TO_FUNCTION[normalizedSelector] : undefined

  if (!functionName && fallbackFunctionName && KNOWN_FUNCTIONS.has(fallbackFunctionName)) {
    functionName = fallbackFunctionName
  }

  // Empty calldata to the vault hits receive(), which delegates to deposit(msg.sender).
  if (!functionName && contract === 'vault' && isEmptySelector(selector)) {
    functionName = 'deposit'
  }

  if (!functionName) return null

  return {
    contract,
    functionName,
    selector: normalizedSelector,
    standard: contract === 'vault' ? 'StakingverseVault' : 'StakingverseSLYX',
  }
}

function getStakingverseContract(address: unknown): StakingverseContractKind | null {
  if (typeof address !== 'string') return null
  return STAKINGVERSE_CONTRACTS[address.toLowerCase()] ?? null
}

function normalizeSelector(selector: unknown): string {
  if (typeof selector !== 'string') return ''
  const value = selector.toLowerCase()
  if (!value.startsWith('0x') || value.length < 10) return ''
  return value.slice(0, 10)
}

function isEmptySelector(selector: unknown): boolean {
  if (selector == null) return true
  if (typeof selector !== 'string') return false
  const value = selector.toLowerCase()
  return value === '' || value === '0x' || value === '0x00000000'
}
