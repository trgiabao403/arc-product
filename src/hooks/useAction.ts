import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { friendlyError } from '@/lib/contract'

/** Runs one onchain action at a time with consistent toasts and a busy key. */
export function useAction(onDone: () => void) {
  const [busy, setBusy] = useState<string | null>(null)

  const run = useCallback(
    async (key: string, fn: () => Promise<void>, success: string) => {
      setBusy(key)
      try {
        await fn()
        toast.success(success)
        onDone()
      } catch (e) {
        const msg = friendlyError(e)
        if (msg.startsWith('Bạn đã hủy')) toast(msg)
        else toast.error(msg)
      } finally {
        setBusy(null)
      }
    },
    [onDone],
  )

  return { busy, run }
}
