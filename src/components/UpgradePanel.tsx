import { useState } from 'react'
import { Loader2, ArrowUpCircle } from 'lucide-react'
import { SeatMap } from '@/components/SeatMap'
import { usePay } from '@/hooks/usePay'
import { useAction } from '@/hooks/useAction'
import { CHAIN_ID, TICKETS_ADDRESS, ticketsAbi } from '@/lib/contract'
import { SEATS, TIERS } from '@/lib/seats'
import { formatUsdc } from '@/onchain-money'
import type { Ticket, TicketData } from '@/hooks/useTicketData'

export function UpgradePanel({ ticket, data, onClose }: { ticket: Ticket; data: TicketData; onClose: () => void }) {
  const pay = usePay()
  const [seatId, setSeatId] = useState<number | null>(null)
  const { busy, run } = useAction(() => {
    data.refresh()
    onClose()
  })

  const current = TIERS[ticket.tier]
  const target = seatId !== null ? SEATS[seatId] : undefined
  const targetTier = target ? TIERS[target.tier] : undefined
  const cost = targetTier ? targetTier.priceRaw - current.priceRaw : 0n
  const sold = data.soldByShow[ticket.showId] ?? new Set<number>()
  const noUpgrade = ticket.tier === 2

  function submit() {
    if (seatId === null) return
    void run(
      `up-${ticket.tokenId}`,
      async () => {
        await pay.ensureAllowance(cost)
        const hash = await pay.writeContractAsync({
          address: TICKETS_ADDRESS,
          abi: ticketsAbi,
          functionName: 'upgradeSeat',
          args: [BigInt(ticket.tokenId), seatId],
          chainId: CHAIN_ID,
        })
        await pay.wait(hash)
      },
      'Nâng hạng thành công! Vé mới đã nằm trong kho vé của bạn.',
    )
  }

  if (noUpgrade) return <p className="text-sm text-white/60">Vé VVIP đã là hạng cao nhất.</p>

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-white/70">
        Chọn một ghế hạng cao hơn còn trống trong cùng đêm diễn. Bạn chỉ trả phần chênh lệch, ghế cũ sẽ được trả lại cho hệ thống.
      </p>
      <div className="rounded-2xl border border-white/10 p-2">
        <SeatMap
          sold={sold}
          selected={seatId === null ? [] : [seatId]}
          onToggle={(id) => setSeatId((prev) => (prev === id ? null : id))}
          allowTier={(t) => t > ticket.tier}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {target && targetTier ? (
            <>
              {current.short} → <b style={{ color: targetTier.color }}>{targetTier.short}</b> · {target.label}
              <div className="font-display text-xl font-bold tnum neon-text">Trả thêm {formatUsdc(cost)} USDC</div>
            </>
          ) : (
            <span className="text-white/55">Chưa chọn ghế nâng hạng</span>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={busy !== null}>
            Đóng
          </button>
          <button className="btn-neon" onClick={submit} disabled={seatId === null || busy !== null}>
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="animate-spin" size={16} /> Đang xử lý...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <ArrowUpCircle size={16} /> Nâng hạng bằng USDC
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
