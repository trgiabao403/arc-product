const KEY = 'bp-holder-names'
const LAST = 'bp-last-name'

function read(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

/** The buyer's display name is kept in this browser only; the ticket itself is onchain. */
export function saveHolderName(tokenId: number, owner: string, name: string) {
  const all = read()
  all[`${tokenId}:${owner.toLowerCase()}`] = name
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
    localStorage.setItem(LAST, name)
  } catch {
    // storage unavailable: the ticket still works, the name falls back to the wallet address
  }
}

export function getHolderName(tokenId: number, owner: string): string | undefined {
  return read()[`${tokenId}:${owner.toLowerCase()}`]
}

export function loadLastName(): string {
  try {
    return localStorage.getItem(LAST) ?? ''
  } catch {
    return ''
  }
}
