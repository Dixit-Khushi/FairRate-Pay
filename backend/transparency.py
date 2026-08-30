"""
transparency.py — flags suspicious currency conversion markups.

BACKGROUND (this is your "real problem" evidence for the demo):
This targets a real, documented practice called Dynamic Currency Conversion
(DCC) abuse — merchants or payment terminals quietly offer to charge you in
YOUR currency instead of theirs, at a worse-than-market rate, pocketing the
difference. Travelers lose real money to this constantly, often without
realizing it, because the "convenience" of seeing your home currency hides
the markup.

DESIGN DECISION: rule-based, not a black-box AI call.
Why: a threshold you can name and justify ("we flag >3% deviation because
that's above typical card-network markup") is more defensible in a demo
than "the model said so." You can always add an LLM layer on TOP of this
to phrase the explanation more naturally — but the judgment itself should
be transparent and explainable.
"""

from dataclasses import dataclass


# Typical real-world card network markups (Visa/Mastercard) sit around 1-2%.
# Anything meaningfully above that is worth flagging as a "let the user know"
# case, not necessarily fraud — could just be a bad terminal rate.
MARKUP_THRESHOLDS = {
    "fair": 0.015,       # up to 1.5% — normal, expected
    "elevated": 0.04,    # 1.5% - 4% — worth a heads-up
    "high": float("inf") # above 4% — clear warning
}


@dataclass
class ConversionAssessment:
    true_market_rate: float
    offered_rate: float
    markup_percent: float
    verdict: str          # "fair" | "elevated" | "high"
    message: str          # plain-English explanation for the user


def assess_conversion(true_market_rate: float, offered_rate: float) -> ConversionAssessment:
    """
    Compares the rate actually being offered/charged against the true
    market rate, and classifies the markup.

    DIRECTION CONVENTION (important — this was a real bug we caught):
    This assumes the rate is used to CHARGE the payer, i.e.
        amount_payer_pays = amount_in_shop_currency * rate
    In this direction, a HIGHER offered_rate means the payer pays MORE
    for the same goods — that's worse for them. So markup_percent is
    positive when offered_rate > true_market_rate.

    (Note: this is the OPPOSITE convention from a currency-exchange-kiosk
    scenario, where you're receiving money back and a LOWER rate is worse.
    Mixing these two up is an easy, genuine bug — worth knowing which
    direction your specific flow uses.)
    """
    if true_market_rate <= 0:
        raise ValueError("true_market_rate must be positive")

    # markup_percent > 0 means the payer is being charged MORE than the
    # fair market rate would imply.
    markup_percent = (offered_rate - true_market_rate) / true_market_rate

    if markup_percent <= MARKUP_THRESHOLDS["fair"]:
        verdict = "fair"
        message = (
            f"This rate is within normal range (markup: {markup_percent:.2%}). "
            f"You're getting a fair deal."
        )
    elif markup_percent <= MARKUP_THRESHOLDS["elevated"]:
        verdict = "elevated"
        message = (
            f"This rate includes a {markup_percent:.2%} markup over the live "
            f"market rate — higher than typical, but not unusual for this kind "
            f"of transaction. You may want to check if a better option is available."
        )
    else:
        verdict = "high"
        message = (
            f"⚠️ This rate is {markup_percent:.2%} worse than the live market rate — "
            f"significantly higher than typical. This may be a Dynamic Currency "
            f"Conversion markup. Consider asking to be charged in the shop's local "
            f"currency instead."
        )

    return ConversionAssessment(
        true_market_rate=true_market_rate,
        offered_rate=offered_rate,
        markup_percent=markup_percent,
        verdict=verdict,
        message=message,
    )


if __name__ == "__main__":
    # Scenario 1: fair rate (offered slightly above true rate — normal small spread)
    print(assess_conversion(true_market_rate=83.20, offered_rate=83.50))
    print()
    # Scenario 2: elevated markup (payer being charged noticeably more)
    print(assess_conversion(true_market_rate=83.20, offered_rate=85.90))
    print()
    # Scenario 3: high markup (classic DCC scam pattern — payer charged a lot more)
    print(assess_conversion(true_market_rate=83.20, offered_rate=90.50))
