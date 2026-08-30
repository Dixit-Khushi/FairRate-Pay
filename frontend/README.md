# FairRate Pay — Web Frontend

The user-facing web interface for **FairRate Pay**, built to scan shop QR codes, evaluate live market exchange rates, flag Dynamic Currency Conversion (DCC) markups, display ML risk predictions, and simulate test payments.

---

## Features

1. **QR Code Reader & Preset Selection**:
   - **Upload QR Image**: Select or drag-and-drop a shop's QR image (decoded client-side via `jsQR`).
   - **Quick Demo Presets**: 1-click preset buttons for Bangkok Coffee Corner (THB), Seoul Snack Bar (KRW), and Tokyo Ramen Yatai (JPY).
   - **Raw Payload JSON Editor**: Paste or edit raw shop QR JSON strings directly.
2. **Transparent FX & DCC Risk Verdict**:
   - Compares live market rate vs. shop terminal offered rate.
   - Highlights estimated overcharge in home currency (e.g. `+₹170.00`).
   - Color-coded verdict badges: **Green** (Fair Deal), **Yellow** (Elevated Markup), **Red** (High Risk DCC Warning).
3. **ML Risk Model Gauge**:
   - Displays ML logistic regression risk probability score (0–100%) and feature breakdown.
4. **Test Mode Payment Simulation**:
   - Integrates with `POST /payment/create-order` to simulate sandbox order creation with clear test mode labels.

---

## How to Run

### Step 1: Start the Backend API
Make sure the backend is running on `http://localhost:8000`:

```bash
cd backend
python train_risk_model.py
uvicorn main:app --reload
```

### Step 2: Open the Frontend
You can open `index.html` directly in any web browser, or serve it using Python's static file server:

```bash
# Option A: Open index.html directly in browser
# Option B: Run a local static file server from the project root
python -m http.server 3000 --directory frontend
```

Then visit `http://localhost:3000` in your browser.

---

## Demo Script Walkthrough (For Video Recording)

1. **Scenario 1: Fair Market Transaction**
   - Select **"Bangkok Coffee Corner"** preset (500 THB).
   - Leave Terminal Offered Rate blank.
   - Click **"Check Exchange Rate Risk"**.
   - Point out the **Green "Fair Deal"** verdict and low ML risk score.

2. **Scenario 2: Dynamic Currency Conversion (DCC) Overcharge**
   - Keep **"Bangkok Coffee Corner"** preset (500 THB).
   - Enter `2.75` in **Terminal Offered Rate** (simulates terminal charging 2.75 INR per THB instead of live rate 2.41).
   - Click **"Check Exchange Rate Risk"**.
   - Point out the **Red "High Risk / DCC Warning"** banner, the overpay highlight (`+₹170.00`), and the **ML Risk Probability Score**.

3. **Scenario 3: Test Payment Order Simulation**
   - Click **"Proceed to Pay (₹1,375.00)"**.
   - Show the **Test Mode Payment Confirmation Modal** with Order ID and Sandbox Notice.
