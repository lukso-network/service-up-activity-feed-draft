/**
 * Display keys that carry over between renders of the feed list.
 *
 * A card that turns into a group, or a group that grows — on top by a live
 * update or at the bottom by the next page — keeps the key one of its members
 * had before, so Vue updates it in place (expanded state and paging survive)
 * instead of remounting it and animating it in again. Items with no known
 * member keep their default key.
 */
export interface KeyedItem {
  /** Default key; replaced by the carried-over key when there is one. */
  key: string
  /** Stable identities of the item's members (e.g. transaction hashes). */
  memberKeys: string[]
}

export function createStableKeyAssigner() {
  let previous = new Map<string, string>()

  return function assignStableKeys<T extends KeyedItem>(items: T[]): T[] {
    // When a group splits, its key goes to the part that keeps most of its
    // members (ties: the newer item), so that part keeps its expanded state.
    const claims: { item: number; key: string; members: number }[] = []
    items.forEach((item, index) => {
      const counts = new Map<string, number>()
      for (const member of item.memberKeys) {
        const key = previous.get(member)
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      for (const [key, members] of counts) claims.push({ item: index, key, members })
    })
    claims.sort((a, b) => b.members - a.members || a.item - b.item)

    const assigned = new Map<number, string>()
    const used = new Set<string>()
    for (const claim of claims) {
      if (assigned.has(claim.item) || used.has(claim.key)) continue
      assigned.set(claim.item, claim.key)
      used.add(claim.key)
    }

    const next = new Map<string, string>()
    items.forEach((item, index) => {
      let key = assigned.get(index)
      if (!key) {
        key = item.key
        for (let n = 1; used.has(key); n++) key = `${item.key}#${n}`
        used.add(key)
      }
      item.key = key
      for (const member of item.memberKeys) next.set(member, key)
    })
    previous = next
    return items
  }
}
