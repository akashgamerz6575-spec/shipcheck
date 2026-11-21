# AGENTS.md — Autonomous Solo Build Contract (Toggle Wars: Flagsmith Experimentation Hackathon)

You are acting as a senior full-stack engineer executing a **one-shot autonomous build** for **Toggle Wars: The Flagsmith Experimentation Hackathon** (WeMakeDevs x Flagsmith, Nov 26–29, 2026).

## 1. Locked Decisions (Do NOT Ask the User to Re-Decide)
- **Track:** Track 01 — *Test Something Real* ($2,000 cash prize).
- **Project Name:** **ShipCheck** — Instant GitHub Repo & README Readiness Checker for hackathon and open-source launches.
- **Core Stack:** React 19 + TypeScript + Vite + Tailwind CSS v4 + `@flagsmith/flagsmith` (`^12.4.0`). Zero backend server or database required; runs cleanly on free static hosting (Vercel, Netlify, or Render).
- **Experiment Hypothesis:**
  > Adding an instant one-click copyable README fix snippet next to each failing readiness check (`guided_fix`) will increase the share of visitors who act on their scan (`fix_action_completed`) compared to a static diagnostic checklist (`control`).
- **Flagsmith Configuration:**
  - **Multivariate Flag:** `fix_workflow_mode`
  - **Control Value:** `control`
  - **Variant Value:** `guided_fix` (MUST have variation key `guided_fix` — never leave key blank!)
  - **Primary Metric:** `fix_action_completed` (`aggregation: "occurrence"`, `direction: "up"`, `event: "fix_action_completed"`)
  - **Traffic Split:** 100% rollout, 50% `control` / 50% `guided_fix`

## 2. Mandatory Reading Before Writing Any Code
1. Read `skills.md` (identical to `.agents/skills/flagsmith-experimentation/SKILL.md`) in full before running any Flagsmith CLI command or writing SDK code.
2. Read `tasks.md` in full and execute Phases 1 through 5 sequentially, updating checkboxes as each phase passes verification.

## 3. Hard Rules & Guardrails
1. **Zero Unnecessary Interruptions:** Do NOT ask clarifying questions unless `flagsmith login` has not been run yet or a CLI command returns an authentication/warehouse error. If `flagsmith` is not logged in, pause once, print the exact command (`flagsmith login`), wait for confirmation, and immediately resume.
2. **Never Use Flagsmith MCP to Start Experiments:** Per official Flagsmith docs (`https://docs.flagsmith.com/experimentation/set-up-with-a-coding-agent`), the Flagsmith MCP server cannot start experiments. Use **Flagsmith CLI v2+** (`flagsmith` / `flagsmith api ...`) exclusively.
3. **Never Commit Secrets:** Keep `.env` and `flagsmith.env` out of Git (add both to `.gitignore`). Ship `.env.example` with `VITE_FLAGSMITH_ENV_KEY=your_client_side_environment_key`.
4. **Strict Identity Continuity:** Generate one persistent anonymous `visitor_id` (`sc_<uuid>`) stored in `localStorage`. Pass that exact `visitor_id` to `flagsmith.identify(visitor_id)` BEFORE evaluating `fix_workflow_mode`, and pass the exact same identity when calling `flagsmith.trackEvent("fix_action_completed")`.
5. **Graceful Cold-Start Fallback:** Always configure a fallback default (`control`) if Flagsmith is unreachable or `VITE_FLAGSMITH_ENV_KEY` is missing, so the app never crashes during local preview or judging.
6. **Transparent Traffic Disclosure:** The traffic simulation script (`scripts/simulate_traffic.mjs`) is strictly for pipeline verification and demo testing. Document clearly in `README.md` how to separate simulated verification runs from real live user traffic.
7. **Judging Scorecard Alignment (Every Feature Must Serve These 4 Pillars):**
   - **Use of Flagsmith:** `fix_workflow_mode` controls a genuine product UX difference, records real exposures, tracks `fix_action_completed`, and displays live experiment telemetry in a collapsible Inspector drawer.
   - **Impact:** Analyzes any public GitHub repo URL (`owner/repo` or full URL) via the public GitHub API, PLUS supports direct `README.md` paste or 3 built-in sample repos so anyone (including judges) can test it in 1 click even if GitHub API is rate-limited.
   - **Creativity:** Clean, developer-grade UI with instant readiness score (0–100), 8 concrete launch checks, and (in `guided_fix`) context-aware copyable Markdown fix snippets.
   - **Demo Video Readiness:** Generate a ready-to-record 3-minute demo script (`DEMO_SCRIPT.md`) and a polished `README.md` explaining the hypothesis, architecture, Bayesian stats reading, and Flagsmith setup.

## 4. Definition of Done
Do not declare completion until ALL of the following pass:
- `npm run build` exits `0` with zero TypeScript or Vite errors.
- App runs cleanly on local dev server and renders both `control` and `guided_fix` modes cleanly (verified via `?preview_variant=` dev override disabled in production or via Flagsmith identity).
- Flagsmith flag `fix_workflow_mode` (with keyed variation `guided_fix`), metric `fix_action_completed`, and experiment are created and `running` (or exact one-command setup script `scripts/setup_flagsmith.sh` is ready if user is offline/unauthenticated).
- `scripts/simulate_traffic.mjs` runs cleanly and flushes events (`await flagsmith.flushEvents()`).
- `README.md` and `DEMO_SCRIPT.md` are complete and free of placeholder text.
