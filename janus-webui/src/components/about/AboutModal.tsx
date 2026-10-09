import { useEffect } from 'react'
import { X } from 'lucide-react'
import { AboutPage } from '@renderer/pages/AboutPage'
import { useAppStore } from '@renderer/stores/appStore'
import { useIosModalPresence } from '@renderer/components/ios-modal-presence'

/** About dialog — standard size (720×560), capped at 85vh; iOS-style present and dismiss (matches Settings). */
export function AboutModal() {
  const { aboutOpen, closeAbout } = useAppStore()
  const { mounted, dismissing } = useIosModalPresence(aboutOpen)

  useEffect(() => {
    if (!aboutOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAbout()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aboutOpen, closeAbout])

  if (!mounted) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 ${
        dismissing ? 'animate-ios-backdrop-out' : 'animate-ios-backdrop-in'
      }`}
      role="presentation"
      onClick={() => closeAbout()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
        className={`bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col w-[min(720px,92vw)] h-[min(560px,85vh)] max-h-[85vh] origin-center ${
          dismissing ? 'animate-ios-modal-out' : 'animate-ios-modal-in'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0 border-b border-zinc-800 px-5 py-3">
          <h2 id="about-modal-title" className="text-base font-medium text-zinc-100">
            About me
          </h2>
          <button
            type="button"
            onClick={() => closeAbout()}
            className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close about"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <AboutPage embedded />
        </div>
      </div>
    </div>
  )
}
