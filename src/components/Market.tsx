import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Store, Tag, XCircle } from 'lucide-react'
import { TicketCard } from '@/components/TicketCard'
import { UpgradePanel } from '@/components/UpgradePanel'
import { LightstickShop } from '@/components/LightstickShop'
import { Empty } from '@/components/Vault'
import { usePay } from '@/hooks/usePay'
import { useAction } from '@/hooks/useAction'
import { CHAIN_ID, FEE_BPS, MAX_PER_WALLET, TICKETS_ADDRESS, ticketsAbi } from '@/lib/contract'
import { TIERS } from '@/lib/seats'
import { formatUsdc, parseUsdc } from '@/onchain-money'
import type { Ticket, TicketData } from '@/hooks/useTicketData'

export function Market({ data }: { data: TicketData }) {
  const pay = usePay()
  const { busy, run } = useAction(data.refresh)
  const [prices, setPrices] = useState<Record<number, string>>({})
  const [upgrading, setUpgrading] = useState<number | null>(null)

  const forSale = data.listed.filter((t) => !pay.address || t.owner.toLowerCase() !== pay.address.toLowerCase())

  function list(t: Ticket) {
    let price: bigint
    try {
      price = parseUsdc(prices[t.tokenId] ?? formatUsdc(TIERS[t.tier].priceRaw))
    } catch {
      toast.error('Giá bán không hợp lệ.')
      return
    }
    if (price <= 0n) return
    void run(
      `list-${t.tokenId}`,
      async () => {
        await pay.ensureChain()
        const hash = await pay.writeContractAsync({
          address: TICKETS_ADDRESS,
          abi: ticketsAbi,
          functionName: 'listForSale',
          args: [BigInt(t.tokenId), price],
          chainId: CHAIN_ID,
        })
        await pay.wait(hash)
      },
      'Vé đã được đăng lên chợ sang nhượng.',
    )
  }

  function cancel(t: Ticket) {
    void run(
      `cancel-${t.tokenId}`,
      async () => {
        await pay.ensureChain()
        const hash = await pay.writeContractAsync({
          address: TICKETS_ADDRESS,
          abi: ticketsAbi,
          functionName: 'cancelListing',
          args: [BigInt(t.tokenId)],
          chainId: CHAIN_ID,
        })
        await pay.wait(hash)
      },
      'Đã hủy đăng bán.',
    )
  }

  function buy(t: Ticket) {
    const price = t.listingPrice
    if (price === null) return
    void run(
      `buy-${t.tokenId}`,
      async () => {
        await pay.ensureAllowance(price)
        const hash = await pay.writeContractAsync({
          address: TICKETS_ADDRESS,
          abi: ticketsAbi,
          functionName: 'buyListed',
          args: [BigInt(t.tokenId), price],
          chainId: CHAIN_ID,
        })
        await pay.wait(hash)
      },
      'Bạn đã mua lại vé thành công!',
    )
  }

  return (
    <div className="flex flex-col gap-12">
      <LightstickShop data={data} />

      <section>
        <h2 className="mb-1 flex items-center gap-2 font-display text-3xl font-bold">
          <Store className="text-[#ff2d95]" /> Chợ sang nhượng vé
        </h2>
        <p className="mb-5 text-white/60">
          Người bán tự đặt giá. Ban tổ chức thu phí {Number(FEE_BPS) / 100}% trên mỗi giao dịch, người bán nhận phần còn lại bằng USDC.
        </p>
        {forSale.length === 0 ? (
          <Empty title="Chưa có vé nào được đăng bán" text="Khi một fan đăng bán vé, vé sẽ xuất hiện ở đây." />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {forSale.map((t) => {
              const price = t.listingPrice ?? 0n
              const capped = (data.held[t.showId] ?? 0) >= MAX_PER_WALLET
              return (
                <TicketCard key={t.tokenId} ticket={t}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-white/50">Giá niêm yết</div>
                      <div className="font-display text-2xl font-bold tnum neon-text">{formatUsdc(price)} USDC</div>
                    </div>
                    <button className="btn-neon" disabled={!pay.address || capped || busy !== null} onClick={() => buy(t)}>
                      {busy === `buy-${t.tokenId}` ? <Loader2 className="mx-auto animate-spin" size={18} /> : 'Mua lại vé'}
                    </button>
                  </div>
                  {capped && <p className="mt-2 text-xs text-amber-300">Bạn đã giữ đủ {MAX_PER_WALLET} vé cho đêm diễn này.</p>}
                  {!pay.address && <p className="mt-2 text-xs text-white/50">Kết nối ví để mua.</p>}
                </TicketCard>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 flex items-center gap-2 font-display text-3xl font-bold">
          <Tag className="text-[#ff2d95]" /> Vé của tôi: bán lại hoặc nâng hạng
        </h2>
        <p className="mb-5 text-white/60">Đăng bán với giá bạn muốn, hoặc trả phần chênh lệch USDC để đổi sang ghế hạng cao hơn.</p>
        {data.myTickets.length === 0 ? (
          <Empty title="Bạn chưa có vé" text={pay.address ? 'Hãy săn vé ở tab "Săn vé" trước nhé.' : 'Kết nối ví để xem vé của bạn.'} />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {data.myTickets.map((t) => {
              const isUpgrading = upgrading === t.tokenId
              return (
                <div key={t.tokenId} className={isUpgrading ? 'md:col-span-2 xl:col-span-3' : undefined}>
                  <TicketCard ticket={t}>
                    {isUpgrading ? (
                      <UpgradePanel ticket={t} data={data} onClose={() => setUpgrading(null)} />
                    ) : t.listingPrice !== null ? (
                      <button className="btn-ghost inline-flex w-full items-center justify-center gap-2" disabled={busy !== null} onClick={() => cancel(t)}>
                        {busy === `cancel-${t.tokenId}` ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />} Hủy đăng bán
                      </button>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <label className="flex items-center gap-2 text-sm text-white/70">
                          Giá bán (USDC)
                          <input
                            className="input-dark tnum"
                            inputMode="decimal"
                            value={prices[t.tokenId] ?? formatUsdc(TIERS[t.tier].priceRaw)}
                            onChange={(e) => setPrices((p) => ({ ...p, [t.tokenId]: e.target.value }))}
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button className="btn-neon" disabled={busy !== null} onClick={() => list(t)}>
                            {busy === `list-${t.tokenId}` ? <Loader2 className="mx-auto animate-spin" size={16} /> : 'Đăng bán'}
                          </button>
                          <button className="btn-ghost" disabled={busy !== null || t.tier === 2} onClick={() => setUpgrading(t.tokenId)}>
                            Nâng hạng
                          </button>
                        </div>
                      </div>
                    )}
                  </TicketCard>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
