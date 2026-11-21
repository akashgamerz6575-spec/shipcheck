/**
 * Deterministic analyzer regression check.
 *
 * Run with: node scripts/verify_analyzer.mjs
 * Node 22.18+/24 strips TypeScript types natively, so no build step is needed.
 */
import assert from 'node:assert/strict'
import { analyzeReadiness, CHECK_DEFINITIONS, MAX_SCORE } from '../src/lib/analyzer.ts'
import { SAMPLE_REPOS } from '../src/data/samples.ts'
import { parseRepoRef } from '../src/lib/github.ts'

const EXPECTED = {
  'hackathon-starter': { score: 75, failed: ['visual', 'license'] },
  'api-tool': { score: 70, failed: ['demo', 'visual'] },
  'minimal-repo': { score: 25, failed: ['problem', 'demo', 'visual', 'env', 'stack', 'usage'] },
}

assert.equal(CHECK_DEFINITIONS.length, 8, 'expected exactly 8 checks')
assert.equal(MAX_SCORE, 100, 'expected the rubric to total 100 points')

for (const sample of SAMPLE_REPOS) {
  const facts = {
    repoName: sample.bundle.meta.fullName,
    description: sample.bundle.meta.description,
    homepage: sample.bundle.meta.homepage,
    license: sample.bundle.meta.license,
    language: sample.bundle.meta.language,
    topics: sample.bundle.meta.topics,
  }
  const analysis = analyzeReadiness(sample.bundle.readme, facts)
  const expected = EXPECTED[sample.id]
  assert.ok(expected, `no expectation for ${sample.id}`)
  assert.equal(analysis.checks.length, 8, `${sample.id}: expected 8 checks`)
  assert.equal(analysis.score, expected.score, `${sample.id}: unexpected score`)
  assert.deepEqual(
    analysis.missingSections.map((check) => check.id).sort(),
    [...expected.failed].sort(),
    `${sample.id}: unexpected failing checks`,
  )
  assert.equal(
    analysis.score,
    analysis.checks.filter((check) => check.passed).reduce((sum, check) => sum + check.points, 0),
    `${sample.id}: score must equal the sum of passed check points`,
  )
  for (const check of analysis.missingSections) {
    assert.ok(check.fixSnippet.length > 40, `${sample.id}/${check.id}: fix snippet too short`)
    assert.match(check.fixSnippet, /^## /, `${sample.id}/${check.id}: fix snippet must start with a heading`)
  }

  // Determinism: identical input must produce an identical score + report.
  const again = analyzeReadiness(sample.bundle.readme, facts)
  assert.equal(again.score, analysis.score, `${sample.id}: analyzer is not deterministic`)
  assert.equal(again.checklistReport, analysis.checklistReport, `${sample.id}: report drifted`)

  console.log(
    `ok  ${sample.bundle.meta.fullName.padEnd(30)} score=${String(analysis.score).padStart(3)}/100  passed=${analysis.passedCount}/8  failing=${analysis.failedCount}`,
  )
}

const parserCases = [
  ['facebook/react', 'facebook/react'],
  ['https://github.com/facebook/react', 'facebook/react'],
  ['https://github.com/facebook/react.git', 'facebook/react'],
  ['github.com/vercel/next.js/tree/canary', 'vercel/next.js'],
  ['  https://github.com/owner/repo/  ', 'owner/repo'],
]
for (const [input, expected] of parserCases) {
  const parsed = parseRepoRef(input)
  assert.ok(parsed.ok, `expected ${input} to parse`)
  assert.equal(`${parsed.ref.owner}/${parsed.ref.repo}`, expected, `parse mismatch for ${input}`)
}
assert.equal(parseRepoRef('not a repo').ok, false, 'garbage input should be rejected')
assert.equal(parseRepoRef('').ok, false, 'empty input should be rejected')
console.log(`ok  GitHub ref parser: ${parserCases.length} valid forms + 2 rejected forms`)

console.log('\nAll analyzer assertions passed.')
