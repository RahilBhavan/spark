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
    c.commit()
    c.close()


def rebalance_job() -> None:
    results = run_cycle()
    ts = datetime.now(timezone.utc).isoformat()
    conn = sqlite3.connect(str(DB))
    for r in results:
        conn.execute(
            "INSERT INTO events (ts, chan_id, amount_sats, fee_sats, fee_ppm, success, error) VALUES (?,?,?,?,?,?,?)",
            (ts, r.chan_id, r.amount_sats, r.fee_sats, r.fee_ppm, int(r.success), r.error),
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
