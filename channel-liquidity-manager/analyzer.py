"""
Channel balance scoring: health (HEALTHY/WARNING/CRITICAL), direction, urgency.
chan_id is normalized to string for consistency with LND outgoing_chan_id.
Target band (healthy ratio range) is configurable via TARGET_RATIO_LOW / TARGET_RATIO_HIGH.
"""
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING

from config import (
    get_target_ratio_high,
    get_target_ratio_low,
    get_warning_margin,
)
from lnd_client import lnd

if TYPE_CHECKING:
    from typing import List

class Health(str, Enum):
    HEALTHY = "HEALTHY"  # ratio 0.40 – 0.60
    WARNING = "WARNING"  # ratio 0.20 – 0.40 or 0.60 – 0.80
    CRITICAL = "CRITICAL"  # ratio below 0.20 or above 0.80


class Direction(str, Enum):
    DEPLETED_OUTBOUND = "DEPLETED_OUTBOUND"  # low local → can't send
    DEPLETED_INBOUND = "DEPLETED_INBOUND"  # low remote → can't receive
    BALANCED = "BALANCED"


@dataclass
class ChannelScore:
    chan_id: str
    alias: str
    remote_pubkey: str
    capacity: int
    local_balance: int
    remote_balance: int
    ratio: float
    health: Health
    direction: Direction
    imbalance_sats: int
    urgency_score: float


def score_channel(raw: dict) -> ChannelScore:
    low = get_target_ratio_low()
    high = get_target_ratio_high()
    margin = get_warning_margin()
    capacity = int(raw.get("capacity", 1))
    local_bal = int(raw.get("local_balance", 0))
    ratio = local_bal / max(capacity, 1)

    if low <= ratio <= high:
        health = Health.HEALTHY
    elif (low - margin) <= ratio <= (high + margin):
        health = Health.WARNING
    else:
        health = Health.CRITICAL

    if ratio < low:
        direction = Direction.DEPLETED_OUTBOUND
    elif ratio > high:
        direction = Direction.DEPLETED_INBOUND
    else:
        direction = Direction.BALANCED

    mid = (low + high) / 2
    target_local = int(capacity * mid)
    imbalance = abs(local_bal - target_local)
    urgency = abs(ratio - mid) * (capacity / 1_000_000)

    # Normalize chan_id to string for LND REST (uint64 as string)
    chan_id = raw.get("chan_id", "")
    if chan_id is not None and not isinstance(chan_id, str):
        chan_id = str(chan_id)

    return ChannelScore(
        chan_id=chan_id or "",
        alias=(raw.get("peer_alias") or "?")[:12],
        remote_pubkey=raw.get("remote_pubkey", ""),
        capacity=capacity,
        local_balance=local_bal,
        remote_balance=int(raw.get("remote_balance", 0)),
        ratio=ratio,
        health=health,
        direction=direction,
        imbalance_sats=imbalance,
        urgency_score=urgency,
    )


def get_all_scores(quiet: bool = False) -> "List[ChannelScore]":
    scores = [score_channel(ch) for ch in lnd.list_channels()]
    scores.sort(key=lambda s: s.urgency_score, reverse=True)
    if not quiet:
        for s in scores:
            print(
                f"[{s.health.value:8}] {s.alias:12} ratio={s.ratio:.2f}  "
                f"imbalance={s.imbalance_sats:,} sats"
            )
    return scores


def get_candidates(min_imbalance: int = 10_000) -> "List[ChannelScore]":
    return [
        s
        for s in get_all_scores(quiet=True)
        if s.health != Health.HEALTHY and s.imbalance_sats >= min_imbalance
    ]
