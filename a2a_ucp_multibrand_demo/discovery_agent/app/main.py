import os
import json
import re
import requests
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Header, HTTPException
from dotenv import load_dotenv

from google import genai

load_dotenv()

app = FastAPI(title="Discovery Agent (A2A + Gemini)", version="1.0")

SERPER_URL = "https://google.serper.dev/search"

# ---- Gemini client ----
def _gemini_client() -> genai.Client:
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GOOGLE_API_KEY in .env for Gemini.")
    return genai.Client(api_key=api_key)

def _safe_json_extract(text: str) -> Optional[Dict[str, Any]]:
    """
    Gemini might return JSON wrapped in text. Extract the first JSON object.
    """
    if not text:
        return None
    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None

def serper_search(query: str, num: int = 8) -> List[Dict[str, Any]]:
    """
    Safe discovery:
    - Uses search API
    - Returns title/snippet/link only
    - No scraping
    """
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        raise RuntimeError("Missing SERPER_API_KEY in .env")

    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
    payload = {"q": query, "num": num}

    r = requests.post(SERPER_URL, json=payload, headers=headers, timeout=20)
    r.raise_for_status()
    data = r.json()

    results = []
    for item in data.get("organic", [])[:num]:
        results.append({
            "title": item.get("title"),
            "snippet": item.get("snippet"),
            "link": item.get("link"),
        })
    return results

def pick_best_with_gemini(user_intent: str, results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Uses Gemini 2.5 Flash to select the best result for the user's intent.
    Returns one chosen item + short reason.
    """
    if not results:
        return {"chosen": None, "reason": "No results"}

    client = _gemini_client()

    # Keep prompt very explicit: return strict JSON.
    prompt = {
        "intent": user_intent,
        "results": results,
        "instruction": (
            "Pick the single best result for the intent. Prefer official product pages or major retailers.\n"
            "Return STRICT JSON only with keys: chosen_index (0-based int), reason (string).\n"
            "Do not include markdown. Do not include extra keys."
        ),
    }

    resp = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=json.dumps(prompt),
    )

    text = getattr(resp, "text", None) or ""
    parsed = _safe_json_extract(text) or {}

    idx = parsed.get("chosen_index")
    reason = parsed.get("reason", "Selected by Gemini ranking")

    # Fallback: if Gemini didn't return a valid index
    if not isinstance(idx, int) or idx < 0 or idx >= len(results):
        idx = 0
        reason = "Fallback to first result (Gemini output not parseable)"

    return {"chosen": results[idx], "chosen_index": idx, "reason": reason}

@app.get("/.well-known/agent-card.json")
def agent_card(a2a_version: str | None = Header(default=None, alias="A2A-Version")):
    return {
        "name": "discovery-agent",
        "description": "Web-search discovery + Gemini ranking (picks best result).",
        "protocolVersions": ["0.3"],
        "skills": [
            {
                "id": "web_search_ranked",
                "description": "Search web and return best result selected by Gemini 2.5 Flash.",
                "inputSchema": {"type": "object", "properties": {"query": {"type": "string"}}},
                "outputSchema": {"type": "object", "properties": {"chosen": {"type": "object"}}},
            }
        ],
    }

@app.post("/a2a/invoke")
def invoke(body: Dict[str, Any], a2a_version: str | None = Header(default=None, alias="A2A-Version")):
    action = body.get("action")
    payload = body.get("payload") or {}

    if action != "web_search_ranked":
        raise HTTPException(status_code=400, detail=f"Unsupported action: {action}")

    query = (payload.get("query") or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="payload.query is required")

    # 1) Search
    results = serper_search(query, num=int(payload.get("num", 8)))

    # 2) Gemini picks best
    ranked = pick_best_with_gemini(query, results)

    return {"ok": True, "query": query, "results": results, **ranked}
