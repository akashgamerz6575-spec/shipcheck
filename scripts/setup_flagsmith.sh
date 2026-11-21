#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# ShipCheck — one-command Flagsmith experiment provisioning
#
# Creates, verifies and starts the `fix_workflow_mode` experiment used by the
# ShipCheck app. Idempotent: safe to re-run.
#
# Usage:
#   ENV_KEY=<environment_client_key> PROJECT_ID=<project_id> bash scripts/setup_flagsmith.sh
#
#   ENV_KEY may also come from FLAGSMITH_ENV_KEY, .env, or flagsmith.env.
#   PROJECT_ID is optional; when present the script also runs `flagsmith init`.
#
# Options:
#   SKIP_WAREHOUSE_CHECK=1   create the experiment even if no warehouse is linked
#   SKIP_START=1             create everything but leave the experiment in draft
#
# Exit codes: 0 success · 2 missing config · 3 not logged in · 4 warehouse
# ---------------------------------------------------------------------------
set -euo pipefail

FLAG_NAME="fix_workflow_mode"
CONTROL_VALUE="control"
VARIANT_KEY="guided_fix"
METRIC_NAME="Fix Action Completed"
EVENT_NAME="fix_action_completed"
EXPERIMENT_NAME="Guided Fix Snippets vs Static Checklist"
HYPOTHESIS="Adding one-click copyable README fix snippets (guided_fix) increases developer action rate (fix_action_completed) over a static diagnostic checklist (control)."

BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; CYAN=$'\033[36m'; RESET=$'\033[0m'

info()  { printf '%s\n' "${CYAN}▸${RESET} $*"; }
ok()    { printf '%s\n' "${GREEN}✓${RESET} $*"; }
warn()  { printf '%s\n' "${YELLOW}!${RESET} $*"; }
fail()  { printf '%s\n' "${RED}✗${RESET} $*"; }
title() { printf '\n%s\n' "${BOLD}$*${RESET}"; }

# ---------------------------------------------------------------------------
# 0. Resolve configuration
# ---------------------------------------------------------------------------
read_env_file() {
  local file="$1" key="$2" line value
  [ -f "$file" ] || return 1
  line="$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$file" | tail -n 1 || true)"
  [ -n "$line" ] || return 1
  value="${line#*=}"
  value="${value%$'\r'}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  value="${value#\"}"; value="${value%\"}"
  value="${value#\'}"; value="${value%\'}"
  printf '%s' "$value"
}

ENV_KEY="${ENV_KEY:-${FLAGSMITH_ENV_KEY:-}}"
PROJECT_ID="${PROJECT_ID:-}"
if [ -z "$ENV_KEY" ]; then
  ENV_KEY="$(read_env_file .env VITE_FLAGSMITH_ENV_KEY || true)"
fi
if [ -z "$ENV_KEY" ]; then
  ENV_KEY="$(read_env_file flagsmith.env FLAGSMITH_ENV_KEY || true)"
fi
if [ -z "$PROJECT_ID" ]; then
  PROJECT_ID="$(read_env_file flagsmith.env FLAGSMITH_PROJECT_ID || true)"
fi

title "ShipCheck · Flagsmith experiment provisioning"

if [ -z "$ENV_KEY" ]; then
  fail "Missing environment key."
  cat <<'EOF'
Set the client-side environment key for the environment you want to use:

  ENV_KEY=abc123 PROJECT_ID=1234 bash scripts/setup_flagsmith.sh

Find the key in Flagsmith Cloud → Project → Environment → SDK Keys.
(You can also put VITE_FLAGSMITH_ENV_KEY in .env.)
EOF
  exit 2
fi

# ---------------------------------------------------------------------------
# 1. CLI present + authenticated
# ---------------------------------------------------------------------------
if ! command -v flagsmith >/dev/null 2>&1; then
  if [ -n "${APPDATA:-}" ] && [ -d "${APPDATA}/npm" ]; then
    export PATH="$PATH:${APPDATA}/npm"
  elif [ -d "$HOME/AppData/Roaming/npm" ]; then
    export PATH="$PATH:$HOME/AppData/Roaming/npm"
  fi
fi

if ! command -v flagsmith >/dev/null 2>&1; then
  fail "Flagsmith CLI not found on PATH."
  cat <<'EOF'
Install it with one of:

  npm install -g @flagsmith/cli
  curl -fsSL https://get.flagsmith.com | sh
  brew install Flagsmith/tap/flagsmith   # macOS

