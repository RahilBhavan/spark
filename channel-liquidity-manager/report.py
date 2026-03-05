"""
Node health report: aggregate snapshots + events for a period (day/week).
Output: Markdown string and summary dict for API or file export.
"""
import sqlite3
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Optional


def _grade_from_ratios(ratios: list[float]) -> str:
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


def build_report(
    conn: sqlite3.Connection,
    period: str = "day",
) -> tuple[str, dict[str, Any]]:
    """
    Build report for last 24h (day) or 7d (week).
    Returns (markdown_text, summary_dict).
    """
    now = datetime.now(timezone.utc)
    if period == "week":
        since = now - timedelta(days=7)
    else:
        since = now - timedelta(hours=24)
    since_iso = since.isoformat()

    summary: dict[str, Any] = {
        "period": period,
        "since": since_iso,
        "node_grade": None,
        "channels_n": 0,
        "total_fees_sats": 0,
        "rebalance_count": 0,
        "rebalance_success_count": 0,
        "top_imbalanced": [],
    }

    # Latest snapshot: node grade + channel list
    cur = conn.execute("SELECT MAX(ts) AS ts FROM snapshots")
    row = cur.fetchone()
    max_ts = row[0] if row and row[0] else None
    if not max_ts:
        md = f"# SPARK BTC Report ({period})\n\nNo snapshot data.\n"
        return md, summary

    cur = conn.execute(
        """
        SELECT chan_id, alias, local_balance, capacity, ratio, health
        FROM snapshots WHERE ts = ?
        ORDER BY abs(ratio - 0.5) DESC
        """,
        (max_ts,),
    )
    snapshots = [dict(r) for r in cur.fetchall()]

    ratios = [s["ratio"] for s in snapshots]
    summary["node_grade"] = _grade_from_ratios(ratios)
    summary["channels_n"] = len(snapshots)
    summary["top_imbalanced"] = snapshots[:10]

    # Events in period: total fees, count, success count
    cur = conn.execute(
        """
        SELECT amount_sats, fee_sats, success
        FROM events WHERE ts >= ?
        """,
        (since_iso,),
    )
    events = list(cur.fetchall())
    total_fees = sum(e[1] for e in events)
    success_count = sum(1 for e in events if e[2] == 1)
    summary["total_fees_sats"] = total_fees
    summary["rebalance_count"] = len(events)
    summary["rebalance_success_count"] = success_count

    # Markdown
    lines = [
        "# SPARK BTC Node Health Report",
        "",
        f"**Period:** {period} (since {since.strftime('%Y-%m-%d %H:%M UTC')})",
        f"**Snapshot:** {max_ts}",
        "",
        "## Summary",
        "",
        f"- **Node grade:** {summary['node_grade']}",
        f"- **Channels:** {summary['channels_n']}",
        f"- **Rebalances in period:** {summary['rebalance_count']} ({success_count} succeeded)",
        f"- **Total fees (period):** {total_fees:,} sats",
        "",
        "## Top 10 imbalanced channels (latest snapshot)",
        "",
        "| Alias | Capacity | Ratio | Health |",
        "|-------|----------|-------|--------|",
    ]
    for s in snapshots[:10]:
        alias = (s["alias"] or "?")[:12]
        cap = s["capacity"]
        ratio = s["ratio"]
        health = s["health"]
        lines.append(f"| {alias} | {cap:,} | {ratio:.1%} | {health} |")
    lines.append("")
    md = "\n".join(lines)
    return md, summary


def get_report(
    db_path: str | Path, period: str = "day"
) -> tuple[str, dict[str, Any]]:
    """Open DB, build report, return (markdown, summary)."""
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        return build_report(conn, period=period)
    finally:
        conn.close()
