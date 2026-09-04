# FairRate Pay — Web Frontend Architecture & Setup

The user-facing web interface for **FairRate Pay**, built to scan shop QR codes, evaluate live interbank exchange rates, flag Dynamic Currency Conversion (DCC) markups, display ML risk predictions, and simulate test payments via Razorpay Sandbox SDK.

---

## ⚡ Zero Build-Step React Architecture

Unlike traditional React projects that require `npm install`, `npm run build`, and heavy `node_modules` folders, this frontend is built as a **zero-dependency React 18 Single-Page Application (SPA)**:

* **Direct Browser Execution**: Uses React 18 and Babel standalone loaded directly in `index.html`.
* **Zero Build Step**: No `npm install` or `npm build` needed! Anyone cloning this repository can run it immediately without Node.js toolchain setup errors.
* **Instant Serving**: Open `index.html` directly in Google Chrome, or serve it using any lightweight static HTTP server (`python -m http.server 3000`).

---

## 🛠️ Key Features

1. **Multi-Source QR Reader & Preset Selection**:
   - **Upload QR Image**: Upload or drag-and-drop a shop's QR photo (decoded client-side via `jsQR`).
   - **Live Camera Scanner**: Real-time webcam/device camera QR scanner via `navigator.mediaDevices.getUserMedia`.
   - **Quick Travel Presets**: 1-click preset vouchers for Bangkok Coffee Corner (THB), Seoul Snack Bar (KRW), and Tokyo Ramen Yatai (JPY).
   - **Raw Payload JSON Editor**: Paste or edit raw shop QR JSON strings directly.
2. **Explicit Amount Input Flow**:
   - Asks for **Amount as Per Shopkeeper** (local currency) and optional **Amount Told by Shopkeeper in Your Currency**.
   - Automatically calculates the implied exchange rate (`quoted_amount / shop_amount`) and sends it to `POST /payer/scan-and-assess`.
3. **Transparent FX & DCC Risk Verdict**:
   - Compares live interbank rate vs. shop terminal quoted rate.
   - Highlights estimated overcharge in home currency (e.g. `+₹205.00 (+14.19%)`).
   - Prominent **Customs Stamp Verdict**: **APPROVED RATE** (Emerald), **ELEVATED MARKUP** (Amber), **REJECT: HIGH-RISK DCC ABUSE DETECTED** (Crimson).
4. **ML Risk Model Gauge**:
   - Displays ML logistic regression risk probability score (0–100%) and feature breakdown.
5. **Razorpay Sandbox Checkout Integration**:
   - Integrates with Razorpay `checkout.js` SDK and `POST /payment/verify` for HMAC signature verification and Payment Transaction ID (`pay_...`) display.

---

## 🚀 How to Run

### Option A: Serve via Python (Recommended)
```bash
# From project root directory
python -m http.server 3000 --directory frontend
```
Then visit **`http://localhost:3000`** in Google Chrome.

### Option B: Direct Browser Opening
Double-click `frontend/index.html` to open it directly in Google Chrome.
