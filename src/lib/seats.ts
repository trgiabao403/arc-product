export type Tier = 0 | 1 | 2

export interface TierInfo {
  tier: Tier
  key: string
  name: string
  short: string
  priceUsdc: number
  priceRaw: bigint
  color: string
  points: number
  multiplier: string
  perks: string[]
}

export const TIERS: readonly TierInfo[] = [
  {
    tier: 0,
    key: 'cat1',
    name: 'Standing / Khán đài CAT 1',
    short: 'CAT 1',
    priceUsdc: 10,
    priceRaw: 10_000_000n,
    color: '#ff9bd2',
    points: 10,
    multiplier: 'x1',
    perks: ['Vị trí gần sân khấu', 'Tặng 1 Lightstick ảo', '10 Fan Point mỗi vé'],
  },
  {
    tier: 1,
    key: 'vip',
    name: 'VIP Pink Pit sát sân khấu',
    short: 'VIP Pink Pit',
    priceUsdc: 25,
    priceRaw: 25_000_000n,
    color: '#ff2d95',
    points: 50,
    multiplier: 'x2',
    perks: ['Ngay sát đường băng chính', 'Xem tổng duyệt Soundcheck', 'Nhân đôi Fan Point (50 điểm)'],
  },
  {
    tier: 2,
    key: 'vvip',
    name: 'VVIP Born Pink Skybox & Backstage',
    short: 'VVIP Skybox',
    priceUsdc: 100,
    priceRaw: 100_000_000n,
    color: '#ffc857',
    points: 500,
    multiplier: 'x5',
    perks: ['Phòng chờ hạng sang', 'Thẻ gặp gỡ thần tượng hậu trường', 'Bộ quà tặng độc quyền', 'Nhân 5 Fan Point (500 điểm)'],
  },
]

export const SEATS_PER_SHOW = 344

export function tierOf(seatId: number): Tier {
  if (seatId < 240) return 0
  if (seatId < 320) return 1
  return 2
}

export interface Seat {
  id: number
  tier: Tier
  x: number
  y: number
  section: string
  row: string
  num: number
  label: string
}

const ROWS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function grid(
  out: Seat[],
  startId: number,
  count: number,
  cols: number,
  x0: number,
  y0: number,
  dx: number,
  dy: number,
  tier: Tier,
  section: string,
) {
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols)
    const c = i % cols
    const row = ROWS[r] ?? 'Z'
    out.push({
      id: startId + i,
      tier,
      x: x0 + c * dx,
      y: y0 + r * dy,
      section,
      row,
      num: c + 1,
      label: `${section} · Hàng ${row} · Ghế ${c + 1}`,
    })
  }
}

function buildSeats(): Seat[] {
  const seats: Seat[] = []
  // CAT 1 / Standing
  grid(seats, 0, 120, 15, 296, 488, 28, 25, 0, 'Standing Zone')
  grid(seats, 120, 60, 5, 62, 186, 28, 25, 0, 'CAT 1 Trái')
  grid(seats, 180, 60, 5, 798, 186, 28, 25, 0, 'CAT 1 Phải')
  // VIP Pink Pit, either side of the runway
  grid(seats, 240, 40, 5, 336, 124, 26, 26, 1, 'Pink Pit Trái')
  grid(seats, 280, 40, 5, 560, 124, 26, 26, 1, 'Pink Pit Phải')
  // VVIP Skybox, flanking the main stage
  grid(seats, 320, 12, 6, 58, 50, 28, 30, 2, 'Skybox Trái')
  grid(seats, 332, 12, 6, 778, 50, 28, 30, 2, 'Skybox Phải')
  return seats
}

export const SEATS: readonly Seat[] = buildSeats()

export function seatById(id: number): Seat | undefined {
  return SEATS[id]
}

/** Decodes the two-word bitmap returned by getSoldBitmap into a set of sold seat ids. */
export function decodeBitmap(words: readonly [bigint, bigint] | undefined): Set<number> {
  const sold = new Set<number>()
  if (!words) return sold
  for (let id = 0; id < SEATS_PER_SHOW; id++) {
    const word = words[id >> 8]
    if (word === undefined) continue
    if (((word >> BigInt(id & 255)) & 1n) === 1n) sold.add(id)
  }
  return sold
}

/** Deterministic check-in gate and code for a ticket. */
export function gateFor(tier: Tier, seatId: number): string {
  if (tier === 2) return 'Cổng VVIP-S'
  if (tier === 1) return seatId < 280 ? 'Cổng P1' : 'Cổng P2'
  const seat = SEATS[seatId]
  if (!seat) return 'Cổng A'
  if (seat.section.startsWith('Standing')) return 'Cổng A'
  return seat.section.endsWith('Trái') ? 'Cổng B' : 'Cổng C'
}

export function checkInCode(tokenId: number): string {
  let h = 2166136261
  const s = `bp-encore-${tokenId}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const hex = (h >>> 0).toString(16).toUpperCase().padStart(8, '0')
  return `BP-${tokenId}-${hex.slice(0, 4)}`
}
