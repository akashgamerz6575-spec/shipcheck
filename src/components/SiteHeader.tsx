import { FlaskConical, PanelBottomOpen, Terminal } from 'lucide-react'
import type { SdkStatus, Variant } from '../lib/flagsmith'

interface SiteHeaderProps {
  variant: Variant
  sdkStatus: SdkStatus
  inspectorOpen: boolean
  onToggleInspector: () => void
}

const statusLabel: Record<SdkStatus, string> = {
  loading: 'Connecting',
  connected: 'Live',
  fallback: 'Fallback',
  error: 'Offline',
}

export function SiteHeader({
  variant,
  sdkStatus,
  inspectorOpen,
  onToggleInspector,
}: SiteHeaderProps) {
  const isGuided = variant === 'guided_fix'

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/70 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-400">
            <Terminal className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight text-white">
              ShipCheck
            </span>
            <span className="mono mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              launch readiness
            </span>
          </span>
        </a>

        <div className="flex items-center gap-2 sm:gap-3">
          <span
            className={`chip hidden sm:inline-flex ${
              isGuided
                ? 'border-brand-500/40 bg-brand-500/10 text-brand-300'
                : 'border-sky-500/30 bg-sky-500/10 text-sky-300'
            }`}
            title="Your live Flagsmith variation for fix_workflow_mode"
          >
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
            {variant}
          </span>

          <span className="chip hidden md:inline-flex" title="Flagsmith SDK status">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                sdkStatus === 'connected'
                  ? 'animate-pulse-dot bg-brand-400'
                  : sdkStatus === 'loading'
                    ? 'bg-amber-400'
                    : 'bg-zinc-500'
              }`}
              aria-hidden="true"
            />
            Flagsmith {statusLabel[sdkStatus]}
          </span>

          <button
            type="button"
            onClick={onToggleInspector}
            aria-expanded={inspectorOpen}
            className="inline-flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800/70 px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-brand-500/50 hover:text-white"
          >
            <PanelBottomOpen className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Inspector</span>
          </button>
        </div>
      </div>
    </header>
  )
}
