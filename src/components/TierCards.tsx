import { Check } from 'lucide-react'
import { IMAGES } from '@/lib/data'
import { SEATS, TIERS } from '@/lib/seats'

const PHOTOS = [IMAGES.crowd, IMAGES.sparkle, IMAGES.silhouette] as const

export function TierCards({ sold }: { sold: Set<number> }) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {TIERS.map((t) => {
        const total = SEATS.filter((s) => s.tier === t.tier).length
        const left = SEATS.filter((s) => s.tier === t.tier && !sold.has(s.id)).length
        return (
          <article key={t.key} className="panel relative overflow-hidden" style={{ borderColor: `${t.color}55` }}>
            <div className="relative h-32 overflow-hidden">
              <img src={PHOTOS[t.tier]} alt="" className="h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0d14] to-transparent" />
              <div className="absolute inset-0 mix-blend-color" style={{ background: `${t.color}66` }} />
              <div className="absolute bottom-3 left-4 font-display text-4xl font-bold tnum" style={{ color: t.color, textShadow: `0 0 18px ${t.color}` }}>
                {t.priceUsdc} <span className="text-lg">USDC</span>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-display text-lg font-bold leading-tight">{t.name}</h3>
              <p className="mt-0.5 text-xs text-white/50 tnum">
                Còn {left}/{total} ghế · Fan Point {t.multiplier}
              </p>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm text-white/80">
                {t.perks.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <Check size={14} className="mt-1 shrink-0" style={{ color: t.color }} />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        )
      })}
    </section>
  )
}
