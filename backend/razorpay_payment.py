"""
razorpay_payment.py — handles creating and verifying payments via
Razorpay's TEST/SANDBOX mode.

IMPORTANT — READ BEFORE USING:
This uses Razorpay's real API, but in TEST MODE, which means:
- No real money moves.
- You need TEST API keys (they start with "rzp_test_"), not live keys.
- Get them free at: https://dashboard.razorpay.com/ -> sign up ->
  Settings -> API Keys -> Generate Test Key.

WHY WE STORE KEYS AS ENVIRONMENT VARIABLES, NOT IN CODE:
Never hardcode API keys/secrets directly in a file, even for a prototype —
if this repo is public on GitHub (which it needs to be for the buildathon),
anyone could see and misuse the keys. Environment variables keep secrets
out of the code and out of git history.
"""

import razorpay
import os
import hmac
import hashlib

# Load keys from environment variables — set these before running:
#   export RAZORPAY_KEY_ID="rzp_test_xxxxxxxxxxxx"
#   export RAZORPAY_KEY_SECRET="your_test_secret_here"
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET")

_client = None


def _get_client():
    """Lazy-load the Razorpay client, with a clear error if keys aren't set."""
    global _client
    if _client is None:
        if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
            raise RuntimeError(
                "Razorpay keys not found. Set RAZORPAY_KEY_ID and "
                "RAZORPAY_KEY_SECRET environment variables with your TEST "
                "mode keys from https://dashboard.razorpay.com/"
            )
        _client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    return _client


def create_payment_order(amount_in_rupees: float, receipt_id: str, notes: dict = None) -> dict:
    """
    Creates a Razorpay order — the first step before showing the payer a
    checkout screen. This happens on the BACKEND (never create orders from
    the frontend directly — that would let anyone fake an order amount).

    Razorpay expects amount in PAISE (1 rupee = 100 paise), not rupees —
    a very common integration bug if you forget this conversion.
    """
    client = _get_client()

    amount_in_paise = int(round(amount_in_rupees * 100))

    order = client.order.create({
        "amount": amount_in_paise,
        "currency": "INR",  # Razorpay orders are created in INR even for
                              # cross-border scenarios; the forex conversion
                              # already happened in OUR app before this step
        "receipt": receipt_id,
        "notes": notes or {},
    })

    return {
        "order_id": order["id"],
        "amount_in_paise": order["amount"],
        "amount_in_rupees": amount_in_rupees,
        "currency": order["currency"],
        "key_id": RAZORPAY_KEY_ID,  # frontend needs this to open checkout
        "status": order["status"],
    }


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """
    After the payer completes checkout, Razorpay sends back a signature.
    We MUST verify this signature ourselves before trusting that payment
    actually succeeded — never trust a "payment successful" message from
    the frontend alone, since that could be faked by a malicious client.

    This uses HMAC-SHA256, exactly as Razorpay's docs specify.
    """
    if not RAZORPAY_KEY_SECRET:
        raise RuntimeError("RAZORPAY_KEY_SECRET not set — cannot verify signature")

    payload = f"{order_id}|{payment_id}"
    expected_signature = hmac.new(
        key=RAZORPAY_KEY_SECRET.encode(),
        msg=payload.encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected_signature, signature)


if __name__ == "__main__":
    # This will fail here since no real keys are set in this sandbox —
    # that's expected. Run this on your own machine after setting the
    # environment variables with your real test keys.
    try:
        result = create_payment_order(amount_in_rupees=75.0, receipt_id="test_receipt_001")
        print("Order created:", result)
    except RuntimeError as e:
        print(f"[Expected here] {e}")
