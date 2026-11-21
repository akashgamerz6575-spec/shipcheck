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
await page.goto('https://shipcheck-lime.vercel.app', {
  waitUntil: 'networkidle2',
})

const before = await page.evaluate(() => {
  return {
    bodyText: document.body.innerText.slice(0, 200),
    sdkStatus: document.body.innerText.includes('Connected') ? 'Connected' : 'Not Connected',
  }
})
console.log('Initial page state:', before)

// Click API Tool sample button
await page.waitForSelector('button[title="PulseAPI — webhook normalizer (partial README)"]')
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim().startsWith('API Tool'))
  btn?.click()
})
await page.waitForSelector('[data-check-id="problem"]', { timeout: 15000 })
await new Promise((r) => setTimeout(r, 1000))

const data = await page.evaluate(() => {
  const inspector = document.querySelector('[aria-label="Flagsmith experiment inspector"]')
  return {
    scoreText: document.querySelector('[aria-label="Readiness score"]')?.textContent ?? '',
    exposure: inspector?.getAttribute('data-exposure'),
    variant: inspector?.getAttribute('data-variant'),
    inspectorContent: inspector?.textContent ?? '',
  }
})

console.log('Live Vercel Deployment Test:', data)
await browser.close()
