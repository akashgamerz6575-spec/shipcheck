import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  FlaskConical,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { analyzeReadiness, type AnalysisResult } from './lib/analyzer'
import {
  GithubScanError,
  bundleFromPaste,
  fetchRepoBundle,
  parseRepoRef,
  type RepoBundle,
} from './lib/github'
import { useShipCheckExperiment } from './lib/useExperiment'
import { SiteHeader } from './components/SiteHeader'
import { ScanForm } from './components/ScanForm'
import { ScoreHeader } from './components/ScoreHeader'
import { CheckCard } from './components/CheckCard'
import { CopyButton } from './components/CopyButton'
import { EmptyState } from './components/EmptyState'
import { ExperimentInspector } from './components/ExperimentInspector'
import { SAMPLE_REPOS, type SampleRepo } from './data/samples'

interface ScanError {
  message: string
  hint: string
}

function describeError(error: unknown): ScanError {
  if (error instanceof GithubScanError) {
    return { message: error.message, hint: error.hint }
  }
  if (error instanceof Error) {
    return {
      message: error.message,
      hint: 'Try a built-in sample or paste the README directly — ShipCheck never needs GitHub to be available.',
    }
  }
  return {
    message: 'Something went wrong while scanning.',
    hint: 'Try a built-in sample or paste the README directly.',
  }
}

