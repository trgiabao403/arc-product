import { useState } from 'react'
import { Loader2, Minus, Plus } from 'lucide-react'
import { usePay } from '@/hooks/usePay'
import { useAction } from '@/hooks/useAction'
import { CHAIN_ID, LIGHTSTICK_PRICE, TICKETS_ADDRESS, ticketsAbi } from '@/lib/contract'
import { IMAGES } from '@/lib/data'
import { formatUsdc } from '@/onchain-money'
import type { TicketData } from '@/hooks/useTicketData'

export function LightstickShop({ data }: { data: TicketData }) {
  const pay = usePay()
  const { busy, run } = useAction(data.refresh)
  const [qty, setQty] = useState(1)
  const total = LIGHTSTICK_PRICE * BigInt(qty)
  const low = pay.address !== undefined && total > data.usdcBalance

  function buy() {
    void run(
      'lightstick',
      async () => {
        await pay.ensureAllowance(total)
        const hash = await pay.writeContractAsync({
          address: TICKETS_ADDRESS,
          abi: ticketsAbi,
          functionName: 'buyLightstick',
          args: [BigInt(qty)],
          chainId: CHAIN_ID,
        })
        await pay.wait(hash)
      },
      `Đã thêm ${qty} Lightstick ảo và ${qty * 25} Fan Point!`,
    )
  }

  return (
    <section className="panel relative overflow-hidden">
      <img src={IMAGES.confetti} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#07060a] via-[#07060a]/85 to-[#07060a]/40" />
      <div className="relative grid items-center gap-8 p-6 sm:p-8 md:grid-cols-[auto_1fr]">
        <Lightstick count={data.lightsticks} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ff9bd2]">Cửa hàng Lightstick</p>
          <h2 className="font-display text-3xl font-bold">Lightstick ảo BORN PINK</h2>
          <p className="mt-2 max-w-lg text-white/70">
            Gậy cổ vũ ảo gắn với ví của bạn, mỗi chiếc cộng 25 Fan Point. Vé CAT 1 đã tặng sẵn 1 chiếc.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <div className="flex items-center rounded-xl border border-white/15">
              <button className="grid h-11 w-11 place-items-center disabled:opacity-40" aria-label="Giảm" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)}>
                <Minus size={16} />
              </button>
              <span className="w-10 text-center font-display text-lg font-bold tnum">{qty}</span>
              <button className="grid h-11 w-11 place-items-center disabled:opacity-40" aria-label="Tăng" disabled={qty >= 10} onClick={() => setQty((q) => q + 1)}>
                <Plus size={16} />
              </button>
            </div>
            <div className="font-display text-2xl font-bold tnum neon-text">{formatUsdc(total)} USDC</div>
            <button className="btn-neon" disabled={!pay.address || busy !== null || low} onClick={buy}>
              {busy === 'lightstick' ? <Loader2 className="mx-auto animate-spin" size={18} /> : 'Mua Lightstick'}
            </button>
          </div>
          {!pay.address && <p className="mt-2 text-sm text-white/55">Kết nối ví để mua.</p>}
          {low && <p className="mt-2 text-sm text-amber-300">Số dư USDC chưa đủ.</p>}
        </div>
      </div>
    </section>
  )
}

function Lightstick({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="120" height="190" viewBox="0 0 120 190" role="img" aria-label="Lightstick ảo">
        <defs>
          <radialGradient id="ls-glow" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="45%" stopColor="#ff5cb1" />
            <stop offset="100%" stopColor="#ff2d95" />
          </radialGradient>
          <filter id="ls-blur" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>
        <circle cx="60" cy="52" r="42" fill="#ff2d95" opacity="0.7" filter="url(#ls-blur)" className="twinkle" />
        <path d="M60 6 C78 6 100 22 100 46 C100 66 84 76 72 80 L72 92 L48 92 L48 80 C36 76 20 66 20 46 C20 22 42 6 60 6Z" fill="url(#ls-glow)" stroke="#fff" strokeOpacity="0.5" />
        <path d="M60 22 L66 38 L84 40 L70 52 L74 70 L60 60 L46 70 L50 52 L36 40 L54 38Z" fill="#fff" opacity="0.85" />
        <rect x="46" y="92" width="28" height="12" rx="3" fill="#2a2a33" />
        <rect x="52" y="104" width="16" height="78" rx="8" fill="#16141c" stroke="#ff2d95" strokeOpacity="0.6" />
      </svg>
      <div className="rounded-full bg-black/60 px-4 py-1.5 text-sm font-semibold">
        Bạn đang có <span className="tnum text-[#ff9bd2]">{count}</span>
      </div>
    </div>
  )
}
