# =============================================================================
#  A2A x UCP Multi-Brand Agentic Commerce -- Complete Startup Script
#  Usage:  powershell.exe -ExecutionPolicy Bypass -File .\run_all_services.ps1
# =============================================================================

Set-StrictMode -Off
$ErrorActionPreference = "Continue"

# ---------- PATHS (all relative to this script -- no hardcoded user paths) ---
$ProjectRoot    = $PSScriptRoot
$DemoDir        = Join-Path $ProjectRoot "a2a_ucp_multibrand_demo"
$VenvDir        = Join-Path $DemoDir ".venv"
$PythonExe      = Join-Path $VenvDir "Scripts\python.exe"
$PipExe         = Join-Path $VenvDir "Scripts\pip.exe"
$LogDir         = Join-Path $DemoDir "logs"
$DbDir          = "C:\tmp\ucp_test"
$ProductsDb     = Join-Path $DbDir "products.db"
$TxDb8182       = Join-Path $DbDir "transactions_8182.db"
$TxDb8282       = Join-Path $DbDir "transactions_8282.db"
$VisualizerHtml = Join-Path $DemoDir "visualizer\index.html"
$EnvFile        = Join-Path $DemoDir ".env"
$LocalUcpServer = Join-Path $ProjectRoot "samples\rest\python\server"

# ---------- SERVICE DEFINITIONS ----------------------------------------------
$Services = @(
    [pscustomobject]@{ Name = "Sephora UCP Server"; Port = 8182; Color = "Green"   },
    [pscustomobject]@{ Name = "LOreal UCP Server";  Port = 8282; Color = "Green"   },
    [pscustomobject]@{ Name = "Discovery Agent";    Port = 7002; Color = "Magenta" },
    [pscustomobject]@{ Name = "Checkout Agent";     Port = 7001; Color = "Yellow"  },
    [pscustomobject]@{ Name = "Orchestrator";       Port = 7000; Color = "Cyan"    }
)

# ---------- HELPERS ----------------------------------------------------------
function Write-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "  =============================================================" -ForegroundColor Cyan
    Write-Host "    A2A x UCP  --  Multi-Brand Agentic Commerce Demo"            -ForegroundColor Cyan
    Write-Host "    Orchestrator | Discovery | Checkout | UCP Servers | UI"      -ForegroundColor Cyan
    Write-Host "  =============================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Project : $ProjectRoot" -ForegroundColor DarkGray
    Write-Host "  Demo    : $DemoDir"     -ForegroundColor DarkGray
    Write-Host "  Venv    : $VenvDir"     -ForegroundColor DarkGray
    Write-Host ""
}

function Write-Section([string]$title) {
    Write-Host ""
    Write-Host "  ---- $title ----" -ForegroundColor DarkCyan
    Write-Host ""
}

function Write-Step([string]$msg, [string]$c = "White") { Write-Host "  >> $msg" -ForegroundColor $c }
function Write-OK([string]$msg)                          { Write-Host "  [OK]   $msg" -ForegroundColor Green  }
function Write-Warn([string]$msg)                        { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err([string]$msg)                         { Write-Host "  [ERR]  $msg" -ForegroundColor Red    }

function Test-Port([int]$port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", $port)
        $tcp.Close()
        return $true
    } catch {
        return $false
    }
}

function Wait-ForPort([int]$port, [int]$timeoutSec = 50) {
    $start = Get-Date
    while (((Get-Date) - $start).TotalSeconds -lt $timeoutSec) {
        if (Test-Port $port) { return $true }
        Start-Sleep -Milliseconds 600
    }
    return $false
}

function Kill-Port([int]$port) {
    $lines = netstat -ano 2>$null | Where-Object { $_ -match ":$port\s" }
    foreach ($line in $lines) {
        $parts = ($line.Trim() -split '\s+')
        $pid2  = $parts[-1]
        if ($pid2 -match '^\d+$') {
            try { Stop-Process -Id ([int]$pid2) -Force -ErrorAction SilentlyContinue } catch {}
        }
    }
}

