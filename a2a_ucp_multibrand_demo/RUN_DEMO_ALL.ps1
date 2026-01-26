# RUN_DEMO_ALL_FIXED.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# -------- CONFIG --------
$BaseDir      = "C:\Users\stungare\sanikaperf\git\ucp\a2a_ucp_multibrand_demo"
$UcpServerDir = "C:\Users\stungare\sanikaperf\git\ucp\samples\rest\python\server"

$DbDir     = "C:\tmp\ucp_test"
$ProductsDb= Join-Path $DbDir "products.db"
$TxDb8282  = Join-Path $DbDir "transactions_8282.db"
$TxDb8281  = Join-Path $DbDir "transactions_8281.db"

$UcpUrl8282 = "http://127.0.0.1:8282"
$UcpUrl8281 = "http://127.0.0.1:8281"

$PortsToCheck = @(7000,7001,7002,8182,8281,8282)

$SimulationSecret = "dev-secret"  # only for /testing/* endpoints; NOT needed for checkout complete.

# Demo data
$SkuId = "sku-123"
$ProductTitle = "vitamin c serum"
$PriceCents = 2999
$Currency = "USD"
$SelectedInstrument = "instr_1"

$ShipAddress = @{
  street_address    = "1 Main St"
  address_locality  = "Princeton"
  address_region    = "NJ"
  postal_code       = "08540"
  address_country   = "US"
  first_name        = "Sanika"
  last_name         = "Tungare"
  full_name         = "Sanika Tungare"
  phone_number      = "5551231234"
}

# -------- Helpers --------
function Section([string]$t){ Write-Host "`n=== $t ===" -ForegroundColor Cyan }

function Ensure-Folder([string]$p){
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p | Out-Null }
}

function Ensure-Db([string]$dbPath){
  if (-not (Test-Path $dbPath)) {
    python -c "import sqlite3; sqlite3.connect(r'$dbPath').close()"
  }
}

function Test-Port([int]$port){
  try {
    $r = Test-NetConnection -ComputerName 127.0.0.1 -Port $port -WarningAction SilentlyContinue
    return [bool]$r.TcpTestSucceeded
  } catch { return $false }
}

function Wait-Port([int]$port, [int]$timeoutSec=60){
  $start = Get-Date
  while (((Get-Date) - $start).TotalSeconds -lt $timeoutSec){
    if (Test-Port $port) { return $true }
    Start-Sleep -Milliseconds 400
  }
  return $false
}

function New-Idem([string]$prefix){
  return "$prefix-$([guid]::NewGuid().ToString())"
}

function Sqlite-Query([string]$dbPath, [string]$sql){
  $py = @"
import sqlite3
con=sqlite3.connect(r'''$dbPath''')
cur=con.cursor()
print(cur.execute(r'''$sql''').fetchall())
con.close()
"@
  python -c $py
}

