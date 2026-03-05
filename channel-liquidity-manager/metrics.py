"""
Optional InfluxDB 2.x exporter for channel health and rebalance events.
No-op when INFLUXDB_URL or INFLUXDB_TOKEN are not set.
"""
import logging
import os
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from analyzer import ChannelScore
    from rebalancer import Result

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    url = os.getenv("INFLUXDB_URL")
    token = os.getenv("INFLUXDB_TOKEN")
    if not url or not token:
        return None
    try:
        from influxdb_client import InfluxDBClient
        org = os.getenv("INFLUXDB_ORG", "lightning")
        _client = InfluxDBClient(url=url, token=token, org=org)
        return _client
    except Exception as e:
        logger.warning("InfluxDB client init failed: %s", e)
        return None


def write_snapshot(scores: "list[ChannelScore]", ts: datetime) -> None:
    """Write channel_health points for each score. No-op if InfluxDB not configured."""
    client = _get_client()
    if not client:
        return
    bucket = os.getenv("INFLUXDB_BUCKET", "channels")
    try:
        from influxdb_client import Point
        write_api = client.write_api()
        for s in scores:
            p = (
                Point("channel_health")
                .tag("alias", s.alias)
                .tag("chan_id", s.chan_id)
                .field("ratio", s.ratio)
                .field("local_balance", s.local_balance)
                .field("remote_balance", s.remote_balance)
                .field("capacity", s.capacity)
                .field("health", s.health.value)
                .time(ts)
            )
            write_api.write(bucket=bucket, record=p)
        write_api.close()
    except Exception as e:
        logger.warning("InfluxDB write_snapshot failed: %s", e)


def write_rebalance_result(result: "Result", ts: datetime) -> None:
    """Write one rebalance event point. No-op if InfluxDB not configured."""
    client = _get_client()
    if not client:
        return
    bucket = os.getenv("INFLUXDB_BUCKET", "channels")
    try:
        from influxdb_client import Point
        write_api = client.write_api()
        p = (
            Point("rebalance")
            .tag("chan_id", result.chan_id)
            .field("amount_sats", result.amount_sats)
            .field("fee_sats", result.fee_sats)
            .field("fee_ppm", result.fee_ppm)
            .field("success", 1 if result.success else 0)
            .time(ts)
        )
        write_api.write(bucket=bucket, record=p)
        write_api.close()
    except Exception as e:
        logger.warning("InfluxDB write_rebalance_result failed: %s", e)