function Start-ServiceWindow {
    param(
        [string]$WinTitle,
        [string]$WorkDir,
        [string]$Cmd,
        [string]$Color = "White"
    )
    # Build an encoded command so the title and working directory are set inside
    $inner = @"
`$Host.UI.RawUI.WindowTitle = '$WinTitle'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host ''
Write-Host '  $WinTitle' -ForegroundColor $Color
Write-Host '  -------------------------------------------------------' -ForegroundColor $Color
Write-Host ''
Set-Location '$WorkDir'
$Cmd
"@
    $bytes   = [System.Text.Encoding]::Unicode.GetBytes($inner)
    $encoded = [Convert]::ToBase64String($bytes)
    Start-Process powershell.exe -ArgumentList "-NoExit", "-EncodedCommand", $encoded `
        -WindowStyle Normal | Out-Null
}

# =============================================================================
#  MAIN EXECUTION
# =============================================================================

Write-Banner

# ---------- STEP 1: FREE PORTS -----------------------------------------------
Write-Section "STEP 1 -- Clearing ports"

foreach ($svc in $Services) {
    if (Test-Port $svc.Port) {
        Write-Warn "Port $($svc.Port) is busy -- killing existing process..."
        Kill-Port $svc.Port
        Start-Sleep -Milliseconds 800
        if (-not (Test-Port $svc.Port)) {
            Write-OK "Port $($svc.Port) cleared"
        } else {
            Write-Err "Port $($svc.Port) still busy -- close it manually and re-run"
        }
    } else {
        Write-OK "Port $($svc.Port) is free"
    }
}

# ---------- STEP 2: DIRECTORIES & DATABASES ----------------------------------
Write-Section "STEP 2 -- Directories and databases"

foreach ($dir in @($DbDir, $LogDir)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-OK "Created : $dir"
    } else {
        Write-OK "Exists  : $dir"
    }
}

foreach ($db in @($ProductsDb, $TxDb8182, $TxDb8282)) {
    if (-not (Test-Path $db)) {
        python -c "import sqlite3; sqlite3.connect(r'$db').close()" 2>$null
        Write-OK "Created DB : $db"
    } else {
        Write-OK "DB ready   : $db"
    }
}

# ---------- STEP 3: PYTHON VENV ----------------------------------------------
Write-Section "STEP 3 -- Python virtual environment"

if (-not (Test-Path $PythonExe)) {
    Write-Step "Creating venv at $VenvDir ..."
    python -m venv $VenvDir 2>&1 | Out-Null
    if (Test-Path $PythonExe) {
        Write-OK "Venv created successfully"
    } else {
        Write-Err "Failed to create venv. Make sure Python is installed and on PATH."
        exit 1
    }
} else {
    Write-OK "Venv exists: $VenvDir"
}

# ---------- STEP 4: INSTALL PYTHON PACKAGES ----------------------------------
Write-Section "STEP 4 -- Installing Python packages"

Write-Step "Installing: fastapi, uvicorn, python-dotenv, requests, google-genai, sqlalchemy ..."
& $PipExe install --quiet --disable-pip-version-check `
    fastapi `
    uvicorn `
    python-dotenv `
    requests `
    google-genai `
    sqlalchemy `
    pydantic `
    greenlet 2>&1 | Out-Null
Write-OK "Core packages installed"

# Check for UCP server module
$ucpCheck = & $PythonExe -c "import importlib.util; print('yes' if importlib.util.find_spec('server') else 'no')" 2>$null
$ucpOk = ($ucpCheck -and $ucpCheck.Trim() -eq "yes")

if (-not $ucpOk) {
    $setupPy      = Join-Path $LocalUcpServer "setup.py"
    $pyprojectToml = Join-Path $LocalUcpServer "pyproject.toml"
    if (Test-Path $setupPy) {
        Write-Step "Installing UCP server from local source: $LocalUcpServer"
        & $PipExe install --quiet -e $LocalUcpServer 2>&1 | Out-Null
        $ucpOk = $true
        Write-OK "UCP server installed from local source"
    } elseif (Test-Path $pyprojectToml) {
        Write-Step "Installing UCP server (pyproject) from: $LocalUcpServer"
        & $PipExe install --quiet -e $LocalUcpServer 2>&1 | Out-Null
        $ucpOk = $true
        Write-OK "UCP server installed"
    } else {
        Write-Warn "UCP server source not found at: $LocalUcpServer"
        Write-Warn "Brand servers (ports 8182 and 8282) will be SKIPPED."
        Write-Warn "Use the 'Simulation Mode' toggle in the Visualizer UI."
        $ucpOk = $false
    }
} else {
    Write-OK "UCP server module is available"
}

