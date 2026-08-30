"""
generate_training_data.py — creates synthetic transaction data to train
the risk-scoring model.

WHY SYNTHETIC DATA (be upfront about this in your demo):
No public dataset of "labeled DCC markup scams" exists — this is a niche,
under-reported problem. Real fintech companies build these datasets over
years from actual flagged transactions. For a prototype, we simulate
transactions using domain knowledge (what we already established: markup %,
currency pair risk, amount) and generate labels using a slightly noisy rule
— this lets us train a REAL model that has learned relationships between
features, rather than just re-implementing an if/else in a different form.

This is a legitimate, common technique when bootstrapping ML systems before
real labeled data exists — just be honest that it's synthetic, not real
fraud data, if asked.
"""

import pandas as pd
import numpy as np

np.random.seed(42)  # reproducibility — same data every time we run this

N_SAMPLES = 5000

# Currency pairs and a "base riskiness" score per pair — reflecting that
# some corridors (tourist-heavy, less regulated exchange markets) see more
# DCC markup abuse in real-world reporting than others.
CURRENCY_PAIR_RISK = {
    ("THB", "INR"): 0.35,   # tourist-heavy corridor
    ("KRW", "INR"): 0.30,
    ("USD", "INR"): 0.15,   # very common, more scrutinized
    ("EUR", "INR"): 0.15,
    ("AED", "INR"): 0.40,   # airport/tourist market corridor
    ("GBP", "INR"): 0.20,
}

pairs = list(CURRENCY_PAIR_RISK.keys())

rows = []
for _ in range(N_SAMPLES):
    pair = pairs[np.random.randint(len(pairs))]
    base_pair_risk = CURRENCY_PAIR_RISK[pair]

    # Markup: most transactions are fair (small markup), some are scams (large).
    # We mix two OVERLAPPING distributions — real fraud detection is never
    # perfectly separable; a genuine scam and a volatile-but-fair rate can
    # look similar at the margin. This overlap is intentional: it forces
    # the model to learn a genuine probabilistic boundary instead of
    # trivially finding a clean gap in the data.
    is_actually_scam = np.random.random() < (0.15 + base_pair_risk * 0.3)
    if is_actually_scam:
        markup_percent = np.random.normal(loc=0.06, scale=0.035)  # centered ~6%, overlaps with normal
    else:
        markup_percent = np.random.normal(loc=0.01, scale=0.025)  # centered ~1%, overlaps with scam
    markup_percent = np.clip(markup_percent, -0.03, 0.30)

    amount_inr = np.random.lognormal(mean=6.5, sigma=1.2)  # realistic skewed amounts
    amount_inr = min(amount_inr, 50000)  # cap outliers

    rows.append({
        "base_currency": pair[0],
        "target_currency": pair[1],
        "pair_base_risk": base_pair_risk,
        "markup_percent": markup_percent,
        "amount_inr": amount_inr,
        "money_at_stake_inr": markup_percent * amount_inr,  # engineered feature
        "is_risky": int(is_actually_scam),
    })

df = pd.DataFrame(rows)
df.to_csv("/home/claude/qr-pay-project/data/synthetic_transactions.csv", index=False)

print(f"Generated {len(df)} synthetic transactions")
print(f"Risky: {df['is_risky'].sum()} ({df['is_risky'].mean():.1%})")
print("\nSample rows:")
print(df.head(8).to_string())
