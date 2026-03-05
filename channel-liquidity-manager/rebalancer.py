"""
Circular rebalancing logic.

DEPLETED_OUTBOUND (low local balance):
  Force payment OUT through this channel → network routes it back to you.
  Net: channel gains local balance.

DEPLETED_INBOUND (high local balance):
  Force exit through any OTHER channel → route back THROUGH this one.
  Net: channel loses excess local balance.

Cost is the routing fees paid along the way. Target: under 500 ppm.
"""
import logging
import time
from dataclasses import dataclass

from analyzer import Direction, ChannelScore, get_all_scores, get_candidates
from lnd_client import lnd

logger = logging.getLogger(__name__)
MAX_FEE_PPM = 500
MAX_SATS = 500_000


@dataclass
class Result:
    success: bool
    chan_id: str
    amount_sats: int
    fee_sats: int
    fee_ppm: float
    error: str = ""


def rebalance(score: ChannelScore) -> Result:
    amount = min(int(score.imbalance_sats * 0.80), MAX_SATS)
    if amount < 10_000:
        return Result(
            False, score.chan_id, amount, 0, 0.0, "Amount too small"
        )

    max_fee = max(1, int(amount * MAX_FEE_PPM / 1_000_000))
    logger.info("Rebalancing %s: %s sats, max_fee=%s", score.alias, f"{amount:,}", max_fee)

    # Step 1: Create self-invoice
    try:
        inv = lnd.add_invoice(amount, f"rebal:{score.chan_id[:8]}")
        bolt11 = inv["payment_request"]
    except Exception as e:
        return Result(False, score.chan_id, amount, 0, 0.0, f"Invoice failed: {e}")

    # Step 2: Choose which channel to force-exit through
    if score.direction == Direction.DEPLETED_OUTBOUND:
        out_chan = score.chan_id
    else:
        others = [
            s
            for s in get_all_scores(quiet=True)
            if s.chan_id != score.chan_id and s.local_balance > amount
        ]
        if not others:
            return Result(
                False, score.chan_id, amount, 0, 0.0, "No exit channel found"
            )
        out_chan = others[0].chan_id

    # Step 3: Execute circular payment (v2/router/send returns {success, fee_sat, error})
    res = lnd.send_payment(bolt11, out_chan, max_fee)

    if not res.get("success"):
        return Result(
            False,
            score.chan_id,
            amount,
            0,
            0.0,
            res.get("error", "Payment failed"),
        )

    fee_sats = int(res.get("fee_sat", 0))
    fee_ppm = (fee_sats / amount) * 1_000_000 if amount else 0.0
    logger.info("Done — %s rebalanced at %.1f ppm", score.alias, fee_ppm)
    return Result(True, score.chan_id, amount, fee_sats, fee_ppm)


def run_cycle() -> list[Result]:
    candidates = get_candidates()
    if not candidates:
        logger.info("All channels healthy")
        return []
    results: list[Result] = []
    for s in candidates[:5]:
        r = rebalance(s)
        results.append(r)
        if r.success:
            time.sleep(2)
    return results
