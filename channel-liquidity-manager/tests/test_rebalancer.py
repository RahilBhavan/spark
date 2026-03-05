"""
Unit tests for rebalancer: amount/fee math, Result shape, Amount too small.
"""
from unittest.mock import MagicMock, patch

import pytest

from analyzer import ChannelScore, Direction, Health
from rebalancer import (
    MAX_FEE_PPM,
    MAX_SATS,
    Result,
    rebalance,
    run_cycle,
)


def _score(
    chan_id: str = "123",
    imbalance_sats: int = 100_000,
    direction: Direction = Direction.DEPLETED_OUTBOUND,
    local_balance: int = 200_000,
    capacity: int = 1_000_000,
) -> ChannelScore:
    return ChannelScore(
        chan_id=chan_id,
        alias="test-peer",
        remote_pubkey="pk",
        capacity=capacity,
        local_balance=local_balance,
        remote_balance=capacity - local_balance,
        ratio=local_balance / capacity,
        health=Health.CRITICAL,
        direction=direction,
        imbalance_sats=imbalance_sats,
        urgency_score=0.5,
    )


def test_rebalance_amount_too_small_returns_failure():
    score = _score(imbalance_sats=5_000)
    r = rebalance(score)
    assert r.success is False
    assert r.chan_id == score.chan_id
    assert "Amount too small" in r.error
    assert r.amount_sats == min(int(5000 * 0.80), MAX_SATS)
    assert r.fee_sats == 0
    assert r.fee_ppm == 0.0


def test_rebalance_amount_capped_at_max_sats():
    score = _score(imbalance_sats=1_000_000)
    with patch("rebalancer.lnd") as mock_lnd:
        mock_lnd.add_invoice.return_value = {"payment_request": "lnbc..."}
        mock_lnd.send_payment.return_value = {"success": True, "fee_sat": 100}
        r = rebalance(score)
    assert r.success is True
    assert r.amount_sats == MAX_SATS
    expected_max_fee = max(1, int(MAX_SATS * MAX_FEE_PPM / 1_000_000))
    mock_lnd.send_payment.assert_called_once()
    call_args = mock_lnd.send_payment.call_args[0]
    assert call_args[2] == expected_max_fee


def test_rebalance_amount_80_percent_of_imbalance():
    score = _score(imbalance_sats=100_000)
    with patch("rebalancer.lnd") as mock_lnd:
        mock_lnd.add_invoice.return_value = {"payment_request": "lnbc..."}
        mock_lnd.send_payment.return_value = {"success": True, "fee_sat": 40}
        r = rebalance(score)
    assert r.success is True
    assert r.amount_sats == int(100_000 * 0.80)
    assert r.fee_sats == 40


def test_rebalance_max_fee_from_500_ppm():
    score = _score(imbalance_sats=250_000)
    amount = min(int(250_000 * 0.80), MAX_SATS)
    with patch("rebalancer.lnd") as mock_lnd:
        mock_lnd.add_invoice.return_value = {"payment_request": "lnbc..."}
        mock_lnd.send_payment.return_value = {"success": True, "fee_sat": 50}
        rebalance(score)
    expected_max_fee = max(1, int(amount * MAX_FEE_PPM / 1_000_000))
    mock_lnd.send_payment.assert_called_once()
    assert mock_lnd.send_payment.call_args[0][2] == expected_max_fee


def test_rebalance_payment_failure_returns_result():
    score = _score(imbalance_sats=50_000)
    with patch("rebalancer.lnd") as mock_lnd:
        mock_lnd.add_invoice.return_value = {"payment_request": "lnbc..."}
        mock_lnd.send_payment.return_value = {"success": False, "error": "route not found"}
        r = rebalance(score)
    assert r.success is False
    assert r.fee_sats == 0
    assert "route not found" in r.error


def test_rebalance_invoice_failure_returns_result():
    score = _score(imbalance_sats=50_000)
    with patch("rebalancer.lnd") as mock_lnd:
        mock_lnd.add_invoice.side_effect = Exception("LND unavailable")
        r = rebalance(score)
    assert r.success is False
    assert "Invoice failed" in r.error


def test_run_cycle_empty_when_no_candidates():
    with patch("rebalancer.get_candidates", return_value=[]):
        results = run_cycle()
    assert results == []


def test_run_cycle_returns_list_of_results():
    score = _score(imbalance_sats=50_000)
    with patch("rebalancer.get_candidates", return_value=[score]):
        with patch("rebalancer.rebalance") as mock_rebal:
            mock_rebal.return_value = Result(
                True, score.chan_id, 40000, 20, 500.0
            )
            results = run_cycle()
    assert len(results) == 1
    assert results[0].success is True
    assert results[0].chan_id == score.chan_id
