# UCP Demo Payloads

This document allows you to copy-paste payloads for the various services during your demo.

## 1. Orchestrator
**Endpoint:** `POST http://localhost:7000/demo/run`  
**Description:** Runs the full orchestrated flow (Discovery -> Checkout).

```json
{
  "request": "Find vitamin C serum from L'Oreal and matte lipstick from Sephora under $60 and checkout",
  "confirm": false
}
```

---

## 2. Discovery Agent
**Endpoint:** `POST http://localhost:7002/a2a/invoke`  
**Description:** Tests the agent's ability to search and rank results using Gemini.

```json
{
  "action": "web_search_ranked",
  "payload": {
    "query": "best retinol serum 2024",
    "num": 3
  }
}
```

---

## 3. UCP Server (Direct Checkout Creation)
**Endpoint:** `POST http://localhost:8282/checkout-sessions`  
**Description:** Manually creates a checkout session on the UCP server (e.g., L'Oreal server on 8282). This mimics what the Checkout Agent does.

**Headers:**
- `Content-Type`: `application/json`
- `Authorization`: `Bearer dev-secret` (If simulation secret is enforced, otherwise standard UCP might not need it for creation, but good to have context. Note: `server.py` checks `simulation_secret` mainly for simulation endpoints, standard UCP endpoints use standard auth or are open in this demo mode. Adding `Idempotency-Key` is required.)
- `Idempotency-Key`: `Key-{{$timestamp}}` (Use a unique string, e.g., `test-key-1`)

**Body:**
```json
{
  "line_items": [
    {
      "quantity": 1,
      "item": {
        "id": "sku-123",
        "title": "vitamin c serum"
      }
    }
  ],
  "currency": "USD",
  "payment": {
    "selected_instrument_id": "inst-1",
    "instruments": [
      {
        "id": "inst-1",
        "type": "card",
        "brand": "visa",
        "last_digits": "1111",
        "credential": {
            "token": "success_token", 
            "number": "4111111111111111" 
        },
        "handler_id": "mock_payment_handler"
      }
    ]
  },
  "buyer": {
    "name": "Demo User",
    "email": "demo@example.com"
  }
}
```

---

## 4. UCP Server (Get Checkout)
**Endpoint:** `GET http://localhost:8282/checkout-sessions/{checkout_id}`  
**Description:** Retrieves the details of a created checkout session.
Replace `{checkout_id}` with the ID returned from the creation step.

---

## Checks
- **UCP Sephora Health:** `http://localhost:8182/.well-known/ucp`
- **UCP L'Oreal Health:** `http://localhost:8282/.well-known/ucp`
