/**
 * ShipCheck readiness analyzer.
 *
 * Deterministic, dependency-free scoring of a repository README (plus optional
 * GitHub metadata) across 8 concrete launch checks worth 100 points total.
 * Every failing check returns a human explanation AND a ready-to-paste
 * Markdown fix snippet, which is what the `guided_fix` experiment arm exposes.
 */

export type CheckId =
  | 'problem'
  | 'quickstart'
  | 'demo'
  | 'visual'
  | 'env'
  | 'stack'
  | 'license'
  | 'usage'

export type Severity = 'critical' | 'high' | 'medium' | 'low'

export interface CheckDefinition {
  id: CheckId
  title: string
  points: number
  severity: Severity
  summary: string
}

export const CHECK_DEFINITIONS: readonly CheckDefinition[] = [
  {
    id: 'problem',
    title: 'Clear Problem Statement & Value Prop',
    points: 15,
    severity: 'critical',
    summary: 'A visitor should understand what this is and who it is for in 10 seconds.',
  },
  {
    id: 'quickstart',
    title: 'Quickstart / Local Setup Commands',
    points: 15,
    severity: 'critical',
    summary: 'Copy-paste commands that take someone from clone to running app.',
  },
  {
    id: 'demo',
    title: 'Live Demo Link or Demo Video',
    points: 15,
    severity: 'high',
    summary: 'A deployed URL or a short video removes all setup friction for reviewers.',
  },
  {
    id: 'visual',
    title: 'Architecture Diagram or Screenshot',
    points: 15,
    severity: 'high',
    summary: 'One image or diagram explains more than three paragraphs.',
  },
  {
    id: 'env',
    title: 'Environment Variables / Config Docs',
    points: 10,
    severity: 'medium',
    summary: 'Document required keys so the first run does not fail silently.',
  },
  {
    id: 'stack',
    title: 'Tech Stack & Prerequisites',
    points: 10,
    severity: 'medium',
    summary: 'State the language, runtime and versions a contributor needs.',
  },
  {
    id: 'license',
    title: 'Open-Source License Detection',
    points: 10,
    severity: 'medium',
    summary: 'A license tells companies and contributors they can legally use this.',
  },
  {
    id: 'usage',
    title: 'Usage Examples & Contribution Guide',
    points: 10,
    severity: 'low',
    summary: 'Show the primary API/CLI in action and how to contribute.',
  },
] as const

export const MAX_SCORE = CHECK_DEFINITIONS.reduce((total, check) => total + check.points, 0)

export interface RepoFacts {
  /** Display name, e.g. `acme/rocket`. Used to personalise fix snippets. */
  repoName: string
  description?: string | null
  homepage?: string | null
  license?: string | null
  language?: string | null
  topics?: string[]
}

export interface CheckResult extends CheckDefinition {
  passed: boolean
  /** Short, concrete explanation of what was found or what is missing. */
  explanation: string
  /** Markdown the user can paste straight into their README (failing checks only). */
  fixSnippet: string
}

export interface AnalysisResult {
  repoName: string
  score: number
  maxScore: number
  grade: string
  gradeLabel: string
  headline: string
  passedCount: number
  failedCount: number
  checks: CheckResult[]
  missingSections: CheckResult[]
  /** Combined Markdown block for "Copy all missing sections". */
  missingMarkdown: string
  /** Plain-text diagnostic report for the `control` arm. */
  checklistReport: string
}

const CODE_BLOCK = /```[\s\S]*?```/g

function lower(value: string): string {
  return value.toLowerCase()
}