function Start-ServiceWithLogs([string]$name, [string]$workDir, [int]$port, [string[]]$args){
  if (Test-Port $port) {
    Write-Host "$name already running on $port" -ForegroundColor Gray
    return
  }

  Ensure-Folder (Join-Path $BaseDir "logs")
  $logOut = Join-Path $BaseDir "logs\$name-$port.out.log"
  $logErr = Join-Path $BaseDir "logs\$name-$port.err.log"

  Write-Host "Starting $name on port $port" -ForegroundColor Yellow
  Write-Host "  OUT: $logOut" -ForegroundColor DarkGray
  Write-Host "  ERR: $logErr" -ForegroundColor DarkGray

  Start-Process -FilePath "python" `
    -ArgumentList $args `
    -WorkingDirectory $workDir `
    -WindowStyle Minimized `
    -RedirectStandardOutput $logOut `
    -RedirectStandardError $logErr | Out-Null
}

function Invoke-Ucp([string]$baseUrl, [string]$method, [string]$path, [object]$body=$null, [hashtable]$headers=$null){
  $uri = $baseUrl.TrimEnd("/") + $path
  $h = @{}

  # IMPORTANT: Add required headers for your server if it enforces them
  # If your server does NOT require these, they are harmless.
  $h["ucp-agent"] = "demo-script"
  $h["request-id"] = [guid]::NewGuid().ToString()
  $h["request-signature"] = "demo"  # many demos don't verify; if yours verifies, it must match server logic.

  if ($headers) { foreach($k in $headers.Keys){ $h[$k] = $headers[$k] } }

  if ($null -ne $body){
    $json = ($body | ConvertTo-Json -Depth 30)
    return Invoke-RestMethod -Method $method -Uri $uri -Headers $h -ContentType "application/json" -Body $json
  } else {
    return Invoke-RestMethod -Method $method -Uri $uri -Headers $h
  }
}

# -------- Start --------
Write-Host "`n=== UCP DEMO RUN START (FIXED) ===" -ForegroundColor Green
Write-Host "BaseDir: $BaseDir"
Write-Host "UCP 8282: $UcpUrl8282"
Write-Host "UCP 8281: $UcpUrl8281"
Write-Host "DB Dir :  $DbDir"

Set-Location $BaseDir
Ensure-Folder $DbDir
Ensure-Db $TxDb8281
Ensure-Db $TxDb8282

# -------- 1) Start UCP FIRST (most important) --------
Section "Starting UCP REST servers (8281, 8282)"
# Install deps in CURRENT venv (best effort)
try { python -m pip install --disable-pip-version-check -q fastapi uvicorn sqlalchemy pydantic greenlet | Out-Null } catch {}

Start-ServiceWithLogs "ucp" $UcpServerDir 8281 @(
  "-m","server","--port","8281",
  "--products_db_path",$ProductsDb,
  "--transactions_db_path",$TxDb8281,
  "--simulation_secret",$SimulationSecret
)

Start-ServiceWithLogs "ucp" $UcpServerDir 8282 @(
  "-m","server","--port","8282",
  "--products_db_path",$ProductsDb,
  "--transactions_db_path",$TxDb8282,
  "--simulation_secret",$SimulationSecret
)

if (-not (Wait-Port 8281 60)) { throw "UCP 8281 did not open. See logs\ucp-8281.err.log" }
if (-not (Wait-Port 8282 60)) { throw "UCP 8282 did not open. See logs\ucp-8282.err.log" }

# -------- 2) Start A2A services (optional) --------
Section "Starting A2A services (optional ports 7000/7001/7002)"
try {
  if (-not (Test-Port 7000)) {
    Start-ServiceWithLogs "orchestrator" $BaseDir 7000 @("-m","uvicorn","orchestrator.app.main:app","--host","127.0.0.1","--port","7000")
  }
  if (-not (Test-Port 7001)) {
    Start-ServiceWithLogs "checkout_agent" $BaseDir 7001 @("-m","uvicorn","checkout_agent.app.main:app","--host","127.0.0.1","--port","7001")
  }
  if (-not (Test-Port 7002)) {
    Start-ServiceWithLogs "discovery_agent" $BaseDir 7002 @("-m","uvicorn","discovery_agent.app.main:app","--host","127.0.0.1","--port","7002")
  }
} catch {
  Write-Host "A2A services not required for UCP checkout demo. Continuing..." -ForegroundColor Yellow
}

# -------- 3) Port check --------
Section "Checking ports"
foreach($p in $PortsToCheck){
  if (Test-Port $p) { Write-Host "Port $p: OPEN" -ForegroundColor Green }
  else { Write-Host "Port $p: NOT OPEN" -ForegroundColor Yellow }
}

# -------- 4) DB inspection (should now work) --------
Section "DB inspection (transactions_8282.db)"
Write-Host "Tables:" -ForegroundColor Gray
Sqlite-Query $TxDb8282 "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

Write-Host "shipping_rates:" -ForegroundColor Gray
Sqlite-Query $TxDb8282 "SELECT * FROM shipping_rates"

# pick shipping id
$ShipOptionId = "std-ship"
try {
  $out = (python -c "import sqlite3; con=sqlite3.connect(r'$TxDb8282'); cur=con.cursor(); rows=cur.execute(\"SELECT id FROM shipping_rates ORDER BY id LIMIT 1\").fetchall(); con.close(); print(rows)")
  if ($out -match "\('([^']+)'\)") { $ShipOptionId = $Matches[1] }
} catch {}
Write-Host "Selected shipping option id: $ShipOptionId" -ForegroundColor Green

# -------- 5) Demo flow on 8282 --------
Section "UCP demo flow on 8282 (Create -> Update -> Complete)"

$checkoutId = [guid]::NewGuid().ToString()

# 5.1 CREATE
$CreatePayload = @{
  id = $checkoutId
  currency = $Currency
  line_items = @(
    @{ item = @{ id=$SkuId; title=$ProductTitle; price=$PriceCents; image_url=$null }; quantity=1 }
  )
  payment = @{ selected_instrument_id = $SelectedInstrument }
}
$createHeaders = @{ "Idempotency-Key" = (New-Idem "create") }
$createResp = Invoke-Ucp $UcpUrl8282 "POST" "/checkout-sessions" $CreatePayload $createHeaders
$checkoutId = $createResp.id
Write-Host "Created checkout: $checkoutId" -ForegroundColor Green

# 5.2 UPDATE (fulfillment + payment + line_items)
$UpdatePayload = @{
  id = $checkoutId
  currency = $Currency
  line_items = @(
    @{ item = @{ id=$SkuId; title=$ProductTitle; price=$PriceCents; image_url=$null }; quantity=1 }
  )
  payment = @{ selected_instrument_id = $SelectedInstrument }
  fulfillment = @{
    address = $ShipAddress
    selected_option_id = $ShipOptionId
  }
}
$updateHeaders = @{ "Idempotency-Key" = (New-Idem "update") }
$updateResp = Invoke-Ucp $UcpUrl8282 "PUT" ("/checkout-sessions/$checkoutId") $UpdatePayload $updateHeaders
Write-Host "Updated status: $($updateResp.status)" -ForegroundColor Green

# 5.3 GET (proof)
$getResp = Invoke-Ucp $UcpUrl8282 "GET" ("/checkout-sessions/$checkoutId")
Write-Host "GET status: $($getResp.status)" -ForegroundColor Green

# 5.4 COMPLETE
$CompletePayload = @{
  currency = $Currency
  line_items = @(
    @{ item = @{ id=$SkuId; title=$ProductTitle; price=$PriceCents }; quantity=1 }
  )
  fulfillment = @{
    address = $ShipAddress
    selected_option_id = $ShipOptionId
  }
  payment_data = @{
    id = $SelectedInstrument
    handler_id = "mock_payment_handler"
    type = "card"
    brand = "Visa"
    last_digits = "1234"
    credential = @{ type="token"; token="success_token" }
  }
  risk_signals = @{}
}
$completeHeaders = @{ "Idempotency-Key" = (New-Idem "complete") }
$completeResp = Invoke-Ucp $UcpUrl8282 "POST" ("/checkout-sessions/$checkoutId/complete") $CompletePayload $completeHeaders
Write-Host "Complete call succeeded." -ForegroundColor Green

# -------- 6) DB proof --------
Section "DB proof after demo (transactions_8282.db)"
Write-Host "Latest checkouts:" -ForegroundColor Gray
Sqlite-Query $TxDb8282 "SELECT id, status FROM checkouts ORDER BY rowid DESC LIMIT 5"

Write-Host "Latest orders:" -ForegroundColor Gray
Sqlite-Query $TxDb8282 "SELECT id FROM orders ORDER BY rowid DESC LIMIT 5"

Write-Host "`n=== UCP DEMO RUN END (FIXED) ===" -ForegroundColor Green
