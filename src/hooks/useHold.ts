import { useEffect, useState } from 'react'
import { HOLD_SECONDS } from '@/lib/data'

/**
 * Ten-minute seat hold shown in the UI. It starts with the first picked seat
 * and clears the selection when it runs out. Seats are only guaranteed once
 * the purchase transaction is confirmed onchain.
 */
export function useHold(active: boolean, onExpire: () => void) {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // Start or stop the clock from a timer callback so the render stays pure.
  useEffect(() => {
    const id = setTimeout(() => {
      if (active) {
        const t = Date.now()
        setNow(t)
        setEndsAt((prev) => prev ?? t + HOLD_SECONDS * 1000)
      } else {
        setEndsAt(null)
      }
    }, 0)
    return () => clearTimeout(id)
  }, [active])

  useEffect(() => {
    if (endsAt === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [endsAt])

  const remaining = endsAt === null ? HOLD_SECONDS : Math.min(HOLD_SECONDS, Math.max(0, Math.ceil((endsAt - now) / 1000)))

  useEffect(() => {
    if (endsAt !== null && remaining === 0) onExpire()
  }, [endsAt, remaining, onExpire])

  return { remaining, running: endsAt !== null }
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
