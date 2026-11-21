import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { copyText } from '../lib/clipboard'

interface CopyButtonProps {
  text: string
  label: string
  copiedLabel?: string
  onCopied?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  className?: string
  disabled?: boolean
  title?: string
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const styles = {
  primary:
    'bg-brand-500 text-ink-950 hover:bg-brand-400 shadow-[0_8px_24px_-12px_rgb(16_185_129/0.9)]',
  secondary:
    'border border-ink-600 bg-ink-800/80 text-zinc-200 hover:border-brand-500/60 hover:text-white',
  ghost: 'text-zinc-400 hover:bg-ink-800 hover:text-zinc-100',
} as const

const sizes = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
} as const

export function CopyButton({
  text,
  label,
  copiedLabel = 'Copied',
  onCopied,
  variant = 'secondary',
  size = 'md',
  className = '',
  disabled = false,
  title,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  async function handleClick() {
    const ok = await copyText(text)
    if (!ok) return
    setCopied(true)
    onCopied?.()
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 2200)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={title}
      className={`${base} ${styles[variant]} ${sizes[size]} ${className}`}
      data-copied={copied ? 'true' : 'false'}
    >
      {copied ? (
        <Check className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
      ) : (
        <Copy className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
      )}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  )
}
