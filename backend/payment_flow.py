"""
payment_flow.py — orchestrates the full "scan -> convert -> assess" flow.

This is the piece that ties forex.py, qr_handler.py, and transparency.py
together. Keeping this as its own module (separate from the API layer)
means you can test the whole business logic without needing a running
server — useful for your demo video AND for debugging.
"""

from forex import get_exchange_rate
from transparency import assess_conversion
from qr_handler import decode_qr_payload
from risk_model import predict_risk_score


def process_payment_request(qr_data: str, amount_in_shop_currency: float,
                             payer_home_currency: str,
                             offered_rate: float = None) -> dict:
    """
    Full flow:
    1. Decode the scanned QR to get shop info + currency
    2. Fetch the TRUE live market rate (shop currency -> payer's currency)
    3. If a terminal/shop is offering a different rate, assess the markup
    4. Return everything needed for the UI to show a transparent breakdown

    `offered_rate` simulates what a shop's payment terminal might show you
    (this is where a DCC markup would appear in real life). If not given,
    we assume the shop is just using the live rate directly (no markup).
    """
    shop = decode_qr_payload(qr_data)
    shop_currency = shop["currency"]

    # Step 1: get the TRUE market rate
    market_rate_info = get_exchange_rate(shop_currency, payer_home_currency)
    true_rate = market_rate_info["rate"]

    # Step 2: figure out what rate is actually being offered.
    # If the shop/terminal didn't specify one, assume it's just the live rate.
    effective_offered_rate = offered_rate if offered_rate is not None else true_rate

    # Step 3: assess the markup (this is your "AI/judgment" layer)
    assessment = assess_conversion(
        true_market_rate=true_rate,
        offered_rate=effective_offered_rate,
    )

    # Step 4: compute what the payer actually pays, in their own currency
    amount_payer_pays = round(amount_in_shop_currency * effective_offered_rate, 2)
    amount_at_fair_rate = round(amount_in_shop_currency * true_rate, 2)
    potential_overpay = round(amount_payer_pays - amount_at_fair_rate, 2)

    # Step 5: ML risk score — a second, independent signal alongside the
    # rule-based verdict. Shown together rather than replacing one with
    # the other, since they answer slightly different questions:
    # rule-based = "how far off is this specific rate, by a fixed formula"
    # ML score   = "how much does this resemble known risky patterns overall"
    ml_result = predict_risk_score(
        base_currency=shop_currency,
        target_currency=payer_home_currency,
        markup_percent=assessment.markup_percent,
        amount_in_payer_currency=amount_payer_pays,
    )

    return {
        "shop_name": shop["shop_name"],
        "shop_currency": shop_currency,
        "payer_currency": payer_home_currency,
        "amount_in_shop_currency": amount_in_shop_currency,
        "rate_source": market_rate_info["source"],  # "live" or "fallback" — be honest in UI
        "true_market_rate": true_rate,
        "offered_rate": effective_offered_rate,
        "you_pay": amount_payer_pays,
        "fair_price_would_be": amount_at_fair_rate,
        "potential_overpay": potential_overpay,
        "verdict": assessment.verdict,
        "message": assessment.message,
        "ml_risk_score": ml_result,
    }


if __name__ == "__main__":
    import json
    from qr_handler import generate_shop_qr

    # Simulate the full journey end-to-end
    qr_result = generate_shop_qr(
        shop_name="Bangkok Coffee Corner",
        shop_currency="THB",
        upi_id="coffeecorner@bangkokbank",
    )
    scanned_qr_string = json.dumps(qr_result["payload"])

    print("=== Scenario A: shop charges the fair rate ===")
    result = process_payment_request(
        qr_data=scanned_qr_string,
        amount_in_shop_currency=500,   # 500 THB coffee + snacks
        payer_home_currency="INR",
    )
    print(json.dumps(result, indent=2))

    print("\n=== Scenario B: shop terminal offers a marked-up rate ===")
    # Simulate a terminal charging a HIGHER rate than the true market rate
    # (this means the payer pays more INR per THB — a real DCC-style markup)
    result_bad = process_payment_request(
        qr_data=scanned_qr_string,
        amount_in_shop_currency=500,
        payer_home_currency="INR",
        offered_rate=2.75,  # true rate is 2.41 — this is a ~14% markup
    )
    print(json.dumps(result_bad, indent=2))