export default function App() {
  const experiment = useShipCheckExperiment()
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [bundle, setBundle] = useState<RepoBundle | null>(null)
  const [status, setStatus] = useState<'idle' | 'scanning' | 'ready'>('idle')
  const [error, setError] = useState<ScanError | null>(null)
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [passedOpen, setPassedOpen] = useState(false)
  const resultsRef = useRef<HTMLDivElement>(null)
  const initialScanRef = useRef(false)

  const { evaluateScan, trackAction, variant } = experiment
  const isGuided = variant === 'guided_fix'
  const busy = status === 'scanning'

  const runBundle = useCallback(
    async (nextBundle: RepoBundle, sampleId: string | null) => {
      setStatus('scanning')
      setError(null)
      setActiveSampleId(sampleId)

      const analysis = analyzeReadiness(nextBundle.readme, {
        repoName: nextBundle.meta.fullName,
        description: nextBundle.meta.description,
        homepage: nextBundle.meta.homepage,
        license: nextBundle.meta.license,
        language: nextBundle.meta.language,
        topics: nextBundle.meta.topics,
      })

      // Update ?repo= in URL for sharing
      if (nextBundle.meta.fullName && nextBundle.meta.source !== 'paste') {
        try {
          const url = new URL(window.location.href)
          url.searchParams.set('repo', nextBundle.meta.fullName)
          window.history.replaceState({}, '', url.toString())
        } catch {
          // ignore
        }
      }

      // Evaluate only when the user is about to see a result, so exposures
      // reflect real scans instead of page bounces.
      await evaluateScan()

      setBundle(nextBundle)
      setResult(analysis)
      setStatus('ready')
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    },
    [evaluateScan],
  )

  const handleScanRepo = useCallback(
    async (input: string) => {
      const parsed = parseRepoRef(input)
      if (!parsed.ok) {
        setError({ message: parsed.error, hint: 'Format: owner/repo or https://github.com/owner/repo' })
        return
      }

      setStatus('scanning')
      setError(null)
      setActiveSampleId(null)

      try {
        const nextBundle = await fetchRepoBundle(parsed.ref)
        await runBundle(nextBundle, null)
      } catch (scanError) {
        setError(describeError(scanError))
        setStatus(result ? 'ready' : 'idle')
      }
    },
    [runBundle, result],
  )

  const handleScanSample = useCallback(
    (sample: SampleRepo) => {
      void runBundle(sample.bundle, sample.id)
    },
    [runBundle],
  )

  const handleScanPaste = useCallback(
    (repoName: string, readme: string) => {
      void runBundle(bundleFromPaste(repoName, readme), null)
    },
    [runBundle],
  )

  const repoLabel = bundle?.meta.fullName ?? 'this repo'

  const handleCopyReport = useCallback(() => {
    void trackAction('copy_checklist_report', repoLabel)
  }, [trackAction, repoLabel])

  const handleCopyAllFixes = useCallback(() => {
    void trackAction('copy_all_fix_snippets', repoLabel)
  }, [trackAction, repoLabel])

  const handleFixCopied = useCallback(
    (check: { id: string }) => {
      void trackAction(`copy_fix_snippet:${check.id}`, repoLabel)
    },
    [trackAction, repoLabel],
  )

  const resetScan = useCallback(() => {
    setResult(null)
    setBundle(null)
    setError(null)
    setStatus('idle')
    setActiveSampleId(null)
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('repo')
      window.history.replaceState({}, '', url.toString())
    } catch {
      // ignore
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (initialScanRef.current) return
    initialScanRef.current = true
    try {
      const params = new URLSearchParams(window.location.search)
      const repoParam = params.get('repo')
      if (repoParam && repoParam.trim()) {
        const clean = repoParam.trim()
        const sample = SAMPLE_REPOS.find(
          (s) => s.bundle.meta.fullName.toLowerCase() === clean.toLowerCase(),
        )
        if (sample) {
          void runBundle(sample.bundle, sample.id)
        } else {
          void handleScanRepo(clean)
        }
      }
    } catch {
      // ignore
    }
  }, [handleScanRepo, runBundle])

  return (
    <div className="min-h-screen">
      <SiteHeader
        variant={variant}
        sdkStatus={experiment.sdkStatus}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((open) => !open)}
      />

      <main id="top" className="mx-auto max-w-6xl px-4 pt-8 pb-52 sm:px-6 sm:pt-12">
        {!result ? (
          <section className="animate-fade-up mx-auto max-w-3xl pb-8 text-center">
            <span className="chip border-brand-500/30 bg-brand-500/10 text-brand-300">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              Toggle Wars · Flagsmith experimentation hackathon
            </span>
            <h1 className="mt-5 text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Ship your repo{' '}
              <span className="bg-gradient-to-r from-brand-300 to-sky-300 bg-clip-text text-transparent">
                like it matters.
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-balance text-[15px] leading-relaxed text-zinc-400 sm:text-base">
              ShipCheck scores any GitHub README 0–100 across 8 launch checks, then shows exactly
              what to fix. Paste a repo URL, drop in a README, or one-click a sample. No signup, no
              backend.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="chip">
                <Zap className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
                Instant score
              </span>
              <span className="chip">
                <ShieldCheck className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                Runs in your browser
              </span>
              <span className="chip">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                {isGuided ? 'Fix snippets unlocked' : 'Diagnostic checklist'}
              </span>
            </div>
          </section>
        ) : (
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
              <ArrowRight className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
              Readiness report
            </div>
            <div className="flex items-center gap-2">
              {bundle?.meta.fullName && bundle.meta.source !== 'paste' && (
                <CopyButton
                  text={`${window.location.origin}${window.location.pathname}?repo=${encodeURIComponent(bundle.meta.fullName)}`}
                  label="Copy share link"
                  copiedLabel="Link copied"
                  variant="secondary"
                  size="sm"
                  title="Copy a direct share link with ?repo= query parameter"
                />
              )}
              <button
                type="button"
                onClick={resetScan}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800/70 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-brand-500/50 hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                New scan
              </button>
            </div>
          </div>
        )}

        <ScanForm
          busy={busy}
          activeSampleId={activeSampleId}
          onScanRepo={(input) => {
            void handleScanRepo(input)
          }}
          onScanPaste={handleScanPaste}
          onScanSample={handleScanSample}
        />

        {error && (
          <div
            role="alert"
            className="animate-fade-up mt-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-amber-200">{error.message}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-200/70">{error.hint}</p>
            </div>
          </div>
        )}

        {busy && !result && (
          <div className="mt-6 space-y-3" aria-live="polite">
            <div className="card flex items-center gap-3 p-5">
              <Loader2 className="h-5 w-5 animate-spin text-brand-400" aria-hidden="true" />
              <span className="text-sm text-zinc-400">
                Fetching README, scoring 8 launch checks, resolving Flagsmith variation…
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-xl border border-ink-700/60 bg-ink-900/40" />
              ))}
            </div>
          </div>
        )}

        {result && bundle && (() => {
          const failedChecks = result.checks.filter((c) => !c.passed)
          const passedChecks = result.checks.filter((c) => c.passed)

          return (
            <div ref={resultsRef} className="mt-6 scroll-mt-24 space-y-5">
              <ScoreHeader
                analysis={result}
                bundle={bundle}
                variant={variant}
                onCopyReport={handleCopyReport}
                onCopyAllFixes={handleCopyAllFixes}
              />

              <section aria-label="Readiness checks">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold tracking-wide text-zinc-200 uppercase">
                      Readiness checks
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {isGuided
                        ? 'Failing checks appear first. Open any check to preview its Markdown fix, then copy it into your README.'
                        : 'Failing checks appear first. Each explains the gap and its severity. Copy the checklist summary to work through offline.'}
                    </p>
                  </div>
                  <span className="mono text-[11px] text-zinc-500">
                    {result.passedCount}/{result.checks.length} passed · {result.score}/100
                  </span>
                </div>

                <div className="space-y-2.5">
                  {failedChecks.map((check, index) => (
                    <CheckCard
                      key={check.id}
                      check={check}
                      variant={variant}
                      index={index}
                      defaultExpanded={isGuided && index === 0}
                      onFixCopied={handleFixCopied}
                    />
                  ))}
                </div>

                {passedChecks.length > 0 && (
                  <div className="mt-4 rounded-xl border border-ink-800 bg-ink-950/40 p-3 sm:p-4">
                    <button
                      type="button"
                      onClick={() => setPassedOpen((open) => !open)}
                      className="flex w-full items-center justify-between text-left text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
                      aria-expanded={passedOpen}
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-brand-400" aria-hidden="true" />
                        <span>Passed checks ({passedChecks.length})</span>
                        <span className="rounded-md border border-brand-500/30 bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-300">
                          All criteria met
                        </span>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-zinc-400 transition-transform ${passedOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                    <div className={`space-y-2.5 ${passedOpen ? 'mt-3.5' : 'hidden'}`}>
                      {passedChecks.map((check, index) => (
                        <CheckCard
                          key={check.id}
                          check={check}
                          variant={variant}
                          index={failedChecks.length + index}
                          onFixCopied={handleFixCopied}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-700/60 bg-ink-900/40 px-4 py-3 text-[11px] text-zinc-500">
                <span>
                  Scored deterministically in the browser · {result.maxScore} points across 8 checks
                </span>
                <span className="flex items-center gap-1.5">
                  <FlaskConical className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
                  {isGuided
                    ? 'guided_fix: copy actions feed fix_action_completed'
                    : 'control: report export feeds fix_action_completed'}
                </span>
              </div>
            </div>
          )
        })()}

        {!result && !busy && <EmptyState variant={variant} />}

        <footer className="mt-14 border-t border-ink-800/80 pt-6 text-[11px] leading-relaxed text-zinc-600">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <p className="max-w-2xl">
              <span className="font-semibold text-zinc-400">ShipCheck</span> — built for Toggle
              Wars: The Flagsmith Experimentation Hackathon, Track 01 “Test Something Real”.
              Scores are heuristic launch guidance, not a grade of your code.
            </p>
            <p className="max-w-md sm:text-right">
              Traffic disclosure: <code className="mono text-zinc-500">scripts/simulate_traffic.mjs</code>{' '}
              generates synthetic events for pipeline verification only. Experiment results shown
              in Flagsmith count real scans and real copy actions from this app.
            </p>
          </div>
        </footer>
      </main>

      <ExperimentInspector
        open={inspectorOpen}
        onToggle={() => setInspectorOpen((open) => !open)}
        visitorId={experiment.visitorId}
        variant={variant}
        sdkStatus={experiment.sdkStatus}
        exposureRecorded={experiment.exposureRecorded}
        exposureTimestamp={experiment.exposureTimestamp}
        inExperiment={experiment.inExperiment}
        conversionRecorded={experiment.conversionRecorded}
        conversionSent={experiment.conversionSent}
        conversionTimestamp={experiment.conversionTimestamp}
        hasKey={experiment.hasKey}
        previewOverride={experiment.previewOverride}
        onResetVisitor={experiment.resetVisitor}
      />
    </div>
  )
}
