import { useCallback } from 'react'
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { CHAIN_ID, TICKETS_ADDRESS, USDC_ADDRESS } from '@/lib/contract'

/**
 * Shared transaction plumbing: switches to Arc Testnet, makes sure the
 * ticket contract may pull the USDC it needs, and waits for receipts.
 */
export function usePay() {
  const { address, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const client = usePublicClient({ chainId: CHAIN_ID })

  const ensureChain = useCallback(async () => {
    if (chainId !== CHAIN_ID) await switchChainAsync({ chainId: CHAIN_ID })
  }, [chainId, switchChainAsync])

  const wait = useCallback(
    async (hash: `0x${string}`) => {
      if (!client) throw new Error('network unavailable')
      const receipt = await client.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('reverted')
      return receipt
    },
    [client],
  )

  /** Approves exactly the missing allowance when it is lower than `amount`. */
  const ensureAllowance = useCallback(
    async (amount: bigint, onApprove?: (hash: `0x${string}`) => void) => {
      if (!client || !address) throw new Error('wallet not connected')
      await ensureChain()
      const allowance = await client.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, TICKETS_ADDRESS],
      })
      if (allowance >= amount) return
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [TICKETS_ADDRESS, amount],
        chainId: CHAIN_ID,
      })
      onApprove?.(hash)
      await wait(hash)
    },
    [client, address, ensureChain, writeContractAsync, wait],
  )

  return { address, ensureChain, ensureAllowance, wait, writeContractAsync }
}