# ---------- STEP 5: .ENV / API KEYS ------------------------------------------
Write-Section "STEP 5 -- Environment variables and API keys"

if (-not (Test-Path $EnvFile)) {
    Write-Warn ".env not found -- creating template:"
    Write-Host "         $EnvFile" -ForegroundColor Yellow

    $envTemplate = @"
# -------------------------------------------------------
#  A2A x UCP Demo -- Environment Variables
#  GOOGLE_API_KEY : https://aistudio.google.com/app/apikey
#  SERPER_API_KEY : https://serper.dev  (free tier)
# -------------------------------------------------------
GOOGLE_API_KEY=your_google_gemini_key_here
SERPER_API_KEY=your_serper_key_here

DISCOVERY_AGENT_URL=http://localhost:7002
CHECKOUT_AGENT_URL=http://localhost:7001
SEPHORA_UCP_BASE=http://localhost:8182
LOREAL_UCP_BASE=http://localhost:8282
A2A_VERSION=0.3
"@
    $envTemplate | Set-Content $EnvFile -Encoding UTF8
    Write-Warn "Fill in your API keys then re-run."
    Write-Warn "Without keys, use Simulation Mode in the Visualizer."
    $keysOk = $false
} else {
    $raw       = Get-Content $EnvFile -Raw
    $hasGoogle = $raw -match 'GOOGLE_API_KEY=(?!your_)\S+'
    $hasSerper = $raw -match 'SERPER_API_KEY=(?!your_)\S+'
    if ($hasGoogle -and $hasSerper) {
        Write-OK ".env found -- GOOGLE_API_KEY and SERPER_API_KEY are configured"
        $keysOk = $true
    } else {
        Write-Warn ".env found but keys look like placeholders -- AI calls may fail"
        Write-Warn "Edit: $EnvFile"
        $keysOk = $false
    }
}

# ---------- STEP 6: START UCP BRAND SERVERS ----------------------------------
Write-Section "STEP 6 -- UCP Brand Servers (Sephora :8182 and LOreal :8282)"

if ($ucpOk) {

    Write-Step "Starting Sephora UCP Server on port 8182 ..." "Green"
    Start-ServiceWindow `
        -WinTitle "Sephora UCP Server  :8182" `
        -WorkDir  $DbDir `
        -Cmd      ("& '$PythonExe' -m server " +
                   "--port 8182 " +
                   "--products_db_path '$ProductsDb' " +
                   "--transactions_db_path '$TxDb8182' " +
                   "--simulation_secret dev-secret") `
        -Color    "Green"

    Start-Sleep -Seconds 1

    Write-Step "Starting LOreal UCP Server on port 8282 ..." "Green"
    Start-ServiceWindow `
        -WinTitle "LOreal UCP Server  :8282" `
        -WorkDir  $DbDir `
        -Cmd      ("& '$PythonExe' -m server " +
                   "--port 8282 " +
                   "--products_db_path '$ProductsDb' " +
                   "--transactions_db_path '$TxDb8282' " +
                   "--simulation_secret dev-secret") `
        -Color    "Green"

} else {
    Write-Warn "Skipping UCP brand servers"
}

# ---------- STEP 7: START A2A AGENTS -----------------------------------------
Write-Section "STEP 7 -- A2A Agents"

Write-Step "Starting Discovery Agent on port 7002 ..." "Magenta"
Start-ServiceWindow `
    -WinTitle "Discovery Agent  :7002" `
    -WorkDir  $DemoDir `
    -Cmd      ("& '$PythonExe' -m uvicorn discovery_agent.app.main:app " +
               "--host 127.0.0.1 --port 7002 --reload") `
    -Color    "Magenta"

Start-Sleep -Seconds 2

