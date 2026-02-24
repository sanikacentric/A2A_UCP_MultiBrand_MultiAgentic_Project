import uuid
import json
import sqlite3
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


def create_app(products_db_path: str, transactions_db_path: str, simulation_secret: str) -> FastAPI:
    app = FastAPI(title="UCP Brand Server", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ---------- DB init --------------------------------------------------
    def get_conn():
        conn = sqlite3.connect(transactions_db_path)
        conn.row_factory = sqlite3.Row
        return conn

    with get_conn() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS checkout_sessions (
                id            TEXT PRIMARY KEY,
                status        TEXT NOT NULL DEFAULT 'pending',
                currency      TEXT NOT NULL DEFAULT 'USD',
                line_items    TEXT NOT NULL DEFAULT '[]',
                created_at    TEXT NOT NULL,
                completed_at  TEXT
            )
        """)

    # ---------- Endpoints ------------------------------------------------

    @app.get("/health")
    def health():
        return {"ok": True}

    @app.get("/.well-known/ucp")
    def discover():
        """UCP capability manifest — agents call this first to probe the brand server."""
        return {
            "protocol": "UCP",
            "version": "1.0",
            "brand": "brand-server",
            "capabilities": ["checkout", "complete"],
            "currency": ["USD", "EUR", "GBP"],
            "endpoints": {
                "checkout_sessions": "/checkout-sessions"
            }
        }

    @app.post("/checkout-sessions", status_code=201)
    def create_checkout(
        request_body: Dict[str, Any],
        ucp_agent:        Optional[str] = Header(None, alias="UCP-Agent"),
        idempotency_key:  Optional[str] = Header(None, alias="idempotency-key"),
        request_id:       Optional[str] = Header(None, alias="request-id"),
    ):
        """Create a UCP checkout session for the supplied line items."""
        session_id = "cs_" + uuid.uuid4().hex[:14]
        created_at = datetime.utcnow().isoformat() + "Z"
        currency   = request_body.get("currency", "USD")
        line_items = request_body.get("line_items", [])

        with get_conn() as c:
            c.execute(
                "INSERT INTO checkout_sessions (id, status, currency, line_items, created_at) "
                "VALUES (?, 'pending', ?, ?, ?)",
                (session_id, currency, json.dumps(line_items), created_at),
            )

        return {
            "id":         session_id,
            "status":     "pending",
            "currency":   currency,
            "line_items": line_items,
            "created_at": created_at,
        }

    @app.post("/checkout-sessions/{session_id}/complete", status_code=200)
    def complete_checkout(
        session_id: str,
        ucp_agent:  Optional[str] = Header(None, alias="UCP-Agent"),
        request_id: Optional[str] = Header(None, alias="request-id"),
    ):
        """Complete (confirm payment for) an existing checkout session."""
        with get_conn() as c:
            row = c.execute(
                "SELECT * FROM checkout_sessions WHERE id = ?", (session_id,)
            ).fetchone()

            if not row:
                raise HTTPException(
                    status_code=404,
                    detail=f"Checkout session '{session_id}' not found",
                )

            completed_at = datetime.utcnow().isoformat() + "Z"
            c.execute(
                "UPDATE checkout_sessions SET status='completed', completed_at=? WHERE id=?",
                (completed_at, session_id),
            )

        return {
            "id":           session_id,
            "status":       "completed",
            "order_id":     "ord_" + uuid.uuid4().hex[:10],
            "completed_at": completed_at,
        }

    @app.get("/checkout-sessions")
    def list_sessions():
        """List all checkout sessions (useful for debugging)."""
        with get_conn() as c:
            rows = c.execute("SELECT * FROM checkout_sessions ORDER BY created_at DESC").fetchall()
        return {"sessions": [dict(r) for r in rows]}

    return app
