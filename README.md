# FairRate Pay

**Detecting hidden currency conversion markups in cross-border QR payments.**

## The Problem

When traveling abroad, shops and payment terminals sometimes quietly convert
prices into your home currency at a worse-than-market rate — a real,
documented practice called Dynamic Currency Conversion (DCC) abuse. Travelers
routinely overpay without realizing it, because there's no easy way to check
the real rate at the point of payment.

## What This Does

1. Scan a shop's QR code (identifies their currency and payment ID)
2. Enter the amount the shop is charging, in their currency
3. The app fetches the live market exchange rate in real time
4. If the shop is offering its own converted rate, the app compares it
   against the true rate
5. A rule-based check AND a machine learning risk model both assess the
   transaction, flagging suspicious markups before you pay

## Architecture

- `forex.py` — live exchange rate fetching, with a fallback + currency
  triangulation system for when the live API is unreachable
- `qr_handler.py` — generates and decodes shop payment QR codes
- `transparency.py` — rule-based markup detection with explainable thresholds
- `generate_training_data.py` / `train_risk_model.py` / `risk_model.py` —
  a logistic regression model trained on synthetic transaction data to
  score risk based on markup %, currency pair risk, and amount at stake
- `payment_flow.py` — orchestrates the full flow end to end
- `main.py` — FastAPI backend exposing everything as HTTP endpoints

## Running It

```bash
pip install -r requirements.txt
cd backend
python3 train_risk_model.py   # trains the ML model (one-time)
uvicorn main:app --reload
```

Visit `http://localhost:8000/docs` for interactive API documentation.

## Known Limitations (Being Honest About Scope)

- This is a prototype: it does **not** move real cross-border money. Payment
  confirmation is designed to run through Razorpay's sandbox/test mode,
  simulating a real transaction without real banking rails.
- The ML risk model is trained on **synthetic data**, since no public
  dataset of labeled DCC fraud cases exists. The synthetic data was designed
  using domain knowledge of real DCC patterns (documented markup ranges,
  known higher-risk tourist corridors).
- Currently supports QR-based payments only; card/tap-and-pay support
  (where DCC abuse is arguably even more common) is a natural next step.

## Built For

Razorpay AI Buildathon 2026 — AI Risk Manager track.
