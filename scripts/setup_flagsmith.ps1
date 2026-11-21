<#
.SYNOPSIS
    ShipCheck - one-command Flagsmith experiment provisioning (PowerShell version)
.DESCRIPTION
    Creates, verifies and starts the `fix_workflow_mode` experiment used by ShipCheck.
    Idempotent: safe to re-run.
#>

[CmdletBinding()]
param(
    [string]$EnvKey = $env:ENV_KEY,
    [string]$ProjectId = $env:PROJECT_ID,
    [switch]$SkipWarehouseCheck = ($env:SKIP_WAREHOUSE_CHECK -eq '1'),
    [switch]$SkipStart = ($env:SKIP_START -eq '1')
)

$FlagName = "fix_workflow_mode"
$ControlValue = "control"
$VariantKey = "guided_fix"
$MetricName = "Fix Action Completed"
$EventName = "fix_action_completed"
$ExperimentName = "Guided Fix Snippets vs Static Checklist"
$Hypothesis = "Adding one-click copyable README fix snippets (guided_fix) increases developer action rate (fix_action_completed) over a static diagnostic checklist (control)."

function Info($msg) { Write-Host "▸ $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "✓ $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "! $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "✗ $msg" -ForegroundColor Red }
function Title($msg) { Write-Host "`n$msg" -ForegroundColor White }

# Helper to run flagsmith CLI cleanly without PowerShell NativeCommandError on stderr
function Run-Flagsmith([string]$cmdArgs) {
    $out = (cmd.exe /c "flagsmith $cmdArgs 2>&1") -join "`n"
    return $out.Trim()
}

# 0. Resolve configuration
function Read-EnvFile($path, $key) {
    if (-not (Test-Path $path)) { return $null }
    foreach ($line in (Get-Content $path)) {
        if ($line -match "^\s*$key\s*=\s*(.*)$") {
            $val = $matches[1].Trim()
            $val = $val -replace "^['""]|['""]$", ""
            if ($val) { return $val }
        }
    }
    return $null
}

if (-not $EnvKey) { $EnvKey = $env:FLAGSMITH_ENV_KEY }
if (-not $EnvKey) { $EnvKey = Read-EnvFile ".env" "VITE_FLAGSMITH_ENV_KEY" }
if (-not $EnvKey) { $EnvKey = Read-EnvFile "flagsmith.env" "FLAGSMITH_ENV_KEY" }
if (-not $ProjectId) { $ProjectId = Read-EnvFile "flagsmith.env" "FLAGSMITH_PROJECT_ID" }

Title "ShipCheck · Flagsmith experiment provisioning"

if (-not $EnvKey) {
    Fail "Missing environment key."
    Write-Host @"
Set the client-side environment key for the environment you want to use:

  .\scripts\setup_flagsmith.ps1 -EnvKey abc123 -ProjectId 1234
  or:
  ENV_KEY=abc123 PROJECT_ID=1234 bash scripts/setup_flagsmith.sh

Find the key in Flagsmith Cloud → Project → Environment → SDK Keys.
(You can also put VITE_FLAGSMITH_ENV_KEY in .env.)
"@
    exit 2
}

# 1. CLI present + authenticated
$cliCmd = Get-Command flagsmith -ErrorAction SilentlyContinue
if (-not $cliCmd) {
    Fail "Flagsmith CLI not found on PATH."
    Write-Host @"
Install it with:
  npm install -g @flagsmith/cli

Then authenticate and re-run this script:
  flagsmith login
"@
    exit 3
}

$cliVersion = Run-Flagsmith "--version"
Info "Flagsmith CLI: $cliVersion"

$authOutput = Run-Flagsmith "auth status --json"
if ($authOutput -match "not logged in|no credential|unauthorized|401") {
    Fail "Flagsmith CLI is not authenticated."
    Write-Host @"

Run this once in your terminal, complete the browser flow, then re-run:

  flagsmith login

No experiment data has been written yet.
"@
    exit 3
}
Ok "Authenticated with Flagsmith"

if ($ProjectId) {
    Info "Binding repository to project $ProjectId / environment $EnvKey"
    $initRes = Run-Flagsmith "init --project `"$ProjectId`" --environment `"$EnvKey`""
    if ($LASTEXITCODE -eq 0) {
        Ok "flagsmith init complete"
    } else {
        Warn "flagsmith init failed (non-fatal; API calls continue)"
    }
} else {
    Warn "PROJECT_ID not set — skipping 'flagsmith init' (non-fatal)."
}

# 2. Warehouse check
if ($SkipWarehouseCheck) {
    Warn "Skipping warehouse check (SkipWarehouseCheck)."
} else {
    $warehouseJson = Run-Flagsmith "api `"api/v1/environments/$EnvKey/warehouse-connections/`""
    if ($warehouseJson -match '"detail"|invalid environment|not found|unauthorized|forbidden') {
        Fail "Could not read warehouse connections for this environment key."
        Write-Host "  API response: $warehouseJson"
        Write-Host "  Check that EnvKey is the client-side SDK key for the intended environment."
        exit 2
    }

    $warehouseCount = 0
    try {
        $parsed = $warehouseJson | ConvertFrom-Json
        if ($parsed -is [Array]) {
            $warehouseCount = $parsed.Count
        } elseif ($parsed.results -is [Array]) {
            $warehouseCount = $parsed.results.Count
        }
    } catch {
        $warehouseCount = 0
    }

    if ($warehouseCount -eq 0) {
        Fail "No connected data warehouse found for environment $EnvKey."
        Write-Host @"
Flagsmith needs a warehouse to compute Bayesian experiment results.

Enable the managed Flagsmith warehouse once in the browser:
  Flagsmith Cloud → Environment Settings → Warehouse
  https://docs.flagsmith.com/experimentation/connect-a-warehouse

Then re-run this script. To create the flag/metric/experiment anyway:
  .\scripts\setup_flagsmith.ps1 -EnvKey $EnvKey -SkipWarehouseCheck
"@
        exit 4
    }
    Ok "Warehouse connected ($warehouseCount connection(s))"
}

# 3. Multivariate flag with a KEYED variation
Title "1/4 · Flag $FlagName"

$existingFeatures = Run-Flagsmith "feature list --json"
if ($existingFeatures -match "`"name`":\s*`"$FlagName`"") {
    Ok "Flag already exists"
} else {
    Info "Creating flag (default value: $ControlValue)"
    $createFlagRes = Run-Flagsmith "feature create `"$FlagName`" --value `"$ControlValue`" --enabled"
    Ok "Flag created"
}

$flagObj = $flagJson | ConvertFrom-Json

function Find-VariationId($obj, $keyName) {
    if (-not $obj) { return $null }
    if ($obj.key -eq $keyName -and $obj.id) { return $obj.id }
    if ($obj.multivariate_options) {
        foreach ($opt in $obj.multivariate_options) {
            if ($opt.key -eq $keyName -and $opt.id) { return $opt.id }
            if ($opt.string_value -eq $keyName -and $opt.id) { return $opt.id }
        }
    }
    return $null
}

$variationId = Find-VariationId $flagObj $VariantKey

if (-not $variationId) {
    Info "Adding variation $VariantKey with key=$VariantKey (weight 0)"
    $addVarRes = Run-Flagsmith "feature variant add `"$FlagName`" --value `"$VariantKey`" --key `"$VariantKey`" --weight 0"
    $flagJson = Run-Flagsmith "feature get `"$FlagName`" --json"
    $flagObj = $flagJson | ConvertFrom-Json
    $variationId = Find-VariationId $flagObj $VariantKey
}

if (-not $variationId) {
    Fail "Could not confirm a keyed variation '$VariantKey'."
    exit 2
}
Ok "Keyed variation $VariantKey present (id=$variationId)"

$flagId = $flagObj.id
if (-not $flagId -and $flagObj.feature) { $flagId = $flagObj.feature.id }
if (-not $flagId) {
    Fail "Could not read numeric feature id."
    exit 2
}
Ok "Flag id=$flagId"

# 4. Occurrence metric
Title "2/4 · Metric $EventName"

$metricsJson = Run-Flagsmith "api `"api/v1/environments/$EnvKey/experiment-metrics/`""
$metricsObj = $metricsJson | ConvertFrom-Json
$metricsList = if ($metricsObj -is [Array]) { $metricsObj } else { $metricsObj.results }

$metricId = $null
if ($metricsList) {
    foreach ($m in $metricsList) {
        if ($m.definition.event -eq $EventName -or $m.name -eq $MetricName) {
            $metricId = $m.id
            break
        }
    }
}

if (-not $metricId) {
    Info "Creating occurrence metric"
    $metricPayload = @{
        name = $MetricName
        aggregation = "occurrence"
        direction = "up"
        definition = @{
            version = 1
            event = $EventName
        }
    } | ConvertTo-Json -Depth 5 -Compress

    $tmpMetricFile = [System.IO.Path]::GetTempFileName()
    Set-Content -Path $tmpMetricFile -Value $metricPayload -Encoding UTF8
    $metricRes = (cmd.exe /c "flagsmith api `"api/v1/environments/$EnvKey/experiment-metrics/`" --method POST --file `"$tmpMetricFile`" 2>&1") -join "`n"
    Remove-Item $tmpMetricFile -ErrorAction SilentlyContinue

    $createdMetric = $metricRes | ConvertFrom-Json
    $metricId = if ($createdMetric.id) { $createdMetric.id } else { $createdMetric.metric.id }
} else {
    Ok "Metric already exists (id=$metricId)"
}

if (-not $metricId) {
    Fail "Could not create or find the $EventName metric."
    exit 2
}
Ok "Metric id=$metricId (occurrence, direction up)"

# 5. Experiment
Title "3/4 · Experiment"

$expJson = Run-Flagsmith "api `"api/v1/environments/$EnvKey/experiments/`""
$expObj = $expJson | ConvertFrom-Json
$expList = if ($expObj -is [Array]) { $expObj } else { $expObj.results }

$experimentId = $null
if ($expList) {
    foreach ($e in $expList) {
        if ($e.name -eq $ExperimentName) {
            $experimentId = $e.id
            break
        }
    }
}

if (-not $experimentId) {
    Info "Creating experiment (100% rollout, 50/50 split)"
    $expPayload = @{
        feature = [int]$flagId
        name = $ExperimentName
        hypothesis = $Hypothesis
        metrics = @(
            @{
                metric = [int]$metricId
                expected_direction = "increase"
            }
        )
        experiment_rollout = @{
            enabled = $true
            rollout_percentage = 100
            feature_state_value = @{
                type = "string"
                value = $ControlValue
            }
            multivariate_feature_state_values = @(
                @{
                    multivariate_feature_option = [int]$variationId
                    percentage_allocation = 50
                }
            )
        }
    } | ConvertTo-Json -Depth 10 -Compress

    $tmpExpFile = [System.IO.Path]::GetTempFileName()
    Set-Content -Path $tmpExpFile -Value $expPayload -Encoding UTF8
    $expRes = (cmd.exe /c "flagsmith api `"api/v1/environments/$EnvKey/experiments/`" --method POST --file `"$tmpExpFile`" 2>&1") -join "`n"
    Remove-Item $tmpExpFile -ErrorAction SilentlyContinue

    $createdExp = $expRes | ConvertFrom-Json
    $experimentId = if ($createdExp.id) { $createdExp.id } else { $createdExp.experiment.id }
    if ($experimentId) { Ok "Experiment created (id=$experimentId)" }
} else {
    Ok "Experiment already exists (id=$experimentId)"
}

if (-not $experimentId) {
    Fail "Could not create or find the experiment."
    exit 2
}

# 6. Start
Title "4/4 · Start"

$statusJson = Run-Flagsmith "api `"api/v1/environments/$EnvKey/experiments/$experimentId/`""
$status = "unknown"
try {
    $parsedStatus = $statusJson | ConvertFrom-Json
    $status = if ($parsedStatus.status) { $parsedStatus.status } elseif ($parsedStatus.experiment.status) { $parsedStatus.experiment.status } else { "unknown" }
} catch {}

if ($status -eq "running") {
    Ok "Experiment already running"
} elseif ($SkipStart) {
    Warn "SkipStart set — experiment left in status '$status'."
} else {
    Info "Starting experiment (current status: $status)"
    $startRes = Run-Flagsmith "api `"api/v1/environments/$EnvKey/experiments/$experimentId/start/`" --method POST"
    Ok "Experiment start requested"
}

# 7. Persist client key locally
if (Test-Path ".env") {
    $lines = Get-Content ".env" | Where-Object { $_ -notmatch "^VITE_FLAGSMITH_ENV_KEY=" }
    $lines += "VITE_FLAGSMITH_ENV_KEY=$EnvKey"
    Set-Content -Path ".env" -Value $lines
} else {
    Set-Content -Path ".env" -Value "VITE_FLAGSMITH_ENV_KEY=$EnvKey"
}
Ok "Wrote VITE_FLAGSMITH_ENV_KEY to .env (gitignored)"

Title "Summary"
$dashProject = if ($ProjectId) { $ProjectId } else { '<PROJECT_ID>' }
$summaryText = @"
  Flag:       $FlagName (id $flagId)
  Variation:  $VariantKey (keyed, id $variationId)
  Metric:     $EventName (id $metricId)
  Experiment: $ExperimentName (id $experimentId)
  Split:      50% $ControlValue / 50% $VariantKey, 100% rollout

  Dashboard:  https://app.flagsmith.com/project/$dashProject
  Results:
    flagsmith api "api/v1/environments/$EnvKey/experiments/$experimentId/results/refresh/" --method POST
    flagsmith api "api/v1/environments/$EnvKey/experiments/$experimentId/results/"

  Next: npm run build && npm run dev
        node scripts/simulate_traffic.mjs --yes
"@
Write-Host $summaryText
Write-Host "`nFlagsmith experiment provisioned.`n" -ForegroundColor Green
