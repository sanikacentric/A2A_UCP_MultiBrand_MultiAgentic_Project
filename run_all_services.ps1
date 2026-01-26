# Run All UCP Services
# This script starts all necessary servers and agents in new PowerShell windows.

$UCP_ROOT = "C:\Users\stungare\sanikaperf\git\ucp"
$SERVER_DIR = "$UCP_ROOT\samples\rest\python\server"
$AGENTS_ROOT = "$UCP_ROOT\a2a_ucp_multibrand_demo"

# Function to start a process in a new window
# We use -NoExit so the window stays open for logs
function Start-ServiceWindow {
    param (
        [string]$Title,
        [string]$WorkDir,
        [string]$Command
    )
    Write-Host "Starting $Title..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "& { $Command }" -WorkingDirectory $WorkDir
}

# 1. Start UCP Server 1 (Sephora) - Port 8182
Start-ServiceWindow -Title "UCP Server (Sephora) :8182" `
    -WorkDir $SERVER_DIR `
    -Command ".\.venv\Scripts\Activate.ps1; python -m server --port 8182 --products_db_path C:\tmp\ucp_test\products.db --transactions_db_path C:\tmp\ucp_test\transactions_8182.db --simulation_secret dev-secret"

# 2. Start UCP Server 2 (L'Oreal) - Port 8282
Start-ServiceWindow -Title "UCP Server (L'Oreal) :8282" `
    -WorkDir $SERVER_DIR `
    -Command ".\.venv\Scripts\Activate.ps1; python -m server --port 8282 --products_db_path C:\tmp\ucp_test\products.db --transactions_db_path C:\tmp\ucp_test\transactions_8282.db --simulation_secret dev-secret"

# 3. Start Checkout Agent - Port 7001
Start-ServiceWindow -Title "Checkout Agent :7001" `
    -WorkDir "$AGENTS_ROOT\checkout_agent" `
    -Command ".\.venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --port 7001"

# 4. Start Discovery Agent - Port 7002
Start-ServiceWindow -Title "Discovery Agent :7002" `
    -WorkDir "$AGENTS_ROOT\discovery_agent" `
    -Command ".\.venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --port 7002"

# 5. Start Orchestrator Agent - Port 7000
# Note: Orchestrator uses the checkout_agent's venv as per previous setup
Start-ServiceWindow -Title "Orchestrator :7000" `
    -WorkDir $AGENTS_ROOT `
    -Command "checkout_agent\.venv\Scripts\Activate.ps1; python -m uvicorn orchestrator.app.main:app --port 7000"

Write-Host "All services launching in background windows..."
Write-Host "  - UCP Servers: http://localhost:8182, http://localhost:8282"
Write-Host "  - Orchestrator: http://localhost:7000/docs"
Write-Host "  - Checkout Agent: http://localhost:7001/docs"
Write-Host "  - Discovery Agent: http://localhost:7002/docs"