Then authenticate and re-run this script:

  flagsmith login
EOF
  exit 3
fi

CLI_VERSION="$(flagsmith --version 2>/dev/null | tr -d '\r')"
info "Flagsmith CLI: ${CLI_VERSION:-unknown}"

AUTH_OUTPUT="$(flagsmith auth status --json 2>&1 || true)"
if printf '%s' "$AUTH_OUTPUT" | grep -qi 'not logged in\|no credential\|unauthorized\|401'; then
  fail "Flagsmith CLI is not authenticated."
  cat <<'EOF'

Run this once in your terminal, complete the browser flow, then re-run:

  flagsmith login

No experiment data has been written yet.
EOF
  exit 3
fi
ok "Authenticated with Flagsmith"

if [ -n "$PROJECT_ID" ]; then
  info "Binding repository to project ${PROJECT_ID} / environment ${ENV_KEY}"
  flagsmith init --project "$PROJECT_ID" --environment "$ENV_KEY" >/dev/null 2>&1 \
    && ok "flagsmith init complete" \
    || warn "flagsmith init failed (non-fatal; API calls continue)"
else
  warn "PROJECT_ID not set — skipping 'flagsmith init' (non-fatal)."
fi

# ---------------------------------------------------------------------------
# 2. Warehouse check (required for Bayesian experiment results)
# ---------------------------------------------------------------------------
if [ "${SKIP_WAREHOUSE_CHECK:-0}" = "1" ]; then
  warn "Skipping warehouse check (SKIP_WAREHOUSE_CHECK=1)."
else
  WAREHOUSE_JSON="$(flagsmith api "api/v1/environments/${ENV_KEY}/warehouse-connections/" 2>&1 || true)"

  if printf '%s' "$WAREHOUSE_JSON" | grep -qi '"detail"\|invalid environment\|not found\|unauthorized\|forbidden'; then
    fail "Could not read warehouse connections for this environment key."
    printf '  API response: %s\n' "$WAREHOUSE_JSON"
    echo "  Check that ENV_KEY is the client-side SDK key for the intended environment."
    exit 2
  fi

  WAREHOUSE_COUNT="$(node -e '
    let raw = "";
    process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
      try {
        const data = JSON.parse(raw);
        const list = Array.isArray(data) ? data : data.results || [];
        process.stdout.write(String(list.length));
      } catch {
        process.stdout.write("0");
      }
    });
  ' <<<"$WAREHOUSE_JSON" 2>/dev/null || echo "0")"

  if [ "${WAREHOUSE_COUNT:-0}" = "0" ]; then
    fail "No connected data warehouse found for environment ${ENV_KEY}."
    cat <<'EOF'
Flagsmith needs a warehouse to compute Bayesian experiment results.

Enable the managed Flagsmith warehouse once in the browser:
  Flagsmith Cloud → Environment Settings → Warehouse
  https://docs.flagsmith.com/experimentation/connect-a-warehouse

Then re-run this script. To create the flag/metric/experiment anyway:
  SKIP_WAREHOUSE_CHECK=1 bash scripts/setup_flagsmith.sh
EOF
    exit 4
  fi
  ok "Warehouse connected (${WAREHOUSE_COUNT} connection(s))"
fi

# ---------------------------------------------------------------------------
# 3. Multivariate flag with a KEYED variation
# ---------------------------------------------------------------------------
title "1/4 · Flag ${FLAG_NAME}"

if flagsmith feature list --json 2>/dev/null | grep -q "\"name\":[[:space:]]*\"${FLAG_NAME}\""; then
  ok "Flag already exists"
else
  info "Creating flag (default value: ${CONTROL_VALUE})"
  flagsmith feature create "$FLAG_NAME" --value "$CONTROL_VALUE" --enabled >/dev/null
  ok "Flag created"
fi

FLAG_JSON="$(flagsmith feature get "$FLAG_NAME" --json)"