Write-Step "Starting Checkout Agent on port 7001 ..." "Yellow"
Start-ServiceWindow `
    -WinTitle "Checkout Agent  :7001" `
    -WorkDir  $DemoDir `
    -Cmd      ("& '$PythonExe' -m uvicorn checkout_agent.app.main:app " +
               "--host 127.0.0.1 --port 7001 --reload") `
    -Color    "Yellow"

Start-Sleep -Seconds 2

Write-Step "Starting Orchestrator on port 7000 ..." "Cyan"
Start-ServiceWindow `
    -WinTitle "Orchestrator  :7000" `
    -WorkDir  $DemoDir `
    -Cmd      ("& '$PythonExe' -m uvicorn orchestrator.app.main:app " +
               "--host 127.0.0.1 --port 7000 --reload") `
    -Color    "Cyan"

# ---------- STEP 8: WAIT FOR SERVICES ----------------------------------------
Write-Section "STEP 8 -- Waiting for services to be ready"

$waitList = @(7002, 7001, 7000)
if ($ucpOk) { $waitList += @(8182, 8282) }

foreach ($svc in $Services) {
    if ($svc.Port -notin $waitList) { continue }
    $label = ("  [ {0,-22} ] port {1,-5} " -f $svc.Name, $svc.Port)
    Write-Host $label -NoNewline -ForegroundColor $svc.Color
    $ready = Wait-ForPort $svc.Port 50
    if ($ready) {
        Write-Host " READY"   -ForegroundColor Green
    } else {
        Write-Host " TIMEOUT (check the service window for errors)" -ForegroundColor Red
    }
}

# ---------- STEP 9: OPEN VISUALIZER ------------------------------------------
Write-Section "STEP 9 -- Launching Visualizer UI"

if (Test-Path $VisualizerHtml) {
    Start-Sleep -Seconds 1
    Start-Process "http://localhost:7000/ui/"
    Write-OK "Visualizer opened in browser"
    Write-Host "         http://localhost:7000/ui/" -ForegroundColor DarkGray
} else {
    Write-Err "Visualizer not found at: $VisualizerHtml"
}

# ---------- FINAL STATUS SUMMARY ---------------------------------------------
Write-Host ""
Write-Host "  =============================================================" -ForegroundColor Cyan
Write-Host "    FINAL SERVICE STATUS" -ForegroundColor Cyan
Write-Host "  =============================================================" -ForegroundColor Cyan

foreach ($svc in $Services) {
    $up    = Test-Port $svc.Port
    $mark  = if ($up) { "[UP]  " } else { "[DOWN]" }
    $state = if ($up) { "RUNNING" } else { "NOT RUNNING" }
    $url   = "http://localhost:$($svc.Port)"
    $line  = "  $mark  {0,-22}  {1,-30}  {2}" -f $svc.Name, $url, $state
    $color = if ($up) { "Green" } else { "Red" }
    Write-Host $line -ForegroundColor $color
}

Write-Host ""
Write-Host "  Useful API Docs:" -ForegroundColor White
Write-Host "    Orchestrator   -->  http://localhost:7000/docs" -ForegroundColor DarkGray
Write-Host "    Checkout Agent -->  http://localhost:7001/docs" -ForegroundColor DarkGray
Write-Host "    Discovery Agent->  http://localhost:7002/docs"  -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Visualizer UI (already open):" -ForegroundColor White
Write-Host "    http://localhost:7000/ui/" -ForegroundColor DarkGray
Write-Host ""

if (-not $keysOk) {
    Write-Host "  =============================================================" -ForegroundColor Yellow
    Write-Host "  [WARN] API keys not configured:" -ForegroundColor Yellow
    Write-Host "         Edit: $EnvFile" -ForegroundColor Yellow
    Write-Host "         Then re-run this script." -ForegroundColor Yellow
    Write-Host "         Until then, use Simulation Mode in the Visualizer." -ForegroundColor Yellow
    Write-Host "  =============================================================" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "  To stop ALL Python services run:" -ForegroundColor DarkGray
Write-Host "    Get-Process python | Stop-Process" -ForegroundColor White
Write-Host ""
Write-Host "  Log files are in: $LogDir" -ForegroundColor DarkGray
Write-Host ""
