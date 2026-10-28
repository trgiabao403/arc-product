import { useMemo, useState } from 'react'
import { SEATS, TIERS, type Seat } from '@/lib/seats'

interface Props {
  sold: Set<number>
  selected: number[]
  onToggle: (seatId: number) => void
  disabled?: boolean
  /** Optional seat filter (used by the upgrade picker). */
  allowTier?: (tier: number) => boolean
  highlight?: number[]
}

export function SeatMap({ sold, selected, onToggle, disabled, allowTier, highlight }: Props) {
  const [hover, setHover] = useState<Seat | null>(null)
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const highlightSet = useMemo(() => new Set(highlight ?? []), [highlight])

  return (
    <div className="relative">
      <svg viewBox="0 0 1000 720" className="w-full h-auto select-none" role="group" aria-label="Sơ đồ chỗ ngồi sân vận động">
        <defs>
          <linearGradient id="stageGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff2d95" />
            <stop offset="100%" stopColor="#8a0f55" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="8" y="8" width="984" height="704" rx="36" fill="#0b0910" stroke="rgba(255,255,255,0.06)" />

        {/* T-shaped stage */}
        <g filter="url(#glow)">
          <rect x="250" y="22" width="500" height="70" rx="10" fill="url(#stageGrad)" />
          <rect x="468" y="92" width="64" height="318" fill="url(#stageGrad)" opacity="0.92" />
          <rect x="398" y="410" width="204" height="44" rx="10" fill="url(#stageGrad)" />
        </g>
        <text x="500" y="64" textAnchor="middle" fill="#fff" fontSize="26" fontWeight="700" fontFamily="Space Grotesk">
          MAIN STAGE · BORN PINK
        </text>
        <text x="500" y="438" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700" fontFamily="Space Grotesk" opacity="0.9">
          B-STAGE
        </text>
        <text x="500" y="270" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="600" opacity="0.7" transform="rotate(-90 500 270)">
          RUNWAY
        </text>

        {/* zone labels */}
        <ZoneLabel x={140} y={30} text="VVIP SKYBOX" color={TIERS[2].color} />
        <ZoneLabel x={860} y={30} text="VVIP SKYBOX" color={TIERS[2].color} />
        <ZoneLabel x={410} y={112} text="VIP PINK PIT" color={TIERS[1].color} anchor="end" />
        <ZoneLabel x={590} y={112} text="VIP PINK PIT" color={TIERS[1].color} anchor="start" />
        <ZoneLabel x={130} y={168} text="CAT 1" color={TIERS[0].color} />
        <ZoneLabel x={870} y={168} text="CAT 1" color={TIERS[0].color} />
        <ZoneLabel x={500} y={474} text="STANDING ZONE" color={TIERS[0].color} />

        {SEATS.map((seat) => {
          const isSold = sold.has(seat.id)
          const isSel = selectedSet.has(seat.id)
          const tierColor = TIERS[seat.tier].color
          const blocked = isSold || disabled || (allowTier ? !allowTier(seat.tier) : false)
          const isHi = highlightSet.has(seat.id)
          return (
            <g
              key={seat.id}
              className={blocked ? undefined : 'seat'}
              onClick={() => !blocked && onToggle(seat.id)}
              onMouseEnter={() => setHover(seat)}
              onMouseLeave={() => setHover((h) => (h?.id === seat.id ? null : h))}
              role="button"
              aria-label={`${seat.label}${isSold ? ', đã bán' : ''}`}
              aria-pressed={isSel}
            >
              <circle
                cx={seat.x}
                cy={seat.y}
                r={9}
                fill={isSold ? '#1d1b24' : isSel ? '#ffffff' : isHi ? tierColor : 'rgba(0,0,0,0.5)'}
                stroke={isSold ? '#34313d' : tierColor}
                strokeWidth={isSel ? 3 : 1.8}
                opacity={allowTier && !allowTier(seat.tier) ? 0.2 : 1}
                filter={isSel ? 'url(#glow)' : undefined}
              />
              {isSold && (
                <path
                  d={`M${seat.x - 4} ${seat.y - 4} L${seat.x + 4} ${seat.y + 4} M${seat.x + 4} ${seat.y - 4} L${seat.x - 4} ${seat.y + 4}`}
                  stroke="#4a4655"
                  strokeWidth="1.6"
                />
              )}
              {isSel && <circle cx={seat.x} cy={seat.y} r={4} fill="#ff2d95" />}
            </g>
          )
        })}
      </svg>

      <div className="pointer-events-none absolute left-3 bottom-3 min-h-[44px] rounded-xl bg-black/80 px-3 py-2 text-sm backdrop-blur">
        {hover ? (
          <span>
            <b style={{ color: TIERS[hover.tier].color }}>{TIERS[hover.tier].short}</b> · {hover.label} ·{' '}
            <span className="tnum">{TIERS[hover.tier].priceUsdc} USDC</span>
            {sold.has(hover.id) ? ' · Đã bán' : ''}
          </span>
        ) : (
          <span className="text-white/60">Rê chuột hoặc chạm vào ghế để xem chi tiết</span>
        )}
      </div>
    </div>
  )
}

function ZoneLabel({ x, y, text, color, anchor = 'middle' }: { x: number; y: number; text: string; color: string; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fill={color} fontSize="12" fontWeight="700" letterSpacing="1.5" fontFamily="Space Grotesk" opacity="0.95">
      {text}
    </text>
  )
}

export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/75">
      <LegendDot label="Ghế trống">
        <span className="h-4 w-4 rounded-full border-2 border-[#ff2d95] bg-black/50" />
      </LegendDot>
      <LegendDot label="Đang chọn">
        <span className="h-4 w-4 rounded-full border-2 border-[#ff2d95] bg-white shadow-[0_0_10px_#ff2d95]" />
      </LegendDot>
      <LegendDot label="Đã có người mua">
        <span className="h-4 w-4 rounded-full border-2 border-[#34313d] bg-[#1d1b24]" />
      </LegendDot>
      <span className="hidden h-4 w-px bg-white/15 sm:block" />
      {TIERS.map((t) => (
        <LegendDot key={t.key} label={`${t.short} · ${t.priceUsdc} USDC`}>
          <span className="h-3 w-3 rounded-sm" style={{ background: t.color }} />
        </LegendDot>
      ))}
    </div>
  )
}

function LegendDot({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {children}
      {label}
    </span>
  )
}
