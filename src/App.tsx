import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ExternalLink, PauseCircle } from 'lucide-react'
import { Header, type TabKey } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { SeatMap, MapLegend } from '@/components/SeatMap'
import { Checkout } from '@/components/Checkout'
import { LiveFeed } from '@/components/LiveFeed'
import { Vault } from '@/components/Vault'
import { Market } from '@/components/Market'
import { Leaderboard } from '@/components/Leaderboard'
import { TierCards } from '@/components/TierCards'
import { useTicketData } from '@/hooks/useTicketData'
import { useHold } from '@/hooks/useHold'
import { CHAIN_ID, MAX_PER_WALLET, TICKETS_ADDRESS } from '@/lib/contract'
import { SEATS_PER_SHOW } from '@/lib/seats'
import { buildAddressExplorerUrl } from '@/onchain-facts'

export default function App() {
  const data = useTicketData()
  const [tab, setTab] = useState<TabKey>('hunt')
  const [showId, setShowId] = useState(0)
  const [picked, setPicked] = useState<number[]>([])

  const sold = useMemo(() => data.soldByShow[showId] ?? new Set<number>(), [data.soldByShow, showId])
  // A seat bought by someone else while it sits in the cart drops out of it.
  const selected = useMemo(() => picked.filter((id) => !sold.has(id)), [picked, sold])
  const soldCounts: [number, number] = [data.soldByShow[0].size, data.soldByShow[1].size]

  const expire = useCallback(() => {
    setPicked([])
    toast('Hết 10 phút giữ chỗ. Ghế đã được trả lại, hãy chọn lại nhé.')
  }, [])
  const hold = useHold(selected.length > 0, expire)

  function toggle(seatId: number) {
    if (picked.includes(seatId)) {
      setPicked(picked.filter((id) => id !== seatId))
      return
    }
    if (selected.length + (data.held[showId] ?? 0) >= MAX_PER_WALLET) {
      toast.error(`Mỗi ví chỉ được giữ tối đa ${MAX_PER_WALLET} vé cho mỗi đêm diễn.`)
      return
    }
    setPicked([...selected, seatId])
  }

  function changeShow(id: number) {
    setShowId(id)
    setPicked([])
  }

  return (
    <div className="min-h-dvh bg-[#07060a] pb-24">
      <Header tab={tab} onTab={setTab} balance={data.usdcBalance} ticketCount={data.myTickets.length} />

      {data.paused && (
        <div className="flex items-center justify-center gap-2 bg-amber-400/15 px-4 py-2 text-sm font-semibold text-amber-200">
          <PauseCircle size={16} /> Ban tổ chức đang tạm dừng bán vé. Bạn vẫn xem được vé và đăng bán lại.
        </div>
      )}

      {tab === 'hunt' && (
        <>
          <Hero showId={showId} onShow={changeShow} soldCounts={soldCounts} open={data.showOpen} />
          <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[1fr_380px]">
            <div className="flex flex-col gap-6">
              <section className="panel p-4 sm:p-6">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-bold">Sơ đồ chỗ ngồi</h2>
                    <p className="text-sm text-white/60">
                      {SEATS_PER_SHOW - sold.size} / {SEATS_PER_SHOW} ghế còn trống · cập nhật theo thời gian thực từ Arc Testnet
                    </p>
                  </div>
                </div>
                <SeatMap sold={sold} selected={selected} onToggle={toggle} disabled={data.paused || !data.showOpen[showId]} />
                <div className="mt-4">
                  <MapLegend />
                </div>
              </section>
              <TierCards sold={sold} />
            </div>
            <div className="flex flex-col gap-6">
              <Checkout
                showId={showId}
                selected={selected}
                remaining={hold.remaining}
                data={data}
                onRemove={(id) => setPicked(picked.filter((p) => p !== id))}
                onClear={() => setPicked([])}
                onPurchased={() => {
                  setPicked([])
                  setTab('vault')
                }}
              />
              <LiveFeed />
            </div>
          </main>
        </>
      )}

      {tab !== 'hunt' && (
        <main className="mx-auto max-w-7xl px-4 py-8">
          {tab === 'vault' && <Vault data={data} onHunt={() => setTab('hunt')} />}
          {tab === 'market' && <Market data={data} />}
          {tab === 'rank' && <Leaderboard />}
        </main>
      )}

      <footer className="mx-auto mt-4 max-w-7xl px-4 text-xs text-white/40">
        <p>
          Dự án demo trên Arc Testnet, dùng USDC Testnet không có giá trị thực. Không liên kết chính thức với BLACKPINK hay YG Entertainment. Ảnh minh họa từ{' '}
          <a className="underline" href="https://unsplash.com" target="_blank" rel="noopener noreferrer">
            Unsplash
          </a>
          .
        </p>
        <a
          className="mt-1 inline-flex items-center gap-1 text-[#ff9bd2] hover:underline"
          href={buildAddressExplorerUrl(CHAIN_ID, TICKETS_ADDRESS)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Xem hợp đồng vé trên explorer <ExternalLink size={12} />
        </a>
      </footer>
    </div>
  )
}
