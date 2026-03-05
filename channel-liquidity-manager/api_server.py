"""
Read-only HTTP API for SPARK BTC dashboard.
Serves channel snapshots, rebalance events, node summary, and config from SQLite/env.
Run separately: python api_server.py (default port 5000).
Set REBALANCER_DB_PATH if rebalancer.db is not in cwd.
"""
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from flask import Flask, jsonify, request, Response
from flask_cors import CORS

try:
    from config import (
        get_estimated_extra_cost_per_forward_sats,
        get_target_ratio_high,
        get_target_ratio_low,
    )
except ImportError:
    def get_target_ratio_low():
        return float(os.getenv("TARGET_RATIO_LOW", "0.40"))
    def get_target_ratio_high():
        return float(os.getenv("TARGET_RATIO_HIGH", "0.60"))
    def get_estimated_extra_cost_per_forward_sats():
        v = os.getenv("ESTIMATED_EXTRA_COST_PER_FORWARD_SATS", "").strip()
        return max(0, int(v)) if v and v.isdigit() else None

app = Flask(__name__)
CORS(app)
DB = Path(os.getenv("REBALANCER_DB_PATH", "rebalancer.db"))


@contextmanager
def get_db():
    if not DB.exists():
        yield None
        return
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


@app.route("/api/config")
def config():
    """Current target ratio band and optional fee heuristic for dashboard/simulator."""
    payload = {
        "target_ratio_low": get_target_ratio_low(),
        "target_ratio_high": get_target_ratio_high(),
    }
    extra = get_estimated_extra_cost_per_forward_sats()
    if extra is not None:
        payload["estimated_extra_cost_per_forward_sats"] = extra
    return jsonify(payload)


@app.route("/health")
def health():
    """Liveness: API is up and DB is readable (if present)."""
    with get_db() as conn:
        ok = conn is not None
    return jsonify({"status": "ok", "db_attached": ok})


@app.route("/api/status")
def status():
    """
    Summary for status strip: channel count, last snapshot time,
    rebalance count (today), and optional node grade inputs.
    """
    with get_db() as conn:
        if conn is None:
            return jsonify({
                "channels_n": 0,
                "last_snapshot_ts": None,
                "rebalance_count_today": 0,
                "node_grade": None,
                "source": "none",
            })

        cur = conn.execute(
            "SELECT COUNT(DISTINCT chan_id) AS n FROM snapshots WHERE ts = (SELECT MAX(ts) FROM snapshots)"
        )
        row = cur.fetchone()
        channels_n = row["n"] if row else 0

        cur = conn.execute("SELECT MAX(ts) AS ts FROM snapshots")
        row = cur.fetchone()
        last_snapshot_ts = row["ts"] if row and row["ts"] else None

        cur = conn.execute(
            """
            SELECT COUNT(*) AS n FROM events
            WHERE date(ts) = date('now') AND success = 1
            """
        )
        row = cur.fetchone()
        rebalance_count_today = row["n"] if row else 0

        # Latest ratios for a simple "node grade" (average distance from 0.5)
        cur = conn.execute(
            """
            SELECT ratio FROM snapshots
            WHERE ts = (SELECT MAX(ts) FROM snapshots)
            """
        )
        ratios = [r["ratio"] for r in cur.fetchall()]
        node_grade = _grade_from_ratios(ratios) if ratios else None

    return jsonify({
        "channels_n": channels_n,
        "last_snapshot_ts": last_snapshot_ts,
        "rebalance_count_today": rebalance_count_today,
        "node_grade": node_grade,
        "source": "sqlite",
    })


def _grade_from_ratios(ratios: list) -> str:
    """Simple A–F grade from average distance from 0.5 (lower is better)."""
    if not ratios:
        return "—"
    avg_dev = sum(abs(r - 0.5) for r in ratios) / len(ratios)
    if avg_dev <= 0.05:
        return "A"
    if avg_dev <= 0.10:
        return "B"
    if avg_dev <= 0.20:
        return "C"
    if avg_dev <= 0.35:
        return "D"
    return "F"


@app.route("/api/snapshots/latest")
def snapshots_latest():
    """Latest channel snapshot rows for dashboard tables/charts."""
    with get_db() as conn:
        if conn is None:
            return jsonify({"snapshots": [], "ts": None})

        cur = conn.execute("SELECT MAX(ts) AS ts FROM snapshots")
        row = cur.fetchone()
        max_ts = row["ts"] if row and row["ts"] else None
        if not max_ts:
            return jsonify({"snapshots": [], "ts": None})

        cur = conn.execute(
            "SELECT chan_id, alias, local_balance, capacity, ratio, health FROM snapshots WHERE ts = ?",
            (max_ts,),
        )
        snapshots = [dict(r) for r in cur.fetchall()]

    return jsonify({"snapshots": snapshots, "ts": max_ts})


@app.route("/api/rebalances/recent")
def rebalances_recent():
    """Last N rebalance events (success and failure)."""
    limit = min(int(os.getenv("LIMIT", "20")), 100)
    with get_db() as conn:
        if conn is None:
            return jsonify({"events": []})

        cur = conn.execute(
            """
            SELECT ts, chan_id, amount_sats, fee_sats, fee_ppm, success, error
            FROM events ORDER BY ts DESC LIMIT ?
            """,
            (limit,),
        )
        events = [dict(r) for r in cur.fetchall()]

    return jsonify({"events": events})


@app.route("/api/report")
def report():
    """
    Node health report for period=day|week.
    Returns JSON with markdown and summary; or raw markdown if ?format=md.
    """
    period = request.args.get("period", "day").strip().lower()
    if period not in ("day", "week"):
        period = "day"
    with get_db() as conn:
        if conn is None:
            if request.args.get("format") == "md":
                return Response(
                    "# SPARK BTC Report\n\nNo database.\n",
                    mimetype="text/markdown",
                )
            return jsonify({
                "markdown": "# SPARK BTC Report\n\nNo database.\n",
                "summary": {
                    "period": period,
                    "node_grade": None,
                    "channels_n": 0,
                    "total_fees_sats": 0,
                    "rebalance_count": 0,
                    "rebalance_success_count": 0,
                    "top_imbalanced": [],
                },
            })
        try:
            from report import build_report
            markdown, summary = build_report(conn, period=period)
        except Exception:
            if request.args.get("format") == "md":
                return Response(
                    "# SPARK BTC Report\n\nError generating report.\n",
                    mimetype="text/markdown",
                    status=500,
                )
            return jsonify({
                "markdown": "# SPARK BTC Report\n\nError generating report.\n",
                "summary": {},
            }), 500
    if request.args.get("format") == "md":
        return Response(markdown, mimetype="text/markdown")
    return jsonify({"markdown": markdown, "summary": summary})


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
