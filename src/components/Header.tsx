import { ConnectKitButton } from 'connectkit'
import { Crown, Sparkles, Ticket, Store } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { formatUsdc, formatUnitsFixed } from '@/onchain-money'
import { USDC_DECIMALS } from '@/onchain-facts'
import { shortAddr } from '@/lib/contract'

export type TabKey = 'hunt' | 'vault' | 'market' | 'rank'

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'hunt', label: 'Săn vé', icon: <Ticket size={16} /> },
  { key: 'vault', label: 'Kho vé của tôi', icon: <Sparkles size={16} /> },
  { key: 'market', label: 'Chợ & Lightstick', icon: <Store size={16} /> },
  { key: 'rank', label: 'Top BLINKs', icon: <Crown size={16} /> },
]

interface Props {
  tab: TabKey
  onTab: (t: TabKey) => void
  balance: bigint
  ticketCount: number
}

export function Header({ tab, onTab, balance, ticketCount }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#ff2d95] font-display text-lg font-bold text-black shadow-[0_0_24px_rgba(255,45,149,0.7)]">
            BP
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-bold tracking-wide">BORN PINK ENCORE</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#ff9bd2]">Official Ticket Hub · Arc Testnet</div>
          </div>
        </div>

        <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto md:order-none md:mx-0 md:w-auto md:flex-1" aria-label="Điều hướng chính">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => onTab(t.key)}
              aria-current={tab === t.key ? 'page' : undefined}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors ${
                tab === t.key ? 'bg-[#ff2d95] text-white shadow-[0_0_20px_rgba(255,45,149,0.5)]' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              {t.icon}
              {t.label}
              {t.key === 'vault' && ticketCount > 0 && (
                <span className="rounded-full bg-white px-1.5 text-xs font-bold text-black tnum">{ticketCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <ConnectKitButton.Custom>
            {({ isConnected, show, address }) => (
              <>
                {isConnected && (
                  <div className="hidden items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold tnum sm:flex" title="Số dư USDC (ERC-20, 6 chữ số thập phân)">
                    <TokenUSDC variant="branded" size={18} />
                    {formatUnitsFixed(balance, USDC_DECIMALS, 2)}
                    <span className="sr-only">{formatUsdc(balance)} USDC</span>
                  </div>
                )}
                <button className="btn-ghost" onClick={show}>
                  {isConnected && address ? shortAddr(address) : 'Kết nối ví'}
                </button>
              </>
            )}
          </ConnectKitButton.Custom>
        </div>
      </div>
    </header>
  )
}