VARIATION_ID="$(node -e '
  const data = JSON.parse(process.argv[1]);
  const target = "guided_fix";
  const seen = new Set();
  const walk = (node) => {
    if (!node || typeof node !== "object" || seen.has(node)) return undefined;
    seen.add(node);
    if (node.key === target && typeof node.id === "number") return node.id;
    for (const value of Object.values(node)) {
      const found = walk(value);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  const id = walk(data);
  if (id !== undefined) process.stdout.write(String(id));
' "$FLAG_JSON" 2>/dev/null || true)"

if [ -z "$VARIATION_ID" ]; then
  info "Adding variation ${VARIANT_KEY} with key=${VARIANT_KEY} (weight 0)"
  flagsmith feature variant add "$FLAG_NAME" \
    --value "$VARIANT_KEY" --key "$VARIANT_KEY" --weight 0 >/dev/null
  FLAG_JSON="$(flagsmith feature get "$FLAG_NAME" --json)"
  VARIATION_ID="$(node -e '
    const data = JSON.parse(process.argv[1]);
    const target = "guided_fix";
    const seen = new Set();
    const walk = (node) => {
      if (!node || typeof node !== "object" || seen.has(node)) return undefined;
      seen.add(node);
      if (node.key === target && typeof node.id === "number") return node.id;
      for (const value of Object.values(node)) {
        const found = walk(value);
        if (found !== undefined) return found;
      }
      return undefined;
    };
    const id = walk(data);
    if (id !== undefined) process.stdout.write(String(id));
  ' "$FLAG_JSON" 2>/dev/null || true)"
fi

if [ -z "$VARIATION_ID" ]; then
  fail "Could not confirm a keyed variation '${VARIANT_KEY}'."
  cat <<'EOF'
A variation without a key records ZERO exposures. Add it manually:

  flagsmith feature variant add fix_workflow_mode \
    --value guided_fix --key guided_fix --weight 0

Then re-run this script.
EOF
  exit 2
fi
ok "Keyed variation ${VARIANT_KEY} present (id=${VARIATION_ID})"

FLAG_ID="$(node -e '
  const data = JSON.parse(process.argv[1]);
  const seen = new Set();
  const walk = (node) => {
    if (!node || typeof node !== "object" || seen.has(node)) return undefined;
    seen.add(node);
    if (node.name === "fix_workflow_mode" && typeof node.id === "number") return node.id;
    for (const value of Object.values(node)) {
      const found = walk(value);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  const id = walk(data);
  if (id !== undefined) process.stdout.write(String(id));
' "$FLAG_JSON" 2>/dev/null || true)"

if [ -z "$FLAG_ID" ]; then
  fail "Could not read the numeric feature id from 'flagsmith feature get --json'."
  exit 2
fi
ok "Flag id=${FLAG_ID}"

# ---------------------------------------------------------------------------
# 4. Occurrence metric
# ---------------------------------------------------------------------------
title "2/4 · Metric ${EVENT_NAME}"

METRICS_JSON="$(flagsmith api "api/v1/environments/${ENV_KEY}/experiment-metrics/")"
METRIC_ID="$(node -e '
  const data = JSON.parse(process.argv[1]);
  const list = Array.isArray(data) ? data : data.results || [];
  const match = list.find(
    (metric) =>
      metric.definition?.event === "fix_action_completed" ||
      metric.name === "Fix Action Completed",
  );
  if (match) process.stdout.write(String(match.id));
' "$METRICS_JSON" 2>/dev/null || true)"

if [ -z "$METRIC_ID" ]; then
  info "Creating occurrence metric"
  METRIC_JSON="$(flagsmith api "api/v1/environments/${ENV_KEY}/experiment-metrics/" --method POST --input - <<'EOF'
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
)"
  METRIC_ID="$(node -e '
    const data = JSON.parse(process.argv[1]);
    const id = data.id ?? data.metric?.id;
    if (id !== undefined) process.stdout.write(String(id));
  ' "$METRIC_JSON" 2>/dev/null || true)"
else
  ok "Metric already exists (id=${METRIC_ID})"
fi

if [ -z "$METRIC_ID" ]; then
  fail "Could not create or find the ${EVENT_NAME} metric."
  exit 2
fi
ok "Metric id=${METRIC_ID} (occurrence, direction up)"

# ---------------------------------------------------------------------------
# 5. Experiment (draft)
# ---------------------------------------------------------------------------
title "3/4 · Experiment"

EXPERIMENTS_JSON="$(flagsmith api "api/v1/environments/${ENV_KEY}/experiments/")"
EXPERIMENT_ID="$(node -e '
  const data = JSON.parse(process.argv[1]);
  const list = Array.isArray(data) ? data : data.results || [];
  const match = list.find((experiment) => experiment.name === "Guided Fix Snippets vs Static Checklist");
  if (match) process.stdout.write(String(match.id));
' "$EXPERIMENTS_JSON" 2>/dev/null || true)"

if [ -z "$EXPERIMENT_ID" ]; then
  info "Creating experiment (100% rollout, 50/50 split)"
  EXPERIMENT_JSON="$(flagsmith api "api/v1/environments/${ENV_KEY}/experiments/" --method POST --input - <<EOF
{
  "feature": ${FLAG_ID},
  "name": "${EXPERIMENT_NAME}",
  "hypothesis": "${HYPOTHESIS}",
  "metrics": [
    {
      "metric": ${METRIC_ID},
      "expected_direction": "increase"
    }
  ],
  "experiment_rollout": {
    "enabled": true,
    "rollout_percentage": 100,
    "feature_state_value": {
      "type": "string",
      "value": "${CONTROL_VALUE}"
    },
    "multivariate_feature_state_values": [
      {
        "multivariate_feature_option": ${VARIATION_ID},
        "percentage_allocation": 50
      }
    ]
  }
}
EOF
)"
  EXPERIMENT_ID="$(node -e '
    const data = JSON.parse(process.argv[1]);
    const id = data.id ?? data.experiment?.id;
    if (id !== undefined) process.stdout.write(String(id));
  ' "$EXPERIMENT_JSON" 2>/dev/null || true)"
  [ -n "$EXPERIMENT_ID" ] && ok "Experiment created (id=${EXPERIMENT_ID})"
else
  ok "Experiment already exists (id=${EXPERIMENT_ID})"
fi

if [ -z "$EXPERIMENT_ID" ]; then
  fail "Could not create or find the experiment."
  exit 2
fi

# ---------------------------------------------------------------------------
# 6. Start
# ---------------------------------------------------------------------------
title "4/4 · Start"

STATUS="$(flagsmith api "api/v1/environments/${ENV_KEY}/experiments/${EXPERIMENT_ID}/" 2>/dev/null | node -e '
  let raw = "";
  process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
    try {
      const data = JSON.parse(raw);
      process.stdout.write(String(data.status ?? data.experiment?.status ?? "unknown"));
    } catch {
      process.stdout.write("unknown");
    }
  });
