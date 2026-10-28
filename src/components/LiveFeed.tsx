import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { Radio } from 'lucide-react'
import { CHAIN_ID, DEPLOY_BLOCK, TICKETS_ADDRESS, shortAddr, ticketsAbi } from '@/lib/contract'
import { SAMPLE_FANS, SAMPLE_PURCHASES } from '@/lib/data'
import { SEATS, TIERS } from '@/lib/seats'

interface FeedItem {
  key: string
  who: string
  seat: string
  tier: 0 | 1 | 2
  real: boolean
}

export function LiveFeed() {
  const client = usePublicClient({ chainId: CHAIN_ID })

  const { data: real = [] } = useQuery({
    queryKey: ['recent-purchases'],
    refetchInterval: 10_000,
    enabled: Boolean(client),
    queryFn: async (): Promise<FeedItem[]> => {
      if (!client) return []
      const event = ticketsAbi.find((a) => a.type === 'event' && a.name === 'TicketPurchased')
      if (!event || event.type !== 'event') return []
      const latest = await client.getBlockNumber()
      const ranges = [DEPLOY_BLOCK, latest > 5000n ? latest - 5000n : 0n]
      for (const fromBlock of ranges) {
        try {
          const logs = await client.getLogs({ address: TICKETS_ADDRESS, event, fromBlock, toBlock: latest })
          return logs
            .slice(-6)
            .reverse()
            .map((l) => ({
              key: `${l.transactionHash}-${l.logIndex}`,
              who: shortAddr(l.args.buyer ?? '0x0000000000'),
              seat: `Day ${Number(l.args.showId ?? 0) + 1} · ${SEATS[Number(l.args.seatId ?? 0)]?.label ?? 'Ghế'}`,
              tier: (l.args.tier ?? 0) as 0 | 1 | 2,
              real: true,
            }))
        } catch {
          // range too large for the RPC: try the shorter window next
        }
      }
      return []
    },
  })

  const [samples, setSamples] = useState<FeedItem[]>([])
  useEffect(() => {
    let n = 0
    const push = () => {
      const fan = SAMPLE_FANS[(n * 5 + 3) % SAMPLE_FANS.length] ?? 'BLINK'
      const buy = SAMPLE_PURCHASES[n % SAMPLE_PURCHASES.length]
      if (!buy) return
      n += 1
      setSamples((prev) => [{ key: `s-${Date.now()}-${n}`, who: fan, seat: buy.seat, tier: buy.tier, real: false }, ...prev].slice(0, 5))
    }
    push()
    const id = setInterval(push, 4500)
    return () => clearInterval(id)
  }, [])

  const items = [...real.slice(0, 4), ...samples].slice(0, 8)

  return (
    <section className="panel p-5" aria-live="polite">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold">
          <Radio size={18} className="text-[#ff2d95]" /> Vừa săn vé thành công
        </h3>
        <span className="text-xs text-white/45">Trực tiếp</span>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((it) => (
          <li key={it.key} className="ticker-in flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="truncate font-semibold">{it.who}</div>
              <div className="truncate text-xs text-white/55">{it.seat}</div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-black" style={{ background: TIERS[it.tier].color }}>
                {TIERS[it.tier].short}
              </span>
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${it.real ? 'text-emerald-300' : 'text-white/35'}`}>
                {it.real ? 'Onchain' : 'Mẫu'}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-white/40">Mục "Mẫu" chỉ là dữ liệu minh họa để tạo không khí, không phải giao dịch thật.</p>
    </section>
  )
}
