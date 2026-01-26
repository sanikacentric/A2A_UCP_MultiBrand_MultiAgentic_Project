import os
import requests
from typing import Any, Dict

def a2a_headers() -> Dict[str, str]:
    """
    A2A calls should include A2A-Version per spec guidance.
    (In real systems you'd also include auth headers/JWT/OAuth.)
    """
    version = os.getenv("A2A_VERSION", "0.3")
    return {
        "Content-Type": "application/json",
        "A2A-Version": version,
    }

def a2a_get_agent_card(base_url: str) -> Dict[str, Any]:
    """
    Standard well-known URI for agent capability discovery:
    /.well-known/agent-card.json
    """
    r = requests.get(f"{base_url}/.well-known/agent-card.json", headers=a2a_headers(), timeout=10)
    if not r.ok:
        print("A2A ERROR:", r.status_code, r.text)
    r.raise_for_status()
    return r.json()

def a2a_invoke(base_url: str, action: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Demo binding: POST /a2a/invoke
    (A2A spec supports multiple bindings; this keeps the demo lightweight.)
    """
    body = {"action": action, "payload": payload}
    r = requests.post(f"{base_url}/a2a/invoke", json=body, headers=a2a_headers(), timeout=30)
    if not r.ok:
        print("A2A ERROR:", r.status_code, r.text)
    r.raise_for_status()
    return r.json()
