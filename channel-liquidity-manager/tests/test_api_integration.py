"""
Integration tests for Flask API: real SQLite DB, app test client.
"""
import os
import sqlite3
import tempfile
from pathlib import Path

import pytest


def _create_db_with_data(path: str) -> None:
    conn = sqlite3.connect(path)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY, ts TEXT, chan_id TEXT,
        amount_sats INTEGER, fee_sats INTEGER, fee_ppm REAL,
        success INTEGER, error TEXT)"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY, ts TEXT, chan_id TEXT, alias TEXT,
        local_balance INTEGER, capacity INTEGER, ratio REAL, health TEXT)"""
    )
    conn.execute(
        """INSERT INTO snapshots (ts, chan_id, alias, local_balance, capacity, ratio, health)
        VALUES ('2025-01-15T12:00:00Z', 'chan1', 'alice', 500000, 1000000, 0.5, 'HEALTHY')"""
    )
    conn.execute(
        """INSERT INTO events (ts, chan_id, amount_sats, fee_sats, fee_ppm, success, error)
        VALUES ('2025-01-15T12:05:00Z', 'chan1', 100000, 50, 500.0, 1, NULL)"""
    )
    conn.commit()
    conn.close()


def test_error_response_shape():
    """404/5xx return consistent { error, message } (OpenAPI contract)."""
    import api_server
    client = api_server.app.test_client()
    r = client.get("/nonexistent")
    assert r.status_code == 404
    data = r.get_json()
    assert data["error"] == "not_found"
    assert "message" in data


def test_health_returns_ok():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp.close()
        path = tmp.name
    try:
        os.environ["REBALANCER_DB_PATH"] = path
        _create_db_with_data(path)
        import importlib
        import api_server
        importlib.reload(api_server)
        client = api_server.app.test_client()
        r = client.get("/health")
        assert r.status_code == 200
        data = r.get_json()
        assert data["status"] == "ok"
        assert data["db_attached"] is True
    finally:
        os.environ.pop("REBALANCER_DB_PATH", None)
        if os.path.exists(path):
            os.unlink(path)


def test_api_status_returns_summary():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp.close()
        path = tmp.name
    try:
        os.environ["REBALANCER_DB_PATH"] = path
        _create_db_with_data(path)
        import importlib
        import api_server
        importlib.reload(api_server)
        client = api_server.app.test_client()
        r = client.get("/api/status")
        assert r.status_code == 200
        data = r.get_json()
        assert "channels_n" in data
        assert "last_snapshot_ts" in data
        assert "rebalance_count_today" in data
        assert "node_grade" in data
        assert data["source"] == "sqlite"
        assert data["channels_n"] == 1
        assert "rebalance_success_rate_24h" in data
        # With test data from 2025, 24h window may have 0 events → None; or rate in [0,1]
        assert data["rebalance_success_rate_24h"] is None or (
            0 <= data["rebalance_success_rate_24h"] <= 1
        )
    finally:
        os.environ.pop("REBALANCER_DB_PATH", None)
        if os.path.exists(path):
            os.unlink(path)


def test_api_snapshots_latest_returns_list():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp.close()
        path = tmp.name
    try:
        os.environ["REBALANCER_DB_PATH"] = path
        _create_db_with_data(path)
        import importlib
        import api_server
        importlib.reload(api_server)
        client = api_server.app.test_client()
        r = client.get("/api/snapshots/latest")
        assert r.status_code == 200
        data = r.get_json()
        assert "snapshots" in data
        assert "ts" in data
        assert len(data["snapshots"]) == 1
        row = data["snapshots"][0]
        assert row["chan_id"] == "chan1"
        assert row["alias"] == "alice"
        assert row["ratio"] == 0.5
        assert row["health"] == "HEALTHY"
    finally:
        os.environ.pop("REBALANCER_DB_PATH", None)
        if os.path.exists(path):
            os.unlink(path)


def test_api_rebalances_recent_returns_list():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp.close()
        path = tmp.name
    try:
        os.environ["REBALANCER_DB_PATH"] = path
        _create_db_with_data(path)
        import importlib
        import api_server
        importlib.reload(api_server)
        client = api_server.app.test_client()
        r = client.get("/api/rebalances/recent")
        assert r.status_code == 200
        data = r.get_json()
        assert "events" in data
        assert len(data["events"]) == 1
        ev = data["events"][0]
        assert ev["chan_id"] == "chan1"
        assert ev["amount_sats"] == 100000
        assert ev["success"] == 1
    finally:
        os.environ.pop("REBALANCER_DB_PATH", None)
        if os.path.exists(path):
            os.unlink(path)


def test_health_when_db_missing():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp.close()
        path = tmp.name
    os.unlink(path)
    try:
        os.environ["REBALANCER_DB_PATH"] = path
        import importlib
        import api_server
        importlib.reload(api_server)
        client = api_server.app.test_client()
        r = client.get("/health")
        assert r.status_code == 200
        data = r.get_json()
        assert data["status"] == "ok"
        assert data["db_attached"] is False
    finally:
        os.environ.pop("REBALANCER_DB_PATH", None)
