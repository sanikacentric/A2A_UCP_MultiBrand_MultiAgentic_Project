# A2A x UCP — Multi-Brand Multi-Agentic Commerce Demo

This project demonstrates a sophisticated **Agent-to-Agent (A2A)** ecosystem focused on **Universal Commerce Protocol (UCP)**. It allows specialized AI agents to collaborate in real-time to solve complex, multi-brand shopping tasks that would normally require manual effort across multiple websites.

---

## 🚀 Quick Start (One Command)

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\run_all_services.ps1
```

That single command will:
1. Free any conflicting ports
2. Create a Python virtual environment and install all dependencies
3. Install the UCP server from local source
4. Start all 5 services in separate titled PowerShell windows
5. Wait until every port is ready
6. Open the Visualizer UI at **http://localhost:7000/ui/**

---

## 🌐 Services & Ports

| Service | Port | URL | Description |
|---|---|---|---|
| **Orchestrator** | 7000 | http://localhost:7000 | Brain — decomposes user requests and coordinates all agents |
| **Checkout Agent** | 7001 | http://localhost:7001 | Doer — creates UCP checkout sessions via A2A |
| **Discovery Agent** | 7002 | http://localhost:7002 | Researcher — searches the web and ranks results via Gemini |
| **Sephora UCP Server** | 8182 | http://localhost:8182 | Brand backend — handles Sephora checkout sessions |
| **L'Oreal UCP Server** | 8282 | http://localhost:8282 | Brand backend — handles L'Oreal checkout sessions |
| **Visualizer UI** | 7000/ui | http://localhost:7000/ui/ | Animated marketing dashboard |

### Interactive API Docs (Swagger)

| Service | Swagger UI |
|---|---|
| Orchestrator | http://localhost:7000/docs |
| Checkout Agent | http://localhost:7001/docs |
| Discovery Agent | http://localhost:7002/docs |
| Sephora UCP Server | http://localhost:8182/docs |
| L'Oreal UCP Server | http://localhost:8282/docs |

---

## ⚙️ Prerequisites

- **Windows** with PowerShell
- **Python 3.10+** on PATH
- API keys in `a2a_ucp_multibrand_demo/.env`:

```env
GOOGLE_API_KEY=your_google_gemini_key_here   # https://aistudio.google.com/app/apikey
SERPER_API_KEY=your_serper_key_here          # https://serper.dev  (free tier)
```

The startup script auto-creates a `.env` template on first run if it doesn't exist.

---

## 🧠 How the Agentic Flow Works

When you submit a request like *"Find vitamin C serum from L'Oreal and matte lipstick from Sephora under $60 and checkout"*:

### Step 1 — User → Orchestrator (Port 7000)
The user's natural language request is sent to the Orchestrator over A2A. It parses intent and splits the task into two brand-specific searches.

### Step 2 & 3 — Orchestrator → Discovery Agent (Port 7002) via A2A
The Orchestrator calls the Discovery Agent twice (once per brand) using the `web_search_ranked` A2A skill:
- Search 1: *"L'Oreal vitamin C serum under $60"* via **Serper API**
- Search 2: *"Sephora matte lipstick under $60"* via **Serper API**
- **Gemini 2.5 Flash** ranks the results and selects the best match for each

### Step 4 — Orchestrator → Checkout Agent (Port 7001) via A2A
The Orchestrator invokes the `create_split_checkout` A2A skill on the Checkout Agent, passing the discovered items.

### Step 5 & 6 — Checkout Agent → UCP Brand Servers (Ports 8182 & 8282)
The Checkout Agent calls both brand servers using **UCP (Universal Commerce Protocol)**:
- `GET /.well-known/ucp` → probe brand capabilities (`200 OK`)
- `POST /checkout-sessions` → create session for each brand (`201 Created`)
- **Gemini 2.5 Flash** generates a human-friendly split-checkout plan

### Step 7 — User Confirms → Complete Checkout
After user confirmation:
- `POST /checkout-sessions/{id}/complete` → finalize payment at each brand (`200 OK`)
- Both brand servers return an `order_id` and store the transaction in SQLite

---

## 📊 Visualizer UI

Open **http://localhost:7000/ui/** in your browser.

| Control | Description |
|---|---|
| **Simulation Mode ON** | Fully animated demo — no backend needed |
| **Simulation Mode OFF** | Live mode — real Gemini + Serper + UCP calls |
| **RUN A2A FLOW** | Start the 10-step orchestration flow |
| **AUTO PLAY** | Runs the flow and auto-confirms purchase |
| **Speed slider** | 0.5× to 3× playback speed |

---

## 📁 Project Structure

```
A2A_UCP_MultiBrand_MultiAgentic_Project/
│
├── run_all_services.ps1              # One-command startup script
│
├── a2a_ucp_multibrand_demo/
│   ├── .env                          # API keys (GOOGLE_API_KEY, SERPER_API_KEY)
│   ├── orchestrator/app/main.py      # Orchestrator — port 7000
│   ├── checkout_agent/app/main.py    # Checkout Agent — port 7001
│   ├── checkout_agent/app/ucp_client.py
│   ├── discovery_agent/app/main.py   # Discovery Agent — port 7002
│   ├── shared/app/a2a_client.py      # Shared A2A HTTP client
│   └── visualizer/                   # Animated UI (served at /ui/)
│       ├── index.html
│       ├── styles.css
│       └── script.js
│
└── samples/rest/python/server/       # UCP Brand Server (runs on 8182 & 8282)
    └── server/
        ├── app.py                    # FastAPI UCP endpoints
        └── __main__.py               # CLI entry point
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Agent Framework | FastAPI (Python) + Uvicorn |
| Agent Protocol | A2A (Agent-to-Agent) v0.3 |
| Commerce Protocol | UCP (Universal Commerce Protocol) v1.0 |
| AI Models | Google Gemini 2.5 Flash |
| Web Search | Serper API |
| Database | SQLite (per-brand transaction store) |
| Frontend | Vanilla JS + CSS Animations + SVG |

---

## 🛑 Stopping All Services

```powershell
Get-Process python | Stop-Process
```
