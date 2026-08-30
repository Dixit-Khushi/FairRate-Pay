"""
train_risk_model.py — trains a logistic regression model to score
transaction risk, and saves it for use in the API.

WHY LOGISTIC REGRESSION (not a fancier model):
- It outputs a probability (0-1), which maps naturally to "risk score" —
  more interpretable for a demo than a black-box classifier.
- With only 3-4 features, a complex model (random forest, neural net) would
  be overkill and harder to explain in a judge Q&A. "I used logistic
  regression because I can show you exactly which factors drove the score"
  is a strong, honest answer.
- This is a real, legitimate ML technique — not a toy — used in actual
  credit risk and fraud scoring systems for exactly this reason
  (interpretability matters in finance).
"""

import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.preprocessing import StandardScaler
import joblib

df = pd.read_csv("/home/claude/qr-pay-project/data/synthetic_transactions.csv")

FEATURES = ["pair_base_risk", "markup_percent", "amount_inr", "money_at_stake_inr"]
X = df[FEATURES]
y = df["is_risky"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# Scale features — logistic regression is sensitive to feature magnitude
# (amount_inr can be in the thousands, markup_percent is a small decimal)
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

model = LogisticRegression(random_state=42)
model.fit(X_train_scaled, y_train)

# Evaluate — always check this before trusting the model
y_pred = model.predict(X_test_scaled)
y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]

print("=== Model Performance ===")
print(classification_report(y_test, y_pred, target_names=["Not Risky", "Risky"]))
print(f"ROC-AUC Score: {roc_auc_score(y_test, y_pred_proba):.3f}")

print("\n=== Feature Importance (coefficients) ===")
for feature, coef in zip(FEATURES, model.coef_[0]):
    direction = "increases" if coef > 0 else "decreases"
    print(f"  {feature}: {coef:.3f} ({direction} risk)")

# Save both the model AND the scaler — you need both at prediction time
joblib.dump(model, "/home/claude/qr-pay-project/backend/risk_model.joblib")
joblib.dump(scaler, "/home/claude/qr-pay-project/backend/risk_scaler.joblib")
print("\nModel and scaler saved.")
