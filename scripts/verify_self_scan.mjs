import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const executableCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]
const executablePath = executableCandidates.find((c) => existsSync(c))
const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox'],
})
const page = await browser.newPage()

console.log('Navigating to live site with repo query...')
await page.goto('https://shipcheck-lime.vercel.app/?repo=akashgamerz6575-spec/shipcheck', {
  waitUntil: 'networkidle2',
  timeout: 30000,
})

try {
  await page.waitForSelector('[data-check-id="problem"]', { timeout: 20000 })

  const result = await page.evaluate(() => {
    const score = document.querySelector('[aria-label="Readiness score"]')?.textContent ?? ''
    const checks = [...document.querySelectorAll('[data-check-status]')].map((el) => ({
      id: el.getAttribute('data-check-id'),
      status: el.getAttribute('data-check-status'),
    }))
    const grade = document.querySelector('.text-2xl, .text-xl')?.textContent ?? ''
    return { score: score.replace(/\s+/g, ' ').trim(), grade, checks }
  })

  console.log('\n======================================================')
  console.log('  LIVE SCAN RESULT: akashgamerz6575-spec/shipcheck')
  console.log('======================================================')
  console.log('Score:', result.score)
  console.log('Checks count:', result.checks.length)
  for (const c of result.checks) {
    console.log(`  [${c.status?.toUpperCase()}] ${c.id}`)
  }
} catch (err) {
  console.error('Error waiting for selector:', err.message)
  const body = await page.evaluate(() => document.body.innerText)
  console.log('Page text snippet:\n', body.slice(0, 500))
} finally {
  await browser.close()
}