' 2>/dev/null || echo "unknown")"

if [ "$STATUS" = "running" ]; then
  ok "Experiment already running"
elif [ "${SKIP_START:-0}" = "1" ]; then
  warn "SKIP_START=1 — experiment left in status '${STATUS}'."
else
  info "Starting experiment (current status: ${STATUS})"
  flagsmith api "api/v1/environments/${ENV_KEY}/experiments/${EXPERIMENT_ID}/start/" --method POST >/dev/null
  ok "Experiment start requested"
fi

# ---------------------------------------------------------------------------
# 7. Persist the client key locally (gitignored)
# ---------------------------------------------------------------------------
if [ -f .env ]; then
  TMP_ENV="$(mktemp)"
  grep -v '^VITE_FLAGSMITH_ENV_KEY=' .env > "$TMP_ENV" || true
  printf 'VITE_FLAGSMITH_ENV_KEY=%s\n' "$ENV_KEY" >> "$TMP_ENV"
  mv "$TMP_ENV" .env
else
  printf 'VITE_FLAGSMITH_ENV_KEY=%s\n' "$ENV_KEY" > .env
fi
ok "Wrote VITE_FLAGSMITH_ENV_KEY to .env (gitignored)"

printf '\n%s\n' "${BOLD}Summary${RESET}"
cat <<EOF
  Flag:       ${FLAG_NAME}  (id ${FLAG_ID})
  Variation:  ${VARIANT_KEY} (keyed, id ${VARIATION_ID})
  Metric:     ${EVENT_NAME} (id ${METRIC_ID})
  Experiment: ${EXPERIMENT_NAME} (id ${EXPERIMENT_ID})
  Split:      50% ${CONTROL_VALUE} / 50% ${VARIANT_KEY}, 100% rollout

  Dashboard:  https://app.flagsmith.com/project/${PROJECT_ID:-<PROJECT_ID>}
  Results:
    flagsmith api "api/v1/environments/${ENV_KEY}/experiments/${EXPERIMENT_ID}/results/refresh/" --method POST
    flagsmith api "api/v1/environments/${ENV_KEY}/experiments/${EXPERIMENT_ID}/results/"

  Next: npm run build && npm run dev
        node scripts/simulate_traffic.mjs --yes
EOF
printf '\n%s\n' "${GREEN}${BOLD}Flagsmith experiment provisioned.${RESET}"
