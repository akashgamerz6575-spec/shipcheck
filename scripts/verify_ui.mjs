/**
 * Browser-level verification for both experiment arms.
 *
 * Dev:  node scripts/verify_ui.mjs --base=http://localhost:5173 --mode=dev
 * Prod: node scripts/verify_ui.mjs --base=http://localhost:4173 --mode=prod
 *
 * Uses the locally installed Chrome/Edge through puppeteer-core (no browser
 * download). Captures screenshots into docs/screenshots/ in dev mode.
 */
import { mkdirSync } from 'node:fs'
import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const args = process.argv.slice(2)
const baseArg = args.find((arg) => arg.startsWith('--base='))
const modeArg = args.find((arg) => arg.startsWith('--mode='))
const base = baseArg ? baseArg.split('=')[1] : 'http://localhost:5173'
const mode = modeArg ? modeArg.split('=')[1] : 'dev'

const executableCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]
const executablePath = executableCandidates.find((candidate) => existsSync(candidate))
if (!executablePath) {
  console.error('No Chrome/Edge executable found.')
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
})

try {
  await browser.defaultBrowserContext().overridePermissions(base, [
    'clipboard-read',
    'clipboard-write',
  ])

  if (mode === 'dev') {
    mkdirSync('docs/screenshots', { recursive: true })
  }

  const variants = mode === 'dev' ? ['control', 'guided_fix'] : ['control']

  for (const variant of variants) {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 })

    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })

    const url = `${base}/?preview_variant=${variant}`
    let loaded = false
    for (let attempt = 0; attempt < 30 && !loaded; attempt += 1) {
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 5000 })
        loaded = true
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
    assert(loaded, `Could not load ${url} — is the server running?`)

    // Run a scan on the partial README sample so both arms have failures.
    await page.waitForSelector('button[title="PulseAPI — webhook normalizer (partial README)"]', {
      timeout: 15000,
    })
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((element) =>
        element.textContent?.trim().startsWith('API Tool'),
      )
      if (!button) throw new Error('API Tool sample button not found')
      button.click()
    })

    await page.waitForSelector('[data-check-id="problem"]', { timeout: 20000 })
    await new Promise((resolve) => setTimeout(resolve, 600))

    const snapshot = await page.evaluate(() => {
      const inspector = document.querySelector('[aria-label="Flagsmith experiment inspector"]')
      const bodyText = document.body.innerText
      return {
        inspectorVariant: inspector?.getAttribute('data-variant') ?? null,
        exposure: inspector?.getAttribute('data-exposure') ?? null,
        conversion: inspector?.getAttribute('data-conversion') ?? null,
        scoreText: document.querySelector('[aria-label="Readiness score"]')?.textContent ?? '',
        fixButtons: [...document.querySelectorAll('button')].filter((button) =>
          button.textContent?.includes('Copy fix snippet'),
        ).length,
        checklistButton: [...document.querySelectorAll('button')].some(
          (button) =>
            button.textContent?.includes('Copy Checklist Summary') ||
            button.textContent?.includes('Copy checklist report'),
        ),
        snippetText: bodyText.includes('Copy all 2 missing sections'),
        failedChecks: document.querySelectorAll('[data-check-status="fail"]').length,
        passedChecks: document.querySelectorAll('[data-check-status="pass"]').length,
      }
    })

    const expectedVariant = mode === 'dev' ? variant : 'control'
    assert(
      snapshot.inspectorVariant === expectedVariant,
      `${mode}: expected variant ${expectedVariant}, got ${snapshot.inspectorVariant}`,
    )
    assert(snapshot.scoreText.includes('70'), `expected a 70/100 score, got "${snapshot.scoreText}"`)
    assert(snapshot.failedChecks === 2, `expected 2 failing checks, got ${snapshot.failedChecks}`)
    assert(snapshot.passedChecks === 6, `expected 6 passing checks, got ${snapshot.passedChecks}`)

    if (expectedVariant === 'control') {
      assert(snapshot.fixButtons === 0, 'control arm must not expose copyable fix snippets')
      assert(snapshot.checklistButton, 'control arm must expose the checklist report button')
    } else {
      assert(snapshot.fixButtons === 2, `guided_fix should expose 2 fix buttons, got ${snapshot.fixButtons}`)
      assert(snapshot.snippetText, 'guided_fix should expose the copy-all-missing-sections action')
      assert(!snapshot.checklistButton, 'guided_fix should not render the control checklist CTA')

      // Expand a snippet and copy it, which should record a conversion.
      await page.evaluate(() => {
        const button = [...document.querySelectorAll('button')].find((element) =>
          element.textContent?.includes('View fix snippet'),
        )
        if (!button) throw new Error('View fix snippet button not found')
        button.click()
      })
      await page.waitForSelector('pre', { timeout: 5000 })

      await page.evaluate(() => {
        const button = [...document.querySelectorAll('button')].find((element) =>
          element.textContent?.includes('Copy fix snippet'),
        )
        if (!button) throw new Error('Copy fix snippet button not found')
        button.click()
      })
      await new Promise((resolve) => setTimeout(resolve, 900))

      const afterCopy = await page.evaluate(() => {
        const inspector = document.querySelector('[aria-label="Flagsmith experiment inspector"]')
        return {
          conversion: inspector?.getAttribute('data-conversion') ?? null,
          copied: [...document.querySelectorAll('button')].some((button) =>
            button.textContent?.includes('Fix copied'),
          ),
        }
      })
      assert(afterCopy.copied, 'copy button should confirm "Fix copied"')
      assert(afterCopy.conversion === 'recorded', 'copy action should record a conversion in the inspector')
    }

    assert(errors.length === 0, `console/page errors: ${errors.join(' | ')}`)

    if (mode === 'dev') {
      // Capture a focused results-card image before normalising fixed elements.
      await page.evaluate(() => window.scrollTo(0, 0))
      await new Promise((resolve) => setTimeout(resolve, 250))
      const clip = await page.evaluate(() => {
        const inspector = document.querySelector(
          '[aria-label="Flagsmith experiment inspector"]',
        )
        if (inspector) inspector.style.display = 'none'
        const score = document.querySelector('[aria-label="Readiness score"]')
        if (!score) return null
        const rect = score.getBoundingClientRect()
        return {
          x: Math.max(0, rect.left - 16),
          y: Math.max(0, rect.top + window.scrollY - 12),
          width: Math.min(1440, rect.width + 32),
          height: 880,
        }
      })
      if (clip) {
        await page.screenshot({
          path: `docs/screenshots/${variant}-results.png`,
          clip,
        })
      }

      // Normalise fixed/sticky elements so the full-page capture is clean.
      await page.evaluate(() => {
        window.scrollTo(0, 0)
        const header = document.querySelector('header')
        if (header) header.style.position = 'static'
        const inspector = document.querySelector(
          '[aria-label="Flagsmith experiment inspector"]',
        )
        if (inspector) inspector.style.display = 'none'
      })
      await new Promise((resolve) => setTimeout(resolve, 250))
      await page.screenshot({
        path: `docs/screenshots/${variant}.png`,
        fullPage: true,
      })
    }

    console.log(
      `ok  ${mode} ${expectedVariant.padEnd(10)} score=70/100 failed=2 fixButtons=${snapshot.fixButtons}`,
    )
    await page.close()
  }

  // Paste-README path (dev only).
  if (mode === 'dev') {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
    await page.goto(base, { waitUntil: 'networkidle2' })
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((element) =>
        element.textContent?.includes('Paste README'),
      )
      if (!button) throw new Error('Paste README tab not found')
      button.click()
    })
    await page.waitForSelector('textarea[aria-label="README markdown"]')
    await page.type('input[aria-label="Repository name"]', 'acme/paste-demo')
    await page.type(
      'textarea[aria-label="README markdown"]',
      '# paste-demo\n\nA tiny tool that proves the paste path works.\n\n## Install\n\n```bash\nnpm install\n```\n\n## License\n\nMIT\n',
    )
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((element) =>
        element.textContent?.includes('Analyze README'),
      )
      if (!button) throw new Error('Analyze README button not found')
      button.click()
    })
    await page.waitForSelector('[data-check-id="problem"]', { timeout: 15000 })
    const pasteResult = await page.evaluate(() => ({
      score:
        document.querySelector('[aria-label="Readiness score"]')?.textContent ?? '',
      repo: document.body.innerText.includes('acme/paste-demo'),
    }))
    assert(pasteResult.score.includes('25'), `paste path should score 25, got "${pasteResult.score}"`)
    assert(pasteResult.repo, 'paste path should keep the supplied repo name')
    console.log('ok  dev paste-README path scores 25/100')
    await page.close()
  }

  // Deep-link ?repo= check (dev only).
  if (mode === 'dev') {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
    await page.goto(`${base}/?repo=pulse-labs/pulse-api`, { waitUntil: 'networkidle2' })
    await page.waitForSelector('[data-check-id="problem"]', { timeout: 15000 })
    const deepResult = await page.evaluate(() => ({
      score: document.querySelector('[aria-label="Readiness score"]')?.textContent ?? '',
      repo: document.body.innerText.includes('pulse-labs/pulse-api'),
      hasShareButton: [...document.querySelectorAll('button')].some((b) =>
        b.textContent?.includes('Copy share link'),
      ),
    }))
    assert(deepResult.score.includes('70'), `deep-link path should score 70, got "${deepResult.score}"`)
    assert(deepResult.repo, 'deep-link path should load the pulse-labs/pulse-api repo')
    assert(deepResult.hasShareButton, 'deep-link path should render "Copy share link" button')
    console.log('ok  dev deep-link ?repo= auto-scan + share button verified')
    await page.close()
  }

  // Mobile layout check (dev only).
  if (mode === 'dev') {
    const page = await browser.newPage()
    await page.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    })
    await page.goto(`${base}/?preview_variant=guided_fix`, { waitUntil: 'networkidle2' })
    await page.waitForSelector('button[title="PulseAPI — webhook normalizer (partial README)"]')
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((element) =>
        element.textContent?.trim().startsWith('API Tool'),
      )
      button?.click()
    })
    await page.waitForSelector('[data-check-id="problem"]')
    await new Promise((resolve) => setTimeout(resolve, 400))
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    assert(overflow <= 1, `mobile layout overflows horizontally by ${overflow}px`)
    await page.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: false })
    console.log('ok  dev mobile 390px layout without horizontal overflow')
    await page.close()
  }

  // Inspector drawer check (dev only, uses the guided arm screenshot page).
  if (mode === 'dev') {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
    await page.goto(`${base}/?preview_variant=guided_fix`, { waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 300))
    await page.screenshot({ path: 'docs/screenshots/hero.png', fullPage: false })
    await page.waitForSelector('button[title="PulseAPI — webhook normalizer (partial README)"]')
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((element) =>
        element.textContent?.trim().startsWith('API Tool'),
      )
      button?.click()
    })
    await page.waitForSelector('[data-check-id="problem"]')
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((element) =>
        element.textContent?.includes('Experiment Inspector'),
      )
      button?.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 500))
    const inspectorText = await page.evaluate(
      () =>
        document.querySelector('[aria-label="Flagsmith experiment inspector"]')?.textContent ?? '',
    )
    assert(inspectorText.includes('fix_workflow_mode'), 'inspector must show the flag name')
    assert(inspectorText.includes('fix_action_completed'), 'inspector must show the metric')
    assert(inspectorText.includes('50% control'), 'inspector must show the traffic split')
    assert(inspectorText.includes('Visitor identity'), 'inspector must show visitor identity')
    await page.screenshot({ path: 'docs/screenshots/inspector.png', fullPage: false })
    console.log('ok  dev inspector drawer telemetry + screenshot')
    await page.close()
  }

  console.log(`\nUI verification passed for ${mode} mode.`)
} finally {
  await browser.close()
}
