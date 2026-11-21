---
name: flagsmith-experimentation
description: Exact Flagsmith CLI v2+, REST API, and React/JS SDK v12.4.0+ workflow for creating, instrumenting, starting, simulating, and reading Bayesian A/B experiments in Toggle Wars.
---

# Flagsmith Experimentation Skill (`skills.md`)

Use this exact playbook for all Flagsmith operations. All commands and SDK versions are grounded in official Flagsmith documentation:
- Experimentation Docs: https://docs.flagsmith.com/experimentation
- Coding Agent Setup: https://docs.flagsmith.com/experimentation/set-up-with-a-coding-agent
- Create Metrics: https://docs.flagsmith.com/experimentation/create-metrics
- Bayesian A/B Testing: https://www.flagsmith.com/blog/bayesian-a-b-testing

---

## 1. Minimum Verified Versions
- **Flagsmith CLI:** `v2` or later (`flagsmith --version`).
  - Install: `curl -fsSL https://get.flagsmith.com | sh` (macOS Homebrew: `brew install Flagsmith/tap/flagsmith`; fallback: `npm install -g @flagsmith/cli`).
- **JavaScript / React SDK:** `@flagsmith/flagsmith` `12.4.0+` (required for event collection).
- **Node.js SDK (for traffic simulator):** `@flagsmith/nodejs` `9.1.0+` (do NOT use legacy `flagsmith-nodejs`; it cannot send events).

---

## 2. CLI Setup & Experiment Creation Sequence (Exact Commands)

> **CRITICAL:** Do NOT use the Flagsmith MCP server — it cannot start experiments. Use `flagsmith` CLI v2+ and `flagsmith api`.

### Step A: Authenticate & Bind Repository
```bash
flagsmith --version
flagsmith login
flagsmith project list
flagsmith environment list --project <PROJECT_ID>
flagsmith init --project <PROJECT_ID> --environment <ENV_KEY>
```

### Step B: Verify Connected Data Warehouse
```bash
flagsmith api "api/v1/environments/<ENV_KEY>/warehouse-connections/"
```
If this returns an empty list, direct the user to enable the managed Flagsmith warehouse in Flagsmith Cloud (`Environment Settings -> Warehouse`) at `https://docs.flagsmith.com/experimentation/connect-a-warehouse` before starting the experiment.

### Step C: Create Multivariate Flag WITH Keyed Variation
> **PITFALL:** Every variation MUST have a `--key`. A variation without a key records **zero exposures**. `control` is reserved for the flag's default value, and `--variants` on `feature create` cannot set keys.

```bash
flagsmith feature create fix_workflow_mode --value control --enabled
flagsmith feature variant add fix_workflow_mode --value guided_fix --key guided_fix --weight 0
flagsmith feature get fix_workflow_mode --json
```
Extract `<FLAG_ID>` and `<VARIATION_ID>` from the JSON output.

### Step D: Create Occurrence Metric
```bash
flagsmith api "api/v1/environments/<ENV_KEY>/experiment-metrics/" --method POST --input - << 'EOF'
{
  "name": "Fix Action Completed",
  "aggregation": "occurrence",
  "direction": "up",
  "definition": {
    "version": 1,
    "event": "fix_action_completed"
  }
}
EOF
```
Extract `<METRIC_ID>` from the response. Event name `fix_action_completed` is **case-sensitive** and must match the SDK call verbatim.

### Step E: Create Experiment (Draft)
```bash
flagsmith api "api/v1/environments/<ENV_KEY>/experiments/" --method POST --input - << 'EOF'
{
  "feature": <FLAG_ID>,
  "name": "Guided Fix Snippets vs Static Checklist",
  "hypothesis": "Adding one-click copyable README fix snippets (guided_fix) increases developer action rate (fix_action_completed) over a static diagnostic checklist (control).",
  "metrics": [
    {
      "metric": <METRIC_ID>,
      "expected_direction": "increase"
    }
  ],
  "experiment_rollout": {
    "enabled": true,
    "rollout_percentage": 100,
    "feature_state_value": {
      "type": "string",
      "value": "control"
    },
    "multivariate_feature_state_values": [
      {
        "multivariate_feature_option": <VARIATION_ID>,
        "percentage_allocation": 50
      }
    ]
  }
}
EOF
```
Extract `<EXPERIMENT_ID>`. Note: starting the experiment locks the flag's values.

### Step F: Start Experiment (After SDK Code Is Wired)
```bash
flagsmith api "api/v1/environments/<ENV_KEY>/experiments/<EXPERIMENT_ID>/start/" --method POST
```
Confirm status is `running`.

### Step G: Refresh & Inspect Bayesian Results
> Note: Results refresh is rate-limited to once every 5 minutes.
```bash
flagsmith api "api/v1/environments/<ENV_KEY>/experiments/<EXPERIMENT_ID>/results/refresh/" --method POST
flagsmith api "api/v1/environments/<ENV_KEY>/experiments/<EXPERIMENT_ID>/results/"
```

---

## 3. React / TypeScript SDK Instrumentation Pattern

1. Generate and persist a deterministic anonymous visitor ID in `localStorage` (`shipcheck_visitor_id`) before calling Flagsmith.
2. Initialize `@flagsmith/flagsmith` (`^12.4.0`) with `enableEvents: true` (or `FlagsmithProvider` with `options={{ environmentID, identity: visitorId, enableEvents: true }}`).
3. Evaluate the experiment flag **only at the moment the user sees the scan result** using `getExperimentFlag("fix_workflow_mode")` (or `useExperiment("fix_workflow_mode")` in React) so exposures reflect real scans rather than bounces.
4. When the user clicks **Copy Fix Snippet** (in `guided_fix`) or **Copy Checklist / Export Markdown** (in `control`), call:
   ```ts
   flagsmith.trackEvent("fix_action_completed");
   await flagsmith.flushEvents();
   ```
5. Register a `pagehide` / `beforeunload` handler calling `flagsmith.flushEvents()` so buffered events are never lost on tab close.

---

## 4. Troubleshooting Checklist
- **0 exposures recorded:** Check that (a) variation `guided_fix` has `--key guided_fix`, (b) `identify(visitorId)` ran BEFORE `getExperimentFlag`, and (c) `flushEvents()` / `close()` was called before script exit.
- **0 conversions counted:** Check that (a) event name is literally `fix_action_completed` (exact case), and (b) conversion uses the exact same `visitor_id` as the exposure.
- **Reading results for judges:** Report BOTH **win probability** and the **95% credible interval** for lift. If the credible interval still crosses 0%, explicitly state that direction is promising but more real traffic is needed before rolling out 100%.
