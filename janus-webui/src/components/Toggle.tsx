import { cn } from '@renderer/lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  title?: string
  disabled?: boolean
  /** Accessible label when the switch has no visible text. */
  ariaLabel?: string
}

/** iOS-style switch: h-6 w-11 track, h-5 w-5 knob, spring-less 200ms slide. */
export function Toggle({ checked, onChange, title, disabled, ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900',
        checked ? 'bg-emerald-500' : 'bg-zinc-600',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200 will-change-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
          disabled && 'cursor-not-allowed'
        )}
      />
    </button>
  )
}
