# tasks.md — Autonomous Execution Plan for ShipCheck (Toggle Wars Track 01)

Execute each phase in order. Mark `[x]` only after verifying the phase's acceptance criteria.

## Phase 1 — Scaffold & Core ShipCheck Application
- [x] Initialize Vite + React 19 + TypeScript + Tailwind CSS v4 project (`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `.env.example`).
- [x] Install dependencies: `@flagsmith/flagsmith@^12.4.0` (resolved 12.5.0), `lucide-react`, and dev dependency `@flagsmith/nodejs@^9.1.0` (resolved 9.4.0, for the traffic simulator).
- [x] Build `src/lib/analyzer.ts` — Deterministic repo & README readiness analyzer scoring 0–100 across **8 concrete checks**:
  1. Clear Problem Statement & Value Prop (15 pts)
  2. Quickstart / Local Setup Commands (15 pts)
  3. Live Demo Link or Demo Video URL (15 pts)
  4. Architecture / Visual Diagram or Screenshot (15 pts)
  5. Environment Variables / Config Documentation (10 pts)
  6. Tech Stack & Prerequisites List (10 pts)
  7. Open-Source License Detection (10 pts)
  8. Contribution / Usage Examples (10 pts)
  - Each failing check returns a concrete explanation AND a ready-to-paste Markdown fix snippet (`fixSnippet`).
- [x] Build `src/lib/github.ts` — Fetches `README.md` + repo metadata from GitHub REST API (`https://api.github.com/repos/{owner}/{repo}`) with clean error handling and 3 realistic built-in sample repos (including a Hackathon Starter, an API Tool, and a Minimal Repo) + a direct "Paste README.md" tab so scans never fail offline or under rate limits.
- [x] Build a clean, developer-grade UI (`src/App.tsx`, `src/components/`):
  - Input bar for GitHub URL (`owner/repo`) + Paste README mode + 1-click sample buttons.
  - Readiness Score Header (0–100 radial/bar indicator + pass/fail count).
  - **Control experience (`control`):** Clean diagnostic checklist with severity badges and a top-level "Copy Checklist Report" button (fires `fix_action_completed`).
  - **Variant experience (`guided_fix`):** Each failing check expands with a syntax-styled one-click **"Copy Fix Snippet"** button + "Copy All Missing Sections" button (each fires `fix_action_completed`).

**Phase 1 verification:** `npm run build` → exit 0. `node scripts/verify_analyzer.mjs` → 8 checks / 100 pts, sample scores 75/70/25, deterministic. `node scripts/verify_ui.mjs --mode=dev` → both arms render, fix buttons only in `guided_fix`, paste path scores 25/100.

## Phase 2 — Flagsmith SDK Instrumentation & Live Experiment Inspector
- [x] Build `src/lib/flagsmith.ts`:
  - Persistent `visitor_id` (`sc_<crypto.randomUUID()>`) in `localStorage` with a "New Visitor Session" button in the Inspector to test bucketing cleanly during demos.
  - Initializes `@flagsmith/flagsmith` with `enableEvents: true` and fallback `control` default when `VITE_FLAGSMITH_ENV_KEY` is absent.
  - Exposes `evaluateExperimentFlag()` (records exposure when a scan runs) and `trackFixCompleted()` (fires `fix_action_completed` + `flushEvents()`).
- [x] Build `src/components/ExperimentInspector.tsx`:
  - Collapsible bottom drawer showing: Active Visitor ID, Assigned Variation (`control` vs `guided_fix`), Exposure Recorded badge, Conversion Recorded badge, Experiment Hypothesis summary, and a "Reset Visitor ID" button for live demoing.

**Phase 2 verification:** Headless browser test asserts inspector `data-variant`, exposure attributes, conversion flip after a copy, and the flag/metric/split text. `?preview_variant=` works in dev and is ignored by the production build.

## Phase 3 — Flagsmith CLI Experiment Provisioning
- [x] Create `scripts/setup_flagsmith.sh` and `scripts/setup_flagsmith.ps1` automating Steps A–F from `skills.md` (CLI check, warehouse check, multivariate flag `fix_workflow_mode` + keyed variation `guided_fix`, metric `fix_action_completed`, experiment creation, and start).
- [x] Run provisioning script with authenticated Flagsmith CLI; create Project `ShipCheck` (id: 55323), Environment `Production` (SDK key: `FC3H3z2rADBZJZAiLe8q5A`), flag `fix_workflow_mode` (id: 299174), variation `guided_fix` (id: 36224), occurrence metric `fix_action_completed` (id: 315), experiment `Guided Fix Snippets vs Static Checklist` (id: 368, status: `running`), and write `VITE_FLAGSMITH_ENV_KEY` to `.env` (gitignored).

**Phase 3 verification:** All Flagsmith entities created and verified via Flagsmith CLI v2.0.0. Warehouse connection (id 10618) active. Experiment status confirmed `running`.

## Phase 4 — Traffic Simulation, Verification & Build Check
- [x] Create `scripts/simulate_traffic.mjs` using `@flagsmith/nodejs@^9.1.0`:
  - Simulates 200 unique visitor IDs (`sim_user_<n>`), evaluates `fix_workflow_mode`, records simulated conversions (~28% baseline on `control`, ~42% on `guided_fix` for pipeline sanity check), and calls `await flagsmith.close()`.
  - Prints a clear banner marking the run as synthetic pipeline verification.
  - Adds `simulated: true` + `run_id` metadata, explicit `--yes` confirmation, and `flushEvents()`.
- [x] Run `npm run build` and verify zero TypeScript/Vite errors.
- [x] Run `scripts/simulate_traffic.mjs --yes`, wait 60s, refresh experiment results via CLI, and print the live Flagsmith dashboard URL + Bayesian summary.

**Phase 4 verification:** `npm run build` exits 0. `node scripts/simulate_traffic.mjs --yes` processed 200 identities (103 control / 97 guided_fix, 73 total conversions, all flushed). Bayesian results refreshed via REST API (`as_of: 2026-11-21T09:39:13Z`, metric 315, 103 control / 97 guided_fix exposures). Dev & prod UI verification passed.

## Phase 5 — Submission-Ready README & Demo Video Script
- [x] Write a crisp, judge-ready `README.md` containing:
  - Problem statement & why ShipCheck exists
  - Exact A/B Hypothesis, Flag (`fix_workflow_mode`), Metric (`fix_action_completed`), and Architecture diagram (Mermaid)
  - Local run & Vercel/Netlify 1-click deploy instructions
  - Explicit section on reading Flagsmith's Bayesian win probability + 95% credible interval (with honest disclosure of any simulated vs real traffic)
- [x] Write `DEMO_SCRIPT.md` — a tight 2.5–3 minute screen-recording script hitting all 4 judging criteria (Problem → Live App & Both Variants → Flagsmith Dashboard & Bayesian Results → Architecture & Rollout).

**Phase 5 verification:** `README.md` and `DEMO_SCRIPT.md` contain no placeholder text; screenshots in `docs/screenshots/` are generated by the verification run.
