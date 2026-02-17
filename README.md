# A2A Multi-Brand Multi-Agentic Demo

This project demonstrates a sophisticated **Agent-to-Agent (A2A)** ecosystem focused on **Universal Commerce Protocol (UCP)**. It allows specialized AI agents to collaborate in real-time to solve complex, multi-brand shopping tasks that would normally require manual effort across multiple websites.

## 🧠 The Agentic Flow (Step-by-Step)

When you submit a request like *"Find vitamin C serum from L'Oreal and matte lipstick from Sephora under $60 and checkout"*, the following orchestration occurs:

### 1. The Orchestrator (The Brain) - Port 7000
- **Responsibility**: Decomposes the high-level user request into actionable tasks for specialized agents.
- **Action**: It identifies that the request involves two different brands (L'Oreal and Sephora) and two different functions (Discovery and Checkout).

### 2. The Discovery Agent (The Researcher) - Port 7002
- **Called By**: Orchestrator
- **Responsibility**: Performs web searches and uses **Gemini 2.5 Flash** to rank and select the best products.
- **Action**: It conducts two focused searches:
    - Search 1: Finds the best L'Oreal Vitamin C serum matching the budget.
    - Search 2: Finds the best Sephora Matte Lipstick matching the budget.
- **Result**: Returns the specific product details (titles, prices, and links) to the Orchestrator.

### 3. The Checkout Agent (The Doer) - Port 7001
- **Called By**: Orchestrator
- **Responsibility**: Translates the Orchestrator's plan into **UCP (Universal Commerce Protocol)** transactions.
- **Action**: It communicates simultaneously with independent UCP Servers (L'Oreal and Sephora backends) to create checkout sessions.
- **Result**: Returns a "Split Checkout" plan for user confirmation.

### 4. UCP Servers (The Brands) - Ports 8182 & 8282
- **Responsibility**: Standardized commerce backends for L'Oreal and Sephora.
- **Action**: They receive the UCP requests from the Checkout Agent and store real transaction data in their respective databases.

---

## 🚀 How to Run the Demo

Everything has been automated for a one-click experience.

### Prerequisites
- Windows PowerShell.
- Running inside the `ucp` directory.

### Execution Command
Run this command in your VS Code terminal (or standard PowerShell):

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\run_all_services.ps1
```

### What Happens Next?
1. **Background Services**: Five new PowerShell windows will open, each running one of the services described above.
2. **Visualizer UI**: Your default browser will automatically open the **A2A Visualizer dashboard**.
3. **Initiate**: Click the **"Initiate A2A Flow"** button in the UI to see the live data flow and agent-to-agent negotiation in action!

---

## 📊 Visualizing the Flow
The included **Visualizer UI** provides a "The Matrix" style view of the protocol:
- **Blue Lines**: Orchestrator communicating with Agents.
- **Green Lines**: Agents communicating with UCP Brand Servers.
- **Live Logs**: Real-time A2A headers and JSON payloads visible in the sidebar.

---

## 🛠️ Tech Stack
- **Framework**: FastAPI (Python)
- **Protocol**: A2A (Agent-to-Agent) v0.3
- **Standards**: Universal Commerce Protocol (UCP)
- **AI Models**: Google Gemini 2.5 Flash (Discovery & Ranking)
- **Frontend**: Vanilla JS, CSS Animations, SVG Data Injection
