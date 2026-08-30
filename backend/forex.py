"""
forex.py — fetches live currency exchange rates.

WHY THIS DESIGN:
- Real APIs go down, rate-limit you, or time out. If this function just crashes,
  the whole payment flow breaks at the worst possible moment (mid-transaction).
- So: try live API first -> if it fails, fall back to cached/mock rates ->
  and ALWAYS tell the caller which one was used (so the UI can be honest
  about it, e.g. "using cached rate, may be slightly stale").

This "graceful degradation" pattern is standard in real fintech systems.
"""

import requests
from datetime import datetime, timezone

# A free, no-API-key exchange rate service.
# In production you'd use a paid provider with SLAs (e.g. Open Exchange Rates,
# XE, or Razorpay's own FX partners) but this is fine for a prototype.
FOREX_API_URL = "https://api.exchangerate-api.com/v4/latest/{base}"

# Fallback rates used ONLY if the live API is unreachable.
# These are just illustrative and will drift out of date — that's the point,
# the system should be honest about that in the response.
FALLBACK_RATES = {
    "USD": {"INR": 83.20, "EUR": 0.92, "GBP": 0.79, "JPY": 149.50, "AED": 3.67, "THB": 34.50, "KRW": 1330.00},
    "INR": {"USD": 0.012, "EUR": 0.011, "GBP": 0.0095, "AED": 0.044, "THB": 0.415, "KRW": 16.00},
    "EUR": {"USD": 1.09, "INR": 90.30, "GBP": 0.86, "THB": 37.60},
    "THB": {"INR": 2.41, "USD": 0.029, "EUR": 0.027},
    "KRW": {"INR": 0.0625, "USD": 0.00075},
}


def get_exchange_rate(base_currency: str, target_currency: str) -> dict:
    """
    Returns a dict with the rate and metadata about how we got it.

    Returns:
        {
            "rate": float,
            "source": "live" | "fallback",
            "fetched_at": ISO timestamp,
            "base": "USD",
            "target": "INR"
        }
    """
    base_currency = base_currency.upper()
    target_currency = target_currency.upper()

    if base_currency == target_currency:
        return {
            "rate": 1.0,
            "source": "identity",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "base": base_currency,
            "target": target_currency,
        }

    # --- Attempt 1: live API ---
    try:
        response = requests.get(
            FOREX_API_URL.format(base=base_currency),
            timeout=5,  # never let a slow API hang the payment flow
        )
        response.raise_for_status()
        data = response.json()
        rate = data["rates"][target_currency]
        return {
            "rate": rate,
            "source": "live",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "base": base_currency,
            "target": target_currency,
        }
    except (requests.RequestException, KeyError, ValueError) as e:
        # KeyError -> target currency not in the response
        # RequestException -> network/timeout/DNS issue
        # ValueError -> bad JSON
        # We log WHY it failed instead of silently swallowing it.
        print(f"[forex] Live API failed ({type(e).__name__}: {e}). Using fallback.")

    # --- Attempt 2: direct fallback pair ---
    try:
        rate = FALLBACK_RATES[base_currency][target_currency]
        return {
            "rate": rate,
            "source": "fallback",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "base": base_currency,
            "target": target_currency,
        }
    except KeyError:
        pass  # fall through to triangulation below, don't give up yet

    # --- Attempt 3: triangulate through USD ---
    # We can't have every currency pair hardcoded, but if we know
    # base->USD and USD->target, we can derive base->target.
    # e.g. THB->INR = (THB->USD) * (USD->INR)
    try:
        base_to_usd = FALLBACK_RATES[base_currency]["USD"]
        usd_to_target = FALLBACK_RATES["USD"][target_currency]
        derived_rate = base_to_usd * usd_to_target
        return {
            "rate": derived_rate,
            "source": "fallback_triangulated",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "base": base_currency,
            "target": target_currency,
        }
    except KeyError:
        raise ValueError(
            f"No rate available for {base_currency} -> {target_currency} "
            f"(live API failed, no direct fallback, and triangulation via "
            f"USD also failed — one of these currencies isn't in our table at all)"
        )


if __name__ == "__main__":
    # Quick manual test — run this file directly: python3 forex.py
    result = get_exchange_rate("USD", "INR")
    print(result)
