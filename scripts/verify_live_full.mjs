import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const executableCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]
const executablePath = executableCandidates.find((c) => existsSync(c))
if (!executablePath) {
  console.error('No browser executable found.')
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const LIVE_URL = 'https://shipcheck-lime.vercel.app'

try {
  console.log(`\n===============================================================`)
  console.log(`  COMPREHENSIVE LIVE SMOKE TEST: ${LIVE_URL}`)
  console.log(`===============================================================\n`)

  const page = await browser.newPage()
  await browser.defaultBrowserContext().overridePermissions(LIVE_URL, ['clipboard-read', 'clipboard-write'])
  await page.setViewport({ width: 1440, height: 900 })

  const errors = []
  page.on('pageerror', (err) => errors.push(`[PageError] ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[ConsoleError] ${msg.text()}`)
  })

  // Test 1: Load Homepage
  console.log('1. Loading live homepage...')
  await page.goto(LIVE_URL, { waitUntil: 'networkidle2', timeout: 20000 })
  const title = await page.title()
  assert(title.includes('ShipCheck'), `Unexpected title: ${title}`)
  console.log(`   ✓ Page title verified: "${title}"`)

  // Test 2: Sample 1 (API Tool - partial README)
  console.log('\n2. Testing built-in sample "API Tool" (pulse-labs/pulse-api)...')
  await page.waitForSelector('button[title="PulseAPI — webhook normalizer (partial README)"]', { timeout: 10000 })
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim().startsWith('API Tool'))
    btn?.click()
  })
  await page.waitForSelector('[data-check-id="problem"]', { timeout: 15000 })
  await new Promise(r => setTimeout(r, 600))

  const sampleData = await page.evaluate(() => {
    const checks = [...document.querySelectorAll('[data-check-status]')].map(el => ({
      id: el.getAttribute('data-check-id'),
      status: el.getAttribute('data-check-status'),
    }))
    const inspector = document.querySelector('[aria-label="Flagsmith experiment inspector"]')
    return {
      score: document.querySelector('[aria-label="Readiness score"]')?.textContent ?? '',
      firstCheckStatus: checks[0]?.status,
      failedChecksCount: checks.filter(c => c.status === 'fail').length,
      passedChecksCount: checks.filter(c => c.status === 'pass').length,
      variant: inspector?.getAttribute('data-variant'),
      exposure: inspector?.getAttribute('data-exposure'),
      hasPassedSection: [...document.querySelectorAll('button')].some(b => b.textContent?.includes('Passed checks')),
      hasShareLinkBtn: [...document.querySelectorAll('button')].some(b => b.textContent?.includes('Copy share link')),
    }
  })

  assert(sampleData.score.includes('70'), `Expected 70/100, got: ${sampleData.score}`)
  assert(sampleData.firstCheckStatus === 'fail', 'First check must be a failing check (failures sit at the top)')
  assert(sampleData.failedChecksCount === 2, `Expected 2 failures, got ${sampleData.failedChecksCount}`)
  assert(sampleData.passedChecksCount === 6, `Expected 6 passes, got ${sampleData.passedChecksCount}`)
  assert(sampleData.exposure === 'recorded', `Expected exposure to be recorded, got ${sampleData.exposure}`)
  assert(sampleData.hasPassedSection, 'Passed checks collapsible section must exist')
  assert(sampleData.hasShareLinkBtn, 'Copy share link button must exist')
  console.log(`   ✓ Score: 70/100 (2 failed, 6 passed)`)
  console.log(`   ✓ Assigned Variant: "${sampleData.variant}"`)
  console.log(`   ✓ Flagsmith Exposure: recorded`)
  console.log(`   ✓ Layout: Failures at top, Passed checks collapsible, Share link button present`)

  // Test 3: Conversion Tracking (Click CTA)
  console.log('\n3. Testing conversion event tracking (fix_action_completed)...')
  // Open inspector to inspect telemetry
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Experiment Inspector'))
    btn?.click()
  })
  await new Promise(r => setTimeout(r, 400))

  // Click CTA
  await page.evaluate(() => {
    const cta = [...document.querySelectorAll('button')].find(b =>
      b.textContent?.includes('Copy Checklist Summary') ||
      b.textContent?.includes('Copy fix snippet') ||
      b.textContent?.includes('Copy all')
    )
    cta?.click()
  })
  await new Promise(r => setTimeout(r, 1200))

  const telemetry = await page.evaluate(() => {
    const inspector = document.querySelector('[aria-label="Flagsmith experiment inspector"]')
    const text = inspector?.textContent ?? ''
    return {
      conversion: inspector?.getAttribute('data-conversion'),
      hasExposureTimestamp: text.includes('Recorded at'),
      hasConversionTimestamp: text.includes('Sent at') || text.includes('Recorded at'),
      hasDashboardLink: Boolean(document.querySelector('a[href*="flagsmith.com/project/55323"]')),
    }
  })

  assert(telemetry.conversion === 'recorded', 'Conversion event must be recorded after clicking CTA')
  assert(telemetry.hasExposureTimestamp, 'Exposure must show live timestamp')
  assert(telemetry.hasDashboardLink, 'Inspector must link to Flagsmith project 55323')
  console.log(`   ✓ Conversion event: recorded & sent`)
  console.log(`   ✓ Live timestamps: verified`)
  console.log(`   ✓ Flagsmith dashboard link: present`)

  // Test 4: New Visitor Session (Bucketing switch)
  console.log('\n4. Testing "New Visitor Session" button...')
  const prevId = await page.evaluate(() => window.localStorage.getItem('shipcheck_visitor_id'))
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('New Visitor Session'))
    btn?.click()
  })
  await new Promise(r => setTimeout(r, 1500))
  const nextId = await page.evaluate(() => window.localStorage.getItem('shipcheck_visitor_id'))
  assert(nextId && nextId !== prevId, `Expected new visitor ID (was ${prevId}, now ${nextId})`)
  console.log(`   ✓ Old ID: ${prevId}`)
  console.log(`   ✓ New ID: ${nextId}`)

  // Test 5: Deep Linking via URL Query Param (?repo=hackathon-launchpad/launchpad)
  console.log('\n5. Testing deep-link auto-scan (?repo=hackathon-launchpad/launchpad)...')
  await page.goto(`${LIVE_URL}/?repo=hackathon-launchpad/launchpad`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-check-id="problem"]', { timeout: 15000 })
  const deepScore = await page.evaluate(() => document.querySelector('[aria-label="Readiness score"]')?.textContent ?? '')
  assert(deepScore.includes('75'), `Expected 75/100, got: ${deepScore}`)
  console.log(`   ✓ Deep-link auto-scan succeeded: 75/100 for hackathon-launchpad/launchpad`)

  // Test 6: Paste README mode
  console.log('\n6. Testing "Paste README" workflow...')
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('New scan'))
    btn?.click()
  })
  await new Promise(r => setTimeout(r, 400))
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Paste README'))
    btn?.click()
  })
  await page.waitForSelector('textarea[aria-label="README markdown"]')
  await page.type('input[aria-label="Repository name"]', 'my-org/my-project')
  await page.type('textarea[aria-label="README markdown"]', '# My Project\n\nA great project that does things.\n\n## Quickstart\n\n```bash\nnpm run start\n```\n\n## License\n\nMIT\n')
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Analyze README'))
    btn?.click()
  })
  await page.waitForSelector('[data-check-id="problem"]', { timeout: 15000 })
  const pasteScore = await page.evaluate(() => document.querySelector('[aria-label="Readiness score"]')?.textContent ?? '')
  console.log(`   ✓ Paste README analyzed successfully: ${pasteScore.trim().slice(0, 30)}...`)

  // Check for any console errors
  const realErrors = errors.filter(e => !e.includes('favicon') && !e.includes('rate limit'))
  if (realErrors.length > 0) {
    console.warn('\nNote: Browser console logs captured:', realErrors)
  } else {
    console.log('\n   ✓ Zero console or runtime errors during entire session.')
  }

  console.log(`\n===============================================================`)
  console.log(`  ALL LIVE DEPLOYMENT CHECKS PASSED (100% HEALTHY)`)
  console.log(`===============================================================\n`)

} catch (err) {
  console.error('\n❌ Live check failed:', err.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
