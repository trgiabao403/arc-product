import { parseAbi } from 'viem'
import { arcTestnet } from 'viem/chains'
import { getUsdc } from '@/onchain-facts'

export const CHAIN_ID = arcTestnet.id

export const TICKETS_ADDRESS = '0xdd4417191cc8cfdef749b381f7d988da8d1f30e6' as const
/** Block in which the ticket contract was deployed (start of event scans). */
export const DEPLOY_BLOCK = 0x4253b81n

const usdcFact = getUsdc(CHAIN_ID)
if (!usdcFact) throw new Error('USDC is not registered for Arc Testnet')
export const USDC_ADDRESS = usdcFact.address as `0x${string}`

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

export const ticketsAbi = parseAbi([
  'function buyTickets(uint8 showId, uint16[] seatIds)',
  'function buyLightstick(uint256 qty)',
  'function listForSale(uint256 tokenId, uint256 price)',
  'function cancelListing(uint256 tokenId)',
  'function buyListed(uint256 tokenId, uint256 maxPrice)',
  'function upgradeSeat(uint256 oldTokenId, uint16 newSeatId)',
  'function getSoldBitmap(uint8 showId) view returns (uint256[2])',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function listings(uint256 tokenId) view returns (address seller, uint256 price)',
  'function ticketsHeld(uint8 showId, address holder) view returns (uint256)',
  'function fanPoints(address fan) view returns (uint256)',
  'function vipTickets(address fan) view returns (uint256)',
  'function lightsticks(address fan) view returns (uint256)',
  'function fanCount() view returns (uint256)',
  'function getFans(uint256 offset, uint256 limit) view returns (address[])',
  'function showOpen(uint8 showId) view returns (bool)',
  'function paused() view returns (bool)',
  'event TicketPurchased(address indexed buyer, uint8 indexed showId, uint16 seatId, uint256 tokenId, uint8 tier, uint256 price)',
  'event ListedSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price, uint256 fee)',
])

export const MAX_PER_WALLET = 6
export const LIGHTSTICK_PRICE = 5_000_000n
export const FEE_BPS = 500n

export function tokenIdOf(showId: number, seatId: number): number {
  return (showId + 1) * 1000 + seatId
}

export function decodeTokenId(tokenId: number): { showId: number; seatId: number } {
  return { showId: Math.floor(tokenId / 1000) - 1, seatId: tokenId % 1000 }
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

/** Turns wallet / RPC / revert errors into short Vietnamese messages. */
export function friendlyError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  const msg = raw.toLowerCase()
  if (msg.includes('user rejected') || msg.includes('user denied')) return 'Bạn đã hủy giao dịch.'
  if (msg.includes('seattaken')) return 'Có ghế vừa được người khác mua. Hãy chọn ghế khác.'
  if (msg.includes('walletcapexceeded')) return 'Mỗi ví chỉ được giữ tối đa 6 vé cho mỗi đêm diễn.'
  if (msg.includes('showclosed')) return 'Đêm diễn này đã đóng bán.'
  if (msg.includes('enforcedpause')) return 'Hệ thống đang tạm dừng bán vé.'
  if (msg.includes('pricetoohigh')) return 'Giá niêm yết đã thay đổi. Hãy tải lại và thử lại.'
  if (msg.includes('listingnotfound')) return 'Vé này không còn được niêm yết.'
  if (msg.includes('insufficient') || msg.includes('exceeds balance')) {
    return 'Số dư USDC không đủ. Hãy nhận thêm USDC Testnet bằng nút "Get test USDC".'
  }
  if (msg.includes('network') || msg.includes('timeout')) return 'Lỗi mạng. Hãy thử lại.'
  return 'Giao dịch thất bại. Hãy thử lại.'
}
