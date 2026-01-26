# UCP & A2A Demo Guide

This guide provides the technical steps to run your demo and a narrative script to explain the concepts to your audience.

## Part 1: Technical Execution

### 1. Start the Environment
1.  Open **Windows PowerShell**.
2.  Navigate to your project root (if not already there):
    ```powershell
    cd C:\Users\stungare\sanikaperf\git\ucp
    ```
3.  **Run the automated script**:
    ```powershell
    .\run_all_services.ps1
    ```
    *This will open 5 new windows, one for each service (Servers x2, Agents x3).*

### 2. Prepare for Demo (Open these URLs in tabs)

**Demonstrate that everything is running:**

*   **Orchestrator (The Planner):**
    *   Swagger UI: [http://localhost:7000/docs](http://localhost:7000/docs)
    *   Agent Card: [http://localhost:7000/.well-known/agent-card.json](http://localhost:7000/.well-known/agent-card.json)

*   **Discovery Agent ( The Searcher):**
    *   Swagger UI: [http://localhost:7002/docs](http://localhost:7002/docs)
    *   Agent Card: [http://localhost:7002/.well-known/agent-card.json](http://localhost:7002/.well-known/agent-card.json)

*   **Checkout Agent (The Buyer):**
    *   Swagger UI: [http://localhost:7001/docs](http://localhost:7001/docs)
    *   Agent Card: [http://localhost:7001/.well-known/agent-card.json](http://localhost:7001/.well-known/agent-card.json)

*   **UCP Server 1 (Sephora - Port 8182):**
    *   Swagger UI: [http://localhost:8182/docs](http://localhost:8182/docs)
    *   UCP Identity: [http://localhost:8182/.well-known/ucp](http://localhost:8182/.well-known/ucp)
    *   *Note: Visiting `http://localhost:8182` directly will show "Not Found" because it's an API server, not a website.*

*   **UCP Server 2 (L'Oreal - Port 8282):**
    *   Swagger UI: [http://localhost:8282/docs](http://localhost:8282/docs)
    *   UCP Identity: [http://localhost:8282/.well-known/ucp](http://localhost:8282/.well-known/ucp)

- Have the **Payloads File** open: `C:\Users\stungare\sanikaperf\git\ucp\demo_payloads.md`

### 3. Run the Demo (The "Wow" Moment)
1.  Go to the Orchestrator page.
2.  Expand `POST /demo/run`.
3.  Click **Try it out**.
4.  Paste the **Orchestrator Payload** from your `demo_payloads.md` file:
    ```json
    {
      "request": "Find vitamin C serum from L'Oreal and matte lipstick from Sephora under $60 and checkout",
      "confirm": false
    }
    ```
5.  Click **Execute**.
6.  Show the **200 Response** with the plan.

---

## Part 2: The Narrative (What to tell your viewers)

### The Problem
*"Today, if I want to buy products from L'Oreal and Sephora, I have to visit two different websites, create two different carts, and checkout twice. AI agents struggle with this because every website is built differently. There is no standard way for an AI to 'Shop'."*

### The Solution: UCP (Universal Commerce Protocol)
*"UCP is that standard. It's like HTTP for shopping. It allows L'Oreal and Sephora to speak the same language. By running a UCP Server (like we are on ports 8182 and 8282), these brands expose a standardized way to browse products, create carts, and process orders that any AI can understand."*

### The Power of A2A (Agent-to-Agent)
*"But a standard isn't enough. We need intelligence. That's where the **Agent-to-Agent (A2A)** framework comes in. Instead of one giant, complex AI trying to do everything, we have a team of specialists:"*

1.  **The Orchestrator (The Boss):** *"This is the 'Brain' (Port 7000). It takes my complex goal—'Buy form L'Oreal AND Sephora'—and breaks it down."*
2.  **The Discovery Agent (The Researcher):** *"This agent (Port 7002) is responsible for finding the best products. It uses Gemini to search and rank items, finding the 'Vitamin C Serum' and 'Matte Lipstick'."*
3.  **The Checkout Agent (The Doer):** *"Once items are found, the Orchestrator tells this agent (Port 7001) to buy them. Because of UCP, this agent knows exactly how to talk to both L'Oreal and Sephora's backends without needing custom code for each one."*

### The Demo Walkthrough Script
*"Let me show you this in action."*
1.  *(Run the Orchestrator Payload)*
2.  *"I'm sending a natural language request. I'm not specifying IDs or URLs. I'm just saying what I want."*
3.  *(Point to the success response)*
4.  *"Look at this. The system automatically:
    - Searched the web for the best products.
    - Found the L'Oreal Serum.
    - Found the Sephora Lipstick.
    - **And most importantly**, it created checkout sessions on both independent UCP servers simultaneously."*
5.  *"This demonstrates how UCP bridges independent brands, and A2A allows specialized AI agents to collaborate to solve complex user tasks."*

---

## Part 3: showing the "Stack" (The Matrix View)
To prove the agents are actually talking to each other, use the terminal windows we launched.

1.  **Arrange your windows**: Tile the 5 PowerShell windows so they are all visible.
2.  **Run the Request again**: Click **Execute** in the Orchestrator UI.
3.  **Watch the Logs fly**:
    *   **Orchestrator Window (:7000)**: You'll see it receive the request `POST /demo/run`.
    *   **Discovery Window (:7002)**: You'll see `POST /a2a/invoke` (Action: `web_search_ranked`). *Narrative: "See! The Orchestrator just called the Discovery Agent to research."*
    *   **Checkout Window (:7001)**: You'll see `POST /a2a/invoke` (Action: `create_split_checkout`). *Narrative: "Now it's calling the Checkout Agent to buy the items found."*
    *   **UCP Server Windows (:8182 / :8282)**: You'll see `POST /checkout-sessions`. *Narrative: "And almost instantly, the Checkout Agent is speaking UCP to both L'Oreal and Sephora servers."*


---

## Part 4: Verifying the Backend Data (The "Receipt")
To prove this wasn't just a simulation, let's look at the actual data on the **Sephora UCP Server**.

1.  **Get the ID**: Look at the Orchestrator's JSON response. Find the `created` section for **Sephora** and copy the `checkout_id` (it will look like a UUID).
2.  **Go to Sephora's Backend**: Open the [Sephora Swagger UI](http://localhost:8182/docs).
3.  **Inspect the Data**:
    *   Expand `GET /checkout-sessions/{id}`.
    *   Click **Try it out**.
    *   Paste the `checkout_id`.
    *   Click **Execute**.
4.  **The Reveal**:
    *   Show the response body.
    *   Point out the **"Matte Lipstick"** in `line_items`.
    *   *Narrative: "This ID exists in the Sephora database. The Checkout Agent successfully negotiated with the Sephora backend to create this real transaction."*


