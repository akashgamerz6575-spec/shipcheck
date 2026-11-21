import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Sparkles,
  XCircle,
} from 'lucide-react'
import type { CheckResult, Severity } from '../lib/analyzer'
import type { Variant } from '../lib/flagsmith'
import { CopyButton } from './CopyButton'

interface CheckCardProps {
  check: CheckResult
  variant: Variant
  index: number
  defaultExpanded?: boolean
  onFixCopied: (check: CheckResult) => void
}

const severityStyles: Record<Severity, string> = {
  critical: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  high: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  medium: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  low: 'border-ink-600 bg-ink-800 text-zinc-400',
}

export function CheckCard({
  check,
  variant,
  index,
  defaultExpanded = false,
  onFixCopied,
}: CheckCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const showSnippet = variant === 'guided_fix' && !check.passed

  return (
    <article
      data-check-id={check.id}
      data-check-status={check.passed ? 'pass' : 'fail'}
      className={`group rounded-xl border p-4 transition-colors sm:p-5 ${
        check.passed
          ? 'border-ink-700/70 bg-ink-900/50'
          : 'border-ink-700 bg-ink-900/80 hover:border-ink-600'
      }`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex items-start gap-3.5">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
            check.passed
              ? 'border-brand-500/30 bg-brand-500/10 text-brand-400'
              : 'border-rose-500/25 bg-rose-500/10 text-rose-400'
          }`}
          aria-hidden="true"
        >
          {check.passed ? (
            <CheckCircle2 className="h-4.5 w-4.5" />
          ) : (
            <XCircle className="h-4.5 w-4.5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-100">{check.title}</h3>
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                check.passed
                  ? 'border-brand-500/30 bg-brand-500/10 text-brand-300'
                  : severityStyles[check.severity]
              }`}
            >
              {check.passed ? 'Pass' : `${check.severity} · ${check.points} pts`}
            </span>
            {check.passed && (
              <span className="mono text-[11px] text-zinc-500">+{check.points}</span>
            )}
          </div>

          <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">{check.explanation}</p>

          {showSnippet && (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  aria-expanded={expanded}
                  className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-800/70 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 transition-colors hover:border-brand-500/50 hover:text-white"
                >
                  <Sparkles className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
                  {expanded ? 'Hide fix snippet' : 'View fix snippet'}
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>

                <CopyButton
                  text={check.fixSnippet}
                  label="Copy fix snippet"
                  copiedLabel="Fix copied"
                  variant="primary"
                  size="sm"
                  onCopied={() => onFixCopied(check)}
                />
              </div>

              {expanded && (
                <pre className="mono animate-fade-up mt-2.5 max-h-72 overflow-auto rounded-lg border border-ink-700 bg-ink-950/90 p-3 text-[11.5px] leading-relaxed whitespace-pre-wrap text-zinc-300">
                  {check.fixSnippet}
                </pre>
              )}
            </div>
          )}

          {!check.passed && variant === 'control' && (
            <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400/80" aria-hidden="true" />
              Add this section to your README before launch.
            </p>
          )}
        </div>

        <span className="mono hidden shrink-0 pt-1 text-[11px] text-zinc-600 sm:block">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
    </article>
  )
}
