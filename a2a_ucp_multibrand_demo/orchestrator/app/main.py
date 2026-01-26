import os
from typing import Any, Dict, List
from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv

from shared.app.a2a_client import a2a_get_agent_card, a2a_invoke

load_dotenv()

app = FastAPI(title="Orchestrator (A2A)", version="1.0")

DISCOVERY_URL = os.getenv("DISCOVERY_AGENT_URL", "http://localhost:7002")
CHECKOUT_URL  = os.getenv("CHECKOUT_AGENT_URL", "http://localhost:7001")

def _pick_top_result(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    # Keep demo small: choose 1 best candidate per brand query
    return results[:1] if results else []

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/demo/agent-cards")
def agent_cards():
    """
    Shows how the orchestrator discovers each agent’s capabilities via agent-card.json
    """
    return {
        "discoveryAgentCard": a2a_get_agent_card(DISCOVERY_URL),
        "checkoutAgentCard": a2a_get_agent_card(CHECKOUT_URL),
    }

@app.post("/demo/run")
def run_demo(body: Dict[str, Any]):
    """
    body:
    {
      "request": "Find vitamin C serum from L’Oréal and matte lipstick from Sephora under $60 and checkout",
      "confirm": false
    }
    """
    user_request = (body.get("request") or "").strip()
    confirm = bool(body.get("confirm", False))
    if not user_request:
        raise HTTPException(status_code=400, detail="request is required")

    # 1) Call Discovery Agent (A2A)
    # We do two focused searches (one per brand). This makes the demo stable.
    loreal_q = "L'Oreal vitamin C serum under $60"
    sephora_q = "Sephora matte lipstick under $60"

    loreal = a2a_invoke(DISCOVERY_URL, "web_search_ranked", {"query": loreal_q, "num": 8})
    sephora = a2a_invoke(DISCOVERY_URL, "web_search_ranked", {"query": sephora_q, "num": 8})

    items_by_brand = {
        "LOreal": loreal.get("chosen"),
        "Sephora": sephora.get("chosen"),
    }

    # 2) Call Checkout Agent to create split checkout (A2A)
    created = a2a_invoke(CHECKOUT_URL, "create_split_checkout", {"itemsByBrand": items_by_brand})

    # 3) Require confirm for completing purchase
    if not confirm:
        return {
            "ok": True,
            "itemsByBrand": items_by_brand,
            "created": created,
            "plan_text": created.get("plan_text"),
            "message": "Set confirm=true to complete checkout.",
        }

    # 4) Complete
    receipts = a2a_invoke(CHECKOUT_URL, "complete_split_checkout", {"created": created.get("created", {})})

    return {
        "ok": True,
        "itemsByBrand": items_by_brand,
        "created": created,
        "receipts": receipts,
    }
