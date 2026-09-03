# FairRate Pay

**Detecting hidden currency conversion markups in cross-border QR payments.**

Built for **Razorpay AI Buildathon 2026 — AI Risk Manager Track**.

---

## 🚨 The Problem: Dynamic Currency Conversion (DCC) Abuse

When traveling abroad and paying at foreign shops or payment terminals, merchants often quietly offer to convert the transaction into your home currency. While marketed as a "convenience," this practice — known as **Dynamic Currency Conversion (DCC)** — often applies inflated exchange rates with hidden markups ranging from 3% to 15% above the true interbank rate.

Travelers lose hundreds of dollars without realizing it because there is no instant way to verify the real interbank rate at the point of payment.

---

## 🛡️ What It Does

1. **Scan Merchant QR Code**: Decodes the shop's payment QR (identifies merchant name, local currency, shop ID, and payment address).
2. **Fetch Live Interbank Exchange Rate**: Fetches true live FX exchange rates in real-time with automatic currency triangulation fallback.
3. **Dual Risk Assessment (Rules + Machine Learning)**:
   - **Rule-Based Transparency Engine**: Classifies markups as **FAIR** ($\le 1.5\%$), **ELEVATED** ($1.5\% - 4\%$), or **HIGH RISK** ($> 4\%$).
   - **Logistic Regression ML Risk Model**: Scores overall transaction risk ($0–100\%$) based on currency pair risk, markup percentage, and total money at stake.
4. **Instant Travel Customs Clearance UI**: Displays an unmissable Passport Stamp Verdict (`✓ APPROVED RATE` vs `🚨 REJECT: HIGH-RISK DCC ABUSE`) and highlights exact overcharge amounts.
5. **Razorpay Sandbox Checkout**: Integrates with Razorpay Test Mode (`checkout.js` + server-side HMAC signature verification) to simulate test payments safely.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.11, FastAPI, Uvicorn, Pydantic
- **Machine Learning & Data**: scikit-learn (Logistic Regression), pandas, NumPy, joblib
- **Frontend**: React 18 (Functional Components + Hooks), Tailwind CSS, `jsQR` (client-side QR matrix decoder), Razorpay `checkout.js` SDK
- **Payments**: Razorpay Python SDK (`razorpay`), HMAC-SHA256 signature verification

---

## 🚀 How to Run It Locally

### Prerequisites
- Python 3.11+

### Step 1: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 2: Train the ML Risk Model (One-Time Setup)
```bash
python backend/train_risk_model.py
```

### Step 3: Start the Backend API Server
```bash
cd backend
uvicorn main:app --port 8000 --reload
```
The backend API will be available at `http://localhost:8000`. Interactive API documentation (Swagger UI) is available at `http://localhost:8000/docs`.

### Step 4: Start the Web Frontend
In a new terminal window:
```bash
python -m http.server 3000 --directory frontend
```
Open **`http://localhost:3000`** in Google Chrome or any modern browser.

---

## 🔑 Environment Setup (Razorpay Test Keys)

Copy `.env.example` to `.env` or set environment variables:

```bash
# PowerShell
$env:RAZORPAY_KEY_ID="rzp_test_xxxxxxxxxxxx"
$env:RAZORPAY_KEY_SECRET="your_test_secret_here"

# Linux / macOS / Bash
export RAZORPAY_KEY_ID="rzp_test_xxxxxxxxxxxx"
export RAZORPAY_KEY_SECRET="your_test_secret_here"
```
*(Note: These are TEST/Sandbox mode keys from https://dashboard.razorpay.com/ — no real money moves).*

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Liveness health check |
| `POST` | `/shop/generate-qr` | Generates a shop payment QR code payload |
| `POST` | `/payer/scan-and-assess` | Core endpoint: decodes QR, fetches live FX rate, calculates implied rate & overcharge, returns rule-based verdict and ML risk score |
| `POST` | `/payment/create-order` | Creates a Razorpay Sandbox test order |
| `POST` | `/payment/verify` | Verifies Razorpay payment HMAC-SHA256 signature server-side |

---

## ⚠️ Known Limitations (Scope Transparency)

- **Payment is TEST MODE ONLY (no real money moves)**: Payment processing uses Razorpay's sandbox/test mode to simulate transaction flow without touching live banking rails.
- **ML model trained on synthetic data**: Since no public dataset of labeled DCC fraud cases exists, the risk model is trained on synthetic transaction data designed using domain knowledge of real DCC markup patterns and tourist currency corridors.
- **This is a risk-detection layer, not a complete payment product**: Designed as a specialized surveillance and transparency tool before point-of-sale checkout.
