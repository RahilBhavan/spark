"""
LND REST client for getinfo, channels, invoices, and payments.
Payments use POST /v2/router/send (streaming); response is consumed line-by-line.
"""
import json
import logging
import os
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


class LNDClient:
    """Client for LND REST API with macaroon auth and optional TLS verify."""

    def __init__(self) -> None:
        self.base = os.getenv("LND_REST_URL", "https://localhost:8081").rstrip("/")
        cert_path = os.getenv("LND_TLS_CERT_PATH")
        mac_path = os.getenv("LND_MACAROON_PATH")
        self.cert = cert_path if cert_path else False  # False = skip TLS verify (dev only)
        if mac_path and os.path.exists(mac_path):
            with open(mac_path, "rb") as f:
                self.headers = {
                    "Grpc-Metadata-macaroon": f.read().hex(),
                    "Content-Type": "application/json",
                }
        else:
            logger.warning("Macaroon file not found at %s. API calls may fail.", mac_path)
            self.headers = {
                "Content-Type": "application/json",
            }

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        r = requests.get(
            f"{self.base}{path}",
            headers=self.headers,
            params=params,
            verify=self.cert,
            timeout=15,
        )
        r.raise_for_status()
        return r.json()

    def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        r = requests.post(
            f"{self.base}{path}",
            headers=self.headers,
            json=body,
            verify=self.cert,
            timeout=30,
        )
        r.raise_for_status()
        return r.json()

    def get_pubkey(self) -> str:
        return self._get("/v1/getinfo")["identity_pubkey"]

    def list_channels(self, active_only: bool = True) -> list[dict[str, Any]]:
        return self._get("/v1/channels", {"active_only": str(active_only).lower()}).get(
            "channels", []
        )

    def add_invoice(
        self, amount_sats: int, memo: str, expiry: int = 600
    ) -> dict[str, Any]:
        """Self-invoice for circular rebalancing."""
        return self._post(
            "/v1/invoices",
            {"value": amount_sats, "memo": memo, "expiry": expiry},
        )

    def send_payment(
        self,
        payment_request: str,
        outgoing_chan_id: str,
        max_fee_sats: int,
    ) -> dict[str, Any]:
        """
        Send payment via POST /v2/router/send (streaming).
        Forces payment to exit through the given channel; used for circular rebalancing.
        Returns a dict with success, fee_sat, error for the last Payment update.
        """
        body = {
            "payment_request": payment_request,
            "timeout_seconds": 60,
            "fee_limit_sat": str(max(max_fee_sats, 1)),
            "outgoing_chan_id": str(outgoing_chan_id),
            "allow_self_payment": True,
        }
        url = f"{self.base}/v2/router/send"
        try:
            with requests.post(
                url,
                headers=self.headers,
                json=body,
                verify=self.cert,
                timeout=90,
                stream=True,
            ) as r:
                r.raise_for_status()
                last: dict[str, Any] = {}
                for line in r.iter_lines(decode_unicode=True):
                    if not line:
                        continue
                    try:
                        last = json.loads(line)
                    except json.JSONDecodeError as e:
                        logger.warning("Invalid JSON in payment stream: %s", e)
                        continue
                    status = last.get("status")
                    if status in ("SUCCEEDED", "FAILED"):
                        break
                if not last:
                    return {
                        "success": False,
                        "fee_sat": 0,
                        "error": "Empty or invalid payment stream",
                    }
                if last.get("status") == "SUCCEEDED":
                    fee_sat = int(last.get("fee_sat", 0) or last.get("fee", 0))
                    return {"success": True, "fee_sat": fee_sat, "error": ""}
                # FAILED or other
                reason = last.get("failure_reason", "UNKNOWN")
                return {
                    "success": False,
                    "fee_sat": 0,
                    "error": str(reason),
                }
        except requests.RequestException as e:
            logger.exception("Payment request failed")
            return {"success": False, "fee_sat": 0, "error": str(e)}


lnd = LNDClient()
