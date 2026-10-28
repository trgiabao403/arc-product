import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { erc20Abi } from 'viem'
import {
  CHAIN_ID,
  TICKETS_ADDRESS,
  USDC_ADDRESS,
  ZERO_ADDRESS,
  decodeTokenId,
  ticketsAbi,
  tokenIdOf,
} from '@/lib/contract'
import { decodeBitmap, tierOf, type Tier } from '@/lib/seats'

export interface Ticket {
  tokenId: number
  showId: number
  seatId: number
  tier: Tier
  owner: `0x${string}`
  /** Active resale price in USDC base units, or null when not listed. */
  listingPrice: bigint | null
}

export interface TicketData {
  soldByShow: [Set<number>, Set<number>]
  showOpen: [boolean, boolean]
  paused: boolean
  tickets: Ticket[]
  myTickets: Ticket[]
  listed: Ticket[]
  held: [number, number]
  points: number
  vipCount: number
  lightsticks: number
  usdcBalance: bigint
  isLoading: boolean
  refresh: () => void
}

const base = { address: TICKETS_ADDRESS, abi: ticketsAbi, chainId: CHAIN_ID } as const

export function useTicketData(): TicketData {
  const { address } = useAccount()
  const qc = useQueryClient()

  const shared = useReadContracts({
    contracts: [
      { ...base, functionName: 'getSoldBitmap', args: [0] },
      { ...base, functionName: 'getSoldBitmap', args: [1] },
      { ...base, functionName: 'showOpen', args: [0] },
      { ...base, functionName: 'showOpen', args: [1] },
      { ...base, functionName: 'paused' },
    ],
    query: { refetchInterval: 6000 },
  })

  const sold0 = useMemo(
    () => decodeBitmap(shared.data?.[0]?.result),
    [shared.data],
  )
  const sold1 = useMemo(
    () => decodeBitmap(shared.data?.[1]?.result),
    [shared.data],
  )

  const tokenIds = useMemo(() => {
    const ids: number[] = []
    sold0.forEach((s) => ids.push(tokenIdOf(0, s)))
    sold1.forEach((s) => ids.push(tokenIdOf(1, s)))
    return ids
  }, [sold0, sold1])

  const ownership = useReadContracts({
    contracts: tokenIds.flatMap((id) => [
      { ...base, functionName: 'ownerOf' as const, args: [BigInt(id)] as const },
      { ...base, functionName: 'listings' as const, args: [BigInt(id)] as const },
    ]),
    query: { enabled: tokenIds.length > 0, refetchInterval: 8000 },
  })

  const tickets = useMemo<Ticket[]>(() => {
    const out: Ticket[] = []
    tokenIds.forEach((tokenId, i) => {
      const owner = ownership.data?.[i * 2]?.result as `0x${string}` | undefined
      if (!owner) return
      const listing = ownership.data?.[i * 2 + 1]?.result as readonly [`0x${string}`, bigint] | undefined
      const { showId, seatId } = decodeTokenId(tokenId)
      const active = listing && listing[0] !== ZERO_ADDRESS && listing[0].toLowerCase() === owner.toLowerCase()
      out.push({
        tokenId,
        showId,
        seatId,
        tier: tierOf(seatId),
        owner,
        listingPrice: active ? listing[1] : null,
      })
    })
    return out
  }, [tokenIds, ownership.data])

  const me = useReadContracts({
    contracts: address
      ? [
          { ...base, functionName: 'ticketsHeld', args: [0, address] },
          { ...base, functionName: 'ticketsHeld', args: [1, address] },
          { ...base, functionName: 'fanPoints', args: [address] },
          { ...base, functionName: 'vipTickets', args: [address] },
          { ...base, functionName: 'lightsticks', args: [address] },
        ]
      : [],
    query: { enabled: Boolean(address), refetchInterval: 8000 },
  })

  const balance = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: Boolean(address), refetchInterval: 8000 },
  })

  const num = (i: number) => Number((me.data?.[i]?.result) ?? 0n)

  const myTickets = useMemo(
    () => (address ? tickets.filter((t) => t.owner.toLowerCase() === address.toLowerCase()) : []),
    [tickets, address],
  )
  const listed = useMemo(() => tickets.filter((t) => t.listingPrice !== null), [tickets])

  const refresh = useCallback(() => {
    void qc.invalidateQueries()
  }, [qc])

  const soldByShow = useMemo<[Set<number>, Set<number>]>(() => [sold0, sold1], [sold0, sold1])

  return {
    soldByShow,
    showOpen: [
      (shared.data?.[2]?.result) ?? true,
      (shared.data?.[3]?.result) ?? true,
    ],
    paused: (shared.data?.[4]?.result) ?? false,
    tickets,
    myTickets,
    listed,
    held: [num(0), num(1)],
    points: num(2),
    vipCount: num(3),
    lightsticks: num(4),
    usdcBalance: (balance.data) ?? 0n,
    isLoading: shared.isLoading,
    refresh,
  }
}
