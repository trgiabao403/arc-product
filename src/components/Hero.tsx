import { CalendarDays, MapPin } from 'lucide-react'
import { IMAGES, SHOWS } from '@/lib/data'
import { SEATS_PER_SHOW } from '@/lib/seats'

interface Props {
  showId: number
  onShow: (id: number) => void
  soldCounts: [number, number]
  open: [boolean, boolean]
}

export function Hero({ showId, onShow, soldCounts, open }: Props) {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/10">
      <img src={IMAGES.hero} alt="Khán giả giơ tay dưới ánh đèn sân khấu" className="absolute inset-0 -z-20 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#07060a] via-[#07060a]/70 to-[#07060a]/30" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#ff2d95]/45 via-transparent to-[#ff2d95]/20 mix-blend-multiply" />
      <div className="absolute inset-0 -z-10 [background:radial-gradient(60%_80%_at_20%_100%,rgba(255,45,149,0.5),transparent)]" />

      <div className="mx-auto max-w-7xl px-4 pb-10 pt-14 sm:pt-20">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#ff2d95]/60 bg-black/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#ff9bd2]">
          <span className="h-2 w-2 rounded-full bg-[#ff2d95] pulse-dot" /> Đang mở bán · Thanh toán USDC
        </p>
        <h1 className="font-display text-4xl font-bold leading-[0.95] sm:text-6xl lg:text-7xl text-balance">
          <span className="block text-white/90">BLACKPINK WORLD TOUR</span>
          <span className="neon-text block">BORN PINK ENCORE</span>
        </h1>
        <p className="mt-4 max-w-xl text-pretty text-white/75">
          Chọn đúng chỗ ngồi trên sơ đồ, thanh toán bằng USDC Testnet trên Arc và nhận ngay vé NFT có mã QR check-in.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {SHOWS.map((s) => {
            const active = s.id === showId
            const left = SEATS_PER_SHOW - soldCounts[s.id]
            return (
              <button
                key={s.id}
                onClick={() => onShow(s.id)}
                aria-pressed={active}
                className={`panel relative overflow-hidden p-4 text-left transition-all ${
                  active ? 'neon-border bg-[#ff2d95]/10' : 'hover:border-white/25'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-xl font-bold">{s.name}</div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-white/70">
                      <CalendarDays size={14} /> {s.dateLabel} · {s.doors}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-sm text-white/55">
                      <MapPin size={14} /> {s.venue}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-bold uppercase tracking-widest ${open[s.id] ? 'text-emerald-300' : 'text-red-300'}`}>
                      {open[s.id] ? 'Đang mở bán' : 'Đã đóng'}
                    </div>
                    <div className="mt-1 font-display text-2xl font-bold tnum">{left}</div>
                    <div className="text-xs text-white/50">ghế còn lại</div>
                  </div>
                </div>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {s.waves.map((w) => (
                    <li
                      key={w.name}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        w.state === 'live' ? 'bg-[#ff2d95] text-white' : 'bg-white/10 text-white/50 line-through decoration-white/30'
                      }`}
                    >
                      {w.name}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
