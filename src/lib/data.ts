const unsplash = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`

/** Free-to-use Unsplash concert photos (see footer credit). */
export const IMAGES = {
  hero: unsplash('1459749411175-04bf5292ceea', 1800),
  confetti: unsplash('1514525253161-7a46d19cd819', 1400),
  silhouette: unsplash('1493225457124-a3eb161ffa5f', 1000),
  sparkle: unsplash('1492684223066-81342ee5ff30', 1000),
  crowd: unsplash('1501386761578-eac5c94b800a', 1000),
  glow: unsplash('1470229722913-7c0e2dbbafd3', 1000),
}

export interface ShowInfo {
  id: 0 | 1
  name: string
  dateLabel: string
  doors: string
  venue: string
  waves: { name: string; state: 'done' | 'live' }[]
}

export const SHOWS: readonly ShowInfo[] = [
  {
    id: 0,
    name: 'Đêm diễn Day 1',
    dateLabel: 'Thứ Bảy, 12.12.2026',
    doors: 'Mở cửa 17:00 · Diễn 20:00',
    venue: 'Sân vận động trung tâm (demo)',
    waves: [
      { name: 'Đợt 1 · Pre-sale BLINK', state: 'done' },
      { name: 'Đợt 2 · Mở bán đại chúng', state: 'live' },
    ],
  },
  {
    id: 1,
    name: 'Đêm diễn Day 2',
    dateLabel: 'Chủ Nhật, 13.12.2026',
    doors: 'Mở cửa 17:00 · Diễn 20:00',
    venue: 'Sân vận động trung tâm (demo)',
    waves: [
      { name: 'Đợt 1 · Pre-sale BLINK', state: 'done' },
      { name: 'Đợt 2 · Mở bán đại chúng', state: 'live' },
    ],
  },
]

/** Sample fans for the live ticker. These are demo handles, not wallets. */
export const SAMPLE_FANS = [
  'JennieRubyJane',
  'LisaManoban_VN',
  'RoseyPosie',
  'JisooChu',
  'PinkVenom99',
  'BornPinkHanoi',
  'HowYouLikeThat',
  'KillThisLove_SG',
  'ShutDownFan',
  'BlinkSaigon',
  'LightstickQueen',
  'PinkPitMinh',
]

export const SAMPLE_PURCHASES = [
  { tier: 0, seat: 'Standing Zone · A7' },
  { tier: 1, seat: 'Pink Pit Trái · C2' },
  { tier: 0, seat: 'CAT 1 Phải · F4' },
  { tier: 2, seat: 'Skybox Phải · B3' },
  { tier: 1, seat: 'Pink Pit Phải · A5' },
  { tier: 0, seat: 'Standing Zone · D11' },
] as const

export const HOLD_SECONDS = 10 * 60
