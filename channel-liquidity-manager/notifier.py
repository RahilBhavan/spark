"""
Alerts for SPARK BTC: webhook (Discord/Telegram bridge) and optional email.
Triggered by critical channel ratio or N consecutive rebalance failures.
"""
import logging
import os
import time
from typing import Optional

logger = logging.getLogger(__name__)

# Cooldown seconds per alert key to avoid spam (e.g. same critical channel every 5 min)
ALERT_COOLDOWN_SEC = 60 * 15  # 15 minutes
_last_alert_ts: dict[str, float] = {}


def _cooldown_key(kind: str, chan_id: str) -> str:
    return f"{kind}:{chan_id}"


def _check_cooldown(key: str) -> bool:
    now = time.monotonic()
    last = _last_alert_ts.get(key, 0)
    if now - last < ALERT_COOLDOWN_SEC:
        return False
    _last_alert_ts[key] = now
    return True


def _alert_level() -> str:
    return (os.getenv("ALERT_LEVEL") or "critical").strip().lower()


def _send_webhook(message: str) -> bool:
    url = os.getenv("ALERT_WEBHOOK_URL", "").strip()
    if not url:
        return False
    try:
        import urllib.request
        import json
        body = json.dumps({"content": message}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return 200 <= resp.status < 300
    except Exception as e:
        logger.warning("Alert webhook failed: %s", e)
        return False


def _send_email(subject: str, message: str) -> bool:
    api_key = os.getenv("ALERT_EMAIL_API_KEY", "").strip()
    from_addr = os.getenv("ALERT_EMAIL_FROM", "").strip()
    to_addr = os.getenv("ALERT_EMAIL_TO", "").strip()
    if not api_key or not from_addr or not to_addr:
        return False
    try:
        import urllib.request
        import json
        body = json.dumps({
            "personalizations": [{"to": [{"email": to_addr}]}],
            "from": {"email": from_addr, "name": "SPARK BTC"},
            "subject": subject,
            "content": [{"type": "text/plain", "value": message}],
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://api.sendgrid.com/v3/mail/send",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return 200 <= resp.status < 300
    except Exception as e:
        logger.warning("Alert email failed: %s", e)
        return False


def send_alert(message: str, subject: Optional[str] = None) -> None:
    """Send alert via webhook and/or email if configured and ALERT_LEVEL allows."""
    level = _alert_level()
    if level == "off":
        return
    if subject is None:
        subject = "SPARK BTC Alert"
    _send_webhook(message)
    _send_email(subject, message)


def check_critical_channels(snapshots: list[dict]) -> None:
    """
    Called after snapshot_job: alert for any channel with ratio < 0.2 or > 0.8.
    snapshots: list of dicts with chan_id, alias, ratio (and optionally health).
    """
    if _alert_level() == "off":
        return
    for row in snapshots:
        r = row.get("ratio")
        if r is None:
            continue
        if r < 0.2 or r > 0.8:
            key = _cooldown_key("critical", row.get("chan_id", ""))
            if not _check_cooldown(key):
                continue
            alias = row.get("alias", "?")
            pct = round(r * 100)
            msg = f"SPARK BTC: Critical channel {alias} — ratio {pct}% (target band 20–80%)."
            send_alert(msg)
            logger.info("Alert sent: critical channel %s", alias)


def check_rebalance_failure_streak(conn, streak_n: int = 3) -> None:
    """
    Called after rebalance_job: alert if any channel has N consecutive failures.
    conn: sqlite3 connection (read-only query).
    """
    if _alert_level() == "off":
        return
    cur = conn.execute(
        """
        SELECT chan_id, ts, success FROM events
        ORDER BY ts DESC
        """
    )
    rows = list(cur.fetchall())
    # Group by chan_id, take most recent streak_n; if all success=0, alert
    by_chan: dict[str, list[int]] = {}
    for row in rows:
        cid = row[0]
        if cid not in by_chan:
            by_chan[cid] = []
        if len(by_chan[cid]) < streak_n:
            by_chan[cid].append(int(row[2]))
    for chan_id, successes in by_chan.items():
        if len(successes) == streak_n and all(s == 0 for s in successes):
            key = _cooldown_key("streak", chan_id)
            if not _check_cooldown(key):
                continue
            msg = f"SPARK BTC: Channel {chan_id} has {streak_n} consecutive rebalance failures."
            send_alert(msg)
            logger.info("Alert sent: failure streak for channel %s", chan_id)
