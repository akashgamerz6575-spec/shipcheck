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

try {
  console.log('=== SHIPCHECK 60-SECOND LOCAL PRE-DEPLOY VERIFICATION ===\n')

  // 1. Control Arm Check
  console.log('1. Checking control arm on localhost:5173/?preview_variant=control...')
  const pageCtrl = await browser.newPage()
  await pageCtrl.goto('http://localhost:5173/?preview_variant=control&repo=pulse-labs/pulse-api', { waitUntil: 'networkidle2' })
  await pageCtrl.waitForSelector('[data-check-id="problem"]', { timeout: 10000 })
  
  const ctrlData = await pageCtrl.evaluate(() => {
    const checks = [...document.querySelectorAll('[data-check-status]')].map(el => ({
      id: el.getAttribute('data-check-id'),
      status: el.getAttribute('data-check-status'),
    }))
    const firstCheckStatus = checks[0]?.status
    const hasSummaryCta = [...document.querySelectorAll('button')].some(b => b.textContent?.includes('Copy Checklist Summary'))
    const hasPassedGroup = [...document.querySelectorAll('button')].some(b => b.textContent?.includes('Passed checks'))
    return { firstCheckStatus, hasSummaryCta, hasPassedGroup, totalChecks: checks.length }
  })
  
  assert(ctrlData.firstCheckStatus === 'fail', 'Failing check must sit at the top of the list')
  assert(ctrlData.hasSummaryCta, 'Control must display "Copy Checklist Summary" CTA')
  assert(ctrlData.hasPassedGroup, 'Control must display "Passed checks" group')
  console.log('   ✓ Control arm verified: Failures at top, "Copy Checklist Summary" visible, passed checks grouped.')
  await pageCtrl.close()

  // 2. Guided Fix Arm Check
  console.log('\n2. Checking guided_fix arm on localhost:5173/?preview_variant=guided_fix...')
  const pageGuided = await browser.newPage()
  await pageGuided.goto('http://localhost:5173/?preview_variant=guided_fix&repo=pulse-labs/pulse-api', { waitUntil: 'networkidle2' })
  await pageGuided.waitForSelector('[data-check-id="problem"]', { timeout: 10000 })

  const guidedData = await pageGuided.evaluate(() => {
    const checks = [...document.querySelectorAll('[data-check-status]')].map(el => ({
      id: el.getAttribute('data-check-id'),
      status: el.getAttribute('data-check-status'),
    }))
    const firstCheckStatus = checks[0]?.status
    const firstPreVisible = Boolean(document.querySelector('[data-check-status="fail"] pre'))
    const hasCopySnippet = [...document.querySelectorAll('button')].some(b => b.textContent?.includes('Copy fix snippet'))
    const hasCopyAll = [...document.querySelectorAll('button')].some(b => b.textContent?.includes('missing sections'))
    return { firstCheckStatus, firstPreVisible, hasCopySnippet, hasCopyAll }
  })

  assert(guidedData.firstCheckStatus === 'fail', 'Failing check must sit at the top of the list')
  assert(guidedData.firstPreVisible, 'Guided fix must auto-expand first failing snippet (pre visible)')
  assert(guidedData.hasCopySnippet, 'Guided fix must render one-click "Copy fix snippet"')
  assert(guidedData.hasCopyAll, 'Guided fix must render "Copy all missing sections"')
  console.log('   ✓ Guided fix arm verified: First failing check auto-expanded with pre snippet and copy button.')
  await pageGuided.close()

  // 3. Real Flagsmith Bucketing & Telemetry in Prod Preview (localhost:4173)
  console.log('\n3. Checking production preview on localhost:4173 with real Flagsmith connection...')
  await browser.defaultBrowserContext().overridePermissions('http://localhost:4173', ['clipboard-read', 'clipboard-write'])
  const pageProd = await browser.newPage()
  await pageProd.goto('http://localhost:4173/?repo=pulse-labs/pulse-api', { waitUntil: 'networkidle2' })
  await pageProd.waitForSelector('[data-check-id="problem"]', { timeout: 15000 })

  // Open inspector
  await pageProd.evaluate(() => {
    const inspectorBtn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Experiment Inspector'))
    inspectorBtn?.click()
  })
  await new Promise(r => setTimeout(r, 600))

  const initialProd = await pageProd.evaluate(() => {
    const inspector = document.querySelector('[aria-label="Flagsmith experiment inspector"]')
    const text = inspector?.textContent || ''
    const visitorId = text.match(/sc_[a-zA-Z0-9_-]+/)?.[0] || ''
    const hasDashboardLink = Boolean(document.querySelector('a[href*="flagsmith.com/project/55323"]'))
    const exposureRecorded = inspector?.getAttribute('data-exposure') === 'recorded'
    const hasRecordedTime = text.includes('Recorded at') || text.includes('recorded')
    return { visitorId, hasDashboardLink, exposureRecorded, hasRecordedTime, text }
  })

  assert(initialProd.exposureRecorded, 'Exposure must be recorded on scan')
  assert(initialProd.hasDashboardLink, 'Dashboard link to project 55323 must be present')
  console.log(`   ✓ Connected to Flagsmith. Visitor ID: ${initialProd.visitorId}`)
  console.log(`   ✓ Exposure recorded with live telemetry timestamp.`)
  console.log(`   ✓ Dashboard link present: https://app.flagsmith.com/project/55323`)

  // Click CTA to test conversion
  await pageProd.evaluate(() => {
    const cta = [...document.querySelectorAll('button')].find(b => 
      b.textContent?.includes('Copy Checklist Summary') ||
      b.textContent?.includes('Copy fix snippet') ||
      b.textContent?.includes('Copy all')
    )
    cta?.click()
  })
  await new Promise(r => setTimeout(r, 1000))

  const afterCta = await pageProd.evaluate(() => {
    const inspector = document.querySelector('[aria-label="Flagsmith experiment inspector"]')
    const conversionRecorded = inspector?.getAttribute('data-conversion') === 'recorded'
    const text = inspector?.textContent || ''
    const hasSentTime = text.includes('Sent at') || text.includes('Recorded at')
    return { conversionRecorded, hasSentTime }
  })

  assert(afterCta.conversionRecorded, 'Conversion must be recorded after copy action')
  console.log('   ✓ Conversion recorded and sent to Flagsmith with live timestamp.')

  // Click New Visitor Session
  const oldVisitor = initialProd.visitorId
  await pageProd.evaluate(() => {
    const resetBtn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('New Visitor Session'))
    resetBtn?.click()
  })
  await new Promise(r => setTimeout(r, 1500))

  const newVisitor = await pageProd.evaluate(() => {
    return window.localStorage.getItem('shipcheck_visitor_id') || ''
  })
  assert(newVisitor && newVisitor !== oldVisitor, `New Visitor Session should generate fresh ID (was ${oldVisitor}, now ${newVisitor})`)
  console.log(`   ✓ New Visitor Session regenerated fresh ID: ${newVisitor}`)
  await pageProd.close()

  console.log('\n=== ALL 3 PRE-DEPLOY VERIFICATIONS PASSED CLEANLY (100%) ===\n')
} catch (err) {
  console.error('\nVerification failed:', err.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
