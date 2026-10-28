import { QRCodeSVG } from 'qrcode.react'
import { Gift, Star, Tag } from 'lucide-react'
import { CHAIN_ID, TICKETS_ADDRESS, shortAddr } from '@/lib/contract'
import { IMAGES, SHOWS } from '@/lib/data'
import { SEATS, TIERS, checkInCode, gateFor } from '@/lib/seats'
import { formatUsdc } from '@/onchain-money'
import { getHolderName } from '@/lib/holders'
import type { Ticket } from '@/hooks/useTicketData'

const BANNERS = [IMAGES.crowd, IMAGES.sparkle, IMAGES.silhouette] as const

export function TicketCard({ ticket, children }: { ticket: Ticket; children?: React.ReactNode }) {
  const seat = SEATS[ticket.seatId]
  const tier = TIERS[ticket.tier]
  const show = SHOWS[ticket.showId]
  if (!seat || !show) return null
  const holder = getHolderName(ticket.tokenId, ticket.owner) ?? shortAddr(ticket.owner)
  const code = checkInCode(ticket.tokenId)
  const qr = `bp-ticket:${CHAIN_ID}:${TICKETS_ADDRESS}:${ticket.tokenId}`

  return (
    <article
      className="relative overflow-hidden rounded-3xl border bg-[#0d0b12]"
      style={{ borderColor: `${tier.color}88`, boxShadow: `0 0 36px ${tier.color}33` }}
    >
      <div className="sparkle relative h-36 overflow-hidden">
        <img src={BANNERS[ticket.tier]} alt="" className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0b12] via-[#0d0b12]/40 to-transparent" />
        <div className="absolute inset-0 mix-blend-color" style={{ background: `${tier.color}55` }} />
        {[12, 38, 64, 86].map((left, i) => (
          <span
            key={left}
            className="twinkle absolute h-2 w-2 rounded-full bg-white"
            style={{ left: `${left}%`, top: `${20 + ((i * 23) % 50)}%`, animationDelay: `${i * 0.5}s` }}
          />
        ))}
        <div className="absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold text-black" style={{ background: tier.color }}>
          {tier.short}
        </div>
        {ticket.listingPrice !== null && (
          <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-[#ff9bd2]">
            <Tag size={12} /> Đang bán {formatUsdc(ticket.listingPrice)} USDC
          </div>
        )}
      </div>

      <div className="relative px-5 pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ff9bd2]">BLACKPINK WORLD TOUR · BORN PINK ENCORE</p>
        <h3 className="mt-1 font-display text-2xl font-bold">{show.name}</h3>
        <p className="text-sm text-white/60">{show.dateLabel}</p>

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Field label="Người sở hữu" value={holder} wide />
            <Field label="Khu vực" value={seat.section} />
            <Field label="Số ghế" value={`${seat.row}${seat.num}`} />
            <Field label="Cổng check-in" value={gateFor(ticket.tier, ticket.seatId)} />
            <Field label="Mã vé" value={code} mono />
          </dl>
          <div className="rounded-2xl bg-white p-2.5 self-start">
            <QRCodeSVG value={qr} size={104} bgColor="#ffffff" fgColor="#0a0a0f" level="M" />
          </div>
        </div>

        <ul className="mt-4 flex flex-wrap gap-2">
          {tier.perks.map((p, i) => (
            <li key={p} className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-xs text-white/80">
              {i === 0 ? <Star size={12} style={{ color: tier.color }} /> : <Gift size={12} style={{ color: tier.color }} />}
              {p}
            </li>
          ))}
        </ul>

        <div className="mt-3 text-[11px] text-white/35 tnum">NFT #{ticket.tokenId} · Arc Testnet</div>
        {children && <div className="mt-4 border-t border-white/10 pt-4">{children}</div>}
      </div>
    </article>
  )
}

function Field({ label, value, wide, mono }: { label: string; value: string; wide?: boolean; mono?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <dt className="text-[10px] uppercase tracking-widest text-white/45">{label}</dt>
      <dd className={`truncate font-semibold ${mono ? 'font-mono tracking-wider text-[#ff9bd2]' : ''}`}>{value}</dd>
    </div>
  )
}
