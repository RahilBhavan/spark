"""
Daemon entrypoint: SQLite logging, 10m rebalance job, 5m snapshot job.
Optionally pushes metrics to InfluxDB when env is set.
Uses REBALANCER_DB_PATH (default rebalancer.db) so scheduler and API share the same DB.
"""
import logging
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger

from analyzer import get_all_scores
from rebalancer import run_cycle

# Align with rebalancer amount formula and max
REBALANCE_FACTOR = 0.80
MAX_SATS = 500_000
WINDOW_MINUTES = 10

logging.basicConfig(
    level=logging.INFO,
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("rebalancer.log"),
    ],
)
logger = logging.getLogger(__name__)
DB = Path(os.getenv("REBALANCER_DB_PATH", "rebalancer.db"))


def init_db() -> None:
    c = sqlite3.connect(str(DB))
    c.execute(
        """CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY, ts TEXT, chan_id TEXT,
        amount_sats INTEGER, fee_sats INTEGER, fee_ppm REAL,
        success INTEGER, error TEXT)"""
    )
    c.execute(
        """CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY, ts TEXT, chan_id TEXT, alias TEXT,
        local_balance INTEGER, capacity INTEGER, ratio REAL, health TEXT)"""
    )
    c.execute(
        """CREATE TABLE IF NOT EXISTS idempotency (
        chan_id TEXT, window_ts TEXT, amount_sats INTEGER, created_at TEXT,
        UNIQUE(chan_id, window_ts, amount_sats))"""
    )
    c.execute(
        """CREATE TABLE IF NOT EXISTS audit (
        id INTEGER PRIMARY KEY, ts TEXT, chan_id TEXT, amount_sats INTEGER,
        max_fee_sats INTEGER, success INTEGER, fee_sats INTEGER, error TEXT)"""
    )
    c.commit()
    c.close()


def _window_ts(dt: datetime) -> str:
    """10-min bucket in UTC for idempotency (e.g. 2025-01-15T12:00:00+00:00)."""
    mins = (dt.minute // WINDOW_MINUTES) * WINDOW_MINUTES
    return dt.replace(minute=mins, second=0, microsecond=0).isoformat()


def rebalance_job() -> None:
    from analyzer import get_candidates

    now = datetime.now(timezone.utc)
    window_ts = _window_ts(now)
    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row
    candidates = get_candidates()
    to_run: list = []
    for s in candidates:
        amount = min(int(s.imbalance_sats * REBALANCE_FACTOR), MAX_SATS)
        if amount < 10_000:
            continue
        row = conn.execute(
            "SELECT 1 FROM idempotency WHERE chan_id=? AND window_ts=? AND amount_sats=?",
            (s.chan_id, window_ts, amount),
        ).fetchone()
        if row is not None:
            logger.debug("Skip idempotent channel %s amount %s", s.chan_id, amount)
            continue
        to_run.append(s)
    conn.close()

    results = run_cycle(candidates=to_run[:5] if to_run else None)
    ts = now.isoformat()
    conn = sqlite3.connect(str(DB))
    max_fee_sats = lambda r: max(1, int(r.amount_sats * 500 / 1_000_000))  # same as rebalancer
    for r in results:
        conn.execute(
            "INSERT INTO events (ts, chan_id, amount_sats, fee_sats, fee_ppm, success, error) VALUES (?,?,?,?,?,?,?)",
            (ts, r.chan_id, r.amount_sats, r.fee_sats, r.fee_ppm, int(r.success), r.error),
        )
        conn.execute(
            "INSERT OR IGNORE INTO idempotency (chan_id, window_ts, amount_sats, created_at) VALUES (?,?,?,?)",
            (r.chan_id, window_ts, r.amount_sats, ts),
        )
        conn.execute(
            "INSERT INTO audit (ts, chan_id, amount_sats, max_fee_sats, success, fee_sats, error) VALUES (?,?,?,?,?,?,?)",
            (ts, r.chan_id, r.amount_sats, max_fee_sats(r), int(r.success), r.fee_sats, r.error or ""),
        )
    conn.commit()
    try:
        import notifier
        notifier.check_rebalance_failure_streak(conn, streak_n=3)
    except Exception:  # noqa: S110
        pass
    conn.close()
    try:
        import metrics
        for r in results:
            metrics.write_rebalance_result(r, datetime.now(timezone.utc))
    except Exception:  # noqa: S110
        pass


def snapshot_job() -> None:
    scores = get_all_scores(quiet=True)
    ts = datetime.now(timezone.utc)
    ts_iso = ts.isoformat()
    conn = sqlite3.connect(str(DB))
    conn.executemany(
        "INSERT INTO snapshots (ts, chan_id, alias, local_balance, capacity, ratio, health) VALUES (?,?,?,?,?,?,?)",
        [
            (ts_iso, s.chan_id, s.alias, s.local_balance, s.capacity, s.ratio, s.health.value)
            for s in scores
        ],
    )
    conn.commit()
    conn.close()
    try:
        import metrics
        metrics.write_snapshot(scores, ts)
    except Exception:  # noqa: S110
        pass
    try:
        import notifier
        notifier.check_critical_channels(
            [{"chan_id": s.chan_id, "alias": s.alias, "ratio": s.ratio} for s in scores]
        )
    except Exception:  # noqa: S110
        pass


def main() -> None:
    init_db()
    sched = BlockingScheduler()
    sched.add_job(rebalance_job, IntervalTrigger(minutes=10), id="rebalance")
    sched.add_job(snapshot_job, IntervalTrigger(minutes=5), id="snapshot")
    logger.info("Scheduler started — rebalance:10m | snapshot:5m")
    try:
        sched.start()
    except (KeyboardInterrupt, SystemExit):
        pass


if __name__ == "__main__":
    main()
