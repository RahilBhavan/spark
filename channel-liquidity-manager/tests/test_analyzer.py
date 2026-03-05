"""
Unit tests for analyzer: score_channel health, direction, edge cases.
"""
import pytest
from unittest.mock import patch

from analyzer import (
    Health,
    Direction,
    ChannelScore,
    score_channel,
)


@patch("analyzer.get_target_ratio_low", return_value=0.40)
@patch("analyzer.get_target_ratio_high", return_value=0.60)
@patch("analyzer.get_warning_margin", return_value=0.20)
def test_score_channel_healthy_ratio(
    _marg, _high, _low,
):
    raw = {
        "chan_id": "123",
        "capacity": 1_000_000,
        "local_balance": 500_000,
        "remote_balance": 500_000,
        "peer_alias": "alice",
        "remote_pubkey": "pk",
    }
    s = score_channel(raw)
    assert s.health == Health.HEALTHY
    assert s.direction == Direction.BALANCED
    assert s.ratio == 0.5
    assert s.imbalance_sats == 0


@patch("analyzer.get_target_ratio_low", return_value=0.40)
@patch("analyzer.get_target_ratio_high", return_value=0.60)
@patch("analyzer.get_warning_margin", return_value=0.20)
def test_score_channel_critical_low_ratio(
    _marg, _high, _low,
):
    raw = {
        "chan_id": "456",
        "capacity": 1_000_000,
        "local_balance": 100_000,
        "remote_balance": 900_000,
        "peer_alias": "bob",
        "remote_pubkey": "pk2",
    }
    s = score_channel(raw)
    assert s.health == Health.CRITICAL
    assert s.direction == Direction.DEPLETED_OUTBOUND
    assert s.ratio == 0.1


@patch("analyzer.get_target_ratio_low", return_value=0.40)
@patch("analyzer.get_target_ratio_high", return_value=0.60)
@patch("analyzer.get_warning_margin", return_value=0.20)
def test_score_channel_critical_high_ratio(
    _marg, _high, _low,
):
    raw = {
        "chan_id": "789",
        "capacity": 1_000_000,
        "local_balance": 900_000,
        "remote_balance": 100_000,
        "peer_alias": "carol",
        "remote_pubkey": "pk3",
    }
    s = score_channel(raw)
    assert s.health == Health.CRITICAL
    assert s.direction == Direction.DEPLETED_INBOUND
    assert s.ratio == 0.9


@patch("analyzer.get_target_ratio_low", return_value=0.40)
@patch("analyzer.get_target_ratio_high", return_value=0.60)
@patch("analyzer.get_warning_margin", return_value=0.20)
def test_score_channel_warning_band(
    _marg, _high, _low,
):
    raw = {
        "chan_id": "w1",
        "capacity": 1_000_000,
        "local_balance": 350_000,
        "remote_balance": 650_000,
        "peer_alias": "warn",
        "remote_pubkey": "pk",
    }
    s = score_channel(raw)
    assert s.health == Health.WARNING
    assert s.direction == Direction.DEPLETED_OUTBOUND
    assert s.ratio == 0.35


@patch("analyzer.get_target_ratio_low", return_value=0.40)
@patch("analyzer.get_target_ratio_high", return_value=0.60)
@patch("analyzer.get_warning_margin", return_value=0.20)
def test_score_channel_capacity_zero_uses_one(
    _marg, _high, _low,
):
    raw = {
        "chan_id": "z",
        "capacity": 0,
        "local_balance": 0,
        "remote_balance": 0,
        "peer_alias": "zero",
        "remote_pubkey": "",
    }
    s = score_channel(raw)
    assert s.capacity == 0
    assert s.ratio == 0.0
    assert s.health == Health.CRITICAL


@patch("analyzer.get_target_ratio_low", return_value=0.40)
@patch("analyzer.get_target_ratio_high", return_value=0.60)
@patch("analyzer.get_warning_margin", return_value=0.20)
def test_score_channel_chan_id_normalized_to_string(
    _marg, _high, _low,
):
    raw = {
        "chan_id": 12345678,
        "capacity": 1_000_000,
        "local_balance": 500_000,
        "remote_balance": 500_000,
        "peer_alias": "x",
        "remote_pubkey": "",
    }
    s = score_channel(raw)
    assert s.chan_id == "12345678"


@patch("analyzer.get_target_ratio_low", return_value=0.45)
@patch("analyzer.get_target_ratio_high", return_value=0.55)
@patch("analyzer.get_warning_margin", return_value=0.15)
def test_score_channel_custom_band(
    _marg, _high, _low,
):
    raw = {
        "chan_id": "c",
        "capacity": 1_000_000,
        "local_balance": 500_000,
        "remote_balance": 500_000,
        "peer_alias": "mid",
        "remote_pubkey": "",
    }
    s = score_channel(raw)
    assert s.health == Health.HEALTHY
    assert s.direction == Direction.BALANCED
    assert s.imbalance_sats == 0
