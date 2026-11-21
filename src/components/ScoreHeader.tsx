import { Activity, FlaskConical, Github, Star } from 'lucide-react'
import type { AnalysisResult } from '../lib/analyzer'
import { formatStars, type RepoBundle } from '../lib/github'
import type { Variant } from '../lib/flagsmith'
import { CopyButton } from './CopyButton'

interface ScoreHeaderProps {
  analysis: AnalysisResult
  bundle: RepoBundle
  variant: Variant
  onCopyReport: () => void
  onCopyAllFixes: () => void
}

function scoreColor(score: number): { stroke: string; text: string; ring: string } {
  if (score >= 90) return { stroke: '#34d399', text: 'text-brand-300', ring: 'stroke-brand-400' }
  if (score >= 70) return { stroke: '#a3e635', text: 'text-lime-300', ring: 'stroke-lime-400' }
  if (score >= 50) return { stroke: '#fbbf24', text: 'text-amber-300', ring: 'stroke-amber-400' }
  return { stroke: '#fb7185', text: 'text-rose-300', ring: 'stroke-rose-400' }
}

export function ScoreHeader({
  analysis,
  bundle,
  variant,
  onCopyReport,
  onCopyAllFixes,
}: ScoreHeaderProps) {
  const colors = scoreColor(analysis.score)
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - analysis.score / analysis.maxScore)
  const isGuided = variant === 'guided_fix'
  const sourceLabel =
    bundle.meta.source === 'sample'
      ? 'Built-in sample'
      : bundle.meta.source === 'paste'
        ? 'Pasted README'
        : 'GitHub API'

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?repo=${encodeURIComponent(bundle.meta.fullName)}`
      : ''

  return (
    <section className="card animate-fade-up overflow-hidden" aria-label="Readiness score">
      <div className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center">
        <div className="flex items-center gap-5">
          <div className="relative h-32 w-32 shrink-0">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                strokeWidth="9"
                className="stroke-ink-700"
              />
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                strokeWidth="9"
                strokeLinecap="round"
                stroke={colors.stroke}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 700ms ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold tracking-tight ${colors.text}`}>
                {analysis.score}
              </span>
              <span className="mono text-[10px] tracking-[0.2em] text-zinc-500">/ 100</span>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                  analysis.score >= 75
                    ? 'border-brand-500/40 bg-brand-500/10 text-brand-300'
                    : analysis.score >= 50
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                      : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                }`}
              >
                Grade {analysis.grade} · {analysis.gradeLabel}
              </span>
              <span className="chip">
                <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                {analysis.passedCount} passed · {analysis.failedCount} failed
              </span>
            </div>
            <h2 className="mt-2 max-w-xl text-lg leading-snug font-semibold text-white sm:text-xl">
              {analysis.headline}
            </h2>
          </div>
        </div>

        <div className="lg:ml-auto lg:max-w-xs lg:border-l lg:border-ink-700/70 lg:pl-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-zinc-200">
              <Github className="h-3.5 w-3.5" aria-hidden="true" />
              {bundle.meta.fullName}
            </span>
            {bundle.meta.stars > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                {formatStars(bundle.meta.stars)}
              </span>
            )}
            {bundle.meta.language && <span className="chip">{bundle.meta.language}</span>}
            <span className="chip">{sourceLabel}</span>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {isGuided ? (
              <CopyButton
                text={analysis.missingMarkdown}
                label={
                  analysis.missingSections.length > 0
                    ? `Copy all ${analysis.missingSections.length} missing sections`
                    : 'Nothing missing — 100/100'
                }
                copiedLabel="All fix snippets copied"
                variant="primary"
                onCopied={onCopyAllFixes}
                disabled={analysis.missingSections.length === 0}
                title="Copies every failing check's fix snippet as one Markdown block"
              />
            ) : (
              <CopyButton
                text={analysis.checklistReport}
                label="Copy Checklist Summary"
                copiedLabel="Checklist copied"
                variant="primary"
                onCopied={onCopyReport}
                title="Copies the full pass/fail diagnostic report"
              />
            )}

            {shareUrl && (
              <CopyButton
                text={shareUrl}
                label="Copy share link"
                copiedLabel="Share link copied"
                variant="secondary"
                size="sm"
                title="Copy shareable link with ?repo= query parameter"
              />
            )}

            <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <FlaskConical className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
              {isGuided
                ? 'guided_fix arm — fix snippets unlocked'
                : 'control arm — static diagnostic checklist'}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
