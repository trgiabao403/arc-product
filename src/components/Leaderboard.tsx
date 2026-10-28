import { useMemo, useState } from 'react'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { Crown, Star, Trophy } from 'lucide-react'
import { CHAIN_ID, TICKETS_ADDRESS, shortAddr, ticketsAbi } from '@/lib/contract'
import { IMAGES } from '@/lib/data'
import { Empty } from '@/components/Vault'

const base = { address: TICKETS_ADDRESS, abi: ticketsAbi, chainId: CHAIN_ID } as const

interface Row {
  fan: `0x${string}`
  points: number
  vip: number
  sticks: number
}

type Sort = 'points' | 'vip'

export function Leaderboard() {
  const { address } = useAccount()
  const [sort, setSort] = useState<Sort>('points')

  const fans = useReadContract({
    ...base,
    functionName: 'getFans',
    args: [0n, 200n],
    query: { refetchInterval: 12_000 },
  })
  const list = useMemo(() => (fans.data ? [...(fans.data)] : []), [fans.data])

  const stats = useReadContracts({
    contracts: list.flatMap((fan) => [
      { ...base, functionName: 'fanPoints' as const, args: [fan] as const },
      { ...base, functionName: 'vipTickets' as const, args: [fan] as const },
      { ...base, functionName: 'lightsticks' as const, args: [fan] as const },
    ]),
    query: { enabled: list.length > 0, refetchInterval: 12_000 },
  })

  const rows = useMemo<Row[]>(() => {
    const out = list.map((fan, i) => ({
      fan,
      points: Number((stats.data?.[i * 3]?.result) ?? 0n),
      vip: Number((stats.data?.[i * 3 + 1]?.result) ?? 0n),
      sticks: Number((stats.data?.[i * 3 + 2]?.result) ?? 0n),
    }))
    out.sort((a, b) => (sort === 'points' ? b.points - a.points || b.vip - a.vip : b.vip - a.vip || b.points - a.points))
    return out.slice(0, 20)
  }, [list, stats.data, sort])

  return (
    <section className="relative">
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-white/10">
        <img src={IMAGES.glow} alt="" className="h-44 w-full object-cover opacity-60 sm:h-56" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07060a] via-[#07060a]/60 to-[#ff2d95]/20" />
        <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-3xl font-bold sm:text-4xl">
              <Trophy className="text-[#ffc857]" /> Top BLINKs săn vé
            </h2>
            <p className="text-white/70">Vinh danh các ví có nhiều vé VIP nhất và nhiều Fan Point nhất.</p>
          </div>
          <div className="flex rounded-xl bg-black/60 p-1" role="tablist" aria-label="Sắp xếp bảng xếp hạng">
            <SortBtn active={sort === 'points'} onClick={() => setSort('points')} label="Fan Point" />
            <SortBtn active={sort === 'vip'} onClick={() => setSort('vip')} label="Vé VIP" />
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty title="Chưa có BLINK nào lên bảng" text="Mua vé hoặc Lightstick đầu tiên để mở màn bảng xếp hạng." />
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r, i) => {
            const me = address?.toLowerCase() === r.fan.toLowerCase()
            return (
              <li
                key={r.fan}
                className={`flex items-center gap-4 rounded-2xl px-4 py-3 ${me ? 'neon-border bg-[#ff2d95]/10' : 'bg-white/5'}`}
              >
                <Medal rank={i + 1} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {shortAddr(r.fan)} {me && <span className="ml-1 rounded-full bg-[#ff2d95] px-2 py-0.5 text-xs">Bạn</span>}
                  </div>
                  <div className="text-xs text-white/50 tnum">{r.sticks} Lightstick</div>
                </div>
                <div className="flex items-center gap-1.5 text-sm tnum">
                  <Crown size={14} className="text-[#ffc857]" />
                  <b>{r.vip}</b> <span className="text-white/50">vé VIP</span>
                </div>
                <div className="flex w-28 items-center justify-end gap-1.5 font-display text-xl font-bold tnum neon-text">
                  <Star size={16} className="text-[#ff2d95]" />
                  {r.points.toLocaleString('en-US')}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function SortBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`min-h-[40px] rounded-lg px-4 text-sm font-semibold ${active ? 'bg-[#ff2d95] text-white' : 'text-white/65'}`}
    >
      {label}
    </button>
  )
}

function Medal({ rank }: { rank: number }) {
  const color = rank === 1 ? '#ffc857' : rank === 2 ? '#d7d7e0' : rank === 3 ? '#e29a6b' : '#3a3744'
  return (
    <div
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display font-bold tnum"
      style={{ background: color, color: rank <= 3 ? '#111' : '#fff' }}
    >
      {rank}
    </div>
  )
}
