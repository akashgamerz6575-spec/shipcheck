import { ArrowRight, FlaskConical, Github, Sparkles, Wand2 } from 'lucide-react'
import { checkPreview, severityLabel } from '../lib/analyzer'
import { EXPERIMENT_FLAG, EXPERIMENT_HYPOTHESIS, type Variant } from '../lib/flagsmith'

interface EmptyStateProps {
  variant: Variant
}

export function EmptyState({ variant }: EmptyStateProps) {
  const checks = checkPreview()
  const isGuided = variant === 'guided_fix'

  return (
    <div className="animate-fade-up space-y-6">
      <section className="card p-5 sm:p-6" aria-label="What ShipCheck checks">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-200 uppercase">
            The 8 launch checks
          </h2>
          <span className="chip">100 points total</span>
        </div>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {checks.map((check) => (
            <div
              key={check.id}
              className="flex items-start gap-3 rounded-lg border border-ink-700/60 bg-ink-850/40 px-3 py-2.5"
            >
              <span className="mono mt-0.5 w-8 shrink-0 text-[11px] text-zinc-500">
                {String(check.points).padStart(2, '0')}p
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-zinc-200">{check.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{check.summary}</p>
              </div>
              <span className="chip ml-auto shrink-0 px-2 py-0.5 text-[10px]">
                {severityLabel(check.severity)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Step
          step="01"
          icon={<Github className="h-4 w-4" aria-hidden="true" />}
          title="Point it at any repo"
          body="Paste owner/repo, a full GitHub URL, or a raw README. Three built-in samples work even if GitHub rate-limits you."
        />
        <Step
          step="02"
          icon={<Wand2 className="h-4 w-4" aria-hidden="true" />}
          title="Get a 0–100 score"
          body="Eight weighted checks run instantly in your browser. No signup, no backend, no data leaves the tab."
        />
        <Step
          step="03"
          icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
          title={isGuided ? 'Copy the exact fix' : 'Work the checklist'}
          body={
            isGuided
              ? 'Every failing check ships a ready-to-paste Markdown snippet. Copy one, commit, rescan.'
              : 'Each failing check includes a concrete explanation and severity, plus an exportable report.'
          }
        />
      </div>

      <section className="card flex flex-col gap-3 border-brand-500/20 bg-gradient-to-br from-ink-900/90 to-ink-900/40 p-5 sm:flex-row sm:items-start sm:gap-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-400">
          <FlaskConical className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-white">
            This page is a live Flagsmith experiment
          </h2>
          <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-zinc-400">
            {EXPERIMENT_HYPOTHESIS}
          </p>
          <p className="mono mt-2 text-[11px] text-zinc-500">
            flag: <span className="text-brand-300">{EXPERIMENT_FLAG}</span> · metric:{' '}
            <span className="text-zinc-300">fix_action_completed</span> · 50 / 50 split · 100%
            rollout
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            You are currently in the{' '}
            <span className={isGuided ? 'font-semibold text-brand-300' : 'font-semibold text-sky-300'}>
              {variant}
            </span>{' '}
            arm. Open the Inspector below to watch exposure and conversion events live.
          </p>
        </div>
      </section>
    </div>
  )
}

function Step({
  step,
  icon,
  title,
  body,
}: {
  step: string
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-brand-400">
          {icon}
        </span>
        <span className="mono text-[11px] text-zinc-600">{step}</span>
      </div>
      <h3 className="mt-3 text-[13px] font-semibold text-zinc-100">{title}</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">{body}</p>
    </div>
  )
}