function hasHeading(readme: string, pattern: RegExp): boolean {
  const headingLines = readme.split(/\r?\n/).filter((line) => /^\s{0,3}#{1,6}\s+/.test(line))
  return headingLines.some((line) => pattern.test(lower(line)))
}

function codeBlocks(readme: string): string[] {
  return readme.match(CODE_BLOCK) ?? []
}

function hasCodeCommand(readme: string, pattern: RegExp): boolean {
  return codeBlocks(readme).some((block) => pattern.test(lower(block)))
}

function countWords(readme: string): number {
  return readme
    .replace(CODE_BLOCK, ' ')
    .replace(/[#>*_`|[\]()!-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
}

/** Strip code blocks before looking for prose signals like images or links. */
function prose(readme: string): string {
  return readme.replace(CODE_BLOCK, ' ')
}

function firstMeaningfulParagraph(readme: string): string {
  const withoutTitle = readme
    .split(/\r?\n/)
    .filter((line) => !/^\s{0,3}#{1,6}\s+/.test(line))
    .join('\n')
    .replace(CODE_BLOCK, ' ')
  const paragraphs = withoutTitle
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0 && !/^[!\[<|]/.test(paragraph))
  return paragraphs[0] ?? ''
}

function detectStack(readme: string, facts: RepoFacts): string {
  const text = lower(readme)
  const known: Array<[RegExp, string]> = [
    [/next\.js|nextjs/, 'Next.js'],
    [/\breact\b/, 'React'],
    [/\bvue\b|nuxt/, 'Vue'],
    [/svelte/, 'Svelte'],
    [/typescript|\bts\b/, 'TypeScript'],
    [/tailwind/, 'Tailwind CSS'],
    [/\bvite\b/, 'Vite'],
    [/express/, 'Express'],
    [/fastapi/, 'FastAPI'],
    [/django/, 'Django'],
    [/\bflask\b/, 'Flask'],
    [/\bgo\b|golang/, 'Go'],
    [/rust|cargo/, 'Rust'],
    [/python/, 'Python'],
    [/postgres|supabase/, 'PostgreSQL'],
    [/docker/, 'Docker'],
  ]
  const detected = known.filter(([pattern]) => pattern.test(text)).map(([, label]) => label)
  if (detected.length === 0 && facts.language) detected.push(facts.language)
  return detected.length > 0 ? detected.slice(0, 3).join(' + ') : 'TypeScript + Node.js'
}

function detectInstallCommand(readme: string): string {
  const text = lower(readme)
  if (/pnpm (install|i|add)/.test(text)) return 'pnpm install'
  if (/yarn( install)?/.test(text)) return 'yarn install'
  if (/bun (install|i)/.test(text)) return 'bun install'
  if (/npm (install|i|ci)/.test(text)) return 'npm install'
  if (/pip install/.test(text)) return 'pip install -r requirements.txt'
  if (/poetry install/.test(text)) return 'poetry install'
  if (/cargo (build|run)/.test(text)) return 'cargo build'
  if (/go (mod|get|run|install)/.test(text)) return 'go mod download'
  return 'npm install'
}

function detectDevCommand(readme: string): string {
  const text = lower(readme)
  if (/pnpm (dev|start)/.test(text)) return 'pnpm dev'
  if (/yarn (dev|start)/.test(text)) return 'yarn dev'
  if (/bun (dev|run dev)/.test(text)) return 'bun run dev'
  if (/npm run dev/.test(text)) return 'npm run dev'
  if (/uvicorn/.test(text)) return 'uvicorn app.main:app --reload'
  if (/python .*manage\.py runserver/.test(text)) return 'python manage.py runserver'
  if (/cargo run/.test(text)) return 'cargo run'
  if (/go run/.test(text)) return 'go run .'
  return 'npm run dev'
}

function detectDefaultBranchUrl(facts: RepoFacts): string {
  return `https://github.com/${facts.repoName}`
}

function severityLabel(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return 'Critical'
    case 'high':
      return 'High'
    case 'medium':
      return 'Medium'
    case 'low':
      return 'Low'
  }
}

export { severityLabel }

/**
 * Run all 8 readiness checks. Pure function: same input always yields the same
 * score, which keeps the demo reproducible and the experiment clean.
 */
export function analyzeReadiness(readme: string, facts: RepoFacts): AnalysisResult {
  const text = lower(readme)
  const proseText = lower(prose(readme))
  const repoName = facts.repoName || 'your-org/your-repo'
  const stack = detectStack(readme, facts)
  const installCommand = detectInstallCommand(readme)
  const devCommand = detectDevCommand(readme)
  const repoUrl = detectDefaultBranchUrl({ ...facts, repoName })
  const words = countWords(readme)
  const firstParagraph = firstMeaningfulParagraph(readme)
  const firstParagraphWords = countWords(firstParagraph)

  // 1. Problem statement & value proposition (15)
  const problemHeading = hasHeading(
    readme,
    /(^|\s)(about|why|overview|problem|what is|motivation|introduction|the idea|features)\b/,
  )
  const problemFromDescription = (facts.description ?? '').trim().length >= 30
  const problemFromProse = firstParagraphWords >= 35
  const problemPassed = problemHeading || (problemFromDescription && problemFromProse)
  const problemExplanation = problemPassed
    ? problemHeading
      ? 'Found a dedicated overview section explaining the project.'
      : 'Repo description plus an opening paragraph explain the project clearly.'
    : firstParagraphWords > 0
      ? `The README opens without a clear "what/why" section (${words} words total, opening paragraph is ${firstParagraphWords} words).`
      : 'No descriptive introduction or overview section was detected.'

  const problemFix = `## Why ${repoName.split('/').pop() ?? 'this project'}?

<!-- One or two sentences: what problem does this solve, and who feels it? -->
${facts.description?.trim() || 'Describe the concrete pain this project removes. Example: "Shipping a side project should not take a weekend of README archaeology."'}

**Who it is for:** <!-- e.g. hackathon teams, OSS maintainers, platform engineers -->

**What you get:**
- <!-- outcome 1 -->
- <!-- outcome 2 -->
- <!-- outcome 3 -->

> ${repoName} turns that problem into a single, repeatable workflow.`

  // 2. Quickstart / local setup (15)
  const quickstartHeading = hasHeading(
    readme,
    /(quick ?start|getting started|installation|install|set ?up|setup|run locally|local development|development)/,
  )
  const installCommandPattern =
    /(npm (install|i|ci)|pnpm (install|i|add)|yarn( install)?|bun (install|i)|pip install|poetry install|cargo (build|run)|go (mod|get|run|install)|docker (run|compose)|git clone|make (install|setup|dev))/
  const quickstartCommand = hasCodeCommand(readme, installCommandPattern)
  const quickstartPassed = quickstartHeading && quickstartCommand
  const quickstartExplanation = quickstartPassed
    ? 'Quickstart section includes runnable install commands.'
    : quickstartHeading
      ? 'There is a setup heading but no runnable install command inside a code block.'
      : quickstartCommand
        ? 'Install commands exist but are not introduced by a clear Quickstart/Installation heading.'
        : 'No copy-paste installation commands were found.'

  const quickstartFix = `## Quickstart

\`\`\`bash
# 1. Clone
git clone ${repoUrl}.git
cd ${repoName.split('/').pop() ?? 'project'}

# 2. Install dependencies
${installCommand}

# 3. Configure (see Environment Variables)
cp .env.example .env

# 4. Run
${devCommand}
\`\`\`

Open <http://localhost:3000> and you should see the app running.

**Requirements:** ${stack}, Node.js 20+ (or the runtime listed under Tech Stack).`

  // 3. Live demo or video (15)
  const demoLinkPattern =
    /(https?:\/\/[^\s)]*(demo|vercel\.app|netlify\.app|github\.io|pages\.dev|render\.com|youtube\.com|youtu\.be|loom\.com|streamable\.com|asciinema\.org|figma\.com)[^\s)]*)/i
  const demoFromReadme = demoLinkPattern.test(prose(readme))
  const demoFromHomepage = Boolean(facts.homepage && /^https?:\/\//.test(facts.homepage))
  const demoPassed = demoFromReadme || demoFromHomepage
  const demoExplanation = demoPassed
    ? demoFromHomepage
      ? `Repository homepage points to a live demo: ${facts.homepage}`
      : 'A live demo, deployed URL, or demo video link is present.'
    : 'No deployed demo URL or demo video link was found.'

  const demoFix = `## Live Demo

**Try it now:** <!-- https://your-app.vercel.app -->

<!-- Optional but recommended: a 60-90 second Loom/YouTube walkthrough -->
[![Demo video](https://img.shields.io/badge/Watch-Demo%20Video-FF0000?logo=youtube&logoColor=white)](https://www.youtube.com/watch?v=REPLACE_ME)

> Judges and reviewers can test the deployed build without cloning anything.`

  // 4. Architecture / visual (15)
  const imagePattern = /!\[[^\]]*\]\([^)]+\)/g
  const images = (prose(readme).match(imagePattern) ?? []).filter(
    (image) =>
      !/shields\.io|badge|badgen\.net|travis|codecov|coveralls|circleci|github\.com\/.*\/actions|vercel\.com\/button|heroku\.com\/deploy|railway\.com\/button/i.test(
        image,
      ),
  )
  const mermaid = /```mermaid[\s\S]*?```/.test(text)
  const architectureHeading = hasHeading(
    readme,
    /(architecture|diagram|screenshots?|how it works|system design|under the hood)/,
  )
  const visualPassed = images.length > 0 || mermaid || architectureHeading
  const visualExplanation = visualPassed
    ? images.length > 0
      ? `Found ${images.length} embedded image${images.length === 1 ? '' : 's'} (screenshot or diagram).`
      : mermaid
        ? 'Found a Mermaid architecture diagram.'
        : 'Found an architecture/screenshot section.'
    : 'No screenshots, images, or architecture diagram were detected.'

  const visualFix = `## Architecture

\`\`\`mermaid
flowchart LR
  A[User] -->|scans repo| B[Web App]
  B -->|README + metadata| C[Readiness Analyzer]
  C --> D[Score 0-100]
  C --> E[Fix Snippets]
  B -->|exposure + conversion| F[Flagsmith Experiment]
\`\`\`

<!-- Replace with your real flow, then add a screenshot: -->
![${repoName} screenshot](./docs/screenshot.png)`

  // 5. Environment variables / config (10)
  const envPattern =
    /(\.env|environment variable|env var|env file|config(uration)? (file|option)|api[_ -]?key|secret[_ -]?key|access[_ -]?token|vite_|next_public_|process\.env|os\.environ)/
  const envTable = /\|\s*(name|variable|key)\s*\|[\s\S]{0,600}?\|\s*(description|required|default)\s*\|/i.test(
    readme,
  )
  const envBlock = codeBlocks(readme).some((block) => /^[A-Z][A-Z0-9_]{2,}=/m.test(block))
  const envPassed = envPattern.test(proseText) || envTable || envBlock
  const envExplanation = envPassed
    ? 'Environment variables or configuration options are documented.'
    : 'No environment variable or configuration documentation was found.'

  const envFix = `## Environment Variables

Create a \`.env\` file in the project root:

\`\`\`bash
cp .env.example .env
\`\`\`

| Variable | Required | Description |
| --- | --- | --- |
| \`DATABASE_URL\` | Yes | Connection string for the primary database. |
| \`API_KEY\` | Yes | Server-side API key. Never expose this in the browser. |
| \`VITE_PUBLIC_URL\` | No | Public base URL used by the frontend (defaults to localhost). |

> Only client-safe values should use a \`VITE_\` / \`NEXT_PUBLIC_\` prefix.`

  // 6. Tech stack & prerequisites (10)
  const stackHeading = hasHeading(
    readme,
    /(tech stack|technology stack|built with|stack|prerequisites|requirements|dependencies)/,
  )
  const stackBadges = /shields\.io\/badge\/(react|typescript|node|next|vite|python|go|rust|tailwind|docker)/i.test(
    readme,
  )
  const stackVersion = /(node(\.js)?\s*(>=|v)?\s*\d{2}|python\s*(>=|3\.)\s*\d|requires?\s+(node|python|go|rust)\s*\d)/i.test(
    text,
  )
  const stackPassed = stackHeading || stackBadges || stackVersion
  const stackExplanation = stackPassed
    ? 'Tech stack or runtime prerequisites are listed.'
    : 'No tech stack or prerequisite versions were listed.'

  const stackFix = `## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | ${stack} |
| Styling | Tailwind CSS |
| Hosting | Vercel / Netlify |
| Tooling | ESLint, Prettier, Vitest |

**Prerequisites**
- Node.js 20+ (or the runtime your project needs)
- <!-- e.g. Docker 24+ for local services -->
- <!-- e.g. a free API key from ... -->`

  // 7. License (10)
  const licenseFromMeta = Boolean(facts.license && facts.license.trim().length > 0)
  const licenseSection = hasHeading(readme, /(license|licence)/)
  const licenseName = /\b(mit|apache[- ]?2(\.0)?|gpl[- ]?3|gpl[- ]?2|bsd[- ]?3|bsd[- ]?2|isc|mpl[- ]?2|unlicense)\b/i.test(
    readme,
  )
  const licensePassed = licenseFromMeta || (licenseSection && licenseName) || licenseName
  const licenseExplanation = licensePassed
    ? licenseFromMeta
      ? `GitHub reports the license as ${facts.license}.`
      : 'A recognised open-source license is declared in the README.'
    : 'No license was detected in the repository metadata or README.'

  const licenseFix = `## License

MIT © <!-- year --> <!-- your name or org -->

<!-- Or replace with the license you actually intend to use. -->
See [LICENSE](./LICENSE) for the full text.`

  // 8. Usage examples & contribution (10)
  const usageHeading = hasHeading(readme, /(usage|examples?|how to use|api reference|contributing|development)/)
  const usageCode = codeBlocks(readme).some((block) =>
    /(curl |fetch\(|import .* from|require\(|npx |docker run|shipcheck |usage:)/i.test(block),
  )
  const contributingLink = /(contributing\.md|code_of_conduct|good first issue)/i.test(text)
  const usagePassed = (usageHeading && (usageCode || contributingLink)) || contributingLink
  const usageExplanation = usagePassed
    ? 'Usage examples and/or contribution guidance are present.'
    : 'No usage example or contribution guidance was found.'

  const usageFix = `## Usage

\`\`\`${facts.language?.toLowerCase() === 'python' ? 'python' : 'ts'}
// Minimal example
import { ${repoName.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'shipcheck'} } from '${repoName.split('/').pop() ?? 'your-package'}'

const result = await ${repoName.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'shipcheck'}.run()
console.log(result)
\`\`\`

## Contributing

Contributions are welcome!

1. Fork the repo and create a branch: \`git checkout -b feat/my-change\`
2. Install dependencies: \`${installCommand}\`
3. Run the dev server: \`${devCommand}\`
4. Open a PR using the template in \`.github/PULL_REQUEST_TEMPLATE.md\`

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and follow the Code of Conduct.`

  const rawResults: Array<Omit<CheckResult, keyof CheckDefinition>> = [
    { passed: problemPassed, explanation: problemExplanation, fixSnippet: problemFix },
    { passed: quickstartPassed, explanation: quickstartExplanation, fixSnippet: quickstartFix },
    { passed: demoPassed, explanation: demoExplanation, fixSnippet: demoFix },
    { passed: visualPassed, explanation: visualExplanation, fixSnippet: visualFix },
    { passed: envPassed, explanation: envExplanation, fixSnippet: envFix },
    { passed: stackPassed, explanation: stackExplanation, fixSnippet: stackFix },
    { passed: licensePassed, explanation: licenseExplanation, fixSnippet: licenseFix },
    { passed: usagePassed, explanation: usageExplanation, fixSnippet: usageFix },
  ]

  const checks: CheckResult[] = CHECK_DEFINITIONS.map((definition, index) => ({
    ...definition,
    ...rawResults[index],
  }))

  const passedChecks = checks.filter((check) => check.passed)
  const failedChecks = checks.filter((check) => !check.passed)
  const score = passedChecks.reduce((total, check) => total + check.points, 0)
  const { grade, gradeLabel } = gradeFor(score)
  const headline = headlineFor(score, failedChecks.length)
  const missingMarkdown = failedChecks
    .map(
      (check) =>
        `<!-- ShipCheck fix: ${check.title} (${check.points} pts) -->\n\n${check.fixSnippet}`,
    )
    .join('\n\n---\n\n')

  const checklistReport = [
    `ShipCheck readiness report — ${repoName}`,
    `Score: ${score}/${MAX_SCORE} (${gradeLabel})`,
    `Checks passed: ${passedChecks.length}/${checks.length}`,
    '',
    ...checks.map(
      (check) =>
        `${check.passed ? '[PASS]' : '[FAIL]'} ${check.title} (${check.points} pts, ${severityLabel(
          check.severity,
        )}) — ${check.explanation}`,
    ),
    '',
    failedChecks.length > 0
      ? 'Next step: work top-down on the failed checks. Critical items unlock the most points.'
      : 'All checks passed. Ship it.',
    '',
    'Generated with ShipCheck.',
  ].join('\n')

  return {
    repoName,
    score,
    maxScore: MAX_SCORE,
    grade,
    gradeLabel,
    headline,
    passedCount: passedChecks.length,
    failedCount: failedChecks.length,
    checks,
    missingSections: failedChecks,
    missingMarkdown,
    checklistReport,
  }
}

function gradeFor(score: number): { grade: string; gradeLabel: string } {
  if (score >= 90) return { grade: 'A', gradeLabel: 'Launch ready' }
  if (score >= 75) return { grade: 'B', gradeLabel: 'Almost there' }
  if (score >= 55) return { grade: 'C', gradeLabel: 'Needs polish' }
  if (score >= 30) return { grade: 'D', gradeLabel: 'Rough draft' }
  return { grade: 'F', gradeLabel: 'Not ready to ship' }
}

function headlineFor(score: number, failedCount: number): string {
  if (score >= 90) return 'Your README is launch-ready. Ship it before someone else does.'
  if (score >= 75) return `Strong README. ${failedCount} fixes away from a perfect launch page.`
  if (score >= 55) return `Solid start, but ${failedCount} gaps will cost you stars and contributors.`
  if (score >= 30) return `Reviewers will bounce. Fix the critical checks first.`
  return 'This README does not explain the project yet. Start with the problem statement.'
}

/** Quick lookup used by the UI to show check definitions before a scan. */
export function checkPreview(): CheckDefinition[] {
  return [...CHECK_DEFINITIONS]
}
