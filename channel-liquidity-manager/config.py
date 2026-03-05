"""
Shared config from env for target ratio band and optional settings.
"""
import os
from typing import Optional


def get_target_ratio_low() -> float:
    return float(os.getenv("TARGET_RATIO_LOW", "0.40"))


def get_target_ratio_high() -> float:
    return float(os.getenv("TARGET_RATIO_HIGH", "0.60"))


def get_warning_margin() -> float:
    """Margin outside healthy band for WARNING (beyond this = CRITICAL)."""
    return float(os.getenv("WARNING_RATIO_MARGIN", "0.20"))


def get_estimated_extra_cost_per_forward_sats() -> Optional[int]:
    """
    Optional heuristic: typical extra sats per forward when channel is imbalanced.
    Used for "cost of not rebalancing" estimate in dashboard/simulator.
    Return None if not set (hide the estimate).
    """
    val = os.getenv("ESTIMATED_EXTRA_COST_PER_FORWARD_SATS", "").strip()
    if not val:
        return None
    try:
        return max(0, int(val))
    except ValueError:
        return None
