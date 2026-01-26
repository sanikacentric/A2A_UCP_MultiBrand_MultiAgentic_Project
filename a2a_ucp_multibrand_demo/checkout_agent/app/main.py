import os
import json
import re
from typing import Any, Dict, List

from fastapi import FastAPI, Header, HTTPException
from dotenv import load_dotenv

from google import genai

from .ucp_client import ucp_discover, ucp_create_checkout, ucp_complete_checkout

load_dotenv()

app = FastAPI(title="Checkout Agent (A2A + Gemini)", version="1.0")

SEPHORA_BASE = os.getenv("SEPHORA_UCP_BASE", "http://localhost:8182")
LOREAL_BASE  = os.getenv("LOREAL_UCP_BASE", "http://localhost:8282")

def _gemini_client() -> genai.Client:
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GOOGLE_API_KEY in .env for Gemini.")
    return genai.Client(api_key=api_key)

def _brand_to_base(brand: str) -> str:
    b = brand.lower()
    if "seph" in b:
        return SEPHORA_BASE
    if "loreal" in b or "l'or" in b:
        return LOREAL_BASE
    raise ValueError(f"Unknown brand: {brand}")

def _build_line_item_from_web(web_item: Dict[str, Any]) -> Dict[str, Any]:
    """
    This sample UCP server has no public /products catalog endpoint.
    So we pass discovered web metadata as the item detail.
    """
    return {
        "item": {
            "id": web_item.get("id") or web_item.get("product_id") or "sku-123",
            "title": web_item.get("title") or web_item.get("name") or "vitamin c serum",
        },
        "quantity": 1,
    }

def build_plan_text_with_gemini(created: Dict[str, Any]) -> str:
    """
    Use Gemini to generate a human-friendly split-checkout plan
    (checkout IDs + items + 'Type CONFIRM' instruction).
    """
    client = _gemini_client()

    prompt = {
        "created": created,
        "instruction": (
            "Write a short, clear split-checkout plan for the user.\n"
            "Must include:\n"
            "- Two sections: Sephora and LOreal (if present)\n"
            "- Each section: item title + checkout session id\n"
            "- End with: 'Type CONFIRM to complete checkout.'\n"
            "Do NOT invent prices or claims.\n"
            "No markdown tables. Use simple bullet points."
        )
    }

    resp = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=json.dumps(prompt),
    )

    return getattr(resp, "text", "") or "Plan ready. Type CONFIRM to complete checkout."

@app.get("/.well-known/agent-card.json")
def agent_card(a2a_version: str | None = Header(default=None, alias="A2A-Version")):
    return {
        "name": "checkout-agent",
        "description": "Creates UCP checkouts and uses Gemini to present the split-checkout plan.",
        "protocolVersions": ["0.3"],
        "skills": [
            {"id": "create_split_checkout", "description": "Create one checkout per brand using UCP."},
            {"id": "complete_split_checkout", "description": "Complete all created checkouts (after CONFIRM)."},
        ],
    }

@app.post("/a2a/invoke")
def invoke(body: Dict[str, Any], a2a_version: str | None = Header(default=None, alias="A2A-Version")):
    action = body.get("action")
    payload = body.get("payload") or {}

    if action == "create_split_checkout":
        # Expected:
        # { "itemsByBrand": { "Sephora": {title,link,...}, "LOreal": {title,link,...} } }
        items_by_brand: Dict[str, Any] = payload.get("itemsByBrand") or {}
        if not items_by_brand:
            raise HTTPException(status_code=400, detail="payload.itemsByBrand is required")

        created: Dict[str, Any] = {}

        for brand, item in items_by_brand.items():
            if not item:
                continue

            try:
                base_url = _brand_to_base(brand)
            except Exception:
                continue

            # 1) UCP capability discovery
            manifest = ucp_discover(base_url)

            # 2) Create checkout session
            line_items = [_build_line_item_from_web(item)]
            checkout = ucp_create_checkout(base_url, line_items=line_items, currency="USD")

            created[brand] = {
                "ucpBase": base_url,
                "ucpManifest": manifest,
                "checkout": checkout,
                "lineItems": line_items,
            }

        if not created:
            raise HTTPException(status_code=400, detail="No valid brand items to checkout")

        # 3) Gemini writes the plan response
        plan_text = build_plan_text_with_gemini(created)

        return {"ok": True, "created": created, "plan_text": plan_text}

    if action == "complete_split_checkout":
        # Expected:
        # { "created": { ... } }
        created = payload.get("created") or {}
        if not created:
            raise HTTPException(status_code=400, detail="payload.created is required")

        receipts = {}
        for brand, data in created.items():
            base_url = data["ucpBase"]
            checkout_id = (data.get("checkout") or {}).get("id")
            if not checkout_id:
                continue
            receipt = ucp_complete_checkout(base_url, checkout_id)
            receipts[brand] = receipt

        return {"ok": True, "receipts": receipts}

    raise HTTPException(status_code=400, detail=f"Unsupported action: {action}")
