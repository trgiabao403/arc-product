import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { toast } from 'sonner'
import { Clock, Loader2, Trash2, Ticket, ExternalLink } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { formatUsdc } from '@/onchain-money'
import { CHAIN_ID, MAX_PER_WALLET, TICKETS_ADDRESS, friendlyError, tokenIdOf, ticketsAbi } from '@/lib/contract'
import { SEATS, TIERS } from '@/lib/seats'
import { saveHolderName, loadLastName } from '@/lib/holders'
import { usePay } from '@/hooks/usePay'
import { formatClock } from '@/hooks/useHold'
import type { TicketData } from '@/hooks/useTicketData'

interface Props {
  showId: number
  selected: number[]
  remaining: number
  data: TicketData
  onRemove: (seatId: number) => void
  onClear: () => void
  onPurchased: () => void
}

type Phase = 'idle' | 'approving' | 'signing' | 'confirming'

export function Checkout({ showId, selected, remaining, data, onRemove, onClear, onPurchased }: Props) {
  const pay = usePay()
  const [name, setName] = useState(loadLastName)
  const [phase, setPhase] = useState<Phase>('idle')
  const [lastTx, setLastTx] = useState<`0x${string}` | null>(null)

  const total = selected.reduce((sum, id) => sum + TIERS[SEATS[id]?.tier ?? 0].priceRaw, 0n)
  const held = data.held[showId] ?? 0
  const overCap = held + selected.length > MAX_PER_WALLET
  const lowBalance = pay.address !== undefined && total > data.usdcBalance
  const closed = !data.showOpen[showId] || data.paused
  const busy = phase !== 'idle'
  const urgent = remaining <= 60 && selected.length > 0

  async function handlePay() {
    if (selected.length === 0 || !pay.address) return
    const buyerName = name.trim() || 'BLINK'
    try {
      await pay.ensureChain()
      setPhase('approving')
      await pay.ensureAllowance(total)
      setPhase('signing')
      const hash = await pay.writeContractAsync({
        address: TICKETS_ADDRESS,
        abi: ticketsAbi,
        functionName: 'buyTickets',
        args: [showId, selected],
        chainId: CHAIN_ID,
      })
      setPhase('confirming')
      setLastTx(hash)
      await pay.wait(hash)
      selected.forEach((seatId) => saveHolderName(tokenIdOf(showId, seatId), pay.address ?? '', buyerName))
      toast.success(`Đã xuất ${selected.length} vé điện tử. Xem trong "Kho vé của tôi".`)
      data.refresh()
      onPurchased()
    } catch (e) {
      const msg = friendlyError(e)
      if (!msg.startsWith('Bạn đã hủy')) toast.error(msg)
      else toast(msg)
    } finally {
      setPhase('idle')
    }
  }

  const label =
    phase === 'approving'
      ? 'Bước 1/2 · Cho phép dùng USDC...'
      : phase === 'signing'
        ? 'Bước 2/2 · Xác nhận trong ví...'
        : phase === 'confirming'
          ? 'Đang chờ mạng xác nhận...'
          : 'Thanh Toán & Xuất Vé Điện Tử bằng USDC'

  return (
    <aside className="panel flex flex-col gap-4 p-5 lg:sticky lg:top-24">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-bold">Giỏ vé của bạn</h3>
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold tnum ${
            selected.length === 0
              ? 'bg-white/5 text-white/50'
              : urgent
                ? 'bg-red-500/20 text-red-300 pulse-dot'
                : 'bg-[#ff2d95]/15 text-[#ff9bd2]'
          }`}
          title="Thời gian giữ chỗ trên giao diện. Ghế chỉ được đảm bảo khi giao dịch xác nhận."
        >
          <Clock size={14} />
          {selected.length === 0 ? 'Giữ chỗ 10:00' : `Còn ${formatClock(remaining)}`}
        </div>
      </div>

      {selected.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-white/55">
          <Ticket className="mx-auto mb-2 text-[#ff2d95]" />
          Chọn ghế trên sơ đồ để bắt đầu. Tối đa {MAX_PER_WALLET} vé mỗi ví mỗi đêm diễn.
        </div>
      ) : (
        <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
          {selected.map((id) => {
            const seat = SEATS[id]
            if (!seat) return null
            const t = TIERS[seat.tier]
            return (
              <li key={id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{seat.label}</div>
                  <div className="text-xs" style={{ color: t.color }}>
                    {t.short}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tnum font-semibold">{t.priceUsdc} USDC</span>
                  <button
                    onClick={() => onRemove(id)}
                    disabled={busy}
                    aria-label={`Bỏ ghế ${seat.label}`}
                    className="grid h-9 w-9 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <label className="flex flex-col gap-1.5 text-sm text-white/70">
        Tên in trên vé
        <input
          className="input-dark"
          value={name}
          maxLength={32}
          placeholder="Ví dụ: Nguyễn Minh Anh"
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
      </label>

      <div className="flex items-end justify-between border-t border-white/10 pt-4">
        <div className="text-sm text-white/60">
          {selected.length} vé · đang giữ {held}/{MAX_PER_WALLET}
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-white/50">Tổng cộng</div>
          <div className="font-display text-3xl font-bold tnum neon-text">
            {formatUsdc(total)} <span className="text-lg">USDC</span>
          </div>
        </div>
      </div>

      {overCap && <p className="text-sm text-red-300">Vượt giới hạn {MAX_PER_WALLET} vé mỗi ví cho đêm diễn này.</p>}
      {lowBalance && !overCap && (
        <p className="text-sm text-amber-300">
          Số dư {formatUsdc(data.usdcBalance)} USDC chưa đủ. Dùng nút "Get test USDC" ở thanh bên để nhận thêm.
        </p>
      )}
      {closed && <p className="text-sm text-amber-300">Đêm diễn này đang tạm đóng bán.</p>}

      {pay.address ? (
        <button className="btn-neon w-full" disabled={selected.length === 0 || overCap || closed || busy} onClick={() => void handlePay()}>
          {busy ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={18} />
              {label}
            </span>
          ) : (
            label
          )}
        </button>
      ) : (
        <ConnectKitButton.Custom>
          {({ show }) => (
            <button className="btn-neon w-full" onClick={show}>
              Kết nối ví để thanh toán
            </button>
          )}
        </ConnectKitButton.Custom>
      )}

      {selected.length > 0 && !busy && (
        <button className="btn-ghost w-full" onClick={onClear}>
          Xóa giỏ vé
        </button>
      )}

      {lastTx && (
        <a
          className="inline-flex items-center justify-center gap-1.5 text-sm text-[#ff9bd2] underline-offset-4 hover:underline"
          href={buildTxExplorerUrl(CHAIN_ID, lastTx)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Xem giao dịch gần nhất <ExternalLink size={14} />
        </a>
      )}
    </aside>
  )
}
