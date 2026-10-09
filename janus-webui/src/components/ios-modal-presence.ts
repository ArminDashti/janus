import { useEffect, useRef, useState } from 'react'

const DISMISS_MS = 520

/**
 * iOS-style presence for a conditionally mounted modal: stays mounted through
 * the dismiss animation, and resets cleanly when reopened mid-dismiss.
 */
export function useIosModalPresence(open: boolean) {
  const [mounted, setMounted] = useState(open)
  const [dismissing, setDismissing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (open) {
      setMounted(true)
      setDismissing(false)
      return
    }
    if (!mounted) return
    setDismissing(true)
    timerRef.current = setTimeout(() => {
      setMounted(false)
      setDismissing(false)
    }, DISMISS_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [open, mounted])

  return { mounted, dismissing }
}
