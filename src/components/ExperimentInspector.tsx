import {
  Beaker,
  CheckCircle2,
  ChevronUp,
  CircleDashed,
  Clock,
  Copy,
  ExternalLink,
  Fingerprint,
  FlaskConical,
  RefreshCw,
  Send,
} from 'lucide-react'
import {
  CONVERSION_EVENT,
  EXPERIMENT_FLAG,
  EXPERIMENT_HYPOTHESIS,
  formatVisitorId,
  type SdkStatus,
  type Variant,
} from '../lib/flagsmith'
import { copyText } from '../lib/clipboard'
import { useState } from 'react'

interface ExperimentInspectorProps {
  open: boolean
  onToggle: () => void
  visitorId: string
  variant: Variant
  sdkStatus: SdkStatus
  exposureRecorded: boolean
  exposureTimestamp?: string | null
  inExperiment: boolean
  conversionRecorded: boolean
  conversionSent: boolean
  conversionTimestamp?: string | null
  hasKey: boolean
  previewOverride: boolean
  onResetVisitor: () => void
}

const statusCopy: Record<SdkStatus, { label: string; tone: string }> = {
  loading: { label: 'Connecting to Flagsmith…', tone: 'text-amber-300' },
  connected: { label: 'Connected to Flagsmith', tone: 'text-brand-300' },
  fallback: { label: 'Fallback mode (no environment key)', tone: 'text-zinc-400' },
  error: { label: 'Flagsmith unreachable — using control fallback', tone: 'text-rose-300' },
}

