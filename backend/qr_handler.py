"""
qr_handler.py — generates and decodes shop payment QR codes.

WHY JSON INSIDE THE QR:
Real UPI QR codes use a specific URI format (upi://pay?pa=...&am=...).
For a prototype, we use plain JSON instead — it's human-readable, easy to
debug, and easy to extend (e.g. adding a shop name or category later)
without needing to learn a payment-network-specific spec first.

You could swap this for real UPI format later if you wanted to interop
with actual UPI apps — that's a good "future work" line for your demo.
"""

import qrcode
import json
import uuid


def generate_shop_qr(shop_name: str, shop_currency: str, upi_id: str,
                      amount: float = None, output_path: str = "shop_qr.png") -> dict:
    """
    Generates a QR code for a shop.

    If `amount` is None, the QR is "open" — the shop owner enters the amount
    at time of sale (like a generic UPI QR you see taped to a counter).
    If `amount` is given, it's a "fixed amount" QR (like a specific invoice).

    Returns the payload dict that was encoded, plus the saved file path.
    """
    payload = {
        "shop_id": str(uuid.uuid4())[:8],  # short unique ID, not a real UUID everywhere
        "shop_name": shop_name,
        "currency": shop_currency.upper(),
        "upi_id": upi_id,  # simulates a payment address, e.g. "shop@razorpay"
        "amount": amount,  # None = "open" QR, set by shop owner at checkout
    }

    qr_data = json.dumps(payload)
    img = qrcode.make(qr_data)
    img.save(output_path)

    return {"payload": payload, "file_path": output_path}


def decode_qr_payload(qr_data: str) -> dict:
    """
    Decodes the JSON string read from a scanned QR code back into a dict.
    In the full app, a QR-scanning library (like `pyzbar` reading a camera
    frame) hands you this raw string — this function is the next step after
    that.
    """
    try:
        payload = json.loads(qr_data)
    except json.JSONDecodeError as e:
        raise ValueError(f"QR code does not contain valid payment data: {e}")

    required_fields = {"shop_id", "shop_name", "currency", "upi_id"}
    missing = required_fields - payload.keys()
    if missing:
        raise ValueError(f"QR payload missing required fields: {missing}")

    return payload


if __name__ == "__main__":
    # Simulate a coffee shop in Bangkok with an "open" QR (amount entered at checkout)
    result = generate_shop_qr(
        shop_name="Bangkok Coffee Corner",
        shop_currency="THB",
        upi_id="coffeecorner@bangkokbank",
        output_path="/home/claude/qr-pay-project/data/sample_shop_qr.png",
    )
    print("Generated QR payload:", result["payload"])
    print("Saved to:", result["file_path"])

    # Now simulate scanning it back (round-trip test)
    scanned_data = json.dumps(result["payload"])
    decoded = decode_qr_payload(scanned_data)
    print("Decoded back:", decoded)
