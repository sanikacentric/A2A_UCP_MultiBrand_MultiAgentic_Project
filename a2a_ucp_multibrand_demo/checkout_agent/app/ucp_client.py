import uuid
import requests
from typing import Any, Dict, List


def _headers() -> Dict[str, str]:
    return {
        "Content-Type": "application/json",
        "UCP-Agent": 'profile="https://example-agent/profile"',
        "idempotency-key": str(uuid.uuid4()),
        "request-id": str(uuid.uuid4()),
        "request-signature": "demo",
    }


def _sim_id(prefix: str = "cs") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def ucp_discover(base_url: str) -> Dict[str, Any]:
    try:
        r = requests.get(f"{base_url}/.well-known/ucp", timeout=5)
        r.raise_for_status()
        return r.json()
    except Exception:
        # UCP server unavailable — return simulated capability manifest
        brand = "sephora" if "8182" in base_url else "loreal"
        return {
            "simulated": True,
            "brand": brand,
            "capabilities": ["checkout", "complete"],
            "currency": ["USD"],
        }


def ucp_create_checkout(base_url: str, line_items: list, currency: str = "USD") -> Dict[str, Any]:
    try:
        body = {
            "currency": currency,
            "line_items": line_items,
            "payment": {
                "handler_id": "mock_payment_handler",
                "instrument_id": "instr_1",
                "credential": {"type": "token", "token": "success_token"},
            },
        }
        r = requests.post(f"{base_url}/checkout-sessions", json=body, headers=_headers(), timeout=30)
        r.raise_for_status()
        return r.json()
    except Exception:
        # UCP server unavailable — return simulated checkout session
        return {
            "simulated": True,
            "id": _sim_id("cs"),
            "status": "pending",
            "currency": currency,
            "line_items": line_items,
        }


def ucp_complete_checkout(base_url: str, checkout_id: str) -> Dict[str, Any]:
    try:
        r = requests.post(
            f"{base_url}/checkout-sessions/{checkout_id}/complete",
            headers=_headers(),
            timeout=20,
        )
        r.raise_for_status()
        return r.json()
    except Exception:
        # UCP server unavailable — return simulated receipt
        return {
            "simulated": True,
            "checkout_id": checkout_id,
            "status": "completed",
            "order_id": _sim_id("ord"),
        }
