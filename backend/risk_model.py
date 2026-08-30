"""
risk_model.py — loads the trained ML model and exposes a simple
predict function for use in the payment flow.
"""

import joblib
import numpy as np
import pandas as pd
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), "risk_model.joblib")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "risk_scaler.joblib")

_model = None
_scaler = None


def _load():
    """Lazy-load the model so importing this module doesn't require the
    .joblib files to exist unless prediction is actually called."""
    global _model, _scaler
    if _model is None:
        _model = joblib.load(MODEL_PATH)
        _scaler = joblib.load(SCALER_PATH)
    return _model, _scaler


# Same currency-pair risk table used during training — must stay in sync.
# In a more mature version, this would come from a shared config file.
CURRENCY_PAIR_RISK = {
    ("THB", "INR"): 0.35,
    ("KRW", "INR"): 0.30,
    ("USD", "INR"): 0.15,
    ("EUR", "INR"): 0.15,
    ("AED", "INR"): 0.40,
    ("GBP", "INR"): 0.20,
}
DEFAULT_PAIR_RISK = 0.20  # for currency pairs the model hasn't seen


def predict_risk_score(base_currency: str, target_currency: str,
                        markup_percent: float, amount_in_payer_currency: float) -> dict:
    """
    Returns an ML-based risk probability, alongside the rule-based verdict
    logic we already had — the two can be shown together.
    """
    try:
        model, scaler = _load()
    except FileNotFoundError:
        return {
            "ml_available": False,
            "reason": "Model not trained yet — run train_risk_model.py first",
        }

    pair_risk = CURRENCY_PAIR_RISK.get(
        (base_currency.upper(), target_currency.upper()), DEFAULT_PAIR_RISK
    )
    money_at_stake = markup_percent * amount_in_payer_currency

    features = pd.DataFrame(
        [[pair_risk, markup_percent, amount_in_payer_currency, money_at_stake]],
        columns=["pair_base_risk", "markup_percent", "amount_inr", "money_at_stake_inr"],
    )
    features_scaled = scaler.transform(features)

    risk_probability = model.predict_proba(features_scaled)[0][1]  # P(risky)

    return {
        "ml_available": True,
        "risk_probability": round(float(risk_probability), 3),
        "risk_percent_label": f"{risk_probability:.0%}",
        "features_used": {
            "currency_pair_base_risk": pair_risk,
            "markup_percent": markup_percent,
            "amount_in_payer_currency": amount_in_payer_currency,
            "money_at_stake": round(money_at_stake, 2),
        },
    }


if __name__ == "__main__":
    # Test with your Korean Won example: fair vs marked-up
    print("Fair scenario (0% markup):")
    print(predict_risk_score("KRW", "INR", markup_percent=0.0, amount_in_payer_currency=62.5))
    print()
    print("Marked-up scenario (20% markup):")
    print(predict_risk_score("KRW", "INR", markup_percent=0.20, amount_in_payer_currency=75.0))
