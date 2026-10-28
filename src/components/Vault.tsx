import { ConnectKitButton } from 'connectkit'
import { Ticket } from 'lucide-react'
import { TicketCard } from '@/components/TicketCard'
import type { TicketData } from '@/hooks/useTicketData'
import { useAccount } from 'wagmi'

export function Vault({ data, onHunt }: { data: TicketData; onHunt: () => void }) {
  const { address } = useAccount()

  if (!address) {
    return (
      <Empty title="Kết nối ví để xem vé của bạn" action={<ConnectKitButton.Custom>{({ show }) => <button className="btn-neon" onClick={show}>Kết nối ví</button>}</ConnectKitButton.Custom>} />
    )
  }
  if (data.myTickets.length === 0) {
    return (
      <Empty
        title="Kho vé đang trống"
        text="Vé NFT sẽ xuất hiện ở đây ngay khi giao dịch mua được xác nhận."
        action={<button className="btn-neon" onClick={onHunt}>Đi săn vé ngay</button>}
      />
    )
  }
  const sorted = [...data.myTickets].sort((a, b) => b.tier - a.tier || a.showId - b.showId || a.seatId - b.seatId)
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-bold">Kho vé của tôi</h2>
          <p className="text-white/60">{sorted.length} vé điện tử NFT trong ví của bạn. Đưa mã QR cho nhân viên tại cổng check-in.</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Stat label="Fan Point" value={data.points} />
          <Stat label="Lightstick" value={data.lightsticks} />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((t) => (
          <TicketCard key={t.tokenId} ticket={t} />
        ))}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel px-4 py-2 text-center">
      <div className="font-display text-2xl font-bold tnum neon-text">{value}</div>
      <div className="text-[11px] uppercase tracking-widest text-white/50">{label}</div>
    </div>
  )
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="panel mx-auto flex max-w-lg flex-col items-center gap-3 p-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#ff2d95]/15 text-[#ff2d95]">
        <Ticket />
      </div>
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      {text && <p className="text-white/60">{text}</p>}
      {action}
    </div>
  )
}
