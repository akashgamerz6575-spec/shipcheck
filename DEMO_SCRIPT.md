# ShipCheck — 3-minute demo script

**Target runtime: 2:45–2:55.** Record at 1440×900, browser zoom 110%, bookmarks bar hidden.
Every section maps to one of the four judging criteria, in order.

---

## Pre-flight checklist (5 minutes before recording)

- [ ] `npm run build` is green, then `npm run preview` is running at `http://localhost:4173` — record the **production build**, not the dev server.
- [ ] `.env` contains a valid `VITE_FLAGSMITH_ENV_KEY` and the Flagsmith SDK connects. The header shows **Flagsmith Live** and the Inspector says **Connected to Flagsmith**.
- [ ] The Flagsmith experiment `Guided Fix Snippets vs Static Checklist` is **running** with a 50 / 50 split and the keyed `guided_fix` variation.
- [ ] Two browser profiles (or one profile plus an incognito window) are open so you can show **both** arms without re-bucketing on camera.
- [ ] Tab 1: ShipCheck. Tab 2: Flagsmith → Experiments → this experiment.
- [ ] Results have been refreshed in the last five minutes so the dashboard has numbers to read.
- [ ] The “API Tool” sample is the scan target: it scores **70/100** with exactly two failures (Live Demo, Architecture), which is the cleanest story.
- [ ] Do a silent 20-second rehearsal of the scan + copy action so the clipboard permission prompt is already granted.

> If GitHub rate-limits the room, do not fight it. Click the **API Tool** sample and say: “Samples are built in so a rate-limited API never kills the demo.”

---

## 0:00 – 0:18 · The problem

**On screen:** ShipCheck hero (`docs/screenshots/hero.png` framing).

**Say:**

> “Hackathon judges and open-source visitors decide in about ten seconds whether a repo is worth trying. Most READMEs lose them before the first install command: no demo, no architecture, no setup path. ShipCheck scores that readiness from 0 to 100 in one scan — and it is also a live Flagsmith experiment.”

**Point at:** the three chips — instant score, runs in your browser, no signup.

---

## 0:18 – 0:42 · Scan in the control arm

**Do:** confirm the Inspector says `control`. Click **API Tool**. Wait for the 70/100 ring.

**Say:**

> “This is the control arm: a static diagnostic checklist. Eight weighted checks, 100 points. This repo passes six and fails two — Live Demo and Architecture — each with a severity and a concrete explanation.”

**Point at:** the score ring, “6 passed · 2 failed”, the two red cards.

**Do:** click **Copy checklist report**. The button flips to “Checklist copied”.

**Say:**

> “In control, the action is exporting the report. That copy fires our primary metric, `fix_action_completed`.”

---

## 0:42 – 1:10 · Show the experiment plumbing

**Do:** open the **Experiment Inspector** drawer.

**Say:**

> “Every scan is a real exposure. The visitor id — `sc_` plus a UUID — is persisted in localStorage, passed to `flagsmith.identify()` before the flag is evaluated, and reused for the conversion. Same identity for exposure and event, which is what makes the metric trustworthy.”

**Point at:** Visitor identity, `fix_workflow_mode → control`, **Exposure recorded**, **Conversion recorded / sent**, the hypothesis, and the 50 / 50 split.

**Do:** close the drawer.

---

## 1:10 – 1:40 · The guided_fix arm

**Do:** switch to the second browser profile (already bucketed into `guided_fix`), or click **New Visitor Session** and scan again until the Inspector says `guided_fix`.

**Say:**

> “Now the treatment arm. Same repo, same score, same checks — the only difference is the fix is one click away.”

**Do:** click **View fix snippet** on “Live Demo”, then **Copy fix snippet**. Show the Markdown block with the copy confirmation.

**Say:**

> “A ready-to-paste Markdown section, already personalised with the repo name and stack. Copying it fires the same `fix_action_completed` event, so the comparison is apples to apples: does removing friction change whether people act?”

**Do:** point at **Copy all 2 missing sections**.

---

## 1:40 – 2:10 · Flagsmith dashboard

**Do:** switch to the Flagsmith tab: **Experiments → Guided Fix Snippets vs Static Checklist**.

**Say:**

> “In Flagsmith: the multivariate flag `fix_workflow_mode` with a keyed `guided_fix` variation — the key matters, because a variation without a key records zero exposures. The occurrence metric `fix_action_completed`, direction up. The experiment is running at 100% rollout with a 50 / 50 split.”

**Point at:** the flag name, the variation **key** `guided_fix`, the metric, the status badge **Running**.

---

## 2:10 – 2:32 · Read the Bayesian results honestly

**Do:** scroll to the results panel.

**Say:**

> “Flagsmith gives us a Bayesian read: win probability plus a 95% credible interval for lift. If the interval sits entirely above zero, the direction is credible and we roll `guided_fix` out to 100%. If it still crosses zero, the honest answer is ‘promising, keep collecting real traffic’ — not ‘we won’. The app is instrumented either way: the flag controls the entire fix workflow, so switching the rollout is a one-line change in Flagsmith, not a redeploy.”

**Point at:** win probability, the interval bounds, and the per-variant conversion rates.

**Important:** if synthetic verification events exist, say so out loud: “The simulator is labelled synthetic in its metadata; these live numbers come from real scans.”

---

## 2:32 – 2:55 · Architecture, impact, close

**Do:** switch back to ShipCheck, scroll to the footer / show the README architecture diagram.

**Say:**

> “React 19 and Vite on the front, a deterministic eight-check analyzer, the public GitHub API, and the Flagsmith JS SDK with events enabled. No backend, no database — it deploys to Vercel or Netlify as static files. Identity is anonymous, events flush on page hide, and if Flagsmith is unreachable the app falls back to `control` instead of breaking. That is ShipCheck: a real product, a real hypothesis, and a real Flagsmith experiment measuring whether better fix delivery makes developers act.”

**End card:** repo URL + “ShipCheck — Toggle Wars Track 01”.

---

## Fallback lines

| If this breaks | Say this | Do this |
| --- | --- | --- |
| GitHub API rate limit | “Samples are built in so the demo never depends on GitHub.” | Click **API Tool** |
| Flagsmith unreachable | “The app degrades to the control fallback by design.” | Show the Inspector’s fallback badge, then the dashboard |
| No live results yet | “The experiment is running; Bayesian results need real traffic before the interval is meaningful.” | Show the running experiment + exposure/conversion counters |
| Clipboard blocked | “Copy uses a legacy fallback for insecure contexts.” | Click again; the button confirms “Copied” |

---

## Do not say

- Do not call simulated traffic “users” or “visitors”.
- Do not claim statistical significance from the simulator.
- Do not promise a specific lift percentage that is not on screen.
- Do not describe the score as a code-quality grade — it is launch-readiness guidance.
