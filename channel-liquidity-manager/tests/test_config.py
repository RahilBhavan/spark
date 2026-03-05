"""
Unit tests for config: env-based target ratio and optional fee heuristic.
"""
import os
from unittest.mock import patch

import pytest

import config


def test_get_target_ratio_low_default():
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("TARGET_RATIO_LOW", None)
        assert config.get_target_ratio_low() == 0.40


def test_get_target_ratio_low_from_env():
    with patch.dict(os.environ, {"TARGET_RATIO_LOW": "0.45"}):
        assert config.get_target_ratio_low() == 0.45


def test_get_target_ratio_high_default():
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("TARGET_RATIO_HIGH", None)
        assert config.get_target_ratio_high() == 0.60


def test_get_target_ratio_high_from_env():
    with patch.dict(os.environ, {"TARGET_RATIO_HIGH": "0.55"}):
        assert config.get_target_ratio_high() == 0.55


def test_get_estimated_extra_cost_none_when_unset():
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("ESTIMATED_EXTRA_COST_PER_FORWARD_SATS", None)
        assert config.get_estimated_extra_cost_per_forward_sats() is None


def test_get_estimated_extra_cost_from_env():
    with patch.dict(os.environ, {"ESTIMATED_EXTRA_COST_PER_FORWARD_SATS": "50"}):
        assert config.get_estimated_extra_cost_per_forward_sats() == 50


def test_get_estimated_extra_cost_invalid_returns_none():
    with patch.dict(os.environ, {"ESTIMATED_EXTRA_COST_PER_FORWARD_SATS": "abc"}):
        assert config.get_estimated_extra_cost_per_forward_sats() is None


def test_get_estimated_extra_cost_negative_clamped_to_zero():
    with patch.dict(os.environ, {"ESTIMATED_EXTRA_COST_PER_FORWARD_SATS": "-10"}):
        assert config.get_estimated_extra_cost_per_forward_sats() == 0