export function ExperimentInspector({
  open,
  onToggle,
  visitorId,
  variant,
  sdkStatus,
  exposureRecorded,
  exposureTimestamp,
  inExperiment,
  conversionRecorded,
  conversionSent,
  conversionTimestamp,
  hasKey,
  previewOverride,
  onResetVisitor,
}: ExperimentInspectorProps) {
  const [copiedId, setCopiedId] = useState(false)
  const isGuided = variant === 'guided_fix'
  const status = statusCopy[sdkStatus]
  const dashboardUrl = 'https://app.flagsmith.com/project/55323'

  async function copyVisitor() {
    const ok = await copyText(visitorId)
    if (!ok) return
    setCopiedId(true)
    window.setTimeout(() => setCopiedId(false), 1800)
  }

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-700/80 bg-ink-950/95 backdrop-blur-xl"
      aria-label="Flagsmith experiment inspector"
      data-variant={variant}
      data-exposure={exposureRecorded ? 'recorded' : 'none'}
      data-conversion={conversionRecorded ? 'recorded' : 'none'}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 text-left sm:px-6"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-400">
          <Beaker className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-xs font-semibold tracking-wide text-zinc-200 uppercase">
          Experiment Inspector
        </span>
        <span
          className={`chip ${
            isGuided
              ? 'border-brand-500/40 bg-brand-500/10 text-brand-300'
              : 'border-sky-500/30 bg-sky-500/10 text-sky-300'
          }`}
        >
          <FlaskConical className="h-3 w-3" aria-hidden="true" />
          {variant}
        </span>
        <span className="mono hidden text-[11px] text-zinc-500 md:inline">
          {formatVisitorId(visitorId)}
        </span>
        <span className={`ml-auto hidden text-[11px] sm:block ${status.tone}`}>
          {status.label}
        </span>
        <ChevronUp
          className={`h-4 w-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="max-h-[68vh] overflow-y-auto border-t border-ink-800/80">
          <div className="mx-auto grid max-w-6xl gap-3 px-4 py-4 sm:px-6 lg:grid-cols-2">
            <div className="rounded-xl border border-ink-700/70 bg-ink-900/60 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                  <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" />
                  Visitor identity
                </div>
                <a
                  href={dashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-400 transition-colors hover:text-brand-300 hover:underline"
                  title="Open live Flagsmith project dashboard"
                >
                  Flagsmith Dashboard
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
              <p className="mono mt-2 break-all text-[12px] text-zinc-200">{visitorId}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyVisitor}
                  className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-800/70 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 transition-colors hover:border-brand-500/50 hover:text-white"
                >
                  {copiedId ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {copiedId ? 'Copied' : 'Copy ID'}
                </button>
                <button
                  type="button"
                  onClick={onResetVisitor}
                  className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-800/70 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 transition-colors hover:border-brand-500/50 hover:text-white"
                  title="Generates a new sc_ visitor id and re-runs bucketing"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  New Visitor Session
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                Persisted in <code className="mono text-zinc-400">localStorage</code> and passed to{' '}
                <code className="mono text-zinc-400">flagsmith.identify()</code> before the flag is
                evaluated.
              </p>
            </div>

            <div className="rounded-xl border border-ink-700/70 bg-ink-900/60 p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                Assignment
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="mono text-[12px] text-zinc-400">{EXPERIMENT_FLAG}</span>
                <span className="text-zinc-600">→</span>
                <span
                  className={`rounded-md border px-2 py-0.5 text-xs font-bold ${
                    isGuided
                      ? 'border-brand-500/40 bg-brand-500/10 text-brand-300'
                      : 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                  }`}
                >
                  {variant}
                </span>
                <span
                  className={`chip ${
                    inExperiment
                      ? 'border-brand-500/30 text-brand-300'
                      : 'border-ink-600 text-zinc-400'
                  }`}
                >
                  {inExperiment ? 'Enrolled' : previewOverride ? 'Preview override' : 'Not enrolled'}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                {previewOverride
                  ? 'Dev-only ?preview_variant override. No exposure is sent to Flagsmith in this mode.'
                  : sdkStatus === 'connected'
                    ? 'Variation resolved by Flagsmith after identify(). 50 / 50 split, 100% rollout.'
                    : hasKey
                      ? 'Flagsmith could not be reached, so ShipCheck is serving the safe control fallback.'
                      : 'VITE_FLAGSMITH_ENV_KEY is not set, so ShipCheck is serving the safe control fallback.'}
              </p>
            </div>

            <div className="rounded-xl border border-ink-700/70 bg-ink-900/60 p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                Telemetry
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <TelemetryBadge
                  label="Exposure"
                  active={exposureRecorded}
                  detail={
                    exposureRecorded
                      ? exposureTimestamp
                        ? `Recorded at ${exposureTimestamp}`
                        : 'recorded'
                      : 'waiting for scan'
                  }
                  timestamp={exposureTimestamp}
                />
                <TelemetryBadge
                  label="Conversion"
                  active={conversionRecorded}
                  detail={
                    conversionRecorded
                      ? conversionTimestamp
                        ? `${conversionSent ? 'Sent' : 'Recorded'} at ${conversionTimestamp}`
                        : conversionSent
                          ? 'sent'
                          : 'local only'
                      : 'no action yet'
                  }
                  timestamp={conversionTimestamp}
                />
              </div>
              <p className="mono mt-3 text-[11px] text-zinc-500">
                event: <span className="text-zinc-300">{CONVERSION_EVENT}</span> · aggregation:
                occurrence · direction: up
              </p>
            </div>

            <div className="rounded-xl border border-ink-700/70 bg-ink-900/60 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                  <Beaker className="h-3.5 w-3.5" aria-hidden="true" />
                  Hypothesis
                </div>
                <span className="mono text-[10px] text-zinc-500">Project ID: 55323</span>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-zinc-400">
                {EXPERIMENT_HYPOTHESIS}
              </p>
              <p className="mt-2 text-[11px] text-zinc-500">
                Flag <code className="mono text-zinc-300">{EXPERIMENT_FLAG}</code> · 100% rollout ·
                50% control / 50% guided_fix
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

function TelemetryBadge({
  label,
  active,
  detail,
  timestamp,
}: {
  label: string
  active: boolean
  detail: string
  timestamp?: string | null
}) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 ${
        active
          ? 'border-brand-500/30 bg-brand-500/5'
          : 'border-ink-700 bg-ink-950/50'
      }`}
    >
      <div className="flex items-center justify-between text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
        <span className="flex items-center gap-1.5">
          {active ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
          ) : (
            <CircleDashed className="h-3.5 w-3.5 text-zinc-600" aria-hidden="true" />
          )}
          {label}
        </span>
        {timestamp && active && (
          <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
            <Clock className="h-2.5 w-2.5 text-brand-400/70" aria-hidden="true" />
            {timestamp}
          </span>
        )}
      </div>
      <p className={`mt-1 text-[11px] ${active ? 'text-brand-300' : 'text-zinc-500'}`}>{detail}</p>
    </div>
  )
}
