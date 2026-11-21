import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const repo = process.argv[2] || 'akashgamerz6575-spec/codecheck'
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

console.log(`Scanning ${repo} on live ShipCheck...`)
await page.goto(`https://shipcheck-lime.vercel.app/?repo=${encodeURIComponent(repo)}`, {
  waitUntil: 'networkidle2',
  timeout: 30000,
})

await page.waitForSelector('[data-check-id="problem"]', { timeout: 20000 })
const result = await page.evaluate(() => {
  const score = document.querySelector('[aria-label="Readiness score"]')?.textContent ?? ''
  const checks = [...document.querySelectorAll('[data-check-status]')].map((el) => ({
    id: el.getAttribute('data-check-id'),
    status: el.getAttribute('data-check-status'),
  }))
  return { score: score.replace(/\s+/g, ' ').trim(), checks }
})

console.log('\n==============================================')
console.log(`  SHIPCHECK RESULT: ${repo}`)
console.log('==============================================')
console.log('Score:', result.score)
console.log(`Passed: ${result.checks.filter((c) => c.status === 'pass').length}/${result.checks.length}`)
for (const c of result.checks) {
  console.log(`  [${c.status.toUpperCase()}] ${c.id}`)
}

await browser.close()
