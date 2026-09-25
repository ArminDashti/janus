import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface CopyButtonProps {
  /** Text to copy to the clipboard. */
  text: () => string
  className?: string
}

/** Copies `text` to the clipboard with a brief "Copied!" confirmation. */
export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable (insecure context) — no feedback
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={
        className ??
        'flex items-center gap-1 px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded'
      }
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check size={12} className="text-emerald-400" />
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy size={12} />
          <span>Copy</span>
        </>
      )}
    </button>
  )
}
