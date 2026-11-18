// BigInt-preserving JSON helpers, matching `JSONbigString` from
// `@lukso/transaction-decoder`. Kept local because importing that package's root
// entry pulls the whole decoder (viem, contract ABIs, erc725.js) into the bundle
// just for these few lines.
//
// Convention: a string of digits with an `n` suffix ("123n") is a serialized
// BigInt; every other value is left untouched.

const BIGINT_STRING = /^\d+n$/

function reviveBigInt(value: unknown): unknown {
  if (typeof value === 'string' && BIGINT_STRING.test(value)) {
    return BigInt(value.slice(0, -1))
  }
  return value
}

export const JSONbigString = {
  /** Parse JSON text, turning "123n" strings into BigInt values. */
  parse(text: string): any {
    return JSON.parse(text, (_key, value) => reviveBigInt(value))
  },

  /** Walk an already-parsed value, turning "123n" strings into BigInt values. */
  read(obj: any): any {
    if (obj === null || obj === undefined) return obj
    if (typeof obj === 'bigint') return obj
    if (typeof obj === 'string') return reviveBigInt(obj)
    if (Array.isArray(obj)) return obj.map((item) => JSONbigString.read(item))
    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {}
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) result[key] = JSONbigString.read(obj[key])
      }
      return result
    }
    return obj
  },
}
