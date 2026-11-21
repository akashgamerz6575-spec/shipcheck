/**
 * GitHub REST API client for ShipCheck.
 *
 * Uses only public, unauthenticated endpoints, so it works from a static site.
 * Unauthenticated requests are rate limited (60/hour/IP) — the UI offers paste
 * mode and built-in samples so a scan never dead-ends.
 */

export interface RepoMeta {
  owner: string
  name: string
  fullName: string
  description: string | null
  stars: number
  language: string | null
  license: string | null
  homepage: string | null
  topics: string[]
  defaultBranch: string
  htmlUrl: string
  source: 'github' | 'sample' | 'paste'
  updatedAt?: string
}

export interface RepoBundle {
  meta: RepoMeta
  readme: string
}

export interface RepoRef {
  owner: string
  repo: string
}

export type ParseResult =
  | { ok: true; ref: RepoRef }
  | { ok: false; error: string }

const GITHUB_URL = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)/i
const SHORT_REF = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/

/** Accept `owner/repo`, full GitHub URLs, `.git` suffixes, and deep links. */
export function parseRepoRef(input: string): ParseResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, error: 'Enter a GitHub repository such as `owner/repo` or a full GitHub URL.' }
  }

  const urlMatch = trimmed.match(GITHUB_URL)
  if (urlMatch) {
    const owner = urlMatch[1]
    const repo = urlMatch[2].replace(/\.git$/i, '')
    if (!owner || !repo) {
      return { ok: false, error: 'That GitHub URL is missing an owner or repository name.' }
    }
    return { ok: true, ref: { owner, repo } }
  }

  const shortMatch = trimmed.replace(/\.git$/i, '').match(SHORT_REF)
  if (shortMatch) {
    return { ok: true, ref: { owner: shortMatch[1], repo: shortMatch[2] } }
  }

  return {
    ok: false,
    error: 'Could not parse that repository. Use `owner/repo` or `https://github.com/owner/repo`.',
  }
}

export class GithubScanError extends Error {
  readonly hint: string
  constructor(message: string, hint: string) {
    super(message)
    this.name = 'GithubScanError'
    this.hint = hint
  }
}

interface GithubRepoResponse {
  name: string
  full_name: string
  description: string | null
  stargazers_count: number
  language: string | null
  homepage: string | null
  topics?: string[]
  default_branch: string
  html_url: string
  updated_at: string
  license: { spdx_id?: string | null; name?: string | null } | null
  owner: { login: string }
}

function githubHeaders(): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function readError(response: Response): Promise<GithubScanError> {
  if (response.status === 404) {
    return new GithubScanError(
      'Repository not found on GitHub.',
      'Check the spelling, or the repo may be private. Paste the README directly instead.',
    )
  }
  if (response.status === 403 || response.status === 429) {
    const reset = response.headers.get('x-ratelimit-reset')
    const resetText = reset
      ? new Date(Number(reset) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'in about an hour'
    return new GithubScanError(
      'GitHub API rate limit reached for this IP.',
      `The public API allows 60 requests/hour per IP and resets ${resetText}. Use a sample repo or paste your README to keep scanning.`,
    )
  }
  if (response.status === 451) {
    return new GithubScanError(
      'GitHub blocked this repository for legal reasons.',
      'Try a different repository or paste the README directly.',
    )
  }
  return new GithubScanError(
    `GitHub responded with HTTP ${response.status}.`,
    'Try again in a moment, use a sample repo, or paste the README directly.',
  )
}

/** Fetch repo metadata + raw README in one scan. */
export async function fetchRepoBundle(ref: RepoRef): Promise<RepoBundle> {
  const base = `https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`

  let metaResponse: Response
  try {
    metaResponse = await fetch(base, { headers: githubHeaders() })
  } catch {
    throw new GithubScanError(
      'Could not reach the GitHub API.',
      'Check your network connection, use a built-in sample, or paste the README directly.',
    )
  }

  if (!metaResponse.ok) {
    throw await readError(metaResponse)
  }

  const repo = (await metaResponse.json()) as GithubRepoResponse

  let readmeResponse: Response
  try {
    readmeResponse = await fetch(`${base}/readme`, {
      headers: { ...githubHeaders(), Accept: 'application/vnd.github.raw' },
    })
  } catch {
    throw new GithubScanError(
      'Repository found, but the README request failed.',
      'Check your network connection or paste the README directly.',
    )
  }

  if (readmeResponse.status === 404) {
    throw new GithubScanError(
      'This repository has no README.',
      'ShipCheck needs a README to analyze. Paste a draft in the Paste README tab to score it before committing.',
    )
  }
  if (!readmeResponse.ok) {
    throw await readError(readmeResponse)
  }

  const readme = await readmeResponse.text()
  if (!readme.trim()) {
    throw new GithubScanError(
      'The README on GitHub is empty.',
      'Paste a draft README in the Paste README tab to score it.',
    )
  }

  const license = repo.license?.spdx_id && repo.license.spdx_id !== 'NOASSERTION'
    ? repo.license.spdx_id
    : repo.license?.name ?? null

  return {
    readme,
    meta: {
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      stars: repo.stargazers_count,
      language: repo.language,
      license,
      homepage: repo.homepage || null,
      topics: repo.topics ?? [],
      defaultBranch: repo.default_branch,
      htmlUrl: repo.html_url,
      source: 'github',
      updatedAt: repo.updated_at,
    },
  }
}

/** Build a bundle from a pasted README. */
export function bundleFromPaste(repoName: string, readme: string): RepoBundle {
  const parsed = parseRepoRef(repoName)
  const owner = parsed.ok ? parsed.ref.owner : 'pasted'
  const name = parsed.ok ? parsed.ref.repo : repoName.trim() || 'readme-draft'
  return {
    readme,
    meta: {
      owner,
      name,
      fullName: `${owner}/${name}`,
      description: null,
      stars: 0,
      language: null,
      license: null,
      homepage: null,
      topics: [],
      defaultBranch: 'main',
      htmlUrl: `https://github.com/${owner}/${name}`,
      source: 'paste',
    },
  }
}

export function formatStars(stars: number): string {
  if (stars >= 1000) {
    return `${(stars / 1000).toFixed(stars >= 10000 ? 0 : 1)}k`
  }
  return String(stars)
}
