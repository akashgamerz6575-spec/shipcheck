import { useState } from 'react'
import {
  ArrowRight,
  ClipboardPaste,
  Github,
  Loader2,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { parseRepoRef } from '../lib/github'
import { SAMPLE_REPOS, type SampleRepo } from '../data/samples'

type Tab = 'repo' | 'paste'

interface ScanFormProps {
  busy: boolean
  activeSampleId: string | null
  onScanRepo: (input: string) => void
  onScanPaste: (repoName: string, readme: string) => void
  onScanSample: (sample: SampleRepo) => void
}

export function ScanForm({
  busy,
  activeSampleId,
  onScanRepo,
  onScanPaste,
  onScanSample,
}: ScanFormProps) {
  const [tab, setTab] = useState<Tab>('repo')
  const [repoInput, setRepoInput] = useState('')
  const [pasteName, setPasteName] = useState('')
  const [pasteReadme, setPasteReadme] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  function submitRepo(event: React.FormEvent) {
    event.preventDefault()
    const parsed = parseRepoRef(repoInput)
    if (!parsed.ok) {
      setLocalError(parsed.error)
      return
    }
    setLocalError(null)
    onScanRepo(repoInput)
  }

  function submitPaste(event: React.FormEvent) {
    event.preventDefault()
    if (pasteReadme.trim().length < 20) {
      setLocalError('Paste at least a few lines of README so the analyzer has something to score.')
      return
    }
    setLocalError(null)
    onScanPaste(pasteName, pasteReadme)
  }

  return (
    <section className="card overflow-hidden" aria-label="Scan a repository">
      <div className="flex items-center gap-1 border-b border-ink-700/70 bg-ink-850/60 px-3 pt-3">
        <TabButton active={tab === 'repo'} onClick={() => setTab('repo')} icon={<Github className="h-4 w-4" />}>
          GitHub repo
        </TabButton>
        <TabButton
          active={tab === 'paste'}
          onClick={() => setTab('paste')}
          icon={<ClipboardPaste className="h-4 w-4" />}
        >
          Paste README
        </TabButton>
        <span className="ml-auto hidden items-center gap-1.5 pb-2 pr-1 text-[11px] text-zinc-500 sm:flex">
          <Sparkles className="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
          8 checks · 0–100 score · instant
        </span>
      </div>

      <div className="p-4 sm:p-6">
        {tab === 'repo' ? (
          <form onSubmit={submitRepo} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Github
                className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-zinc-500"
                aria-hidden="true"
              />
              <input
                value={repoInput}
                onChange={(event) => {
                  setRepoInput(event.target.value)
                  if (localError) setLocalError(null)
                }}
                placeholder="facebook/react  or  https://github.com/facebook/react"
                aria-label="GitHub repository"
                autoComplete="off"
                spellCheck={false}
                className="h-12 w-full rounded-xl border border-ink-600 bg-ink-950/70 pr-4 pl-11 font-mono text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-brand-500/70 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 text-sm font-semibold text-ink-950 shadow-[0_10px_30px_-14px_rgb(16_185_129/0.9)] transition-colors hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Wand2 className="h-4 w-4" aria-hidden="true" />
              )}
              {busy ? 'Scanning' : 'Scan repo'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitPaste} className="space-y-3">
            <input
              value={pasteName}
              onChange={(event) => setPasteName(event.target.value)}
              placeholder="Repo name for the report (optional) — e.g. acme/rocket"
              aria-label="Repository name"
              autoComplete="off"
              spellCheck={false}
              className="h-11 w-full rounded-xl border border-ink-600 bg-ink-950/70 px-4 font-mono text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-brand-500/70 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
            <textarea
              value={pasteReadme}
              onChange={(event) => {
                setPasteReadme(event.target.value)
                if (localError) setLocalError(null)
              }}
              rows={9}
              placeholder={'# Your Project\n\nPaste your README.md here…'}
              aria-label="README markdown"
              spellCheck={false}
              className="w-full resize-y rounded-xl border border-ink-600 bg-ink-950/70 px-4 py-3 font-mono text-[12.5px] leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-brand-500/70 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-zinc-500">
                Markdown only. Nothing is uploaded — analysis runs in your browser.
              </span>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-ink-950 transition-colors hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                )}
                Analyze README
              </button>
            </div>
          </form>
        )}

        {localError && (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {localError}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2 border-t border-ink-700/60 pt-4 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
            Or try a sample
          </span>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_REPOS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                disabled={busy}
                onClick={() => onScanSample(sample)}
                title={sample.tagline}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  activeSampleId === sample.id
                    ? 'border-brand-500/60 bg-brand-500/10 text-brand-300'
                    : 'border-ink-600 bg-ink-800/60 text-zinc-400 hover:border-brand-500/40 hover:text-zinc-100'
                }`}
              >
                {sample.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-zinc-600 sm:ml-auto">
            Works even when the GitHub API is rate limited
          </span>
        </div>
      </div>
    </section>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={active}
      role="tab"
      className={`relative flex items-center gap-2 rounded-t-lg px-3.5 py-2.5 text-xs font-semibold transition-colors ${
        active
          ? 'bg-ink-900 text-white'
          : 'text-zinc-500 hover:bg-ink-800/50 hover:text-zinc-300'
      }`}
    >
      {icon}
      {children}
      {active && (
        <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-400" aria-hidden="true" />
      )}
    </button>
  )
}
